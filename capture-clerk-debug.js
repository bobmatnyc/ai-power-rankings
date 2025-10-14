const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/en/clerk-debug');
  await page.goto('http://localhost:3000/en/clerk-debug', { waitUntil: 'networkidle' });

  // Wait for the page to fully load and execute JavaScript
  console.log('Waiting for page to fully load...');
  await page.waitForTimeout(5000);

  // Take a screenshot
  await page.screenshot({ path: '/Users/masa/Projects/aipowerranking/clerk-debug-screenshot.png', fullPage: true });
  console.log('Screenshot saved to clerk-debug-screenshot.png');

  // Get the complete page text
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('\n=== PAGE CONTENT ===\n');
  console.log(pageText);

  // Try to extract JSON from the Real-Time Status section
  try {
    const jsonContent = await page.evaluate(() => {
      const preElements = Array.from(document.querySelectorAll('pre'));
      for (const pre of preElements) {
        const text = pre.textContent;
        if (text.includes('timestamp') || text.includes('isLoaded')) {
          return text;
        }
      }
      return null;
    });

    if (jsonContent) {
      console.log('\n=== REAL-TIME STATUS JSON ===\n');
      console.log(jsonContent);
    }
  } catch (e) {
    console.error('Error extracting JSON:', e.message);
  }

  // Get any diagnosis messages
  try {
    const diagnosis = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div'));
      for (const elem of elements) {
        const text = elem.textContent;
        if (text.includes('Diagnosis:') || text.includes('diagnosis')) {
          return elem.textContent;
        }
      }
      return null;
    });

    if (diagnosis) {
      console.log('\n=== DIAGNOSIS ===\n');
      console.log(diagnosis);
    }
  } catch (e) {
    console.error('Error extracting diagnosis:', e.message);
  }

  console.log('\n=== Keeping browser open for 30 seconds for manual inspection ===');
  await page.waitForTimeout(30000);

  await browser.close();
})();
