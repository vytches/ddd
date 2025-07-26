/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import dts from 'vite-plugin-dts';

// Package type detection - determines build configuration
const packageJsonContent = readFileSync('./package.json', 'utf-8');
const packageJson = JSON.parse(packageJsonContent);
const isMetaPackage =
  (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) ||
  (packageJson.peerDependencies && Object.keys(packageJson.peerDependencies).length > 0);
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
  '@vytches/ddd-event-scheduling': resolve(__dirname, '../event-scheduling/src/index.ts'),
  '@vytches/ddd-testing': resolve(__dirname, '../testing/src/index.ts'),
  '@vytches/ddd-enterprise': resolve(__dirname, '../enterprise/src/index.ts'),
};

// Determine required dependencies based on package type
function getPackageDependencies(): Record<string, string> {
  if (isMetaPackage) {
    // Meta packages need aliases to all their dependencies for bundling
    const dependencies = packageJson.peerDependencies || packageJson.dependencies || {};
    const aliases: Record<string, string> = {};

    for (const dep of Object.keys(dependencies)) {
      if (dep.startsWith('@vytches/ddd-')) {
        const packageName = dep.replace('@vytches/ddd-', '');
        aliases[dep] = resolve(__dirname, `../${packageName}/src/index.ts`);
      }
    }

    return aliases;
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
    '@vytches/ddd-core': resolve(__dirname, '../core/src/index.ts'),
    '@vytches/ddd-policies': resolve(__dirname, '../policies/src/index.ts'),
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
    alias: buildAliases,
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
          // Meta-packages should bundle all their @vytches/ddd-* dependencies
          // Only externalize true external dependencies (nodejs modules, npm packages)
          return (
            !id.startsWith('@vytches/ddd-') &&
            !id.includes('src/') &&
            !id.startsWith('./') &&
            !id.startsWith('../')
          );
        } else {
          // Regular packages bundle all @vytches/ddd-* dependencies
          // Only externalize real npm packages (not internal ones)
          return !id.startsWith('@vytches/ddd-') && !id.includes('src/');
        }
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
