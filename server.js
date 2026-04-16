require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET all products
app.get('/api/products', async (req, res) => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ADD a product
app.post('/api/products', async (req, res) => {
    console.log('Received product:', req.body);
    
    const { name, price, image, images, sizes, stock, category } = req.body;
    
    const { data, error } = await supabase
        .from('products')
        .insert([{ 
            name, 
            price, 
            image: image || (images && images[0]) || '',
            images: images || [],
            sizes: sizes || ['S','M','L','XL'],
            stock: stock || {},
            category: category || 'uncategorized'
        }])
        .select();
    
    if (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true, product: data[0] });
});

// UPDATE a product
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price, image, images, sizes, stock, category } = req.body;
    
    const { data, error } = await supabase
        .from('products')
        .update({ name, price, image, images, sizes, stock, category })
        .eq('id', id)
        .select();
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, product: data[0] });
});

// DELETE a product
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// GET orders
app.get('/api/orders', async (req, res) => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// CREATE order
app.post('/api/orders', async (req, res) => {
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
        status: 'pending',
        delivery_status: 'pending'
    }]);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, orderId });
});

// UPDATE order status
app.put('/api/orders/:orderId/status', async (req, res) => {
    const { orderId } = req.params;
    const { delivery_status } = req.body;
    
    const { error } = await supabase.from('orders').update({ delivery_status }).eq('order_id', orderId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// HERO IMAGE
app.get('/api/hero-image', async (req, res) => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'hero_image').single();
    res.json({ url: data?.value || null });
});

app.post('/api/hero-image', async (req, res) => {
    const { url } = req.body;
    await supabase.from('settings').upsert({ key: 'hero_image', value: url }, { onConflict: 'key' });
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
