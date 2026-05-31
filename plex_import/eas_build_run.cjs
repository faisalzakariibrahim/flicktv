const { execFileSync } = require('child_process');
const fs = require('fs');

const token = fs.readFileSync('/tmp/.eas_token', 'utf8').trim();
process.env.EXPO_TOKEN = token;
process.env.EAS_NO_AUTO_UPDATE = '1';

const cwd = '/Users/kingfaisal/projects/flicktv/mobile';

try {
  execFileSync('npx', ['eas-cli', 'whoami'], { cwd, env: process.env, stdio: 'pipe' });
  console.log('Authenticated');
} catch(e) {
  console.error('Auth failed:', e.stderr?.toString());
  process.exit(1);
}

try {
  console.log('\n=== Android build ===');
  execFileSync('npx', ['eas-cli', 'build', '--platform', 'android', '--profile', 'production', '--non-interactive'], {
    cwd, env: process.env, stdio: 'inherit', timeout: 900000,
  });
} catch(e) {
  console.error('Build error:', e.message);
}

try {
  console.log('\n=== iOS build ===');
  execFileSync('npx', ['eas-cli', 'build', '--platform', 'ios', '--profile', 'production', '--non-interactive'], {
    cwd, env: process.env, stdio: 'inherit', timeout: 900000,
  });
} catch(e) {
  console.error('Build error:', e.message);
}
