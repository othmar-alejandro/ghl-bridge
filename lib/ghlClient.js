const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

const GHL_BASE = 'https://services.leadconnectorhq.com';
const LOCATION_ID = process.env.GHL_LOCATION_ID;

// ─── Free Audit Pipeline — Marketing Pipeline stages ─────────────────────────
// Using the existing "Marketing Pipeline" (QMORQSc3723navbfmKOH).
// Stage names map naturally to the audit funnel.
const PIPELINE_ID  = 'QMORQSc3723navbfmKOH';
const STAGES = {
    NEW_LEAD:    '2c52f1d0-ab0a-4c56-8a81-fc7d3cb4913f',  // form submitted
    HOT_LEAD:    '55f6a741-a949-42b3-81e6-e813f2829dd3',  // audit sent
    NEW_BOOKING: '02713bc4-1651-4d69-9324-b03918063942',  // call booked
    SALE:        '884b68df-7f98-4a4d-9ebd-706953637a25',  // client won
};

// Temp dir for fallback PDF hosting — created once at startup
const AUDIT_DIR = path.join(os.tmpdir(), 'oac-audits');
fs.mkdirSync(AUDIT_DIR, { recursive: true });

// Build headers fresh each call so env vars are always current
function headers(extra = {}) {
    return {
        Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
        ...extra
    };
}

// ─── Create contact in GHL ────────────────────────────────────────────────────
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
        }, { headers: headers() });

        return res.data.contact.id;
    } catch (err) {
        console.error('[GHL] createContact error:', err.response?.data || err.message);
        throw err;
    }
}

// ─── Upload PDF to GHL — returns hosted URL ───────────────────────────────────
async function uploadPdf({ contactId, pdfBuffer, fileName }) {
    const form = new FormData();
    form.append('fileAttachment', new Blob([pdfBuffer], { type: 'application/pdf' }), fileName);
    form.append('contactId', contactId);

    const res = await axios.post(`${GHL_BASE}/conversations/messages/upload`, form, {
        headers: {
            Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
            Version: '2021-07-28'
            // No Content-Type — axios sets multipart boundary automatically
        }
    });

    const url = res.data?.uploadedFiles?.[0] || res.data?.urls?.[0] || res.data?.[0];
    if (!url) throw new Error('No URL in GHL upload response: ' + JSON.stringify(res.data));

    console.log(`[GHL] ✅ PDF uploaded — ${url}`);
    return url;
}

// ─── Fallback: save PDF to Railway's temp disk and return a download URL ──────
// Used when GHL upload fails. Railway's filesystem is ephemeral but files survive
// long enough for the lead to click the link (hours to days between restarts).
function hostPdfLocally(pdfBuffer, fileName) {
    // Sanitize filename to prevent any path traversal
    const safeName = path.basename(fileName).replace(/[^a-z0-9.\-]/gi, '-');
    fs.writeFileSync(path.join(AUDIT_DIR, safeName), pdfBuffer);

    const base = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${process.env.PORT || 3000}`;

    return `${base}/audits/${encodeURIComponent(safeName)}`;
}

// ─── Build email HTML ─────────────────────────────────────────────────────────
// downloadUrl is null when the PDF is sent as a GHL attachment.
// When set, a prominent download button replaces the "see attached" copy.
function buildEmailHtml(lead, downloadUrl) {
    const auditSection = downloadUrl
        ? `<p>Your <strong>free digital presence audit for ${lead.business_name}</strong> is ready. Click below to download it:</p>
           <a href="${downloadUrl}" style="display:inline-block; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0; font-size: 18px; box-shadow: 0 4px 12px rgba(14,165,233,0.4);">
             📄 Download Your Audit Report
           </a>`
        : `<p>Your <strong>free digital presence audit for ${lead.business_name}</strong> is attached to this email as a PDF.</p>`;

    return `
    <div style="font-family: Arial, sans-serif; background: #080d1a; color: #f1f5f9; padding: 32px; border-radius: 12px;">
      <img src="https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png"
           alt="OAC Digital Innovations" style="height: 50px; margin-bottom: 24px;" />

      <h2 style="color: #38bdf8; margin-bottom: 8px;">Your Free Digital Audit is Ready! 🎉</h2>

      <p>Hi ${lead.first_name},</p>

      ${auditSection}

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
    </div>`;
}

// ─── Send audit email — attachment with automatic fallback to download link ───
async function sendAuditEmail({ contactId, lead, pdfBuffer }) {
    const fileName = `${lead.business_name.replace(/[^a-z0-9]/gi, '-')}-digital-audit.pdf`;
    const pdfSizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);

    let attachmentUrl = null;
    let downloadUrl = null;

    // Try GHL upload first
    try {
        console.log(`[GHL] Uploading PDF (${pdfSizeMB} MB)...`);
        attachmentUrl = await uploadPdf({ contactId, pdfBuffer, fileName });
    } catch (uploadErr) {
        console.warn(`[GHL] Upload failed — falling back to hosted download link. Reason: ${uploadErr.message}`);
        downloadUrl = hostPdfLocally(pdfBuffer, fileName);
        console.log(`[GHL] PDF hosted locally at: ${downloadUrl}`);
    }

    const htmlBody = buildEmailHtml(lead, downloadUrl);
    const payload = {
        type: 'Email',
        contactId,
        subject: `📊 Your Free Digital Audit — ${lead.business_name}`,
        html: htmlBody,
    };
    if (attachmentUrl) payload.attachments = [attachmentUrl];

    try {
        await axios.post(`${GHL_BASE}/conversations/messages`, payload, { headers: headers() });
        console.log(`[GHL] ✅ Audit email sent to ${lead.email} — ${attachmentUrl ? 'PDF attached' : 'download link included'}`);
    } catch (err) {
        console.error('[GHL] sendAuditEmail error:', err.response?.data || err.message);
        throw err;
    }
}

// ─── Create opportunity at "New Lead" stage ───────────────────────────────────
// Called right after createContact so the lead appears in the pipeline immediately.
async function createOpportunity(contactId, businessName) {
    try {
        const res = await axios.post(`${GHL_BASE}/opportunities/`, {
            pipelineId: PIPELINE_ID,
            locationId: LOCATION_ID,
            name: `Free Audit — ${businessName}`,
            pipelineStageId: STAGES.NEW_LEAD,
            contactId,
            status: 'open'
        }, { headers: headers() });

        const oppId = res.data.opportunity?.id;
        console.log(`[GHL] ✅ Opportunity created at "New Lead" stage — ${oppId}`);
        return oppId;
    } catch (err) {
        console.error('[GHL] createOpportunity error:', err.response?.data || err.message);
        // Non-fatal — pipeline visibility nice-to-have, don't break the audit
    }
}

// ─── Advance opportunity to "Hot Lead" + stamp audit_sent_at ─────────────────
// Called after the audit email is successfully sent.
// Sets contact.audit_sent_at so the follow-up scheduler knows when to fire.
const AUDIT_SENT_AT_FIELD = 'vgjTAU201MIMQKByRzmV';  // custom field ID

async function advanceToAuditSent(contactId) {
    try {
        // Find open opportunity and move to Hot Lead
        const search = await axios.get(`${GHL_BASE}/opportunities/search`, {
            params: { location_id: LOCATION_ID, contact_id: contactId },
            headers: headers()
        });

        const opp = search.data?.opportunities?.[0];
        if (opp) {
            await axios.put(`${GHL_BASE}/opportunities/${opp.id}`, {
                pipelineStageId: STAGES.HOT_LEAD
            }, { headers: headers() });
        }

        // Stamp the delivery time + add trigger tag for the scheduler
        await axios.put(`${GHL_BASE}/contacts/${contactId}`, {
            customFields: [{ id: AUDIT_SENT_AT_FIELD, field_value: new Date().toISOString() }]
        }, { headers: headers() });

        await axios.post(`${GHL_BASE}/contacts/${contactId}/tags`, {
            tags: ['audit-sent']
        }, { headers: headers() });

        console.log(`[GHL] ✅ "Hot Lead" stage set — audit_sent_at stamped — audit-sent tag applied`);
    } catch (err) {
        console.error('[GHL] advanceToAuditSent error:', err.response?.data || err.message);
        // Non-fatal
    }
}

module.exports = { createContact, createOpportunity, uploadPdf, sendAuditEmail, advanceToAuditSent, AUDIT_DIR };
