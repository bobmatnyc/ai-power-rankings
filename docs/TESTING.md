# Testing Strategy for AI Power Rankings

## Overview

This document outlines the testing strategy for the AI Power Rankings application, including unit tests, integration tests, and end-to-end testing procedures.

## Testing Stack

- **Test Runner**: Jest (configured in `jest.config.js`)
- **Testing Library**: React Testing Library for component tests
- **API Testing**: Supertest for endpoint testing
- **Type Checking**: TypeScript strict mode
- **Linting**: ESLint with Next.js configuration

## Test Structure

```
src/
├── __tests__/
│   ├── unit/           # Unit tests for utilities and helpers
│   ├── integration/    # Integration tests for APIs
│   └── components/     # Component tests
├── lib/
│   └── __tests__/      # Tests for library functions
└── app/
    └── api/
        └── __tests__/  # API route tests
```

## Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type checking
npm run type-check

# Linting
npm run lint

# Full CI check (lint + type-check + test)
npm run ci:local
```

## Testing Priorities

### 1. Critical Path Testing (Priority: HIGH)
- [ ] Rankings generation and display
- [ ] Tool data CRUD operations
- [ ] News ingestion pipeline
- [ ] API endpoint responses
- [ ] Data repository operations

### 2. Component Testing (Priority: MEDIUM)
- [ ] Dashboard components
- [ ] Public-facing pages
- [ ] Form validations
- [ ] Error boundaries

### 3. Utility Testing (Priority: MEDIUM)
- [ ] Date formatting functions
- [ ] Data transformation utilities
- [ ] Validation helpers
- [ ] Repository base class

## Test Categories

### Unit Tests

Test individual functions and classes in isolation.

```typescript
// Example: Testing a utility function
describe('formatPeriodDisplay', () => {
  it('should format daily periods correctly', () => {
    expect(formatPeriodDisplay('2025-01-15')).toBe('Jan 15, 2025');
  });
  
  it('should format monthly periods correctly', () => {
    expect(formatPeriodDisplay('2025-01')).toBe('January 2025');
  });
});
```

### Integration Tests

Test how different parts of the system work together.

```typescript
// Example: Testing JSON repository
describe('ToolsRepository', () => {
  let toolsRepo: ToolsRepository;
  
  beforeEach(() => {
    toolsRepo = new ToolsRepository();
  });
  
  it('should create and retrieve a tool', async () => {
    const tool = await toolsRepo.create({
      name: 'Test Tool',
      category: 'test-category'
    });
    
    const retrieved = await toolsRepo.getById(tool.id);
    expect(retrieved?.name).toBe('Test Tool');
  });
});
```

### API Tests

Test API endpoints for correct responses and error handling.

```typescript
// Example: Testing API endpoint
describe('GET /api/tools', () => {
  it('should return tools list', async () => {
    const response = await request(app)
      .get('/api/tools')
      .expect(200);
    
    expect(response.body).toHaveProperty('tools');
    expect(Array.isArray(response.body.tools)).toBe(true);
  });
});
```

## Testing the JSON Database

Since we're using a JSON-based database, special attention is needed for:

### 1. Concurrent Access
```typescript
it('should handle concurrent writes safely', async () => {
  const promises = Array(10).fill(null).map((_, i) => 
    toolsRepo.create({ name: `Tool ${i}` })
  );
  
  const results = await Promise.all(promises);
  expect(results).toHaveLength(10);
  expect(new Set(results.map(r => r.id)).size).toBe(10);
});
```

### 2. Data Integrity
```typescript
it('should maintain data integrity on errors', async () => {
  const initialCount = (await toolsRepo.getAll()).length;
  
  try {
    await toolsRepo.create({ invalid: 'data' });
  } catch (error) {
    // Expected to fail
  }
  
  const finalCount = (await toolsRepo.getAll()).length;
  expect(finalCount).toBe(initialCount);
});
```

### 3. Schema Validation
```typescript
it('should validate against schema', async () => {
  await expect(
    toolsRepo.create({ name: 123 }) // Invalid type
  ).rejects.toThrow('Schema validation failed');
});
```

## Testing Checklist

### Before Each PR
- [ ] All tests pass locally (`npm test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No lint errors (`npm run lint`)
- [ ] New features have tests
- [ ] Coverage hasn't decreased significantly

### Before Deployment
- [ ] Full test suite passes (`npm run ci:local`)
- [ ] Integration tests pass with production-like data
- [ ] Performance benchmarks meet targets
- [ ] Error scenarios are tested
- [ ] Rollback procedures are tested

## Current Test Coverage

⚠️ **Note**: Test coverage is currently minimal. Priority tasks:

1. **Add repository tests** for all JSON database operations
2. **Add API tests** for critical endpoints
3. **Add component tests** for dashboard functionality
4. **Add integration tests** for ranking generation

Target coverage: 80% for critical paths, 60% overall.

## Testing Best Practices

### 1. Test File Naming
- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

### 2. Test Organization
```typescript
describe('ComponentName', () => {
  describe('when condition', () => {
    it('should expected behavior', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### 3. Mock Data
Keep test data in `__fixtures__` directories:
```
src/
└── lib/
    └── json-db/
        └── __fixtures__/
            ├── tools.json
            └── rankings.json
```

### 4. Environment Setup
Use `.env.test` for test-specific configuration:
```env
# .env.test
NODE_ENV=test
JSON_DB_PATH=./data/test
```

## Performance Testing

### Load Testing
```bash
# Using Artillery for load testing
npm run test:load

# Target metrics:
# - 100 concurrent users
# - < 200ms response time (p95)
# - 0% error rate
```

### Memory Leak Detection
```bash
# Run with memory profiling
node --inspect npm run dev

# Monitor for:
# - Steady memory growth
# - Unreleased file handles
# - Cache size limits
```

## Error Scenario Testing

Test these error scenarios:

1. **File System Errors**
   - Disk full
   - Permission denied
   - File corruption

2. **Data Errors**
   - Invalid JSON
   - Schema mismatches
   - Missing required fields

3. **Concurrency Errors**
   - Race conditions
   - Deadlocks
   - Data conflicts

## Continuous Integration

GitHub Actions workflow runs on every PR:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run ci:local
```

## Future Improvements

1. **Visual Regression Testing**
   - Add Playwright for E2E tests
   - Screenshot comparison for UI changes

2. **Mutation Testing**
   - Ensure test quality with Stryker

3. **Contract Testing**
   - API contract validation
   - Schema evolution testing

4. **Monitoring**
   - Production error tracking
   - Performance monitoring
   - User behavior analytics

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)