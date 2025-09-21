/// <reference types="vitest" />
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Package type detection - determines build configuration
const packageJsonContent = readFileSync('./package.json', 'utf-8');
const packageJson = JSON.parse(packageJsonContent);
const isMetaPackage = packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0;
const packageName = packageJson.name?.split('/')[1] || 'unknown';

// Complete dependencies that should be available in test environment
const commonTestAliases = {
  '@vytches/ddd-utils': resolve(__dirname, '../utils/src/index.ts'),
  '@vytches/ddd-contracts': resolve(__dirname, '../contracts/src/index.ts'),
  '@vytches/ddd-domain-primitives': resolve(__dirname, '../domain-primitives/src/index.ts'),
  '@vytches/ddd-value-objects': resolve(__dirname, '../value-objects/src/index.ts'),
  '@vytches/ddd-repositories': resolve(__dirname, '../repositories/src/index.ts'),
  '@vytches/ddd-aggregates': resolve(__dirname, '../aggregates/src/index.ts'),
  '@vytches/ddd-core': resolve(__dirname, '../core/src/index.ts'),
  '@vytches/ddd-logging': resolve(__dirname, '../logging/src/index.ts'),
  '@vytches/ddd-events': resolve(__dirname, '../events/src/index.ts'),
  '@vytches/ddd-cqrs': resolve(__dirname, '../cqrs/src/index.ts'),
  '@vytches/ddd-di': resolve(__dirname, '../di/src/index.ts'),
  '@vytches/ddd-validation': resolve(__dirname, '../validation/src/index.ts'),
  '@vytches/ddd-policies': resolve(__dirname, '../policies/src/index.ts'),
  '@vytches/ddd-domain-services': resolve(__dirname, '../domain-services/src/index.ts'),
  '@vytches/ddd-projections': resolve(__dirname, '../projections/src/index.ts'),
  '@vytches/ddd-acl': resolve(__dirname, '../acl/src/index.ts'),
  '@vytches/ddd-messaging': resolve(__dirname, '../messaging/src/index.ts'),
  '@vytches/ddd-resilience': resolve(__dirname, '../resilience/src/index.ts'),
  '@vytches/ddd-event-store': resolve(__dirname, '../event-store/src/index.ts'),
  '@vytches/ddd-testing': resolve(__dirname, '../testing/src/index.ts'),
  '@vytches/ddd-enterprise': resolve(__dirname, '../enterprise/src/index.ts'),
};

// Determine required dependencies based on package type
function getPackageDependencies(): Record<string, string> {
  if (isMetaPackage) {
    // Meta packages don't need aliases - they re-export from dependencies
    return {};
  }

  // Foundation packages (only need utils)
  const foundationPackages = [
    'domain-primitives',
    'value-objects',
    'repositories',
    'aggregates',
    'contracts',
  ];
  if (foundationPackages.includes(packageName)) {
    return {
      '@vytches/ddd-utils': commonTestAliases['@vytches/ddd-utils'],
      '@vytches/ddd-contracts': commonTestAliases['@vytches/ddd-contracts'],
    };
  }

  // Higher-level packages (need core + specific dependencies)
  return {
    '@vytches/ddd-contracts': commonTestAliases['@vytches/ddd-contracts'],
    '@vytches/ddd-logging': commonTestAliases['@vytches/ddd-logging'],
    '@vytches/ddd-utils': commonTestAliases['@vytches/ddd-utils'],
  };
}

const buildAliases = getPackageDependencies();

// Custom plugin to copy templates to dist (removed - templates system removed)
function copyTemplatesPlugin() {
  return {
    name: 'copy-templates',
    generateBundle() {
      // Templates system removed as part of CLI bloat reduction
      console.log('📦 CLI: Templates system removed - skipping template copy');
    },
  };
}

// Helper function to recursively copy directories
function copyDirectory(src: string, dest: string) {
  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyDirectory(srcPath, destPath);
    } else {
      try {
        copyFileSync(srcPath, destPath);
      } catch (error) {
        console.warn(`Failed to copy ${srcPath}:`, error);
      }
    }
  }
}

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      outDir: 'dist',
      entryRoot: 'src',
    }),
    copyTemplatesPlugin(),
  ],
  resolve: {
    alias: buildAliases,
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        cli: resolve(__dirname, 'src/bin.ts'),
      },
      name: `VytchesDDD${packageName.charAt(0).toUpperCase() + packageName.slice(1).replace(/-([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())}`,
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : format}`,
    },
    rollupOptions: {
      external: id => {
        // For CLI, bundle everything except Node.js built-ins
        return (
          id.startsWith('node:') ||
          [
            'fs',
            'path',
            'url',
            'os',
            'child_process',
            'crypto',
            'util',
            'stream',
            'events',
            'buffer',
            'process',
          ].includes(id)
        );
      },
    },
    sourcemap: false, // Disable source maps for production builds
    target: 'ES2020',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    coverage: {
      enabled: false,
    },
    alias: {
      // All packages need all common aliases for testing
      ...commonTestAliases,
      // Add current package alias for self-imports in tests
      [`@vytches/ddd-${packageName}`]: resolve(__dirname, 'src/index.ts'),
    },
  },
});
