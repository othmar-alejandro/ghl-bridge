# 🚀 GHL Bridge - AI-Powered Digital Audit Automation

**Production-ready GoHighLevel webhook integration that automatically generates stunning, AI-powered competitive digital presence audits and delivers them via email.**

Built for **OAC Digital Innovations** to convert leads into paying clients with data-driven, pain-focused audit reports.

---

## 🎯 What This Does

When a lead fills out your "Free Digital Audit" form in GoHighLevel:

1. **GHL fires a webhook** → Your Railway server receives the lead data
2. **AI analyzes competitors** → Claude Haiku + Firecrawl research Google Maps rankings
3. **Generates stunning PDF** → 4-page dark-mode report with charts and competitive analysis
4. **Emails the audit** → Automatically sent via GHL with PDF attachment
5. **Updates pipeline** → Contact tagged as "audit-sent" in GHL

**Total automation time:** 2-5 minutes from form submission to inbox delivery ⚡

---

## ✨ Features

### 🤖 AI-Powered Competitive Analysis
- **Google Maps Dominance Research**: Finds top 3 local competitors and their review counts
- **Pain-Focused Insights**: Exposes exactly why leads are losing to competitors
- **Website Auditing**: SEO fundamentals, conversion killers, and opportunity cost analysis
- **Social Media Scoring**: Evaluates Facebook/Instagram presence and activity

### 🎨 Premium PDF Design
- **Dark Mode Glassmorphism**: Stunning gradients, shadows, and modern UI
- **Radar Chart Visualization**: You vs. Top Competitor across 5 key metrics (Chart.js)
- **Perfect 8.5×11" Layout**: Zero page-cut issues, optimized for email delivery
- **Branded Template**: Locked-in design prevents AI hallucinations

### 📧 Automated Email Delivery
- **GHL Native Integration**: Sends via GoHighLevel Conversations API
- **Base64 PDF Attachment**: Proper encoding for email deliverability
- **Size Monitoring**: Warns if PDF exceeds email limits
- **Professional Template**: Matching dark-mode email design with clear CTA

### ☁️ Production-Ready Infrastructure
- **Railway Optimized**: Auto-deploys from GitHub, runs 24/7
- **Async Processing**: Non-blocking webhook response (< 2s to GHL)
- **Error Handling**: Graceful failures, detailed logging
- **Zero Downtime**: Always-on server ready for instant webhook triggers

---

## 🏗️ Architecture

### The JSON-to-Template Pattern

**Why this architecture beats "AI generates HTML":**

Traditional approach = AI hallucinates entire HTML → broken CSS, missing sections, huge token costs ❌

**Our approach:**
```
┌─────────────────────────────────────────────────────────────┐
│  1. THE BRAIN (lib/auditPipeline.js)                        │
│  • Claude Haiku analyzes competitors via Firecrawl          │
│  • Returns PURE JSON (no HTML)                              │
│  • Pain-focused scoring logic                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. THE PRESENTATION (lib/htmlTemplate.js)                  │
│  • Hardcoded HTML/CSS template (Tailwind, Chart.js)         │
│  • Takes JSON data and populates template                   │
│  • Styled for perfect 8.5×11" PDF export                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. PDF CONVERSION (lib/pdfGenerator.js)                    │
│  • Playwright headless Chromium                             │
│  • Waits for Chart.js rendering                             │
│  • Optimized viewport & print media emulation               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. EMAIL DELIVERY (lib/ghlClient.js)                       │
│  • GHL Conversations API                                    │
│  • Base64 PDF attachment                                    │
│  • Professional branded email template                      │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Zero UI hallucinations (design is locked in)
- ✅ Token savings (AI doesn't waste tokens on CSS)
- ✅ Predictable output (safe for automation)
- ✅ Easy to update branding (edit template, not prompts)

---

## 📦 Installation & Local Setup

### Prerequisites
- Node.js >= 20.0.0
- API Keys:
  - [Anthropic Claude API](https://console.anthropic.com/)
  - [Firecrawl API](https://www.firecrawl.dev/)
  - [GoHighLevel Private Integration Token](https://highlevel.stoplight.io/docs/integrations/01-introduction)

### 1. Clone the Repository
```bash
git clone https://github.com/othmar-alejandro/ghl-bridge.git
cd ghl-bridge
```

### 2. Install Dependencies
```bash
npm install
```
This will also install Playwright and Chromium browser.

### 3. Configure Environment Variables
Create a `.env` file:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
FIRECRAWL_API_KEY=fc-...
GHL_PRIVATE_INTEGRATION_TOKEN=pit-...
GHL_LOCATION_ID=your-location-id
PORT=3000
```

### 4. Run Locally
```bash
npm start
```

Server will start on `http://localhost:3000`

### 5. Test the Audit Generator
```bash
node test-audit.js
```

This will:
- Generate a test audit for a sample business
- Save HTML to `test-output.html`
- Save PDF to `test-output.pdf`
- Automatically open the PDF

---

## 🚂 Railway Deployment (Production)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

### Step 2: Create Railway Project
1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select `othmar-alejandro/ghl-bridge`
4. Railway auto-detects Node.js and deploys

### Step 3: Add Environment Variables
In Railway dashboard → **Variables** tab:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
FIRECRAWL_API_KEY=fc-...
GHL_PRIVATE_INTEGRATION_TOKEN=pit-...
GHL_LOCATION_ID=your-location-id
```

*(Railway auto-injects `PORT`, so no need to set it)*

### Step 4: Generate Public Domain
Railway → **Settings** → **Networking** → **Generate Domain**

You'll get: `https://ghl-bridge-production.up.railway.app`

### Step 5: Verify Deployment
```bash
curl https://your-railway-url.up.railway.app/
```

Response:
```json
{
  "status": "OAC Audit Bridge is running",
  "timestamp": "2025-03-05T..."
}
```

---

## 🔗 GoHighLevel Webhook Configuration

### 1. Create Webhook in GHL
- Go to **Settings** → **Integrations** → **Webhooks**
- Click **Add Webhook**

### 2. Configure Webhook
- **Trigger Event**: `Form Submitted` (or `Contact Created`)
- **Webhook URL**: `https://your-railway-url.up.railway.app/webhook/new-lead`
- **Method**: POST
- **Content-Type**: application/json

### 3. Map Form Fields
Ensure your GHL form sends these fields:
```json
{
  "email": "lead@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "business_name": "ABC Painting",
  "city": "Miami, FL",
  "business_type": "painting contractors",
  "website_url": "https://example.com",
  "has_website": "Yes"
}
```

### 4. Test the Webhook
Submit a test form in GHL and check:
- ✅ Railway logs show webhook received
- ✅ Audit generation starts
- ✅ PDF sent to lead's email
- ✅ Contact tagged as "audit-sent"

---

## 📊 Project Structure

```
ghl-bridge/
├── lib/
│   ├── auditPipeline.js      # AI analysis logic (Claude + Firecrawl)
│   ├── htmlTemplate.js        # Hardcoded PDF template (dark mode)
│   ├── pdfGenerator.js        # Playwright PDF conversion
│   └── ghlClient.js           # GHL API client (contacts, email)
├── server.js                  # Express webhook server
├── test-audit.js              # Local testing script
├── package.json               # Dependencies & scripts
├── .env.example               # Environment variables template
├── .gitignore                 # Excludes .env, node_modules, PDFs
└── README.md                  # This file
```

---

## 🔌 API Endpoints

### `GET /`
**Health check endpoint**

**Response:**
```json
{
  "status": "OAC Audit Bridge is running",
  "timestamp": "2025-03-05T12:34:56.789Z"
}
```

### `POST /webhook/new-lead`
**GHL webhook endpoint for form submissions**

**Request Body:**
```json
{
  "email": "lead@example.com",
  "business_name": "ABC Company",
  "first_name": "John",
  "last_name": "Doe",
  "city": "Miami, FL",
  "business_type": "home services",
  "website_url": "https://example.com",
  "has_website": "Yes"
}
```

**Response (immediate):**
```json
{
  "received": true,
  "message": "Audit pipeline started"
}
```

**Process (async):**
1. Creates/finds contact in GHL
2. Runs AI competitive analysis
3. Generates PDF report
4. Sends email via GHL
5. Tags contact as "audit-sent"

---

## 🧪 Testing

### Local Test (No GHL API Calls)
```bash
node test-audit.js
```
Generates PDF locally without hitting GHL API.

### Full Integration Test
Update `test-audit.js` with a real GHL contact ID:
```javascript
contact_id: 'your-real-contact-id', // Remove 'TEST_SKIP_GHL'
```

Run:
```bash
node test-audit.js
```

This will send a real audit email via GHL.

### Manual Webhook Test
```bash
curl -X POST https://your-railway-url.up.railway.app/webhook/new-lead \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "business_name": "Test Business",
    "first_name": "John",
    "last_name": "Doe",
    "city": "Miami, FL",
    "business_type": "painting contractors",
    "website_url": "https://example.com",
    "has_website": "Yes"
  }'
```

---

## 📈 Monitoring & Logs

### Railway Dashboard
- **Deployments** → View real-time logs
- **Metrics** → Monitor CPU/memory usage
- **Variables** → Manage environment variables

### Log Format
```
[Server] OAC GHL Bridge running on port 3000
[Webhook] New lead received: ABC Painting
[Pipeline] Starting audit for: ABC Painting
[Pipeline] Iteration 1...
  🔧 search_web
  🔧 scrape_url
[Pipeline] Compiling HTML report...
[Pipeline] Generating PDF...
[PDF] ✅ Generated PDF for "ABC Painting" — 487.3 KB
[Pipeline] PDF size: 0.48 MB
[GHL] Attaching PDF (0.48 MB) to email...
[GHL] ✅ Audit email sent to lead@example.com with 0.48 MB PDF attachment
[GHL] Added tag "audit-sent" to contact abc123
[Pipeline] ✅ Complete for ABC Painting
```

---

## 💰 Cost Breakdown

### Per Audit Estimate
- **Claude Haiku API**: ~$0.01-0.03
- **Firecrawl API**: ~$0.05-0.15 (depends on searches)
- **Railway Compute**: ~$0.001
- **Total per audit**: ~$0.06-0.19

### Monthly Infrastructure
- **Railway**: ~$10-20/month (continuous uptime)
- **GHL**: (your existing plan)
- **Anthropic**: Pay-per-use
- **Firecrawl**: Check your plan limits

---

## 🔐 Security Best Practices

✅ **API Keys**: Never commit `.env` to git (already in `.gitignore`)
✅ **Railway Variables**: Set secrets in Railway dashboard, not in code
✅ **Webhook Validation**: Consider adding GHL signature verification
✅ **Rate Limiting**: Monitor for abuse (Railway provides DDoS protection)
✅ **Error Logging**: Sensitive data excluded from logs

---

## 🛠️ Troubleshooting

### PDF Not Generating
- Check Railway logs for Playwright errors
- Ensure `playwright` package installed correctly
- Verify Chromium browser was downloaded

### Email Not Sending
- Verify `GHL_PRIVATE_INTEGRATION_TOKEN` is correct
- Check GHL API rate limits
- Ensure contact exists in GHL before sending

### Webhook Not Triggering
- Test health endpoint: `curl https://your-url.up.railway.app/`
- Verify webhook URL in GHL settings
- Check Railway deployment status

### PDF Too Large for Email
- Current design: ~300-600 KB (safe)
- If > 2MB: Check for embedded images
- Consider hosting PDF on cloud storage + sending link

---

## 📝 Customization Guide

### Update Branding
Edit `lib/htmlTemplate.js`:
- Logo URL (line 263, 284, etc.)
- Color scheme (search for `#38bdf8`, `#ef4444`, etc.)
- Phone number (line 384, 387)
- Email signature (line 70-73)

### Modify AI Prompt
Edit `lib/auditPipeline.js`:
- `buildSystemPrompt()` function (line 62-213)
- Adjust scoring rules (lines 106-117)
- Customize competitor search query (line 84)

### Change PDF Layout
Edit `lib/htmlTemplate.js`:
- Adjust `.pdf-page` dimensions (line 76-85)
- Modify grid layouts (line 165-166)
- Update Chart.js configuration (line 399-494)

---

## 📄 License

Proprietary - OAC Digital Innovations
© 2025 Othmar Casilla

---

## 🤝 Support

**Issues or Questions?**
- Email: ocasilla@oacdigital.biz
- Phone: 786-340-1053

**Built with:**
- Node.js + Express
- Claude Haiku (Anthropic AI)
- Firecrawl (web scraping)
- Playwright (PDF generation)
- Chart.js (data visualization)
- Railway (hosting)
- GoHighLevel (CRM integration)

---

**🚀 Ready to convert leads into clients with AI-powered audits!**
