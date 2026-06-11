/**
 * FlickTV AI — TikTok Free Upload via Browser Automation
 * 
 * No API credentials needed. Uses headless browser to upload
 * highlight clips directly to TikTok via their web interface.
 * 
 * Requirements:
 *   - A logged-in TikTok creator account in the browser
 *   - TIKTOK_COOKIE env var (optional — for persistent login)
 * 
 * Usage:
 *   node tiktokUploader.js --video /path/to/clip.mp4 --caption "⚽ GOAL!"
 */

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Upload a video to TikTok via browser automation
 * 
 * @param {string} videoPath - Path to the video file
 * @param {string} caption - Video caption/hashtags
 * @param {object} options - Additional options
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadToTikTok(videoPath, caption, options = {}) {
  const {
    headless = true,
    cookieFile = process.env.TIKTOK_COOKIE || null,
    timeout = 120000,
  } = options;

  if (!existsSync(videoPath)) {
    return { success: false, error: `Video not found: ${videoPath}` };
  }

  const absPath = path.resolve(videoPath);
  let browser;
  let context;

  try {
    // Launch browser
    const launchOptions = {
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };

    browser = await chromium.launch(launchOptions);

    // Create context with viewport
    context = await browser.newContext({
      viewport: { width: 1080, height: 1920 }, // Mobile viewport for TikTok
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });

    // Load cookies if available (for persistent login)
    if (cookieFile && existsSync(cookieFile)) {
      try {
        const cookies = JSON.parse(await import('fs').then(f => f.promises.readFile(cookieFile, 'utf8')));
        await context.addCookies(cookies);
        console.log('🍪 TikTok cookies loaded');
      } catch (err) {
        console.warn('⚠️ Failed to load cookies:', err.message);
      }
    }

    const page = await context.newPage();

    // Navigate to TikTok creator/upload page
    console.log('📱 Opening TikTok creator page...');
    await page.goto('https://www.tiktok.com/creator-center/upload', {
      waitUntil: 'networkidle',
      timeout,
    });

    // Check if we need to login
    const needsLogin = await page.$('button[data-e2e="login-button"]') !== null
      || await page.url().includes('/login');

    if (needsLogin && !cookieFile) {
      console.log('⚠️ Not logged in. Please set TIKTOK_COOKIE env var with your TikTok cookies.');
      console.log('   To get cookies: log into TikTok in your browser, open DevTools → Application → Cookies → Copy all as JSON');
      await browser.close();
      return { success: false, error: 'Not logged in. Set TIKTOK_COOKIE env var.' };
    }

    // Wait for upload area to appear
    console.log('⏳ Waiting for upload area...');
    await page.waitForSelector('input[type="file"]', { timeout: 30000 }).catch(() => {
      // Try alternative selectors
      return page.waitForSelector('[class*="upload"]', { timeout: 15000 });
    });

    // Upload the video file
    console.log(`📤 Uploading: ${absPath}`);
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.setInputFiles(absPath);
    } else {
      // Try drag-and-drop area
      const dropZone = await page.$('[class*="drag"]') || await page.$('[class*="upload"]');
      if (dropZone) {
        await dropZone.setInputFiles(absPath);
      }
    }

    // Wait for upload to complete
    console.log('⏳ Waiting for upload to process...');
    await page.waitForTimeout(5000); // Give it time to start uploading

    // Wait for processing to complete (look for caption input)
    await page.waitForSelector('div[contenteditable="true"], textarea, [class*="caption"]', {
      timeout: 60000,
    });

    // Add caption
    console.log('✍️ Adding caption...');
    const captionInput = await page.$('div[contenteditable="true"]')
      || await page.$('[class*="caption"]')
      || await page.$('textarea');

    if (captionInput) {
      await captionInput.click();
      await captionInput.fill(caption);
      await page.waitForTimeout(1000);
    }

    // Click post button
    console.log('📤 Clicking post...');
    const postButton = await page.$('button:has-text("Post")')
      || await page.$('button:has-text("Publish")')
      || await page.$('[class*="post-button"]')
      || await page.$('button[data-e2e="post-button"]');

    if (postButton) {
      await postButton.click();
    }

    // Wait for confirmation
    console.log('⏳ Waiting for post confirmation...');
    await page.waitForTimeout(10000);

    // Check for success
    const currentUrl = page.url();
    const success = !currentUrl.includes('/upload') || await page.$('[class*="success"]') !== null;

    // Save cookies for next time
    if (!cookieFile) {
      const cookies = await context.cookies();
      const cookiePath = path.join(__dirname, '.tiktok-cookies.json');
      await import('fs').then(f => f.promises.writeFile(cookiePath, JSON.stringify(cookies, null, 2)));
      console.log(`🍪 Cookies saved to ${cookiePath}`);
    }

    await browser.close();

    if (success) {
      console.log('✅ TikTok upload complete!');
      return { success: true, url: 'https://www.tiktok.com' };
    } else {
      return { success: false, error: 'Upload may have failed — check TikTok manually' };
    }

  } catch (err) {
    console.error('❌ TikTok upload failed:', err.message);
    if (browser) await browser.close();
    return { success: false, error: err.message };
  }
}

/**
 * Extract cookies from browser for TikTok login
 * Run this once to save your login session
 */
export async function extractTikTokCookies(email, password) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1080, height: 1920 },
    });
    const page = await context.newPage();

    await page.goto('https://www.tiktok.com/login', { waitUntil: 'networkidle' });

    // Note: TikTok login often requires CAPTCHA
    // This is best done manually in a headed browser
    console.log('🔐 Please log in manually in the browser window...');
    console.log('   (This works best with headless: false)');

    // Wait for login to complete
    await page.waitForUrl('**/creator-center/**', { timeout: 120000 }).catch(() => {
      return page.waitForUrl('**/foryou/**', { timeout: 30000 });
    });

    const cookies = await context.cookies();
    const cookiePath = path.join(__dirname, '.tiktok-cookies.json');
    await import('fs').then(f => f.promises.writeFile(cookiePath, JSON.stringify(cookies, null, 2)));
    console.log(`🍪 Cookies saved to ${cookiePath}`);
    console.log(`   Set TIKTOK_COOKIE=${cookiePath} in your env`);

    await browser.close();
    return { success: true, cookiePath };

  } catch (err) {
    if (browser) await browser.close();
    return { success: false, error: err.message };
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'upload';
const videoArg = args.find(a => a.startsWith('--video='))?.split('=')[1];
const captionArg = args.find(a => a.startsWith('--caption='))?.split('=')[1] || '';

if (mode === 'login') {
  const result = await extractTikTokCookies();
  console.log(result);
} else if (mode === 'upload' && videoArg) {
  const result = await uploadToTikTok(videoArg, captionArg);
  console.log(result);
} else {
  console.log('Usage:');
  console.log('  node tiktokUploader.js --mode=upload --video=/path/to/clip.mp4 --caption="⚽ GOAL!"');
  console.log('  node tiktokUploader.js --mode=login  (extract cookies for persistent login)');
}

export default { uploadToTikTok, extractTikTokCookies };
