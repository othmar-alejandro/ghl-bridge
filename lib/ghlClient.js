const axios = require('axios');

const GHL_BASE = 'https://services.leadconnectorhq.com';
const TOKEN = process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

const ghlHeaders = {
    Authorization: `Bearer ${TOKEN}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json'
};

// ─── Create or get contact in GHL ────────────────────────────────────────────
async function createContact(lead) {
    try {
        const res = await axios.post(`${GHL_BASE}/contacts/`, {
            locationId: LOCATION_ID,
            firstName: lead.first_name,
            lastName: lead.last_name,
            email: lead.email,
            phone: lead.phone || undefined,
            companyName: lead.business_name,
            city: lead.city,
            website: lead.website_url || undefined,
            tags: ['audit-requested', 'free-audit-lead'],
            source: 'OAC Free Audit Form'
        }, { headers: ghlHeaders });

        return res.data.contact.id;
    } catch (err) {
        console.error('[GHL] createContact error:', err.response?.data || err.message);
        throw err;
    }
}

// ─── Send audit delivery email with PDF attachment ────────────────────────────
async function sendAuditEmail({ contactId, lead, pdfBuffer }) {
    const fileName = `${lead.business_name.replace(/[^a-z0-9]/gi, '-')}-digital-audit.pdf`;
    const pdfSizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);

    // GHL conversations API — send email with attachment
    const htmlBody = `
    <div style="font-family: Arial, sans-serif; background: #080d1a; color: #f1f5f9; padding: 32px; border-radius: 12px;">
      <img src="https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png"
           alt="OAC Digital Innovations" style="height: 50px; margin-bottom: 24px;" />

      <h2 style="color: #38bdf8; margin-bottom: 8px;">Your Free Digital Audit is Ready! 🎉</h2>

      <p>Hi ${lead.first_name},</p>

      <p>Your <strong>free digital presence audit for ${lead.business_name}</strong> is attached to this email as a PDF.</p>

      <p>Inside you'll find:</p>
      <ul style="line-height: 1.8;">
        <li>✅ Your overall Digital Health Score (out of 100)</li>
        <li>✅ Google Business Profile competitive analysis</li>
        <li>✅ How your top 3 competitors are dominating Google Maps</li>
        <li>✅ Website & SEO audit (what's broken and why it's costing you leads)</li>
        <li>✅ Radar chart comparison: You vs. Top Competitor</li>
        <li>✅ A 3-phase action plan to fix everything</li>
      </ul>

      <p style="font-size: 16px; color: #38bdf8; font-weight: bold;">Got questions about your report? I'd love to walk you through it on a quick 15-minute call.</p>

      <a href="tel:7863401053" style="display:inline-block; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; font-size: 18px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);">
        📞 Call or Text: 786-340-1053
      </a>

      <p style="margin-top: 28px; font-size: 15px;">
        <strong>Othmar Casilla</strong><br>
        OAC Digital Innovations<br>
        📞 786-340-1053 | <a href="mailto:ocasilla@oacdigital.biz" style="color: #38bdf8; text-decoration: none;">ocasilla@oacdigital.biz</a>
      </p>

      <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 13px; color: #64748b;">
        <em>This audit was custom-generated using AI-powered competitive analysis. Your data was pulled from live Google Business Profile searches and public listings.</em>
      </p>
    </div>
  `;

    try {
        console.log(`[GHL] Attaching PDF (${pdfSizeMB} MB) to email...`);

        // GHL accepts attachments as base64-encoded data in the conversations API
        await axios.post(`${GHL_BASE}/conversations/messages`, {
            type: 'Email',
            contactId,
            subject: `📊 Your Free Digital Audit — ${lead.business_name}`,
            html: htmlBody,
            attachments: [{
                filename: fileName,
                data: pdfBuffer.toString('base64'),
                encoding: 'base64',
                contentType: 'application/pdf'
            }]
        }, { headers: ghlHeaders });

        console.log(`[GHL] ✅ Audit email sent to ${lead.email} with ${pdfSizeMB} MB PDF attachment`);
    } catch (err) {
        console.error('[GHL] sendAuditEmail error:', err.response?.data || err.message);

        // If attachment failed due to size, log specific guidance
        if (err.response?.status === 413 || err.message.includes('too large')) {
            console.error('[GHL] ❌ PDF attachment rejected — file too large for email delivery');
            console.error('[GHL] Consider: Upload to cloud storage and send download link instead');
        }

        throw err;
    }
}

// ─── Move contact to a pipeline stage ────────────────────────────────────────
async function moveToStage(contactId, stageName) {
    // Retrieve all opportunities for this contact
    try {
        const res = await axios.get(`${GHL_BASE}/opportunities/search`, {
            params: { location_id: LOCATION_ID, contact_id: contactId },
            headers: ghlHeaders
        });

        const opportunity = res.data?.opportunities?.[0];
        if (!opportunity) {
            console.log('[GHL] No opportunity found for contact — skipping stage move');
            return;
        }

        // Tag the contact with the new stage instead if pipeline ID is unknown
        await axios.post(`${GHL_BASE}/contacts/${contactId}/tags`, {
            tags: [stageName]
        }, { headers: ghlHeaders });

        console.log(`[GHL] Added tag "${stageName}" to contact ${contactId}`);
    } catch (err) {
        console.error('[GHL] moveToStage error:', err.response?.data || err.message);
        // Non-fatal — don't throw
    }
}

module.exports = { createContact, sendAuditEmail, moveToStage };
