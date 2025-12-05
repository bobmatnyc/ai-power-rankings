# Quick Deploy Reference

## TL;DR

```bash
# 1. Test first
./scripts/deploy.sh --dry-run patch

# 2. Deploy
./scripts/deploy.sh patch "Your changelog message"

# 3. Monitor
# https://vercel.com/dashboard
```

## Common Commands

### Security Patch
```bash
./scripts/deploy.sh patch "Security fix for CVE-2025-XXXXX"
```

### Bug Fix
```bash
./scripts/deploy.sh patch "Fix [issue description]"
```

### New Feature
```bash
./scripts/deploy.sh minor "Add [feature name]"
```

### Breaking Change
```bash
./scripts/deploy.sh major "Breaking: [description]"
```

## Pre-Deploy Checklist

- [ ] All changes committed
- [ ] Tests passing
- [ ] On main branch
- [ ] Synced with remote

## Version Examples

| Current | Type | New | Use Case |
|---------|------|-----|----------|
| 0.3.13 | patch | 0.3.14 | Bug fixes |
| 0.3.13 | minor | 0.4.0 | New features |
| 0.3.13 | major | 1.0.0 | Breaking changes |

## Troubleshooting

**"Working directory is not clean"**
```bash
git status
git add .
git commit -m "Your changes"
```

**"Not on main branch"**
```bash
git checkout main
git pull origin main
```

**"Branch not up to date"**
```bash
git pull origin main
```

## Full Documentation

See [DEPLOYMENT_AUTOMATION.md](./DEPLOYMENT_AUTOMATION.md) for complete guide.
