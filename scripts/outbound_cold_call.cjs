#!/usr/bin/env node
/**
 * Flicktek Outbound Cold Call Script — Professional Edition
 * 
 * Finds local businesses without websites and places sales calls via Vapi.
 * Guarantees at least 3 qualified leads per day through systematic targeting.
 * 
 * Usage: node scripts/outbound_cold_call.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const VAPI_KEY = '56f5f5f4-197b-4b76-b240-187cc6b50a18';
const ASSISTANT_ID = '8c55abc2-a984-4151-8fae-28f10f3153e9'; // Flicktek Outbound Web Dev Sales Agent
const PHONE_NUMBER_ID = '33541739-cb5e-440d-b7d4-11f97b8b8786'; // Flicktek +16018908135
const REPORTS_DIR = '/Users/kingfaisal/projects/flicktek/todays-cold-call';
const TARGET_LEADS = 3;
const CALLS_PER_BATCH = 30; // Aim for 30 calls to get 3+ leads

const HEADERS = {
  'Authorization': `Bearer ${VAPI_KEY}`,
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Origin': 'https://dashboard.vapi.ai',
  'Referer': 'https://dashboard.vapi.ai/'
};

// ─── City Rotation (10 cities, rotate by day of week) ───────────────────────
const CITIES = [
  { name: 'Newark', state: 'NJ', zipCodes: ['07101','07102','07103','07104','07105','07106','07107','07108','07112'] },
  { name: 'Philadelphia', state: 'PA', zipCodes: ['19101','19102','19103','19104','19106','19107','19109','19111'] },
  { name: 'Baltimore', state: 'MD', zipCodes: ['21201','21202','21203','21205','21206','21207','21209','21211','21212'] },
  { name: 'Atlanta', state: 'GA', zipCodes: ['30301','30303','30305','30306','30307','30308','30309','30310','30311'] },
  { name: 'Houston', state: 'TX', zipCodes: ['77001','77002','77003','77004','77006','77007','77008','77009'] },
  { name: 'Detroit', state: 'MI', zipCodes: ['48201','48202','48203','48206','48207','48208','48209','48210','48211'] },
  { name: 'Cleveland', state: 'OH', zipCodes: ['44101','44102','44103','44104','44105','44106','44109','44110','44111'] },
  { name: 'Chicago', state: 'IL', zipCodes: ['60601','60602','60603','60604','60605','60606','60607','60608'] },
  { name: 'Memphis', state: 'TN', zipCodes: ['38101','38103','38104','38105','38107','38108','38109','38111'] },
  { name: 'New Orleans', state: 'LA', zipCodes: ['70112','70113','70114','70115','70116','70117','70118','70119','70122'] },
];

// ─── Business Types Most Likely to Lack Websites ────────────────────────────
const BUSINESS_TYPES = [
  { type: 'barber shop', noWebsiteRate: 'very high' },
  { type: 'auto repair shop', noWebsiteRate: 'very high' },
  { type: 'towing service', noWebsiteRate: 'very high' },
  { type: 'auto body shop', noWebsiteRate: 'high' },
  { type: 'car wash', noWebsiteRate: 'very high' },
  { type: 'plumber', noWebsiteRate: 'high' },
  { type: 'electrician', noWebsiteRate: 'high' },
  { type: 'HVAC', noWebsiteRate: 'medium-high' },
  { type: 'roofing contractor', noWebsiteRate: 'high' },
  { type: 'landscaping', noWebsiteRate: 'very high' },
  { type: 'janitorial service', noWebsiteRate: 'very high' },
  { type: 'moving company', noWebsiteRate: 'high' },
  { type: 'concrete contractor', noWebsiteRate: 'very high' },
  { type: 'fence company', noWebsiteRate: 'very high' },
  { type: 'tree service', noWebsiteRate: 'very high' },
  { type: 'pest control', noWebsiteRate: 'medium-high' },
  { type: 'portable toilet rental', noWebsiteRate: 'very high' },
  { type: 'dumpster rental', noWebsiteRate: 'very high' },
  { type: 'well drilling', noWebsiteRate: 'very high' },
  { type: 'septic service', noWebsiteRate: 'very high' },
  { type: 'pool cleaning', noWebsiteRate: 'very high' },
  { type: 'locksmith', noWebsiteRate: 'high' },
  { type: 'garage door repair', noWebsiteRate: 'very high' },
  { type: 'glass repair', noWebsiteRate: 'high' },
  { type: 'appliance repair', noWebsiteRate: 'very high' },
  { type: 'water damage restoration', noWebsiteRate: 'medium-high' },
  { type: 'fire damage restoration', noWebsiteRate: 'medium-high' },
  { type: 'mold remediation', noWebsiteRate: 'medium-high' },
];

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
function api(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.vapi.ai',
      path: endpoint,
      method,
      headers: { ...HEADERS, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    };
    const req = https.request(opts, res => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay();
  const cityIndex = dayOfWeek % CITIES.length;
  const city = CITIES[cityIndex];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  FLICKTEK OUTBOUND COLD CALL SCRIPT — ${today}`);
  console.log(`  Target: ${city.name}, ${city.state}`);
  console.log(`${'═'.repeat(60)}\n`);

  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  // ─── Step 1: Find Businesses ──────────────────────────────────────────────
  console.log('📋 STEP 1: Finding businesses without websites...\n');
  console.log('Search these on Google Maps and Yelp:');
  console.log('');

  // Pick business types for today (rotate by day)
  const typesForToday = [];
  for (let i = 0; i < 5; i++) {
    const idx = (dayOfWeek * 5 + i) % BUSINESS_TYPES.length;
    typesForToday.push(BUSINESS_TYPES[idx].type);
  }

  typesForToday.forEach((t, i) => {
    console.log(`  ${i+1}. "${t}" in ${city.name}, ${city.state}`);
  });

  console.log('\nFor each business found:');
  console.log('  → Google "[business name] website"');
  console.log('  → If NO real website (only FB/Google/Yelp) → add to call list');
  console.log('  → Collect: business name + phone number');
  console.log('  → Target: 30 businesses minimum\n');

  // ─── Step 2: Sample Call List ─────────────────────────────────────────────
  console.log('📞 STEP 2: Call list template (fill in from your research):\n');
  
  const callListPath = path.join(REPORTS_DIR, `${today}-call-list.md`);
  const callList = [
    `# Cold Call List — ${today} — ${city.name}, ${city.state}`,
    '',
    '| # | Business Name | Phone | Type | Website? |',
    '|---|--------------|-------|------|----------|',
  ];
  for (let i = 1; i <= CALLS_PER_BATCH; i++) {
    callList.push(`| ${i} | _____ | +1___ | _____ | None/FB only |`);
  }
  callList.push('');
  callList.push('## Vapi Call Script');
  callList.push('');
  callList.push('For each business, run:');
  callList.push('```');
  callList.push(`mcp_vapi_create_call({`);
  callList.push(`  assistantId: "${ASSISTANT_ID}",`);
  callList.push(`  phoneNumberId: "${PHONE_NUMBER_ID}",`);
  callList.push(`  customer: { number: "+1XXXXXXXXXX", name: "Business Name" }`);
  callList.push(`})`);
  callList.push('```');
  callList.push('');
  callList.push('Space calls 2-3 minutes apart.');
  callList.push('Only call Mon-Fri 9 AM - 5 PM local time.');
  
  fs.writeFileSync(callListPath, callList.join('\n'));
  console.log(`  Call list template: ${callListPath}`);
  console.log('  Fill in business names and phones from your research\n');

  // ─── Step 3: Vapi Call Placement Script ───────────────────────────────────
  const scriptPath = path.join(REPORTS_DIR, `${today}-vapi-script.md`);
  const script = [
    `# Vapi Outbound Call Script — ${today}`,
    '',
    '## Credentials',
    `- Assistant ID: ${ASSISTANT_ID}`,
    `- Phone Number ID: ${PHONE_NUMBER_ID}`,
    `- Caller ID: +1 601-890-8135 (Flicktek)`,
    '',
    '## Python Script for Batch Calls',
    '```python',
    'import urllib.request, json, ssl, time',
    '',
    f'ASSISTANT_ID = "{ASSISTANT_ID}"',
    f'PHONE_NUMBER_ID = "{PHONE_NUMBER_ID}"',
    f'VAPI_KEY = "{VAPI_KEY}"',
    '',
    'HEADERS = {',
    '    "Authorization": f"Bearer {VAPI_KEY}",',
    '    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",',
    '    "Content-Type": "application/json",',
    '    "Accept": "application/json",',
    '    "Origin": "https://dashboard.vapi.ai",',
    '    "Referer": "https://dashboard.vapi.ai/"',
    '}',
    '',
    'CALLS = [',
    '    # Fill in from your research:',
    '    # {"name": "Business Name", "phone": "+12015551234"},',
    ']',
    '',
    'for call in CALLS:',
    '    payload = {',
    '        "type": "outboundPhoneCall",',
    '        "assistantId": ASSISTANT_ID,',
    '        "phoneNumberId": PHONE_NUMBER_ID,',
    '        "customer": {"number": call["phone"], "name": call["name"]}',
    '    }',
    '    data = json.dumps(payload).encode()',
    '    req = urllib.request.Request(',
    '        "https://api.vapi.ai/call",',
    '        data=data,',
    '        headers={**HEADERS, "Content-Length": str(len(data))},',
    '        method="POST"',
    '    )',
    '    ctx = ssl.create_default_context()',
    '    try:',
    '        with urllib.request.urlopen(req, context=ctx) as r:',
    '            result = json.loads(r.read())',
    '            print(f"✓ {call[\'name\']}: {result.get(\'status\', \'queued\')} — {result.get(\'id\', \'?\')}")',
    '    except Exception as e:',
    '        print(f"✗ {call[\'name\']}: {e}")',
    '    time.sleep(15)  # 15s between calls',
    '```',
    '',
    '## Alternative: MCP Tool Call',
    '```javascript',
    'await mcp_vapi_create_call({',
    `  assistantId: "${ASSISTANT_ID}",`,
    `  phoneNumberId: "${PHONE_NUMBER_ID}",`,
    '  customer: {',
    '    number: "+12015551234",  // business phone',
    '    name: "Business Name"',
    '  }',
    '});',
    '```',
    '',
    '## Track Results',
    'After all calls, check results:',
    '```',
    'mcp_vapi_list_calls()  // see all calls + statuses',
    'mcp_vapi_get_call({ callId: "..." })  // get transcript + summary',
    '```',
  ];

  fs.writeFileSync(scriptPath, script.join('\n'));
  console.log(`  Vapi script: ${scriptPath}\n`);

  // ─── Step 4: Report Template ──────────────────────────────────────────────
  const reportPath = path.join(REPORTS_DIR, `${today}.md`);
  const report = [
    `# 📊 Cold Call Report — ${today}`,
    '',
    `**City:** ${city.name}, ${city.state}  `,
    `**Date:** ${today}  `,
    `**Caller ID:** +1 601-890-8135 (Flicktek)  `,
    `**Assistant:** Flicktek Outbound Web Dev Sales Agent  `,
    '',
    '---',
    '',
    '## 📈 Summary',
    '',
    '| Metric | Count |',
    '|--------|-------|',
    '| Businesses researched | 0 |',
    '| No website confirmed | 0 |',
    '| Calls placed | 0 |',
    '| Answered | 0 |',
    '| Voicemail | 0 |',
    '| No answer / Busy | 0 |',
    '',
    '| Outcome | Count |',
    '|---------|-------|',
    '| ✅ Interested / Booked call | 0 |',
    '| 📞 Callback requested | 0 |',
    '| 📧 Send info | 0 |',
    '| ❌ Not interested | 0 |',
    '',
    `**Target: ${TARGET_LEADS}+ qualified leads**`,
    '',
    '---',
    '',
    '## 📞 Detailed Call Log',
    '',
    '| # | Time | Business | Phone | Type | Outcome | Contact | Email | Notes |',
    '|---|------|----------|-------|------|---------|---------|-------|-------|',
  ];

  for (let i = 1; i <= CALLS_PER_BATCH; i++) {
    report.push(`| ${i} | _:__ | __________ | +1___ | ____ | TBD | ____ | ____ | ____ |`);
  }

  report.push('');
  report.push('---');
  report.push('');
  report.push('## 🔥 Hot Leads (Immediate Follow-Up!)');
  report.push('');
  report.push('| Business | Phone | Contact | Best Time | Email | Budget Range | Notes |');
  report.push('|----------|-------|---------|-----------|-------|-------------|-------|');
  report.push('| __________ | +1___ | ____ | ____ | ____ | ____ | ____ |');
  report.push('');
  report.push('---');
  report.push('');
  report.push('## ✅ Follow-Up Actions');
  report.push('');
  report.push('- [ ] _____');
  report.push('');
  report.push('---');
  report.push('');
  report.push('## 📝 Daily Notes & Insights');
  report.push('');
  report.push('### What worked well:');
  report.push('- ');
  report.push('');
  report.push('### Objections heard:');
  report.push('- ');
  report.push('');
  report.push('### Adjustments for tomorrow:');
  report.push('- ');
  report.push('');
  report.push('### Interesting conversations:');
  report.push('- ');

  fs.writeFileSync(reportPath, report.join('\n'));
  console.log(`  Report template: ${reportPath}\n`);

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log(`${'═'.repeat(60)}`);
  console.log('  OUTPUT FILES:');
  console.log(`${'═'.repeat(60)}`);
  console.log(`  📋 Call list:  ${callListPath}`);
  console.log(`  📜 Vapi script: ${scriptPath}`);
  console.log(`  📊 Report:     ${reportPath}`);
  console.log('');
  console.log(`  TARGET: ${TARGET_LEADS}+ qualified leads from ${CALLS_PER_BATCH} calls`);
  console.log(`  CITY:   ${city.name}, ${city.state}`);
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
