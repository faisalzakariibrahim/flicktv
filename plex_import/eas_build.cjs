const { execSync, execFileSync } = require('child_process');

// Read token from stdin to avoid any env masking
const fs= require('fs');
const path = require('path');

// Write token to temp file then read it
const tmpFile = '/tmp/.eas_token';
fs.writeFileSync(tmpFile, 'W', 'utf8');

const token = fs.readFileSync(tmpFile, 'utf8').trim();
fs.unlinkSync(tmpFile);

process.env.EXPO_TOKEN = token;
process.env.EAS_NO_AUTO_UPDATE = '1';

const cwd = '/Users/kingfaisal/projects/flicktv/mobile';

async function run() {
  try {
    const out = execSync('npx eas-cli whoami', { cwd, env: process.env, stdio: 'pipe' });
    console.log('Auth:', out.toString().trim());
  } catch(e) {
    console.error('Auth failed:', e.stderr?.toString() || e.message);
    process.exit(1);
  }

  try {
    console.log('\n=== Android build ===');
    execFileSync('npx', ['eas-cli', 'build', '--platform', 'android', '--profile', 'production', '--non-interactive'], {
      cwd, env: process.env, stdio: 'inherit', timeout: 600000,
    });
  } catch(e) {
    console.error('Android failed:', e.message);
  }

  try {
    console.log('\n=== iOS build ===');
    execFileSync('npx', ['eas-cli', 'build', '--platform', 'ios', '--profile', 'production', '--non-interactive'], {
      cwd, env: process.env, stdio: 'inherit', timeout: 600000,
    });
  } catch(e) {
    console.error('iOS failed:', e.message);
  }
}

run();
