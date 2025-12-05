# Deployment Automation Guide

## Overview

The `scripts/deploy.sh` script provides automated versioning, changelog management, git tagging, and deployment for the AI Power Ranking project.

## Quick Start

```bash
# Dry run to preview changes
./scripts/deploy.sh --dry-run patch

# Deploy a patch version (bug fixes)
./scripts/deploy.sh patch "Security fix for CVE-2025-55182"

# Deploy a minor version (new features)
./scripts/deploy.sh minor "Add sitemap verification"

# Deploy a major version (breaking changes)
./scripts/deploy.sh major
```

## Features

### ✅ Automated Version Bumping
- Semantic versioning (semver) support: `patch`, `minor`, `major`
- Automatic package.json version updates
- Follows industry standard versioning practices

### ✅ Changelog Management
- Automatic CHANGELOG.md updates with version and date
- Follows [Keep a Changelog](https://keepachangelog.com/) format
- Support for custom changelog messages
- Auto-generated templates for each version type

### ✅ Git Operations
- Conventional commit messages
- Automatic git tagging with version
- Push to remote with tags
- Branch validation and safety checks

### ✅ Safety Features
- Dry-run mode for testing
- Git status validation (clean working directory required)
- Branch verification (warns if not on main)
- Remote sync validation
- Pre-flight prerequisite checks

### ✅ Deployment Integration
- Automatic Vercel deployment trigger
- Option to skip deployment (`--skip-deploy`)
- Clear deployment monitoring instructions

## Usage

### Basic Syntax

```bash
./scripts/deploy.sh [OPTIONS] <version-type> [message]
```

### Arguments

| Argument | Required | Description | Example |
|----------|----------|-------------|---------|
| `version-type` | Yes | One of: `patch`, `minor`, `major` | `patch` |
| `message` | No | Custom changelog message | `"Fix security issue"` |

### Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without making them |
| `--skip-deploy` | Skip Vercel deployment trigger |
| `--help` | Show help message |

## Version Types

### Patch (0.3.13 → 0.3.14)
Use for bug fixes, security patches, and minor improvements.

```bash
./scripts/deploy.sh patch "Security fix for CVE-2025-55182"
```

**Auto-generated changelog:**
```markdown
### Fixed
- Bug fixes and minor improvements
```

### Minor (0.3.13 → 0.4.0)
Use for new features that are backward compatible.

```bash
./scripts/deploy.sh minor "Add sitemap verification feature"
```

**Auto-generated changelog:**
```markdown
### Added
- New features and enhancements

### Changed
- Updates to existing functionality
```

### Major (0.3.13 → 1.0.0)
Use for breaking changes and major releases.

```bash
./scripts/deploy.sh major
```

**Auto-generated changelog:**
```markdown
### Breaking Changes
- Major updates with breaking changes

### Migration
- See migration guide for upgrade instructions
```

## Examples

### Example 1: Security Patch
```bash
# Test first
./scripts/deploy.sh --dry-run patch "Fix CVE-2025-55182"

# Deploy
./scripts/deploy.sh patch "Fix CVE-2025-55182"
```

**Result:**
- Version: 0.3.13 → 0.3.14
- Commit: `chore(release): bump version to 0.3.14`
- Tag: `v0.3.14`
- CHANGELOG.md updated with security fix note

### Example 2: Feature Release
```bash
./scripts/deploy.sh minor "Add sitemap verification and ISR optimization"
```

**Result:**
- Version: 0.3.13 → 0.4.0
- Commit: `chore(release): bump version to 0.4.0`
- Tag: `v0.4.0`
- CHANGELOG.md updated with feature description
- Vercel deployment triggered

### Example 3: Skip Deployment
```bash
./scripts/deploy.sh patch --skip-deploy "Internal refactoring"
```

**Result:**
- Version bumped, tagged, and pushed
- No Vercel deployment triggered
- Useful for internal releases or testing

### Example 4: Custom Changelog
```bash
./scripts/deploy.sh minor "### Added
- Sitemap verification script
- ISR optimization for tool pages

### Fixed
- Google Search Console indexing issues
- Performance bottlenecks in ranking generation"
```

**Result:**
- Version: 0.3.13 → 0.4.0
- Custom multi-line changelog message preserved

## Prerequisites

### Required
- ✅ Git repository
- ✅ Clean working directory (no uncommitted changes)
- ✅ Node.js and npm installed
- ✅ Git configured with `user.name` and `user.email`

### Optional
- Vercel CLI (for deployment trigger)

### Setup

```bash
# Verify prerequisites
git config user.name
git config user.email
node --version
npm --version

# Optional: Install Vercel CLI
npm install -g vercel
```

## Workflow Details

### Step-by-Step Process

1. **Prerequisite Checks**
   - Verify git repository
   - Check package.json exists
   - Validate Node.js and npm
   - Check git configuration
   - Verify Vercel CLI (optional)

2. **Git Status Validation**
   - Ensure working directory is clean
   - Warn if not on main branch
   - Check remote sync status

3. **Version Bump**
   - Parse current version from package.json
   - Calculate new version based on type
   - Update package.json (using `npm version`)

4. **Changelog Update**
   - Add new version entry with date
   - Insert custom or auto-generated message
   - Maintain Keep a Changelog format

5. **Git Commit**
   - Stage package.json, CHANGELOG.md, package-lock.json
   - Create conventional commit
   - Include version type in commit body

6. **Git Tag**
   - Create annotated tag (e.g., `v0.3.14`)
   - Include release message

7. **Push to Remote**
   - Push commits to origin
   - Push tags to origin

8. **Deployment**
   - Trigger Vercel deployment (automatic on push)
   - Provide monitoring instructions

## Safety Features

### Dry Run Mode

Test the entire workflow without making changes:

```bash
./scripts/deploy.sh --dry-run patch "Test deployment"
```

**Output shows:**
- What version would be created
- What CHANGELOG.md changes would be made
- What git operations would be performed
- No actual files are modified

### Validation Checks

The script validates:

| Check | Behavior |
|-------|----------|
| Clean working directory | **Exits** if uncommitted changes exist |
| On main branch | **Warns** and prompts for confirmation |
| Up to date with remote | **Warns** and prompts for confirmation |
| Git configuration | **Exits** if user.name or user.email missing |
| Package.json exists | **Exits** if not found |

### Rollback

If deployment fails, you can rollback:

```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Delete tag
git tag -d v0.3.14

# Remove remote tag
git push origin :refs/tags/v0.3.14
```

## Troubleshooting

### Issue: "Working directory is not clean"
**Solution:** Commit or stash your changes first
```bash
git status
git add .
git commit -m "Your changes"
```

### Issue: "Git user.name and user.email must be configured"
**Solution:** Configure git
```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### Issue: "Vercel CLI not installed"
**Solution:** Install Vercel CLI or use `--skip-deploy`
```bash
npm install -g vercel
# OR
./scripts/deploy.sh patch --skip-deploy
```

### Issue: "Branch is not up to date with remote"
**Solution:** Pull latest changes
```bash
git pull origin main
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Deploy Release

on:
  workflow_dispatch:
    inputs:
      version_type:
        description: 'Version type (patch, minor, major)'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major
      message:
        description: 'Changelog message (optional)'
        required: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Configure Git
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
      - name: Run Deployment
        run: |
          ./scripts/deploy.sh ${{ github.event.inputs.version_type }} "${{ github.event.inputs.message }}"
```

## Best Practices

### 1. Always Dry Run First
```bash
./scripts/deploy.sh --dry-run patch "Your message"
```

### 2. Write Descriptive Changelog Messages
```bash
# Good
./scripts/deploy.sh patch "Fix CVE-2025-55182 in React dependency"

# Better
./scripts/deploy.sh patch "### Security
- Fix CVE-2025-55182 in React 19.2.1
- Upgrade Next.js to 15.5.7

### Fixed
- Resolve sitemap XML validation errors"
```

### 3. Tag After Verification
Wait for Vercel deployment to complete before creating GitHub release.

### 4. Follow Semantic Versioning
- `patch`: Bug fixes, no API changes
- `minor`: New features, backward compatible
- `major`: Breaking changes

### 5. Keep CHANGELOG Updated
The script handles this automatically, but verify the format:
```markdown
## [0.3.14] - 2025-12-05

### Security
- Fix CVE-2025-55182 in React dependency

### Fixed
- Resolve sitemap XML validation errors
```

## Configuration

### Customization

Edit `/Users/masa/Projects/aipowerranking/scripts/deploy.sh` to customize:

```bash
# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'

# Paths
PACKAGE_JSON="$PROJECT_ROOT/package.json"
CHANGELOG="$PROJECT_ROOT/CHANGELOG.md"

# Default options
SKIP_DEPLOY=false
```

### Auto-generated Messages

Customize templates in the `generate_changelog_message()` function:

```bash
generate_changelog_message() {
    case "$version_type" in
        patch)
            echo "### Fixed
- Bug fixes and security patches"
            ;;
        # ... more templates
    esac
}
```

## Changelog Format

The script maintains this CHANGELOG.md structure:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.14] - 2025-12-05

### Security
- Fix CVE-2025-55182 in React dependency

### Fixed
- Resolve sitemap XML validation errors

## [0.3.13] - 2025-12-01

### Added
- Sitemap verification script

...
```

### Changelog Sections

Use these standard sections:

| Section | Purpose | Example |
|---------|---------|---------|
| `### Added` | New features | New API endpoint |
| `### Changed` | Changes to existing | Updated algorithm |
| `### Deprecated` | Soon-to-be removed | Old API version |
| `### Removed` | Removed features | Deleted endpoint |
| `### Fixed` | Bug fixes | Fixed memory leak |
| `### Security` | Security patches | CVE-2025-XXXXX |

## Next Steps After Deployment

1. **Monitor Vercel Deployment**
   - Visit: https://vercel.com/dashboard
   - Verify build succeeds
   - Check deployment logs

2. **Verify Production**
   ```bash
   # Check version
   curl https://aipowerranking.com/api/version

   # Test critical paths
   curl https://aipowerranking.com/sitemap.xml
   ```

3. **Create GitHub Release**
   - Visit: https://github.com/bobmatnyc/ai-power-rankings/releases/new?tag=v0.3.14
   - Add release notes from CHANGELOG.md
   - Publish release

4. **Announce Release**
   - Update project README if needed
   - Post to team channels
   - Update documentation site

## Related Documentation

- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Vercel Deployment Docs](https://vercel.com/docs)

## Support

For issues or questions:
- File an issue: https://github.com/bobmatnyc/ai-power-rankings/issues
- Contact: See project README

---

**Last Updated:** 2025-12-05
**Script Version:** 1.0.0
**Maintained By:** AI Power Ranking Team
