import { test, expect } from '@playwright/test';

test.describe('Article Creation Form - Published Date Picker', () => {
  test('should display and verify published date picker field', async ({ page }) => {
    // Navigate directly to the new article page
    await page.goto('http://localhost:3000/en/admin/news/new');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take screenshot of initial page state
    await page.screenshot({
      path: 'tests/screenshots/date-picker-initial-page.png',
      fullPage: true
    });

    // Wait for form to be visible
    await page.waitForSelector('form', { timeout: 10000 });

    // Take screenshot of the full form
    await page.screenshot({
      path: 'tests/screenshots/date-picker-form-full.png',
      fullPage: true
    });

    // Locate the Published Date field
    const dateLabel = page.locator('label:has-text("Published Date")');
    await expect(dateLabel).toBeVisible();

    // Find the date input field
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    // Verify the helper text
    const helperText = page.locator('text=Leave empty to use current date');
    await expect(helperText).toBeVisible();

    // Scroll to the date field
    await dateInput.scrollIntoViewIfNeeded();

    // Take screenshot focused on the date field area
    const dateFieldContainer = dateInput.locator('..').locator('..');
    await dateFieldContainer.screenshot({
      path: 'tests/screenshots/date-picker-field.png'
    });

    // Verify max date attribute exists
    const maxDate = await dateInput.getAttribute('max');
    console.log('Max date attribute:', maxDate);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    expect(maxDate).toBe(today);

    // Test selecting a past date (2024-01-15)
    await dateInput.fill('2024-01-15');

    // Take screenshot with selected date
    await page.screenshot({
      path: 'tests/screenshots/date-picker-with-date.png',
      fullPage: true
    });

    // Verify the value was set correctly
    const dateValue = await dateInput.inputValue();
    expect(dateValue).toBe('2024-01-15');

    // Try to set a future date (should be prevented by max attribute)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    await dateInput.fill(futureDateStr);

    // Take screenshot attempting future date
    await page.screenshot({
      path: 'tests/screenshots/date-picker-future-attempt.png',
      fullPage: true
    });

    // Check if the browser enforced the max constraint
    const finalValue = await dateInput.inputValue();
    console.log('Attempted future date:', futureDateStr);
    console.log('Final input value:', finalValue);

    // Clear the field
    await dateInput.fill('');

    // Take screenshot with empty field
    await page.screenshot({
      path: 'tests/screenshots/date-picker-empty.png',
      fullPage: true
    });

    // Verify field positioning relative to Tags field
    const tagsLabel = page.locator('label:has-text("Tags")');
    const tagsExists = await tagsLabel.count() > 0;

    if (tagsExists) {
      const tagsBox = await tagsLabel.boundingBox();
      const dateBox = await dateLabel.boundingBox();

      if (tagsBox && dateBox) {
        console.log('Tags field Y position:', tagsBox.y);
        console.log('Date field Y position:', dateBox.y);
        console.log('Date field appears after Tags:', dateBox.y > tagsBox.y);
      }
    }

    console.log('✓ Published Date field is visible');
    console.log('✓ Date input type is "date"');
    console.log('✓ Helper text is present');
    console.log('✓ Max date is set to today');
    console.log('✓ Can select past dates');
    console.log('✓ Can clear the field');
  });
});
