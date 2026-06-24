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

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    settings = await res.json();
  } catch { settings = { whatsappNumber: WA_NUM, delivery: { local: 'Ilorin — Same Day', state: 'Other Kwara — Next Day', national: 'Outside Kwara — 2-3 Days' } }; }
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

function buyNowWA(id, name, price, e) {
  if (e) e.stopPropagation();
  // Log enquiry
  fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id, productName: name }) }).catch(() => {});
  const msg = `Hello HOK Computers, I want to buy: *${name}* at *${fmt(price)}*. Please confirm availability.`;
  window.open(waLink(msg, settings.whatsappNumber), '_blank');
}

// ── INSTALLMENT ───────────────────────────────────────────
function showInstallmentModal() {
  document.getElementById('installmentOverlay').classList.add('open');
  document.getElementById('installmentModal').classList.add('open');
}
function closeInstallmentModal() {
  document.getElementById('installmentOverlay').classList.remove('open');
  document.getElementById('installmentModal').classList.remove('open');
}
function submitInstallment() {
  const name = document.getElementById('instName').value.trim();
  const phone = document.getElementById('instPhone').value.trim();
  const dur = document.getElementById('instDuration').value;
  const dep = document.getElementById('instDeposit').value.trim();
  if (!name || !phone) { showToast('Please fill in name and phone.'); return; }
  if (!cart.length) { showToast('Your cart is empty.'); return; }
  const items = cart.map(i => `${i.name} x${i.qty}`).join(', ');
  const msg = `Hello HOK Computers, installment request:\n\n*Items:* ${items}\n*Total:* ${fmt(calcTotal())}\n*Duration:* ${dur}${dep ? `\n*Deposit:* ${dep}` : ''}\n\n*Name:* ${name}\n*Phone:* ${phone}`;
  window.open(waLink(msg, settings.whatsappNumber), '_blank');
  closeInstallmentModal();
}

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
  if (!name || !phone || !device || !problem) { showToast('Please fill in all fields.'); return; }
  const msg = `Hello HOK Computers, repair request:\n\n*Name:* ${name}\n*Phone:* ${phone}\n*Device:* ${device}\n*Problem:* ${problem}`;
  window.open(waLink(msg, settings.whatsappNumber), '_blank');
  ['repairName', 'repairPhone', 'repairProblem'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  if (document.getElementById('repairDevice')) document.getElementById('repairDevice').value = '';
  showToast('Repair request sent!');
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

  // Installment calc default (3 months)
  const monthly3 = Math.ceil(p.price / 3);

  return `
    <div class="product-card reveal" style="transition-delay:${i * 0.04}s" onclick="handleCardClick(event,'${p.id}')">
      <div class="p-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
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
            <button class="btn-wa-icon" onclick="buyNowWA('${p.id}','${p.name}',${p.price},event)" title="Buy via WhatsApp">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.054 23.447a.5.5 0 00.61.61l5.595-1.478A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.802 9.802 0 01-5.031-1.385l-.36-.214-3.733.985.997-3.617-.235-.372A9.808 9.808 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div class="installment-calc">
        <div class="calc-label">Installment estimate:</div>
        <div class="calc-tabs">
          <button class="calc-tab" onclick="setCalcTab(this,${p.price},2);event.stopPropagation()">2mo</button>
          <button class="calc-tab active" onclick="setCalcTab(this,${p.price},3);event.stopPropagation()">3mo</button>
          <button class="calc-tab" onclick="setCalcTab(this,${p.price},6);event.stopPropagation()">6mo</button>
        </div>
        <div class="calc-result">Pay <span>${fmt(monthly3)}/month</span></div>
      </div>
      ${isOut ? `<button class="notify-btn" onclick="openNotifyModal('${p.id}','${p.name}');event.stopPropagation()">🔔 Notify me when back in stock</button>` : ''}
    </div>`;
}

function setCalcTab(btn, price, months) {
  const card = btn.closest('.product-card');
  card.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const monthly = Math.ceil(price / months);
  card.querySelector('.calc-result').innerHTML = `Pay <span>${fmt(monthly)}/month</span>`;
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
          <button class="btn-wa full" onclick="checkoutWhatsApp()">Checkout via WhatsApp</button>
          <button class="btn-outline full" onclick="showInstallmentModal()">Installment Plan</button>
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
    <div class="modal-overlay" id="installmentOverlay"></div>
    <div class="installment-modal" id="installmentModal">
      <button class="close-btn" onclick="closeInstallmentModal()">✕</button>
      <h3>Installment Plan</h3>
      <p class="modal-sub">Pay over time. We'll confirm on WhatsApp.</p>
      <div class="form-group"><label>Full Name</label><input type="text" id="instName" placeholder="Your full name" /></div>
      <div class="form-group"><label>Phone Number</label><input type="tel" id="instPhone" placeholder="08012345678" /></div>
      <div class="form-group"><label>Duration</label><select id="instDuration"><option value="2 months">2 Months</option><option value="3 months" selected>3 Months</option><option value="6 months">6 Months</option></select></div>
      <div class="form-group"><label>Initial Deposit (Optional)</label><input type="text" id="instDeposit" placeholder="e.g. ₦50,000" /></div>
      <button class="btn-wa full" onclick="submitInstallment()">Send Installment Request</button>
    </div>
    <div class="modal-overlay" id="notifyOverlay"></div>
    <div class="notify-modal" id="notifyModal">
      <button class="close-btn" onclick="closeNotifyModal()" style="position:absolute;top:16px;right:16px">✕</button>
      <h3>🔔 Notify Me</h3>
      <p class="modal-sub">We'll WhatsApp you when this product is back in stock.</p>
      <div class="form-group"><label>WhatsApp Number</label><input type="tel" id="notifyPhone" placeholder="08012345678" /></div>
      <button class="btn-wa full" onclick="submitNotify()">Notify Me</button>
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
        <p>Home of Khayr — Ilorin's premier tech store. CAC Registered since 2020.</p>
        <div class="socials">
          <a href="https://web.facebook.com/homeofkhayr/?_rdc=1&_rdr#" aria-label="Facebook" target="_blank" rel="noreferrer noopener">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 10-11.5 9.9v-7H8.5v-2.9h2v-2.2c0-2 1.2-3.1 3-3.1.9 0 1.8.1 1.8.1v2h-1c-1 0-1.3.6-1.3 1.2v1.7h2.3l-.4 2.9h-1.9v7A10 10 0 0022 12z"/></svg>
          </a>
          <a href="https://www.instagram.com/hokcomputers/" aria-label="Instagram" target="_blank" rel="noreferrer noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M16.5 7.5h.01"/><path d="M7.5 7.5h9v9h-9z"/></svg>
          </a>
          <a href="https://ng.linkedin.com/company/home-of-khayr" aria-label="LinkedIn" target="_blank" rel="noreferrer noopener">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5A2.5 2.5 0 002.5 6v12a2.5 2.5 0 002.48 2.5h.02A2.5 2.5 0 007.5 18V6a2.5 2.5 0 00-2.52-2.5zM4.5 8.75h1.5V18H4.5V8.75zm4.5 0H10.5v1.35c.2-.35.8-.88 1.75-.88 1.85 0 2.25 1.22 2.25 2.8V18H13.5v-4.75c0-1.14-.02-2.6-1.6-2.6-1.6 0-1.85 1.26-1.85 2.54V18H9V8.75zM5.25 4.5h1.5v1.25h-1.5V4.5z"/></svg>
          </a>
          <a href="https://wa.me/2348114550145" aria-label="WhatsApp" target="_blank" rel="noreferrer noopener">
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
</footer>`;
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
  document.getElementById('installmentOverlay')?.addEventListener('click', closeInstallmentModal);
  document.getElementById('notifyOverlay')?.addEventListener('click', closeNotifyModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeCartDrawer(); closeProductModal(); closeInstallmentModal(); closeNotifyModal(); }
  });
}
