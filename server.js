'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();
const multer = require('multer');

// ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Try again later.' }
}));
app.use('/api/adminlogin', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
}));
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true ,methods: ['GET', 'POST', 'PUT', 'DELETE'] ,allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'hok_fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 ,httpOnly: true ,sameSite: 'lax'}
}));

// Serve admin HTML pages only to authenticated sessions. Static assets remain available.
app.use('/admin', (req, res, next) => {
  const isHtmlRequest = req.path === '/' || req.path.endsWith('.html');
  if (isHtmlRequest && !(req.session && req.session.isAdmin)) {
    return res.sendFile(path.join(__dirname, 'admin', 'login.html'));
  }
  next();
});
app.use('/admin', express.static(path.join(__dirname, 'admin')));

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
    const hashed = await bcrypt.hash('hokcomputers2025', 10);
    writeData('admin.json', {
      username: 'hokadmin',
      password: hashed
    });
    console.log('✅ Admin credentials created.');
  } else {
    console.log('✅ Admin already exists:', admin.username);
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
app.get('/product/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'product.html')));
app.get('/reviews', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reviews.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'login.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'dashboard.html')));
app.get('/admin/products', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'products.html')));
app.get('/admin/reviews', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'reviews.html')));
app.get('/admin/enquiries', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'enquiries.html')));
app.get('/admin/orders', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'orders.html')));
app.get('/admin/requests', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'requests.html')));
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

app.post('/api/reviews', upload.array('images', 5), (req, res) => {
  const { name, phone, rating, message, product } = req.body;
  if (!name || !phone || !rating || !message || !product) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const reviews = readData('reviews.json');

  // handle uploaded files (multipart/form-data)
  const reviewImages = [];
  if (req.files && req.files.length) {
    req.files.forEach(f => {
      reviewImages.push(`/uploads/${f.filename}`);
    });
  } else if (req.body.images) {
    // legacy: base64 data URLs sent as JSON; save them to files
    const images = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
    images.forEach((dataUrl) => {
      const matches = String(dataUrl).match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1].split('/')[1] || 'png';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = uuidv4().slice(0,8) + '.' + ext;
        const outPath = path.join(__dirname, 'public', 'uploads', filename);
        try { fs.writeFileSync(outPath, buffer); reviewImages.push(`/uploads/${filename}`); } catch (e) { /* ignore write errors */ }
      }
    });
  }

  const newReview = {
    id: 'rev_' + uuidv4().slice(0, 8),
    name: String(name).trim(),
    phone: String(phone).trim(),
    rating: parseInt(rating),
    message: String(message).trim(),
    product: String(product).trim(),
    images: reviewImages,
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

app.post('/api/requests', (req, res) => {
  const { productId, productName, requestMessage, phone } = req.body;
  if (!productName || !requestMessage) return res.status(400).json({ error: 'Missing data' });
  const requests = readData('requests.json');
  requests.push({
    id: 'req_' + uuidv4().slice(0, 8),
    productId: productId || null,
    productName: productName || 'Custom request',
    requestMessage: String(requestMessage).trim(),
    phone: phone ? String(phone).trim() : '',
    createdAt: new Date().toISOString()
  });
  writeData('requests.json', requests);
  res.json({ success: true });
});
    
app.post('/api/repair-requests', upload.single('image'), (req, res) => {
  const { name, phone, device, problem } = req.body;
  if (!name || !phone || !device || !problem) {
    return res.status(400).json({ error: 'Missing repair data' });
  }
  const requests = readData('requests.json');
  const newRequest = {
    id: 'req_' + uuidv4().slice(0, 8),
    productId: null,
    productName: 'Repair request',
    requestMessage: `Repair request:\n\nName: ${name}\nPhone: ${phone}\nDevice: ${device}\nProblem: ${problem}`,
    phone: phone.trim(),
    imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
    createdAt: new Date().toISOString()
  };
  requests.push(newRequest);
  writeData('requests.json', requests);
  res.json({ success: true, imageUrl: newRequest.imageUrl });
});

app.post('/api/visitors', (req, res) => {
  const { path, page, referrer, userAgent } = req.body || {};
  const visitors = readData('visitors.json');
  visitors.push({
    id: 'vis_' + uuidv4().slice(0, 8),
    path: String(path || ''),
    page: String(page || ''),
    referrer: String(referrer || ''),
    userAgent: String(userAgent || req.headers['user-agent'] || ''),
    timestamp: new Date().toISOString()
  });
  writeData('visitors.json', visitors);
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

app.post('/api/paystack/initialize', async (req, res) => {
  const { productId, productName, amount, email, callback_url, orderType, items } = req.body;
  if (!amount || !email) {
    return res.status(400).json({ error: 'Missing payment data' });
  }
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Paystack secret key not configured' });

  try {
    const metadata = {
      productId: productId || null,
      productName: productName || (orderType === 'cart' ? 'Cart Order' : 'HOK Order'),
      orderType: orderType || 'single',
      items: Array.isArray(items) ? items : [],
      customerName: req.body.name || '',
      customerPhone: req.body.phone || ''
    };

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(amount) * 100),
        currency: 'NGN',
        metadata,
        callback_url: callback_url || `${req.protocol}://${req.get('host')}/payment-success.html`
      })
    });
    const data = await response.json();
    if (!data.status) return res.status(400).json({ error: data.message || 'Paystack initialization failed', details: data });
    res.json({ authorization_url: data.data.authorization_url, reference: data.data.reference });
  } catch (error) {
    res.status(500).json({ error: 'Paystack initialization error', details: error.message });
  }
});

app.get('/api/paystack/config', (req, res) => {
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || '';
  res.json({ publicKey });
});

app.post('/api/paystack/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Paystack secret key not configured' });
  const signature = req.get('x-paystack-signature');
  const expected = crypto.createHmac('sha512', secretKey).update(req.body).digest('hex');
  if (!signature || signature !== expected) {
    return res.status(401).json({ error: 'Invalid Paystack webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).json({ error: 'Invalid webhook body' });
  }

  const eventType = payload.event;
  const payment = payload.data;
  if (eventType === 'charge.success') {
    const orders = readData('orders.json');
    const existing = orders.find(o => o.reference === payment.reference);
    const record = {
      id: existing ? existing.id : 'order_' + uuidv4().slice(0, 8),
      reference: payment.reference,
      status: payment.status,
      amount: payment.amount / 100,
      currency: payment.currency,
      email: payment.customer?.email || '',
      phone: payment.customer?.phone || payment.metadata?.customerPhone || '',
      customerName: payment.metadata?.customerName || '',
      productId: payment.metadata?.productId || null,
      productName: payment.metadata?.productName || '',
      orderType: payment.metadata?.orderType || 'single',
      items: payment.metadata?.items || [],
      paidAt: payment.paid_at || new Date().toISOString(),
      raw: payment
    };
    if (existing) {
      Object.assign(existing, record);
    } else {
      orders.push(record);
    }
    writeData('orders.json', orders);
  }

  res.json({ received: true });
});

app.get('/api/paystack/verify/:reference', async (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Paystack secret key not configured' });

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(req.params.reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const data = await response.json();
    if (!data.status) return res.status(400).json({ error: data.message || 'Verification failed', details: data });

    const payment = data.data;
    const orders = readData('orders.json');
    const existing = orders.find(o => o.reference === payment.reference);
    if (!existing) {
      orders.push({
        id: 'order_' + uuidv4().slice(0, 8),
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount / 100,
        currency: payment.currency,
        email: payment.customer?.email || '',
        productId: payment.metadata?.productId || null,
        productName: payment.metadata?.productName || '',
        orderType: payment.metadata?.orderType || 'single',
        items: payment.metadata?.items || [],
        paidAt: payment.paid_at || new Date().toISOString(),
        raw: payment
      });
      writeData('orders.json', orders);
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: 'Paystack verification error', details: error.message });
  }
});

app.get('/api/settings', (req, res) => {
  res.json(readData('settings.json'));
});

// ════════════════════════════════════════════════════════
// ADMIN AUTH
// ════════════════════════════════════════════════════════

// Legacy admin auth handlers were removed in favor of the consolidated endpoints below:
// - POST /api/adminlogin
// - POST /api/adminlogout
// - GET  /api/admincheck
// These endpoints provide session-based admin authentication and are used by the admin UI.


app.post('/api/adminlogin', async (req, res) => {
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

app.post('/api/adminlogout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admincheck', requireAuth, (req, res) => {
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
  const visitors = readData('visitors.json');
  const requests = readData('requests.json');

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

  const requestSummary = {};
  requests.forEach(r => {
    const key = r.productId || r.productName;
    if (!requestSummary[key]) {
      requestSummary[key] = { productName: r.productName, totalRequests: 0, lastRequest: r.createdAt };
    }
    requestSummary[key].totalRequests++;
    if (r.createdAt > requestSummary[key].lastRequest) requestSummary[key].lastRequest = r.createdAt;
  });
  const topRequests = Object.values(requestSummary)
    .sort((a, b) => b.totalRequests - a.totalRequests)
    .slice(0, 5);

  const pageSummary = {};
  visitors.forEach(v => {
    const pageKey = v.path || v.page || 'unknown';
    if (!pageSummary[pageKey]) {
      pageSummary[pageKey] = { page: v.page || v.path || pageKey, path: v.path, count: 0 };
    }
    pageSummary[pageKey].count++;
  });
  const topPages = Object.values(pageSummary)
    .sort((a, b) => b.count - a.count)
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
    totalRequests: requests.length,
    totalVisitors: visitors.length,
    topProducts,
    topPages,
    topRequests
  });
});

// ════════════════════════════════════════════════════════
// ADMIN — PRODUCTS
// ════════════════════════════════════════════════════════

app.get('/api/admin/products', requireAuth, (req, res) => {
  res.json(readData('products.json'));
});

app.post('/api/admin/products', requireAuth, (req, res) => {
  const { brand, category, name, price, image, images, specs, warranty, stock, badge, featured, newArrival } = req.body;
  if (!brand || !name || !price || !category) {
    return res.status(400).json({ error: 'Brand, name, price and category are required' });
  }
  const imageList = Array.isArray(images)
    ? images.map(String).map(s => s.trim()).filter(Boolean)
    : typeof images === 'string'
      ? images.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
  const primaryImage = image?.trim() || imageList[0] || '';
  const products = readData('products.json');
  const newProduct = {
    id: 'prod_' + uuidv4().slice(0, 8),
    brand: brand.trim(),
    category,
    name: name.trim(),
    price: parseInt(price),
    image: primaryImage,
    images: imageList,
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
  const { image, images } = req.body;
  const imageList = Array.isArray(images)
    ? images.map(String).map(s => s.trim()).filter(Boolean)
    : typeof images === 'string'
      ? images.split('\n').map(s => s.trim()).filter(Boolean)
      : products[index].images || [];
  const primaryImage = image?.trim() || imageList[0] || products[index].image || '';
  products[index] = {
    ...products[index],
    ...req.body,
    id: products[index].id,
    image: primaryImage,
    images: imageList,
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

app.get('/api/admin/requests', requireAuth, (req, res) => {
  const requests = readData('requests.json');
  const summary = {};
  requests.forEach(r => {
    const key = r.productId || r.productName;
    if (!summary[key]) {
      summary[key] = { productId: r.productId, productName: r.productName, totalRequests: 0, lastRequest: r.createdAt };
    }
    summary[key].totalRequests++;
    if (r.createdAt > summary[key].lastRequest) summary[key].lastRequest = r.createdAt;
  });
  const sorted = Object.values(summary).sort((a, b) => b.totalRequests - a.totalRequests);
  res.json({ raw: requests, summary: sorted });
});

app.get('/api/adminrequests', requireAuth, (req, res) => {
  const requests = readData('requests.json');
  const summary = {};
  requests.forEach(r => {
    const key = r.productId || r.productName;
    if (!summary[key]) {
      summary[key] = { productId: r.productId, productName: r.productName, totalRequests: 0, lastRequest: r.createdAt };
    }
    summary[key].totalRequests++;
    if (r.createdAt > summary[key].lastRequest) summary[key].lastRequest = r.createdAt;
  });
  const sorted = Object.values(summary).sort((a, b) => b.totalRequests - a.totalRequests);
  res.json({ raw: requests, summary: sorted });
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

// ════════════════════════════════════════════════════════
// ADMIN API ALIASES (for compatibility with admin pages)
// ════════════════════════════════════════════════════════
app.get('/api/adminstats', requireAuth, (req, res) => {
  const products = readData('products.json');
  const reviews = readData('reviews.json');
  const enquiries = readData('enquiries.json');
  const notify = readData('notify.json');
  const requests = readData('requests.json');
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
    totalRequests: requests.length,
    topProducts
  });
});

app.get('/api/adminproducts', requireAuth, (req, res) => {
  res.json(readData('products.json'));
});

app.post('/api/adminproducts', requireAuth, (req, res) => {
  const { brand, category, name, price, image, images, specs, warranty, stock, badge, featured, newArrival } = req.body;
  if (!brand || !name || !price || !category) {
    return res.status(400).json({ error: 'Brand, name, price and category are required' });
  }
  const imageList = Array.isArray(images)
    ? images.map(String).map(s => s.trim()).filter(Boolean)
    : typeof images === 'string'
      ? images.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
  const primaryImage = image?.trim() || imageList[0] || '';
  const products = readData('products.json');
  const newProduct = {
    id: 'prod_' + uuidv4().slice(0, 8),
    brand: brand.trim(),
    category,
    name: name.trim(),
    price: parseInt(price),
    image: primaryImage,
    images: imageList,
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

app.put('/api/adminproducts/:id', requireAuth, (req, res) => {
  const products = readData('products.json');
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });
  const { image, images } = req.body;
  const imageList = Array.isArray(images)
    ? images.map(String).map(s => s.trim()).filter(Boolean)
    : typeof images === 'string'
      ? images.split('\n').map(s => s.trim()).filter(Boolean)
      : products[index].images || [];
  const primaryImage = image?.trim() || imageList[0] || products[index].image || '';
  products[index] = {
    ...products[index],
    ...req.body,
    id: products[index].id,
    image: primaryImage,
    images: imageList,
    price: parseInt(req.body.price) || products[index].price,
    featured: req.body.featured === true || req.body.featured === 'true',
    newArrival: req.body.newArrival === true || req.body.newArrival === 'true',
    updatedAt: new Date().toISOString()
  };
  writeData('products.json', products);
  res.json({ success: true, product: products[index] });
});

app.delete('/api/adminproducts/:id', requireAuth, (req, res) => {
  let products = readData('products.json');
  const exists = products.find(p => p.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Product not found' });
  products = products.filter(p => p.id !== req.params.id);
  writeData('products.json', products);
  res.json({ success: true });
});

app.get('/api/adminreviews', requireAuth, (req, res) => {
  res.json(readData('reviews.json'));
});

app.put('/api/adminreviews/:id', requireAuth, (req, res) => {
  const reviews = readData('reviews.json');
  const index = reviews.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Review not found' });
  reviews[index] = { ...reviews[index], ...req.body };
  writeData('reviews.json', reviews);
  res.json({ success: true, review: reviews[index] });
});

app.delete('/api/adminreviews/:id', requireAuth, (req, res) => {
  let reviews = readData('reviews.json');
  const exists = reviews.find(r => r.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Review not found' });
  reviews = reviews.filter(r => r.id !== req.params.id);
  writeData('reviews.json', reviews);
  res.json({ success: true });
});

app.get('/api/adminenquiries', requireAuth, (req, res) => {
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

app.get('/api/adminsettings', requireAuth, (req, res) => {
  res.json(readData('settings.json'));
});

app.put('/api/adminsettings', requireAuth, (req, res) => {
  const current = readData('settings.json');
  const updated = { ...current, ...req.body };
  writeData('settings.json', updated);
  res.json({ success: true, settings: updated });
});

app.get('/api/admin/orders', requireAuth, (req, res) => {
  res.json(readData('orders.json'));
});

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Route not found' });
  res.sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── START ─────────────────────────────────────────────────
seedAdmin().then(() => {
  app.listen(PORT, () => {
    console.log  (`🚀 HOK Computers running → http://localhost:${PORT}`);
    console.log(`🔐 Admin panel → http://localhost:${PORT}/admin`);
  });
});
