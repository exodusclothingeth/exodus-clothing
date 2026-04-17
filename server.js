// EXODUS CLOTHING - Complete Backend with Hero Images Slideshow
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

// Create uploads folder
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// Multer setup for photo uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 8)}.jpg`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Your contact info
const YOUR_EMAIL = 'exodusclothingeth@gmail.com';
const YOUR_PHONE = '+251968621548';

// Email setup
let transporter = null;
if (process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: YOUR_EMAIL, pass: process.env.EMAIL_PASS }
    });
    console.log('✅ Email notifications ready');
}

// ========== EMAIL VERIFICATION STORAGE ==========
const verificationCodes = {};

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

console.log('✅ Connected to Supabase');

// ========== EMAIL VERIFICATION API ==========
app.post('/api/send-verification', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (email !== YOUR_EMAIL) {
            return res.json({ success: false, error: 'Unauthorized email address' });
        }
        
        const code = generateCode();
        
        verificationCodes[email] = {
            code: code,
            expires: Date.now() + 5 * 60 * 1000
        };
        
        console.log(`📧 Verification code for ${email}: ${code}`);
        
        if (transporter) {
            await transporter.sendMail({
                from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                to: email,
                subject: '🔐 EXODUS - Admin Login Code',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #fff;">
                        <div style="background: #000; padding: 20px; text-align: center;">
                            <h1 style="color: #fff; margin: 0;">EXODUS</h1>
                        </div>
                        <div style="padding: 20px;">
                            <h2>Your Login Code</h2>
                            <div style="font-size: 32px; font-weight: bold; padding: 20px; background: #f0f0f0; text-align: center; letter-spacing: 5px;">
                                ${code}
                            </div>
                            <p>This code expires in 5 minutes.</p>
                        </div>
                    </div>
                `
            });
            res.json({ success: true, message: 'Verification code sent to your email' });
        } else {
            res.json({ success: true, code: code, message: 'Test mode - Use code: ' + code });
        }
    } catch (error) {
        console.error('Error sending verification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        
        if (email !== YOUR_EMAIL) {
            return res.json({ success: false, error: 'Unauthorized email address' });
        }
        
        const stored = verificationCodes[email];
        
        if (!stored) {
            return res.json({ success: false, error: 'No verification code found. Request a new one.' });
        }
        
        if (Date.now() > stored.expires) {
            delete verificationCodes[email];
            return res.json({ success: false, error: 'Verification code has expired. Request a new one.' });
        }
        
        if (stored.code !== code) {
            return res.json({ success: false, error: 'Invalid verification code. Please try again.' });
        }
        
        delete verificationCodes[email];
        res.json({ success: true, message: 'Verification successful' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== PRODUCT APIS ==========
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (error) { 
        console.error('Error fetching products:', error);
        res.json([]); 
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price, images, sizes, stock, category } = req.body;
        
        console.log('📦 Adding product:', { name, price, category });
        
        const productData = {
            name,
            price,
            images: images || [],
            sizes: sizes || ['S', 'M', 'L', 'XL', 'XXL'],
            stock: stock || {},
            category: category || 'uncategorized',
            created_at: new Date()
        };
        
        const { data, error } = await supabase
            .from('products')
            .insert([productData])
            .select();
        
        if (error) throw error;
        
        console.log('✅ Product added successfully');
        res.json({ success: true, product: data[0] });
    } catch (error) { 
        console.error('❌ Error adding product:', error);
        res.status(500).json({ error: error.message }); 
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, images, sizes, stock, category } = req.body;
        
        const { data, error } = await supabase
            .from('products')
            .update({ name, price, images: images || [], sizes, stock, category })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, product: data[0] });
    } catch (error) { 
        console.error('Error updating product:', error);
        res.status(500).json({ error: error.message }); 
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await supabase.from('products').delete().eq('id', id);
        res.json({ success: true });
    } catch (error) { 
        console.error('Error deleting product:', error);
        res.status(500).json({ error: error.message }); 
    }
});

// ========== ORDER APIS ==========
app.post('/api/orders', async (req, res) => {
    try {
        const { customer, items, total } = req.body;
        const orderId = 'EXD-' + Date.now();
        
        const { data, error } = await supabase.from('orders').insert([{
            order_id: orderId,
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            customer_address: customer.address,
            items: items,
            total: total,
            status: 'pending',
            delivery_status: 'pending'
        }]).select();
        
        if (error) throw error;
        
        if (transporter) {
            // Send confirmation to customer
            await transporter.sendMail({
                from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                to: customer.email,
                subject: `EXODUS - Order Confirmation ${orderId}`,
                html: `<h2>Thank you for your order!</h2><p>Order ID: ${orderId}</p><p>Total: ${total} ETB</p><p>We will contact you within 24 hours.</p><p>Questions? Call: ${YOUR_PHONE}</p>`
            });
            
            // Send notification to you
            await transporter.sendMail({
                from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                to: YOUR_EMAIL,
                subject: `🔥 NEW ORDER: ${orderId}`,
                html: `<h2>New Order!</h2><p>Order ID: ${orderId}</p><p>Customer: ${customer.name}</p><p>Phone: ${customer.phone}</p><p>Total: ${total} ETB</p><p>Address: ${customer.address}</p>`
            });
        }
        
        res.json({ success: true, orderId });
    } catch (error) { 
        console.error('Error creating order:', error);
        res.status(500).json({ error: error.message }); 
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (error) { 
        console.error('Error fetching orders:', error);
        res.json([]); 
    }
});

app.put('/api/orders/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { delivery_status } = req.body;
        
        const { data, error } = await supabase
            .from('orders')
            .update({ delivery_status })
            .eq('order_id', orderId)
            .select();
        
        if (error) throw error;
        
        const order = data[0];
        
        if (transporter && order && delivery_status === 'out_for_delivery') {
            await transporter.sendMail({
                from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                to: order.customer_email,
                subject: `📦 EXODUS - Your Order #${orderId} is Out for Delivery!`,
                html: `<h2>Your Order is Out for Delivery!</h2><p>Order ID: ${orderId}</p><p>Total to pay: ${order.total} ETB (Cash on delivery)</p><p>Delivery person will call before arriving.</p>`
            });
        }
        
        if (transporter && order && delivery_status === 'delivered') {
            await transporter.sendMail({
                from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                to: order.customer_email,
                subject: `✅ EXODUS - Your Order #${orderId} Has Been Delivered`,
                html: `<h2>Order Delivered!</h2><p>Thank you for shopping with EXODUS CLOTHING!</p><p>Follow us on Instagram: @exodus_stw</p>`
            });
        }
        
        res.json({ success: true, order: data[0] });
    } catch (error) { 
        console.error('Error updating order status:', error);
        res.status(500).json({ error: error.message }); 
    }
});

// ========== DELIVERY PHOTO UPLOAD ==========
app.post('/api/upload-delivery-photo/:orderId', upload.single('photo'), async (req, res) => {
    try {
        const { orderId } = req.params;
        const photoUrl = `/uploads/${req.file.filename}`;
        
        await supabase.from('orders').update({ delivery_photo: photoUrl }).eq('order_id', orderId);
        res.json({ success: true, photoUrl });
    } catch (error) { 
        console.error('Error uploading photo:', error);
        res.status(500).json({ error: error.message }); 
    }
});

// ========== HERO IMAGE API (Single - Legacy) ==========
app.get('/api/hero-image', async (req, res) => {
    try {
        const { data, error } = await supabase.from('settings').select('value').eq('key', 'hero_image').single();
        if (error && error.code !== 'PGRST116') throw error;
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
        console.error('Error saving hero image:', error);
        res.status(500).json({ error: error.message }); 
    }
});

// ========== HERO IMAGES API (Multiple for Slideshow) ==========
app.get('/api/hero-images', async (req, res) => {
    try {
        const { data, error } = await supabase.from('settings').select('value').eq('key', 'hero_images').single();
        if (error && error.code !== 'PGRST116') throw error;
        const images = data?.value ? JSON.parse(data.value) : [];
        res.json({ images: images });
    } catch (error) {
        res.json({ images: [] });
    }
});

app.post('/api/hero-images', async (req, res) => {
    try {
        const { images } = req.body;
        await supabase.from('settings').upsert({ 
            key: 'hero_images', 
            value: JSON.stringify(images || []) 
        }, { onConflict: 'key' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     🖤 EXODUS CLOTHING - COMPLETE STORE RUNNING              ║
║     URL: http://localhost:${PORT}                              ║
║     Email: ${YOUR_EMAIL}                                      ║
║     Phone: ${YOUR_PHONE}                                      ║
║                                                              ║
║     ✅ Email notifications ready                             ║
║     ✅ Product API with categories & multi-images            ║
║     ✅ Hero images slideshow API ready                       ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});
