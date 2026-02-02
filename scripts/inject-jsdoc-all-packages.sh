#!/bin/bash

# Inject JSDoc for all packages
# This script is used by CI and can be run locally

set -e

echo "📝 Injecting JSDoc metadata for all packages..."
echo "================================================"

# List of all packages
PACKAGES="acl aggregates cli contracts core cqrs di domain-primitives domain-services event-scheduling event-store events logging messaging nestjs policies process-managers projections repositories resilience testing utils validation value-objects"

# Counter for success/failure
SUCCESS_COUNT=0
FAILURE_COUNT=0
FAILED_PACKAGES=""

# Inject JSDoc for each package
for pkg in $PACKAGES; do
  if [ -d "packages/$pkg" ]; then
    echo -n "Processing $pkg... "
    if node scripts/inject-yaml-jsdoc-ast.js --package=$pkg > /dev/null 2>&1; then
      echo "✅"
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
      echo "❌"
      FAILURE_COUNT=$((FAILURE_COUNT + 1))
      FAILED_PACKAGES="$FAILED_PACKAGES $pkg"
    fi
  else
    echo "⚠️ Package $pkg not found"
  fi
done

echo ""
echo "================================================"
echo "📊 Results:"
echo "   ✅ Success: $SUCCESS_COUNT packages"
echo "   ❌ Failed: $FAILURE_COUNT packages"

if [ $FAILURE_COUNT -gt 0 ]; then
  echo ""
  echo "❌ Failed packages:$FAILED_PACKAGES"
  exit 1
fi

echo ""
echo "✅ JSDoc injection completed successfully for all packages!"