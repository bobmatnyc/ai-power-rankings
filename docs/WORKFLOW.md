# 🔄 AI Power Rankings - Workflow Processes

## Purpose

This document covers essential build/refactor/deploy processes, YOLO mode requirements, task linkage, and code-truth validation for the AI Power Rankings project.

## ⚡ YOLO Mode Requirements

### Critical YOLO Mode Rules

**YOLO mode MUST always follow proper task management:**

1. **TrackDown Task Required**: All work must originate from a TrackDown task (T-XXX format)
2. **Proper Branch Naming**: Branch names must tie to TrackDown tasks
3. **Epic/Subticket Workflow**: Complex work (like documentation epics) requires proper epic management
4. **Task Linkage**: All to-dos and action items must link back to TrackDown tickets

### YOLO Mode Workflow

```bash
# 1. Create/identify TrackDown task
# Edit /trackdown/issues/T-XXX-description.md

# 2. Create properly named branch
git checkout -b feature/T-XXX-task-description

# 3. Do work with task linkage
# All development tied to T-XXX

# 4. Complete with validation
pnpm run pre-deploy
git commit -m "feat(T-XXX): implement feature description"
```

### Epic Management in YOLO Mode

For complex work requiring epics (5+ subtickets):

1. **Create Epic**: Transform task into epic with subtickets
2. **Epic Branch**: Create `epic/XXX-epic-name` base branch
3. **Subticket Branches**: Individual branches off epic branch
4. **Coordinated Integration**: Subtickets merge to epic, epic merges to main

## 🔗 Task Linkage Requirements

### All Work Must Be Linked

- **Development Tasks**: Must reference TrackDown ticket (T-XXX)
- **Documentation Updates**: Must link to relevant task or epic
- **Bug Fixes**: Must reference issue ticket
- **Feature Development**: Must trace to feature ticket

### Linking Patterns

```markdown
<!-- In documentation -->

See T-044 for comprehensive documentation restructuring

<!-- In commit messages -->

feat(T-044): implement toolchain documentation enhancement

<!-- In PR descriptions -->

Implements T-044.2: Toolchain Documentation Enhancement
Part of EP-044: Documentation Optimization Epic
```

## 🏗️ Build Processes

### Development Build Workflow

```bash
# 1. Start development server
pnpm run dev:pm2 start

# 2. Monitor during development
pnpm run dev:pm2 logs

# 3. Restart when needed
pnpm run dev:pm2 restart

# 4. Clean shutdown
pnpm run dev:pm2 stop
```

### Production Build Process

```bash
# 1. Pre-build validation
pnpm run ci:local

# 2. Generate cache files
pnpm run cache:generate

# 3. Build for production
pnpm build

# 4. Test production build
pnpm start
```

### Build Validation Checklist

- ✅ TypeScript compilation (`pnpm run type-check`)
- ✅ ESLint validation (`pnpm run lint`)
- ✅ Code formatting (`pnpm run format:check`)
- ✅ Test suite passing (`pnpm test`)
- ✅ Cache generation successful
- ✅ No build errors or warnings

## 🔄 Refactoring Methodology

### Systematic Refactoring Process

1. **Create Refactoring Task**: Document in TrackDown with clear scope
2. **Branch Creation**: `refactor/T-XXX-refactor-description`
3. **Code Analysis**: Understand current implementation
4. **Incremental Changes**: Small, testable modifications
5. **Validation**: Ensure functionality preservation
6. **Documentation Update**: Reflect changes in docs

### Refactoring Validation

```bash
# Before refactoring
pnpm run test:coverage  # Establish baseline coverage
pnpm run build         # Ensure current state builds

# During refactoring (each increment)
pnpm run type-check     # TypeScript validation
pnpm run test          # Functionality preservation
pnpm run dev:pm2 restart # Runtime validation

# After refactoring
pnpm run ci:local      # Full validation suite
pnpm run test:coverage # Maintain/improve coverage
```

## 🚀 Deployment Procedures

### Pre-Deployment Validation

**CRITICAL**: Always run before deployment:

```bash
pnpm run pre-deploy
```

This executes:

- Code linting and formatting checks
- TypeScript compilation validation
- Complete test suite execution
- Build process verification

### Deployment Workflow

```bash
# 1. Final validation
pnpm run pre-deploy

# 2. Commit changes with task reference
git commit -m "feat(T-XXX): implement feature for deployment"

# 3. Push to deployment branch
git push origin feature/T-XXX-description

# 4. Create pull request with task linkage
# PR title: "T-XXX: Feature Description"
# PR body: Links to TrackDown task

# 5. Merge after review and validation
```

### Post-Deployment Verification

- ✅ Site accessibility and performance
- ✅ Core functionality working
- ✅ No console errors or warnings
- ✅ SEO and sitemap submission if needed
- ✅ Update task status in TrackDown

## 📊 Code-Truth Validation

### Code as Source of Truth Principle

**CRITICAL**: When documentation conflicts with source code, **assume code is correct**.

### Validation Process

```bash
# 1. Check documentation against code reality
# Compare docs/TOOLCHAIN.md with package.json
# Compare API docs with actual /src/app/api/ routes
# Compare component docs with /src/components/ structure

# 2. Update documentation to match code
# Edit documentation files to reflect current implementation

# 3. Validate technical instructions
# Test all documented commands and procedures
# Verify file paths and directory structure
# Confirm environment variable usage patterns
```

### Truth Verification Checklist

- ✅ Package.json dependencies match documented tech stack
- ✅ File structure matches documented organization
- ✅ API routes exist as documented
- ✅ Environment variables use documented patterns
- ✅ Build commands work as documented
- ✅ Development setup instructions are current

## 🔍 Quality Assurance Workflow

### Continuous Quality Checks

```bash
# During development
pnpm run type-check    # TypeScript validation
pnpm run lint         # Code style enforcement
pnpm run test:watch   # Continuous testing

# Before commits
pnpm run ci:local     # Full CI pipeline locally

# Before deployment
pnpm run pre-deploy   # Complete validation suite
```

### Quality Gates

- **Commit Gate**: All commits must pass linting and type checking
- **PR Gate**: Pull requests must pass full CI suite
- **Deployment Gate**: Pre-deployment validation must complete successfully
- **Task Gate**: Tasks must link to TrackDown tickets

## 📝 Documentation Workflow

### Documentation as Code

- **Location**: All docs in `/docs/` directory
- **Maintenance**: Keep synchronized with code changes
- **Validation**: Regular code-truth alignment checks
- **Linking**: All processes link to TrackDown tasks

### Documentation Update Process

```bash
# 1. Identify documentation need (linked to task)
# 2. Create branch: docs/T-XXX-doc-update
# 3. Update documentation files
# 4. Validate against current code state
# 5. Test all documented procedures
# 6. Commit with task reference
# 7. Link documentation change to TrackDown task
```

## 🚨 Error Handling & Recovery

### Development Error Recovery

```bash
# Server issues
pnpm run dev:pm2 restart
pnpm run dev:pm2 logs

# Build issues
rm -rf .next
pnpm run cache:generate
pnpm build

# Dependency issues
rm -rf node_modules
pnpm install
```

### Common Issue Resolution

- **TypeScript Errors**: Run `pnpm run type-check` for detailed diagnostics
- **Build Failures**: Check cache generation and clear .next directory
- **Test Failures**: Review test coverage and update assertions
- **Deployment Issues**: Verify pre-deployment validation passed

## 🎯 Success Metrics

### Workflow Efficiency Indicators

- **Task Linkage**: 100% of work items linked to TrackDown tickets
- **Build Success**: 0% build failures in CI/CD
- **Code Quality**: Maintained linting and test coverage standards
- **Documentation Accuracy**: 100% code-truth alignment
- **YOLO Mode Compliance**: All YOLO work follows proper task management

### Process Validation

- All documented procedures tested and working
- TrackDown integration functioning correctly
- Epic/subticket workflow demonstrated successfully
- Code-truth validation process established and followed

This workflow ensures systematic, task-linked development with proper validation and deployment procedures while maintaining code-truth alignment throughout the development lifecycle.
