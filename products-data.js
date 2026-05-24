// EXODUS CLOTHING - Product Database
// This file automatically saves your products from the Product Manager

let productDatabase = [];

// Load saved products from localStorage
function loadProductDatabase() {
    const saved = localStorage.getItem('exodus_products');
    if (saved) {
        productDatabase = JSON.parse(saved);
    } else {
        // Default products to get you started
        productDatabase = [
            { 
                id: 1, 
                name: "EXODUS OVERSIZED HOODIE", 
                price: 2499, 
                sizes: ["S", "M", "L", "XL", "XXL"],
                stock: { S: 5, M: 8, L: 6, XL: 4, XXL: 2 },
                image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=500&fit=crop"
            },
            { 
                id: 2, 
                name: "REBEL CARGO PANTS", 
                price: 1899, 
                sizes: ["S", "M", "L", "XL"],
                stock: { S: 3, M: 7, L: 5, XL: 2 },
                image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop"
            },
            { 
                id: 3, 
                name: "EXODUS TEAR-AWAY SHIRT", 
                price: 1299, 
                sizes: ["S", "M", "L", "XL"],
                stock: { S: 10, M: 12, L: 8, XL: 5 },
                image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop"
            },
            { 
                id: 4, 
                name: "STRIKE BOMBER JACKET", 
                price: 3499, 
                sizes: ["M", "L", "XL"],
                stock: { M: 4, L: 6, XL: 3 },
                image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop"
            },
            { 
                id: 5, 
                name: "CHAIN LINK ACCESSORY", 
                price: 599, 
                sizes: ["One Size"],
                stock: { "One Size": 15 },
                image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=500&fit=crop"
            },
            { 
                id: 6, 
                name: "EXODUS SNAPBACK", 
                price: 799, 
                sizes: ["One Size"],
                stock: { "One Size": 20 },
                image: "https://images.unsplash.com/photo-1588850571410-5d7a68daeaef?w=400&h=500&fit=crop"
            }
        ];
        saveProductDatabase();
    }
}

function saveProductDatabase() {
    localStorage.setItem('exodus_products', JSON.stringify(productDatabase));
}

function getProducts() {
    return productDatabase;
}

function addProduct(product) {
    const newId = productDatabase.length > 0 ? Math.max(...productDatabase.map(p => p.id)) + 1 : 1;
    productDatabase.push({ ...product, id: newId });
    saveProductDatabase();
}

function updateProduct(id, updatedProduct) {
    const index = productDatabase.findIndex(p => p.id === id);
    if (index !== -1) {
        productDatabase[index] = { ...updatedProduct, id: id };
        saveProductDatabase();
    }
}

function deleteProduct(id) {
    productDatabase = productDatabase.filter(p => p.id !== id);
    saveProductDatabase();
}

// Load on page load
loadProductDatabase();