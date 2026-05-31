const { execSync } = require('child_process');
const token = 'WAhFH...';
process.env.EXPO_TOKEN = token;
process.env.EAS_NO_AUTO_UPDATE = '1';

try {
  console.log('=== Building Android ===');
  const result = execSync('npx eas-cli build --platform android --profile production --non-interactive', {
    cwd: '/Users/kingfaisal/projects/flicktv/mobile',
    env: process.env,
    stdio: 'inherit',
    timeout: 600000,
  });
} catch(e) {
  console.error('Android build failed:', e.message);
}
