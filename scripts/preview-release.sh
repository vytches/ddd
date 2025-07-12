#!/bin/bash

echo "🔍 RELEASE PREVIEW"
echo "=================="

echo ""
echo "📦 Changed packages since last release:"
NX_DAEMON=false pnpm lerna changed 2>/dev/null || echo "No packages changed or no previous releases"

echo ""
echo "🏷️  Suggested versions (dry run):"
echo "Running version analysis..."
NX_DAEMON=false pnpm lerna version --conventional-commits --dry-run --no-git-tag-version 2>/dev/null || echo "Cannot determine versions yet"

echo ""
echo "📝 Recent commits that will affect versioning:"
git log --oneline -10 --grep="feat\|fix\|BREAKING\|chore" --format="%h %s" || echo "No relevant commits found"

echo ""
echo "🎯 Commit analysis:"
echo "   feat: commits → MINOR version bump"
echo "   fix: commits → PATCH version bump"  
echo "   BREAKING CHANGE → MAJOR version bump"
echo "   chore/docs → NO version bump"

echo ""
echo "📊 Detailed commit breakdown:"
feat_count=$(git log --oneline --grep="feat" --since="$(git describe --tags --abbrev=0 2>/dev/null || echo '1 week ago')" | wc -l)
fix_count=$(git log --oneline --grep="fix" --since="$(git describe --tags --abbrev=0 2>/dev/null || echo '1 week ago')" | wc -l)
breaking_count=$(git log --oneline --grep="BREAKING" --since="$(git describe --tags --abbrev=0 2>/dev/null || echo '1 week ago')" | wc -l)

echo "   Features: $feat_count"
echo "   Fixes: $fix_count"
echo "   Breaking: $breaking_count"

echo ""
echo "💡 Recommended release commands:"
if [[ $breaking_count -gt 0 ]]; then
    echo "   pnpm release:major     # Contains breaking changes"
    echo "   git checkout -b release/next-major"
elif [[ $feat_count -gt 0 ]]; then
    echo "   pnpm release:minor     # Contains new features"
    echo "   git checkout -b release/next-minor"
elif [[ $fix_count -gt 0 ]]; then
    echo "   pnpm release:patch     # Contains fixes only"
    echo "   git checkout -b release/next-patch"
else
    echo "   No significant changes detected"
    echo "   Use: pnpm release:version for automatic detection"
fi

echo ""
echo "⚡ Quick commands:"
echo "   pnpm release:changed   # See changed packages"
echo "   pnpm release:diff      # See detailed changes"
echo "   pnpm release:dry       # Preview without committing"

echo ""
echo "🚀 Ready to release? Run:"
echo "   git checkout -b release/next"
echo "   pnpm release:version"