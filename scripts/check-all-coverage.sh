#!/bin/bash

echo "📊 JSDoc Coverage Summary for All Packages"
echo "=========================================="
echo ""

PACKAGES="acl aggregates cli contracts cqrs di domain-primitives domain-services enterprise events logging messaging nestjs policies projections repositories resilience testing utils validation value-objects"

for pkg in $PACKAGES; do
  if [ -d "packages/$pkg/dist" ]; then
    printf "%-20s: " "$pkg"
    node scripts/verify-jsdoc-coverage.js packages/$pkg/dist --yaml docs/examples/domain/$pkg 2>&1 | grep "Overall Coverage:" | sed 's/.*Overall Coverage: //' || echo "No data"
  fi
done