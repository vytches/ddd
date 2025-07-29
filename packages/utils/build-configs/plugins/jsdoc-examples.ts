/**
 * Vite plugin for JSDoc example injection
 * Processes @example-inject directives during build
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

export function createJSDocExamplesPlugin(
  userOptions: JSDocExamplesPluginOptions = {}
): Plugin {
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
    
    async transform(code: string, id: string) {
      try {
        // console.log(`[jsdoc-examples] Transform called for: ${id}`);
        
        // Check if file should be processed
        if (!shouldProcessFile(id, options)) {
          // console.log(`[jsdoc-examples] Skipping file (not in include pattern): ${id}`);
          return null;
        }

        // Check if file contains @example-inject
        if (!code.includes('@example-inject')) {
          // console.log(`[jsdoc-examples] No @example-inject found in: ${id}`);
          return null;
        }

        if (options.verbose) {
          console.log(`[jsdoc-examples] Processing file with @example-inject: ${id}`);
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

        // Process the file
        const processedCode = await adapter.processInjectionDirectives(code, id);
        
        // Debug: Log transformation details
        if (options.verbose) {
          console.log(`[jsdoc-examples] Original code length: ${code.length}`);
          console.log(`[jsdoc-examples] Processed code length: ${processedCode.length}`);
          
          // Find the exact transformation
          const originalLines = code.split('\n');
          const processedLines = processedCode.split('\n');
          
          console.log(`[jsdoc-examples] Line count: ${originalLines.length} -> ${processedLines.length}`);
          
          // Check if exports are preserved
          const hasExports = processedCode.includes('export class InvalidParameterError');
          console.log(`[jsdoc-examples] InvalidParameterError export preserved: ${hasExports}`);
          
          // Look for where transformation happened
          for (let i = 0; i < Math.max(originalLines.length, processedLines.length); i++) {
            const original = originalLines[i] || '<missing>';
            const processed = processedLines[i] || '<missing>';
            
            if (original !== processed && (original.includes('@example-inject') || processed.includes('Example'))) {
              console.log(`[jsdoc-examples] Line ${i + 1} CHANGED:`);
              console.log(`[jsdoc-examples]   Original: ${original}`);
              console.log(`[jsdoc-examples]   Processed: ${processed}`);
            }
          }
        }
        
        // Cache result
        if (options.cache) {
          exampleCache.set(cacheKey, processedCode);
        }

        processedFiles.add(id);
        
        if (options.verbose) {
          console.log(`[jsdoc-examples] Processed ${id}`);
        }

        return processedCode;
      } catch (error) {
        console.warn(`[jsdoc-examples] Failed to process ${id}:`, error);
        
        if (options.fallbackBehavior === 'error') {
          throw error;
        }
        
        return options.fallbackBehavior === 'skip' ? null : code;
      }
    },

    buildStart() {
      console.log('[jsdoc-examples] Plugin initialized');
    },

    buildEnd() {
      if (options.verbose) {
        console.log(`[jsdoc-examples] Processed ${processedFiles.size} files`);
        if (processedFiles.size > 0) {
          console.log('[jsdoc-examples] Processed files:', Array.from(processedFiles));
        }
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
  const relativePath = filePath.includes('/src/') 
    ? filePath.split('/src/')[1] 
    : fileName;
  
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')        // Escape dots first
    .replace(/\*\*\//g, '(.*/)?') // **/ matches any directory path (including none)
    .replace(/\*\*/g, '.*')       // ** matches any characters including /
    .replace(/\*/g, '[^/]*')      // * matches any characters except /
    .replace(/\?/g, '.');         // ? matches single character

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
    hash = ((hash << 5) - hash) + char;
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
      if (!shouldProcessFile(id, options) || !code.includes('@example-inject')) {
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
export function validatePluginConfig(
  options: JSDocExamplesPluginOptions
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (options.include && !Array.isArray(options.include)) {
    errors.push('include option must be an array of strings');
  }

  if (options.exclude && !Array.isArray(options.exclude)) {
    errors.push('exclude option must be an array of strings');
  }

  if (options.fallbackBehavior && !['generate', 'skip', 'error'].includes(options.fallbackBehavior)) {
    errors.push('fallbackBehavior must be one of: generate, skip, error');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}