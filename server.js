const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Create uploads folder
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}
app.use('/uploads', express.static('uploads'));

// ============================================
// SUPABASE CONFIGURATION - REPLACE WITH YOURS!
// ============================================
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ Connected to Supabase');

// ============================================
// EMAIL CONFIGURATION (For verification codes)
// ============================================
// For development, we'll store codes in memory
// In production, use a real email service
const verificationCodes = {};

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple email sending via console (for now)
// Replace with actual email service when you have one
async function sendVerificationEmail(email, code) {
    console.log(`📧 VERIFICATION CODE for ${email}: ${code}`);
    console.log(`🔐 Use this code to login: ${code}`);
    
    // In production, you would use nodemailer or email API here
    // For now, admin can see the code in the server logs
    
    return true;
}

// ============================================
// FILE UPLOAD CONFIG
// ============================================
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 8)}.jpg`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ============================================
// ADMIN EMAIL VERIFICATION
// ============================================
const ADMIN_EMAIL = 'exodusclothingeth@gmail.com';

app.post('/api/send-verification', async (req, res) => {
    try {
        const { email } = req.body;
        
        // For demo, accept any email. In production, check if it's admin email
        const code = generateCode();
        verificationCodes[email] = { code, expires: Date.now() + 10 * 60000 };
        
        await sendVerificationEmail(email, code);
        
        res.json({ success: true, message: 'Verification code sent' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        const stored = verificationCodes[email];
        
        if (!stored) {
            return res.json({ success: false, error: 'No verification code found. Request a new one.' });
        }
        if (Date.now() > stored.expires) {
            return res.json({ success: false, error: 'Code expired. Request a new one.' });
        }
        if (stored.code !== code) {
            return res.json({ success: false, error: 'Invalid code. Try again.' });
        }
        
        delete verificationCodes[email];
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// STOCK ALERT FUNCTION
// ============================================
async function checkStockAndSendAlerts() {
    try {
        const { data: products } = await supabase.from('products').select('*');
        
        const lowStockProducts = [];
        const outOfStockProducts = [];
        
        products.forEach(product => {
            const stock = product.stock || {};
            let totalStock = 0;
            Object.values(stock).forEach(qty => totalStock += qty);
            
            if (totalStock === 0) {
                outOfStockProducts.push(product.name);
            } else if (totalStock <= 3) {
                lowStockProducts.push({ name: product.name, stock: totalStock });
            }
        });
        
        let alertMessage = '';
        if (outOfStockProducts.length > 0) {
            alertMessage += `⚠️ OUT OF STOCK: ${outOfStockProducts.join(', ')}\n`;
        }
        if (lowStockProducts.length > 0) {
            alertMessage += `📦 LOW STOCK (≤3 left): ${lowStockProducts.map(p => `${p.name} (${p.stock} left)`).join(', ')}`;
        }
        
        if (alertMessage) {
            console.log('🔔 STOCK ALERT:\n', alertMessage);
            // In production, send email here
        }
        
        return { outOfStock: outOfStockProducts, lowStock: lowStockProducts };
    } catch (error) {
        console.error('Stock check error:', error);
        return { outOfStock: [], lowStock: [] };
    }
}

// Run stock check every hour
setInterval(checkStockAndSendAlerts, 60 * 60 * 1000);

// ============================================
// VISITOR COUNTER
// ============================================
let visitorCount = 0;

app.get('/api/visitor-count', async (req, res) => {
    try {
        // Get from Supabase or increment memory
        const { data } = await supabase.from('settings').select('value').eq('key', 'visitor_count').single();
        let count = data?.value ? parseInt(data.value) : 0;
        count++;
        
        await supabase.from('settings').upsert({ key: 'visitor_count', value: count.toString() }, { onConflict: 'key' });
        
        res.json({ count });
    } catch (error) {
        visitorCount++;
        res.json({ count: visitorCount });
    }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// PRODUCT ROUTES
// ============================================
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        // Check stock alerts and attach to response
        const stockAlerts = await checkStockAndSendAlerts();
        
        res.json({ products: data || [], stockAlerts });
    } catch (error) {
        console.error('Products error:', error);
        res.json({ products: [], stockAlerts: { outOfStock: [], lowStock: [] } });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price, images, sizes, stock, category } = req.body;
        
        const { data, error } = await supabase.from('products').insert([{
            name,
            price: parseInt(price),
            images: images || [],
            sizes: sizes || ['S', 'M', 'L', 'XL', 'XXL'],
            stock: stock || {},
            category: category || 'mens',
            created_at: new Date()
        }]).select();
        
        if (error) throw error;
        
        // Check stock after adding
        await checkStockAndSendAlerts();
        
        res.json({ success: true, product: data[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, images, sizes, stock, category } = req.body;
        
        const { data, error } = await supabase.from('products').update({ 
            name, price: parseInt(price), images, sizes, stock, category 
        }).eq('id', id).select();
        
        if (error) throw error;
        
        // Check stock after update
        await checkStockAndSendAlerts();
        
        res.json({ success: true, product: data[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await supabase.from('products').delete().eq('id', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ORDER ROUTES
// ============================================
app.post('/api/orders', async (req, res) => {
    try {
        const { customer, items, total } = req.body;
        const orderId = 'EXD-' + Date.now();
        
        const { error } = await supabase.from('orders').insert([{
            order_id: orderId,
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            customer_address: customer.address,
            items,
            total,
            delivery_status: 'pending',
            created_at: new Date()
        }]);
        
        if (error) throw error;
        res.json({ success: true, orderId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        res.json([]);
    }
});

app.put('/api/orders/:orderId/status', async (req, res) => {
    try {
        await supabase.from('orders').update({ delivery_status: req.body.delivery_status }).eq('order_id', req.params.orderId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upload-delivery-photo/:orderId', upload.single('photo'), async (req, res) => {
    try {
        const photoUrl = `/uploads/${req.file.filename}`;
        await supabase.from('orders').update({ delivery_photo: photoUrl }).eq('order_id', req.params.orderId);
        res.json({ success: true, photoUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// HERO IMAGES ROUTES
// ============================================
app.get('/api/hero-images', async (req, res) => {
    try {
        const { data } = await supabase.from('settings').select('value').eq('key', 'hero_images').single();
        res.json({ images: data?.value ? JSON.parse(data.value) : [] });
    } catch (error) {
        res.json({ images: [] });
    }
});

app.post('/api/hero-images', async (req, res) => {
    try {
        const { images } = req.body;
        await supabase.from('settings').upsert({ key: 'hero_images', value: JSON.stringify(images) }, { onConflict: 'key' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🖤 EXODUS CLOTHING RUNNING on port ${PORT}`);
    console.log(`📦 API: http://localhost:${PORT}/api/products`);
    console.log(`🔐 Admin email: exodusclothingeth@gmail.com`);
    console.log(`📧 Verification codes will appear in console logs`);
});
