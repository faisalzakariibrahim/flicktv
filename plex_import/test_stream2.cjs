const https = require('https');

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        url: res.responseUrl || url,
        body: data.substring(0, 2000),
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  const plexUrl = 'https://epg.provider.plex.tv/library/parts/6a1610bebdf296985fd95603-62b45f15b4508e0eedacdf26.m3u8';
  
  // Step 1: Hit Plex with token, follow redirect
  console.log('Step 1: Fetch Plex URL with token');
  const r1 = await fetchUrl(plexUrl, {
    'X-Plex-Token': '9F1pDPzr73oL_idfzXye',
    'X-Plex-Product': 'FlickTV',
    'User-Agent': 'Mozilla/5.0',
  });
  console.log('  Status:', r1.status);
  console.log('  Final URL:', r1.url);
  console.log('  Content-Type:', r1.headers['content-type']);
  console.log('  Body preview:\n' + r1.body.substring(0, 500));
  
  // Step 2: Check if the manifest has variant playlists or direct segments
  if (r1.body.includes('.m3u8')) {
    console.log('\n  Contains variant playlists — need to fetch those too');
    const lines = r1.body.split('\n');
    const variantLines = lines.filter(l => l.trim() && !l.startsWith('#') && l.includes('.m3u8'));
    console.log('  Variant URLs:', variantLines.slice(0, 3));
  }
})();
