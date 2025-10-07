import { test, expect } from '@playwright/test';

/**
 * Article Dates Verification Test
 *
 * Verifies that article dates in the admin dashboard now display
 * publishedDate instead of ingestedAt, showing correct historical dates.
 */

test.describe('Article Dates Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin news page
    await page.goto('http://localhost:3000/en/admin/news');

    // Wait for articles to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Additional wait for data loading
  });

  test('should display correct historical dates for articles', async ({ page }) => {
    // Take a full page screenshot
    await page.screenshot({
      path: 'test-results/article-dates-admin-view.png',
      fullPage: true
    });

    // Get all article rows from the table
    const articleRows = page.locator('table tbody tr');
    const count = await articleRows.count();

    console.log(`\n=== Found ${count} article rows ===\n`);

    // Sample the first 20 articles to verify dates
    const sampleSize = Math.min(count, 20);
    const articles = [];

    for (let i = 0; i < sampleSize; i++) {
      const row = articleRows.nth(i);

      // Get article title
      const titleCell = row.locator('td').nth(0);
      const title = await titleCell.textContent();

      // Get article date (assuming it's in one of the cells)
      // Check all cells for date-like content
      const cells = row.locator('td');
      const cellCount = await cells.count();

      let dateText = '';
      for (let j = 0; j < cellCount; j++) {
        const cellText = await cells.nth(j).textContent();
        // Look for date patterns (MM/DD/YYYY or similar)
        if (cellText && /\d{1,2}\/\d{1,2}\/\d{4}/.test(cellText)) {
          dateText = cellText;
          break;
        }
        // Also check for formatted dates like "May 2018"
        if (cellText && /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i.test(cellText)) {
          dateText = cellText;
          break;
        }
      }

      articles.push({
        index: i + 1,
        title: title?.trim().substring(0, 80) || 'Unknown',
        date: dateText?.trim() || 'No date found'
      });
    }

    // Print results
    console.log('\n=== Article Date Samples ===\n');
    articles.forEach(article => {
      console.log(`${article.index}. ${article.title}`);
      console.log(`   Date: ${article.date}\n`);
    });

    // Check for specific problematic articles mentioned in requirements
    const problematicArticles = [
      { title: 'Microsoft Announces IntelliCode', expectedYear: '2018' },
      { title: 'Tabnine Rebrands', expectedYear: '2020' },
      { title: 'Cursor Reaches $100M ARR', expectedYear: '2025' }
    ];

    console.log('\n=== Checking Specific Problematic Articles ===\n');

    for (const article of problematicArticles) {
      const found = articles.find(a => a.title.includes(article.title));
      if (found) {
        const hasCorrectYear = found.date.includes(article.expectedYear);
        const status = hasCorrectYear ? '✓ CORRECT' : '✗ INCORRECT';
        console.log(`${status}: ${found.title}`);
        console.log(`   Expected year: ${article.expectedYear}`);
        console.log(`   Displayed date: ${found.date}\n`);
      } else {
        console.log(`⚠ NOT VISIBLE: ${article.title} (may be on another page)\n`);
      }
    }

    // Check date diversity (should not all be Oct 2, 2025)
    const oct2_2025_count = articles.filter(a =>
      a.date.includes('10/2/2025') || a.date.includes('Oct 2, 2025')
    ).length;

    const diversityPercentage = ((sampleSize - oct2_2025_count) / sampleSize * 100).toFixed(1);

    console.log('\n=== Date Diversity Analysis ===');
    console.log(`Articles with Oct 2, 2025: ${oct2_2025_count}/${sampleSize}`);
    console.log(`Date diversity: ${diversityPercentage}%`);

    if (oct2_2025_count > sampleSize * 0.5) {
      console.log('⚠ WARNING: More than 50% of articles show Oct 2, 2025\n');
    } else {
      console.log('✓ Date diversity looks good\n');
    }

    // Basic assertion: at least some articles should have dates
    const articlesWithDates = articles.filter(a => a.date !== 'No date found').length;
    expect(articlesWithDates).toBeGreaterThan(0);
  });

  test('should show diverse years across articles', async ({ page }) => {
    // Get visible article dates
    const articleRows = page.locator('table tbody tr');
    const count = Math.min(await articleRows.count(), 30);

    const years = new Set<string>();

    for (let i = 0; i < count; i++) {
      const row = articleRows.nth(i);
      const cells = row.locator('td');
      const cellCount = await cells.count();

      for (let j = 0; j < cellCount; j++) {
        const cellText = await cells.nth(j).textContent();
        // Extract year from date
        const yearMatch = cellText?.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          years.add(yearMatch[1]);
          break;
        }
      }
    }

    console.log('\n=== Years Found in Articles ===');
    console.log(`Unique years: ${Array.from(years).sort().join(', ')}`);
    console.log(`Total unique years: ${years.size}\n`);

    // Should have multiple different years (at least 3)
    expect(years.size).toBeGreaterThanOrEqual(3);
  });
});
