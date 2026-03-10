/**
 * Test script — runs the full AI audit pipeline locally without sending to GHL.
 * Saves HTML to test-output.html and PDF to test-output.pdf, then opens the PDF.
 *
 * Usage: node test-audit.js
 */
require('dotenv').config();
const { runAuditPipeline } = require('./lib/auditPipeline');

const lead = {
    first_name: 'Carlos',
    last_name: 'Gutierrez',
    email: 'ocasilla@oacdigital.biz',
    business_name: 'Gutierrez Painting & Drywall',
    city: 'Kendall, Miami FL',
    business_type: 'Painting Contractor',
    has_website: 'No',
    website_url: '',
    contact_id: 'TEST_SKIP_GHL'   // Bypasses GHL — saves PDF locally instead
};

runAuditPipeline(lead)
    .then(() => process.exit(0))
    .catch(err => {
        console.error('\n❌ Test failed:', err.message);
        process.exit(1);
    });
