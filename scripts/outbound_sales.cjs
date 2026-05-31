/**
 * FlickTV Outbound Sales Call Script
 * 
 * Targets businesses without websites and pitches Flicktek web development services.
 * Uses Vapi MCP tools to place calls (bypasses Cloudflare blocking).
 * 
 * Usage: node scripts/outbound_sales.cjs
 * Or via cron job at 11 AM daily.
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────
const VAPI_PRIVATE_KEY = '56f5f5f4-197b-4b76-b240-187cc6b50a18';
const ASSISTANT_ID = '83fe32a3-460c-4674-bab5-c38a98900a2c'; // Base44 Lead Qualifier
const PHONE_NUMBER_ID = '33541739-cb5e-440d-b7d4-11f97b8b8786'; // Flicktek caller ID
const REPORTS_DIR = '/Users/kingfaisal/projects/flicktek/todays-cold-call';

const CITIES = [
  { name: 'Newark NJ', area: 'Newark, NJ', zipPrefixes: ['071'] },
  { name: 'Philadelphia PA', area: 'Philadelphia, PA', zipPrefixes: ['191', '190'] },
  { name: 'Baltimore MD', area: 'Baltimore, MD', zipPrefixes: ['212'] },
  { name: 'Atlanta GA', area: 'Atlanta, GA', zipPrefixes: ['303'] },
  { name: 'Houston TX', area: 'Houston, TX', zipPrefixes: ['770'] },
  { name: 'Detroit MI', area: 'Detroit, MI', zipPrefixes: ['482'] },
  { name: 'Cleveland OH', area: 'Cleveland, OH', zipPrefixes: ['441'] },
  { name: 'Chicago IL', area: 'Chicago, IL', zipPrefixes: ['606'] },
  { name: 'Memphis TN', area: 'Memphis, TN', zipPrefixes: ['381'] },
  { name: 'New Orleans LA', area: 'New Orleans, LA', zipPrefixes: ['701'] },
];

const BUSINESS_TYPES = [
  'barber shop', 'hair salon', 'auto repair', 'car mechanic',
  'restaurant', 'pizza shop', 'cleaning service', 'janitorial service',
  'dentist', 'chiropractor', 'plumber', 'electrician',
  'HVAC contractor', 'roofing contractor', 'landscaping',
  'towing service', 'nail salon', 'tattoo parlor',
  'gym', 'yoga studio', 'martial arts',
  'real estate agent', 'insurance agent', 'tax preparation',
  'auto body shop', 'dry cleaner', 'laundromat',
];

// ─── Script ───────────────────────────────────────────────────────────────────

async function main() {
  const log = [];
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon, ...
  
  // Pick today's city (rotate based on day of week)
  const cityIndex = dayOfWeek % CITIES.length;
  const city = CITIES[cityIndex];
  
  log.push(`# Cold Call Script — ${today}`);
  log.push(`## Target City: ${city.name}`);
  log.push(`## Business Types: ${BUSINESS_TYPES.slice(0, 10).join(', ')}...`);
  log.push('');

  // This script generates the call list and instructions
  // Actual calls are placed via Vapi MCP tools by the cron job agent
  
  log.push('## Call Script (What the AI Agent Does):');
  log.push('');
  log.push('### Step 1: Find Businesses Without Websites');
  log.push('```');
  log.push(`Search Google Maps/Yelp for: "${BUSINESS_TYPES.join(' OR ')}" in ${city.area}`);
  log.push('For each business found:');
  log.push('1. Note the business name and phone number');
  log.push('2. Search Google for "[business name] website"');
  log.push('3. If NO官方网站 found (only Facebook/Google Maps/Yelp) → add to call list');
  log.push('4. Target: 50 businesses per day');
  log.push('```');
  log.push('');
  
  log.push('### Step 2: Place Calls via Vapi');
  log.push('```javascript');
  log.push('// For each business in call list:');
  log.push('await mcp_vapi_create_call({');
  log.push(`  assistantId: "${ASSISTANT_ID}",`);
  log.push(`  phoneNumberId: "${PHONE_NUMBER_ID}",`);
  log.push('  customer: {');
  log.push('    number: "+1XXXXXXXXXX", // business phone');
  log.push('    name: "Business Name"');
  log.push('  },');
  log.push('  assistantOverrides: {');
  log.push('    variableValues: {');
  log.push('      business_name: "Business Name",');
  log.push('      city: "' + city.name + '"');
  log.push('    }');
  log.push('  }');
  log.push('});');
  log.push('```');
  log.push('');

  log.push('### Step 3: Pitch Script (Vapi Assistant Already Has This)');
  log.push('The Base44 Lead Qualifier assistant will:');
  log.push('- Introduce itself as calling from Flicktek');
  log.push('- Mention the business was found online');
  log.push('- Ask if they have a website or are looking to get one');
  log.push('- Pitch Flicktek web development services');
  log.push('- Capture interest level and follow-up preferences');
  log.push('');

  // Save script
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const scriptPath = path.join(REPORTS_DIR, `${today}-script.md`);
  fs.writeFileSync(scriptPath, log.join('\n'));
  console.log(`Script saved to: ${scriptPath}`);
  log.push(`Script saved: ${scriptPath}`);

  // Generate call tracking template
  const callLog = [
    `# Cold Call Report — ${today}`,
    '',
    `## Summary`,
    `- Total businesses researched: PENDING`,
    `- Total businesses without website: PENDING`,
    `- Total calls placed: PENDING`,
    `- Total answered: PENDING`,
    `- Total voicemail: PENDING`,
    `- Total interested / callback: PENDING`,
    `- Total not interested: PENDING`,
    '',
    '## Call Log',
    '| # | Business Name | Phone | Website? | Outcome | Notes |',
    '|---|--------------|-------|----------|---------|-------|',
  ];

  const reportPath = path.join(REPORTS_DIR, `${today}.md`);
  fs.writeFileSync(reportPath, callLog.join('\n'));
  console.log(`Report template saved to: ${reportPath}`);

  return { scriptPath, reportPath, city: city.name };
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
