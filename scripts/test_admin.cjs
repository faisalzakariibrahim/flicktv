// Test that admin.html is served correctly
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const publicPath = path.join(__dirname, 'backend', 'public');
console.log('Public path:', publicPath);
console.log('admin.html exists:', fs.existsSync(path.join(publicPath, 'admin.html')));

app.use('/admin', express.static(publicPath, { index: 'admin.html' }));
app.get('/admin', (_req, res) => res.redirect('/admin/'));

const server = app.listen(3099, async () => {
  console.log('Test server on :3099');
  
  try {
    const r1 = await fetch('http://localhost:3099/admin/');
    console.log('GET /admin/ status:', r1.status);
    const text = await r1.text();
    console.log('First 100 chars:', text.substring(0, 100));
    
    const r2 = await fetch('http://localhost:3099/admin');
    console.log('GET /admin status:', r2.status, r2.url);
  } catch (e) {
    console.error('Test error:', e.message);
  }
  
  server.close();
});
