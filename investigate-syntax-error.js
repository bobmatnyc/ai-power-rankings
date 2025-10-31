const playwright = require('@playwright/test');

async function investigate() {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];

  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const location = msg.location();
      console.log(`\n[CONSOLE ERROR]`);
      console.log(`Message: ${msg.text()}`);
      console.log(`URL: ${location.url}`);
      console.log(`Line: ${location.lineNumber}`);
      console.log(`Column: ${location.columnNumber}`);
      errors.push({
        message: msg.text(),
        url: location.url,
        line: location.lineNumber,
        column: location.columnNumber
      });
    }
  });

  // Capture page errors with full stack traces
  page.on('pageerror', error => {
    console.log(`\n[PAGE ERROR]`);
    console.log(`Message: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
    errors.push({
      message: error.message,
      stack: error.stack
    });
  });

  console.log('Loading https://aipowerranking.com ...');

  try {
    await page.goto('https://aipowerranking.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for page to fully render
    await page.waitForTimeout(5000);

    // Get the HTML content
    const html = await page.content();

    // Look for script tags
    console.log('\n=== Checking for problematic script tags ===');

    // Check for inline scripts with special characters
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let scriptCount = 0;

    while ((match = scriptPattern.exec(html)) !== null) {
      scriptCount++;
      const scriptContent = match[1];

      // Look for potential issues
      if (scriptContent.includes('imageSrcSet') || scriptContent.includes('imageSizes')) {
        console.log(`\nScript #${scriptCount} contains imageSrcSet/imageSizes:`);
        console.log(match[0].substring(0, 500));
      }

      // Check for unescaped quotes or other issues
      if (scriptContent.includes('href=\\') || scriptContent.includes('src=\\')) {
        console.log(`\nScript #${scriptCount} contains potentially malformed attributes:`);
        console.log(match[0].substring(0, 500));
      }
    }

    console.log(`\nTotal scripts found: ${scriptCount}`);

    // Check all link preload tags
    const preloadLinks = await page.$$eval('link[rel="preload"]', links =>
      links.map(link => ({
        href: link.getAttribute('href'),
        as: link.getAttribute('as'),
        type: link.getAttribute('type'),
        imageSrcSet: link.getAttribute('imageSrcSet'),
        imageSizes: link.getAttribute('imageSizes'),
        outerHTML: link.outerHTML
      }))
    );

    console.log('\n=== Preload Links ===');
    preloadLinks.forEach((link, idx) => {
      console.log(`\nPreload #${idx + 1}:`);
      console.log(JSON.stringify(link, null, 2));
    });

    console.log(`\n=== Error Summary ===`);
    console.log(`Total errors captured: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\nDetailed errors:');
      errors.forEach((err, idx) => {
        console.log(`\nError #${idx + 1}:`);
        console.log(JSON.stringify(err, null, 2));
      });
    }

  } catch (error) {
    console.error('Error during investigation:', error);
  } finally {
    await browser.close();
  }
}

investigate();
