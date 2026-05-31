import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log('__dirname:', __dirname);
console.log('public path:', path.join(__dirname, '..', 'public'));
console.log('exists?', require('fs').existsSync(path.join(__dirname, '..', 'public', 'admin.html')));
