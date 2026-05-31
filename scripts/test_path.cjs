// Test that admin.html is served correctly
const path = require('path');
const fs = require('fs');

const publicPath = path.join('/Users/kingfaisal/projects/flicktv', 'backend', 'public');
console.log('Public path:', publicPath);
console.log('admin.html exists:', fs.existsSync(path.join(publicPath, 'admin.html')));
