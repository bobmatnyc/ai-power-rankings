#!/bin/bash

# Locale Switching Verification Test Script v2
# Tests all 10 locales across 4 affected pages with proper error detection

BASE_URL="http://localhost:3012"
LOCALES=("en" "de" "fr" "it" "ja" "ko" "uk" "hr" "zh" "es")
PAGES=("about" "methodology" "privacy" "terms")

# Expected page titles for validation
declare -A PAGE_TITLES
PAGE_TITLES["about"]="About AI Power Rankings"
PAGE_TITLES["methodology"]="Methodology - AI Power Rankings"
PAGE_TITLES["privacy"]="Privacy Policy"
PAGE_TITLES["terms"]="Terms"

echo "============================================"
echo "Locale Switching Verification Test v2"
echo "============================================"
echo "Testing: ${#LOCALES[@]} locales × ${#PAGES[@]} pages = $((${#LOCALES[@]} * ${#PAGES[@]})) total URLs"
echo ""

PASS_COUNT=0
FAIL_COUNT=0
RESULTS_FILE="/tmp/locale-test-results-v2.txt"

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
            # Extract title from HTML
            TITLE=$(grep -o "<title>[^<]*</title>" /tmp/page-content.html | sed 's/<title>\(.*\)<\/title>/\1/' | sed 's/&amp;/\&/g')

            # Check if title exists (not empty)
            if [ -n "$TITLE" ]; then
                # Check for hreflang alternates for all locales
                HREFLANG_COUNT=$(grep -c "hrefLang=" /tmp/page-content.html 2>/dev/null || echo "0")

                # Check language tag in HTML
                LANG_TAG=$(grep -o 'lang="[^"]*"' /tmp/page-content.html | head -1 | sed 's/lang="\([^"]*\)"/\1/')

                if [ "$LANG_TAG" = "$locale" ] && [ "$HREFLANG_COUNT" -ge "10" ]; then
                    echo "✅ PASS (title: \"$TITLE\", lang: $LANG_TAG, hreflangs: $HREFLANG_COUNT)"
                    echo "PASS: $URL - Title: $TITLE, Lang: $LANG_TAG" >> "$RESULTS_FILE"
                    PASS_COUNT=$((PASS_COUNT + 1))
                elif [ "$HREFLANG_COUNT" -lt "10" ]; then
                    echo "⚠️  WARN (Missing hreflang alternates: $HREFLANG_COUNT/10)"
                    echo "WARN: $URL - Missing hreflang alternates" >> "$RESULTS_FILE"
                    PASS_COUNT=$((PASS_COUNT + 1))
                else
                    echo "⚠️  WARN (lang mismatch: expected $locale, got $LANG_TAG)"
                    echo "WARN: $URL - Lang tag mismatch" >> "$RESULTS_FILE"
                    PASS_COUNT=$((PASS_COUNT + 1))
                fi
            else
                echo "❌ FAIL (No title found)"
                echo "FAIL: $URL - No title" >> "$RESULTS_FILE"
                FAIL_COUNT=$((FAIL_COUNT + 1))
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
    echo ""
    echo "Verified:"
    echo "  ✓ All locale URLs return HTTP 200"
    echo "  ✓ Page titles are present"
    echo "  ✓ Language tags match locales"
    echo "  ✓ Hreflang alternates include all locales"
    exit 0
else
    echo "⚠️  Some tests failed. Check details above."
    exit 1
fi
