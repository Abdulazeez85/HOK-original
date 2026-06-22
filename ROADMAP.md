# HOK Computers — Setup & Deployment Roadmap
## Complete Step-by-Step Guide for VS Code

---

## PHASE 1 — LOCAL SETUP (Do This First)

### Step 1 — Install Prerequisites

Make sure you have these installed on your machine before anything else.

**Node.js** (version 18 or higher)
- Go to https://nodejs.org
- Download the LTS version
- Install it and restart your terminal
- Verify: open terminal and type `node -v` — you should see a version number

**VS Code**
- Go to https://code.visualstudio.com
- Install it if you haven't already

**Recommended VS Code Extensions**
- Thunder Client (for testing API routes)
- Prettier (code formatting)
- Live Server (optional)

---

### Step 2 — Open the Project

1. Unzip the `hok-computers-v2.zip` file
2. Open VS Code
3. Go to **File → Open Folder**
4. Select the `hok-v2` folder
5. Open the integrated terminal: **Terminal → New Terminal**

---

### Step 3 — Install Dependencies

In the terminal, run:

```bash
npm install
```

This reads `package.json` and installs all required packages into a `node_modules` folder.
It will take about 30–60 seconds. You will see a lot of output — that is normal.

---

### Step 4 — Configure Environment Variables

Open the `.env` file in the root of the project.
You will see:

```
PORT=3000
SESSION_SECRET=hok_super_secret_key_change_this_in_production
ADMIN_USERNAME=hokadmin
ADMIN_PASSWORD=hokcomputers2025
```

**Change these before going live:**
- `SESSION_SECRET` → any long random string, e.g. `hok_kwara_2025_xk9p2mq7zt`
- `ADMIN_USERNAME` → something Adeyemi will remember
- `ADMIN_PASSWORD` → a strong password, not the default

Do NOT share the `.env` file with anyone. It is already in `.gitignore`.

---

### Step 5 — Start the Server

In the terminal:

```bash
npm run dev
```

You should see:
```
✅ Admin credentials created.
🚀 HOK Computers running → http://localhost:3000
🔐 Admin panel → http://localhost:3000/admin
```

If you see an error about a port being in use, change `PORT=3000` to `PORT=3001` in `.env` and try again.

---

### Step 6 — Test Everything Locally

Open your browser and visit these URLs one by one:

**Public Pages**
```
http://localhost:3000/           → Homepage
http://localhost:3000/products   → Products page
http://localhost:3000/reviews    → Reviews page
http://localhost:3000/about      → About page
```

**Admin Panel**
```
http://localhost:3000/admin          → Login page
http://localhost:3000/admin/dashboard
http://localhost:3000/admin/products
http://localhost:3000/admin/reviews
http://localhost:3000/admin/enquiries
http://localhost:3000/admin/settings
```

Login with:
- Username: `hokadmin`
- Password: `hokcomputers2025`

---

### Step 7 — Test All API Routes (Thunder Client)

Install Thunder Client extension in VS Code.
Click the Thunder Client icon in the sidebar.
Test these routes in order:

```
GET  http://localhost:3000/api/products
GET  http://localhost:3000/api/products/featured
GET  http://localhost:3000/api/products/new-arrivals
GET  http://localhost:3000/api/reviews/approved
GET  http://localhost:3000/api/reviews/top
GET  http://localhost:3000/api/settings
```

Then test admin routes — first login:
```
POST http://localhost:3000/api/admin/login
Body (JSON): { "username": "hokadmin", "password": "hokcomputers2025" }
```

Then:
```
GET  http://localhost:3000/api/admin/stats
GET  http://localhost:3000/api/admin/products
GET  http://localhost:3000/api/admin/reviews
GET  http://localhost:3000/api/admin/enquiries
GET  http://localhost:3000/api/admin/settings
```

Every route should return clean JSON with no errors.

---

### Step 8 — Add Real Content

Before going live, do this in the admin panel:

1. Go to `http://localhost:3000/admin`
2. Login
3. Go to **Settings** → Update WhatsApp number, email, business hours
4. Go to **Products** → Delete the placeholder products → Add real HOK products with real images, real prices, real specs
5. Go to **Reviews** → The 3 sample reviews are already approved. You can delete them and add real ones later.

For product images:
- Use real photos from Adeyemi's phone or supplier
- Upload them to **Cloudinary** (free at cloudinary.com) → copy the image URL → paste in the image field
- OR use Unsplash URLs for now as placeholders

---

## PHASE 2 — DEPLOYMENT TO RAILWAY

### Why Railway and not Vercel?

Vercel is great for static sites and serverless functions but does NOT support persistent file storage. Every time you redeploy on Vercel, the `data/` folder resets — meaning all products and reviews get wiped. Railway runs a real Node.js server with persistent storage. It is the right tool for this project.

---

### Step 1 — Create Railway Account

1. Go to https://railway.app
2. Click **Start a New Project**
3. Sign up with GitHub (recommended) or email

---

### Step 2 — Push Project to GitHub First

You need the code on GitHub before Railway can deploy it.

In your terminal (inside the project folder):

```bash
git init
git add .
git commit -m "Initial HOK Computers build"
```

Then go to https://github.com/new
- Create a new repository called `hok-computers`
- Set it to **Private**
- Do NOT initialize with README

Then in your terminal:

```bash
git remote add origin https://github.com/YOURUSERNAME/hok-computers.git
git branch -M main
git push -u origin main
```

Replace `YOURUSERNAME` with your actual GitHub username.

---

### Step 3 — Deploy on Railway

1. Go to https://railway.app/dashboard
2. Click **New Project**
3. Choose **Deploy from GitHub repo**
4. Select your `hok-computers` repository
5. Railway will detect it is a Node.js project automatically

---

### Step 4 — Add Environment Variables on Railway

In your Railway project:
1. Click on the service
2. Go to **Variables** tab
3. Add each variable from your `.env` file:

```
PORT = 3000
SESSION_SECRET = your_secret_here
ADMIN_USERNAME = youradminname
ADMIN_PASSWORD = yourstrongpassword
```

**Important:** Do NOT push `.env` to GitHub. Railway reads these from its own Variables tab.

---

### Step 5 — Configure Start Command

Railway should auto-detect the start command from `package.json`.
If it does not, go to **Settings** on your Railway service and set:

```
Start Command: node server.js
```

---

### Step 6 — Get Your Railway URL

After deployment (takes 2–3 minutes):
1. Go to your Railway project
2. Click **Settings → Domains**
3. Click **Generate Domain**
4. You will get a URL like `hok-computers-production.up.railway.app`

Visit that URL — your site is live.

---

### Step 7 — Connect Custom Domain

Once Adeyemi renews his domain:

1. In Railway → **Settings → Domains → Custom Domain**
2. Type in the domain e.g. `hokcomputers.com`
3. Railway gives you DNS records to add

Then go to the domain registrar (Namecheap, GoDaddy, etc.):
1. Find DNS settings
2. Add the records Railway gave you:
   - **CNAME** record: `www` → `your-railway-domain.up.railway.app`
   - **A record**: `@` → Railway's IP (shown in their dashboard)

Wait 10–60 minutes for DNS to propagate.
SSL (https) is automatic — Railway handles it free.

---

## PHASE 3 — HANDING OVER TO ADEYEMI

### What to walk him through

Sit with him (or screen share) and show him:

**1. Admin Login**
URL: `https://yourdomain.com/admin`
Show him how to log in and where everything is.

**2. Adding a Product**
- Admin → Products → Add Product
- Fill in brand, name, price, image URL, specs
- Toggle Featured or New Arrival
- Click Save

**3. Approving Reviews**
- Admin → Reviews → Pending tab
- Read the review
- Click Approve or Reject
- Mark as Verified Buyer if you know the customer bought from HOK

**4. Checking Enquiries**
- Admin → Enquiries
- Shows which products people click Buy on most
- Use this to decide what to restock

**5. Updating Settings**
- Admin → Settings
- If WhatsApp number changes → update here → reflects everywhere on site immediately

**6. Changing Password (Important)**
Tell him to go to Settings → update password after handover.
Or you can update it manually in Railway's environment variables.

---

## PHASE 4 — ONGOING MAINTENANCE (Your ₦25,000/month)

### What the monthly retainer covers

Every month you should:

**Week 1**
- Check that the site is loading correctly
- Check Railway dashboard for any errors
- Check that WhatsApp links are working

**Week 2**
- Add any new products Adeyemi sends you
- Update prices if he tells you to
- Clear out old out-of-stock products or mark them accordingly

**Week 3**
- Check enquiries dashboard with him → recommend what to restock based on demand data
- Make any copy or design tweaks he requests

**Week 4**
- Monthly report: total products, approved reviews, total enquiry clicks, top 3 most demanded products
- Send via WhatsApp

---

## FILE STRUCTURE REFERENCE

```
hok-v2/
│
├── server.js              ← Express backend — all API routes
├── package.json           ← Dependencies and scripts
├── .env                   ← Secrets — never push to GitHub
├── .gitignore             ← Excludes node_modules, .env, admin.json
│
├── data/                  ← All persistent data (JSON files)
│   ├── products.json      ← All product listings
│   ├── reviews.json       ← All customer reviews (pending + approved)
│   ├── enquiries.json     ← WhatsApp click log
│   ├── notify.json        ← Back-in-stock notification requests
│   ├── settings.json      ← Business info, WhatsApp number, delivery
│   └── admin.json         ← Hashed admin credentials (auto-generated)
│
├── public/                ← All public-facing pages
│   ├── index.html         ← Homepage
│   ├── products.html      ← Full products catalog
│   ├── reviews.html       ← Reviews page + submission form
│   ├── about.html         ← About HOK Computers
│   ├── 404.html           ← Not found page
│   ├── styles.css         ← All public styles
│   └── app.js             ← All shared frontend logic
│
└── admin/                 ← Admin panel (password protected)
    ├── login.html         ← Admin login
    ├── dashboard.html     ← Stats overview
    ├── products.html      ← Add/edit/delete products
    ├── reviews.html       ← Approve/reject reviews
    ├── enquiries.html     ← WhatsApp click analytics
    ├── settings.html      ← Update business info
    ├── admin.css          ← Admin panel styles
    └── admin.js           ← Shared admin JS (auth check, sidebar, toast)
```

---

## API ROUTES REFERENCE

```
PUBLIC
GET  /api/products              All products
GET  /api/products/featured     Featured products only
GET  /api/products/new-arrivals New arrivals only
GET  /api/products/:id          Single product by ID
GET  /api/reviews/approved      Approved reviews
GET  /api/reviews/top           Top 3 most recent approved
GET  /api/settings              Business settings (public)
POST /api/reviews               Submit a customer review
POST /api/enquiries             Log WhatsApp click (silent)
POST /api/notify                Register back-in-stock notification

ADMIN (requires login session)
POST   /api/admin/login
POST   /api/admin/logout
GET    /api/admin/check         Check if session is active
GET    /api/admin/stats         Dashboard statistics
GET    /api/admin/products      All products
POST   /api/admin/products      Add product
PUT    /api/admin/products/:id  Update product
DELETE /api/admin/products/:id  Delete product
GET    /api/admin/reviews       All reviews
PUT    /api/admin/reviews/:id   Approve/reject/verify review
DELETE /api/admin/reviews/:id   Delete review
GET    /api/admin/enquiries     Enquiry log + summary
GET    /api/admin/settings      Get settings
PUT    /api/admin/settings      Update settings
```

---

## TROUBLESHOOTING

**Server won't start**
- Make sure Node.js is installed: `node -v`
- Make sure you ran `npm install`
- Check if port 3000 is in use, change PORT in `.env`

**Admin login not working**
- Delete `data/admin.json` and restart server — it will regenerate with your `.env` credentials
- Make sure you are using the exact username/password from `.env`

**Products not showing on frontend**
- Open browser console (F12) and check for errors
- Make sure server is running
- Check that `data/products.json` has content

**Railway deployment failing**
- Check Railway logs in the dashboard
- Make sure all environment variables are set in Railway's Variables tab
- Make sure `node_modules` is in `.gitignore` and not pushed to GitHub

**Domain not connecting**
- DNS changes take up to 48 hours — wait and check again
- Verify you added the correct records from Railway
- Use https://dnschecker.org to check propagation status

---

## DEFAULTS TO CHANGE BEFORE GOING LIVE

| Item | Where | Current Default |
|------|--------|----------------|
| WhatsApp Number | `.env` + Admin Settings | 2348000000000 |
| Admin Username | `.env` | hokadmin |
| Admin Password | `.env` | hokcomputers2025 |
| Session Secret | `.env` | change_this_in_production |
| Business Email | Admin Settings | info@hokcomputers.com |
| Product Images | Admin Products | Unsplash placeholders |
| Social Links | `public/app.js` footer | # placeholder |
| Google Maps Link | `public/index.html` | Generic Ilorin search |
| Founder Photo | `public/about.html` | Emoji placeholder |

---

Built by The Quantum Developer
HOK Computers — Ilorin, Kwara State, Nigeria
