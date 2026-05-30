const https = require('https');
const http = require('http');

function fetchFollowRedirect(url, headers = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects === 0) return reject(new Error('too many redirects'));
    
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('  Redirect ' + res.statusCode + ' -> ' + res.headers.location.substring(0, 100));
        // Follow redirect with same headers
        fetchFollowRedirect(res.headers.location, headers, maxRedirects - 1).then(resolve, reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        url: url,
        headers: res.headers,
        body: data,
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  const plexUrl = 'https://epg.provider.plex.tv/library/parts/6a1610bebdf296985fd95603-62b45f15b4508e0eedacdf26.m3u8';
  
  console.log('Fetching Plex stream with redirect following...');
  const r = await fetchFollowRedirect(plexUrl, {
    'X-Plex-Token': '9F1pDPzr73oL_idfzXye',
    'X-Plex-Product': 'FlickTV',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    'Accept': '*/*',
  });
  
  console.log('Final status:', r.status);
  console.log('Final URL:', r.url);
  console.log('Content-Type:', r.headers['content-type']);
  console.log('Body length:', r.body.length);
  console.log('Body preview:\n' + r.body.substring(0, 1000));
  
  // Check if it's a master playlist with variants
  if (r.body.includes('#EXT-X-STREAM-INF')) {
    console.log('\n=== MASTER PLAYLIST ===');
    const lines = r.body.split('\n');
    lines.forEach(line => {
      if (line.startsWith('#EXT-X-STREAM-INF') || (!line.startsWith('#') && line.trim())) {
        console.log(line);
      }
    });
  }
})();
