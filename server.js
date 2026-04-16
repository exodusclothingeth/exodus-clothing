// EXODUS CLOTHING - Complete Backend with Email Login
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

// Create uploads folder if it doesn't exist
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// Configure multer for photo uploads
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

console.log('✅ Connected to Supabase');

// ========== PRODUCT APIS ==========
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (error) { res.json([]); }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price, image, sizes, stock } = req.body;
        const { data, error } = await supabase.from('products').insert([{ name, price, image, sizes, stock }]).select();
        if (error) throw error;
        res.json({ success: true, product: data[0] });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, image, sizes, stock } = req.body;
        const { data, error } = await supabase.from('products').update({ name, price, image, sizes, stock }).eq('id', id).select();
        if (error) throw error;
        res.json({ success: true, product: data[0] });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await supabase.from('products').delete().eq('id', id);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
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
                html: `<div style="font-family: Arial, sans-serif;"><h2>Thank you for your order!</h2><p>Order ID: ${orderId}</p><p>Total: ${total} ETB</p><p>We will contact you within 24 hours for delivery.</p><p>Questions? Call: ${YOUR_PHONE}</p></div>`
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
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/orders', async (req, res) => {
    try {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (error) { res.json([]); }
});

app.put('/api/orders/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, delivery_status } = req.body;
        const updateData = {};
        if (status) updateData.status = status;
        if (delivery_status) updateData.delivery_status = delivery_status;
        
        const { data, error } = await supabase.from('orders').update(updateData).eq('order_id', orderId).select();
        if (error) throw error;
        
        const order = data[0];
        
        // Send notification when out for delivery
        if (delivery_status === 'out_for_delivery' && order && transporter) {
            await transporter.sendMail({
                from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                to: order.customer_email,
                subject: `📦 EXODUS - Your Order #${orderId} is Out for Delivery!`,
                html: `<div><h2>Your Order is Out for Delivery!</h2><p>Order ID: ${orderId}</p><p>Total to pay: ${order.total} ETB (Cash on delivery)</p><p>Delivery person will call before arriving.</p></div>`
            });
        }
        
        // Send thank you when delivered
        if (delivery_status === 'delivered' && order && transporter) {
            await transporter.sendMail({
                from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                to: order.customer_email,
                subject: `✅ EXODUS - Order #${orderId} Delivered!`,
                html: `<div><h2>Order Delivered!</h2><p>Thank you for shopping with EXODUS CLOTHING!</p><p>Follow us on Instagram: @exodus_stw</p></div>`
            });
        }
        
        res.json({ success: true, order: data[0] });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ========== DELIVERY PHOTO UPLOAD ==========
app.post('/api/upload-delivery-photo/:orderId', upload.single('photo'), async (req, res) => {
    try {
        const { orderId } = req.params;
        const photoUrl = `/uploads/${req.file.filename}`;
        
        const { data, error } = await supabase
            .from('orders')
            .update({ delivery_photo: photoUrl })
            .eq('order_id', orderId)
            .select();
        
        if (error) throw error;
        res.json({ success: true, photoUrl });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ========== HERO IMAGE API ==========
app.get('/api/hero-image', async (req, res) => {
    try {
        const { data, error } = await supabase.from('settings').select('value').eq('key', 'hero_image').single();
        if (error && error.code !== 'PGRST116') throw error;
        res.json({ url: data?.value || null });
    } catch (error) { res.json({ url: null }); }
});

app.post('/api/hero-image', async (req, res) => {
    try {
        const { url } = req.body;
        await supabase.from('settings').upsert({ key: 'hero_image', value: url }, { onConflict: 'key' });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ========== ADMIN LOGIN API (Email + Password from Database) ==========
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Query the database for the admin user
        const { data, error } = await supabase
            .from('admin_users')
            .select('email, password_hash')
            .eq('email', email)
            .single();
        
        if (error || !data) {
            return res.json({ success: false, error: 'Invalid email or password' });
        }
        
        // Compare password
        if (data.password_hash === password) {
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== CHANGE ADMIN PASSWORD ==========
app.post('/api/admin/change-password', async (req, res) => {
    try {
        const { email, oldPassword, newPassword } = req.body;
        
        const { data, error } = await supabase
            .from('admin_users')
            .select('password_hash')
            .eq('email', email)
            .single();
        
        if (error || !data || data.password_hash !== oldPassword) {
            return res.json({ success: false, error: 'Current password is incorrect' });
        }
        
        const { error: updateError } = await supabase
            .from('admin_users')
            .update({ password_hash: newPassword })
            .eq('email', email);
        
        if (updateError) {
            return res.json({ success: false, error: updateError.message });
        }
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     🖤 EXODUS CLOTHING - COMPLETE STORE RUNNING              ║
║                                                              ║
║     URL: http://localhost:${PORT}                              ║
║     Email: ${YOUR_EMAIL}                                      ║
║     Phone: ${YOUR_PHONE}                                      ║
║                                                              ║
║     ✅ Email notifications ready                             ║
║     ✅ Admin login with email/password                       ║
║     ✅ Delivery photo upload ready                           ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});