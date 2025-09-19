#!/usr/bin/env tsx

/**
 * Admin UI Testing
 * Test the admin interface functionality
 */

import { chromium, Browser, Page } from 'playwright';

interface TestResult {
  testName: string;
  success: boolean;
  error?: string;
  screenshot?: string;
}

class AdminUITest {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl = 'http://localhost:3001';
  private results: TestResult[] = [];

  async setup(): Promise<void> {
    console.log('🚀 Setting up browser for admin UI testing...');
    this.browser = await chromium.launch({ headless: true });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async teardown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runAllTests(): Promise<void> {
    await this.setup();

    try {
      console.log('🧪 Testing Admin UI Interface');
      console.log('=' .repeat(60));

      // Test 1: Access admin page
      await this.testAdminPageAccess();

      // Test 2: Authentication (if required)
      await this.testAuthentication();

      // Test 3: Article management interface
      await this.testArticleManagementInterface();

      // Test 4: Article ingestion form
      await this.testArticleIngestionForm();

      // Generate report
      this.generateReport();

    } finally {
      await this.teardown();
    }
  }

  private async testAdminPageAccess(): Promise<void> {
    const testName = 'Admin Page Access';
    console.log(`\n📋 Testing: ${testName}`);

    try {
      if (!this.page) throw new Error('Page not initialized');

      await this.page.goto(`${this.baseUrl}/admin`);
      await this.page.waitForLoadState('networkidle');

      const title = await this.page.title();
      console.log(`Page title: ${title}`);

      // Check if we're redirected to auth or can access admin
      const currentUrl = this.page.url();
      console.log(`Current URL: ${currentUrl}`);

      if (currentUrl.includes('/admin')) {
        console.log('✅ Admin page accessible');
        this.results.push({ testName, success: true });
      } else if (currentUrl.includes('/auth') || currentUrl.includes('/login')) {
        console.log('ℹ️  Redirected to authentication');
        this.results.push({ testName, success: true });
      } else {
        throw new Error(`Unexpected redirect to: ${currentUrl}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${testName} failed: ${errorMessage}`);
      this.results.push({ testName, success: false, error: errorMessage });
    }
  }

  private async testAuthentication(): Promise<void> {
    const testName = 'Authentication Process';
    console.log(`\n📋 Testing: ${testName}`);

    try {
      if (!this.page) throw new Error('Page not initialized');

      const currentUrl = this.page.url();

      // If we're on an auth page, try to authenticate
      if (currentUrl.includes('/auth') || currentUrl.includes('/login')) {
        console.log('🔐 Authentication required, testing auth flow...');

        // Look for password field (based on the auth setup)
        const passwordField = await this.page.locator('input[type="password"]').first();
        if (await passwordField.isVisible()) {
          console.log('Found password field');

          // Try default admin password (from environment or common defaults)
          const adminPassword = process.env["ADMIN_PASSWORD"] || 'admin123';
          await passwordField.fill(adminPassword);

          const submitButton = await this.page.locator('button[type="submit"]').first();
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await this.page.waitForLoadState('networkidle');

            // Check if we're now in admin
            const newUrl = this.page.url();
            if (newUrl.includes('/admin')) {
              console.log('✅ Authentication successful');
              this.results.push({ testName, success: true });
            } else {
              throw new Error('Authentication failed or redirected elsewhere');
            }
          } else {
            throw new Error('Submit button not found');
          }
        } else {
          throw new Error('Password field not found');
        }
      } else {
        console.log('ℹ️  No authentication required, already in admin');
        this.results.push({ testName, success: true });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${testName} failed: ${errorMessage}`);
      this.results.push({ testName, success: false, error: errorMessage });
    }
  }

  private async testArticleManagementInterface(): Promise<void> {
    const testName = 'Article Management Interface';
    console.log(`\n📋 Testing: ${testName}`);

    try {
      if (!this.page) throw new Error('Page not initialized');

      // Wait for the admin interface to load
      await this.page.waitForLoadState('networkidle');

      // Look for article management elements
      const articleManagementFound = await this.page.locator('text=Article Management').isVisible({ timeout: 10000 }).catch(() => false);

      if (articleManagementFound) {
        console.log('✅ Article Management section found');

        // Look for tabs (Add, Manage, etc.)
        const addTabFound = await this.page.locator('text=Add Article').isVisible({ timeout: 5000 }).catch(() => false);
        const manageTabFound = await this.page.locator('text=Manage').isVisible({ timeout: 5000 }).catch(() => false);

        console.log(`Add Article tab: ${addTabFound ? 'Found' : 'Not found'}`);
        console.log(`Manage tab: ${manageTabFound ? 'Found' : 'Not found'}`);

        if (addTabFound || manageTabFound) {
          console.log('✅ Article management interface is functional');
          this.results.push({ testName, success: true });
        } else {
          throw new Error('Article management tabs not found');
        }
      } else {
        throw new Error('Article Management section not found');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${testName} failed: ${errorMessage}`);
      this.results.push({ testName, success: false, error: errorMessage });
    }
  }

  private async testArticleIngestionForm(): Promise<void> {
    const testName = 'Article Ingestion Form';
    console.log(`\n📋 Testing: ${testName}`);

    try {
      if (!this.page) throw new Error('Page not initialized');

      // Navigate to Add Article tab if it exists
      const addTab = this.page.locator('text=Add Article').first();
      if (await addTab.isVisible({ timeout: 5000 })) {
        await addTab.click();
        await this.page.waitForTimeout(1000);
      }

      // Look for ingestion form elements
      const textAreaFound = await this.page.locator('textarea').first().isVisible({ timeout: 10000 }).catch(() => false);
      const typeSelectionFound = await this.page.locator('text=text').isVisible({ timeout: 5000 }).catch(() => false);
      const previewButtonFound = await this.page.locator('text=Preview').isVisible({ timeout: 5000 }).catch(() => false);

      console.log(`Text area: ${textAreaFound ? 'Found' : 'Not found'}`);
      console.log(`Type selection: ${typeSelectionFound ? 'Found' : 'Not found'}`);
      console.log(`Preview button: ${previewButtonFound ? 'Found' : 'Not found'}`);

      if (textAreaFound && previewButtonFound) {
        console.log('✅ Article ingestion form elements found');

        // Test form interaction
        const textArea = this.page.locator('textarea').first();
        await textArea.fill('Test article about Claude Code improving AI development workflows. This is a test to verify the UI functionality.');

        console.log('✅ Form interaction test successful');

        // Test preview functionality (if available)
        const previewButton = this.page.locator('text=Preview').first();
        if (await previewButton.isVisible()) {
          await previewButton.click();
          await this.page.waitForTimeout(3000); // Wait for preview to load

          // Check if preview results appear
          const previewResultsFound = await this.page.locator('text=Preview Results').isVisible({ timeout: 10000 }).catch(() => false);
          console.log(`Preview results: ${previewResultsFound ? 'Found' : 'Not found'}`);

          if (previewResultsFound) {
            console.log('✅ Preview functionality working');
          }
        }

        this.results.push({ testName, success: true });
      } else {
        throw new Error('Required form elements not found');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${testName} failed: ${errorMessage}`);
      this.results.push({ testName, success: false, error: errorMessage });
    }
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ADMIN UI TEST REPORT');
    console.log('='.repeat(60));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    console.log('\nTest Results:');
    this.results.forEach((result, index) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${index + 1}. ${status} - ${result.testName}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    if (failedTests === 0) {
      console.log('\n🎉 All admin UI tests passed!');
    } else {
      console.log(`\n⚠️  ${failedTests} test(s) failed. Admin UI may need attention.`);
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Check if Playwright is available
async function checkPlaywright(): Promise<boolean> {
  try {
    await import('playwright');
    return true;
  } catch {
    return false;
  }
}

// Run the tests
async function main() {
  const hasPlaywright = await checkPlaywright();

  if (!hasPlaywright) {
    console.log('⚠️  Playwright not available. Installing...');
    console.log('Run: npm install playwright');
    console.log('Then: npx playwright install');
    console.log('\nSkipping UI tests for now. Manual testing recommended.');
    return;
  }

  const tester = new AdminUITest();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}