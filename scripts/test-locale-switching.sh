#!/bin/bash

# Locale Switching Verification Test Script
# Tests all 10 locales across 4 affected pages

BASE_URL="http://localhost:3012"
LOCALES=("en" "de" "fr" "it" "ja" "ko" "uk" "hr" "zh" "es")
PAGES=("about" "methodology" "privacy" "terms")

echo "============================================"
echo "Locale Switching Verification Test"
echo "============================================"
echo "Testing: ${#LOCALES[@]} locales × ${#PAGES[@]} pages = $((${#LOCALES[@]} * ${#PAGES[@]})) total URLs"
echo ""

PASS_COUNT=0
FAIL_COUNT=0
RESULTS_FILE="/tmp/locale-test-results.txt"

> "$RESULTS_FILE"

for locale in "${LOCALES[@]}"; do
    echo "--- Testing Locale: $locale ---"
    for page in "${PAGES[@]}"; do
        URL="${BASE_URL}/${locale}/${page}"
        echo -n "  Testing ${URL} ... "

        # Use curl to test the URL
        RESPONSE=$(curl -s -o /tmp/page-content.html -w "%{http_code}" "$URL" 2>&1)
        HTTP_CODE="${RESPONSE: -3}"

        # Check HTTP status code
        if [ "$HTTP_CODE" = "200" ]; then
            # Check if response contains error indicators
            if grep -q "Something went wrong\|Application error\|500\|404" /tmp/page-content.html 2>/dev/null; then
                echo "❌ FAIL (Error page detected)"
                echo "FAIL: $URL - Error page" >> "$RESULTS_FILE"
                FAIL_COUNT=$((FAIL_COUNT + 1))
            else
                echo "✅ PASS"
                echo "PASS: $URL" >> "$RESULTS_FILE"
                PASS_COUNT=$((PASS_COUNT + 1))
            fi
        elif [ "$HTTP_CODE" = "404" ]; then
            echo "❌ FAIL (404 Not Found)"
            echo "FAIL: $URL - 404" >> "$RESULTS_FILE"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        elif [ "$HTTP_CODE" = "500" ]; then
            echo "❌ FAIL (500 Server Error)"
            echo "FAIL: $URL - 500" >> "$RESULTS_FILE"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        else
            echo "⚠️  WARN (HTTP $HTTP_CODE)"
            echo "WARN: $URL - HTTP $HTTP_CODE" >> "$RESULTS_FILE"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    done
    echo ""
done

echo "============================================"
echo "Test Results Summary"
echo "============================================"
echo "Total URLs Tested: $((PASS_COUNT + FAIL_COUNT))"
echo "✅ Passed: $PASS_COUNT"
echo "❌ Failed: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo "🎉 All tests passed! All 10 locales working correctly."
    exit 0
else
    echo "⚠️  Some tests failed. Check details above."
    exit 1
fi
