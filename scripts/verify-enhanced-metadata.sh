#!/bin/bash

# Enhanced Metadata System V2 - Quality Verification Script
# Use this script to verify the Enhanced Metadata System is working correctly
# Author: Enhanced Metadata System
# Version: 2.0.0

set -e

echo "🔍 Enhanced Metadata System V2 - Quality Verification"
echo "===================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Function to run check and count results
run_check() {
    local description="$1"
    local command="$2"
    local expected="$3"
    local check_type="${4:-critical}" # critical, warning, info
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    echo -n "🔍 Checking: $description... "
    
    result=$(eval "$command" 2>/dev/null || echo "0")
    
    if [ "$expected" = "0" ]; then
        if [ "$result" -eq 0 ]; then
            echo -e "${GREEN}✅ PASS${NC} (found: $result)"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            return 0
        else
            if [ "$check_type" = "warning" ]; then
                echo -e "${YELLOW}⚠️  WARNING${NC} (found: $result, expected: $expected)"
                WARNING_CHECKS=$((WARNING_CHECKS + 1))
                return 1
            else
                echo -e "${RED}❌ FAIL${NC} (found: $result, expected: $expected)"
                FAILED_CHECKS=$((FAILED_CHECKS + 1))
                return 1
            fi
        fi
    else
        # For positive expectations (greater than)
        if [ "$result" -gt "$expected" ]; then
            echo -e "${GREEN}✅ PASS${NC} (found: $result, expected: >$expected)"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            return 0
        else
            echo -e "${RED}❌ FAIL${NC} (found: $result, expected: >$expected)"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        fi
    fi
}

# Build the package first
echo "🔨 Building aggregates package..."
if ! (cd packages/aggregates && pnpm build > /dev/null 2>&1); then
    echo -e "${RED}❌ Build failed! Cannot proceed with verification.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build completed${NC}"
echo ""

# Core Quality Checks for V2 (Focus on .d.ts files)
echo "🎯 Running Core Quality Checks..."
echo "--------------------------------"

# Check 1: Unprocessed directives in .d.ts files (CRITICAL)
run_check "No unprocessed @*-inject directives in .d.ts files" \
    "find packages/aggregates/dist -name '*.d.ts' -exec grep -l '@.*-inject' {} + 2>/dev/null | wc -l" \
    "0" \
    "critical"

# Check 2: Metadata injection in .d.ts files
run_check "Adequate metadata injection in .d.ts files (>50 tags)" \
    "find packages/aggregates/dist -name '*.d.ts' -exec cat {} + | grep -c '@business\|@description\|@example' 2>/dev/null || echo 0" \
    "50" \
    "critical"

# Check 3: Specific file verification - aggregate-root.d.ts
run_check "aggregate-root.d.ts has proper metadata" \
    "grep -c '@description.*aggregate root functionality\|@business-context.*DDD aggregate pattern' packages/aggregates/dist/core/aggregate-root.d.ts 2>/dev/null || echo 0" \
    "1" \
    "critical"

# Check 4: JS files should NOT be processed (by design)
run_check "JS files contain unprocessed directives (expected)" \
    "grep -c '@.*-inject' packages/aggregates/dist/index.js 2>/dev/null || echo 0" \
    "1" \
    "info"

echo ""

# Detailed Analysis
echo "📊 Detailed Analysis..."
echo "----------------------"

# Show unprocessed directives in .d.ts files if any
unprocessed_dts_files=$(find packages/aggregates/dist -name '*.d.ts' -exec grep -l '@.*-inject' {} + 2>/dev/null || echo "")
if [ -n "$unprocessed_dts_files" ]; then
    echo -e "${RED}❌ Found unprocessed directives in .d.ts files:${NC}"
    for file in $unprocessed_dts_files; do
        echo "  - $file"
        grep -n '@.*-inject' "$file" | head -3
    done
    echo ""
fi

# Show metadata statistics for .d.ts files
metadata_count=$(find packages/aggregates/dist -name '*.d.ts' -exec cat {} + | grep -c '@business\|@description\|@example' 2>/dev/null || echo "0")
business_count=$(find packages/aggregates/dist -name '*.d.ts' -exec cat {} + | grep -c '@business' 2>/dev/null || echo "0")
description_count=$(find packages/aggregates/dist -name '*.d.ts' -exec cat {} + | grep -c '@description' 2>/dev/null || echo "0")
example_count=$(find packages/aggregates/dist -name '*.d.ts' -exec cat {} + | grep -c '@example' 2>/dev/null || echo "0")
dts_file_count=$(find packages/aggregates/dist -name '*.d.ts' | wc -l)

echo "📈 Metadata Statistics (.d.ts files):"
echo "  Total .d.ts files: $dts_file_count"
echo "  Total metadata tags: $metadata_count"
echo "  @business tags: $business_count"
echo "  @description tags: $description_count" 
echo "  @example tags: $example_count"
echo ""

# Show sample of injected metadata
echo "📝 Sample of injected metadata:"
if [ -f "packages/aggregates/dist/core/aggregate-root.d.ts" ]; then
    echo "From aggregate-root.d.ts:"
    grep -A1 -B1 '@description\|@business-context' packages/aggregates/dist/core/aggregate-root.d.ts | head -10 || echo "  No metadata found"
fi
echo ""

# Summary
echo "📋 Verification Summary"
echo "======================"
echo -e "Total checks: ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo -e "Warnings: ${YELLOW}$WARNING_CHECKS${NC}"
echo ""

# Determine overall status
if [ "$FAILED_CHECKS" -eq 0 ] && [ "$WARNING_CHECKS" -eq 0 ]; then
    echo -e "${GREEN}🎉 EXCELLENT: Enhanced Metadata System V2 is working correctly!${NC}"
    echo ""
    echo "✨ System Features:"
    echo "  - Hierarchical metadata resolution (Global → Package → Class → Method)"
    echo "  - Post-compilation .d.ts processing for TypeScript declarations"
    echo "  - Multi-level caching for performance"
    echo "  - Format-specific overrides (JSDoc vs CLI)"
    exit 0
elif [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  GOOD: System working but has warnings that should be addressed${NC}"
    exit 0
else
    echo -e "${RED}❌ CRITICAL: Enhanced Metadata System V2 has issues requiring attention${NC}"
    echo ""
    echo "🔧 Debug Steps:"
    echo "1. Review the Failed checks above"
    echo "2. Enable debug mode: JSDOC_DEBUG=true pnpm build"
    echo "3. Check post-compilation logs: grep '\\[post-compilation-dts\\]' build output"
    echo "4. Verify metadata files exist in docs/examples/domain/"
    echo "5. Run this script again after fixes"
    exit 1
fi