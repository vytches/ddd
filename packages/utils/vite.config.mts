/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import dts from 'vite-plugin-dts';

// Modern build configuration system
export {
  createPackageConfig,
  createFoundationConfig,
  createMetaPackageConfig,
  createPatternConfig,
  createArchitectureConfig,
  createInfrastructureConfig,
  type PackageConfigOptions,
  type PackageType,
  type BundleStrategy,
} from './build-configs';

// Legacy configuration for utils package itself
const packageJsonContent = readFileSync('./package.json', 'utf-8');
const packageJson = JSON.parse(packageJsonContent);
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

// Utils package configuration (bundles everything, no dependencies)
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
      name: 'VytchesDDDUtils',
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'js' : format}`,
    },
    rollupOptions: {
      external: id => {
        // Keep Node.js built-ins external
        const nodeBuiltins = ['fs', 'fs/promises', 'path', 'os', 'crypto', 'util'];
        return nodeBuiltins.some(builtin => id === builtin || id.startsWith(builtin + '/'));
      },
    },
    sourcemap: false,
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
      ...commonTestAliases,
      '@vytches/ddd-utils': resolve(__dirname, 'src/index.ts'),
    },
  },
});
