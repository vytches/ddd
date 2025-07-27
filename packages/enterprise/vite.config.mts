// Enterprise meta-package with forced DTS generation
import { createFoundationConfig } from '../utils/vite.config.mts';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Get base config but force DTS generation for enterprise package
const baseConfig = createFoundationConfig(__dirname);

export default defineConfig({
  ...baseConfig,
  plugins: [
    // Force DTS generation for enterprise package despite being meta-package
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      outDir: 'dist',
      entryRoot: 'src',
      // Bundle all dependencies for proper type resolution
      bundledPackages: [
        '@vytches/ddd-acl',
        '@vytches/ddd-aggregates',
        '@vytches/ddd-contracts',
        '@vytches/ddd-core',
        '@vytches/ddd-cqrs',
        '@vytches/ddd-di',
        '@vytches/ddd-domain-primitives',
        '@vytches/ddd-events',
        '@vytches/ddd-logging',
        '@vytches/ddd-messaging',
        '@vytches/ddd-policies',
        '@vytches/ddd-projections',
        '@vytches/ddd-repositories',
        '@vytches/ddd-resilience',
        '@vytches/ddd-utils',
        '@vytches/ddd-validation',
        '@vytches/ddd-value-objects',
      ],
    }),
  ],
});
