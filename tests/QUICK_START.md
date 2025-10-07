# Quick Start Guide - UAT Test Suite

Get up and running with the test suite in 5 minutes.

## Prerequisites Check

```bash
# 1. Check Node.js version (need v18+)
node --version

# 2. Check if server is running on port 3011
curl http://localhost:3011/api/health
```

## Setup (One-time)

```bash
# 1. Install Playwright browsers
npm run test:install

# 2. Verify installation
npx playwright --version
```

## Running Tests

### Quick Test Run (Recommended for First Time)
```bash
# Start dev server (in separate terminal)
npm run dev

# Run API tests only (fastest)
npm run test:api
```

### Full Test Suite
```bash
# Ensure server is running first
npm run dev

# Run all tests (in another terminal)
npm run test:e2e
```

### Watch Tests Run (Headed Mode)
```bash
npm run test:e2e:headed
```

## View Results

```bash
# Open HTML report
npm run test:report
```

## Expected Output

### Successful Run
```
✓ API Endpoints - Current Rankings (7 tests)
✓ API Endpoints - Trending Rankings (7 tests)
✓ Rankings Page - Basic Functionality (4 tests)
✓ Trending Chart - Basic Functionality (3 tests)
✓ Locale Switching - Basic Functionality (3 tests)
✓ Articles - API Verification (2 tests)
✓ Admin - Access Control (2 tests)

28 passed (30s)
```

## Common Issues

### Issue: "Server not reachable"
**Solution**: Make sure dev server is running on port 3011
```bash
npm run dev
```

### Issue: "Browser not installed"
**Solution**: Install Playwright browsers
```bash
npm run test:install
```

### Issue: "Tests timing out"
**Solution**: Server might be slow. Check server logs and database connection.

### Issue: "Permission denied"
**Solution**: Run with appropriate permissions
```bash
sudo npm run test:install  # macOS/Linux
```

## What Gets Tested

- ✅ **API Endpoints**: All critical APIs return correct data
- ✅ **Rankings Page**: Shows 31 tools with Claude Code #1
- ✅ **Trending Chart**: Displays 4 periods (June-Sept 2025)
- ✅ **Locale Switching**: English ↔ Japanese works
- ✅ **Articles**: 296 articles accessible
- ✅ **Admin Panel**: Functional with auth disabled
- ✅ **Responsive Design**: Works on mobile/tablet/desktop
- ✅ **Performance**: Pages load within acceptable time

## Test Coverage Summary

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| API | 25+ | All critical endpoints |
| Rankings | 20+ | Full page functionality |
| Trending | 15+ | Chart display & interaction |
| Locale | 15+ | i18n switching |
| Articles | 15+ | Article management |
| Admin | 15+ | Admin panel |
| **Total** | **100+** | **Comprehensive** |

## Next Steps

1. ✅ Run `npm run test:api` to verify setup
2. ✅ Run `npm run test:e2e` for full suite
3. ✅ Review HTML report: `npm run test:report`
4. 📖 Read full documentation: `tests/README.md`

## Tips

- Run API tests first (fastest feedback)
- Use headed mode to watch tests execute
- Check HTML report for detailed results
- Screenshots saved on failure in `test-results/`
- Run specific tests with: `npx playwright test tests/e2e/api.spec.ts`

## Need Help?

- Check `tests/README.md` for full documentation
- Review test output for specific errors
- Check `test-results/html/` for visual report
- Verify `.env.local` has correct database credentials
