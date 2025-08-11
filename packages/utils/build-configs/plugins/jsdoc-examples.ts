/**
 * Vite plugin for JSDoc documentation processing
 * Processes JSDoc documentation during build using YAML metadata system
 */

import type { Plugin } from 'vite';
import { JSDocAdapter } from '../../src/examples-engine/adapters/jsdoc-adapter';

export interface JSDocExamplesPluginOptions {
  /**
   * Enable/disable the plugin
   */
  enabled?: boolean;

  /**
   * File patterns to process
   */
  include?: string[];

  /**
   * File patterns to exclude
   */
  exclude?: string[];

  /**
   * Log processed files
   */
  verbose?: boolean;

  /**
   * Cache examples for better performance
   */
  cache?: boolean;

  /**
   * Fallback behavior when examples not found
   */
  fallbackBehavior?: 'generate' | 'skip' | 'error';
}

const DEFAULT_OPTIONS: Required<JSDocExamplesPluginOptions> = {
  enabled: true,
  include: ['**/*.ts'],
  exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
  verbose: false,
  cache: true,
  fallbackBehavior: 'generate',
};

export function createJSDocExamplesPlugin(userOptions: JSDocExamplesPluginOptions = {}): Plugin {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };

  if (!options.enabled) {
    return {
      name: 'jsdoc-examples-disabled',
    };
  }

  const adapter = new JSDocAdapter();
  const processedFiles = new Set<string>();
  const exampleCache = new Map<string, string>();

  return {
    name: 'jsdoc-examples',

    // CRITICAL FIX: Use 'load' hook instead of 'transform' to process BEFORE TypeScript transpilation
    async load(id: string) {
      try {
        // Check if file should be processed
        if (!shouldProcessFile(id, options)) {
          return null; // Let Vite handle normally
        }

        // Read the original TypeScript source file
        const fs = await import('fs/promises');
        let code: string;

        try {
          code = await fs.readFile(id, 'utf-8');
        } catch (error) {
          // File doesn't exist or can't be read
          return null;
        }

        // Check if file contains injection directives
        if (!code.includes('-inject')) {
          return null; // Let Vite handle normally
        }

        if (options.verbose) {
          console.log(`[jsdoc-examples] Processing original TypeScript source: ${id}`);
        }

        // Check cache first
        const cacheKey = `${id}:${getCodeHash(code)}`;
        if (options.cache && exampleCache.has(cacheKey)) {
          const cachedResult = exampleCache.get(cacheKey)!;
          if (options.verbose) {
            console.log(`[jsdoc-examples] Using cached result for ${id}`);
          }
          return cachedResult;
        }

        // Process the original TypeScript source
        const processedCode = await adapter.processInjectionDirectives(code, id);

        // Debug: Log processing details
        if (options.verbose) {
          // Always log for debugging
          console.log(`[jsdoc-examples] LOAD HOOK - Original code length: ${code.length}`);
          console.log(
            `[jsdoc-examples] LOAD HOOK - Processed code length: ${processedCode.length}`
          );
          console.log(`[jsdoc-examples] LOAD HOOK - File: ${id}`);

          // Count directives in original vs processed
          const originalDirectives = (code.match(/@[\w-]+-inject/g) || []).length;
          const processedDirectives = (processedCode.match(/@[\w-]+-inject/g) || []).length;
          console.log(
            `[jsdoc-examples] LOAD HOOK - Directives: ${originalDirectives} -> ${processedDirectives}`
          );
        }

        // Cache result
        if (options.cache) {
          exampleCache.set(cacheKey, processedCode);
        }

        processedFiles.add(id);

        if (options.verbose) {
          console.log(`[jsdoc-examples] LOAD HOOK - Successfully processed ${id}`);
        }

        return processedCode;
      } catch (error) {
        console.warn(`[jsdoc-examples] LOAD HOOK - Failed to process ${id}:`, error);

        if (options.fallbackBehavior === 'error') {
          throw error;
        }

        return null; // Let Vite handle normally
      }
    },

    // Keep transform as fallback for edge cases where load hook didn't catch the file
    async transform(code: string, id: string) {
      try {
        // Only process if load hook didn't handle it and file still has directives
        if (!code.includes('-inject') || processedFiles.has(id)) {
          return null;
        }

        if (options.verbose) {
          console.log(`[jsdoc-examples] TRANSFORM HOOK - Processing missed file: ${id}`);
        }

        // Process the file (fallback)
        const processedCode = await adapter.processInjectionDirectives(code, id);

        processedFiles.add(id);

        return processedCode;
      } catch (error) {
        console.warn(`[jsdoc-examples] TRANSFORM HOOK - Failed to process ${id}:`, error);
        return null;
      }
    },

    buildStart() {
      console.log('[jsdoc-examples] Plugin initialized');
      // Clear any previous cache to start fresh
      try {
        const { ExampleEngine } = require('../../src/examples-engine/engine');
        ExampleEngine.clearGlobalCache();
        console.log('[jsdoc-examples] Cleared global cache for fresh build');
      } catch (error) {
        console.log('[jsdoc-examples] Could not clear global cache (might not be built yet)');
      }
    },

    buildEnd() {
      if (options.verbose) {
        console.log(`[jsdoc-examples] Processed ${processedFiles.size} files`);
        if (processedFiles.size > 0) {
          console.log('[jsdoc-examples] Processed files:', Array.from(processedFiles));
        }
      }

      // Clean up cache after successful build
      try {
        const { ExampleEngine } = require('../../src/examples-engine/engine');
        ExampleEngine.clearGlobalCache();
        console.log('[jsdoc-examples] Cleaned up global cache after build');
      } catch (error) {
        console.log('[jsdoc-examples] Could not clean up global cache');
      }
    },

    generateBundle() {
      // Clear cache after build
      if (!options.cache) {
        exampleCache.clear();
      }
    },
  };
}

/**
 * Check if file should be processed based on include/exclude patterns
 */
function shouldProcessFile(
  filePath: string,
  options: Required<JSDocExamplesPluginOptions>
): boolean {
  // Must be TypeScript file
  if (!filePath.endsWith('.ts')) {
    return false;
  }

  // Check exclude patterns
  for (const pattern of options.exclude) {
    if (matchesPattern(filePath, pattern)) {
      return false;
    }
  }

  // Check include patterns
  for (const pattern of options.include) {
    if (matchesPattern(filePath, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Simple pattern matching for file paths
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Simplified approach - just check if it's a TypeScript file for **/*.ts
  if (pattern === '**/*.ts') {
    const result = filePath.endsWith('.ts');
    // console.log(`[matchesPattern] Simplified TS check: ${filePath} -> ${result}`);
    return result;
  }

  // For other patterns, use original logic
  const fileName = filePath.split('/').pop() || filePath;
  const relativePath = filePath.includes('/src/') ? filePath.split('/src/')[1] : fileName;

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.') // Escape dots first
    .replace(/\*\*\//g, '(.*/)?') // **/ matches any directory path (including none)
    .replace(/\*\*/g, '.*') // ** matches any characters including /
    .replace(/\*/g, '[^/]*') // * matches any characters except /
    .replace(/\?/g, '.'); // ? matches single character

  const regex = new RegExp(`^${regexPattern}$`);

  // Debug logging for non-TS patterns
  // console.log(`[matchesPattern] Testing pattern "${pattern}" against paths:`);

  // Test against all variations
  return regex.test(filePath) || regex.test(relativePath) || regex.test(fileName);
}

/**
 * Generate simple hash for caching
 */
function getCodeHash(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    const char = code.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Enhanced plugin with TypeScript AST support
 */
export function createAdvancedJSDocExamplesPlugin(
  userOptions: JSDocExamplesPluginOptions & {
    /**
     * Use TypeScript AST for better method detection
     */
    useTypeScriptAST?: boolean;
  } = {}
): Plugin {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };

  if (!options.enabled) {
    return {
      name: 'jsdoc-examples-advanced-disabled',
    };
  }

  return {
    name: 'jsdoc-examples-advanced',

    async transform(code: string, id: string) {
      if (!shouldProcessFile(id, options)) {
        return null;
      }

      try {
        // Enhanced processing with AST support
        if (userOptions.useTypeScriptAST) {
          return await processWithTypeScriptAST(code, id);
        } else {
          const adapter = new JSDocAdapter();
          return await adapter.processInjectionDirectives(code, id);
        }
      } catch (error) {
        console.warn(`[jsdoc-examples-advanced] Failed to process ${id}:`, error);
        return options.fallbackBehavior === 'skip' ? null : code;
      }
    },
  };
}

/**
 * Process file using TypeScript AST (placeholder for future implementation)
 */
async function processWithTypeScriptAST(code: string, filePath: string): Promise<string> {
  // TODO: Implement TypeScript AST parsing
  // This would provide more accurate method detection
  console.warn('TypeScript AST processing not yet implemented, falling back to regex');

  const adapter = new JSDocAdapter();
  return await adapter.processInjectionDirectives(code, filePath);
}

/**
 * Utility to validate plugin configuration
 */
export function validatePluginConfig(options: JSDocExamplesPluginOptions): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (options.include && !Array.isArray(options.include)) {
    errors.push('include option must be an array of strings');
  }

  if (options.exclude && !Array.isArray(options.exclude)) {
    errors.push('exclude option must be an array of strings');
  }

  if (
    options.fallbackBehavior &&
    !['generate', 'skip', 'error'].includes(options.fallbackBehavior)
  ) {
    errors.push('fallbackBehavior must be one of: generate, skip, error');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
