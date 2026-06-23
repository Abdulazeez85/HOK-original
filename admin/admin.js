'use strict';

const fmt = n => '₦' + parseInt(n).toLocaleString('en-NG');
// Wrap all admin fetches to always include credentials
const adminFetch = (url, options = {}) => fetch(url, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });

// ── AUTH CHECK ────────────────────────────────────────────
async function checkAuth() {
  try {
    const res = await adminadminFetch('/api/admincheck');
    if (!res.ok) { window.location.href = '/admin'; return false; }
    return true;
  } catch { window.location.href = '/admin'; return false; }
}

// ── TOAST ─────────────────────────────────────────────────
function toast(msg, type = 'success') {
  let t = document.getElementById('adminToast');
  if (!t) { t = document.createElement('div'); t.id = 'adminToast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── LOGOUT ────────────────────────────────────────────────
async function logout() {
  await adminFetch('/api/adminlogout', { method: 'POST' });
  window.location.href = '/admin';
}

// ── SIDEBAR HTML ──────────────────────────────────────────
function getSidebarHTML(active) {
  const items = [
    { href: '/admin/dashboard', icon: '📊', label: 'Dashboard', key: 'dashboard' },
    { href: '/admin/products', icon: '🖥️', label: 'Products', key: 'products' },
    { href: '/admin/reviews', icon: '⭐', label: 'Reviews', key: 'reviews' },
    { href: '/admin/enquiries', icon: '📈', label: 'Enquiries', key: 'enquiries' },
    { href: '/admin/settings', icon: '⚙️', label: 'Settings', key: 'settings' },
  ];
  return `
    <aside class="admin-sidebar">
      <div class="sidebar-logo">
        <svg viewBox="0 0 40 40" fill="none" width="28" height="28"><rect width="40" height="40" rx="6" fill="#0d1f14"/><path d="M10 10H16V18H24V10H30V30H24V22H16V30H10V10Z" fill="#25d466"/></svg>
        <div><span>HOK Computers</span><em>Admin Panel</em></div>
      </div>
      <p class="sidebar-section-label">Management</p>
      ${items.map(i => `<a href="${i.href}" class="nav-item ${active === i.key ? 'active' : ''}"><span class="nav-icon">${i.icon}</span>${i.label}</a>`).join('')}
      <div class="sidebar-bottom">
        <a href="/" target="_blank" class="nav-item" style="margin-bottom:4px"><span class="nav-icon">🌐</span>View Site</a>
        <button class="logout-btn" onclick="logout()"><span>🚪</span> Logout</button>
      </div>
    </aside>`;
}

// ── CONFIRM DIALOG ────────────────────────────────────────
function confirmDelete(msg, callback) {
  if (window.confirm(msg || 'Are you sure you want to delete this?')) callback();
}
