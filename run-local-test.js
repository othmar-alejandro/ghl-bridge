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
  contact_id: 'TEST_SKIP_GHL'
};

runAuditPipeline(lead).catch(err => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
});
