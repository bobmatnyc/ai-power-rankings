# Linting and Type Standards

## Overview

This document outlines the linting and type checking standards configured for the AI Power Rankings project. All code must pass these checks before being committed.

## TypeScript Configuration

### Strict Mode Enabled

The project uses TypeScript in strict mode with the following compiler options:

- `strict: true` - Enables all strict type checking options
- `noImplicitAny: true` - Disallows implicit `any` types
- `strictNullChecks: true` - Enables strict null checks
- `strictFunctionTypes: true` - Enables strict checking of function types
- `noUnusedLocals: true` - Reports errors on unused locals
- `noUnusedParameters: true` - Reports errors on unused parameters
- `noImplicitReturns: true` - Reports error when function doesn't return a value
- `noFallthroughCasesInSwitch: true` - Reports errors for fallthrough cases in switch
- `noUncheckedIndexedAccess: true` - Adds undefined to any un-declared field
- `forceConsistentCasingInFileNames: true` - Ensures consistent casing in file names

## ESLint Rules

### TypeScript Rules

- **No explicit any**: `@typescript-eslint/no-explicit-any: error`
- **No unused variables**: With underscore prefix for ignored vars
- **Explicit function return types**: Warning level, with some exceptions for expressions
- **No non-null assertions**: `@typescript-eslint/no-non-null-assertion: error`

### React/Next.js Rules

- **No unescaped entities**: `react/no-unescaped-entities: error`
- **React hooks rules**: Enforced via `react-hooks/rules-of-hooks`
- **Exhaustive deps**: `react-hooks/exhaustive-deps: error`

### Code Quality Rules

- **No console**: Warnings except for `console.warn` and `console.error`
- **No debugger**: Error
- **Prefer const**: Always prefer const over let/var
- **Strict equality**: Always use === and !==
- **Curly braces**: Required for all control structures

## Prettier Configuration

### Format Settings

- **Semi-colons**: Required
- **Trailing comma**: ES5 style
- **Single quotes**: Disabled (use double quotes)
- **Print width**: 100 characters
- **Tab width**: 2 spaces
- **Arrow parens**: Always include parentheses

## Pre-commit Hooks

Configured with Husky and lint-staged to run:

1. ESLint with auto-fix on `.js`, `.jsx`, `.ts`, `.tsx` files
2. Prettier formatting on all supported files

## NPM Scripts

### Linting Commands

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm run ci:local` - Run all checks (lint, type-check, format, tests)

### Usage in CI/CD

Before pushing code or in CI pipeline:

```bash
npm run ci:local
```

This runs:

1. ESLint checks
2. TypeScript type checking
3. Prettier format checking
4. All tests

## Common Issues and Fixes

### TypeScript Errors

1. **Index signature access**: Use bracket notation for env vars

   ```typescript
   // ❌ Wrong
   process.env.NEXT_PUBLIC_VAR;

   // ✅ Correct
   process.env["NEXT_PUBLIC_VAR"];
   ```

2. **Non-null assertions**: Provide proper type guards instead

   ```typescript
   // ❌ Wrong
   const value = someValue!;

   // ✅ Correct
   if (!someValue) throw new Error("Value is required");
   const value = someValue;
   ```

### ESLint Warnings

1. **Missing return types**: Add explicit return types to functions

   ```typescript
   // ❌ Wrong
   export default function Page() {}

   // ✅ Correct
   export default function Page(): JSX.Element {}
   ```

2. **Curly braces**: Always use braces for control structures

   ```typescript
   // ❌ Wrong
   if (condition) return;

   // ✅ Correct
   if (condition) {
     return;
   }
   ```

## IDE Integration

### VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Enforcement

- All PRs must pass linting and type checks
- Pre-commit hooks prevent commits with errors
- CI pipeline will fail if any checks don't pass
- Use `npm run ci:local` before pushing changes
