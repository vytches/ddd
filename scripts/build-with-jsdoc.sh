#!/bin/bash
# Build package with enhanced JSDoc from YAML metadata

PACKAGE=$1

if [ -z "$PACKAGE" ]; then
  echo "Usage: $0 <package-name>"
  echo "Example: $0 nestjs"
  exit 1
fi

echo "🔨 Building package @vytches/ddd-$PACKAGE with enhanced JSDoc..."

# Step 1: Build the package
echo "📦 Step 1: Building package..."
pnpm build --filter=@vytches/ddd-$PACKAGE

# Step 2: Remove all existing JSDoc from .d.ts files
echo "🧹 Step 2: Removing existing JSDoc from .d.ts files..."
find packages/$PACKAGE/dist -name "*.d.ts" -type f -exec perl -i -0pe 's/\/\*\*.*?\*\///gs' {} \;

# Step 3: Inject YAML-based JSDoc
echo "💉 Step 3: Injecting enhanced JSDoc from YAML metadata..."
node scripts/inject-yaml-jsdoc-ast.js --package=$PACKAGE

# Step 4: Verify results
echo "✅ Step 4: Verifying JSDoc coverage..."
TOTAL_FILES=$(find packages/$PACKAGE/dist -name "*.d.ts" | wc -l)
FILES_WITH_JSDOC=$(find packages/$PACKAGE/dist -name "*.d.ts" -exec grep -l "/\*\*" {} \; | wc -l)

echo "📊 Results:"
echo "  Total .d.ts files: $TOTAL_FILES"
echo "  Files with JSDoc: $FILES_WITH_JSDOC"

if [ "$TOTAL_FILES" -eq "$FILES_WITH_JSDOC" ]; then
  echo "✅ SUCCESS: All files have JSDoc documentation!"
else
  echo "⚠️  WARNING: Some files may be missing JSDoc"
  echo "  Run with JSDOC_DEBUG=true for more details"
fi

echo "🎉 Build complete for @vytches/ddd-$PACKAGE"