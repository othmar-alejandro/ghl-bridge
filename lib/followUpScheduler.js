/**
 * Follow-up email scheduler for the Free Audit pipeline.
 *
 * Strategy: GHL contacts are the source of truth — no external database needed.
 * State is tracked entirely via GHL tags:
 *   audit-sent          → audit was delivered (set by the bridge)
 *   follow-up-1-sent    → Day 1 email sent
 *   follow-up-2-sent    → Day 3 email sent
 *   follow-up-3-sent    → Day 7 email sent
 *   follow-up-4-sent    → Day 14 email sent
 *   follow-up-complete  → all 4 emails done
 *
 * The contact's custom field "contact.audit_sent_at" stores the ISO timestamp
 * of when the audit was delivered. Used to calculate elapsed days.
 *
 * Cron runs every 30 minutes. Processes at most 100 active leads per cycle.
 */

const cron = require('node-cron');
const axios = require('axios');

const GHL_BASE = 'https://services.leadconnectorhq.com';
const LOCATION_ID = process.env.GHL_LOCATION_ID;

function headers() {
    return {
        Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
    };
}

// ─── Follow-up sequence definition ───────────────────────────────────────────
const FOLLOW_UPS = [
    {
        doneTag:   'follow-up-1-sent',
        delayDays: 1,
        subject:   'Hey {{first_name}} — did you get a chance to look at your audit?',
        html: (lead) => `
        <div style="font-family:Arial,sans-serif;background:#080d1a;color:#f1f5f9;padding:32px;border-radius:12px;max-width:600px">
          <img src="https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png" alt="OAC" style="height:50px;margin-bottom:24px"/>
          <h2 style="color:#38bdf8">Hey ${lead.firstName || lead.first_name}, did you get a chance to look at your audit?</h2>
          <p>Yesterday I sent over your <strong>free Digital Presence Audit for ${lead.companyName || lead.business_name}</strong>.</p>
          <p>Most business owners are shocked when they see it — especially the competitor section showing exactly how many reviews and how much visibility they're missing.</p>
          <p style="color:#fbbf24;font-weight:bold">The #1 thing holding local businesses back: competitors are getting 3–5× more Google reviews — and Google ranks accordingly.</p>
          <p>I have 15 minutes blocked off this week to walk you through your report and show you the one change that moves the needle fastest.</p>
          <a href="tel:7863401053" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:20px 0;font-size:16px">📞 Grab a Quick 15-Min Call</a>
          <p style="margin-top:28px;font-size:15px"><strong>Othmar Casilla</strong><br>OAC Digital Innovations<br>📞 786-340-1053 | <a href="mailto:ocasilla@oacdigital.biz" style="color:#38bdf8;text-decoration:none">ocasilla@oacdigital.biz</a></p>
        </div>`
    },
    {
        doneTag:   'follow-up-2-sent',
        delayDays: 3,
        subject:   '{{first_name}}, here\'s what your competitors are taking from you every month',
        html: (lead) => `
        <div style="font-family:Arial,sans-serif;background:#080d1a;color:#f1f5f9;padding:32px;border-radius:12px;max-width:600px">
          <img src="https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png" alt="OAC" style="height:50px;margin-bottom:24px"/>
          <h2 style="color:#ef4444">${lead.firstName || lead.first_name}, here's what your competitors are taking from you every month</h2>
          <p>I reviewed your audit again and did the math.</p>
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(239,68,68,0.4);border-radius:12px;padding:20px;margin:20px 0">
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">ESTIMATED MONTHLY REVENUE LEAKING TO COMPETITORS</p>
            <p style="margin:0;font-size:32px;font-weight:bold;color:#ef4444">$3,000 – $8,000</p>
            <p style="margin:8px 0 0;font-size:13px;color:#94a3b8">Based on your review count vs. local market average and typical job value</p>
          </div>
          <p>The good news — this is fixable. Most of it within 30 days.</p>
          <p style="color:#38bdf8;font-weight:bold">I've helped businesses in your exact situation double their inbound calls in 60 days. Let me show you how.</p>
          <a href="tel:7863401053" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:20px 0;font-size:16px">📞 Let's Talk — 786-340-1053</a>
          <p style="margin-top:28px;font-size:15px"><strong>Othmar Casilla</strong><br>OAC Digital Innovations<br>📞 786-340-1053 | <a href="mailto:ocasilla@oacdigital.biz" style="color:#38bdf8;text-decoration:none">ocasilla@oacdigital.biz</a></p>
        </div>`
    },
    {
        doneTag:   'follow-up-3-sent',
        delayDays: 7,
        subject:   '{{first_name}}, a quick story about a contractor just like you',
        html: (lead) => `
        <div style="font-family:Arial,sans-serif;background:#080d1a;color:#f1f5f9;padding:32px;border-radius:12px;max-width:600px">
          <img src="https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png" alt="OAC" style="height:50px;margin-bottom:24px"/>
          <h2 style="color:#38bdf8">${lead.firstName || lead.first_name}, a quick story about a contractor just like you</h2>
          <p>A few months ago I worked with a painting contractor in South Florida. Same situation — solid work, great reputation, but practically invisible on Google.</p>
          <div style="background:rgba(255,255,255,0.05);border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0">
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">BEFORE:</p>
            <p style="margin:0;color:#ef4444">❌ 9 Google reviews &nbsp;|&nbsp; Position #8 on Maps &nbsp;|&nbsp; 2–3 calls/month</p>
          </div>
          <div style="background:rgba(255,255,255,0.05);border-left:4px solid #22c55e;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0">
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">60 DAYS LATER:</p>
            <p style="margin:0;color:#22c55e">✅ 47 Google reviews &nbsp;|&nbsp; Position #2 on Maps &nbsp;|&nbsp; 12–15 calls/month</p>
          </div>
          <p>No paid ads. No tricks. Just the foundational work your audit flagged as missing.</p>
          <p style="color:#38bdf8;font-weight:bold">The window to get ahead before your competitors do this is right now.</p>
          <a href="tel:7863401053" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:20px 0;font-size:16px">📞 Book Your Free Strategy Call</a>
          <p style="margin-top:28px;font-size:15px"><strong>Othmar Casilla</strong><br>OAC Digital Innovations<br>📞 786-340-1053 | <a href="mailto:ocasilla@oacdigital.biz" style="color:#38bdf8;text-decoration:none">ocasilla@oacdigital.biz</a></p>
        </div>`
    },
    {
        doneTag:   'follow-up-4-sent',
        delayDays: 14,
        subject:   '{{first_name}}, I\'ll keep this short',
        html: (lead) => `
        <div style="font-family:Arial,sans-serif;background:#080d1a;color:#f1f5f9;padding:32px;border-radius:12px;max-width:600px">
          <img src="https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png" alt="OAC" style="height:50px;margin-bottom:24px"/>
          <h2 style="color:#fbbf24">${lead.firstName || lead.first_name}, I'll keep this short</h2>
          <p>I've reached out a few times since your audit and haven't heard back — totally fine, I know you're running a business.</p>
          <p>I'm going to close out your file after this, but I wanted to give you one last shot because your situation is genuinely fixable fast.</p>
          <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.3);border-radius:12px;padding:20px;margin:20px 0">
            <p style="margin:0;font-size:15px">Your audit showed your top competitor has roughly <strong style="color:#fbbf24">5× more reviews</strong> than you. Every week that passes, that gap gets wider — not smaller.</p>
          </div>
          <p>If you're ready to flip the script, I have one opening this week for a free 15-min call. No pitch, no pressure — just a clear plan for what to fix first.</p>
          <a href="tel:7863401053" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:20px 0;font-size:16px">📞 One Last Shot — 786-340-1053</a>
          <p style="margin-top:28px;font-size:15px"><strong>Othmar Casilla</strong><br>OAC Digital Innovations<br>📞 786-340-1053 | <a href="mailto:ocasilla@oacdigital.biz" style="color:#38bdf8;text-decoration:none">ocasilla@oacdigital.biz</a></p>
        </div>`
    },
];

// ─── GHL helpers ──────────────────────────────────────────────────────────────
async function getAuditLeads() {
    try {
        const res = await axios.post(`${GHL_BASE}/contacts/search`, {
            locationId: LOCATION_ID,
            filters: [{ field: 'tags', operator: 'contains', value: 'audit-sent' }],
            pageLimit: 100,
        }, { headers: headers() });
        return res.data?.contacts || [];
    } catch (err) {
        console.error('[Scheduler] getAuditLeads error:', err.response?.data || err.message);
        return [];
    }
}

async function addTag(contactId, tag) {
    await axios.post(`${GHL_BASE}/contacts/${contactId}/tags`, { tags: [tag] }, { headers: headers() });
}

async function sendFollowUp(contact, followUp) {
    const lead = {
        firstName:   contact.firstName,
        first_name:  contact.firstName,
        companyName: contact.companyName,
        business_name: contact.companyName,
    };

    const subject = followUp.subject
        .replace('{{first_name}}', contact.firstName || 'there');

    await axios.post(`${GHL_BASE}/conversations/messages`, {
        type: 'Email',
        contactId: contact.id,
        subject,
        html: followUp.html(lead),
    }, { headers: headers() });

    console.log(`[Scheduler] ✅ ${followUp.doneTag} sent to ${contact.email}`);
}

// ─── Core processing logic ────────────────────────────────────────────────────
async function processFollowUps() {
    const contacts = await getAuditLeads();
    if (contacts.length === 0) return;

    console.log(`[Scheduler] Processing ${contacts.length} audit lead(s)...`);

    for (const contact of contacts) {
        // Skip if all follow-ups already done
        if (contact.tags?.includes('follow-up-complete')) continue;

        // Get audit sent date from custom field
        const auditSentAt = contact.customFields?.find(
            f => f.key === 'contact.audit_sent_at'
        )?.value;

        if (!auditSentAt) continue;

        const sentDate = new Date(auditSentAt);
        const now = new Date();
        const elapsedDays = (now - sentDate) / (1000 * 60 * 60 * 24);

        let allDone = true;
        for (const followUp of FOLLOW_UPS) {
            if (contact.tags?.includes(followUp.doneTag)) continue;
            allDone = false;

            if (elapsedDays >= followUp.delayDays) {
                try {
                    await sendFollowUp(contact, followUp);
                    await addTag(contact.id, followUp.doneTag);
                    // Small pause between sends to respect rate limits
                    await new Promise(r => setTimeout(r, 500));
                } catch (err) {
                    console.error(`[Scheduler] Failed ${followUp.doneTag} for ${contact.email}:`, err.response?.data || err.message);
                }
                break; // One follow-up per cycle per contact — prevents flooding
            }
        }

        // Mark complete if all 4 are sent
        if (allDone || FOLLOW_UPS.every(f => contact.tags?.includes(f.doneTag))) {
            await addTag(contact.id, 'follow-up-complete').catch(() => {});
        }
    }
}

// ─── Start scheduler ──────────────────────────────────────────────────────────
function startFollowUpScheduler() {
    console.log('[Scheduler] Follow-up scheduler started — runs every 30 minutes');

    // Run every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        console.log('[Scheduler] Running follow-up check...');
        try {
            await processFollowUps();
        } catch (err) {
            console.error('[Scheduler] Unexpected error:', err.message);
        }
    });

    // Also run once on startup after a 10-second delay (lets server fully initialize)
    setTimeout(async () => {
        console.log('[Scheduler] Running initial follow-up check...');
        try {
            await processFollowUps();
        } catch (err) {
            console.error('[Scheduler] Startup check error:', err.message);
        }
    }, 10000);
}

module.exports = { startFollowUpScheduler };
