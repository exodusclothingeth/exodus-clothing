// EXODUS CLOTHING - Complete Backend with Beautiful Email Templates
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

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 8)}.jpg`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const YOUR_EMAIL = 'exodusclothingeth@gmail.com';
const YOUR_PHONE = '+251968621548';

// ========== EMAIL SETUP ==========
let transporter = null;

if (process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { 
            user: YOUR_EMAIL, 
            pass: process.env.EMAIL_PASS 
        }
    });
    console.log('✅ Email notifications ready');
} else {
    console.log('⚠️ Email not configured. Add EMAIL_PASS to environment variables.');
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
                html: getVerificationEmailTemplate(code)
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
        
        // Send email to customer
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                    to: customer.email,
                    subject: `✨ EXODUS - Order Confirmation #${orderId}`,
                    html: getOrderConfirmationTemplate(orderId, customer, items, total)
                });
                console.log(`📧 Order confirmation sent to ${customer.email}`);
            } catch(emailError) {
                console.log('Customer email failed:', emailError.message);
            }
            
            // Send notification to brand owner
            try {
                await transporter.sendMail({
                    from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                    to: YOUR_EMAIL,
                    subject: `🔥 NEW ORDER: ${orderId}`,
                    html: getOwnerNotificationTemplate(orderId, customer, items, total)
                });
                console.log(`📧 Owner notification sent`);
            } catch(emailError) {
                console.log('Owner email failed:', emailError.message);
            }
        } else {
            console.log('⚠️ Email not configured - order saved but no email sent');
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
                html: getOutForDeliveryTemplate(orderId, order)
            });
            console.log(`📧 Out for delivery email sent to ${order.customer_email}`);
        }
        
        if (transporter && order && delivery_status === 'delivered') {
            await transporter.sendMail({
                from: `"EXODUS CLOTHING" <${YOUR_EMAIL}>`,
                to: order.customer_email,
                subject: `✅ EXODUS - Your Order #${orderId} Has Been Delivered`,
                html: getDeliveredTemplate(orderId, order)
            });
            console.log(`📧 Delivery confirmation email sent to ${order.customer_email}`);
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

// ========== HERO IMAGE API ==========
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

// ========== BEAUTIFUL EMAIL TEMPLATES ==========

function getVerificationEmailTemplate(code) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>EXODUS Login Code</title></head>
<body style="margin:0; padding:0; font-family: 'Georgia', 'Times New Roman', serif; background-color:#f5f5f5;">
    <div style="max-width:500px; margin:0 auto; background-color:#ffffff;">
        <div style="background-color:#000000; padding:40px 20px; text-align:center;">
            <h1 style="color:#ffffff; font-size:32px; letter-spacing:4px; margin:0;">EXODUS</h1>
            <p style="color:#888888; margin:10px 0 0; font-size:12px;">CLOTHING</p>
        </div>
        <div style="padding:40px 30px;">
            <h2 style="color:#000000; font-size:22px; margin-bottom:20px;">Your Login Code</h2>
            <div style="background-color:#f5f5f5; padding:25px; text-align:center; border-left:3px solid #000000;">
                <div style="font-size:36px; font-weight:bold; letter-spacing:8px; color:#000000;">${code}</div>
            </div>
            <p style="color:#666666; margin-top:25px; font-size:14px;">This code expires in <strong>5 minutes</strong>.</p>
            <p style="color:#666666; font-size:14px;">If you didn't request this, please ignore this email.</p>
        </div>
        <div style="background-color:#000000; padding:30px; text-align:center;">
            <p style="color:#888888; margin:0; font-size:11px;">EXODUS CLOTHING — ETHIOPIAN STREETWEAR</p>
        </div>
    </div>
</body>
</html>
    `;
}

function getOrderConfirmationTemplate(orderId, customer, items, total) {
    const itemsHtml = items.map(item => `
        <tr style="border-bottom:1px solid #eeeeee;">
            <td style="padding:12px 0;">
                <strong>${item.name}</strong><br>
                <span style="color:#888; font-size:12px;">Size: ${item.size} × ${item.quantity}</span>
            </td>
            <td style="padding:12px 0; text-align:right;">${(item.price * item.quantity).toLocaleString()} ETB</td>
        </tr>
    `).join('');
    
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>EXODUS Order Confirmation</title></head>
<body style="margin:0; padding:0; font-family: 'Georgia', 'Times New Roman', serif; background-color:#f5f5f5;">
    <div style="max-width:600px; margin:0 auto; background-color:#ffffff;">
        <div style="background-color:#000000; padding:40px 20px; text-align:center;">
            <h1 style="color:#ffffff; font-size:36px; letter-spacing:4px; margin:0;">EXODUS</h1>
            <p style="color:#888888; margin:10px 0 0; font-size:12px; letter-spacing:2px;">CLOTHING</p>
        </div>
        <div style="padding:40px 30px;">
            <h2 style="color:#000000; font-size:24px; margin-bottom:20px;">Thank You for Your Order</h2>
            <p style="color:#333333; line-height:1.6; margin-bottom:30px;">Your order has been received and will be processed within 24 hours.</p>
            
            <div style="background-color:#f8f8f8; padding:20px; margin-bottom:30px; border-left:3px solid #000000;">
                <p style="margin:0 0 5px;"><strong style="color:#000000;">Order ID:</strong> <span style="color:#666;">${orderId}</span></p>
                <p style="margin:0;"><strong style="color:#000000;">Total:</strong> <span style="color:#666;">${total.toLocaleString()} ETB</span></p>
            </div>
            
            <h3 style="color:#000000; font-size:18px; margin-bottom:15px;">Items Ordered</h3>
            <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
                ${itemsHtml}
                <tr>
                    <td style="padding:15px 0; border-top:2px solid #000000; text-align:right;"><strong>Total</strong></td>
                    <td style="padding:15px 0; border-top:2px solid #000000; text-align:right;"><strong>${total.toLocaleString()} ETB</strong></td>
                </tr>
            </table>
            
            <div style="background-color:#f8f8f8; padding:20px; margin-bottom:30px;">
                <p style="margin:0 0 5px;"><strong style="color:#000000;">Shipping Address:</strong></p>
                <p style="margin:0; color:#666; line-height:1.5;">${customer.address}</p>
            </div>
            
            <div style="border-top:1px solid #eeeeee; padding-top:30px;">
                <p style="color:#000000; font-weight:500; margin-bottom:10px;">📦 Delivery Information</p>
                <p style="color:#666; font-size:14px; margin-bottom:5px;">• Cash on delivery only</p>
                <p style="color:#666; font-size:14px; margin-bottom:5px;">• We'll contact you within 24 hours</p>
                <p style="color:#666; font-size:14px;">• Delivery person will take a photo as proof</p>
            </div>
        </div>
        <div style="background-color:#000000; padding:30px; text-align:center;">
            <p style="color:#888888; margin:0 0 10px; font-size:12px;">📞 ${YOUR_PHONE} | ✉️ ${YOUR_EMAIL}</p>
            <p style="color:#444444; margin:0; font-size:10px; letter-spacing:1px;">EXODUS CLOTHING — ETHIOPIAN STREETWEAR</p>
        </div>
    </div>
</body>
</html>
    `;
}

function getOwnerNotificationTemplate(orderId, customer, items, total) {
    const itemsHtml = items.map(item => `
        <tr><td style="padding:8px 0;">${item.name} (${item.size}) x${item.quantity}</td><td style="padding:8px 0; text-align:right;">${(item.price * item.quantity).toLocaleString()} ETB</td></tr>
    `).join('');
    
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>New EXODUS Order</title></head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f5f5f5;">
    <div style="max-width:600px; margin:0 auto; background-color:#ffffff;">
        <div style="background-color:#000000; padding:30px; text-align:center;">
            <h1 style="color:#ffffff; margin:0;">NEW ORDER</h1>
        </div>
        <div style="padding:30px;">
            <div style="background-color:#f0f0f0; padding:15px; margin-bottom:20px;">
                <p><strong>Order ID:</strong> ${orderId}</p>
                <p><strong>Total:</strong> ${total.toLocaleString()} ETB</p>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${customer.name}</p>
            <p><strong>Phone:</strong> ${customer.phone}</p>
            <p><strong>Email:</strong> ${customer.email}</p>
            <p><strong>Address:</strong> ${customer.address}</p>
            <h3>Items Ordered</h3>
            <table style="width:100%; border-collapse:collapse;">${itemsHtml}</table>
            <div style="margin-top:30px; padding:15px; background-color:#f9f9f9;">
                <p><strong>📋 Action Required:</strong></p>
                <p>1. Prepare the order</p>
                <p>2. Contact customer for delivery</p>
                <p>3. Mark as "Out for Delivery" in admin dashboard</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

function getOutForDeliveryTemplate(orderId, order) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>EXODUS - Out for Delivery</title></head>
<body style="margin:0; padding:0; font-family: 'Georgia', serif; background-color:#f5f5f5;">
    <div style="max-width:600px; margin:0 auto; background-color:#ffffff;">
        <div style="background-color:#000000; padding:30px; text-align:center;">
            <h1 style="color:#ffffff; font-size:28px; margin:0;">OUT FOR DELIVERY</h1>
        </div>
        <div style="padding:30px;">
            <h2 style="color:#000000; font-size:22px; margin-bottom:20px;">Your Order is on the Way!</h2>
            <div style="background-color:#f8f8f8; padding:20px; margin-bottom:25px;">
                <p style="margin:0 0 5px;"><strong>Order ID:</strong> ${orderId}</p>
                <p style="margin:0;"><strong>Total to pay:</strong> ${order.total.toLocaleString()} ETB (Cash on delivery)</p>
            </div>
            <div style="margin-bottom:25px;">
                <p style="font-weight:500; margin-bottom:10px;">🚚 What to Expect:</p>
                <p style="color:#555; margin-bottom:5px;">• Delivery person will call before arriving</p>
                <p style="color:#555; margin-bottom:5px;">• Please have cash ready</p>
                <p style="color:#555;">• Delivery person will take a photo as proof of delivery</p>
            </div>
            <div style="border-top:1px solid #eee; padding-top:20px;">
                <p style="color:#888; font-size:12px;">Questions? Call us: ${YOUR_PHONE}</p>
            </div>
        </div>
        <div style="background-color:#000000; padding:20px; text-align:center;">
            <p style="color:#888; margin:0; font-size:11px;">EXODUS CLOTHING — MADE IN ETHIOPIA</p>
        </div>
    </div>
</body>
</html>
    `;
}

function getDeliveredTemplate(orderId, order) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>EXODUS - Order Delivered</title></head>
<body style="margin:0; padding:0; font-family: 'Georgia', serif; background-color:#f5f5f5;">
    <div style="max-width:600px; margin:0 auto; background-color:#ffffff;">
        <div style="background-color:#000000; padding:30px; text-align:center;">
            <h1 style="color:#ffffff; font-size:28px; margin:0;">ORDER DELIVERED</h1>
        </div>
        <div style="padding:30px; text-align:center;">
            <div style="font-size:60px; margin-bottom:20px;">✅</div>
            <h2 style="color:#000000; margin-bottom:15px;">Thank You for Shopping with EXODUS!</h2>
            <p style="color:#555; line-height:1.6; margin-bottom:25px;">Your order #${orderId} has been successfully delivered.</p>
            <div style="background-color:#f8f8f8; padding:20px; margin-bottom:25px;">
                <p style="margin-bottom:10px;">✨ <strong>We'd Love to See Your Style</strong></p>
                <p style="color:#555;">Tag us on Instagram: <strong>@exodus_stw</strong></p>
                <p style="color:#555;">Use #ExodusClothing</p>
            </div>
            <div style="border-top:1px solid #eee; padding-top:20px;">
                <p style="color:#888; font-size:12px;">Thank you for supporting Ethiopian streetwear 🇪🇹</p>
            </div>
        </div>
        <div style="background-color:#000000; padding:20px; text-align:center;">
            <p style="color:#888; margin:0; font-size:11px;">EXODUS CLOTHING — exodusclothingeth@gmail.com</p>
        </div>
    </div>
</body>
</html>
    `;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     🖤 EXODUS CLOTHING - COMPLETE STORE RUNNING              ║
║     URL: http://localhost:${PORT}                              ║
║     Email: ${YOUR_EMAIL}                                      ║
║     Email Status: ${transporter ? '✅ READY' : '⚠️ NOT CONFIGURED'}
║                                                              ║
║     ✅ Beautiful email templates active                      ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});