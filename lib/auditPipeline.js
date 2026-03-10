const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const { generatePdf } = require('./pdfGenerator');
const { createContact, createOpportunity, sendAuditEmail, advanceToAuditSent } = require('./ghlClient');
const generateHtmlReport = require('./htmlTemplate');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tools (static — cached with the system prompt) ───────────────────────────
const TOOLS = [
  {
    name: 'search_web',
    description: 'Search the web for information via Firecrawl.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' }
      },
      required: ['query']
    }
  },
  {
    name: 'scrape_url',
    description: 'Scrape full text of a web page.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' }
      },
      required: ['url']
    },
    // Mark last tool for caching — static across every audit run
    cache_control: { type: 'ephemeral' }
  }
];

// ─── Static system prompt (cached across ALL leads on Anthropic's servers) ────
// No lead-specific data here. Lead data goes in the first user message instead.
// This saves ~90% of system prompt input tokens on every call after the first.
const STATIC_SYSTEM = `You are an elite, no-BS digital marketing forensics expert for OAC Digital Innovations.
Your mission: Expose exactly why the target business (provided in the user message) is hemorrhaging money to competitors on Google Maps and local search—and deliver the brutal truth in strict JSON format.

## FORENSIC AUDIT PROTOCOL
Execute these steps with surgical precision:

### 1. GOOGLE BUSINESS PROFILE DOMINANCE ANALYSIS
- Locate their exact GBP in the business's city
- Record their star rating and total review count
- Calculate their "Local Trust Score" (reviews × rating)
- Identify the EXACT pain: "While you have X reviews, customers are calling [Competitor] with Y reviews instead"

### 2. COMPETITIVE INTELLIGENCE (Top 3 Map Pack Analysis)
- Search: "[business type] near [city]"
- Extract the top 3 businesses dominating the Google Maps 3-pack
- For each competitor: Name, Reviews, Rating, WHY they're winning (be specific)

### 3. WEBSITE PRESENCE FORENSICS
If the business HAS a website:
- Scrape and audit it
- Check: Missing SEO fundamentals (H1, meta descriptions, local schema)
- Identify conversion killers: slow load, poor mobile, no clear CTA
- Highlight: "Your contact form is buried 3 clicks deep while competitors have instant chat"

If NO website:
- Calculate opportunity cost: "Every day without a website, you lose an estimated $XXX in local search traffic"
- Make it hurt: "In 2025, not having a website means you're invisible to 87% of local customers who Google before they buy"

### 4. SOCIAL MEDIA & TRUST SIGNALS
- Check Facebook Business Page and Instagram (if discoverable)
- Note last post date, engagement, follower count
- Verdict: "Dormant socials = you look out of business"

## PAIN-FOCUSED SCORING SYSTEM
Start at 100 points. Apply deductions:

| Weakness | Points Lost |
|----------|-------------|
| No website at all | -60 |
| Website missing core SEO | -25 |
| Rating below 4.5 stars | -15 |
| Fewer than 30 reviews | -20 |
| Top competitor has 5x+ reviews | -15 |
| No recent social media activity | -10 |
| Missing Google Business Posts | -5 |

Score interpretation: 80-100 competitive, 50-79 mediocre (losing 40-60% of leads), 20-49 critical, 0-19 emergency.

## STRICT JSON OUTPUT SCHEMA
Return ONLY this JSON structure. No markdown, no explanations, no preamble.

{
  "digital_health_score": <number 0-100>,
  "executive_summary": "<1-2 sentences brutal honesty with specific numbers and competitor names>",

  "gbp_audit": {
    "rating": <number>,
    "review_count": <integer>,
    "pain_point": "<specific visceral explanation with competitor comparison>"
  },

  "competitors": [
    {"name": "<name>", "rating": <number>, "reviews": <integer>, "why_they_win": "<specific reason>"},
    {"name": "<name>", "rating": <number>, "reviews": <integer>, "why_they_win": "<specific reason>"},
    {"name": "<name>", "rating": <number>, "reviews": <integer>, "why_they_win": "<specific reason>"}
  ],

  "missing_website_pain": "<ONLY if no website — make it hurt with estimated monthly revenue loss>",

  "website_audit": {
    "diagnosis": "<ONLY if website exists — brutal 2-3 sentence summary>",
    "issues": [
      {"title": "<issue name>", "description": "<why this kills conversions>"},
      {"title": "<issue name>", "description": "<impact>"}
    ]
  },

  "social_media": {
    "verdict": "<quick assessment with last activity date and follower count>"
  },

  "competitor_comparison_data": {
    "you": {
      "google_profile": <0-100>,
      "reviews_volume": <0-100>,
      "reviews_quality": <0-100>,
      "website_seo": <0-100>,
      "local_trust": <0-100>
    },
    "competitor": {
      "google_profile": <0-100>,
      "reviews_volume": <0-100>,
      "reviews_quality": <0-100>,
      "website_seo": <0-100>,
      "local_trust": <0-100>
    }
  },

  "action_plan": [
    {"phase_name": "🚨 Emergency Triage (Week 1-2)", "description": "<specific actions for this business>"},
    {"phase_name": "🏗️ Foundation Build (Week 3-6)", "description": "<specific actions for this business>"},
    {"phase_name": "⚔️ Attack & Dominate (Month 2-3)", "description": "<specific actions for this business>"}
  ]
}

CRITICAL: Output ONLY the JSON object. No \`\`\`json wrappers. Pure, parseable JSON.`;

// ─── Lead-specific user message (dynamic data only) ───────────────────────────
function buildUserMessage(lead) {
  const hasWebsite = lead.website_url && lead.has_website !== 'No' && lead.has_website !== 'false';
  return `Run the Google Maps focused audit and generate the JSON for this business:

- Name: ${lead.business_name}
- Location: ${lead.city || 'Miami, FL'}
- Industry: ${lead.business_type || 'Local Service Business'}
- Website: ${hasWebsite ? lead.website_url : 'NONE — apply full -60 point penalty and populate missing_website_pain'}`;
}

// ─── Firecrawl tool executor ───────────────────────────────────────────────────
async function executeTool(toolName, toolInput) {
  const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';
  const headers = { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` };

  try {
    if (toolName === 'search_web') {
      const res = await axios.post(`${FIRECRAWL_API}/search`, {
        query: toolInput.query,
        limit: toolInput.limit || 5,
        scrapeOptions: { formats: ['markdown'] }
      }, { headers });
      return JSON.stringify(res.data.data || res.data);
    }

    if (toolName === 'scrape_url') {
      const res = await axios.post(`${FIRECRAWL_API}/scrape`, {
        url: toolInput.url,
        formats: ['markdown']
      }, { headers });
      return res.data.data?.markdown || res.data.markdown || 'Could not scrape URL';
    }
  } catch (err) {
    return `Error: ${err.message}`;
  }
  return 'Unknown tool';
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────
async function runAuditPipeline(lead) {
  console.log(`[Pipeline] Starting audit for: ${lead.business_name}`);

  try {
    let contactId = lead.contact_id;
    if (!contactId || contactId === 'TEST_SKIP_GHL') {
      if (contactId !== 'TEST_SKIP_GHL') {
        contactId = await createContact(lead);
        await createOpportunity(contactId, lead.business_name);
      }
    }

    const messages = [{ role: 'user', content: buildUserMessage(lead) }];
    let jsonString = null;
    let iterations = 0;

    while (iterations < 10) {
      iterations++;
      console.log(`[Pipeline] Iteration ${iterations}...`);

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        // Static system is cached on Anthropic's servers — only paid as a cache read after first call
        system: [{ type: 'text', text: STATIC_SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        messages
      });

      const cleanContent = response.content.map(b => {
        if (b.type === 'text' && typeof b.text === 'string') return { ...b, text: b.text.trimEnd() };
        return b;
      });
      messages.push({ role: 'assistant', content: cleanContent });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text');
        if (textBlock) jsonString = textBlock.text.trim();
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            console.log(`  🔧 ${block.name}`);
            const result = await executeTool(block.name, block.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result.substring(0, 3000)  // Trimmed from 5000 — saves input tokens on following iterations
            });
          }
        }
        messages.push({ role: 'user', content: toolResults });
      }
    }

    if (!jsonString) throw new Error('AI produced no output');

    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response: ' + jsonString.substring(0, 200));
    const auditData = JSON.parse(jsonMatch[0]);

    console.log(`[Pipeline] Compiling HTML report...`);
    const htmlReport = generateHtmlReport(auditData, lead);

    // Local test mode — save HTML + PDF to disk without calling GHL
    if (contactId === 'TEST_SKIP_GHL') {
      const fs = require('fs');
      const path = require('path');
      const htmlPath = path.join(__dirname, '../test-output.html');
      fs.writeFileSync(htmlPath, htmlReport);
      console.log(`📄 HTML saved: ${htmlPath}`);

      console.log(`[Pipeline] Generating test PDF...`);
      const pdfBuffer = await generatePdf(htmlReport, lead.business_name);
      const pdfPath = path.join(__dirname, '../test-output.pdf');
      fs.writeFileSync(pdfPath, pdfBuffer);
      console.log(`📄 PDF saved: ${pdfPath}`);

      const { exec } = require('child_process');
      exec(`open "${pdfPath}"`);
      return;
    }

    console.log(`[Pipeline] Generating PDF...`);
    const pdfBuffer = await generatePdf(htmlReport, lead.business_name);
    const pdfSizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`[Pipeline] PDF size: ${pdfSizeMB} MB`);

    console.log(`[Pipeline] Sending audit email to ${lead.email}...`);
    await sendAuditEmail({ contactId, lead, pdfBuffer });

    await advanceToAuditSent(contactId);

    console.log(`[Pipeline] ✅ Complete for ${lead.business_name}`);

  } catch (err) {
    console.error(`[Pipeline] ❌ Failed:`, err.message);
    throw err;
  }
}

module.exports = { runAuditPipeline };
