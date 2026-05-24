// EXODUS CLOTHING - COMPLETE BACKEND
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 8)}.jpg`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Supabase connection
const supabaseUrl = 'https://vngzqfjggllcjldylhhy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZ3pxZmpnZ2xsY2psZHlsaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjQzOTgsImV4cCI6MjA5MTg0MDM5OH0.O-BnHiwwqeycCFmOuFHFwTksiVjwP72qIKUmBcT06Ec';

const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_EMAIL = 'exodusclothingeth@gmail.com';
const ADMIN_PHONE = '+251968621548';

// ========== FORMSPREE CONFIGURATION ==========
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mlgzwdbj';

// ========== COMING SOON MODE - CHANGE THIS LINE ==========
// Set to true to show "Coming Soon" page, false to show your real store
const COMING_SOON_MODE = true;  // <--- CHANGE THIS

// Store verification codes
const verificationCodes = {};

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to send email via Formspree
async function sendViaFormspree(emailData) {
    try {
        const response = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(emailData)
        });
        
        if (response.ok) {
            console.log('✅ Email sent via Formspree');
            return true;
        } else {
            console.error('Formspree error:', response.status);
            return false;
        }
    } catch (error) {
        console.error('Formspree send error:', error);
        return false;
    }
}

// ========== COMING SOON MIDDLEWARE ==========
app.use((req, res, next) => {
    // Skip for API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    // Skip for static files
    if (req.path.match(/\.(jpg|jpeg|png|gif|css|js|ico|svg|woff|woff2|ttf)$/)) {
        return next();
    }
    
    // Skip for admin pages (so you can still login)
    if (req.path === '/admin.html' || req.path === '/verify.html' || req.path === '/product-manager.html') {
        return next();
    }
    
    // If coming soon mode is ON, show coming soon page
    if (COMING_SOON_MODE === true) {
        // Check if coming-soon.html exists
        return res.sendFile('coming-soon.html', { root: '.' }, (err) => {
            if (err) {
                // Fallback if file doesn't exist
                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>EXODUS - Coming Soon</title>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body { background: #000; color: #fff; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; text-align: center; margin: 0; }
                            .container { max-width: 500px; padding: 20px; }
                            h1 { font-size: 3rem; margin-bottom: 20px; }
                            p { color: #aaa; margin-bottom: 30px; }
                            .social a { color: white; margin: 0 10px; text-decoration: none; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>EXODUS</h1>
                            <h2>Coming Soon</h2>
                            <p>Something extraordinary is coming to Ethiopian streetwear.</p>
                            <p>📞 +251968621548<br>✉️ exodusclothingeth@gmail.com</p>
                            <div class="social">
                                <a href="https://www.instagram.com/exodus_stw">Instagram</a>
                                <a href="#">Telegram</a>
                                <a href="#">TikTok</a>
                            </div>
                        </div>
                    </body>
                    </html>
                `);
            }
        });
    }
    
    next();
});

// ========== NOTIFY ME ==========
app.post('/api/notify', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.json({ success: false, error: 'Invalid email' });
        }
        
        await sendViaFormspree({
            email: ADMIN_EMAIL,
            subject: '📧 New EXODUS Subscriber',
            message: `New subscriber: ${email}\nTime: ${new Date().toLocaleString()}`
        });
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

// ========== ADMIN EMAIL VERIFICATION ==========
app.post('/api/send-verification', async (req, res) => {
    try {
        const { email } = req.body;
        if (email !== ADMIN_EMAIL) {
            return res.json({ success: false, error: 'Unauthorized email' });
        }
        
        const code = generateCode();
        verificationCodes[email] = { code, expires: Date.now() + 10 * 60000 };
        console.log(`📧 Verification code for ${email}: ${code}`);
        
        await sendViaFormspree({
            email: ADMIN_EMAIL,
            subject: '🔐 EXODUS Admin Login Code',
            message: `Your verification code is: ${code}\n\nExpires in 10 minutes.`
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        const stored = verificationCodes[email];
        
        if (!stored) return res.json({ success: false, error: 'No code found' });
        if (Date.now() > stored.expires) return res.json({ success: false, error: 'Code expired' });
        if (stored.code !== code) return res.json({ success: false, error: 'Invalid code' });
        
        delete verificationCodes[email];
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== PRODUCTS ==========
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        res.json([]);
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price, images, sizes, stock, category } = req.body;
        const { data, error } = await supabase.from('products').insert([{
            name, price, images: images || [], sizes, stock, category: category || 'uncategorized', created_at: new Date()
        }]).select();
        if (error) throw error;
        res.json({ success: true, product: data[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, images, sizes, stock, category } = req.body;
        const { data, error } = await supabase.from('products').update({ name, price, images, sizes, stock, category }).eq('id', id).select();
        if (error) throw error;
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

// ========== ORDERS ==========
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
            items: items,
            total: total,
            status: 'pending',
            delivery_status: 'pending',
            created_at: new Date()
        }]);
        
        if (error) throw error;
        
        // Send confirmation emails
        const itemsList = items.map(item => `- ${item.name} (${item.size}) x${item.quantity} = ${(item.price * item.quantity).toLocaleString()} ETB`).join('\n');
        
        await sendViaFormspree({
            email: customer.email,
            subject: `🖤 Order Confirmation ${orderId}`,
            message: `Thank you for your order!\n\nOrder ID: ${orderId}\n\nItems:\n${itemsList}\n\nTotal: ${total.toLocaleString()} ETB\n\nCash on Delivery`
        });
        
        await sendViaFormspree({
            email: ADMIN_EMAIL,
            subject: `🖤 NEW ORDER! ${orderId}`,
            message: `New order from ${customer.name}\nPhone: ${customer.phone}\nAddress: ${customer.address}\nTotal: ${total.toLocaleString()} ETB`
        });
        
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
        const { orderId } = req.params;
        const { delivery_status } = req.body;
        await supabase.from('orders').update({ delivery_status }).eq('order_id', orderId);
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

// ========== HERO IMAGES ==========
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
        await supabase.from('settings').upsert({ key: 'hero_images', value: JSON.stringify(images || []) }, { onConflict: 'key' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/hero-image', async (req, res) => {
    try {
        const { data } = await supabase.from('settings').select('value').eq('key', 'hero_image').single();
        res.json({ url: data?.value || null });
    } catch (error) {
        res.json({ url: null });
    }
});

app.post('/api/hero-image', async (req, res) => {
    try {
        const { url } = req.body;
        await supabase.from('settings').upsert({ key: 'hero_image', value: url }, { onConflict: 'key' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🖤 EXODUS CLOTHING RUNNING on port ${PORT}`);
    console.log(`🔒 COMING SOON MODE: ${COMING_SOON_MODE ? 'ON (showing coming soon page)' : 'OFF (showing store)'}`);
});
