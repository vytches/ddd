#!/bin/bash
# publish-packages.sh - Publishes all packages using pnpm publish
# pnpm publish automatically converts workspace:* to actual versions
#
# Usage:
#   pnpm publish:packages              # Publish all built packages
#   DRY_RUN=true pnpm publish:packages # Dry run (show what would be published)

set -euo pipefail

REGISTRY="${REGISTRY:-https://npm.pkg.github.com}"
DRY_RUN="${DRY_RUN:-false}"
PUBLISHED=0
SKIPPED=0
FAILED=0

echo "📦 Publishing packages to $REGISTRY"
echo "   Using pnpm publish (converts workspace:* to versions automatically)"
echo ""

for pkg in packages/*/; do
  if [ ! -f "$pkg/package.json" ]; then
    continue
  fi

  # Skip packages without dist (not built)
  if [ ! -d "$pkg/dist" ]; then
    echo "⏭️  Skipping $(basename "$pkg") (no dist/ directory - run pnpm build first)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Skip private packages
  is_private=$(node -e "const p = require('./$pkg/package.json'); console.log(p.private || false)")
  if [ "$is_private" = "true" ]; then
    echo "⏭️  Skipping $(basename "$pkg") (private package)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  name=$(node -e "const p = require('./$pkg/package.json'); console.log(p.name)")
  version=$(node -e "const p = require('./$pkg/package.json'); console.log(p.version)")

  if [ "$DRY_RUN" = "true" ]; then
    echo "🔍 Would publish: $name@$version"
    PUBLISHED=$((PUBLISHED + 1))
  else
    echo "📦 Publishing $name@$version..."
    if (cd "$pkg" && pnpm publish --registry="$REGISTRY" --no-git-checks 2>&1); then
      echo "   ✅ $name@$version published"
      PUBLISHED=$((PUBLISHED + 1))
    else
      echo "   ⚠️  $name@$version skipped (already exists or error)"
      SKIPPED=$((SKIPPED + 1))
    fi
  fi
done

echo ""
echo "📊 Results: $PUBLISHED published, $SKIPPED skipped, $FAILED failed"

if [ "$DRY_RUN" = "true" ]; then
  echo "ℹ️  This was a dry run. Remove DRY_RUN=true to actually publish."
fi
