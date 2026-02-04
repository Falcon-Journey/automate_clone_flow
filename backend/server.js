import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

// Playwright browsers path: only override on macOS (Linux/Docker use default or image-provided)
if (os.platform() === 'darwin') {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(os.homedir(), 'Library/Caches/ms-playwright');
}

// Detect Docker (container) for headless + Chromium args
const isDocker = process.env.DOCKER === '1' || fs.existsSync('/.dockerenv');

// Headless: true in Docker (no display), false locally (headful) unless PLAYWRIGHT_HEADED=0
const isHeadless = isDocker ? true : process.env.PLAYWRIGHT_HEADED === '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Serve static screenshots
app.use('/screenshots', express.static(screenshotsDir));

// Anima credentials (set ANIMA_EMAIL, ANIMA_PASSWORD in production e.g. AWS)
const ANIMA_EMAIL = process.env.ANIMA_EMAIL || 'akkisinghal50+4@gmail.com';
const ANIMA_PASSWORD = process.env.ANIMA_PASSWORD || 'Test123@';

// Clone website endpoint with Server-Sent Events for progress
app.get('/api/clone-stream', async (req, res) => {
  const url = req.query.url;
  const prompt = req.query.prompt || '';

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  console.log(`\n🚀 Starting clone process for: ${url}`);
  sendProgress({ type: 'status', message: 'Starting clone process...', step: 1 });
  
  let browser;
  
  try {
    // Launch browser: headless in Docker, headful locally (set PLAYWRIGHT_HEADED=0 for headless locally)
    console.log(`📦 Launching browser (${isHeadless ? 'headless' : 'headful'})...`);
    
    const launchOptions = {
      headless: isHeadless,
      slowMo: isHeadless ? 0 : 50,
    };
    if (isDocker) {
      launchOptions.args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ];
    }
    browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Navigate to platform
    //sendProgress({ type: 'status', message: 'Navigating to platform...', step: 3 });
    console.log('🌐 Navigating to platform...');
    
    await page.goto('https://dev.animaapp.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    // Click on Tools button
    //sendProgress({ type: 'status', message: 'Opening Tools menu...', step: 4 });
    console.log('🔧 Clicking Tools button...');
    //await page.getByRole('button', { name: 'Tools' }).click();
    //await page.waitForTimeout(1000);

    // Click on Clone Website option
    //sendProgress({ type: 'status', message: 'Selecting Clone Website...', step: 5 });
    console.log('📋 Selecting Clone Website...');
    //await page.getByRole('menuitem', { name: 'Clone Website' }).click();
    //await page.waitForTimeout(1000);

    // Fill in the URL first
    //sendProgress({ type: 'status', message: `Entering URL: ${url}`, step: 6 });
    console.log(`📝 Entering URL: ${url}`);
    

    // If prompt is provided, add it after URL
    if (prompt && prompt.trim()) {
      sendProgress({ type: 'status', message: 'Adding custom instructions...', step: 7 });
      console.log(`💬 Adding custom instructions: ${prompt.substring(0, 50)}...`);
      try {
        // Click on the second paragraph, then first paragraph
        await page.getByRole('paragraph').nth(1).click();
        await page.waitForTimeout(300);
        await page.getByRole('paragraph').first().click();
        await page.waitForTimeout(300);
        // Fill in the prompt textbox
        await page.getByRole('textbox').fill(prompt.trim() + `\n\n\n`);
        await page.getByRole('textbox').type(`/`);
        await page.waitForTimeout(1000);
        await page.getByText('Clone Website').click();
        await page.getByRole('textbox', { name: 'Paste your link here' }).click();
    await page.getByRole('textbox', { name: 'Paste your link here' }).fill(url);
    await page.waitForTimeout(3000);
      } catch (e) {
        console.log('⚠️ Could not add prompt, continuing without it:', e.message);
      }
    }

    // Click submit button
    //sendProgress({ type: 'status', message: 'Submitting...', step: prompt ? 8 : 7 });
    console.log('▶️ Clicking submit...');
    await page.getByTestId('import-submit-button').click();
    await page.waitForTimeout(2000);

    // Check if login is required - look for Login button
    //sendProgress({ type: 'status', message: 'Checking authentication...', step: prompt ? 9 : 8 });
    console.log('🔐 Checking if login is required...');
    
    const loginButton = await page.getByRole('button', { name: 'Log in' }).isVisible().catch(() => false);
    
    if (loginButton) {
      //sendProgress({ type: 'status', message: 'Login required. Authenticating...', step: prompt ? 10 : 9 });
      console.log('🔑 Login required. Clicking Login button...');
      
      await page.getByRole('button', { name: 'Log in' }).click();
      await page.waitForTimeout(2000);

      // Fill in credentials
      //sendProgress({ type: 'status', message: 'Entering credentials...', step: prompt ? 11 : 10 });
      console.log('📧 Entering email...');
      await page.getByRole('textbox', { name: 'name@email.com' }).click();
      await page.getByRole('textbox', { name: 'name@email.com' }).fill(ANIMA_EMAIL);
      
      console.log('🔒 Entering password...');
      await page.getByRole('textbox', { name: 'Type your password here' }).click();
      await page.getByRole('textbox', { name: 'Type your password here' }).fill(ANIMA_PASSWORD);
      
      // Click Sign In
      //sendProgress({ type: 'status', message: 'Signing in...', step: prompt ? 12 : 11 });
      console.log('▶️ Clicking Sign In...');
      await page.getByRole('button', { name: 'Sign In' }).click();
      
      // Wait for login to complete
      await page.waitForTimeout(5000);
      
      // After login, navigate back and repeat clone process
      //sendProgress({ type: 'status', message: 'Login successful! Restarting clone process...', step: prompt ? 13 : 12 });
      console.log('✅ Login successful! Navigating back to platform...');
      
      await page.goto('https://dev.animaapp.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(3000);

      // Repeat: Click on Tools
      //sendProgress({ type: 'status', message: 'Opening Tools menu again...', step: prompt ? 14 : 13 });
      //console.log('🔧 Clicking Tools button again...');
      //await page.getByRole('button', { name: 'Tools' }).click();
      //await page.waitForTimeout(1000);

      // Repeat: Click Clone Website
     // sendProgress({ type: 'status', message: 'Selecting Clone Website...', step: prompt ? 15 : 14 });
      //console.log('📋 Selecting Clone Website...');
      //await page.getByRole('menuitem', { name: 'Clone Website' }).click();
      //await page.waitForTimeout(1000);

      // Repeat: Enter URL first
      //sendProgress({ type: 'status', message: `Entering URL: ${url}`, step: prompt ? 16 : 15 });
      console.log(`📝 Entering URL: ${url}`);
      //await page.getByRole('textbox', { name: 'Paste your link here' }).click();
      //await page.getByRole('textbox', { name: 'Paste your link here' }).fill(url);
      //await page.waitForTimeout(1000);

      // If prompt is provided, add it after URL
      if (prompt && prompt.trim()) {
        //sendProgress({ type: 'status', message: 'Adding custom instructions...', step: 17 });
        console.log(`💬 Adding custom instructions: ${prompt.substring(0, 50)}...`);
        try {
          // Click on the second paragraph, then first paragraph
          await page.getByRole('paragraph').nth(1).click();
        await page.waitForTimeout(300);
        await page.getByRole('paragraph').first().click();
        await page.waitForTimeout(300);
        // Fill in the prompt textbox
        await page.getByRole('textbox').fill(prompt.trim() + `\n\n\n`);
        await page.getByRole('textbox').type(`/`);
        await page.waitForTimeout(1000);
        await page.getByText('Clone Website').click();
        await page.getByRole('textbox', { name: 'Paste your link here' }).click();
    await page.getByRole('textbox', { name: 'Paste your link here' }).fill(url);
    await page.waitForTimeout(3000);
        } catch (e) {
          console.log('⚠️ Could not add prompt, continuing without it:', e.message);
        }
      }

      // Click submit button
      sendProgress({ type: 'status', message: 'Submitting...', step: prompt ? 18 : 16 });
      console.log('▶️ Clicking submit...');
      await page.getByTestId('import-submit-button').click();
      await page.waitForTimeout(2000);
    }

    // Wait for loading page and monitor progress
    sendProgress({ type: 'status', message: 'Generation process started! Monitoring progress...', step: prompt ? 19 : 17 });
    console.log('⏳ Generation process started. Monitoring progress...');
    
    // Wait a bit for redirect to loading page
    await page.waitForTimeout(5000);
    
    let currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Monitor progress - this can take 20-30 minutes
    const maxWaitTime = 35 * 60 * 1000; // 35 minutes max
    const startTime = Date.now();
    let lastProgress = '';
    let previewReady = false;
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        currentUrl = page.url();
        
        // Check if we're on the chat page (preview ready)
        if (currentUrl.includes('/chat/')) {
          previewReady = true;
          sendProgress({ type: 'status', message: 'Preview is ready!', step: 21, progress: 100 });
          console.log('✅ Preview is ready!');
          break;
        }
        
        // Try to extract progress percentage
        const progressText = await page.evaluate(() => {
          // Look for progress indicators
          const progressElements = document.querySelectorAll('h1, h2, h3, div');
          for (const el of progressElements) {
            const text = el.textContent || '';
            // Match percentage patterns like "22%" or "Scanning page elements: 31%"
            const match = text.match(/(\d+)%/);
            if (match) {
              return { percent: parseInt(match[1]), text: text.trim() };
            }
          }
          
          // Look for status text
          const statusTexts = ['Creating visual direction', 'Scanning page elements', 'Project structure', 'Let\'s build'];
          for (const el of progressElements) {
            const text = el.textContent || '';
            for (const status of statusTexts) {
              if (text.includes(status)) {
                return { percent: null, text: text.trim().substring(0, 100) };
              }
            }
          }
          
          return null;
        }).catch(() => null);
        
        if (progressText) {
          const progressMessage = progressText.percent !== null 
            ? `${progressText.text} (${progressText.percent}%)`
            : progressText.text;
          
          if (progressMessage !== lastProgress) {
            lastProgress = progressMessage;
            sendProgress({ 
              type: 'progress', 
              message: progressMessage, 
              progress: progressText.percent || 0,
              step: 16 
            });
            console.log(`📊 Progress: ${progressMessage}`);
          }
        }
        
        // Take periodic screenshots
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed % 30 === 0) { // Every 30 seconds
          const screenshotFilename = `progress-${Date.now()}.png`;
          const screenshotPath = path.join(screenshotsDir, screenshotFilename);
          await page.screenshot({ path: screenshotPath }).catch(() => {});
          console.log(`📸 Progress screenshot saved: ${screenshotFilename}`);
        }
        
      } catch (e) {
        // Ignore errors during progress monitoring
      }
      
      // Wait before checking again
      await page.waitForTimeout(3000);
    }
    
    if (!previewReady) {
      // Check one more time if we're on chat page
      currentUrl = page.url();
      if (currentUrl.includes('/chat/')) {
        previewReady = true;
      }
    }
    
    // Take final screenshot
    const finalScreenshotFilename = `clone-final-${Date.now()}.png`;
    const finalScreenshotPath = path.join(screenshotsDir, finalScreenshotFilename);
    
    //sendProgress({ type: 'status', message: 'Taking final screenshot...', step: 20 });
    console.log('📸 Taking final screenshot...');
    await page.screenshot({ path: finalScreenshotPath, fullPage: false });
    
    // If preview is ready, try to publish the website
    let previewScreenshot = null;
    let publishedUrl = null;
    
    if (previewReady) {
      try {
        // Wait for page to be ready
        await page.waitForTimeout(3000);
        
        // Wait 10 seconds before checking for "Making edits..."
        sendProgress({ type: 'status', message: 'Waiting before checking edits...', step: 20 });
        console.log('⏳ Waiting 10 seconds before checking for "Making edits..."...');
        await page.waitForTimeout(10000);
        
        // Wait for "Making edits..." to complete before publishing (ensure Anima is not still editing)
        sendProgress({ type: 'status', message: 'Checking if edits are complete...', step: 20 });
        console.log('🔍 Checking for "Making edits..." phase...');
        const makingEditsVisible = await page.getByText('Making edits...').isVisible().catch(() => false);
        if (makingEditsVisible) {
          sendProgress({ type: 'status', message: 'Waiting for "Making edits..." to complete before publishing...', step: 20 });
          console.log('⏳ "Making edits..." in progress - waiting for it to complete...');
          try {
            await page.getByText('Making edits...').waitFor({ state: 'hidden', timeout: 600000 }); // 10 min max
            console.log('✅ "Making edits..." completed');
            sendProgress({ type: 'status', message: 'Edits complete. Proceeding to publish...', step: 21 });
            await page.waitForTimeout(2000);
          } catch (e) {
            console.log('⚠️ Timeout waiting for "Making edits..." to complete, proceeding with publish...');
          }
        } else {
          console.log('✅ No "Making edits..." in progress - safe to publish');
        }
        
        // Wait for "Loading..." to disappear before taking preview screenshot
        sendProgress({ type: 'status', message: 'Waiting for preview to load...', step: 21 });
        console.log('🔍 Checking for "Loading..." in preview...');
        const loadingVisible = await page.getByText('Loading...').isVisible().catch(() => false);
        if (loadingVisible) {
          sendProgress({ type: 'status', message: 'Waiting for "Loading..." to complete...', step: 21 });
          console.log('⏳ "Loading..." in progress - waiting for it to disappear...');
          try {
            await page.getByText('Loading...').waitFor({ state: 'hidden', timeout: 120000 }); // 2 min max
            console.log('✅ "Loading..." completed');
          } catch (e) {
            console.log('⚠️ Timeout waiting for "Loading..." to complete, proceeding with screenshot...');
          }
        }
        // Wait 4-5 seconds after loading is gone so preview is fully rendered
        sendProgress({ type: 'status', message: 'Preview settling...', step: 21 });
        console.log('⏳ Waiting 5 seconds for preview to settle...');
        await page.waitForTimeout(5000);
        
        // Take screenshot of the Anima preview (iframe area) so user sees it while publishing
        const previewFilename = `preview-${Date.now()}.png`;
        const previewPath = path.join(screenshotsDir, previewFilename);
        try {
          const iframe = page.locator('iframe').first();
          const box = await iframe.boundingBox();
          if (box && box.width > 0 && box.height > 0) {
            await page.screenshot({ path: previewPath, clip: box });
            console.log('✅ Preview captured from Anima iframe area');
          } else {
            await page.screenshot({ path: previewPath, fullPage: false });
          }
        } catch (e) {
          console.log('⚠️ Iframe clip screenshot failed, using page screenshot:', e.message);
          await page.screenshot({ path: previewPath, fullPage: false });
        }
        previewScreenshot = `/screenshots/${previewFilename}`;
        
        // Send preview to user immediately so they see it while publish runs
        sendProgress({ type: 'preview_ready', previewScreenshot, message: 'Preview ready. Publishing your site...' });
        console.log('✅ Preview sent to user. Starting publish process...');
        
        const maxPublishAttempts = 2;
        for (let attempt = 1; attempt <= maxPublishAttempts; attempt++) {
          try {
            if (attempt > 1) {
              sendProgress({ type: 'status', message: `Retrying publish (attempt ${attempt}/${maxPublishAttempts})...`, step: 22 });
              console.log(`🔄 Retrying publish - attempt ${attempt}/${maxPublishAttempts}`);
              await page.waitForTimeout(3000);
            }
            
            // Click on Publish button (the trigger button)
            console.log('📤 Clicking Publish button...');
            const publishTrigger = await page.locator('button:has-text("Publish")').first();
            await publishTrigger.click();
            await page.waitForTimeout(2000);
            
            // Click the second Publish button in the dropdown/sheet
            sendProgress({ type: 'status', message: 'Publishing website...', step: 23 });
            console.log('🚀 Clicking Publish in dropdown...');
            const publishButton = await page.locator('button.w-full:has-text("Publish")').first();
            await publishButton.click();
            
            // Wait for publishing to complete
            sendProgress({ type: 'status', message: 'Waiting for publish to complete...', step: 24 });
            console.log('⏳ Waiting for publish to complete...');
            try {
              await page.waitForSelector('text=LIVE!', { timeout: 60000 });
              console.log('✅ LIVE! badge appeared - publish complete');
            } catch (e) {
              console.log('⚠️ LIVE badge not found this attempt');
            }
            
            await page.waitForTimeout(3000);
            
            // Open sheet and extract published URL
            sendProgress({ type: 'status', message: 'Opening published details...', step: 25 });
            console.log('📋 Clicking on Published button to get URL...');
            try {
              const sheetOpen = await page.locator('span.text-blue-500').first().isVisible();
              if (!sheetOpen) {
                const publishedBtn = await page.locator('button:has-text("Publish")').first();
                await publishedBtn.click();
                await page.waitForTimeout(2000);
              }
            } catch (e) {
              console.log('⚠️ Could not check sheet state');
            }
            
            const sheetScreenshot = `publish-sheet-${Date.now()}.png`;
            await page.screenshot({ path: path.join(screenshotsDir, sheetScreenshot), fullPage: false });
            
            console.log('🔍 Looking for published URL in sheet...');
            try {
              const domainSpan = await page.locator('span.text-blue-500').first();
              if (await domainSpan.isVisible()) {
                const domainText = await domainSpan.textContent();
                if (domainText && domainText.includes('.dev.animaapp.io')) {
                  publishedUrl = `https://${domainText.trim()}`;
                  sendProgress({ type: 'status', message: `Website published at: ${publishedUrl}`, step: 27 });
                  console.log(`✅ Website published at: ${publishedUrl}`);
                  break;
                }
              }
            } catch (e) {
              console.log('⚠️ Could not find published URL from span:', e.message);
            }
            
            if (!publishedUrl) {
              try {
                const allText = await page.evaluate(() => {
                  const elements = document.querySelectorAll('span, a, div');
                  for (const el of elements) {
                    const text = el.textContent || '';
                    if (text.includes('.dev.animaapp.io') && !text.includes(' ')) {
                      return text.trim();
                    }
                  }
                  return null;
                });
                if (allText) {
                  publishedUrl = `https://${allText}`;
                  console.log(`✅ Found published URL via evaluate: ${publishedUrl}`);
                  break;
                }
              } catch (e) {
                console.log('⚠️ Could not extract published URL via evaluate');
              }
            }
            
            if (publishedUrl) break;
          } catch (e) {
            console.log(`⚠️ Publish attempt ${attempt} failed:`, e.message);
          }
        }
        
        if (!publishedUrl) {
          console.log('⚠️ Publish failed after all retries - showing user preview screenshot');
          sendProgress({ type: 'status', message: 'Publish could not be completed. Showing preview.', step: 27 });
        }
        
        const finalPublishScreenshot = `published-${Date.now()}.png`;
        await page.screenshot({ path: path.join(screenshotsDir, finalPublishScreenshot), fullPage: false }).catch(() => {});
        
      } catch (e) {
        console.log('⚠️ Error during publish process:', e.message);
        sendProgress({ type: 'status', message: 'Publish process encountered an issue. Showing preview.', step: 19 });
      }
    }
    
    // Get the final URL
    const editUrl = page.url();
    console.log(`✅ Generation complete! Final URL: ${editUrl}`);
    
    // Send completion (always include previewScreenshot so user sees preview even if publish failed)
    sendProgress({
      type: 'complete',
      success: true,
      screenshot: `/screenshots/${finalScreenshotFilename}`,
      previewScreenshot: previewScreenshot,
      editUrl: editUrl,
      publishedUrl: publishedUrl,
      message: publishedUrl 
        ? 'Landing page generated and published successfully!' 
        : (previewReady ? 'Landing page generated! Publish could not be completed — preview shown below.' : 'Generation process completed (check platform for results)')
    });
    
    // Keep browser open for user to interact
    console.log('🎉 Process complete! Browser will remain open for 2 minutes...');
    //sendProgress({ type: 'status', message: 'Done! Browser will stay open for 2 minutes for you to explore.', step: 21 });
    
    await page.waitForTimeout(120000); // Keep open for 2 minutes
    
    await browser.close();
    res.end();

  } catch (error) {
    console.error('❌ Error during cloning:', error.message);
    
    sendProgress({
      type: 'error',
      error: `Failed to clone website: ${error.message}`,
      details: error.stack
    });
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    
    res.end();
  }
});

// Regular POST endpoint (non-streaming fallback)
app.post('/api/clone', async (req, res) => {
  const { url } = req.body;
  
  // Redirect to streaming endpoint
  res.json({
    message: 'Please use the streaming endpoint: GET /api/clone-stream?url=<your-url>',
    streamUrl: `/api/clone-stream?url=${encodeURIComponent(url)}`
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Optional: serve frontend static build (set SERVE_FRONTEND=1 and copy frontend dist into backend/frontend-dist)
const frontendDist = path.join(__dirname, 'frontend-dist');
if (process.env.SERVE_FRONTEND === '1' && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/screenshots')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Website Cloner Backend Started!
📍 Server running at: http://localhost:${PORT}
🔗 Stream endpoint: GET http://localhost:${PORT}/api/clone-stream?url=<website-url>
💡 Health check: GET http://localhost:${PORT}/api/health
  `);
});
