const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const { generatePdf } = require('./pdfGenerator');
const { createContact, sendAuditEmail, moveToStage } = require('./ghlClient');
const generateHtmlReport = require('./htmlTemplate');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    }
  }
];

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

function buildSystemPrompt(lead) {
  const hasWebsite = lead.website_url && lead.has_website !== 'No' && lead.has_website !== 'false';

  return `You are an elite, no-BS digital marketing forensics expert for OAC Digital Innovations.
Your mission: Expose exactly why ${lead.business_name} is hemorrhaging money to competitors on Google Maps and local search—and deliver the brutal truth in strict JSON format.

## TARGET BUSINESS
- Name: ${lead.business_name}
- Location: ${lead.city || 'Miami, FL'}
- Industry: ${lead.business_type || 'Local Service Business'}
- Website: ${hasWebsite ? lead.website_url : '❌ NONE (CRITICAL FAILURE)'}

## FORENSIC AUDIT PROTOCOL
You MUST execute these steps with surgical precision:

### 1. GOOGLE BUSINESS PROFILE DOMINANCE ANALYSIS
- Locate their exact GBP in ${lead.city || 'Miami, FL'}
- Record their star rating and total review count
- Calculate their "Local Trust Score" (reviews × rating)
- Identify the EXACT pain: "While you have X reviews, customers are calling [Competitor] with Y reviews instead"

### 2. COMPETITIVE INTELLIGENCE (Top 3 Map Pack Analysis)
- Search: "${lead.business_type || 'home services'} near ${lead.city || 'Miami, FL'}"
- Extract the top 3 businesses dominating the Google Maps 3-pack
- For each competitor, record: Name, Reviews, Rating, WHY they're winning
- Be SPECIFIC: "Competitor A has 247 reviews with a 4.9 rating—that's 20x your social proof"

### 3. WEBSITE PRESENCE FORENSICS
${hasWebsite ? `
- Scrape and audit ${lead.website_url}
- Check for: Missing SEO fundamentals (H1, meta descriptions, local schema)
- Identify broken user experience (slow load, poor mobile, no clear CTA)
- Highlight conversion killers: "Your contact form is buried 3 clicks deep while competitors have instant chat"
` : `
- NO WEBSITE DETECTED
- Calculate opportunity cost: "Every day without a website, you lose an estimated $XXX in local search traffic to competitors"
- Make it hurt: "In 2025, not having a website means you're invisible to 87% of local customers who Google before they buy"
`}

### 4. SOCIAL MEDIA & TRUST SIGNALS
- Check Facebook Business Page and Instagram (if discoverable via search)
- Note last post date, engagement, follower count
- Verdict: "Dormant socials = you look out of business"

## PAIN-FOCUSED SCORING SYSTEM
Start at 100 points. Apply these ruthless deductions:

| Weakness | Points Lost | Rationale |
|----------|-------------|-----------|
| No website at all | -60 | Invisible to Google, losing 80%+ of local search traffic |
| Website exists but missing core SEO | -25 | Google can't rank what it can't understand |
| Rating below 4.5 stars | -15 | Customers filter you out mentally |
| Fewer than 30 reviews | -20 | Zero social proof = zero trust |
| Top competitor has 5x+ reviews | -15 | You're not even in the consideration set |
| No recent social media activity | -10 | Looks abandoned or unprofessional |
| Missing Google Business Posts | -5 | Competitors look more active & engaged |

**Final Score Interpretation:**
- 80-100: Rare. You're competitive (but still have gaps).
- 50-79: Mediocre. You're losing 40-60% of potential leads.
- 20-49: Critical. You're getting crushed daily.
- 0-19: Emergency. Your business is practically invisible online.

## STRICT JSON OUTPUT SCHEMA
Return ONLY this JSON structure. No markdown, no explanations, no preamble.

{
  "digital_health_score": <number 0-100>,
  "executive_summary": "<1-2 sentences of brutal honesty: why they're losing leads RIGHT NOW to competitors. Use specific numbers and competitor names.>",

  "gbp_audit": {
    "rating": <number, e.g. 4.3>,
    "review_count": <integer>,
    "pain_point": "<Specific, visceral explanation. Example: 'You have 12 reviews. Your top competitor has 203 reviews and a 4.9 rating—customers see that gap and call them instead. Every. Single. Time.'>"
  },

  "competitors": [
    {
      "name": "<Competitor Business Name>",
      "rating": <number>,
      "reviews": <integer>,
      "why_they_win": "<Specific reason: 'Dominating the Google Maps 3-pack with 8x your review volume and active weekly Google Posts.'>"
    },
    {
      "name": "<2nd Competitor>",
      "rating": <number>,
      "reviews": <integer>,
      "why_they_win": "<Reason>"
    },
    {
      "name": "<3rd Competitor>",
      "rating": <number>,
      "reviews": <integer>,
      "why_they_win": "<Reason>"
    }
  ],

  "missing_website_pain": "<ONLY if no website. Make it hurt: 'Operating without a website in 2025 is like running a store with no sign, no phone number, and no address. You're losing an estimated $X,XXX per month in Google Search traffic that's going straight to competitors with optimized sites.'>",

  "website_audit": {
    "diagnosis": "<ONLY if website exists. Brutal 2-3 sentence summary of what's broken.>",
    "issues": [
      {
        "title": "<Issue name, e.g. 'Missing Local Schema Markup'>",
        "description": "<Why this kills conversions: 'Google can't show your business hours, phone number, or service area in search results—so customers can't find you.'>"
      },
      {
        "title": "<Another issue>",
        "description": "<Impact>"
      }
    ]
  },

  "social_media": {
    "verdict": "<Quick assessment: 'Facebook page last updated 8 months ago—looks abandoned. Instagram has 47 followers and no recent posts. This screams 'out of business' to potential customers.'>"
  },

  "competitor_comparison_data": {
    "you": {
      "google_profile": <0-100, based on rating + reviews>,
      "reviews_volume": <0-100, relative to top competitor>,
      "reviews_quality": <0-100, rating converted to scale>,
      "website_seo": <0-100, 0 if no site>,
      "local_trust": <0-100, holistic score>
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
    {
      "phase_name": "🚨 Emergency Triage (Week 1-2)",
      "description": "Fix critical bleeding: Optimize GBP, launch SMS review campaigns, claim all citation profiles (Yelp, BBB, Angi). Goal: Get to 25+ reviews ASAP."
    },
    {
      "phase_name": "🏗️ Foundation Build (Week 3-6)",
      "description": "Launch conversion-optimized website with local SEO, setup Google LSA/PPC campaigns, activate social media with weekly posting schedule."
    },
    {
      "phase_name": "⚔️ Attack & Dominate (Month 2-3)",
      "description": "Outrank competitors with content marketing, run retargeting ads, build backlink authority, dominate Google Maps 3-pack in your service area."
    }
  ]
}

CRITICAL: Output ONLY the JSON object. No \`\`\`json wrappers. No explanations. Pure, parseable JSON.`;
}

async function runAuditPipeline(lead) {
  console.log(`[Pipeline] Starting audit for: ${lead.business_name}`);

  try {
    let contactId = lead.contact_id;
    if (!contactId || contactId === 'TEST_SKIP_GHL') {
      if (contactId !== 'TEST_SKIP_GHL') {
        contactId = await createContact(lead);
      }
    }

    const systemPrompt = buildSystemPrompt(lead);
    const messages = [{ role: 'user', content: 'Run the Google Maps focused audit and generate the JSON.' }];

    let jsonString = null;
    let iterations = 0;

    while (iterations < 10) {
      iterations++;
      console.log(`[Pipeline] Iteration ${iterations}...`);

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: systemPrompt,
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
              content: result.substring(0, 5000)
            });
          }
        }
        messages.push({ role: 'user', content: toolResults });
      }
    }

    if (!jsonString) throw new Error('AI produced no output');

    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not find JSON object in AI response. Raw output: ' + jsonString);
    }
    const auditData = JSON.parse(jsonMatch[0]);

    // Generate HTML from template
    console.log(`[Pipeline] Compiling HTML report...`);
    const htmlReport = generateHtmlReport(auditData, lead);

    // For local tests without GHL:
    if (contactId === 'TEST_SKIP_GHL') {
      const fs = require('fs');
      const path = require('path');

      const htmlPath = path.join(__dirname, '../test-output.html');
      fs.writeFileSync(htmlPath, htmlReport);
      console.log(`📄 Test HTML saved to: ${htmlPath}`);

      console.log(`[Pipeline] Generating test PDF...`);
      const pdfBuffer = await generatePdf(htmlReport, lead.business_name);
      const pdfPath = path.join(__dirname, '../test-output.pdf');
      fs.writeFileSync(pdfPath, pdfBuffer);
      console.log(`📄 Test PDF saved to: ${pdfPath}`);

      console.log(`\n🎯 Opening PDF...`);
      const { exec } = require('child_process');
      exec(`open "${pdfPath}"`);
      return;
    }

    // Step 3: Generate PDF from HTML
    console.log(`[Pipeline] Generating PDF...`);
    const pdfBuffer = await generatePdf(htmlReport, lead.business_name);

    // Validate PDF size for email deliverability
    const pdfSizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`[Pipeline] PDF size: ${pdfSizeMB} MB`);

    if (pdfBuffer.length > 5 * 1024 * 1024) {
      console.warn(`[Pipeline] ⚠️ PDF is ${pdfSizeMB} MB — may have email deliverability issues. Recommended: < 5 MB`);
    }

    // Step 4: Send audit email
    console.log(`[Pipeline] Sending audit email to ${lead.email}...`);
    await sendAuditEmail({ contactId, lead, pdfBuffer });

    // Step 5: Update GHL pipeline
    await moveToStage(contactId, 'audit-sent');

    console.log(`[Pipeline] ✅ Complete for ${lead.business_name}`);

  } catch (err) {
    console.error(`[Pipeline] ❌ Failed:`, err.message);
    throw err;
  }
}

module.exports = { runAuditPipeline };
