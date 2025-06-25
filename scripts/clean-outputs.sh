#!/bin/bash

echo "🧹 Cleaning all build outputs..."

# Remove all dist folders
find packages -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
find examples -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true

# Remove JS files from src directories
find packages -path "*/src/**/*.js" -delete 2>/dev/null || true
find packages -path "*/src/**/*.js.map" -delete 2>/dev/null || true
find packages -path "*/src/**/*.ts.map" -delete 2>/dev/null || true
find packages -path "*/src/**/*.ts" -delete 2>/dev/null || true

find examples -path "*/src/**/*.js" -delete 2>/dev/null || true
find examples -path "*/src/**/*.js.map" -delete 2>/dev/null || true
find examples -path "*/src/**/*.ts.map" -delete 2>/dev/null || true
find examples -path "*/src/**/*.d.ts" -delete 2>/dev/null || true

# Remove TypeScript build info
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

echo "✅ Cleanup complete!"
