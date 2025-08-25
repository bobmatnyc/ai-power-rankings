#!/bin/bash

# Claude-MPM Configuration Test Script
# Tests the validity and completeness of the multi-agent configuration

echo "========================================="
echo "Claude-MPM Configuration Test"
echo "========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test file existence
test_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((TESTS_FAILED++))
    fi
}

# Function to test JSON validity
test_json() {
    if python3 -m json.tool "$1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $2 is valid JSON"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $2 is invalid JSON"
        ((TESTS_FAILED++))
    fi
}

# Function to test file size
test_size() {
    SIZE=$(stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null)
    MAX_SIZE=$((8 * 1024)) # 8KB in bytes
    
    if [ "$SIZE" -le "$MAX_SIZE" ]; then
        echo -e "${GREEN}✓${NC} $2 is under 8KB limit ($(($SIZE / 1024))KB)"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} $2 exceeds 8KB limit ($(($SIZE / 1024))KB)"
        ((TESTS_FAILED++))
    fi
}

echo "1. Testing Configuration Files"
echo "------------------------------"
test_file ".claude-mpm/config/project.json" "project.json exists"
test_file ".claude-mpm/config/agents.json" "agents.json exists"
test_file ".claude-mpm/config/agent-templates.json" "agent-templates.json exists"
test_file ".claude-mpm/config/workflows.json" "workflows.json exists"
echo ""

echo "2. Testing JSON Validity"
echo "------------------------"
test_json ".claude-mpm/config/project.json" "project.json"
test_json ".claude-mpm/config/agents.json" "agents.json"
test_json ".claude-mpm/config/agent-templates.json" "agent-templates.json"
test_json ".claude-mpm/config/workflows.json" "workflows.json"
echo ""

echo "3. Testing Memory Files"
echo "-----------------------"
test_file ".claude-mpm/memories/engineer_memories.md" "Engineer memory exists"
test_file ".claude-mpm/memories/qa_memories.md" "QA memory exists"
test_file ".claude-mpm/memories/ops_memories.md" "Ops memory exists"
test_file ".claude-mpm/memories/research_memories.md" "Research memory exists"
test_file ".claude-mpm/memories/version-control_memories.md" "Version Control memory exists"
test_file ".claude-mpm/memories/PM.md" "PM memory exists"
echo ""

echo "4. Testing Memory Size Limits"
echo "-----------------------------"
test_size ".claude-mpm/memories/engineer_memories.md" "Engineer memory"
test_size ".claude-mpm/memories/qa_memories.md" "QA memory"
test_size ".claude-mpm/memories/ops_memories.md" "Ops memory"
test_size ".claude-mpm/memories/research_memories.md" "Research memory"
test_size ".claude-mpm/memories/version-control_memories.md" "Version Control memory"
test_size ".claude-mpm/memories/PM.md" "PM memory"
echo ""

echo "5. Testing Project Integration"
echo "------------------------------"
# Check for TrackDown directory
if [ -d "trackdown" ]; then
    echo -e "${GREEN}✓${NC} TrackDown directory exists"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} TrackDown directory not found"
fi

# Check for key project files
test_file "package.json" "package.json exists"
test_file "tsconfig.json" "tsconfig.json exists"
test_file "CLAUDE.md" "CLAUDE.md exists"
echo ""

echo "6. Testing Key Project Paths"
echo "----------------------------"
if [ -d "src" ]; then
    echo -e "${GREEN}✓${NC} Source directory exists"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Source directory missing"
    ((TESTS_FAILED++))
fi

if [ -d "docs" ]; then
    echo -e "${GREEN}✓${NC} Docs directory exists"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Docs directory missing"
    ((TESTS_FAILED++))
fi

if [ -d "data/json" ]; then
    echo -e "${GREEN}✓${NC} Data directory exists"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Data directory missing"
    ((TESTS_FAILED++))
fi
echo ""

echo "========================================="
echo "Test Results"
echo "========================================="
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Failed:${NC} $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed! Configuration is valid.${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed. Please review the configuration.${NC}"
    exit 1
fi