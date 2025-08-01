#!/bin/bash

# Simple Enhanced Metadata System V2 Check
# Quick verification focused on .d.ts files

echo "Enhanced Metadata System V2 - Status Check"
echo "=========================================="

cd packages/aggregates
echo "Building aggregates package..."
pnpm build > /dev/null 2>&1

echo ""
echo "Results for .d.ts files:"
echo "------------------------"

# Check unprocessed directives in .d.ts files
unprocessed_dts=$(find dist -name '*.d.ts' -exec grep -l '@.*-inject' {} + 2>/dev/null | wc -l)
echo "Files with unprocessed directives: $unprocessed_dts (should be 0)"
if [ "$unprocessed_dts" -gt 0 ]; then
    echo "Files with unprocessed @*-inject:"
    find dist -name '*.d.ts' -exec grep -l '@.*-inject' {} + 2>/dev/null | head -3
fi

# Count .d.ts files
dts_count=$(find dist -name '*.d.ts' | wc -l)
echo "Total .d.ts files: $dts_count"

# Check metadata in .d.ts files
metadata=$(find dist -name '*.d.ts' -exec cat {} + | grep -c '@business\|@description\|@example' 2>/dev/null || echo "0")
business=$(find dist -name '*.d.ts' -exec cat {} + | grep -c '@business' 2>/dev/null || echo "0")
description=$(find dist -name '*.d.ts' -exec cat {} + | grep -c '@description' 2>/dev/null || echo "0")
example=$(find dist -name '*.d.ts' -exec cat {} + | grep -c '@example' 2>/dev/null || echo "0")

echo ""
echo "Metadata Statistics (.d.ts files):"
echo "Total tags: $metadata (target: >50)"
echo "@business: $business"
echo "@description: $description" 
echo "@example: $example"

echo ""
echo "Note: JS files are NOT processed (by design)"
js_inject=$(grep -c '@.*-inject' dist/index.js 2>/dev/null || echo "0")
echo "JS files with @*-inject: $js_inject (expected to be >0)"

echo ""
echo "Summary:"
if [ "$unprocessed_dts" -eq 0 ] && [ "$metadata" -gt 50 ]; then
    echo "✅ PASS: System V2 working correctly - .d.ts files processed"
else
    echo "❌ FAIL: System V2 has issues - check .d.ts processing"
fi