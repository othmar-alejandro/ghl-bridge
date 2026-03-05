require('dotenv').config();
const express = require('express');
const { runAuditPipeline } = require('./lib/auditPipeline');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ─── Health check ────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ status: 'OAC Audit Bridge is running', timestamp: new Date().toISOString() });
});

// ─── GHL Webhook endpoint ─────────────────────────────────────
// GHL fires this when the "Free Digital Audit" form is submitted.
app.post('/webhook/new-lead', (req, res) => {
    const lead = req.body;

    console.log('[Webhook] New lead received:', lead?.business_name || 'Unknown');

    // Validate required fields
    if (!lead.email || !lead.business_name) {
        console.warn('[Webhook] Missing required fields — skipping.');
        return res.status(400).json({ error: 'Missing email or business_name' });
    }

    // Acknowledge immediately so GHL does not time out (2s limit)
    res.status(200).json({ received: true, message: 'Audit pipeline started' });

    // Run the full audit in the background (non-blocking)
    runAuditPipeline(lead).catch((err) => {
        console.error('[Pipeline] Fatal error for lead:', lead.email, err.message);
    });
});

app.listen(PORT, () => {
    console.log(`[Server] OAC GHL Bridge running on port ${PORT}`);
});
