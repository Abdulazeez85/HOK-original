'use strict';

// ── CONFIG ────────────────────────────────────────────────
const API = '';  // empty = same origin
const WA_NUM = '2348114550145'; // updated dynamically from settings

// ── UTILS ─────────────────────────────────────────────────
const fmt = n => '₦' + parseInt(n).toLocaleString('en-NG');
const waLink = (text, num) => `https://wa.me/${num || WA_NUM}?text=${encodeURIComponent(text)}`;
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

let settings = {};
let cart = JSON.parse(localStorage.getItem('hok_cart') || '[]');
let paystackPublicKey = '';
let paystackOrderInfo = null;

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    settings = await res.json();
  } catch { settings = { whatsappNumber: WA_NUM, delivery: { local: 'Ilorin — Same Day', state: 'Other Kwara — Next Day', national: 'Outside Kwara — 2-3 Days' } }; }
}

async function loadPaystackConfig() {
  try {
    const res = await fetch('/api/paystack/config');
    const data = await res.json();
    if (res.ok && data.publicKey) paystackPublicKey = data.publicKey;
  } catch (err) {
    console.error('Unable to load Paystack config:', err);
  }
}

function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve(window.PaystackPop);
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(window.PaystackPop);
    script.onerror = () => reject(new Error('Unable to load Paystack script'));
    document.head.appendChild(script);
  });
}

function openPaystackModal(orderInfo) {
  paystackOrderInfo = orderInfo;
  const bx = document.getElementById('paystackModal');
  const overlay = document.getElementById('paystackOverlay');
  if (!bx || !overlay) return;
  document.getElementById('checkoutSummary').textContent = orderInfo.summary;
  document.getElementById('checkoutTotal').textContent = orderInfo.total;
  document.getElementById('checkoutEmail').value = orderInfo.email || '';
  bx.classList.add('open');
  overlay.classList.add('open');
}

function closePaystackModal() {
  const bx = document.getElementById('paystackModal');
  const overlay = document.getElementById('paystackOverlay');
  if (!bx || !overlay) return;
  bx.classList.remove('open');
  overlay.classList.remove('open');
  paystackOrderInfo = null;
}

async function submitPaystackCheckout() {
  if (!paystackOrderInfo) return;
  const emailInput = document.getElementById('checkoutEmail');
  const email = emailInput?.value.trim();
  if (!email || !email.includes('@')) {
    showToast('Enter a valid email for your payment receipt.');
    return;
  }
  const order = paystackOrderInfo;
  closePaystackModal();
  try {
    const init = await createPaystackOrder({
      productId: order.productId,
      productName: order.productName,
      amount: order.amount,
      email,
      orderType: order.orderType,
      items: order.items,
      metadata: { customerName: order.customerName || '', customerPhone: order.customerPhone || '' }
    });
    if (!init.authorization_url) {
      showToast(init.error || 'Unable to start Paystack payment.');
      return;
    }
    await loadPaystackScript();
    if (!paystackPublicKey || !window.PaystackPop) {
      window.location.href = init.authorization_url;
      return;
    }
    window.PaystackPop.setup({
      key: paystackPublicKey,
      email,
      amount: Math.round(Number(order.amount) * 100),
      currency: 'NGN',
      ref: init.reference,
      metadata: init.metadata || {},
      callback: function(response) {
        window.location.href = `${window.location.origin}/payment-success.html?reference=${encodeURIComponent(response.reference)}`;
      },
      onClose: function() {
        showToast('Payment window closed. You can try again when ready.');
      }
    }).openIframe();
  } catch (err) {
    console.error('Paystack checkout error:', err);
    showToast('Unable to launch Paystack. Please try again.');
  }
}

async function createPaystackOrder(payload) {
  const res = await fetch('/api/paystack/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── THEME ─────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('hok_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('hok_theme', next);
  updateThemeIcon(next);
}
function updateThemeIcon(t) {
  const el = document.querySelector('.theme-icon');
  if (el) el.textContent = t === 'dark' ? '☀️' : '🌙';
}

// ── NAVBAR ────────────────────────────────────────────────
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  window.addEventListener('scroll', () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 10);
  });
  if (hamburger) hamburger.addEventListener('click', () => navLinks.classList.toggle('mobile-open'));
  if (navLinks) navLinks.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => navLinks.classList.remove('mobile-open')));
}

// ── SCROLL REVEAL ─────────────────────────────────────────
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ── CART ──────────────────────────────────────────────────
function saveCart() { localStorage.setItem('hok_cart', JSON.stringify(cart)); }

function addToCart(id, name, price, image) {
  const ex = cart.find(x => x.id === id);
  if (ex) ex.qty += 1;
  else cart.push({ id, name, price, image, qty: 1 });
  saveCart(); updateCartUI();
  showToast(`Added: ${name}`);
  bumpCount();
}

function removeFromCart(id) {
  cart = cart.filter(x => x.id !== id);
  saveCart(); updateCartUI(); renderCartItems();
}

function updateQty(id, delta) {
  const item = cart.find(x => x.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart(); updateCartUI(); renderCartItems();
}

function calcTotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }

function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  ['cartCount', 'cartCount2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  });
  const chc = document.getElementById('cartHeaderCount');
  if (chc) chc.textContent = count > 0 ? `(${count})` : '';
  const ct = document.getElementById('cartTotal');
  if (ct) ct.textContent = fmt(calcTotal());
  const cf = document.getElementById('cartFooter');
  if (cf) cf.style.display = cart.length > 0 ? 'flex' : 'none';
  const ce = document.getElementById('cartEmpty');
  if (ce) ce.style.display = cart.length === 0 ? 'block' : 'none';
}

function bumpCount() {
  const el = document.getElementById('cartCount');
  if (!el) return;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 300);
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty" id="cartEmpty"><span>🛒</span><p>Your cart is empty</p><a href="/products">Browse Products</a></div>`;
    return;
  }
  container.innerHTML = `<div id="cartEmpty" style="display:none"></div>` + cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.image}" alt="${item.name}" />
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${fmt(item.price)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="updateQty('${item.id}',-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty('${item.id}',1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">✕</button>
    </div>`).join('');
}

function openCartDrawer() {
  renderCartItems(); updateCartUI();
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCartDrawer() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── CHECKOUT ──────────────────────────────────────────────
function checkoutWhatsApp() {
  if (!cart.length) return;
  const lines = cart.map(i => `• ${i.name} x${i.qty} = ${fmt(i.price * i.qty)}`).join('\n');
  const msg = `Hello HOK Computers, I want to purchase:\n\n${lines}\n\n*Total: ${fmt(calcTotal())}*\n\nPlease confirm availability.`;
  window.open(waLink(msg, settings.whatsappNumber), '_blank');
}

async function checkoutPaystackCart() {
  if (!cart.length) return;
  const summary = cart.map(i => `• ${i.name} x${i.qty} = ${fmt(i.price * i.qty)}`).join('\n');
  openPaystackModal({
    orderType: 'cart',
    summary: `${summary}\n\nTotal: ${fmt(calcTotal())}`,
    total: fmt(calcTotal()),
    amount: calcTotal(),
    items: cart.map(i => ({ productId: i.id, productName: i.name, quantity: i.qty, price: i.price })),
    productId: null,
    productName: 'Cart Order',
    email: ''
  });
}

async function payWithPaystack(productId, productName, amount, e) {
  if (e) e.stopPropagation();
  openPaystackModal({
    orderType: 'single',
    summary: `${productName} — ${fmt(amount)}`,
    total: fmt(amount),
    amount,
    items: [{ productId, productName, quantity: 1, price: amount }],
    productId,
    productName,
    email: ''
  });
}
    showToast('Unable to start payment. Try again.');
    console.error('Paystack init error:', err);
  


async function recordEnquiry(productId, productName) {
  try {
    await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, productName }) });
  } catch (e) {
    // ignore logging failures
  }
}

async function recordVisit(path, page) {
  try {
    await fetch('/api/visitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, page, referrer: document.referrer, userAgent: navigator.userAgent })
    });
  } catch (e) {
    // ignore logging failures
  }
}

function buyNowWA(id, name, price, e) {
  if (e) e.stopPropagation();
  // non-blocking record of the enquiry for admin insights
  recordEnquiry(id, name).catch(() => {});
  const msg = `Hello HOK Computers, I want to buy: *${name}* at *${fmt(price)}*. Please confirm availability.`;
  window.open(waLink(msg, settings.whatsappNumber), '_blank');
}

async function submitProductRequest(button, openWhatsApp = false) {
  const productId = button.dataset.requestProductId || null;
  const productName = button.dataset.requestProductName || 'Product request';
  const name = document.getElementById('requestName')?.value.trim();
  const phone = document.getElementById('requestPhone')?.value.trim();
  const message = document.getElementById('requestMessage')?.value.trim();
  if (!message) { showToast('Please enter what you are looking for.'); return; }
  const requestMessage = `Customer request:\n\n${message}\n\nProduct reference: ${productName}${productId ? ` (${productId})` : ''}\nName: ${name || 'Not provided'}\nPhone: ${phone || 'Not provided'}`;
  try {
    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, productName, requestMessage, phone })
    });
  } catch (err) {
    console.error('Request submit error:', err);
  }
  if (openWhatsApp) {
    const waMsg = `Hello HOK Computers, I am looking for: ${message}\n\nProduct reference: ${productName}${productId ? ` (${productId})` : ''}\nName: ${name || 'Not provided'}\nPhone: ${phone || 'Not provided'}`;
    window.open(waLink(waMsg, settings.whatsappNumber), '_blank');
  } else {
    showToast('Request submitted. We will contact you on WhatsApp soon.');
  }
}

// Delegate clicks on any anchor with data-enquire-product-id to record the enquiry
document.addEventListener('DOMContentLoaded', () => {
  const pagePath = window.location.pathname;
  const pageTitle = document.title || pagePath;
  recordVisit(pagePath, pageTitle).catch(() => {});

  document.querySelectorAll('a[data-enquire-product-id]').forEach(el => {
    el.addEventListener('click', function (ev) {
      const id = this.dataset.enquireProductId;
      const name = this.dataset.enquireProductName || this.dataset.enquireProduct;
      if (id && name) {
        // allow the fetch to run but don't block navigation
        recordEnquiry(id, name).catch(() => {});
      }
    });
  });
});

// ── PRODUCT MODAL ─────────────────────────────────────────
function openProductModal(p) {
  const del = settings.delivery || {};
  const specsHtml = Object.entries(p.specs || {})
    .filter(([, v]) => v && v !== 'N/A')
    .map(([k, v]) => `<div class="modal-spec-row"><span>${k.charAt(0).toUpperCase() + k.slice(1)}</span><span>${v}</span></div>`).join('');

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-img"><img src="${p.image}" alt="${p.name}" /></div>
    <div class="modal-info">
      <div class="modal-brand">${p.brand}</div>
      <div class="modal-name">${p.name}</div>
      <div class="modal-price">${fmt(p.price)}</div>
      <div class="modal-warranty">✅ ${p.warranty || '6 Months'} Warranty</div>
      <span class="p-stock ${stockClass(p.stock)}" style="display:inline-block">${p.stock}</span>
      <div class="modal-specs">${specsHtml}</div>
      <div style="font-size:0.75rem;color:var(--text-3);line-height:1.6">
        🚚 ${del.local || ''} · ${del.state || ''} · ${del.national || ''}
      </div>
      <div class="modal-actions">
        <button class="btn-primary" style="justify-content:center;border:none;cursor:pointer;width:100%"
          onclick="addToCart('${p.id}','${p.name}',${p.price},'${p.image}');closeProductModal()">
          + Add to Cart
        </button>
        <button class="btn-wa" style="justify-content:center;width:100%"
          onclick="buyNowWA('${p.id}','${p.name}',${p.price})">
          Buy via WhatsApp
        </button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeProductModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('productModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── NOTIFY MODAL ──────────────────────────────────────────
let _notifyProductId = '', _notifyProductName = '';
function openNotifyModal(id, name) {
  _notifyProductId = id; _notifyProductName = name;
  const h = document.getElementById('notifyModal');
  const o = document.getElementById('notifyOverlay');
  if (h) { h.classList.add('open'); o.classList.add('open'); }
}
function closeNotifyModal() {
  document.getElementById('notifyModal')?.classList.remove('open');
  document.getElementById('notifyOverlay')?.classList.remove('open');
}
async function submitNotify() {
  const phone = document.getElementById('notifyPhone').value.trim();
  if (!phone) { showToast('Please enter your phone number.'); return; }
  try {
    await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: _notifyProductId, productName: _notifyProductName, phone }) });
    showToast('✅ We\'ll notify you when back in stock!');
    closeNotifyModal();
  } catch { showToast('Something went wrong. Try again.'); }
}

// ── REPAIR FORM ───────────────────────────────────────────
async function submitRepair() {
  const name = document.getElementById('repairName')?.value.trim();
  const phone = document.getElementById('repairPhone')?.value.trim();
  const device = document.getElementById('repairDevice')?.value;
  const problem = document.getElementById('repairProblem')?.value.trim();
  const imageInput = document.getElementById('repairImage');
  if (!name || !phone || !device || !problem) { showToast('Please fill in all fields.'); return; }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('phone', phone);
  formData.append('device', device);
  formData.append('problem', problem);
  if (imageInput?.files?.[0]) {
    formData.append('image', imageInput.files[0]);
  }

  try {
    const waWindow = window.open('about:blank', '_blank');
    const res = await fetch('/api/repair-requests', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      if (waWindow) waWindow.close();
      showToast(data.error || 'Could not submit repair request.', 'error');
      return;
    }
    const imagePart = data.imageUrl ? `\n*Image:* ${data.imageUrl}` : '';
    const msg = `Hello HOK Computers, repair request:\n\n*Name:* ${name}\n*Phone:* ${phone}\n*Device:* ${device}\n*Problem:* ${problem}${imagePart}`;
    if (waWindow) {
      waWindow.location = waLink(msg, settings.whatsappNumber);
    } else {
      window.open(waLink(msg, settings.whatsappNumber), '_blank');
    }
    ['repairName', 'repairPhone', 'repairProblem'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (document.getElementById('repairDevice')) document.getElementById('repairDevice').value = '';
    if (imageInput) imageInput.value = '';
    showToast('Repair request sent!');
  } catch (err) {
    console.error('Repair request error:', err);
    showToast('Something went wrong. Try again.', 'error');
  }
}

// ── HELPERS ───────────────────────────────────────────────
function stockClass(s) {
  return { 'In Stock': 's-in', 'Limited Stock': 's-ltd', 'Out of Stock': 's-out' }[s] || 's-in';
}
function badgeClass(b) { return { hot: 'b-hot', new: 'b-new', used: 'b-used' }[b] || 'b-new'; }
function badgeLabel(b) { return { hot: '🔥 Hot', new: 'New', used: 'UK Used' }[b] || b; }

// ── BUILD PRODUCT CARD ────────────────────────────────────
function buildCard(p, i = 0) {
  const del = settings.delivery || {};
  const isOut = p.stock === 'Out of Stock';
  const specsText = [p.specs?.cpu, p.specs?.ram, p.specs?.storage].filter(v => v && v !== 'N/A').join(' · ');
  const mainImage = p.images?.length ? p.images[0] : p.image;

  return `
    <div class="product-card reveal" style="transition-delay:${i * 0.04}s" onclick="window.location.href='/product/${p.id}'">
      <div class="p-img-wrap">
        <img src="${mainImage}" alt="${p.name}" loading="lazy" />
        ${p.badge ? `<span class="p-badge ${badgeClass(p.badge)}">${badgeLabel(p.badge)}</span>` : ''}
        <span class="p-stock ${stockClass(p.stock)}">${p.stock}</span>
      </div>
      <div class="p-warranty">✅ ${p.warranty || '6 Months'} Warranty Included</div>
      <div class="p-info">
        <div class="p-brand">${p.brand}</div>
        <div class="p-name">${p.name}</div>
        <div class="p-specs">${specsText}</div>
        <div class="p-delivery">🚚 ${del.local || 'Ilorin — Same Day'}</div>
        <div class="p-footer">
          <div class="p-price">${fmt(p.price)}</div>
          <div class="p-actions">
            <button class="btn-cart" onclick="addToCart('${p.id}','${p.name}',${p.price},'${p.image}');event.stopPropagation()" ${isOut ? 'disabled' : ''}>+ Cart</button>
            <button class="btn-primary" onclick="payWithPaystack('${p.id}','${p.name}',${p.price},event)" ${isOut ? 'disabled' : ''}>Pay Now</button>
            <button class="btn-wa-icon" onclick="buyNowWA('${p.id}','${p.name}',${p.price},event)" title="Buy via WhatsApp">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.054 23.447a.5.5 0 00.61.61l5.595-1.478A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.802 9.802 0 01-5.031-1.385l-.36-.214-3.733.985.997-3.617-.235-.372A9.808 9.808 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
            </button>
          </div>
        </div>
      </div>
      ${isOut ? `<button class="notify-btn" onclick="openNotifyModal('${p.id}','${p.name}');event.stopPropagation()">🔔 Notify me when back in stock</button>` : ''}
    </div>`;
}

// Store products in memory for modal
let _allProducts = [];
function handleCardClick(e, id) {
  if (e.target.closest('button')) return;
  const p = _allProducts.find(x => x.id === id);
  if (p) openProductModal(p);
}

// ── SHARED NAV HTML ───────────────────────────────────────
function getNavHTML(active) {
  const links = [
    { href: '/', label: 'Home', key: 'home' },
    { href: '/products', label: 'Products', key: 'products' },
    { href: '/reviews', label: 'Reviews', key: 'reviews' },
    { href: '/about', label: 'About', key: 'about' },
  ];
  return `
    <nav class="navbar" id="navbar">
      <div class="nav-inner">
        <a href="/" class="nav-logo">
              <img src="https://res.cloudinary.com/da7jzmy2g/image/upload/v1780626286/hokp_lzhjha.jpg" alt="HOK logo" class="logo-img"/ width="32" height="32" border-radius="50%">

          
          <span class="logo-wordmark">HOK <em>Computers</em></span>
        </a>
        <ul class="nav-links" id="navLinks">
          ${links.map(l => `<li><a href="${l.href}" class="nav-link${active === l.key ? ' active' : ''}">${l.label}</a></li>`).join('')}
        </ul>
        <div class="nav-actions">
          <button class="theme-toggle" id="themeToggle" title="Toggle theme"><span class="theme-icon">☀️</span></button>
          <button class="cart-btn" id="cartToggle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            <span class="cart-count" id="cartCount">0</span>
          </button>
          <button class="hamburger" id="hamburger"><span></span><span></span><span></span></button>
        </div>
      </div>
    </nav>`;
}

function getCartDrawerHTML() {
  return `
    <div class="cart-overlay" id="cartOverlay"></div>
    <div class="cart-drawer" id="cartDrawer">
      <div class="cart-header"><h3>Cart <span id="cartHeaderCount"></span></h3><button class="close-btn" id="closeCart">✕</button></div>
      <div class="cart-items" id="cartItems">
        <div class="cart-empty" id="cartEmpty"><span>🛒</span><p>Your cart is empty</p><a href="/products">Browse Products</a></div>
      </div>
      <div class="cart-footer" id="cartFooter" style="display:none">
        <div class="cart-total"><span>Total</span><strong id="cartTotal">₦0</strong></div>
        <div class="cart-actions">
          <button class="btn-primary full" onclick="checkoutPaystackCart()">Pay with Card</button>
          <button class="btn-wa full" onclick="checkoutWhatsApp()">Checkout via WhatsApp</button>
        </div>
      </div>
    </div>`;
}

function getModalsHTML() {
  return `
    <div class="modal-overlay" id="modalOverlay"></div>
    <div class="product-modal" id="productModal">
      <button class="close-btn modal-close" id="closeModal">✕</button>
      <div class="modal-content" id="modalContent"></div>
    </div>
    <div class="modal-overlay" id="notifyOverlay"></div>
    <div class="notify-modal" id="notifyModal">
      <button class="close-btn" onclick="closeNotifyModal()" style="position:absolute;top:16px;right:16px">✕</button>
      <h3>🔔 Notify Me</h3>
      <p class="modal-sub">We'll WhatsApp you when this product is back in stock.</p>
      <div class="form-group"><label>WhatsApp Number</label><input type="tel" id="notifyPhone" placeholder="08012345678" /></div>
      <button class="btn-wa full" onclick="submitNotify()">Notify Me</button>
    </div>
    <div class="cart-overlay" id="paystackOverlay"></div>
    <div class="paystack-modal" id="paystackModal">
      <button class="close-btn" id="paystackClose">✕</button>
      <div class="paystack-modal-head">
        <div>
          <p class="eyebrow">Secure Checkout</p>
          <h3>Pay with Card</h3>
        </div>
        <div class="paystack-badge">Powered by Paystack</div>
      </div>
      <div class="checkout-details">
        <div class="checkout-summary" id="checkoutSummary"></div>
        <div class="checkout-total"><span>Total</span><strong id="checkoutTotal"></strong></div>
      </div>
      <div class="form-group">
        <label for="checkoutEmail">Email address</label>
        <input type="email" id="checkoutEmail" placeholder="you@example.com" />
      </div>
      <button class="btn-primary full" onclick="submitPaystackCheckout()">Proceed to Payment</button>
      <p class="checkout-note">You will be redirected to Paystack's secure checkout window to complete your payment.</p>
    </div>
    <div class="toast" id="toast"></div>`;
}

function getFooterHTML() {
  return `
    <footer class="footer">
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <div class="footer-logo">
          <img src="https://res.cloudinary.com/da7jzmy2g/image/upload/v1780626286/hokp_lzhjha.jpg" alt="HOK logo" class="logo-img" width="32" height="32" border-radius="50%">
          <span>HOK Computers</span>
        </div>
        <p>Home of Khayr — The Most Customer-friendly Gadget Store In Nigeria . Corporate Affairs Commission (CAC) Registered since August  2020.</p>
            <p class="footer-note">Some items may no longer be available  in store. It will be gotten ready for dispatch within 4-48 hours of payment.</p>
        <div class="socials">
          <a class="social-link social-facebook" href="https://web.facebook.com/homeofkhayr/?_rdc=1&_rdr#" aria-label="Facebook" target="_blank" rel="noreferrer noopener">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 10-11.5 9.9v-7H8.5v-2.9h2v-2.2c0-2 1.2-3.1 3-3.1.9 0 1.8.1 1.8.1v2h-1c-1 0-1.3.6-1.3 1.2v1.7h2.3l-.4 2.9h-1.9v7A10 10 0 0022 12z"/></svg>
          </a>
          <a class="social-link social-instagram" href="https://www.instagram.com/hokcomputers/" aria-label="Instagram" target="_blank" rel="noreferrer noopener">
               <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
           </svg>
           </a>
          <a class="social-link social-linkedin" href="https://ng.linkedin.com/company/home-of-khayr" aria-label="LinkedIn" target="_blank" rel="noreferrer noopener">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5A2.5 2.5 0 002.5 6v12a2.5 2.5 0 002.48 2.5h.02A2.5 2.5 0 007.5 18V6a2.5 2.5 0 00-2.52-2.5zM4.5 8.75h1.5V18H4.5V8.75zm4.5 0H10.5v1.35c.2-.35.8-.88 1.75-.88 1.85 0 2.25 1.22 2.25 2.8V18H13.5v-4.75c0-1.14-.02-2.6-1.6-2.6-1.6 0-1.85 1.26-1.85 2.54V18H9V8.75zM5.25 4.5h1.5v1.25h-1.5V4.5z"/></svg>
          </a>
          <a class="social-link social-whatsapp" href="https://wa.me/2348114550145" aria-label="WhatsApp" target="_blank" rel="noreferrer noopener">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A10.5 10.5 0 003.99 20.16L2 22l1.84-1.19A10.5 10.5 0 1020.5 3.5zm-8.1 15.2a8.7 8.7 0 01-4.66-1.36l-.33-.2-2.76.71.74-2.69-.21-.34A8.7 8.7 0 1112.4 18.7zm3.63-4.85c-.2-.1-1.15-.57-1.32-.64-.18-.08-.31-.12-.44.1-.13.22-.5.64-.61.77-.12.13-.24.14-.45.05-.2-.1-.84-.31-1.6-.99-.59-.52-.98-1.16-1.1-1.38-.12-.22-.01-.34.09-.45.09-.1.2-.23.3-.34.1-.12.14-.2.21-.34.08-.13.04-.24-.02-.34-.07-.1-.5-.98-.69-1.35-.18-.36-.35-.31-.48-.32-.13-.01-.28-.01-.43-.01-.15 0-.34.07-.52.33-.18.26-.7.89-.7 2.16 0 1.27.58 2.04.66 2.18.08.14 1.4 2.14 3.4 2.99.47.2.86.31 1.15.4.48.15.9.13 1.24.08.38-.06 1.15-.44 1.31-.94.15-.5.15-.93.11-1.02-.05-.09-.19-.15-.4-.26z"/></svg>
          </a>
        </div>
      </div>
      <div class="footer-cols">
        <div class="footer-col"><h5>Products</h5><a href="products.html?cat=laptop">Laptops</a><a href="products.html?cat=phone">Phones</a><a href="products.html?cat=accessory">Accessories</a></div>
        <div class="footer-col"><h5>Services</h5><a href="#services">Repairs</a><a href="#services">Software</a><a href="#services">Web Dev</a></div>
        <div class="footer-col"><h5>Company</h5><a href="#home">About HOK</a><a href="#contact">Contact</a><a href="https://wa.me/2348114550145">WhatsApp</a></div>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 HOK Computers. Ilorin, Kwara State, Nigeria.</p>
      <p>Built by <a href="https://my-personal-portfolio-the-quantum-c.vercel.app/">The Quantum Developer</a></p>
    </div>
  </div>
  ${getTrustBannerHTML()}
</footer>`;
}

function getTrustBannerHTML() {
  const orgs = [
    {
      name: 'Nigeria Civil Service',
      svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="#008751"/>
        <rect x="16" width="16" height="48" fill="#ffffff"/>
        <circle cx="24" cy="24" r="8" fill="#008751"/>
        <circle cx="24" cy="24" r="5" fill="#ffffff"/>
      </svg>`
    },
    {
      name: 'Nigerian Medical Association',
      svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="#003580"/>
        <path d="M24 8L24 40M8 24L40 24" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        <circle cx="24" cy="24" r="6" fill="#003580" stroke="#ffffff" stroke-width="3"/>
        <path d="M16 16C16 16 20 20 24 20C28 20 32 16 32 16" stroke="#e8c84a" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`
    },
    {
      name: 'Pharmacists Council of Nigeria',
      svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="#2e7d32"/>
        <path d="M14 12H26C30.4 12 34 15.6 34 20C34 24.4 30.4 28 26 28H20V36H14V12Z" fill="white"/>
        <path d="M20 20H26C27.1 20 28 20.9 28 22C28 23.1 27.1 24 26 24H20V20Z" fill="#2e7d32"/>
        <path d="M24 28L32 36" stroke="white" stroke-width="4" stroke-linecap="round"/>
      </svg>`
    },
    {
      name: 'Nursing & Midwifery Council',
      svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="#c62828"/>
        <path d="M24 10L24 38M10 24L38 24" stroke="white" stroke-width="7" stroke-linecap="round"/>
        <circle cx="24" cy="24" r="4" fill="#c62828" stroke="white" stroke-width="2"/>
      </svg>`
    },
    {
      name: 'ASUU',
      svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="#1a237e"/>
        <path d="M24 10L36 36H12L24 10Z" fill="none" stroke="#ffd600" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="24" cy="24" r="4" fill="#ffd600"/>
        <path d="M12 30H36" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`
    },
    {
      name: 'SSANU',
      svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="#4a148c"/>
        <rect x="10" y="14" width="28" height="4" rx="2" fill="white"/>
        <rect x="10" y="22" width="20" height="4" rx="2" fill="#ce93d8"/>
        <rect x="10" y="30" width="28" height="4" rx="2" fill="white"/>
        <circle cx="36" cy="24" r="5" fill="#ffd600" stroke="white" stroke-width="1.5"/>
      </svg>`
    },
    {
      name: 'Federal Airports Authority',
      svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="#01579b"/>
        <path d="M8 28L24 14L40 28" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 28V36H32V28" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="36" cy="16" r="5" fill="#ffd600"/>
        <path d="M33 16H39M36 13V19" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`
    },
    {
      name: 'Dangote Cement',
      svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="#d32f2f"/>
        <path d="M12 14H24C30.6 14 36 19.4 36 26C36 32.6 30.6 38 24 38H12V14Z" fill="none" stroke="white" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M18 20H24C27.3 20 30 22.7 30 26C30 29.3 27.3 32 24 32H18V20Z" fill="white"/>
        <rect x="10" y="9" width="28" height="3" rx="1.5" fill="#ffd600"/>
      </svg>`
    }
  ];

  // Duplicate for seamless infinite scroll
  const allOrgs = [...orgs, ...orgs];

  return `
    <section class="trust-section">
      <div class="trust-header">
        <p>Trusted by organisations & institutions across Nigeria</p>
      </div>
      <div class="trust-track-wrap">
        <div class="trust-track">
          ${allOrgs.map(org => `
            <div class="trust-item">
              ${org.svg}
              <span>${org.name}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>`;
}

// ── INIT COMMON ───────────────────────────────────────────
function initCommon() {
  initTheme();
  initNavbar();
  updateCartUI();

  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('cartToggle')?.addEventListener('click', openCartDrawer);
  document.getElementById('closeCart')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCartDrawer);
  document.getElementById('closeModal')?.addEventListener('click', closeProductModal);
  document.getElementById('modalOverlay')?.addEventListener('click', closeProductModal);
  document.getElementById('notifyOverlay')?.addEventListener('click', closeNotifyModal);
  document.getElementById('paystackOverlay')?.addEventListener('click', closePaystackModal);
  document.getElementById('paystackClose')?.addEventListener('click', closePaystackModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeCartDrawer(); closeProductModal(); closeNotifyModal(); closePaystackModal(); }
  })};
