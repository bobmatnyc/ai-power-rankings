# Scripts Directory

This directory contains utility scripts and tools for the AI Power Ranking project.

## 🚀 Deployment Scripts

### deploy.sh
**Automated deployment script for version management and deployment**

Location: `/scripts/deploy.sh`

**Quick Start:**
```bash
# Test deployment
./scripts/deploy.sh --dry-run patch

# Deploy patch version
./scripts/deploy.sh patch "Security fix description"

# Deploy minor version
./scripts/deploy.sh minor "New feature description"
```

**Features:**
- ✅ Semantic versioning (patch/minor/major)
- ✅ Automatic CHANGELOG.md updates
- ✅ Git commit and tagging
- ✅ Vercel deployment integration
- ✅ Dry-run mode for testing
- ✅ Safety validations

**Documentation:**
- Full Guide: [docs/deployment/DEPLOYMENT_AUTOMATION.md](../docs/deployment/DEPLOYMENT_AUTOMATION.md)
- Quick Reference: [docs/deployment/QUICK_DEPLOY.md](../docs/deployment/QUICK_DEPLOY.md)

## 📊 Database Scripts

### Migration Scripts
- `apply-*.ts` - Apply database migrations
- `migrate-*.ts` - Data migration utilities
- `verify-*.ts` - Verification and validation scripts

### Data Management
- `backup-*.ts` - Database backup utilities
- `restore-*.ts` - Database restoration scripts
- `compare-db-schemas.ts` - Schema comparison tool

### Analysis Scripts
- `analyze-*.ts` - Data analysis and reporting
- `check-*.ts` - Data validation and checks
- `audit-*.ts` - Data quality audits

## 🔧 Tool Management Scripts

### Content Updates
- `update-*.ts` - Tool content and metadata updates
- `enhance-*.ts` - Tool content enhancement scripts
- `verify-content-quality.ts` - Content quality validation

### Rankings Generation
- `generate-v*-rankings.ts` - Version-specific ranking generation
- `generate-static-categories.ts` - Static category file generation

## 🧪 Testing Scripts

### Integration Tests
- `test-*.ts` - Various test utilities
- `verify-*.ts` - Verification scripts
- `check-*.sh` - Shell-based verification scripts

### API Testing
- `test-api-endpoints.sh` - API endpoint testing
- `test-api-use-cases.ts` - Use case testing

## 📝 Utility Scripts

### Development Tools
- `generate-*.ts` - Code generation utilities
- `fix-*.ts` - Automated fix scripts
- `cleanup-*.ts` - Data cleanup utilities

### Monitoring
- `monitor-*.ts` - Monitoring and health check scripts
- `debug-*.ts` - Debugging utilities

## 🏗️ Infrastructure Scripts

### Build and Deploy
- `verify-vercel-deployment.ts` - Deployment verification
- `check-vercel-deployment.ts` - Deployment status checks

### Performance
- `optimize-*.ts` - Performance optimization scripts
- `validate-performance.ts` - Performance validation

## 📚 Documentation

### Script Documentation
- `CLEANUP-SCRIPTS-USAGE.md` - Cleanup scripts guide
- `README-*.md` - Various script documentation
- `MIGRATION-*.md` - Migration guides

## Common Patterns

### TypeScript Scripts
Most scripts are written in TypeScript and can be run with:
```bash
tsx scripts/script-name.ts
```

### Shell Scripts
Shell scripts are directly executable:
```bash
./scripts/script-name.sh
```

### NPM Scripts
Many scripts are available as npm commands in package.json:
```bash
npm run generate-categories
npm run migrate:prod-to-dev
npm run db:verify-tools
```

## Best Practices

### Before Running Scripts

1. **Read the Documentation**
   - Check for README or documentation files
   - Understand what the script does

2. **Backup First**
   - Run backup scripts before data operations
   - Use `--dry-run` flags when available

3. **Test in Development**
   - Always test in development environment first
   - Verify results before production

4. **Check Prerequisites**
   - Ensure required dependencies are installed
   - Verify environment variables are set

### Writing New Scripts

1. **Follow Naming Conventions**
   - Use descriptive names: `action-target.ts`
   - Examples: `verify-tool-data.ts`, `update-rankings.ts`

2. **Add Documentation**
   - Include header comments explaining purpose
   - Document required environment variables
   - Add usage examples

3. **Include Error Handling**
   - Validate inputs
   - Handle edge cases
   - Provide clear error messages

4. **Make Scripts Idempotent**
   - Safe to run multiple times
   - Check state before making changes
   - Include rollback mechanisms

## Environment Variables

Most scripts require these environment variables:

```bash
# Database
DATABASE_URL=postgresql://...

# APIs
GOOGLE_API_KEY=...
GITHUB_TOKEN=...

# Deployment
VERCEL_TOKEN=...
```

Load from `.env.local`:
```bash
source .env.local
tsx scripts/your-script.ts
```

## Getting Help

### Script-Specific Help
Many scripts include `--help` flags:
```bash
./scripts/deploy.sh --help
```

### Documentation
Check the following locations:
1. Script header comments
2. `docs/deployment/` - Deployment documentation
3. `docs/development/` - Development guides
4. `scripts/README-*.md` - Specific script documentation

### Common Issues

**Permission Denied:**
```bash
chmod +x scripts/script-name.sh
```

**TypeScript Errors:**
```bash
npm install -g tsx
```

**Environment Variables:**
```bash
cp .env.example .env.local
# Edit .env.local with your values
```

## Script Organization

### Categories

```
scripts/
├── deploy.sh              # 🚀 Deployment automation
├── apply-*.ts             # 📊 Database migrations
├── migrate-*.ts           # 📊 Data migrations
├── generate-*.ts          # 🏗️ Code generation
├── verify-*.ts            # 🧪 Verification
├── test-*.ts              # 🧪 Testing
├── update-*.ts            # 🔧 Content updates
├── check-*.ts             # ✅ Validation
├── analyze-*.ts           # 📈 Analysis
├── backup-*.ts            # 💾 Backups
├── restore-*.ts           # 💾 Restoration
└── README.md              # 📚 This file
```

## Contributing

When adding new scripts:

1. Place in appropriate category
2. Add to this README
3. Include inline documentation
4. Add to package.json if commonly used
5. Test thoroughly before committing

## Support

For questions or issues:
- File an issue: https://github.com/bobmatnyc/ai-power-rankings/issues
- Check documentation: `docs/`

---

**Last Updated:** 2025-12-05
**Total Scripts:** 300+
**Maintained By:** AI Power Ranking Team
