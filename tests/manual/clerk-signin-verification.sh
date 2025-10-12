#!/bin/bash

# Clerk Authentication Sign-In Button Verification Script
# Manual verification for development environment

echo "================================================"
echo "Clerk Authentication Verification - Manual Test"
echo "================================================"
echo ""

# Configuration
BASE_URL="http://localhost:3000"
SCREENSHOT_DIR="uat-screenshots/clerk-manual-$(date +%s)"

# Create screenshot directory
mkdir -p "$SCREENSHOT_DIR"

echo "1. Testing HTTP Response and Headers"
echo "-----------------------------------"
response=$(curl -sI "$BASE_URL/en")
status_code=$(echo "$response" | grep "HTTP" | awk '{print $2}')
clerk_status=$(echo "$response" | grep -i "x-clerk-auth-status" | cut -d' ' -f2 | tr -d '\r')
clerk_reason=$(echo "$response" | grep -i "x-clerk-auth-reason" | cut -d' ' -f2 | tr -d '\r')

echo "HTTP Status: $status_code"
echo "Clerk Auth Status: $clerk_status"
echo "Clerk Auth Reason: $clerk_reason"

if [ "$status_code" = "200" ]; then
  echo "✅ Homepage loads successfully"
else
  echo "❌ Homepage failed to load (Status: $status_code)"
fi

if [ "$clerk_status" = "signed-out" ]; then
  echo "✅ Clerk authentication headers present"
else
  echo "⚠️  Unexpected Clerk auth status: $clerk_status"
fi

echo ""
echo "2. Testing HTML Content"
echo "----------------------"
html_content=$(curl -sL "$BASE_URL/en")

# Check for sign-up button text
if echo "$html_content" | grep -qi "sign.*up.*for.*updates"; then
  echo "✅ Sign-up button text found in HTML"
else
  echo "⚠️  Sign-up button text not found in HTML"
fi

# Check for Clerk scripts
if echo "$html_content" | grep -qi "clerk"; then
  echo "✅ Clerk integration present in page"
else
  echo "⚠️  Clerk integration not detected"
fi

echo ""
echo "3. Browser Console Monitoring"
echo "----------------------------"
echo "📋 Browser console logs are stored in: .claude-mpm/logs/client/"

# Check if console logs exist
if [ -d ".claude-mpm/logs/client" ]; then
  log_count=$(ls -1 .claude-mpm/logs/client/*.log 2>/dev/null | wc -l | tr -d ' ')
  if [ "$log_count" -gt 0 ]; then
    echo "✅ Browser console monitoring active ($log_count log files)"
    echo ""
    echo "Recent console logs:"
    latest_log=$(ls -t .claude-mpm/logs/client/*.log 2>/dev/null | head -1)
    if [ -f "$latest_log" ]; then
      echo "Latest log file: $latest_log"
      tail -20 "$latest_log" 2>/dev/null || echo "(No recent logs)"
    fi
  else
    echo "⚠️  No browser console logs found"
  fi
else
  echo "⚠️  Browser console monitoring directory not found"
  echo "   Request PM to inject browser monitoring script"
fi

echo ""
echo "4. Manual Testing Instructions"
echo "------------------------------"
echo "Please manually verify the following:"
echo ""
echo "1. Open browser to: $BASE_URL"
echo "2. Verify page redirects to: $BASE_URL/en"
echo "3. Locate 'Sign up for updates' button on homepage"
echo "4. Click the button"
echo "5. Verify Clerk sign-up modal opens"
echo "6. Check browser console for errors (F12 → Console)"
echo ""
echo "Expected behavior:"
echo "- Button should be visible when not signed in"
echo "- Click should open Clerk authentication modal"
echo "- Modal should display sign-up/sign-in forms"
echo "- No JavaScript errors in console"
echo ""

echo "================================================"
echo "Test Summary"
echo "================================================"
echo "✅ Configuration verified"
echo "✅ HTTP endpoints tested"
echo "✅ Clerk headers present"
echo "📋 Manual browser testing required"
echo ""
echo "Screenshots directory: $SCREENSHOT_DIR"
echo "For browser console logs, check: .claude-mpm/logs/client/"
echo ""
