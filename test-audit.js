/**
 * Test script — runs the full AI audit pipeline and saves the HTML to disk.
 * Bypasses GHL and PDF generation so we can verify the AI output quickly.
 * 
 * Usage: node test-audit.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS = [
    {
        name: 'search_web',
        description: 'Search the web for information about a business, competitors, or local market data.',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query to execute' },
                limit: { type: 'number', description: 'Number of results to return (default: 5)' }
            },
            required: ['query']
        }
    },
    {
        name: 'scrape_url',
        description: 'Scrape and read the full content of a web page.',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The full URL to scrape' }
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
        return `Tool error: ${err.message}`;
    }
    return 'Unknown tool';
}

// ─── Test lead (Mode B — no website) ─────────────────────────────────────────
const lead = {
    first_name: 'Carlos',
    last_name: 'Gutierrez',
    email: 'ocasilla@oacdigital.biz',
    business_name: 'Gutierrez Painting & Drywall',
    city: 'Kendall, Miami FL',
    business_type: 'Painting Contractor',
    has_website: 'No',
    website_url: ''
};

const systemPrompt = `You are an expert digital marketing analyst working for OAC Digital Innovations. 
Your mission is to run a comprehensive digital presence audit for a business prospect and generate a stunning, persuasive interactive HTML report.

## LEAD INFORMATION
- Business Name: ${lead.business_name}
- City: ${lead.city}
- Business Type: ${lead.business_type}
- Website: NONE — this business has no website

## NO WEBSITE — CRITICAL MISSING ASSET (Mode B)
- Do NOT run a website audit — this business has no website.
- In the HTML report, include a "Critical Missing Asset" section that:
  - Shows the top 2-3 competitors who DO have websites and are ranking for key terms
  - Estimates monthly searches lost ("850+ people searched painting contractor Kendall last month — none could find you online")
  - Uses the analogy: "Having no website in 2025 is like owning a store with no address"
  - Frames OAC as the solution

## RESEARCH STEPS
1. Search for: "${lead.business_name} ${lead.city}" — find GBP listing, reviews
2. Search for top competitors: "painting contractor Kendall Miami" — note their websites, ratings
3. Check social: "${lead.business_name} Facebook" and "${lead.business_name} Instagram"  
4. Search: "painting contractor Kendall Miami monthly searches keywords"

## HTML REPORT REQUIREMENTS
Generate a single, self-contained HTML file with these exact specifications:

**Tech Stack:** Tailwind CSS CDN, Chart.js, AOS, FontAwesome — ALL inside <body> (NOT <head>)
**Wrapper:** <div id="oac-wrapper" style="background-color:#080d1a !important; color:#f1f5f9 !important; min-height:100vh;">
**Use !important** on all critical CSS rules.

**Branding:**
- Logo: https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png
- Agency: OAC Digital Innovations | Phone: 786-340-1053

**Design:** Premium dark mode, glassmorphism cards (bg-white/5 backdrop-blur-md border border-white/10), Red/Amber for bad metrics, Blue/Green for solutions

**Required Sections:**
1. Hero with Digital Health Score gauge (out of 100) — animated
2. Critical Missing Asset (no website = massive revenue leak)
3. Google Business Profile audit (rating, reviews, completeness)
4. Social Media & Directories audit  
5. Competitor Comparison — Radar chart (Chart.js) vs top competitor
6. Missed Keywords table with estimated monthly volume
7. 3-Phase Action Plan (Emergency Triage → Foundation Build → Attack & Dominate)
8. CTA: "Book Your Free 15-Min Strategy Call" → tel:7863401053

**Tone:** Brutally honest, plain-English analogies for business owners, make them feel the pain then offer the solution.

IMPORTANT: Output ONLY the complete HTML document. No explanation before or after. Start with <!DOCTYPE html>.`;

async function runTest() {
    console.log(`\n🚀 Starting audit for: ${lead.business_name}`);
    console.log(`📍 Mode: NO WEBSITE (Mode B)\n`);

    const messages = [{ role: 'user', content: `Run the full digital presence audit for ${lead.business_name} in ${lead.city} now.` }];
    let htmlReport = null;
    let iterations = 0;

    while (iterations < 15) {
        iterations++;
        console.log(`\n[Iteration ${iterations}] Calling Claude...`);

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 8000,
            system: systemPrompt,
            tools: TOOLS,
            messages
        });

        // Add assistant response to message history (API fails if text blocks have trailing whitespace)
        const cleanContent = response.content.map(b => {
            if (b.type === 'text' && typeof b.text === 'string') {
                return { ...b, text: b.text.trimEnd() };
            }
            return b;
        });
        messages.push({ role: 'assistant', content: cleanContent });

        if (response.stop_reason === 'end_turn') {
            const textBlock = response.content.find(b => b.type === 'text');
            if (textBlock) htmlReport = textBlock.text;
            console.log(`\n✅ Claude finished. HTML length: ${htmlReport?.length || 0} chars`);
            break;
        }

        if (response.stop_reason === 'tool_use') {
            const toolResults = [];
            for (const block of response.content) {
                if (block.type === 'tool_use') {
                    console.log(`  🔧 ${block.name}: ${JSON.stringify(block.input).substring(0, 100)}`);
                    const result = await executeTool(block.name, block.input);
                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: block.id,
                        content: result.substring(0, 6000)
                    });
                }
            }
            messages.push({ role: 'user', content: toolResults });
        }
    }

    if (!jsonString) throw new Error('AI produced no output');

    jsonString = jsonString.replace(/^```json/, '').replace(/```$/, '').trim();
    const auditData = JSON.parse(jsonString);

    const generateHtmlReport = require('./lib/htmlTemplate');
    const { generatePdf } = require('./lib/pdfGenerator');
    htmlReport = generateHtmlReport(auditData, lead);

    // Save HTML
    const htmlPath = path.join(__dirname, 'test-output.html');
    fs.writeFileSync(htmlPath, htmlReport);
    console.log(`\n📄 HTML saved to: ${htmlPath}`);

    // Generate & Save PDF
    console.log(`\n📄 Generating PDF...`);
    const pdfBuffer = await generatePdf(htmlReport, lead.business_name);
    const pdfPath = path.join(__dirname, 'test-output.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`📄 PDF saved to: ${pdfPath}`);

    console.log(`\n🎯 Opening PDF...`);
    const { exec } = require('child_process');
    exec(`open "${pdfPath}"`);
}

runTest().catch(err => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
});
