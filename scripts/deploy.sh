#!/bin/bash

###############################################################################
# Deployment Automation Script for AI Power Ranking
#
# Description:
#   Automates versioning, changelog updates, git tagging, and deployment
#   following semantic versioning (semver) and conventional commits.
#
# Usage:
#   ./scripts/deploy.sh [OPTIONS] <version-type> [message]
#
# Arguments:
#   version-type    Required. One of: patch, minor, major
#   message         Optional. Custom changelog message
#
# Options:
#   --dry-run       Preview changes without making them
#   --skip-deploy   Skip Vercel deployment trigger
#   --help          Show this help message
#
# Examples:
#   ./scripts/deploy.sh --dry-run patch
#   ./scripts/deploy.sh patch "Security fix for CVE-2025-55182"
#   ./scripts/deploy.sh minor "Add new feature X"
#   ./scripts/deploy.sh major --skip-deploy
#
# Requirements:
#   - Clean git working directory
#   - Node.js and npm installed
#   - Git configured with user.name and user.email
#   - Vercel CLI installed (for deployment)
#
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_JSON="$PROJECT_ROOT/package.json"
CHANGELOG="$PROJECT_ROOT/CHANGELOG.md"

# Default options
DRY_RUN=false
SKIP_DEPLOY=false
VERSION_TYPE=""
CUSTOM_MESSAGE=""

###############################################################################
# Utility Functions
###############################################################################

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

show_help() {
    cat << EOF
Deployment Automation Script for AI Power Ranking

USAGE:
    ./scripts/deploy.sh [OPTIONS] <version-type> [message]

ARGUMENTS:
    version-type    Required. One of: patch, minor, major
    message         Optional. Custom changelog message

OPTIONS:
    --dry-run       Preview changes without making them
    --skip-deploy   Skip Vercel deployment trigger
    --help          Show this help message

EXAMPLES:
    # Dry run to preview changes
    ./scripts/deploy.sh --dry-run patch

    # Deploy patch version with custom message
    ./scripts/deploy.sh patch "Security fix for CVE-2025-55182"

    # Deploy minor version
    ./scripts/deploy.sh minor "Add new feature X"

    # Deploy without triggering Vercel
    ./scripts/deploy.sh major --skip-deploy

VERSION TYPES:
    patch    Bug fixes and small updates (0.3.13 -> 0.3.14)
    minor    New features, backward compatible (0.3.13 -> 0.4.0)
    major    Breaking changes (0.3.13 -> 1.0.0)

PREREQUISITES:
    - Clean git working directory
    - Node.js and npm installed
    - Git configured (user.name and user.email)
    - Vercel CLI installed (optional, for deployment)

EOF
    exit 0
}

###############################################################################
# Validation Functions
###############################################################################

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not a git repository"
        exit 1
    fi
    print_success "Git repository detected"

    # Check if package.json exists
    if [[ ! -f "$PACKAGE_JSON" ]]; then
        print_error "package.json not found at $PACKAGE_JSON"
        exit 1
    fi
    print_success "package.json found"

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_success "Node.js $(node --version) detected"

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm $(npm --version) detected"

    # Check git configuration
    if [[ -z "$(git config user.name)" ]] || [[ -z "$(git config user.email)" ]]; then
        print_error "Git user.name and user.email must be configured"
        exit 1
    fi
    print_success "Git configured: $(git config user.name) <$(git config user.email)>"

    # Check for Vercel CLI (warning only)
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not installed (deployment will be skipped)"
        SKIP_DEPLOY=true
    elif [[ "$SKIP_DEPLOY" == false ]]; then
        print_success "Vercel CLI detected"
    fi
}

check_git_status() {
    print_header "Checking Git Status"

    # Check for uncommitted changes
    if [[ -n "$(git status --porcelain)" ]]; then
        print_error "Working directory is not clean. Please commit or stash changes."
        echo ""
        git status --short
        exit 1
    fi
    print_success "Working directory is clean"

    # Check if we're on the main branch (warning only)
    CURRENT_BRANCH="$(git branch --show-current)"
    if [[ "$CURRENT_BRANCH" != "main" ]]; then
        print_warning "Not on main branch (current: $CURRENT_BRANCH)"
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_success "On main branch"
    fi

    # Check if we're up to date with remote
    git fetch origin
    LOCAL=$(git rev-parse @)
    REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
    if [[ -n "$REMOTE" && "$LOCAL" != "$REMOTE" ]]; then
        print_warning "Branch is not up to date with remote"
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_success "Up to date with remote"
    fi
}

###############################################################################
# Version Management
###############################################################################

get_current_version() {
    node -p "require('$PACKAGE_JSON').version"
}

bump_version() {
    local version_type=$1
    local current_version
    current_version=$(get_current_version)

    print_info "Current version: $current_version"

    # Parse version components
    IFS='.' read -r major minor patch <<< "$current_version"

    case "$version_type" in
        patch)
            patch=$((patch + 1))
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        *)
            print_error "Invalid version type: $version_type"
            exit 1
            ;;
    esac

    echo "$major.$minor.$patch"
}

update_package_version() {
    local new_version=$1

    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY RUN] Would update package.json to version $new_version"
        return
    fi

    # Use npm version to update package.json (without git tag)
    npm version "$new_version" --no-git-tag-version > /dev/null 2>&1
    print_success "Updated package.json to version $new_version"
}

###############################################################################
# Changelog Management
###############################################################################

update_changelog() {
    local new_version=$1
    local message=$2
    local date
    date=$(date +%Y-%m-%d)

    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY RUN] Would add to CHANGELOG.md:"
        echo ""
        echo "## [$new_version] - $date"
        echo ""
        echo "$message"
        echo ""
        return
    fi

    # Create temporary file for new changelog content
    local temp_changelog
    temp_changelog=$(mktemp)

    # Find the line number where we should insert the new version
    # (after the header, before the first version entry)
    local insert_line
    insert_line=$(grep -n "^## \[" "$CHANGELOG" | head -1 | cut -d: -f1)

    if [[ -z "$insert_line" ]]; then
        # If no previous versions, insert after the header
        insert_line=$(grep -n "^# Changelog" "$CHANGELOG" | tail -1 | cut -d: -f1)
        insert_line=$((insert_line + 4))
    fi

    # Build the new entry
    {
        # Copy everything before the insert point
        head -n $((insert_line - 1)) "$CHANGELOG"

        # Add new version entry
        echo "## [$new_version] - $date"
        echo ""
        echo "$message"
        echo ""

        # Copy everything from the insert point onwards
        tail -n +$insert_line "$CHANGELOG"
    } > "$temp_changelog"

    # Replace the original changelog
    mv "$temp_changelog" "$CHANGELOG"

    print_success "Updated CHANGELOG.md with version $new_version"
}

###############################################################################
# Git Operations
###############################################################################

create_git_commit() {
    local new_version=$1
    local version_type=$2

    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY RUN] Would create git commit: chore(release): bump version to $new_version"
        return
    fi

    git add "$PACKAGE_JSON" "$CHANGELOG" package-lock.json 2>/dev/null || true
    git commit -m "chore(release): bump version to $new_version" \
               -m "Version bump: $version_type" \
               -m "Updated package.json and CHANGELOG.md"

    print_success "Created git commit"
}

create_git_tag() {
    local new_version=$1

    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY RUN] Would create git tag: v$new_version"
        return
    fi

    git tag -a "v$new_version" -m "Release v$new_version"
    print_success "Created git tag v$new_version"
}

push_to_remote() {
    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY RUN] Would push to origin with tags"
        return
    fi

    git push origin "$(git branch --show-current)"
    git push origin --tags
    print_success "Pushed changes and tags to remote"
}

###############################################################################
# Deployment
###############################################################################

trigger_deployment() {
    if [[ "$SKIP_DEPLOY" == true ]]; then
        print_info "Skipping deployment (--skip-deploy or Vercel CLI not available)"
        return
    fi

    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY RUN] Would trigger Vercel deployment"
        return
    fi

    print_info "Triggering Vercel deployment..."

    # Note: Vercel auto-deploys on git push to main by default
    # This is just a notification that deployment should occur automatically
    print_success "Deployment will be triggered automatically by git push"
    print_info "Monitor deployment at: https://vercel.com/dashboard"
}

###############################################################################
# Main Workflow
###############################################################################

generate_changelog_message() {
    local version_type=$1
    local custom_message=$2

    if [[ -n "$custom_message" ]]; then
        echo "$custom_message"
        return
    fi

    # Auto-generate message based on version type
    case "$version_type" in
        patch)
            echo "### Fixed
- Bug fixes and minor improvements"
            ;;
        minor)
            echo "### Added
- New features and enhancements

### Changed
- Updates to existing functionality"
            ;;
        major)
            echo "### Breaking Changes
- Major updates with breaking changes

### Migration
- See migration guide for upgrade instructions"
            ;;
    esac
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-deploy)
                SKIP_DEPLOY=true
                shift
                ;;
            --help|-h)
                show_help
                ;;
            patch|minor|major)
                VERSION_TYPE=$1
                shift
                # Check if next argument is a custom message
                if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
                    CUSTOM_MESSAGE=$1
                    shift
                fi
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Validate arguments
    if [[ -z "$VERSION_TYPE" ]]; then
        print_error "Version type is required (patch, minor, or major)"
        echo "Use --help for usage information"
        exit 1
    fi

    # Show dry run notice
    if [[ "$DRY_RUN" == true ]]; then
        print_header "DRY RUN MODE - No Changes Will Be Made"
    fi

    # Run workflow
    check_prerequisites
    check_git_status

    print_header "Version Bump"
    local current_version
    local new_version
    current_version=$(get_current_version)
    new_version=$(bump_version "$VERSION_TYPE")

    print_info "Bumping version: $current_version -> $new_version ($VERSION_TYPE)"

    print_header "Updating Files"
    update_package_version "$new_version"

    local changelog_message
    changelog_message=$(generate_changelog_message "$VERSION_TYPE" "$CUSTOM_MESSAGE")
    update_changelog "$new_version" "$changelog_message"

    print_header "Git Operations"
    create_git_commit "$new_version" "$VERSION_TYPE"
    create_git_tag "$new_version"
    push_to_remote

    print_header "Deployment"
    trigger_deployment

    # Final summary
    print_header "Deployment Summary"
    echo ""
    print_success "Version: $current_version -> $new_version"
    print_success "Type: $VERSION_TYPE"
    if [[ -n "$CUSTOM_MESSAGE" ]]; then
        print_success "Message: $CUSTOM_MESSAGE"
    fi

    if [[ "$DRY_RUN" == true ]]; then
        echo ""
        print_warning "DRY RUN COMPLETED - No actual changes were made"
    else
        echo ""
        print_success "Deployment completed successfully!"
        echo ""
        print_info "Next steps:"
        echo "  1. Monitor Vercel deployment: https://vercel.com/dashboard"
        echo "  2. Verify deployment in production"
        echo "  3. Create GitHub release: https://github.com/bobmatnyc/ai-power-rankings/releases/new?tag=v$new_version"
    fi

    echo ""
}

# Run main function
main "$@"
