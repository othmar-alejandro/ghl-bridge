require('dotenv').config();
const express = require('express');
const path = require('path');
const { runAuditPipeline } = require('./lib/auditPipeline');
const { AUDIT_DIR } = require('./lib/ghlClient');
const { startFollowUpScheduler } = require('./lib/followUpScheduler');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ─── GHL custom field ID → readable name map ──────────────────────────────────
// These IDs come from the GHL "Free Digital Audit Request" form submission payload.
const FIELD_ID_MAP = {
    'UrsAafPYTVMYgIdJH6Am': 'business_name',
    'ioYv8yKHbHq1jAA9k8jx': 'business_type',
    'JLB8fHTGhapezx1VzsYb': 'has_website',   // RADIO field (Yes/No)
    '6SEt8WBBK79XR3pAwc9r': 'has_website',   // TEXT duplicate
    '1mQz6f6e4C6RCNEKxEBt': 'website_url',
};

// Normalize GHL form submission payload into the flat lead object the pipeline expects.
// GHL sends custom fields by their ID inside body.others.
// Workflow custom webhooks send flat JSON with readable names — both are handled.
function normalizeLead(body) {
    const src = body.others || body;

    const lead = {
        contact_id:  body.contactId  || body.contact_id,
        email:       src.email       || body.email,
        first_name:  src.first_name  || src.firstName  || body.first_name,
        last_name:   src.last_name   || src.lastName   || body.last_name,
        city:        src.city        || body.city,
        // Accept readable names directly (workflow webhook format)
        business_name: src.business_name,
        business_type: src.business_type,
        has_website:   src.has_website,
        website_url:   src.website_url,
    };

    // Map field IDs → names (form submission format)
    for (const [id, name] of Object.entries(FIELD_ID_MAP)) {
        if (src[id] !== undefined && src[id] !== '') lead[name] = src[id];
    }

    return lead;
}

// ─── Health check ─────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ status: 'OAC Audit Bridge is running', timestamp: new Date().toISOString() });
});

// ─── Fallback PDF download route ───────────────────────────────
// Serves PDFs saved locally when GHL upload fails.
// path.basename prevents path traversal — only filenames allowed.
app.get('/audits/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(AUDIT_DIR, safeName);
    res.download(filePath, safeName, (err) => {
        if (err && !res.headersSent) res.status(404).json({ error: 'Audit not found' });
    });
});

// ─── GHL Webhook endpoint ──────────────────────────────────────
app.post('/webhook/new-lead', (req, res) => {
    const lead = normalizeLead(req.body);

    console.log('[Webhook] New lead received:', lead.business_name || 'Unknown');

    if (!lead.email || !lead.business_name) {
        console.warn('[Webhook] Missing required fields — skipping.', { email: lead.email, business_name: lead.business_name });
        return res.status(400).json({ error: 'Missing email or business_name' });
    }

    // Acknowledge immediately so GHL does not time out
    res.status(200).json({ received: true, message: 'Audit pipeline started' });

    runAuditPipeline(lead).catch((err) => {
        console.error('[Pipeline] Fatal error for lead:', lead.email, err.message);
    });
});

app.listen(PORT, () => {
    console.log(`[Server] OAC GHL Bridge running on port ${PORT}`);
    startFollowUpScheduler();
});
