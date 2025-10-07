# AI Power Ranking - UAT Test Suite

Comprehensive end-to-end User Acceptance Testing (UAT) suite for the AI Power Ranking application.

## Overview

This test suite provides complete coverage of critical user paths and business requirements using Playwright for browser automation and API testing.

## Test Coverage

### API Tests (`api.spec.ts`)
- ✅ `/api/rankings/current` - Returns 31 tools with Claude Code #1
- ✅ `/api/rankings/trending` - Returns 4 periods (June-Sept 2025)
- ✅ `/api/admin/*` - Admin endpoint accessibility
- ✅ `/api/tools` - Tools listing
- ✅ `/api/health` - Health check
- ✅ Response structure validation
- ✅ Performance benchmarks (< 3s response time)

### UI Tests

#### Rankings Page (`rankings.spec.ts`)
- ✅ Page loads successfully
- ✅ Rankings table displays 31+ tools
- ✅ Claude Code ranked #1
- ✅ Top 3 tools displayed correctly
- ✅ Tool information (names, scores, categories)
- ✅ Interactive elements (links, sorting, filtering)
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ SEO metadata

#### Trending Chart (`trending.spec.ts`)
- ✅ Chart renders successfully
- ✅ Displays 4 time periods (June-Sept 2025)
- ✅ Tool ranking visualization
- ✅ Legend with tool names
- ✅ Interactive hover tooltips
- ✅ Time range filtering
- ✅ Responsive chart sizing
- ✅ Performance (< 5s load time)

#### Locale Switching (`locale.spec.ts`)
- ✅ English locale (en) default
- ✅ Japanese locale (ja) support
- ✅ Locale switcher visibility
- ✅ Content translation
- ✅ Navigation persistence
- ✅ URL locale reflection
- ✅ Data consistency across locales
- ✅ SEO metadata per locale

#### Articles Management (`articles.spec.ts`)
- ✅ Articles page loads
- ✅ Article listings display
- ✅ 296 articles verification (API)
- ✅ Article content display
- ✅ Pagination support
- ✅ Individual article navigation
- ✅ Search and filtering
- ✅ Responsive design

#### Admin Panel (`admin.spec.ts`)
- ✅ Admin access (with auth disabled)
- ✅ News management interface
- ✅ Dashboard functionality
- ✅ Tools management
- ✅ Rankings management
- ✅ Admin API endpoints
- ✅ Form interactions
- ✅ Error handling

## Prerequisites

1. **Node.js**: v18 or higher
2. **Playwright**: Installed via npm
3. **Running Server**: Application running on `localhost:3011`
4. **Database**: Production database access (ep-dark-firefly-adp1p3v8)
5. **Environment**: `.env.local` configured with proper credentials

## Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run test:install
```

## Configuration

### Environment Variables

Create or update `.env.test` file:

```env
BASE_URL=http://localhost:3011
NODE_ENV=test
EXPECTED_TOOLS_COUNT=31
EXPECTED_ARTICLES_COUNT=296
EXPECTED_PERIODS_COUNT=4
```

### Playwright Configuration

The test suite is configured in `playwright.config.ts` with:
- Multiple browser support (Chromium, Firefox, WebKit)
- Mobile viewport testing
- Screenshot on failure
- Video recording for failing tests
- HTML and JSON reporters
- Parallel execution support

## Running Tests

### All Tests
```bash
npm run test:e2e
```

### API Tests Only
```bash
npm run test:api
```

### UI Tests Only
```bash
npm run test:ui
```

### Headed Mode (Watch Browser)
```bash
npm run test:e2e:headed
```

### Interactive UI Mode
```bash
npm run test:e2e:ui
```

### Debug Mode
```bash
npm run test:e2e:debug
```

### Specific Test File
```bash
npx playwright test tests/e2e/rankings.spec.ts
```

### Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### View Test Report
```bash
npm run test:report
```

## Test Structure

```
tests/
├── e2e/                      # End-to-end test specs
│   ├── api.spec.ts          # API endpoint tests
│   ├── rankings.spec.ts     # Rankings page tests
│   ├── trending.spec.ts     # Trending chart tests
│   ├── locale.spec.ts       # Internationalization tests
│   ├── articles.spec.ts     # Article management tests
│   └── admin.spec.ts        # Admin functionality tests
├── fixtures/                 # Test data and helpers
│   └── test-data.ts         # Shared test utilities
├── README.md                # This file
└── playwright.config.ts     # Playwright configuration

test-results/                # Generated test artifacts
├── html/                    # HTML test report
├── artifacts/               # Screenshots, videos, traces
└── results.json            # JSON test results
```

## Expected Test Results

### Success Criteria

All tests should pass with:
- ✅ API endpoints return 200 status
- ✅ Rankings show Claude Code at #1
- ✅ Trending chart displays 4 periods
- ✅ Locale switching works without errors
- ✅ No critical console errors
- ✅ All pages load within performance budgets

### Known Acceptable Warnings
- ResizeObserver warnings (Recharts chart library)
- Favicon 404 (if not implemented)
- Non-critical warnings from third-party libraries

## Test Data Validation

### API Response Validation
```typescript
import { validateRankingsResponse, validateTrendingResponse } from './fixtures/test-data';

// Use validation helpers
expect(validateRankingsResponse(data)).toBeTruthy();
```

### Expected Data
- **Tools Count**: 31
- **Articles Count**: 296
- **Trending Periods**: 4 (June-Sept 2025)
- **Top Tool**: Claude Code
- **Locales**: en, ja

## Debugging Failed Tests

### View Screenshots
```bash
open test-results/artifacts/
```

### View HTML Report
```bash
npm run test:report
```

### Run with Debug
```bash
npm run test:e2e:debug
```

### Check Specific Browser
```bash
npx playwright test --project=chromium --headed
```

### Verbose Output
```bash
DEBUG=pw:api npx playwright test
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:install
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

## Performance Benchmarks

- API Response Time: < 3 seconds
- Page Load Time: < 5 seconds
- First Meaningful Paint: < 3 seconds
- Interactive Time: < 5 seconds

## Browser Support

- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari/WebKit (latest)
- ✅ Mobile Chrome (Pixel 5)
- ✅ Mobile Safari (iPhone 12)

## Troubleshooting

### Server Not Running
Ensure the dev server is running:
```bash
npm run dev
```

### Database Connection Issues
Check `.env.local` has correct DATABASE_URL

### Browser Installation Issues
```bash
npx playwright install --with-deps
```

### Port Already in Use
Change BASE_URL in `.env.test` or stop conflicting service on port 3011

### Test Timeout
Increase timeout in `playwright.config.ts`:
```typescript
timeout: 60000, // 60 seconds
```

## Best Practices

1. **Run tests locally** before pushing to CI/CD
2. **Keep tests independent** - each test should run in isolation
3. **Use meaningful test names** - describe the expected behavior
4. **Check console errors** - validate no critical errors occur
5. **Test responsive design** - verify mobile and desktop viewports
6. **Validate data accuracy** - check not just presence but correctness
7. **Performance testing** - ensure pages load within acceptable time

## Maintenance

### Updating Expected Values
If data changes, update `tests/fixtures/test-data.ts`:
```typescript
export const TEST_CONFIG = {
  expectedToolsCount: 31,  // Update if tool count changes
  expectedArticleCount: 296, // Update if articles are added
  // ...
};
```

### Adding New Tests
1. Create new spec file in `tests/e2e/`
2. Import fixtures from `test-data.ts`
3. Follow existing test patterns
4. Add to test suite documentation

## Support

For issues or questions:
1. Check test output and HTML report
2. Review screenshots and videos in `test-results/`
3. Run tests in debug mode
4. Check application logs

## License

Same as main application.
