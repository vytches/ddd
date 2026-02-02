#!/usr/bin/env node

/**
 * Enterprise Distribution Build Script
 * Creates distribution-ready packages with proper imports
 */

const { execSync } = require('child_process');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const path = require('path');

console.log('🏗️  Building enterprise distribution...');

// 1. Build all packages for distribution
console.log('📦 Building packages for distribution...');
try {
  execSync('BUILD_FOR_DISTRIBUTION=true pnpm build', {
    stdio: 'inherit',
    env: { ...process.env, BUILD_FOR_DISTRIBUTION: 'true' },
  });
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// 2. Fix imports in built files to point to distributed packages
console.log('🔧 Fixing import paths for distribution...');

const packagesDir = path.join(__dirname, '..', 'packages');
const packages = [
  'acl',
  'aggregates',
  'cli',
  'contracts',
  'cqrs',
  'di',
  'domain-primitives',
  'domain-services',
  'enterprise',
  'events',
  'logging',
  'messaging',
  'nestjs',
  'policies',
  'projections',
  'repositories',
  'resilience',
  'testing',
  'utils',
  'validation',
  'value-objects',
];

function fixImportsInFile(filePath) {
  if (!existsSync(filePath)) return;

  let content = readFileSync(filePath, 'utf-8');

  // Replace @vytches/ddd-package imports with relative paths to dist
  packages.forEach(pkg => {
    const importRegex = new RegExp(`from "@vytches/ddd-${pkg}"`, 'g');
    const requireRegex = new RegExp(`require\\("@vytches/ddd-${pkg}"\\)`, 'g');
    const dynamicImportRegex = new RegExp(`import\\("@vytches/ddd-${pkg}"\\)`, 'g');

    content = content.replace(importRegex, `from "@vytches/ddd-${pkg}"`);
    content = content.replace(requireRegex, `require("@vytches/ddd-${pkg}")`);
    content = content.replace(dynamicImportRegex, `import("@vytches/ddd-${pkg}")`);
  });

  writeFileSync(filePath, content);
}

// Fix imports in all built JS and .d.ts files
packages.forEach(pkg => {
  const distDir = path.join(packagesDir, pkg, 'dist');
  if (existsSync(distDir)) {
    const jsFile = path.join(distDir, 'index.js');
    const cjsFile = path.join(distDir, 'index.cjs');
    const dtsFile = path.join(distDir, 'index.d.ts');

    fixImportsInFile(jsFile);
    fixImportsInFile(cjsFile);
    fixImportsInFile(dtsFile);
  }
});

console.log('✅ Distribution build completed!');
console.log('📦 Built packages ready for GitHub installation');
