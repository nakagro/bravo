#!/bin/bash

# Test script for API Key Authentication
# Usage: bash scripts/test-api-key.sh [your-convex-url] [your-convex-api-key]
# Note: Set CONVEX_API_KEY in your Convex environment first

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get Convex URL from argument or use default
CONVEX_URL="${1:-https://boss-convex.grayhux.io}"
API_KEY="${2}"

echo "========================================"
echo "API Key Authentication Test Suite"
echo "========================================"
echo "Testing endpoint: ${CONVEX_URL}/api/test-auth"
echo ""

# Test 1: No API Key (should return 401)
echo -e "${YELLOW}Test 1: Request without API key (expecting 401)${NC}"
response=$(curl -s -w "\n%{http_code}" "${CONVEX_URL}/api/test-auth")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "401" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Got 401 Unauthorized"
    echo "Response: $body"
else
    echo -e "${RED}✗ FAIL${NC} - Expected 401, got $http_code"
    echo "Response: $body"
fi
echo ""

# Test 2: Invalid API Key (should return 403)
echo -e "${YELLOW}Test 2: Request with invalid API key (expecting 403)${NC}"
response=$(curl -s -w "\n%{http_code}" -H "X-API-Key: invalid-key-12345" "${CONVEX_URL}/api/test-auth")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "403" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Got 403 Forbidden"
    echo "Response: $body"
else
    echo -e "${RED}✗ FAIL${NC} - Expected 403, got $http_code"
    echo "Response: $body"
fi
echo ""

# Test 3: Valid API Key (should return 200)
if [ -n "$API_KEY" ]; then
    echo -e "${YELLOW}Test 3: Request with valid API key (expecting 200)${NC}"
    response=$(curl -s -w "\n%{http_code}" -H "X-API-Key: ${API_KEY}" "${CONVEX_URL}/api/test-auth")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC} - Got 200 OK"
        echo "Response: $body"
    else
        echo -e "${RED}✗ FAIL${NC} - Expected 200, got $http_code"
        echo "Response: $body"
    fi
else
    echo -e "${YELLOW}Test 3: Skipped (no API key provided)${NC}"
    echo "To test with a valid API key, run:"
    echo "bash scripts/test-api-key.sh ${CONVEX_URL} your-api-key-here"
fi

echo ""
echo "========================================"
echo "Test Suite Complete"
echo "========================================"
