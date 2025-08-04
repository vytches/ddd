/**
 * Configuration builders for different package types
 */
import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import type { PackageConfigOptions, BuildContext } from './types';
import { detectPackageType, getWorkspaceAliases } from './package-detection';
import { getBundleStrategy, createExternalFunction, getBuildAliases } from './bundle-strategies';
import { createJSDocExamplesPlugin } from './plugins/jsdoc-examples';

/**
 * Create DTS plugin configuration with path transformation for meta packages
 */
function createDTSPlugin(context: BuildContext, options: PackageConfigOptions) {
  const dtsConfig = options.dtsConfig || {};

  const baseConfig = {
    insertTypesEntry: dtsConfig.insertTypesEntry ?? true,
    exclude: dtsConfig.exclude ?? ['**/*.spec.ts', '**/*.test.ts'],
    outDir: dtsConfig.outDir ?? 'dist',
    entryRoot: dtsConfig.entryRoot ?? 'src',
  };

  const afterBuildTasks = async () => {
    try {
      const fs = await import('fs');
      const path = await import('path');

      // Meta packages path transformation
      if (context.isMetaPackage && dtsConfig.transformPaths !== false) {
        const indexDtsPath = path.resolve(context.packagePath, 'dist/index.d.ts');
        if (fs.existsSync(indexDtsPath)) {
          let content = fs.readFileSync(indexDtsPath, 'utf-8');

          // Replace relative paths with package names
          content = content.replace(
            /from '\.\.\/\.\.\/([^/]+)\/src\/index\.ts'/g,
            "from '@vytches/ddd-$1'"
          );
          content = content.replace(
            /from "\.\.\/\.\.\/([^/]+)\/src\/index\.ts"/g,
            'from "@vytches/ddd-$1"'
          );

          fs.writeFileSync(indexDtsPath, content);
        }
      }

      // Enhanced Metadata System V2 has been replaced with YAML-based system
      // YAML processing is now handled by separate scripts, not during build
      if (options.jsdocExamples?.enabled !== false) {
        console.log(`[createDTSPlugin] Skipping deprecated Enhanced Metadata System V2 - use YAML system instead`);
      }
      
    } catch (error) {
      console.warn(
        `Warning: DTS post-processing failed for ${context.packagePath}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      // Don't throw - allow build to continue even if DTS processing fails
    }
  };

  return dts({
    ...baseConfig,
    afterBuild: afterBuildTasks,
  });
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

  const buildConfig = defineConfig({
    plugins: [
      // JSDoc examples plugin - DISABLED for library focus on .d.ts only
      // Enhanced Metadata System V2 processes .d.ts files post-compilation
      // ...((() => {
      //   const jsDocEnabled = shouldEnableJSDocPlugin(packageType, options);
      //   console.log(`[createPackageConfig] JSDoc plugin will be ${jsDocEnabled ? 'ENABLED' : 'DISABLED'} for ${context.packageName}`);
      //   return jsDocEnabled ? [createJSDocExamplesPlugin(options.jsdocExamples || {})] : [];
      // })()),
      
      // Generate DTS with Enhanced Metadata System V2 post-processing
      // This is the ONLY place where @*-inject directives are processed
      ...(options.generateDTS !== false ? [createDTSPlugin(context, options)] : []),
    ],
    resolve: {
      alias: buildAliases,
    },
    build: {
      outDir: 'dist',
      lib: {
        entry: resolve(packagePath, 'src/index.ts'),
        name: `VytchesDDD${context.packageName.charAt(0).toUpperCase() + context.packageName.slice(1).replace(/-([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())}`,
        formats: ['es', 'cjs'],
        fileName: format => `index.${format === 'es' ? 'js' : format}`,
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

/**
 * Determine if JSDoc examples plugin should be enabled for a package type
 */
function shouldEnableJSDocPlugin(packageType: string, options: PackageConfigOptions): boolean {
  // Debug logging
  console.log(`[shouldEnableJSDocPlugin] packageType: ${packageType}, enabled: ${options.jsdocExamples?.enabled}`);

  // Explicitly disabled
  if (options.jsdocExamples?.enabled === false) {
    console.log(`[shouldEnableJSDocPlugin] Explicitly disabled`);
    return false;
  }

  // Explicitly enabled
  if (options.jsdocExamples?.enabled === true) {
    console.log(`[shouldEnableJSDocPlugin] Explicitly enabled`);
    return true;
  }

  // Default: enable for foundation and pattern packages (where we have examples)
  const defaultEnabled = packageType === 'foundation' || packageType === 'pattern';
  console.log(`[shouldEnableJSDocPlugin] Default enabled: ${defaultEnabled}`);
  return defaultEnabled;
}
