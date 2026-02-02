#!/bin/bash

# Comprehensive JSDoc coverage verification for all packages
# Shows detailed coverage statistics and missing items

set -e

echo "=================================================================================="
echo "📊 COMPREHENSIVE JSDOC COVERAGE REPORT FOR ALL PACKAGES"
echo "=================================================================================="
echo ""

# List of all packages
PACKAGES="acl aggregates cli contracts cqrs di domain-primitives domain-services enterprise events logging messaging nestjs policies projections repositories resilience testing utils validation value-objects"

# Variables for totals
TOTAL_COVERED=0
TOTAL_ITEMS=0
PACKAGE_RESULTS=""

# Function to extract coverage numbers
extract_coverage() {
  echo "$1" | grep -oE "([0-9]+)/([0-9]+)" | head -1
}

# Process each package
for pkg in $PACKAGES; do
  if [ -d "packages/$pkg/dist" ]; then
    echo "Analyzing $pkg..."
    
    # Run coverage check and capture output
    OUTPUT=$(node scripts/verify-jsdoc-coverage.js packages/$pkg/dist --yaml docs/examples/domain/$pkg 2>&1 || true)
    
    # Extract overall coverage line
    COVERAGE_LINE=$(echo "$OUTPUT" | grep "Overall Coverage:" | head -1)
    
    if [ -n "$COVERAGE_LINE" ]; then
      # Extract numbers
      COVERAGE=$(extract_coverage "$COVERAGE_LINE")
      COVERED=$(echo "$COVERAGE" | cut -d'/' -f1)
      TOTAL=$(echo "$COVERAGE" | cut -d'/' -f2)
      
      if [ -n "$COVERED" ] && [ -n "$TOTAL" ]; then
        PERCENTAGE=$(awk "BEGIN {printf \"%.1f\", ($COVERED/$TOTAL)*100}")
        
        # Add to totals
        TOTAL_COVERED=$((TOTAL_COVERED + COVERED))
        TOTAL_ITEMS=$((TOTAL_ITEMS + TOTAL))
        
        # Store result
        PACKAGE_RESULTS="${PACKAGE_RESULTS}$(printf "%-20s %4d/%-4d (%5.1f%%)\n" "$pkg:" "$COVERED" "$TOTAL" "$PERCENTAGE")"
        
        # Extract missing items for packages with low coverage
        if (( $(echo "$PERCENTAGE < 80" | bc -l) )); then
          echo "  ⚠️ Low coverage in $pkg - extracting missing items..."
          MISSING_COUNT=$(echo "$OUTPUT" | grep -c "❌" || true)
          echo "  Missing JSDoc items: $MISSING_COUNT"
        fi
      fi
    else
      PACKAGE_RESULTS="${PACKAGE_RESULTS}$(printf "%-20s No data available\n" "$pkg:")"
    fi
  else
    PACKAGE_RESULTS="${PACKAGE_RESULTS}$(printf "%-20s No dist folder\n" "$pkg:")"
  fi
done

echo ""
echo "=================================================================================="
echo "📦 PACKAGE-BY-PACKAGE COVERAGE"
echo "=================================================================================="
echo "$PACKAGE_RESULTS" | sort -t: -k2 -rn

echo ""
echo "=================================================================================="
echo "📊 OVERALL PROJECT STATISTICS"
echo "=================================================================================="

if [ $TOTAL_ITEMS -gt 0 ]; then
  OVERALL_PERCENTAGE=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_COVERED/$TOTAL_ITEMS)*100}")
  echo "Total JSDoc Items:    $TOTAL_ITEMS"
  echo "Items with JSDoc:     $TOTAL_COVERED"
  echo "Items missing JSDoc:  $((TOTAL_ITEMS - TOTAL_COVERED))"
  echo ""
  echo "🎯 OVERALL COVERAGE:  ${OVERALL_PERCENTAGE}%"
  
  # Coverage assessment
  echo ""
  if (( $(echo "$OVERALL_PERCENTAGE >= 90" | bc -l) )); then
    echo "✅ EXCELLENT - Coverage is above 90%!"
  elif (( $(echo "$OVERALL_PERCENTAGE >= 80" | bc -l) )); then
    echo "🟡 GOOD - Coverage is above 80%"
  elif (( $(echo "$OVERALL_PERCENTAGE >= 70" | bc -l) )); then
    echo "⚠️ NEEDS IMPROVEMENT - Coverage is below 80%"
  else
    echo "❌ CRITICAL - Coverage is below 70%"
  fi
else
  echo "❌ No coverage data available"
fi

echo ""
echo "=================================================================================="