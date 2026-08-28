'use strict';
const dns = require('dns');
dns.setServers(['8.8.8.8','8.8.4.4']);

const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const sanitizeHtml = require('sanitize-html');

// ── SECURITY ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests. Try again later.' }
}));
app.use('/api/adminlogin', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
}));

// ── MONGODB ───────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ── SCHEMAS ───────────────────────────────────────────────
const ProductSchema = new mongoose.Schema({
  id: String,
  brand: String,
  category: String,
  name: String,
  price: Number,
  image: String,
  images: [String],
  specs: {
    cpu: String,
    ram: String,
    storage: String,
    display: String,
    condition: String
  },
  warranty: String,
  stock: String,
  badge: String,
  featured: Boolean,
  newArrival: Boolean,
  createdAt: String,
  updatedAt: String
});

const ReviewSchema = new mongoose.Schema({
  id: String,
  name: String,
  phone: String,
  rating: Number,
  message: String,
  product: String,
  status: String,
  verifiedBuyer: Boolean,
  images: [String],
  submittedAt: String,
  updatedAt: String
});

const OrderSchema = new mongoose.Schema({
  id: String,
  reference: String,
  email: String,
  amount: Number,
  productId: String,
  productName: String,
  orderType: String,
  items: Array,
  metadata: Object,
  status: String,
  paidAt: String,
  createdAt: String
});

const EnquirySchema = new mongoose.Schema({
  id: String,
  productId: String,
  productName: String,
  timestamp: String
});

const NotifySchema = new mongoose.Schema({
  id: String,
  productId: String,
  productName: String,
  phone: String,
  createdAt: String
});

const RequestSchema = new mongoose.Schema({
  id: String,
  type: String,
  name: String,
  phone: String,
  device: String,
  problem: String,
  imageUrl: String,
  productName: String,
  budget: String,
  status: String,
  createdAt: String
});

const VisitorSchema = new mongoose.Schema({
  id: String,
  path: String,
  page: String,
  referrer: String,
  userAgent: String,
  timestamp: String
});

const SettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main' },
  whatsappNumber: String,
  businessName: String,
  businessEmail: String,
  businessHours: String,
  location: String,
  delivery: {
    local: String,
    state: String,
    national: String
  }
});

const AdminSchema = new mongoose.Schema({
  username: String,
  password: String
});

const Product = mongoose.model('Product', ProductSchema);
const Review = mongoose.model('Review', ReviewSchema);
const Order = mongoose.model('Order', OrderSchema);
const Enquiry = mongoose.model('Enquiry', EnquirySchema);
const Notify = mongoose.model('Notify', NotifySchema);
const Request = mongoose.model('Request', RequestSchema);
const Visitor = mongoose.model('Visitor', VisitorSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const Admin = mongoose.model('Admin', AdminSchema);

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'hok_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));

app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// ── MULTER ────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// ── SEED DATA ─────────────────────────────────────────────
async function seedData() {
  const admin = await Admin.findOne({});
  if (!admin) {
    const hashed = await bcrypt.hash('hokcomputers2025', 10);
    await Admin.create({ username: 'hokadmin', password: hashed });
    console.log('✅ Admin created');
  }

  const settings = await Settings.findOne({ key: 'main' });
  if (!settings) {
    await Settings.create({
      key: 'main',
      whatsappNumber: '2348114550145',
      businessName: 'HOK Computers',
      businessEmail: 'info@hokcomputers.com',
      businessHours: 'Monday - Saturday, 9AM - 6PM',
      location: 'Ilorin, Kwara State, Nigeria',
      delivery: {
        local: 'Ilorin — Same Day',
        state: 'Other Kwara — Next Day',
        national: 'Outside Kwara — 2-3 Days'
      }
    });
    console.log('✅ Settings created');
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
app.get('/product/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'product.html')));app.get('/payment-success', (req, res) => res.sendFile(path.join(__dirname, 'public', 'payment-success.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'login.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'dashboard.html')));
app.get('/admin/products', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'products.html')));
app.get('/admin/reviews', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'reviews.html')));
app.get('/admin/orders', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'orders.html')));
app.get('/admin/enquiries', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'enquiries.html')));
app.get('/admin/requests', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'requests.html')));
app.get('/admin/settings', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'settings.html')));

// ════════════════════════════════════════════════════════
// PUBLIC API ROUTES
// ════════════════════════════════════
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/featured', async (req, res) => {
  try {
    const products = await Product.find({ featured: true }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

app.get('/api/products/new-arrivals', async (req, res) => {
  try {
    const products = await Product.find({ newArrival: true }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch new arrivals' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

app.get('/api/reviews/approved', async (req, res) => {
  try {
    const reviews = await Review.find({ status: 'approved' }).sort({ submittedAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.get('/api/reviews/top', async (req, res) => {
  try {
    const reviews = await Review.find({ status: 'approved' })
      .sort({ submittedAt: -1 }).limit(3);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch top reviews' });
  }
});

app.post('/api/reviews', upload.array('images', 5), async (req, res) => {
  try {
    const { name, phone, rating, message, product } = req.body;
    const cleanName = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} });
const cleanMessage = sanitizeHtml(message, { allowedTags: [], allowedAttributes: {} });
const cleanProduct = sanitizeHtml(product, { allowedTags: [], allowedAttributes: {} });
    if (!name || !phone || !rating || !message || !product) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const images = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

    await Review.create({
      id: 'rev_' + uuidv4().slice(0, 8),
      name: name.trim(),
      phone: phone.trim(),
      rating: parseInt(rating),
      message: message.trim(),
      product: product.trim(),
      images,
      status: 'pending',
      verifiedBuyer: false,
      submittedAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Review submitted successfully' });
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

app.post('/api/enquiries', async (req, res) => {
  try {
    const { productId, productName } = req.body;
    if (!productId || !productName) return res.status(400).json({ error: 'Missing data' });
    await Enquiry.create({
      id: 'enq_' + uuidv4().slice(0, 8),
      productId, productName,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log enquiry' });
  }
});

app.post('/api/notify', async (req, res) => {
  try {
    const { productId, productName, phone } = req.body;
    if (!productId || !phone) return res.status(400).json({ error: 'Missing data' });
    const exists = await Notify.findOne({ productId, phone });
    if (exists) return res.json({ success: true, message: 'Already registered' });
    await Notify.create({
      id: 'ntf_' + uuidv4().slice(0, 8),
      productId, productName,
      phone: phone.trim(),
      createdAt: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register notification' });
  }
});

app.post('/api/requests', async (req, res) => {
  try {
    const { name, phone, productName, budget } = req.body;
    if (!name || !phone || !productName) {
      return res.status(400).json({ error: 'Name, phone and product name required' });
    }
    await Request.create({
      id: 'req_' + uuidv4().slice(0, 8),
      type: 'product',
      name: name.trim(), phone: phone.trim(),
      productName: productName.trim(),
      budget: budget || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

app.post('/api/repair-requests', upload.single('image'), async (req, res) => {
  try {
    const { name, phone, device, problem } = req.body;
    if (!name || !phone || !device || !problem) {
      return res.status(400).json({ error: 'All fields required' });
    }
    let imageUrl = '';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }
    await Request.create({
      id: 'rep_' + uuidv4().slice(0, 8),
      type: 'repair',
      name: name.trim(), phone: phone.trim(),
      device, problem: problem.trim(),
      imageUrl,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, imageUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit repair request' });
  }
});

app.post('/api/visitors', async (req, res) => {
  try {
    const { path: visitPath, page } = req.body;
    await Visitor.create({
      id: 'vis_' + uuidv4().slice(0, 8),
      path: visitPath,
      page,
      referrer: req.headers.referer || '',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: 'main' });
    res.json(settings || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.get('/api/paystack/config', (req, res) => {
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || '';
  res.json({ publicKey });
});

// ════════════════════════════════════════════════════════
// PAYSTACK ROUTES
// ════════════════════════════════════════════════════════

app.post('/api/paystack/initialize', async (req, res) => {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: 'Paystack secret key not configured' });

    const { email, amount, productId, productName, orderType, items, metadata } = req.body;
    if (!email || !amount) return res.status(400).json({ error: 'Email and amount required' });

    const reference = 'HOK_' + crypto.randomBytes(8).toString('hex').toUpperCase();

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(amount) * 100),
        reference,
        currency: 'NGN',
        metadata: {
          productId, productName, orderType,
          items: items || [],
          ...metadata
        }
      })
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return res.status(400).json({ error: paystackData.message || 'Paystack initialization failed' });
    }

    await Order.create({
      id: 'ord_' + uuidv4().slice(0, 8),
      reference,
      email,
      amount: Number(amount),
      productId, productName, orderType,
      items: items || [],
      metadata: metadata || {},
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    res.json({
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference
    });
  } catch (err) {
    console.error('Paystack init error:', err);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

app.get('/api/paystack/verify/:reference', async (req, res) => {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: 'Paystack secret key not configured' });

    const { reference } = req.params;
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status || paystackData.data.status !== 'success') {
      return res.status(400).json({ error: 'Payment verification failed', details: paystackData });
    }

    await Order.findOneAndUpdate(
      { reference },
      { status: 'success', paidAt: new Date().toISOString() }
    );

    res.json({
      status: 'success',
      reference: paystackData.data.reference,
      amount: paystackData.data.amount,
      customer: paystackData.data.customer,
      metadata: paystackData.data.metadata
    });
  } catch (err) {
    console.error('Paystack verify error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

app.post('/api/paystack/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }
    const event = JSON.parse(req.body);
    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      await Order.findOneAndUpdate(
        { reference },
        { status: 'success', paidAt: new Date().toISOString() }
      );
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

// ════════════════════════════════════════════════════════
// ADMIN AUTH
// ════════════════════════════════════════════════════════

app.post('/api/adminlogin', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({});
    if (!admin || username !== admin.username) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.isAdmin = true;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/adminlogout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admincheck', requireAuth, (req, res) => {
  res.json({ authenticated: true });
});

// ════════════════════════════════════════════════════════
// ADMIN STATS
// ════════════════════════════════════════════════════════

app.get('/api/adminstats', requireAuth, async (req, res) => {
  try {
    const [totalProducts, inStock, limitedStock, outOfStock,
      pendingReviews, approvedReviews, totalEnquiries,
      notifyRequests, totalOrders, totalRequests] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ stock: 'In Stock' }),
      Product.countDocuments({ stock: 'Limited Stock' }),
      Product.countDocuments({ stock: 'Out of Stock' }),
      Review.countDocuments({ status: 'pending' }),
      Review.countDocuments({ status: 'approved' }),
      Enquiry.countDocuments(),
      Notify.countDocuments(),
      Order.countDocuments({ status: 'success' }),
      Request.countDocuments({ status: 'pending' })
    ]);

    const enquiries = await Enquiry.find({});
    const summary = {};
    enquiries.forEach(e => {
      if (!summary[e.productId]) summary[e.productId] = { productName: e.productName, totalClicks: 0 };
      summary[e.productId].totalClicks++;
    });
    const topProducts = Object.values(summary)
      .sort((a, b) => b.totalClicks - a.totalClicks).slice(0, 5);

    const visitors = await Visitor.find({});
    const pageSummary = {};
    visitors.forEach(v => {
      if (!pageSummary[v.path]) pageSummary[v.path] = { page: v.page, visits: 0 };
      pageSummary[v.path].visits++;
    });
    const topPages = Object.values(pageSummary)
      .sort((a, b) => b.visits - a.visits).slice(0, 5);

    res.json({
      totalProducts, inStock, limitedStock, outOfStock,
      pendingReviews, approvedReviews, totalEnquiries,
      notifyRequests, totalOrders, totalRequests,
      topProducts, topPages
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ════════════════════════════════════════════════════════
// ADMIN PRODUCTS
// ════════════════════════════════════════════════════════

app.get('/api/adminproducts', requireAuth, async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/adminproducts', requireAuth, async (req, res) => {
  try {
    const { brand, category, name, price, image, images, specs, warranty, stock, badge, featured, newArrival } = req.body;
    if (!brand || !name || !price || !category) {
      return res.status(400).json({ error: 'Brand, name, price and category required' });
    }
    const product = await Product.create({
      id: 'prod_' + uuidv4().slice(0, 8),
      brand: brand.trim(), category,
      name: name.trim(),
      price: parseInt(price),
      image: image || '',
      images: images || [],
      specs: typeof specs === 'object' ? specs : {},
      warranty: warranty || '6 Months',
      stock: stock || 'In Stock',
      badge: badge || null,
      featured: featured === true || featured === 'true',
      newArrival: newArrival === true || newArrival === 'true',
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

app.put('/api/adminproducts/:id', requireAuth, async (req, res) => {
  try {
    const update = {
      ...req.body,
      price: parseInt(req.body.price),
      featured: req.body.featured === true || req.body.featured === 'true',
      newArrival: req.body.newArrival === true || req.body.newArrival === 'true',
      updatedAt: new Date().toISOString()
    };
    const product = await Product.findOneAndUpdate({ id: req.params.id }, update, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/adminproducts/:id', requireAuth, async (req, res) => {
  try {
    await Product.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ════════════════════════════════════════════════════════
// ADMIN REVIEWS
// ════════════════════════════════════════════════════════

app.get('/api/adminreviews', requireAuth, async (req, res) => {
  try {
    const reviews = await Review.find({}).sort({ submittedAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.put('/api/adminreviews/:id', requireAuth, async (req, res) => {
  try {
    const { status, verifiedBuyer } = req.body;
    const update = { updatedAt: new Date().toISOString() };
    if (status) update.status = status;
    if (verifiedBuyer !== undefined) {
      update.verifiedBuyer = verifiedBuyer === true || verifiedBuyer === 'true';
    }
    const review = await Review.findOneAndUpdate({ id: req.params.id }, update, { new: true });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update review' });
  }
});

app.delete('/api/adminreviews/:id', requireAuth, async (req, res) => {
  try {
    await Review.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// ════════════════════════════════════════════════════════
// ADMIN ORDERS
// ════════════════════════════════════════════════════════

app.get('/api/admin/orders', requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ════════════════════════════════════════════════════════
// ADMIN ENQUIRIES
// ════════════════════════════════════════════════════════

app.get('/api/adminenquiries', requireAuth, async (req, res) => {
  try {
    const enquiries = await Enquiry.find({}).sort({ timestamp: -1 });
    const summary = {};
    enquiries.forEach(e => {
      if (!summary[e.productId]) {
        summary[e.productId] = {
          productId: e.productId,
          productName: e.productName,
          totalClicks: 0,
          lastEnquiry: e.timestamp
        };
      }
      summary[e.productId].totalClicks++;
      if (e.timestamp > summary[e.productId].lastEnquiry) {
        summary[e.productId].lastEnquiry = e.timestamp;
      }
    });
    const sorted = Object.values(summary).sort((a, b) => b.totalClicks - a.totalClicks);
    res.json({ raw: enquiries, summary: sorted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
});

// ════════════════════════════════════════════════════════
// ADMIN REQUESTS
// ════════════════════════════════════════════════════════

app.get('/api/admin/requests', requireAuth, async (req, res) => {
  try {
    const requests = await Request.find({}).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.put('/api/admin/requests/:id', requireAuth, async (req, res) => {
  try {
    const request = await Request.findOneAndUpdate(
      { id: req.params.id },
      { status: req.body.status },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: 'Request not found' });
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update request' });
  }
});

// ════════════════════════════════════════════════════════
// ADMIN SETTINGS
// ════════════════════════════════════════════════════════

app.get('/api/adminsettings', requireAuth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: 'main' });
    res.json(settings || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/adminsettings', requireAuth, async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { key: 'main' },
      { ...req.body, key: 'main' },
      { new: true, upsert: true }
    );
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', '404.html'));
});

// ── START ─────────────────────────────────────────────────
mongoose.connection.once('open', async () => {
  await seedData();
  app.listen(PORT, () => {
    console.log(`🚀 HOK Computers running → http://localhost:${PORT}`);
    console.log(`🔐 Admin panel → http://localhost:${PORT}/admin`);
  });
});