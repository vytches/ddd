/**
 * Central YAML Metadata Engine - Single Source of Truth
 * Handles YAML loading and hierarchical metadata resolution
 * Separated from output formatting for clean architecture
 */

import * as path from 'path';
import * as yaml from 'js-yaml';
import { FileCache } from '../cache/file-cache';
import {
  MetadataLevel,
  type MetadataSource,
  type ResolvedMetadata,
  type MetadataParseResult,
  type ResolutionStrategy
} from '../hierarchy/types';
import { MetadataResolutionStrategies } from '../hierarchy/resolution-strategies';

/**
 * Configuration for metadata loading
 */
export interface MetadataConfig {
  packageName: string;
  className: string;
  methodName?: string;
}

/**
 * Core YAML metadata engine - handles ALL metadata loading and resolution
 * Output formatting is handled by separate adapters (JSDoc, CLI, etc.)
 */
export class YamlMetadataEngine {
  private baseDir: string;
  private fileCache: FileCache;
  private globalMetadataCache: MetadataParseResult | null = null;
  private packageMetadataCache = new Map<string, MetadataParseResult>();
  private classMetadataCache = new Map<string, MetadataParseResult>();

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.fileCache = FileCache.getInstance();
  }

  /**
   * Load complete hierarchical metadata for a method
   * This is the main entry point - everything else is implementation detail
   */
  async loadHierarchicalMetadata(config: MetadataConfig): Promise<ResolvedMetadata | null> {
    console.log(`[yaml-metadata-engine] Loading hierarchical metadata for ${config.packageName}/${config.className}${config.methodName ? `/${config.methodName}` : ''}`);
    
    // Collect all metadata sources (sorted by hierarchy level)
    const sources = await this.collectMetadataSources(config);
    
    if (sources.length === 0) {
      console.log(`[yaml-metadata-engine] No metadata sources found`);
      return null;
    }

    // Apply hierarchical resolution using existing strategy
    const resolvedMetadata = MetadataResolutionStrategies.applyHierarchy(sources);
    
    console.log(`[yaml-metadata-engine] Resolved metadata with ${Object.keys(resolvedMetadata).length} keys: ${Object.keys(resolvedMetadata).join(', ')}`);
    
    return resolvedMetadata;
  }

  /**
   * Batch load metadata for all methods in a class (performance optimization)
   */
  async loadAllMethodsMetadata(packageName: string, className: string): Promise<Record<string, ResolvedMetadata | null>> {
    console.log(`[yaml-metadata-engine] BATCH loading all methods for ${packageName}/${className}`);
    
    // Get base metadata sources (global, package, class) - shared for all methods
    const baseSources = await this.collectBaseMetadataSources(packageName, className);
    
    // Get all methods from class file
    const allMethodsMetadata = await this.loadAllMethodsFromClass(packageName, className);
    
    const results: Record<string, ResolvedMetadata | null> = {};
    
    // Process each method with shared base sources
    for (const [methodName, methodMetadata] of Object.entries(allMethodsMetadata)) {
      const sources = [...baseSources];
      
      // Add method-specific metadata if exists
      if (methodMetadata) {
        sources.push({
          level: MetadataLevel.METHOD,
          filePath: `docs/examples/domain/${packageName}/${className}/${methodName}.md`,
          metadata: methodMetadata.metadata,
          strategy: methodMetadata.strategy
        });
      }
      
      // Apply hierarchical resolution
      const resolved = MetadataResolutionStrategies.applyHierarchy(sources);
      results[methodName] = resolved;
    }
    
    console.log(`[yaml-metadata-engine] BATCH processed ${Object.keys(results).length} methods`);
    return results;
  }

  /**
   * Get cache statistics for performance monitoring
   */
  getCacheStats() {
    return this.fileCache.getStats();
  }

  /**
   * Clear cache for performance testing
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      this.fileCache.clearFile(filePath);
    } else {
      this.fileCache.clear();
      this.globalMetadataCache = null;
      this.packageMetadataCache.clear();
      this.classMetadataCache.clear();
    }
  }

  // Private implementation methods below

  private async collectMetadataSources(config: MetadataConfig): Promise<MetadataSource[]> {
    const sources: MetadataSource[] = [];
    
    // Level 0: Global settings
    const globalMetadata = await this.loadGlobalMetadata();
    if (globalMetadata) {
      sources.push({
        level: MetadataLevel.GLOBAL,
        filePath: 'docs/global-settings.yaml',
        metadata: globalMetadata.metadata,
        strategy: globalMetadata.strategy
      });
    }
    
    // Level 1: Package settings  
    const packageMetadata = await this.loadPackageMetadata(config.packageName);
    if (packageMetadata) {
      sources.push({
        level: MetadataLevel.PACKAGE,
        filePath: `packages/${config.packageName}/.md-settings.yaml`,
        metadata: packageMetadata.metadata,
        strategy: packageMetadata.strategy
      });
    }
    
    // Level 2: Class metadata
    const classMetadata = await this.loadClassMetadata(config.packageName, config.className);
    if (classMetadata) {
      sources.push({
        level: MetadataLevel.CLASS,
        filePath: `docs/examples/domain/${config.packageName}/${config.className}.yaml`,
        metadata: classMetadata.metadata,
        strategy: classMetadata.strategy
      });
    }
    
    // Level 3: Method metadata (if specified)
    if (config.methodName) {
      const methodMetadata = await this.loadMethodMetadata(config.packageName, config.className, config.methodName);
      if (methodMetadata) {
        sources.push({
          level: MetadataLevel.METHOD,
          filePath: `docs/examples/domain/${config.packageName}/${config.className}/${config.methodName}.md`,
          metadata: methodMetadata.metadata,
          strategy: methodMetadata.strategy
        });
      }
    }
    
    return sources.sort((a, b) => a.level - b.level);
  }

  private async collectBaseMetadataSources(packageName: string, className: string): Promise<MetadataSource[]> {
    const sources: MetadataSource[] = [];
    
    // Level 0: Global settings
    const globalMetadata = await this.loadGlobalMetadata();
    if (globalMetadata) {
      sources.push({
        level: MetadataLevel.GLOBAL,
        filePath: 'docs/global-settings.yaml',
        metadata: globalMetadata.metadata,
        strategy: globalMetadata.strategy
      });
    }
    
    // Level 1: Package settings
    const packageMetadata = await this.loadPackageMetadata(packageName);
    if (packageMetadata) {
      sources.push({
        level: MetadataLevel.PACKAGE,
        filePath: `packages/${packageName}/.md-settings.yaml`,
        metadata: packageMetadata.metadata,
        strategy: packageMetadata.strategy
      });
    }
    
    // Level 2: Class metadata
    const classMetadata = await this.loadClassMetadata(packageName, className);
    if (classMetadata) {
      sources.push({
        level: MetadataLevel.CLASS,
        filePath: `docs/examples/domain/${packageName}/${className}.yaml`,
        metadata: classMetadata.metadata,
        strategy: classMetadata.strategy
      });
    }
    
    return sources.sort((a, b) => a.level - b.level);
  }

  private async loadGlobalMetadata(): Promise<MetadataParseResult | null> {
    if (this.globalMetadataCache) {
      return this.globalMetadataCache;
    }
    
    const filePath = path.join(this.baseDir, 'docs', 'global-settings.yaml');
    const result = await this.parseMetadataFile(filePath);
    
    if (result) {
      this.globalMetadataCache = result;
    }
    
    return result;
  }

  private async loadPackageMetadata(packageName: string): Promise<MetadataParseResult | null> {
    if (this.packageMetadataCache.has(packageName)) {
      return this.packageMetadataCache.get(packageName) || null;
    }
    
    const filePath = path.join(this.baseDir, 'packages', packageName, '.md-settings.yaml');
    const result = await this.parseMetadataFile(filePath);
    
    if (result) {
      this.packageMetadataCache.set(packageName, result);
    }
    
    return result;
  }

  private async loadClassMetadata(packageName: string, className: string): Promise<MetadataParseResult | null> {
    const cacheKey = `${packageName}:${className}`;
    if (this.classMetadataCache.has(cacheKey)) {
      return this.classMetadataCache.get(cacheKey) || null;
    }
    
    // Convert class name to lowercase kebab-case for YAML files
    const yamlFileName = className.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    const filePath = path.join(this.baseDir, 'docs', 'examples', 'domain', packageName, `${yamlFileName}.yaml`);
    const result = await this.parseMetadataFile(filePath);
    
    if (result) {
      this.classMetadataCache.set(cacheKey, result);
    }
    
    return result;
  }

  private async loadMethodMetadata(packageName: string, className: string, methodName: string): Promise<MetadataParseResult | null> {
    // Method metadata is embedded in class metadata file, not separate files
    const classFilePath = path.join(
      this.baseDir,
      'docs',
      'examples', 
      'domain',
      packageName,
      `${className}.md`
    );
    
    try {
      // Use FileCache for cached method parsing
      const methodMetadata = await this.fileCache.getMethodMetadata(
        classFilePath,
        methodName,
        (content, method) => this.parseMethodFromClassFile(content, method)
      );
      
      return methodMetadata;
    } catch (error) {
      console.log(`[yaml-metadata-engine] Could not load method metadata for ${methodName}:`, error);
      return null;
    }
  }

  private async loadAllMethodsFromClass(packageName: string, className: string): Promise<Record<string, MetadataParseResult>> {
    const classFilePath = path.join(
      this.baseDir,
      'docs',
      'examples',
      'domain', 
      packageName,
      `${className}.md`
    );
    
    try {
      const content = await this.fileCache.getFileContent(classFilePath);
      if (!content) {
        return {};
      }
      
      return this.parseAllMethodsFromClassFile(content);
    } catch (error) {
      console.log(`[yaml-metadata-engine] Could not load class file ${classFilePath}:`, error);
      return {};
    }
  }

  private async parseMetadataFile(filePath: string): Promise<MetadataParseResult | null> {
    try {
      return await this.fileCache.getParsedMetadata(filePath, (content) => this.parseMetadata(content));
    } catch (error) {
      console.log(`[yaml-metadata-engine] Failed to parse metadata file ${filePath}:`, error);
      return null;
    }
  }

  private parseMetadata(content: string): MetadataParseResult {
    const metadata: Record<string, unknown> = {};
    let strategy: ResolutionStrategy = 'merge';
    
    try {
      // Try parsing as YAML first
      const yamlData = yaml.load(content) as Record<string, unknown>;
      if (yamlData && typeof yamlData === 'object') {
        for (const [key, value] of Object.entries(yamlData)) {
          if (key === 'strategy' && typeof value === 'string') {
            strategy = value as ResolutionStrategy;
          } else if (key && value !== undefined) {
            const normalizedKey = this.convertToCamelCase(key);
            metadata[normalizedKey] = typeof value === 'string' ? value.trim() : value;
          }
        }
        return { metadata, strategy };
      }
    } catch (yamlError) {
      // Fallback to @ tags format
      console.log(`[yaml-metadata-engine] YAML parse failed, trying @ tags:`, (yamlError as Error).message);
    }
    
    // Fallback to @ tags format for .md files
    const metadataRegex = /@([\w-]+(?:\.[\w-]+)?)\s*:\s*(.+)/gm;
    let match;
    
    while ((match = metadataRegex.exec(content)) !== null) {
      const [, key, value] = match;
      
      if (key === 'strategy' && value) {
        strategy = value.trim() as ResolutionStrategy;
      } else if (key && value) {
        const normalizedKey = this.convertToCamelCase(key);
        metadata[normalizedKey] = value.trim();
      }
    }
    
    return { metadata, strategy };
  }

  private parseMethodFromClassFile(content: string, methodName: string): MetadataParseResult | null {
    const metadata: Record<string, unknown> = {};
    let strategy: ResolutionStrategy = 'merge';
    
    // Split content into sections by ### headers
    const sections = content.split(/(?=^###\s+)/m);
    
    // Find the section for this method
    const methodSection = sections.find(section => {
      const headerMatch = section.match(/^###\s+(\w+)/);
      return headerMatch && headerMatch[1] === methodName;
    });
    
    if (!methodSection) {
      return null;
    }
    
    // Extract metadata tags from method section
    const metadataRegex = /@([\w-]+(?:\.[\w-]+)?)\s*:\s*(.+)/gm;
    let match;
    
    while ((match = metadataRegex.exec(methodSection)) !== null) {
      const [, key, value] = match;
      
      if (key === 'strategy' && value) {
        strategy = value.trim() as ResolutionStrategy;
      } else if (key && value) {
        metadata[key] = value.trim();
      }
    }
    
    // Extract @extract blocks for examples
    const examples: string[] = [];
    const extractRegex = /@extract:\s*(\w+):(\w+):(\w+)\s*\n\s*```typescript\s*\n([\s\S]*?)```\s*\n@extract-end/g;
    
    while ((match = extractRegex.exec(methodSection)) !== null) {
      const [, extractMethodName, , , code] = match;
      
      if (extractMethodName === methodName || extractMethodName === 'generic') {
        if (code) {
          examples.push(code.trim());
        }
      }
    }
    
    if (examples.length > 0) {
      metadata.examples = examples;
      strategy = 'replace';
    } else {
      metadata.examples = [];
    }
    
    return { metadata, strategy };
  }

  private parseAllMethodsFromClassFile(content: string): Record<string, MetadataParseResult> {
    const methods: Record<string, MetadataParseResult> = {};
    
    // Split content into sections by ### headers
    const sections = content.split(/(?=^###\s+)/m);
    
    for (const section of sections) {
      const headerMatch = section.match(/^###\s+(\w+)/);
      if (!headerMatch) continue;
      
      const methodName = headerMatch[1];
      if (!methodName) continue;
      
      const metadata: Record<string, unknown> = {};
      let strategy: ResolutionStrategy = 'merge';
      
      // Extract metadata tags
      const metadataRegex = /@([\w-]+(?:\.[\w-]+)?)\s*:\s*(.+)/gm;
      let match;
      
      while ((match = metadataRegex.exec(section)) !== null) {
        const [, key, value] = match;
        
        if (key === 'strategy' && value) {
          strategy = value.trim() as ResolutionStrategy;
        } else if (key && value) {
          metadata[key] = value.trim();
        }
      }
      
      // Extract examples
      const examples: string[] = [];
      const extractRegex = /@extract:\s*(\w+):(\w+):(\w+)\s*\n\s*```typescript\s*\n([\s\S]*?)```\s*\n@extract-end/g;
      
      while ((match = extractRegex.exec(section)) !== null) {
        const [, extractMethodName, , , code] = match;
        
        if (extractMethodName === methodName || extractMethodName === 'generic') {
          if (code) {
            examples.push(code.trim());
          }
        }
      }
      
      if (examples.length > 0) {
        metadata.examples = examples;
        strategy = 'replace';
      } else {
        metadata.examples = [];
      }
      
      methods[methodName] = { metadata, strategy };
    }
    
    return methods;
  }

  private convertToCamelCase(key: string): string {
    // Handle format-specific keys (e.g., "description.jsdoc" -> "description.jsdoc")
    if (key.includes('.')) {
      const [base, format] = key.split('.');
      const baseKey = base ?? '';
      const formatKey = format ?? '';
      return `${this.toCamelCase(baseKey)}.${formatKey}`;
    }
    
    return this.toCamelCase(key);
  }

  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
