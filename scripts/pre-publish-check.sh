#!/bin/bash

# Pre-publish verification script
# Ensures everything is ready for npm publish

echo "🚀 Pre-Publish Verification"
echo "=========================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if we have any errors
HAS_ERRORS=0

# 1. Check if we're on main branch
echo -e "\n📌 Checking branch..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠️  Warning: Not on main branch (current: $CURRENT_BRANCH)${NC}"
fi

# 2. Check for uncommitted changes
echo -e "\n📌 Checking for uncommitted changes..."
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ Error: You have uncommitted changes${NC}"
    HAS_ERRORS=1
else
    echo -e "${GREEN}✅ Working directory clean${NC}"
fi

# 3. Run build
echo -e "\n📌 Building all packages..."
if pnpm build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    HAS_ERRORS=1
fi

# 4. Run export verification
echo -e "\n📌 Verifying exports..."
if pnpm verify:exports > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Export verification passed${NC}"
else
    echo -e "${RED}❌ Export verification failed${NC}"
    HAS_ERRORS=1
fi

# 5. Check package versions
echo -e "\n📌 Checking package versions..."
ENTERPRISE_VERSION=$(node -p "require('./packages/enterprise/package.json').version")
echo "Enterprise version: $ENTERPRISE_VERSION"

# 6. Run tests
echo -e "\n📌 Running tests..."
if pnpm test > /dev/null 2>&1; then
    echo -e "${GREEN}✅ All tests passed${NC}"
else
    echo -e "${RED}❌ Some tests failed${NC}"
    HAS_ERRORS=1
fi

# 7. Check dist for absolute paths (publish safety)
echo -e "\n📌 Checking dist files for absolute paths..."
ABS_PATHS=$(grep -r "/home/runner\|/opt/projects\|/Users/" packages/*/dist/*.cjs packages/*/dist/*.js 2>/dev/null | grep -v "node_modules" || true)
if [ -n "$ABS_PATHS" ]; then
    echo -e "${RED}❌ Absolute paths found in dist — will break consumers after npm publish:${NC}"
    echo "$ABS_PATHS"
    HAS_ERRORS=1
else
    echo -e "${GREEN}✅ No absolute paths in dist files${NC}"
fi

# 8. Check type definitions
echo -e "\n📌 Checking TypeScript types..."
if pnpm type-check > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Type checking passed${NC}"
else
    echo -e "${RED}❌ Type checking failed${NC}"
    HAS_ERRORS=1
fi

# 8. Lint check
echo -e "\n📌 Running linter..."
if pnpm lint > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Linting passed${NC}"
else
    echo -e "${RED}❌ Linting failed${NC}"
    HAS_ERRORS=1
fi

# Summary
echo -e "\n=========================="
if [ $HAS_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo -e "\nReady to publish! Next steps:"
    echo "1. Review changes with: pnpm release:preview"
    echo "2. Publish with: pnpm release"
else
    echo -e "${RED}❌ CHECKS FAILED!${NC}"
    echo -e "\nPlease fix the issues above before publishing."
    exit 1
fi