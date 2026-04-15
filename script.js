// EXODUS CLOTHING - Store Frontend

// Products Data
const products = [
  { id: 1, name: "EXODUS OVERSIZED HOODIE", price: 89, image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=500&fit=crop" },
  { id: 2, name: "REBEL CARGO PANTS", price: 79, image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop" },
  { id: 3, name: "EXODUS TEAR-AWAY SHIRT", price: 59, image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop" },
  { id: 4, name: "STRIKE BOMBER JACKET", price: 149, image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop" },
  { id: 5, name: "CHAIN LINK ACCESSORY", price: 39, image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=500&fit=crop" },
  { id: 6, name: "EXODUS SNAPBACK", price: 45, image: "https://images.unsplash.com/photo-1588850571410-5d7a68daeaef?w=400&h=500&fit=crop" }
];

let cart = [];
let stripe = null;
let elements = null;

// Load Stripe (you'll get your publishable key from Stripe dashboard)
const STRIPE_PUBLISHABLE_KEY = "pk_test_YOUR_KEY_HERE"; // Replace after creating Stripe account

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  loadCart();
  setupEventListeners();
  
  // Initialize Stripe
  if (STRIPE_PUBLISHABLE_KEY !== "pk_test_YOUR_KEY_HERE") {
    stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
  }
});

function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  
  grid.innerHTML = products.map(product => `
    <div class="product-card">
      <div class="product-img">
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div class="product-title">${product.name}</div>
      <div class="product-price">$${product.price}</div>
      <button class="btn-outline" style="margin-top:12px; padding:8px 20px;" onclick="addToCart(${product.id})">Add to Cart</button>
    </div>
  `).join('');
}

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  const existing = cart.find(item => item.id === productId);
  
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  
  saveCart();
  updateCartUI();
  showToast(`${product.name} added to cart`);
}

function updateCartUI() {
  const container = document.getElementById('cartItemsContainer');
  const footer = document.getElementById('cartFooter');
  const totalSpan = document.getElementById('cartTotalPrice');
  const cartCount = document.getElementById('cartCount');
  
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCount) cartCount.textContent = itemCount;
  
  if (cart.length === 0) {
    if (container) container.innerHTML = '<div class="empty-cart-msg">Your cart is empty.</div>';
    if (footer) footer.style.display = 'none';
    return;
  }
  
  if (footer) footer.style.display = 'block';
  
  let total = 0;
  const itemsHtml = cart.map(item => {
    total += item.price * item.quantity;
    return `
      <div class="cart-item">
        <div style="flex:1">
          <div style="font-weight:600">${item.name}</div>
          <div>$${item.price} x ${item.quantity}</div>
          <div style="margin-top:8px">
            <button onclick="updateQuantity(${item.id}, -1)">-</button>
            <button onclick="updateQuantity(${item.id}, 1)">+</button>
            <button onclick="removeFromCart(${item.id})">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  if (container) container.innerHTML = itemsHtml;
  if (totalSpan) totalSpan.textContent = `$${total.toFixed(2)}`;
}

function updateQuantity(id, delta) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.id !== id);
    }
    saveCart();
    updateCartUI();
  }
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartUI();
  showToast("Item removed");
}

function saveCart() {
  localStorage.setItem('exodus_cart', JSON.stringify(cart));
}

function loadCart() {
  const saved = localStorage.getItem('exodus_cart');
  if (saved) {
    cart = JSON.parse(saved);
    updateCartUI();
  }
}

function showToast(msg) {
  const toast = document.getElementById('toastMsg');
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => toast.style.opacity = '0', 2000);
}

function setupEventListeners() {
  const cartIcon = document.getElementById('cartIcon');
  const closeCart = document.getElementById('closeCartBtn');
  const overlay = document.getElementById('cartOverlay');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const modal = document.getElementById('checkoutModal');
  const closeModal = document.querySelector('.close-modal');
  
  if (cartIcon) cartIcon.addEventListener('click', () => openCart());
  if (closeCart) closeCart.addEventListener('click', () => closeCartSidebar());
  if (overlay) overlay.addEventListener('click', () => closeCartSidebar());
  if (checkoutBtn) checkoutBtn.addEventListener('click', () => openCheckoutModal());
  if (closeModal) closeModal.addEventListener('click', () => closeModalFn());
  
  const form = document.getElementById('checkoutForm');
  if (form) form.addEventListener('submit', handleCheckout);
}

function openCart() {
  document.getElementById('cartSidebar').style.right = '0px';
  document.getElementById('cartOverlay').style.visibility = 'visible';
  document.getElementById('cartOverlay').style.opacity = '1';
}

function closeCartSidebar() {
  document.getElementById('cartSidebar').style.right = '-420px';
  document.getElementById('cartOverlay').style.visibility = 'hidden';
  document.getElementById('cartOverlay').style.opacity = '0';
}

function openCheckoutModal() {
  if (cart.length === 0) {
    showToast("Your cart is empty");
    return;
  }
  document.getElementById('checkoutModal').style.display = 'flex';
}

function closeModalFn() {
  document.getElementById('checkoutModal').style.display = 'none';
}

async function handleCheckout(e) {
  e.preventDefault();
  
  const customer = {
    name: document.getElementById('customerName').value,
    email: document.getElementById('customerEmail').value,
    address: document.getElementById('customerAddress').value,
    city: document.getElementById('customerCity').value,
    zip: document.getElementById('customerZip').value
  };
  
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  try {
    const response = await fetch('http://localhost:3000/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart, total })
    });
    
    const data = await response.json();
    
    const result = await stripe.confirmCardPayment(data.clientSecret, {
      payment_method: {
        card: elements.getElement('card'),
        billing_details: { name: customer.name, email: customer.email }
      }
    });
    
    if (result.error) {
      document.getElementById('payment-error').textContent = result.error.message;
    } else if (result.paymentIntent.status === 'succeeded') {
      // Save order to backend
      await fetch('http://localhost:3000/api/save-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer, items: cart, total, paymentIntentId: result.paymentIntent.id })
      });
      
      alert(`✅ Order confirmed! Check your email for confirmation.`);
      cart = [];
      saveCart();
      updateCartUI();
      closeModalFn();
      closeCartSidebar();
    }
  } catch (error) {
    document.getElementById('payment-error').textContent = "Payment failed. Try again.";
  }
}

// Add to global scope for onclick handlers
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;