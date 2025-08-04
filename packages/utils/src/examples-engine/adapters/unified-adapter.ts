/**
 * Unified Adapter - Clean Architecture Pattern Implementation
 * Combines YamlMetadataEngine with Output Adapters
 * This is the main facade for the new architecture
 */

import { YamlMetadataEngine, type MetadataConfig } from '../core/yaml-metadata-engine';
import { JsDocOutputAdapter } from './jsdoc-output-adapter';
import { CliOutputAdapter } from './cli-output-adapter';
import type { ResolvedMetadata } from '../hierarchy/types';

/**
 * Output format types
 */
export type OutputFormat = 'jsdoc' | 'cli';

/**
 * Main facade implementing the clean adapter pattern
 * Separates metadata loading from output formatting
 */
export class UnifiedAdapter {
  private metadataEngine: YamlMetadataEngine;
  private jsDocAdapter: JsDocOutputAdapter;
  private cliAdapter: CliOutputAdapter;
  
  constructor(baseDir?: string) {
    this.metadataEngine = new YamlMetadataEngine(baseDir);
    this.jsDocAdapter = new JsDocOutputAdapter();
    this.cliAdapter = new CliOutputAdapter();
  }
  
  /**
   * Main entry point - load metadata and format for specific output
   * This demonstrates the clean architecture: 
   * 1. Load metadata (YamlMetadataEngine)
   * 2. Format output (specific adapter)
   */
  async formatMetadata(
    config: MetadataConfig, 
    format: OutputFormat
  ): Promise<string | null> {
    console.log(`[unified-adapter] Processing ${config.packageName}/${config.className}${config.methodName ? `/${config.methodName}` : ''} for ${format}`);
    
    // Step 1: Load metadata (single source of truth)
    const metadata = await this.metadataEngine.loadHierarchicalMetadata(config);
    
    if (!metadata) {
      console.log(`[unified-adapter] No metadata found`);
      return null;
    }
    
    // Step 2: Apply format-specific overrides (if any)
    const processedMetadata = this.applyFormatOverrides(metadata, format);
    
    // Step 3: Format output using appropriate adapter
    switch (format) {
      case 'jsdoc':
        return this.jsDocAdapter.format(processedMetadata);
      case 'cli':
        return this.cliAdapter.format(processedMetadata);
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }
  
  /**
   * Batch process all methods in a class (performance optimization)
   */
  async formatAllMethodsMetadata(
    packageName: string,
    className: string,
    format: OutputFormat
  ): Promise<Record<string, string | null>> {
    console.log(`[unified-adapter] BATCH processing all methods for ${packageName}/${className}`);
    
    // Step 1: Load all methods metadata at once
    const allMethodsMetadata = await this.metadataEngine.loadAllMethodsMetadata(packageName, className);
    
    const results: Record<string, string | null> = {};
    
    // Step 2: Format each method's metadata
    for (const [methodName, metadata] of Object.entries(allMethodsMetadata)) {
      if (metadata) {
        const processedMetadata = this.applyFormatOverrides(metadata, format);
        
        switch (format) {
          case 'jsdoc':
            results[methodName] = this.jsDocAdapter.format(processedMetadata);
            break;
          case 'cli':
            results[methodName] = this.cliAdapter.format(processedMetadata);
            break;
          default:
            results[methodName] = null;
        }
      } else {
        results[methodName] = null;
      }
    }
    
    console.log(`[unified-adapter] BATCH processed ${Object.keys(results).length} methods`);
    return results;
  }
  
  /**
   * Get raw metadata without formatting (for debugging/testing)
   */
  async getRawMetadata(config: MetadataConfig): Promise<ResolvedMetadata | null> {
    return await this.metadataEngine.loadHierarchicalMetadata(config);
  }
  
  /**
   * Format single tag for injection (JSDoc specific)
   */
  formatSingleTag(key: string, value: string, format: OutputFormat): string {
    switch (format) {
      case 'jsdoc':
        return this.jsDocAdapter.formatSingleTag(key, value);
      case 'cli':
        return `${key}: ${value}`;
      default:
        return `${key}: ${value}`;
    }
  }
  
  /**
   * Format only examples (useful for specific use cases)
   */
  formatExamplesOnly(metadata: ResolvedMetadata, format: OutputFormat): string {
    switch (format) {
      case 'jsdoc':
        return this.jsDocAdapter.formatExamples(metadata.examples || []);
      case 'cli':
        return this.cliAdapter.formatExamplesOnly(metadata);
      default:
        return '';
    }
  }
  
  /**
   * Get performance statistics
   */
  getCacheStats() {
    return this.metadataEngine.getCacheStats();
  }
  
  /**
   * Clear cache for testing/performance monitoring
   */
  clearCache(filePath?: string): void {
    this.metadataEngine.clearCache(filePath);
  }
  
  // Private implementation methods
  
  /**
   * Apply format-specific overrides to metadata
   * This handles format-specific metadata like "description.jsdoc" vs "description.cli"
   */
  private applyFormatOverrides(metadata: ResolvedMetadata, format: OutputFormat): ResolvedMetadata {
    const result = { ...metadata };
    
    // Apply format-specific overrides
    Object.keys(result).forEach(key => {
      const formatSpecificKey = `${key}.${format}`;
      
      if (metadata[formatSpecificKey]) {
        // Replace base value with format-specific value
        result[key] = metadata[formatSpecificKey];
      }
    });
    
    // Clean up format-specific keys from result
    Object.keys(result).forEach(key => {
      if (key.includes('.')) {
        delete result[key];
      }
    });
    
    return result;
  }
}

// Convenience factory functions

/**
 * Create JSDoc formatted output from metadata config
 */
export async function formatAsJSDoc(
  config: MetadataConfig,
  baseDir?: string
): Promise<string | null> {
  const adapter = new UnifiedAdapter(baseDir);
  return await adapter.formatMetadata(config, 'jsdoc');
}

/**
 * Create CLI formatted output from metadata config
 */
export async function formatAsCLI(
  config: MetadataConfig, 
  baseDir?: string
): Promise<string | null> {
  const adapter = new UnifiedAdapter(baseDir);
  return await adapter.formatMetadata(config, 'cli');
}

/**
 * Batch format all methods in a class as JSDoc
 */
export async function formatAllMethodsAsJSDoc(
  packageName: string,
  className: string,
  baseDir?: string
): Promise<Record<string, string | null>> {
  const adapter = new UnifiedAdapter(baseDir);
  return await adapter.formatAllMethodsMetadata(packageName, className, 'jsdoc');
}

/**
 * Batch format all methods in a class as CLI
 */
export async function formatAllMethodsAsCLI(
  packageName: string,
  className: string,
  baseDir?: string
): Promise<Record<string, string | null>> {
  const adapter = new UnifiedAdapter(baseDir);
  return await adapter.formatAllMethodsMetadata(packageName, className, 'cli');
}
