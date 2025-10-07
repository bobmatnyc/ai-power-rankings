#!/bin/bash

###############################################################################
# AI Power Ranking - UAT Test Suite Runner
#
# This script provides an easy way to run the test suite with various options.
# Usage: ./tests/run-tests.sh [option]
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     AI Power Ranking - UAT Test Suite                         ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

check_server() {
    print_info "Checking if server is running..."
    if curl -s http://localhost:3011/api/health > /dev/null 2>&1; then
        print_success "Server is running on port 3011"
        return 0
    else
        print_error "Server is not running on port 3011"
        print_info "Please start the server with: npm run dev"
        return 1
    fi
}

check_dependencies() {
    print_info "Checking dependencies..."

    # Check Node.js
    if command -v node > /dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_success "Node.js installed: $NODE_VERSION"
    else
        print_error "Node.js not installed"
        exit 1
    fi

    # Check npm
    if command -v npm > /dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        print_success "npm installed: $NPM_VERSION"
    else
        print_error "npm not installed"
        exit 1
    fi

    # Check Playwright
    if command -v npx > /dev/null 2>&1; then
        if npx playwright --version > /dev/null 2>&1; then
            PLAYWRIGHT_VERSION=$(npx playwright --version)
            print_success "Playwright installed: $PLAYWRIGHT_VERSION"
        else
            print_error "Playwright not installed"
            print_info "Run: npm run test:install"
            exit 1
        fi
    fi
}

run_all_tests() {
    print_header
    check_dependencies
    if check_server; then
        print_info "Running all E2E tests..."
        npm run test:e2e
        print_success "Tests completed!"
        print_info "View report: npm run test:report"
    fi
}

run_api_tests() {
    print_header
    check_dependencies
    if check_server; then
        print_info "Running API tests only..."
        npm run test:api
        print_success "API tests completed!"
    fi
}

run_ui_tests() {
    print_header
    check_dependencies
    if check_server; then
        print_info "Running UI tests only..."
        npm run test:ui
        print_success "UI tests completed!"
    fi
}

run_headed() {
    print_header
    check_dependencies
    if check_server; then
        print_info "Running tests in headed mode (browser visible)..."
        npm run test:e2e:headed
    fi
}

run_debug() {
    print_header
    check_dependencies
    if check_server; then
        print_info "Running tests in debug mode..."
        npm run test:e2e:debug
    fi
}

run_ui_mode() {
    print_header
    check_dependencies
    if check_server; then
        print_info "Opening Playwright UI..."
        npm run test:e2e:ui
    fi
}

show_report() {
    print_header
    print_info "Opening test report..."
    npm run test:report
}

install_browsers() {
    print_header
    print_info "Installing Playwright browsers..."
    npm run test:install
    print_success "Browsers installed!"
}

show_help() {
    print_header
    echo "Usage: ./tests/run-tests.sh [option]"
    echo ""
    echo "Options:"
    echo "  all       Run all E2E tests (default)"
    echo "  api       Run API tests only"
    echo "  ui        Run UI tests only"
    echo "  headed    Run tests with browser visible"
    echo "  debug     Run tests in debug mode"
    echo "  ui-mode   Open Playwright UI for interactive testing"
    echo "  report    Show test report"
    echo "  install   Install Playwright browsers"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./tests/run-tests.sh              # Run all tests"
    echo "  ./tests/run-tests.sh api          # Run API tests only"
    echo "  ./tests/run-tests.sh headed       # Watch tests run"
    echo "  ./tests/run-tests.sh report       # View results"
    echo ""
}

# Main script logic
case "${1:-all}" in
    all)
        run_all_tests
        ;;
    api)
        run_api_tests
        ;;
    ui)
        run_ui_tests
        ;;
    headed)
        run_headed
        ;;
    debug)
        run_debug
        ;;
    ui-mode)
        run_ui_mode
        ;;
    report)
        show_report
        ;;
    install)
        install_browsers
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown option: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
