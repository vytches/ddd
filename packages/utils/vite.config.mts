/// <reference types="vitest" />
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Modern build configuration system
export {
  createArchitectureConfig,
  createFoundationConfig,
  createInfrastructureConfig,
  createMetaPackageConfig,
  createPackageConfig,
  createPatternConfig,
  type BundleStrategy,
  type PackageConfigOptions,
  type PackageType,
} from './build-configs';

// Legacy configuration for utils package itself
const packageJsonContent = readFileSync('./package.json', 'utf-8');
const packageJson = JSON.parse(packageJsonContent);
const _packageName = packageJson.name?.split('/')[1] || 'unknown';

// Foundation dependencies only - utils package should not depend on higher layers
const commonTestAliases = {
  '@vytches/ddd-utils': resolve(__dirname, '../utils/src/index.ts'),
  '@vytches/ddd-contracts': resolve(__dirname, '../contracts/src/index.ts'),
  // NOTE: core removed to prevent circular dependency (core → domain-primitives → utils → core)
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
        // REL-008 (2026-05-08): `src/result.ts` re-exports `Result` from
        // `@vytches/ddd-contracts` as a backward-compat shim. Contracts is
        // a real workspace runtime dependency (declared in package.json),
        // so it must stay external — bundling it would duplicate the type
        // and break `instanceof` / identity checks for `Result` across
        // packages.
        if (id === '@vytches/ddd-contracts' || id.startsWith('@vytches/ddd-contracts/')) {
          return true;
        }
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
