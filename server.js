'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true ,methods: ['GET', 'POST', 'PUT', 'DELETE'] ,allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'hok_fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 ,httpOnly: true ,sameSite: 'lax'}
}));

// ── FILE HELPERS ──────────────────────────────────────────
const dataPath = (file) => path.join(__dirname, 'data', file);

function readData(file) {
  try {
    const raw = fs.readFileSync(dataPath(file), 'utf8');
    return JSON.parse(raw);
  } catch {
    return file.includes('admin') ? {} : [];
  }
}

function writeData(file, data) {
  fs.writeFileSync(dataPath(file), JSON.stringify(data, null, 2));
}

// ── SEED ADMIN ────────────────────────────────────────────
async function seedAdmin() {
  const admin = readData('admin.json');
  if (!admin.username) {
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'hokcomputers2025', 10);
    writeData('admin.json', {
      username: process.env.ADMIN_USERNAME || 'hokadmin',
      password: hashed
    });
    console.log('✅ Admin credentials created.');
  }
}

// ── AUTH MIDDLEWARE ───────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── SERVE HTML PAGES ──────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/products', (req, res) => res.sendFile(path.join(__dirname, 'public', 'products.html')));
app.get('/reviews', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reviews.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'login.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'dashboard.html')));
app.get('/admin/products', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'products.html')));
app.get('/admin/reviews', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'reviews.html')));
app.get('/admin/enquiries', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'enquiries.html')));
app.get('/admin/settings', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'settings.html')));

// ════════════════════════════════════════════════════════
// PUBLIC API ROUTES
// ════════════════════════════════════════════════════════

app.get('/api/products', (req, res) => {
  res.json(readData('products.json'));
});

app.get('/api/products/featured', (req, res) => {
  const products = readData('products.json');
  res.json(products.filter(p => p.featured));
});

app.get('/api/products/new-arrivals', (req, res) => {
  const products = readData('products.json');
  res.json(products.filter(p => p.newArrival));
});

app.get('/api/products/:id', (req, res) => {
  const products = readData('products.json');
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.get('/api/reviews/approved', (req, res) => {
  const reviews = readData('reviews.json');
  res.json(reviews.filter(r => r.status === 'approved').sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt)));
});

app.get('/api/reviews/top', (req, res) => {
  const reviews = readData('reviews.json');
  const top = reviews
    .filter(r => r.status === 'approved')
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 3);
  res.json(top);
});

app.post('/api/reviews', (req, res) => {
  const { name, phone, rating, message, product } = req.body;
  if (!name || !phone || !rating || !message || !product) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const reviews = readData('reviews.json');
  const newReview = {
    id: 'rev_' + uuidv4().slice(0, 8),
    name: name.trim(),
    phone: phone.trim(),
    rating: parseInt(rating),
    message: message.trim(),
    product: product.trim(),
    status: 'pending',
    verifiedBuyer: false,
    submittedAt: new Date().toISOString()
  };
  reviews.push(newReview);
  writeData('reviews.json', reviews);
  res.json({ success: true, message: 'Review submitted successfully' });
});

app.post('/api/enquiries', (req, res) => {
  const { productId, productName } = req.body;
  if (!productId || !productName) return res.status(400).json({ error: 'Missing data' });
  const enquiries = readData('enquiries.json');
  enquiries.push({
    id: 'enq_' + uuidv4().slice(0, 8),
    productId,
    productName,
    timestamp: new Date().toISOString()
  });
  writeData('enquiries.json', enquiries);
  res.json({ success: true });
});

app.post('/api/notify', (req, res) => {
  const { productId, productName, phone } = req.body;
  if (!productId || !phone) return res.status(400).json({ error: 'Missing data' });
  const notify = readData('notify.json');
  const exists = notify.find(n => n.productId === productId && n.phone === phone);
  if (exists) return res.json({ success: true, message: 'Already registered' });
  notify.push({
    id: 'ntf_' + uuidv4().slice(0, 8),
    productId, productName,
    phone: phone.trim(),
    createdAt: new Date().toISOString()
  });
  writeData('notify.json', notify);
  res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
  res.json(readData('settings.json'));
});

// ════════════════════════════════════════════════════════
// ADMIN AUTH
// ════════════════════════════════════════════════════════

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = readData('admin.json');
  if (!admin.username || username !== admin.username) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const match = await bcrypt.compare(password, admin.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.isAdmin = true;
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/check', requireAuth, (req, res) => {
  res.json({ authenticated: true });
});

// ════════════════════════════════════════════════════════
// ADMIN — STATS
// ════════════════════════════════════════════════════════

app.get('/api/admin/stats', requireAuth, (req, res) => {
  const products = readData('products.json');
  const reviews = readData('reviews.json');
  const enquiries = readData('enquiries.json');
  const notify = readData('notify.json');

  const summary = {};
  enquiries.forEach(e => {
    if (!summary[e.productId]) {
      summary[e.productId] = { productName: e.productName, totalClicks: 0 };
    }
    summary[e.productId].totalClicks++;
  });
  const topProducts = Object.values(summary)
    .sort((a, b) => b.totalClicks - a.totalClicks)
    .slice(0, 5);

  res.json({
    totalProducts: products.length,
    inStock: products.filter(p => p.stock === 'In Stock').length,
    limitedStock: products.filter(p => p.stock === 'Limited Stock').length,
    outOfStock: products.filter(p => p.stock === 'Out of Stock').length,
    pendingReviews: reviews.filter(r => r.status === 'pending').length,
    approvedReviews: reviews.filter(r => r.status === 'approved').length,
    totalEnquiries: enquiries.length,
    notifyRequests: notify.length,
    topProducts
  });
});

// ════════════════════════════════════════════════════════
// ADMIN — PRODUCTS
// ════════════════════════════════════════════════════════

app.get('/api/admin/products', requireAuth, (req, res) => {
  res.json(readData('products.json'));
});

app.post('/api/admin/products', requireAuth, (req, res) => {
  const { brand, category, name, price, image, specs, warranty, stock, badge, featured, newArrival } = req.body;
  if (!brand || !name || !price || !category) {
    return res.status(400).json({ error: 'Brand, name, price and category are required' });
  }
  const products = readData('products.json');
  const newProduct = {
    id: 'prod_' + uuidv4().slice(0, 8),
    brand: brand.trim(),
    category,
    name: name.trim(),
    price: parseInt(price),
    image: image || '',
    specs: typeof specs === 'object' ? specs : {},
    warranty: warranty || '6 Months',
    stock: stock || 'In Stock',
    badge: badge || null,
    featured: featured === true || featured === 'true',
    newArrival: newArrival === true || newArrival === 'true',
    createdAt: new Date().toISOString()
  };
  products.push(newProduct);
  writeData('products.json', products);
  res.json({ success: true, product: newProduct });
});

app.put('/api/admin/products/:id', requireAuth, (req, res) => {
  const products = readData('products.json');
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });
  products[index] = {
    ...products[index],
    ...req.body,
    id: products[index].id,
    price: parseInt(req.body.price) || products[index].price,
    featured: req.body.featured === true || req.body.featured === 'true',
    newArrival: req.body.newArrival === true || req.body.newArrival === 'true',
    updatedAt: new Date().toISOString()
  };
  writeData('products.json', products);
  res.json({ success: true, product: products[index] });
});

app.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  let products = readData('products.json');
  const exists = products.find(p => p.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Product not found' });
  products = products.filter(p => p.id !== req.params.id);
  writeData('products.json', products);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════
// ADMIN — REVIEWS
// ════════════════════════════════════════════════════════

app.get('/api/admin/reviews', requireAuth, (req, res) => {
  const reviews = readData('reviews.json');
  res.json(reviews.sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt)));
});

app.put('/api/admin/reviews/:id', requireAuth, (req, res) => {
  const reviews = readData('reviews.json');
  const index = reviews.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Review not found' });
  const { status, verifiedBuyer } = req.body;
  if (status) reviews[index].status = status;
  if (verifiedBuyer !== undefined) reviews[index].verifiedBuyer = verifiedBuyer === true || verifiedBuyer === 'true';
  reviews[index].updatedAt = new Date().toISOString();
  writeData('reviews.json', reviews);
  res.json({ success: true, review: reviews[index] });
});

app.delete('/api/admin/reviews/:id', requireAuth, (req, res) => {
  let reviews = readData('reviews.json');
  reviews = reviews.filter(r => r.id !== req.params.id);
  writeData('reviews.json', reviews);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════
// ADMIN — ENQUIRIES
// ════════════════════════════════════════════════════════

app.get('/api/admin/enquiries', requireAuth, (req, res) => {
  const enquiries = readData('enquiries.json');
  const summary = {};
  enquiries.forEach(e => {
    if (!summary[e.productId]) {
      summary[e.productId] = { productId: e.productId, productName: e.productName, totalClicks: 0, lastEnquiry: e.timestamp };
    }
    summary[e.productId].totalClicks++;
    if (e.timestamp > summary[e.productId].lastEnquiry) summary[e.productId].lastEnquiry = e.timestamp;
  });
  const sorted = Object.values(summary).sort((a, b) => b.totalClicks - a.totalClicks);
  res.json({ raw: enquiries, summary: sorted });
});

// ════════════════════════════════════════════════════════
// ADMIN — SETTINGS
// ════════════════════════════════════════════════════════

app.get('/api/admin/settings', requireAuth, (req, res) => {
  res.json(readData('settings.json'));
});

app.put('/api/admin/settings', requireAuth, (req, res) => {
  const current = readData('settings.json');
  const updated = { ...current, ...req.body };
  writeData('settings.json', updated);
  res.json({ success: true, settings: updated });
});

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Route not found' });
  res.sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── START ─────────────────────────────────────────────────
seedAdmin().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 HOK Computers running → http://localhost:${PORT}`);
    console.log(`🔐 Admin panel → http://localhost:${PORT}/admin`);
  });
});
