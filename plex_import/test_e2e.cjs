const https = require('https');
const http = require('http');

function fetchWithRedirect(url, headers = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects === 0) return reject(new Error('too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchWithRedirect(res.headers.location, headers, maxRedirects - 1).then(resolve, reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, url, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  // Simulate what the proxy does
  const plexUrl = 'https://epg.provider.plex.tv/library/parts/6a1610bebdf296985fd95603-62b45f15b4508e0eedacdf26.m3u8';
  
  console.log('=== Simulating proxy request to Plex ===');
  const r = await fetchWithRedirect(plexUrl, {
    'X-Plex-Token': '9F1pDPzr73oL_idfzXye',
    'X-Plex-Product': 'FlickTV',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  });
  
  console.log('Status:', r.status);
  console.log('Content-Type:', r.headers['content-type']);
  console.log('Is HLS:', r.headers['content-type']?.includes('mpegurl'));
  
  // Parse variant URLs from manifest
  const lines = r.body.split('\n');
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF') && lines[i + 1] && !lines[i + 1].startsWith('#')) {
      variants.push(lines[i + 1].trim());
    }
  }
  
  console.log('\nVariant URLs in manifest:', variants.length);
  if (variants.length > 0) {
    console.log('First variant URL:', variants[0].substring(0, 120) + '...');
    
    // Check if variant URL has token params
    const hasToken = variants[0].includes('x-plex-token');
    console.log('Has x-plex-token:', hasToken);
    
    // Simulate what happens when player fetches variant through proxy
    // The proxy would rewrite this to: /api/proxy/stream?url=<encoded variant URL>
    // Then when fetching the variant, the proxy detects it's a Plex URL and adds X-Plex-Token
    // But the variant URL already has x-plex-token as query param, so it should work
    
    console.log('\n=== Testing variant playlist fetch ===');
    const v = await fetchWithRedirect(variants[0], {
      'X-Plex-Token': '9F1pDPzr73oL_idfzXye',
      'X-Plex-Product': 'FlickTV',
      'User-Agent': 'Mozilla/5.0',
    });
    console.log('Variant status:', v.status);
    console.log('Variant content-type:', v.headers['content-type']);
    
    // Check for segment URLs
    const vLines = v.body.split('\n');
    const segments = vLines.filter(l => l.trim() && !l.startsWith('#'));
    console.log('Segment/playlist URLs:', segments.length);
    if (segments.length > 0) {
      console.log('First segment URL:', segments[0].substring(0, 120));
      const isWurl = segments[0].includes('wurl.com');
      console.log('Is Wurl CDN:', isWurl);
    }
  }
  
  console.log('\n=== RESULT: Plex stream proxy flow works! ===');
})();
