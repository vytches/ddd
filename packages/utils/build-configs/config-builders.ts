/**
 * Configuration builders for different package types
 */
import { resolve } from 'path';
import { defineConfig, mergeConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { createExternalFunction, getBuildAliases, getBundleStrategy } from './bundle-strategies';
import { detectPackageType, getWorkspaceAliases } from './package-detection';
import type { BuildContext, PackageConfigOptions } from './types';

/**
 * Create DTS plugin configuration.
 *
 * NOTE (F-C1, VB-002): path rewriting for monorepo-relative `.d.ts` imports
 * (e.g. `from '../../di/src/index.ts'`) used to happen HERE for meta-packages
 * only, AND separately in `scripts/fix-dts-imports.js` for everything else —
 * two independent, out-of-sync fixers. That has been consolidated into a
 * single mechanism: `scripts/fix-dts-imports.js` now runs unconditionally
 * (no isMetaPackage gate) as a post-build step (`pnpm fix:dts`), recurses
 * into `dist/**\/*.d.ts` for every package, and derives its rewrite table
 * dynamically from `packages/*\/package.json` names. Do not reintroduce
 * path-rewriting logic here — keep this plugin config purely structural.
 */
function createDTSPlugin(_context: BuildContext, options: PackageConfigOptions) {
  const dtsConfig = options.dtsConfig || {};

  const baseConfig = {
    insertTypesEntry: dtsConfig.insertTypesEntry ?? true,
    exclude: dtsConfig.exclude ?? ['**/*.spec.ts', '**/*.test.ts'],
    outDir: dtsConfig.outDir ?? 'dist',
    entryRoot: dtsConfig.entryRoot ?? 'src',
  };

  return dts(baseConfig);
}

/**
 * Create optimized Vite configuration for a package
 */
export function createPackageConfig(packagePath: string, options: PackageConfigOptions = {}) {
  const context = createBuildContext(packagePath);
  const packageType =
    options.packageType || detectPackageType(context.packageName, context.packageJson);
  const bundleStrategy = options.bundleStrategy || getBundleStrategy(packageType, context);
  const workspaceAliases = getWorkspaceAliases(packagePath);

  // Build configuration
  const buildAliases = getBuildAliases(packageType, bundleStrategy, context, workspaceAliases);
  const externalFn = createExternalFunction(
    bundleStrategy,
    context,
    options.additionalExternals,
    options.additionalBundles
  );

  // Test aliases - removed since test config is not used in Vite build config

  // VF-024 (AC4): support additional named entries (e.g. `internal`) built
  // alongside the main `index` entry, for symbols that must stay out of the
  // package's public barrel but remain reachable via a dedicated subpath
  // export (`@vytches/ddd-<pkg>/internal`).
  const additionalEntries = options.additionalEntries ?? {};
  const hasAdditionalEntries = Object.keys(additionalEntries).length > 0;
  const libEntry = hasAdditionalEntries
    ? {
        index: resolve(packagePath, 'src/index.ts'),
        ...Object.fromEntries(
          Object.entries(additionalEntries).map(([name, relPath]) => [
            name,
            resolve(packagePath, relPath),
          ])
        ),
      }
    : resolve(packagePath, 'src/index.ts');

  const buildConfig = defineConfig({
    plugins: [...(options.generateDTS !== false ? [createDTSPlugin(context, options)] : [])],
    resolve: {
      alias: buildAliases,
    },
    build: {
      outDir: 'dist',
      lib: {
        entry: libEntry,
        name: `VytchesDDD${context.packageName.charAt(0).toUpperCase() + context.packageName.slice(1).replace(/-([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())}`,
        formats: ['es', 'cjs'],
        fileName: hasAdditionalEntries
          ? (format, entryName) => `${entryName}.${format === 'es' ? 'js' : format}`
          : format => `index.${format === 'es' ? 'js' : format}`,
      },
      rollupOptions: {
        external: externalFn,
      },
      sourcemap: options.sourcemap ?? false,
      target: options.target ?? 'ES2020',
      emptyOutDir: true,
    },
  });

  // Test configuration
  const testConfig = defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: ['**/*.test.ts', '**/tests/**', '**/node_modules/**', '**/dist/**'],
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      pool: 'forks',
      passWithNoTests: true,
      // Use workspace aliases for testing
      alias: workspaceAliases,
    },
  });

  // Merge build and test configurations
  return mergeConfig(buildConfig, testConfig);
}

// Import wrapper for the main detection function
import { createBuildContext } from './package-detection';
