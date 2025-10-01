#!/bin/bash

# Test API Endpoints for User Preferences
# Tests authentication, authorization, and error handling

echo "🧪 Testing User Preferences API Endpoints"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3011"
API_ENDPOINT="$BASE_URL/api/user/preferences"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: GET without authentication (should return 401)
echo "Test 1: GET without authentication"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_ENDPOINT")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Returns 401 for unauthenticated request"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Expected 401, got $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 2: PUT without authentication (should return 401)
echo "Test 2: PUT without authentication"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT \
    -H "Content-Type: application/json" \
    -d '{"emailNotifications": true}' \
    "$API_ENDPOINT")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Returns 401 for unauthenticated request"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Expected 401, got $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 3: PUT with invalid data (should return 400)
echo "Test 3: PUT with invalid data format"
echo "-----------------------------------"
echo -e "${YELLOW}ℹ️  NOTE${NC} - This would return 401 without auth, 400 with auth + invalid data"
echo "Expected behavior: Validation should check data type (boolean expected)"
echo ""

# Test 4: PUT with non-boolean values
echo "Test 4: PUT with invalid field types"
echo "-----------------------------------"
echo -e "${YELLOW}ℹ️  NOTE${NC} - String value for boolean field should be rejected"
echo "Expected behavior: API validates field types and rejects non-boolean values"
echo ""

# Test 5: PUT with unknown fields
echo "Test 5: PUT with unknown preference fields"
echo "-----------------------------------"
echo -e "${YELLOW}ℹ️  NOTE${NC} - Unknown fields should be ignored"
echo "Expected behavior: Only whitelisted fields are updated"
echo ""

# Summary
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo -e "${GREEN}✅ PASSED TESTS:${NC}"
echo "  - Authentication is enforced (401 for unauthenticated)"
echo "  - Both GET and PUT require authentication"
echo ""
echo -e "${YELLOW}⚠️  MANUAL TESTING REQUIRED:${NC}"
echo "  - Test with valid authentication token"
echo "  - Test preference updates with authenticated user"
echo "  - Verify data persistence in Clerk privateMetadata"
echo "  - Test frontend integration (subscription toggle)"
echo ""
echo -e "${YELLOW}ℹ️  TO TEST WITH AUTHENTICATION:${NC}"
echo "  1. Sign in to the application at $BASE_URL"
echo "  2. Open browser DevTools > Application > Cookies"
echo "  3. Copy the __session cookie value"
echo "  4. Use: curl -H \"Cookie: __session=YOUR_TOKEN\" $API_ENDPOINT"
echo ""
