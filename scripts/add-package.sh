#!/bin/bash

# VytchesDDD - Add New Package Script
# Usage: ./scripts/add-package.sh <package-name> <description> [dependencies...]
# Example: ./scripts/add-package.sh "security" "Security utilities for DDD" "core,utils"

set -e

if [ $# -lt 2 ]; then
    echo "Usage: $0 <package-name> <description> [dependencies...]"
    echo "Example: $0 security 'Security utilities for DDD' 'core,utils'"
    exit 1
fi

PACKAGE_NAME="$1"
DESCRIPTION="$2"
DEPENDENCIES="${3:-}"

PACKAGE_FULL_NAME="@vytches-ddd/$PACKAGE_NAME"
PACKAGE_PATH="packages/$PACKAGE_NAME"

echo "🚀 Adding new package: $PACKAGE_FULL_NAME"

# 1. Generate Nx package
echo "📦 Generating Nx package..."
npx nx g @nx/js:lib "$PACKAGE_NAME" \
  --directory="$PACKAGE_PATH" \
  --bundler=vite \
  --unitTestRunner=vitest \
  --publishable \
  --importPath="$PACKAGE_FULL_NAME"

# 2. Update tsconfig.base.json
echo "⚙️ Updating tsconfig.base.json..."
if command -v jq >/dev/null 2>&1; then
  # Using jq if available
  jq --arg key "$PACKAGE_FULL_NAME" --arg value "$PACKAGE_PATH/src/index.ts" \
    '.compilerOptions.paths[$key] = [$value]' tsconfig.base.json > tmp.json && mv tmp.json tsconfig.base.json
else
  # Manual sed approach
  echo "⚠️  Please manually add to tsconfig.base.json:"
  echo "    \"$PACKAGE_FULL_NAME\": [\"$PACKAGE_PATH/src/index.ts\"]"
fi

# 3. Update vitest.config.ts
echo "🧪 Updating vitest.config.ts..."
ALIAS_LINE="      '$PACKAGE_FULL_NAME': new URL('./$PACKAGE_PATH/src/index.ts', import.meta.url).pathname,"
sed -i "/alias: {/a\\
$ALIAS_LINE" vitest.config.ts

# 4. Update commitlint.config.js
echo "📝 Updating commitlint.config.js..."
sed -i "/],$/i\\
        '$PACKAGE_NAME'," commitlint.config.js

# 5. Update README.md
echo "📚 Updating README.md..."
README_LINE="| [$PACKAGE_FULL_NAME](./packages/$PACKAGE_NAME) | ![npm](https://img.shields.io/npm/v/$PACKAGE_FULL_NAME) | $DESCRIPTION |"
sed -i "/| \[@vytches-ddd\/cli\]/i\\
$README_LINE" README.md

# 6. Update package dependencies if specified
if [ -n "$DEPENDENCIES" ]; then
  echo "🔗 Adding dependencies: $DEPENDENCIES"

  PACKAGE_JSON="$PACKAGE_PATH/package.json"

  # Parse dependencies
  IFS=',' read -ra DEPS <<< "$DEPENDENCIES"
  for dep in "${DEPS[@]}"; do
    dep=$(echo "$dep" | xargs) # trim whitespace
    DEP_FULL="@vytches-ddd/$dep"

    echo "  Adding dependency: $DEP_FULL"

    if command -v jq >/dev/null 2>&1; then
      jq --arg dep "$DEP_FULL" '.dependencies[$dep] = "workspace:*"' "$PACKAGE_JSON" > tmp.json && mv tmp.json "$PACKAGE_JSON"
    else
      echo "⚠️  Please manually add to $PACKAGE_JSON dependencies:"
      echo "    \"$DEP_FULL\": \"workspace:*\""
    fi
  done
fi

# 7. Update ESLint constraints
echo "🔍 Updating ESLint constraints..."
echo "⚠️  Please manually update .eslintrc.json with dependency constraints for scope:$PACKAGE_NAME"

# 8. Create basic index.ts
echo "📄 Creating basic index.ts..."
cat > "$PACKAGE_PATH/src/index.ts" << EOF
// $DESCRIPTION

// Export your main components here
export * from './lib/$PACKAGE_NAME';

// Example export (remove when you add real code)
export const ${PACKAGE_NAME}Version = '0.1.0';
EOF

# 9. Update enterprise bundle if this is a core package
if [[ "$PACKAGE_NAME" != "testing" && "$PACKAGE_NAME" != "cli" && "$PACKAGE_NAME" ]]; then
  echo "🏢 Adding to enterprise bundle..."
  ENTERPRISE_PACKAGE="packages/enterprise/package.json"

  if command -v jq >/dev/null 2>&1; then
    jq --arg dep "$PACKAGE_FULL_NAME" '.dependencies[$dep] = "workspace:*"' "$ENTERPRISE_PACKAGE" > tmp.json && mv tmp.json "$ENTERPRISE_PACKAGE"
  else
    echo "⚠️  Please manually add to packages/enterprise/package.json:"
    echo "    \"$PACKAGE_FULL_NAME\": \"workspace:*\""
  fi

  # Update enterprise index.ts
  echo "export * from '$PACKAGE_FULL_NAME';" >> "packages/enterprise/src/index.ts"
fi

echo ""
echo "✅ Package $PACKAGE_FULL_NAME added successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Review and adjust dependency constraints in .eslintrc.json"
echo "2. Add your implementation to $PACKAGE_PATH/src/"
echo "3. Update $PACKAGE_PATH/README.md with package-specific documentation"
echo "4. Run 'pnpm install' to update dependencies"
echo "5. Run 'pnpm build' to verify everything works"
echo ""
echo "🎯 Manual updates needed:"
echo "- ESLint dependency constraints in .eslintrc.json"
if ! command -v jq >/dev/null 2>&1; then
  echo "- tsconfig.base.json paths (jq not found)"
  echo "- Package dependencies (jq not found)"
  echo "- Enterprise bundle dependencies (jq not found)"
fi
