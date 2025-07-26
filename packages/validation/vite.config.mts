/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import dts from 'vite-plugin-dts';

// Package type detection - determines build configuration
const packageJsonContent = readFileSync('./package.json', 'utf-8');
const packageJson = JSON.parse(packageJsonContent);
const packageName = packageJson.name?.split('/')[1] || 'unknown';

// Meta package detection: enterprise package that re-exports many packages
const isMetaPackage =
  packageName === 'enterprise' ||
  packageName === 'ddd' ||
  (packageJson.dependencies &&
    Object.keys(packageJson.dependencies).filter(dep => dep.startsWith('@vytches/ddd-')).length >=
      5);

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
  '@vytches/ddd-event-scheduling': resolve(__dirname, '../event-scheduling/src/index.ts'),
  '@vytches/ddd-testing': resolve(__dirname, '../testing/src/index.ts'),
  '@vytches/ddd-enterprise': resolve(__dirname, '../enterprise/src/index.ts'),
};

// Determine package type based on dependencies and devDependencies
const isFoundationPackage =
  !isMetaPackage &&
  (!packageJson.dependencies ||
    Object.keys(packageJson.dependencies).filter(dep => dep.startsWith('@vytches/ddd-')).length <=
      2);

// Determine required dependencies based on package type
function getPackageDependencies(): Record<string, string> {
  if (isMetaPackage) {
    // Meta packages don't need aliases - they re-export from dependencies
    return {};
  }

  if (isFoundationPackage) {
    // Foundation packages (only need utils and contracts)
    return {
      '@vytches/ddd-utils': commonTestAliases['@vytches/ddd-utils'],
      '@vytches/ddd-contracts': commonTestAliases['@vytches/ddd-contracts'],
    };
  }

  // Higher-level packages (need core + specific dependencies)
  return {
    '@vytches/ddd-core': resolve(__dirname, '../core/src/index.ts'),
    '@vytches/ddd-contracts': commonTestAliases['@vytches/ddd-contracts'],
    '@vytches/ddd-logging': commonTestAliases['@vytches/ddd-logging'],
    '@vytches/ddd-utils': commonTestAliases['@vytches/ddd-utils'],
  };
}

const buildAliases = getPackageDependencies();

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      outDir: 'dist',
      entryRoot: 'src',
    }),
  ],
  resolve: {
    alias: {
      ...buildAliases,
      // Foundation packages need aliasing to bundle @vytches dependencies
      ...(isFoundationPackage
        ? {
            '@vytches/ddd-domain-primitives': resolve(
              __dirname,
              '../domain-primitives/src/index.ts'
            ),
            '@vytches/ddd-value-objects': resolve(__dirname, '../value-objects/src/index.ts'),
            '@vytches/ddd-repositories': resolve(__dirname, '../repositories/src/index.ts'),
            '@vytches/ddd-aggregates': resolve(__dirname, '../aggregates/src/index.ts'),
            '@vytches/ddd-utils': resolve(__dirname, '../utils/src/index.ts'),
            '@vytches/ddd-contracts': resolve(__dirname, '../contracts/src/index.ts'),
          }
        : {}),
    },
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: `VytchesDDD${packageName.charAt(0).toUpperCase() + packageName.slice(1).replace(/-([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())}`,
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'js' : format}`,
    },
    rollupOptions: {
      external: id => {
        if (isMetaPackage) {
          // Meta-packages should externalize all @vytches/ddd-* dependencies
          return (
            id.startsWith('@vytches/ddd-') ||
            (!id.includes('src/') && !id.startsWith('./') && !id.startsWith('../'))
          );
        }

        // Utils package should bundle everything (no dependencies)
        if (packageName === 'utils') {
          return false; // Bundle everything
        }

        if (isFoundationPackage) {
          // Foundation packages: bundle ALL internal files and @vytches packages
          if (id.startsWith('@vytches/ddd-')) return false; // Bundle @vytches packages
          if (id.includes('src/')) return false; // Bundle source files
          if (id.startsWith('./') || id.startsWith('../')) return false; // Bundle relative imports
          if (id.includes('packages/') && id.includes('vytches-ddd')) return false; // Bundle resolved paths

          // Only externalize real npm packages (like uuid, etc.)
          return true;
        }

        // Higher-level packages - externalize @vytches dependencies
        return (
          id.startsWith('@vytches/ddd-') ||
          (!id.includes('src/') && !id.startsWith('./') && !id.startsWith('../'))
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
