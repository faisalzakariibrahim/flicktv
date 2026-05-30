const http = require('http');
const https = require('https');

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers, timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data.substring(0, 500) }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  // Test 1: Base URL without token
  const baseUrl = 'https://epg.provider.plex.tv/library/parts/6a1610bebdf296985fd95603-62b45f15b4508e0eedacdf26.m3u8';
  
  console.log('Test 1: Base URL without headers');
  try {
    const r1 = await fetchUrl(baseUrl);
    console.log('  Status:', r1.status);
    console.log('  Content-Type:', r1.headers['content-type']);
    console.log('  Body preview:', r1.body.substring(0, 300));
  } catch(e) {
    console.log('  Error:', e.message);
  }
  
  console.log('\nTest 2: Base URL with X-Plex-Token');
  try {
    const r2 = await fetchUrl(baseUrl, {
      'X-Plex-Token': '9F1pDPzr73oL_idfzXye',
      'X-Plex-Product': 'FlickTV',
      'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)',
    });
    console.log('  Status:', r2.status);
    console.log('  Content-Type:', r2.headers['content-type']);
    console.log('  Body preview:', r2.body.substring(0, 300));
  } catch(e) {
    console.log('  Error:', e.message);
  }
  
  console.log('\nTest 3: includeAllStreams variant');
  try {
    const r3 = await fetchUrl(baseUrl + '?includeAllStreams=1', {
      'X-Plex-Token': '9F1pDPzr73oL_idfzXye',
      'X-Plex-Product': 'FlickTV',
      'User-Agent': 'Mozilla/5.0 (compatible; FlickTV/1.0)',
    });
    console.log('  Status:', r3.status);
    console.log('  Content-Type:', r3.headers['content-type']);
    console.log('  Body preview:', r3.body.substring(0, 300));
  } catch(e) {
    console.log('  Error:', e.message);
  }
})();
