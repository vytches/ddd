#!/bin/bash
# scripts/fix-output-structure.sh

echo "🔧 Fixing output structure - separating TS from JS..."

# 1. Clean existing JS files from src directories
echo "🧹 Cleaning JS files from src directories..."
find packages -path "*/src/**/*.js" -delete 2>/dev/null || true
find packages -path "*/src/**/*.js.map" -delete 2>/dev/null || true
find packages -path "*/src/**/*.d.ts.map" -delete 2>/dev/null || true
find packages -path "*/src/**/*.d.ts" -delete 2>/dev/null || true
find examples -path "*/src/**/*.js" -delete 2>/dev/null || true
find examples -path "*/src/**/*.js.map" -delete 2>/dev/null || true
find examples -path "*/src/**/*.d.ts.map" -delete 2>/dev/null || true
find examples -path "*/src/**/*.d.ts" -delete 2>/dev/null || true

# 2. Update all package tsconfig.json files
echo "⚙️ Updating tsconfig.json files..."
for pkg in packages/*/; do
  if [ -f "$pkg/tsconfig.json" ]; then
    cat > "$pkg/tsconfig.json" << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.spec.ts",
    "**/*.test.ts"
  ]
}
EOF
  fi
done

# 3. Update all package vite.config.ts files
echo "⚡ Updating vite.config.ts files..."
for pkg in packages/*/; do
  if [ -f "$pkg/vite.config.ts" ]; then
    cat > "$pkg/vite.config.ts" << 'EOF'
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      outDir: 'dist',
      entryRoot: 'src',
    }),
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VytchesDDD',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : format}`,
    },
    rollupOptions: {
      external: (id) => {
        return id.startsWith('@vytches-ddd/') && !id.includes('src/');
      },
    },
    sourcemap: true,
    target: 'ES2020',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
  },
});
EOF
  fi
done

# 4. Update .gitignore
echo "📝 Updating .gitignore..."
if ! grep -q "packages/\*/src/\*\*/\*.js" .gitignore; then
  cat >> .gitignore << 'EOF'

# JS files in source directories (should not be committed)
packages/*/src/**/*.js
packages/*/src/**/*.js.map
packages/*/src/**/*.ts.map
packages/*/src/**/*.d.ts
examples/*/src/**/*.js
examples/*/src/**/*.js.map
examples/*/src/**/*.ts.map
examples/*/src/**/*.d.ts
EOF
fi

# 5. Update VS Code settings
echo "💻 Updating VS Code settings..."
mkdir -p .vscode
cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": false,
    "packages/*/src/**/*.js": true,
    "packages/*/src/**/*.js.map": true,
    "packages/*/src/**/*.ts.map": true,
    "packages/*/src/**/*.d.ts": true,
    "examples/*/src/**/*.js": true,
    "examples/*/src/**/*.js.map": true,
    "examples/*/src/**/*.ts.map": true,
    "examples/*/src/**/*.d.ts": true,
    "**/.nx": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "packages/*/src/**/*.js": true,
    "packages/*/src/**/*.js.map": true,
    "packages/*/src/**/*.ts.map": true,
    "**/.nx": true
  }
}
EOF

# 6. Update package.json files to only include dist
echo "📦 Updating package.json files..."
for pkg in packages/*/; do
  if [ -f "$pkg/package.json" ]; then
    # Use basic sed to update files field (works without jq)
    sed -i 's/"files": \[.*\]/"files": ["dist", "README.md"]/' "$pkg/package.json" 2>/dev/null || true
  fi
done

# 7. Create clean script
echo "🧹 Creating clean-outputs.sh script..."
cat > scripts/clean-outputs.sh << 'EOF'
#!/bin/bash

echo "🧹 Cleaning all build outputs..."

# Remove all dist folders
find packages -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
find examples -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true

# Remove JS files from src directories
find packages -path "*/src/**/*.js" -delete 2>/dev/null || true
find packages -path "*/src/**/*.js.map" -delete 2>/dev/null || true
find packages -path "*/src/**/*.ts.map" -delete 2>/dev/null || true
find packages -path "*/src/**/*.d.ts" -delete 2>/dev/null || true

find examples -path "*/src/**/*.js" -delete 2>/dev/null || true
find examples -path "*/src/**/*.js.map" -delete 2>/dev/null || true
find examples -path "*/src/**/*.ts.map" -delete 2>/dev/null || true
find examples -path "*/src/**/*.d.ts" -delete 2>/dev/null || true

# Remove TypeScript build info
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

echo "✅ Cleanup complete!"
EOF

chmod +x scripts/clean-outputs.sh

echo ""
echo "✅ Output structure fixed!"
echo ""
echo "📋 What was done:"
echo "  🧹 Cleaned JS files from src directories"
echo "  ⚙️ Updated tsconfig.json to output to dist/"
echo "  ⚡ Updated vite.config.ts to use dist/ as outDir"
echo "  📝 Updated .gitignore to ignore JS in src/"
echo "  💻 Updated VS Code settings to hide JS in src/"
echo "  📦 Updated package.json files to only include dist/"
echo "  🧹 Created clean-outputs.sh script"
echo ""
echo "🚀 Next steps:"
echo "  1. Run: pnpm build"
echo "  2. Check that JS files only appear in dist/ folders"
echo "  3. Use: bash scripts/clean-outputs.sh to clean everything"
echo ""
echo "💡 Now your folder structure will be clean:"
echo "   📁 packages/core/src/     ← Only TypeScript files"
echo "   📁 packages/core/dist/    ← Only built JS/d.ts files"
