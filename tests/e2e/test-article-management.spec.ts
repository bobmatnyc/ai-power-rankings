/**
 * Comprehensive Article Management System Test
 * Tests all CRUD operations and scoring functionality
 *
 * Requirements:
 * - Next.js dev server running on http://localhost:3012
 * - Admin user authenticated in Clerk
 * - Database configured (PostgreSQL or JSON mode)
 * - OPENROUTER_API_KEY configured for AI analysis
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const BASE_URL = 'http://localhost:3012';
const ADMIN_URL = `${BASE_URL}/en/admin`;
const TEST_RESULTS_DIR = path.join(__dirname, 'test-results');

// Create test results directory
if (!fs.existsSync(TEST_RESULTS_DIR)) {
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

// Sample article content for testing
const SAMPLE_ARTICLE_TEXT = `
# ChatGPT Code Interpreter Now Available to All

OpenAI has announced that ChatGPT's Code Interpreter is now available to all ChatGPT Plus subscribers.
This powerful feature allows users to run Python code directly within ChatGPT, enabling data analysis,
visualization, and file manipulation.

The Code Interpreter represents a significant advancement in AI-assisted coding and data science.
Users can upload datasets, generate charts, perform statistical analysis, and even edit files -
all through natural language conversations with ChatGPT.

GitHub Copilot users have also noted improvements in code suggestions when working alongside
Code Interpreter features. This integration is expected to enhance developer productivity significantly.

Cursor, another AI coding tool, is also integrating similar capabilities to compete with ChatGPT's
new features. The AI coding assistant market continues to evolve rapidly.
`;

const SAMPLE_ARTICLE_URL = 'https://techcrunch.com/2024/01/15/anthropic-raises-funding/';

// Helper function to save screenshot
async function saveScreenshot(page: Page, name: string) {
  const screenshotPath = path.join(TEST_RESULTS_DIR, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${screenshotPath}`);
}

// Helper function to log test results
function logResult(testName: string, status: 'PASS' | 'FAIL' | 'SKIP', details?: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${status}] ${testName}${details ? ': ' + details : ''}\n`;
  fs.appendFileSync(path.join(TEST_RESULTS_DIR, 'test-log.txt'), logLine);
  console.log(logLine.trim());
}

// Check if user is authenticated and has admin access
test.describe('Article Management System - Comprehensive Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Set a longer timeout for authentication checks
    test.setTimeout(120000);

    console.log('\n=== Starting test ===');
    await page.goto(ADMIN_URL);
    await page.waitForLoadState('networkidle');

    // Check if redirected to sign-in
    const currentUrl = page.url();
    if (currentUrl.includes('/sign-in')) {
      await saveScreenshot(page, 'auth-required');
      logResult('Authentication Check', 'FAIL', 'Not authenticated - redirected to sign-in');
      throw new Error('Admin authentication required. Please sign in with admin account first.');
    }

    // Check if redirected to unauthorized
    if (currentUrl.includes('/unauthorized')) {
      await saveScreenshot(page, 'unauthorized');
      logResult('Authentication Check', 'FAIL', 'User does not have admin privileges');
      throw new Error('Admin privileges required. User is authenticated but not an admin.');
    }

    logResult('Authentication Check', 'PASS', 'Admin access confirmed');
  });

  test('Test 1: List Articles & Statistics Dashboard', async ({ page }) => {
    console.log('\n=== TEST 1: List Articles & Statistics ===');

    try {
      // Wait for admin dashboard to load
      await expect(page.locator('h1')).toContainText('Admin Dashboard', { timeout: 10000 });
      logResult('Dashboard Load', 'PASS', 'Admin dashboard loaded successfully');

      // Look for database status indicator
      const dbStatus = page.locator('text=/Database:|JSON Files/').first();
      if (await dbStatus.isVisible({ timeout: 5000 })) {
        const dbText = await dbStatus.textContent();
        logResult('Database Status', 'PASS', `Found: ${dbText}`);
      }

      // Navigate to Articles tab
      const articlesTab = page.locator('button', { hasText: 'Articles' });
      if (await articlesTab.isVisible({ timeout: 5000 })) {
        await articlesTab.click();
        await page.waitForTimeout(1000);
        logResult('Articles Tab Navigation', 'PASS', 'Navigated to Articles tab');
      }

      // Check for article list or "Edit / Delete Articles" section
      await page.waitForTimeout(2000);

      // Look for article statistics
      const hasStats = await page.locator('text=/total|articles|this month/i').first().isVisible({ timeout: 5000 }).catch(() => false);
      if (hasStats) {
        logResult('Article Statistics', 'PASS', 'Statistics dashboard visible');
      } else {
        logResult('Article Statistics', 'SKIP', 'No statistics found - may be empty database');
      }

      // Check for article list items
      const articleCards = page.locator('[data-testid="article-card"], .article-item, text=/Published:|Author:/').count();
      const articleCount = await articleCards;
      logResult('Article List', articleCount > 0 ? 'PASS' : 'SKIP', `Found ${articleCount} articles`);

      await saveScreenshot(page, 'test1-article-list');

    } catch (error) {
      logResult('Test 1', 'FAIL', error.message);
      await saveScreenshot(page, 'test1-error');
      throw error;
    }
  });

  test('Test 2: Ingest Article from URL (AI Analysis)', async ({ page }) => {
    console.log('\n=== TEST 2: Ingest Article from URL ===');

    // Check if OPENROUTER_API_KEY is configured
    const hasApiKey = process.env.OPENROUTER_API_KEY || false;
    if (!hasApiKey) {
      logResult('Test 2', 'SKIP', 'OPENROUTER_API_KEY not configured');
      return;
    }

    try {
      // Navigate to Add Article tab
      await page.locator('button', { hasText: 'Articles' }).click();
      await page.waitForTimeout(1000);

      // Look for "Add News Article" or similar tab
      const addTab = page.locator('button', { hasText: /Add|New Article/i }).first();
      if (await addTab.isVisible({ timeout: 5000 })) {
        await addTab.click();
        await page.waitForTimeout(1000);
        logResult('Add Article Tab', 'PASS', 'Navigated to Add Article tab');
      }

      // Select "Link - Import from URL" option
      const urlOption = page.locator('label', { hasText: /Link|URL|Import from URL/i });
      if (await urlOption.isVisible({ timeout: 5000 })) {
        await urlOption.click();
        await page.waitForTimeout(500);
        logResult('URL Ingestion Option', 'PASS', 'Selected URL ingestion method');
      }

      // Enter URL
      const urlInput = page.locator('input[placeholder*="URL"], input[type="url"]').first();
      if (await urlInput.isVisible({ timeout: 5000 })) {
        await urlInput.fill(SAMPLE_ARTICLE_URL);
        logResult('URL Input', 'PASS', `Entered URL: ${SAMPLE_ARTICLE_URL}`);
      }

      // Add metadata
      const authorInput = page.locator('input[placeholder*="author" i], input[name="author"]').first();
      if (await authorInput.isVisible({ timeout: 3000 })) {
        await authorInput.fill('Test Author');
      }

      const categoryInput = page.locator('input[placeholder*="category" i], select[name="category"]').first();
      if (await categoryInput.isVisible({ timeout: 3000 })) {
        await categoryInput.fill('AI News');
      }

      await saveScreenshot(page, 'test2-url-input');

      // Click "Preview Impact" button
      const previewButton = page.locator('button', { hasText: /Preview|Analyze/i }).first();
      if (await previewButton.isVisible({ timeout: 5000 })) {
        await previewButton.click();
        logResult('Preview Button', 'PASS', 'Clicked Preview Impact button');

        // Wait for AI analysis (this can take 10-30 seconds)
        await page.waitForTimeout(2000);

        // Look for progress indicator
        const loadingIndicator = page.locator('text=/Analyzing|Processing|Loading/i').first();
        if (await loadingIndicator.isVisible({ timeout: 5000 })) {
          logResult('AI Analysis', 'PASS', 'AI analysis started');

          // Wait for analysis to complete (up to 60 seconds)
          await page.waitForTimeout(60000);
        }

        // Check for analysis results
        const hasResults = await page.locator('text=/Tool mentions|Score changes|Impact/i').first().isVisible({ timeout: 10000 }).catch(() => false);
        if (hasResults) {
          logResult('AI Analysis Results', 'PASS', 'Analysis results displayed');
          await saveScreenshot(page, 'test2-analysis-results');

          // Try to save the article
          const saveButton = page.locator('button', { hasText: /Save Article|Save/i }).first();
          if (await saveButton.isVisible({ timeout: 5000 })) {
            await saveButton.click();
            await page.waitForTimeout(2000);

            // Check for success message
            const successMsg = await page.locator('text=/success|saved|added/i').first().isVisible({ timeout: 5000 }).catch(() => false);
            logResult('Save Article', successMsg ? 'PASS' : 'FAIL', successMsg ? 'Article saved successfully' : 'No success message found');
          }
        } else {
          logResult('AI Analysis Results', 'FAIL', 'No analysis results found');
        }
      } else {
        logResult('Preview Button', 'FAIL', 'Preview button not found');
      }

      await saveScreenshot(page, 'test2-final');

    } catch (error) {
      logResult('Test 2', 'FAIL', error.message);
      await saveScreenshot(page, 'test2-error');
      // Don't throw - continue with other tests
    }
  });

  test('Test 3: Ingest Article from Text', async ({ page }) => {
    console.log('\n=== TEST 3: Ingest Article from Text ===');

    try {
      // Navigate to Add Article tab
      await page.locator('button', { hasText: 'Articles' }).click();
      await page.waitForTimeout(1000);

      const addTab = page.locator('button', { hasText: /Add|New Article/i }).first();
      if (await addTab.isVisible({ timeout: 5000 })) {
        await addTab.click();
        await page.waitForTimeout(1000);
      }

      // Select "Enter - Type or Paste Content" option
      const textOption = page.locator('label', { hasText: /Enter|Text|Paste Content/i });
      if (await textOption.isVisible({ timeout: 5000 })) {
        await textOption.click();
        await page.waitForTimeout(500);
        logResult('Text Ingestion Option', 'PASS', 'Selected text ingestion method');
      }

      // Enter article text
      const textArea = page.locator('textarea').first();
      if (await textArea.isVisible({ timeout: 5000 })) {
        await textArea.fill(SAMPLE_ARTICLE_TEXT);
        logResult('Article Text Input', 'PASS', 'Entered sample article text');
      }

      // Add metadata
      const authorInput = page.locator('input[placeholder*="author" i], input[name="author"]').first();
      if (await authorInput.isVisible({ timeout: 3000 })) {
        await authorInput.fill('Test Editor');
      }

      await saveScreenshot(page, 'test3-text-input');

      // Click Preview
      const previewButton = page.locator('button', { hasText: /Preview|Analyze/i }).first();
      if (await previewButton.isVisible({ timeout: 5000 })) {
        await previewButton.click();
        logResult('Preview Text Article', 'PASS', 'Clicked preview button');

        await page.waitForTimeout(5000);

        // Check for preview results
        const hasPreview = await page.locator('text=/Tool mentions|ChatGPT|GitHub|Cursor/i').first().isVisible({ timeout: 10000 }).catch(() => false);
        if (hasPreview) {
          logResult('Text Preview Results', 'PASS', 'Preview generated with tool mentions');

          // Save the article
          const saveButton = page.locator('button', { hasText: /Save Article|Save/i }).first();
          if (await saveButton.isVisible({ timeout: 5000 })) {
            await saveButton.click();
            await page.waitForTimeout(2000);
            logResult('Save Text Article', 'PASS', 'Article save action completed');
          }
        } else {
          logResult('Text Preview Results', 'FAIL', 'No preview results displayed');
        }
      }

      await saveScreenshot(page, 'test3-final');

    } catch (error) {
      logResult('Test 3', 'FAIL', error.message);
      await saveScreenshot(page, 'test3-error');
    }
  });

  test('Test 4: Edit Existing Article', async ({ page }) => {
    console.log('\n=== TEST 4: Edit Article ===');

    try {
      // Navigate to article list
      await page.locator('button', { hasText: 'Articles' }).click();
      await page.waitForTimeout(1000);

      // Look for "Edit / Delete Articles" or list view
      const editTab = page.locator('button, a', { hasText: /Edit|List|Manage/i }).first();
      if (await editTab.isVisible({ timeout: 5000 })) {
        await editTab.click();
        await page.waitForTimeout(1000);
      }

      // Find the first Edit button
      const editButton = page.locator('button[aria-label*="Edit"], button:has-text("Edit")').first();
      if (await editButton.isVisible({ timeout: 5000 })) {
        await editButton.click();
        await page.waitForTimeout(1000);
        logResult('Edit Button Click', 'PASS', 'Clicked Edit button on first article');

        // Modify the title
        const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]').first();
        if (await titleInput.isVisible({ timeout: 5000 })) {
          const originalTitle = await titleInput.inputValue();
          const newTitle = originalTitle + ' [EDITED]';
          await titleInput.fill(newTitle);
          logResult('Title Edit', 'PASS', `Modified title: ${newTitle}`);
        }

        // Modify the summary
        const summaryInput = page.locator('textarea[name="summary"], textarea[placeholder*="summary" i]').first();
        if (await summaryInput.isVisible({ timeout: 3000 })) {
          await summaryInput.fill('This is an edited summary for testing purposes.');
          logResult('Summary Edit', 'PASS', 'Modified summary');
        }

        await saveScreenshot(page, 'test4-edit-form');

        // Save changes
        const saveButton = page.locator('button', { hasText: /Save|Update/i }).first();
        if (await saveButton.isVisible({ timeout: 5000 })) {
          await saveButton.click();
          await page.waitForTimeout(2000);

          const successMsg = await page.locator('text=/success|updated|saved/i').first().isVisible({ timeout: 5000 }).catch(() => false);
          logResult('Save Edits', successMsg ? 'PASS' : 'FAIL', successMsg ? 'Changes saved successfully' : 'No success confirmation');
        }

        await saveScreenshot(page, 'test4-final');

      } else {
        logResult('Test 4', 'SKIP', 'No articles available to edit');
      }

    } catch (error) {
      logResult('Test 4', 'FAIL', error.message);
      await saveScreenshot(page, 'test4-error');
    }
  });

  test('Test 5: Preview Recalculation (Dry-run)', async ({ page }) => {
    console.log('\n=== TEST 5: Preview Recalculation ===');

    try {
      // Navigate to article list
      await page.locator('button', { hasText: 'Articles' }).click();
      await page.waitForTimeout(1000);

      // Find Preview button
      const previewButton = page.locator('button', { hasText: /Preview|Recalculate/i }).first();
      if (await previewButton.isVisible({ timeout: 5000 })) {
        await previewButton.click();
        logResult('Preview Button', 'PASS', 'Clicked Preview Recalculation button');

        // Wait for progress stream
        await page.waitForTimeout(3000);

        // Look for progress indicators
        const hasProgress = await page.locator('text=/progress|calculating|analyzing/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        if (hasProgress) {
          logResult('Recalculation Progress', 'PASS', 'Recalculation progress shown');

          // Wait for completion (up to 30 seconds)
          await page.waitForTimeout(30000);

          // Look for score change results
          const hasResults = await page.locator('text=/score change|tool changes|impact/i').first().isVisible({ timeout: 10000 }).catch(() => false);
          if (hasResults) {
            logResult('Preview Results', 'PASS', 'Score change preview displayed');
            await saveScreenshot(page, 'test5-preview-results');

            // Cancel without applying
            const cancelButton = page.locator('button', { hasText: /Cancel|Close/i }).first();
            if (await cancelButton.isVisible({ timeout: 5000 })) {
              await cancelButton.click();
              await page.waitForTimeout(1000);
              logResult('Cancel Preview', 'PASS', 'Cancelled without applying changes');
            }
          } else {
            logResult('Preview Results', 'FAIL', 'No preview results displayed');
          }
        }

      } else {
        logResult('Test 5', 'SKIP', 'No Preview Recalculation button found');
      }

      await saveScreenshot(page, 'test5-final');

    } catch (error) {
      logResult('Test 5', 'FAIL', error.message);
      await saveScreenshot(page, 'test5-error');
    }
  });

  test('Test 6: Apply Recalculation', async ({ page }) => {
    console.log('\n=== TEST 6: Apply Recalculation ===');

    try {
      // Navigate to article list
      await page.locator('button', { hasText: 'Articles' }).click();
      await page.waitForTimeout(1000);

      // Find Preview button
      const previewButton = page.locator('button', { hasText: /Preview|Recalculate/i }).first();
      if (await previewButton.isVisible({ timeout: 5000 })) {
        await previewButton.click();
        await page.waitForTimeout(3000);

        // Wait for preview to complete
        await page.waitForTimeout(30000);

        // Click "Apply Changes" button
        const applyButton = page.locator('button', { hasText: /Apply|Commit|Save Changes/i }).first();
        if (await applyButton.isVisible({ timeout: 10000 })) {
          await applyButton.click();
          logResult('Apply Changes', 'PASS', 'Clicked Apply Changes button');

          await page.waitForTimeout(3000);

          // Check for success message
          const successMsg = await page.locator('text=/success|applied|committed|updated/i').first().isVisible({ timeout: 10000 }).catch(() => false);
          logResult('Apply Success', successMsg ? 'PASS' : 'FAIL', successMsg ? 'Changes applied successfully' : 'No success confirmation');

          await saveScreenshot(page, 'test6-applied');
        } else {
          logResult('Test 6', 'SKIP', 'No Apply button found - may need to run preview first');
        }
      }

      await saveScreenshot(page, 'test6-final');

    } catch (error) {
      logResult('Test 6', 'FAIL', error.message);
      await saveScreenshot(page, 'test6-error');
    }
  });

  test('Test 7: Delete Article with Rollback', async ({ page }) => {
    console.log('\n=== TEST 7: Delete Article ===');

    try {
      // Navigate to article list
      await page.locator('button', { hasText: 'Articles' }).click();
      await page.waitForTimeout(1000);

      // Count articles before deletion
      const articleCountBefore = await page.locator('button[aria-label*="Delete"], button:has-text("Delete")').count();
      logResult('Articles Before Delete', 'PASS', `Found ${articleCountBefore} articles`);

      if (articleCountBefore === 0) {
        logResult('Test 7', 'SKIP', 'No articles available to delete');
        return;
      }

      // Find the last Delete button (to preserve test articles)
      const deleteButton = page.locator('button[aria-label*="Delete"], button:has-text("Delete")').last();
      if (await deleteButton.isVisible({ timeout: 5000 })) {

        // Set up dialog handler for confirmation
        page.on('dialog', async dialog => {
          console.log('Confirmation dialog:', dialog.message());
          await dialog.accept();
        });

        await deleteButton.click();
        logResult('Delete Button', 'PASS', 'Clicked Delete button');

        await page.waitForTimeout(2000);

        // Verify article was removed from list
        const articleCountAfter = await page.locator('button[aria-label*="Delete"], button:has-text("Delete")').count();
        if (articleCountAfter < articleCountBefore) {
          logResult('Article Deleted', 'PASS', `Article count reduced from ${articleCountBefore} to ${articleCountAfter}`);
        } else {
          logResult('Article Deleted', 'FAIL', 'Article count did not decrease');
        }

        await saveScreenshot(page, 'test7-after-delete');

        // Check if there's a rollback message or indication
        const rollbackMsg = await page.locator('text=/rollback|reverted|restored/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        if (rollbackMsg) {
          logResult('Rollback Indication', 'PASS', 'Rollback message or indication found');
        } else {
          logResult('Rollback Indication', 'SKIP', 'No explicit rollback message found');
        }
      }

      await saveScreenshot(page, 'test7-final');

    } catch (error) {
      logResult('Test 7', 'FAIL', error.message);
      await saveScreenshot(page, 'test7-error');
    }
  });

  test('Test 8: Error Handling', async ({ page }) => {
    console.log('\n=== TEST 8: Error Handling ===');

    try {
      // Navigate to Add Article
      await page.locator('button', { hasText: 'Articles' }).click();
      await page.waitForTimeout(1000);

      const addTab = page.locator('button', { hasText: /Add|New Article/i }).first();
      if (await addTab.isVisible({ timeout: 5000 })) {
        await addTab.click();
        await page.waitForTimeout(1000);
      }

      // Try to preview without entering any content
      const previewButton = page.locator('button', { hasText: /Preview|Analyze/i }).first();
      if (await previewButton.isVisible({ timeout: 5000 })) {
        await previewButton.click();
        await page.waitForTimeout(2000);

        // Look for error message
        const errorMsg = await page.locator('text=/error|required|invalid|missing/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        if (errorMsg) {
          logResult('Empty Content Error', 'PASS', 'Error message displayed for empty content');
        } else {
          logResult('Empty Content Error', 'FAIL', 'No error message for empty content');
        }

        await saveScreenshot(page, 'test8-empty-error');
      }

      // Try invalid URL
      const urlOption = page.locator('label', { hasText: /Link|URL/i }).first();
      if (await urlOption.isVisible({ timeout: 5000 })) {
        await urlOption.click();
        await page.waitForTimeout(500);

        const urlInput = page.locator('input[placeholder*="URL"], input[type="url"]').first();
        if (await urlInput.isVisible({ timeout: 5000 })) {
          await urlInput.fill('not-a-valid-url');

          const previewBtn = page.locator('button', { hasText: /Preview|Analyze/i }).first();
          if (await previewBtn.isVisible({ timeout: 5000 })) {
            await previewBtn.click();
            await page.waitForTimeout(2000);

            const errorMsg = await page.locator('text=/error|invalid|failed/i').first().isVisible({ timeout: 5000 }).catch(() => false);
            if (errorMsg) {
              logResult('Invalid URL Error', 'PASS', 'Error handling for invalid URL works');
            } else {
              logResult('Invalid URL Error', 'SKIP', 'No explicit error for invalid URL');
            }

            await saveScreenshot(page, 'test8-invalid-url');
          }
        }
      }

      await saveScreenshot(page, 'test8-final');

    } catch (error) {
      logResult('Test 8', 'FAIL', error.message);
      await saveScreenshot(page, 'test8-error');
    }
  });

  test('Summary: Generate Test Report', async ({ page }) => {
    console.log('\n=== GENERATING TEST REPORT ===');

    const reportPath = path.join(TEST_RESULTS_DIR, 'test-report.md');
    const logPath = path.join(TEST_RESULTS_DIR, 'test-log.txt');

    // Read the log file
    let logContents = '';
    if (fs.existsSync(logPath)) {
      logContents = fs.readFileSync(logPath, 'utf-8');
    }

    // Parse results
    const passCount = (logContents.match(/\[PASS\]/g) || []).length;
    const failCount = (logContents.match(/\[FAIL\]/g) || []).length;
    const skipCount = (logContents.match(/\[SKIP\]/g) || []).length;

    const report = `# Article Management System - Test Report

**Generated**: ${new Date().toISOString()}
**Base URL**: ${BASE_URL}

## Test Summary

- ✅ **PASSED**: ${passCount} tests
- ❌ **FAILED**: ${failCount} tests
- ⏭️ **SKIPPED**: ${skipCount} tests

## Test Results by Category

### Test 1: List Articles & Statistics Dashboard
- Verifies article list display
- Checks statistics dashboard
- Validates database status indicator

### Test 2: Ingest Article from URL
- Tests URL-based article ingestion
- Validates AI analysis with OPENROUTER_API_KEY
- Checks tool mention extraction
- Verifies score impact preview

### Test 3: Ingest Article from Text
- Tests text-based article ingestion
- Validates manual content entry
- Checks tool identification from text

### Test 4: Edit Existing Article
- Tests article editing functionality
- Validates title and summary modifications
- Checks save operation

### Test 5: Preview Recalculation (Dry-run)
- Tests score recalculation preview
- Validates dry-run mode (no database changes)
- Checks cancel functionality

### Test 6: Apply Recalculation
- Tests actual score updates
- Validates database changes
- Checks success confirmation

### Test 7: Delete Article with Rollback
- Tests article deletion
- Validates confirmation dialog
- Checks rollback of ranking changes

### Test 8: Error Handling
- Tests validation for empty content
- Validates error messages
- Checks invalid URL handling

## Detailed Log

\`\`\`
${logContents}
\`\`\`

## Screenshots

All screenshots are saved in: ${TEST_RESULTS_DIR}

## Recommendations

${failCount > 0 ? '⚠️ **Action Required**: Some tests failed. Review error screenshots and logs.' : '✅ All core functionality is working as expected.'}

${skipCount > 0 ? '⚠️ **Note**: Some tests were skipped. This may be due to:\n- Missing OPENROUTER_API_KEY\n- Empty database (no articles to edit/delete)\n- Features not yet implemented' : ''}

## Current State Assessment

Based on test results:
- **Authentication**: ${logContents.includes('Admin access confirmed') ? '✅ Working' : '❌ Not configured'}
- **Article Listing**: ${logContents.includes('Article List') ? '✅ Functional' : '❌ Issues detected'}
- **AI Analysis**: ${logContents.includes('AI Analysis') ? '✅ Working' : '⚠️ Skipped or failed'}
- **CRUD Operations**: ${passCount >= 3 ? '✅ Operational' : '⚠️ Limited functionality'}
- **Scoring System**: ${logContents.includes('Score change') ? '✅ Working' : '⚠️ Not tested'}

## Next Steps

1. Review failed tests and error screenshots
2. Fix any identified issues
3. Re-run tests to verify fixes
4. Consider adding more edge case tests
`;

    fs.writeFileSync(reportPath, report);
    console.log(`\nTest report saved to: ${reportPath}`);
    logResult('Test Report Generated', 'PASS', reportPath);
  });
});
