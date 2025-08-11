/**
 * Hierarchical Metadata Resolver for Enhanced Metadata System V2
 * Resolves metadata from multiple levels with inheritance strategies
 * Now optimized with FileCache to eliminate repeated file operations
 */

import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  MetadataLevel,
  type MetadataSource,
  type ResolvedMetadata,
  type HierarchyConfig,
  type MetadataParseResult,
  type ResolutionStrategy,
} from './types';
import { MetadataResolutionStrategies } from './resolution-strategies';
import { FormatSpecificResolver } from './format-specific-resolver';
import { FileCache } from '../cache/file-cache';

// Shared regex pattern for @extract blocks to avoid duplication
const EXTRACT_BLOCK_REGEX =
  /@extract:\s*(\w+):(\w+):(\w+)\s*\n\s*```typescript\s*\n([\s\S]*?)```\s*\n@extract-end/g;

export class HierarchicalMetadataResolver {
  private metadataSources = new Map<string, MetadataSource[]>();
  private baseDir: string;
  private fileCache: FileCache;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.fileCache = FileCache.getInstance();
  }

  /**
   * Pre-warm cache for class with multiple methods to optimize batch operations
   */
  async preWarmClassCache(
    packageName: string,
    className: string,
    methodNames: string[]
  ): Promise<void> {
    const classFilePath = path.join(
      this.baseDir,
      'docs',
      'examples',
      'domain',
      packageName,
      `${className}.yaml`
    );

    console.log(
      `[hierarchical-resolver] Pre-warming cache for ${className} with ${methodNames.length} methods`
    );

    await this.fileCache.preWarmClassFile(classFilePath, methodNames, (content, method) =>
      this.parseMethodFromClassFile(content, method)
    );

    console.log(`[hierarchical-resolver] Cache pre-warmed for ${className}`);
  }

  /**
   * Get cache statistics for performance monitoring
   */
  getCacheStats() {
    return this.fileCache.getStats();
  }

  /**
   * Clear cache for specific file or entire cache
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      this.fileCache.clearFile(filePath);
      console.log(`[hierarchical-resolver] Cleared cache for file: ${filePath}`);
    } else {
      this.fileCache.clear();
      console.log(`[hierarchical-resolver] Cleared entire cache`);
    }
  }

  /**
   * BATCH OPTIMIZATION: Resolve ALL methods for a class at once
   * This addresses the performance issue where one .d.ts file with many JSDoc directives
   * caused excessive file operations (N methods × operations per method).
   * Now: 1 file read + 1 parse = all methods resolved with YAML metadata
   */
  async resolveAllMethodsForClass(
    config: Omit<HierarchyConfig, 'methodName'>
  ): Promise<Record<string, ResolvedMetadata | null>> {
    const { packageName, className, format = 'jsdoc' } = config;

    console.log(
      `[hierarchical-resolver] BATCH resolveAllMethodsForClass for ${packageName}/${className}`
    );

    // Log cache statistics for performance monitoring
    const initialStats = this.fileCache.getStats();
    console.log(`[hierarchical-resolver] BATCH - Cache stats before resolution:`, initialStats);

    // Collect base metadata sources (global, package, class) - these are shared for all methods
    const baseSources = await this.collectBaseMetadataSources(packageName, className);
    console.log(
      `[hierarchical-resolver] BATCH - Found ${baseSources.length} base metadata sources`
    );

    // Get all methods from class file AT ONCE
    const allMethodsMetadata = await this.loadAllMethodsMetadata(packageName, className);
    console.log(
      `[hierarchical-resolver] BATCH - Found ${Object.keys(allMethodsMetadata).length} methods in class`
    );

    const results: Record<string, ResolvedMetadata | null> = {};

    // Process each method with shared base sources
    for (const [methodName, methodMetadata] of Object.entries(allMethodsMetadata)) {
      const sources = [...baseSources];

      // Add method-specific metadata if exists
      if (methodMetadata) {
        sources.push({
          level: MetadataLevel.METHOD,
          filePath: `docs/examples/domain/${packageName}/${className}/${methodName}.yaml`,
          metadata: methodMetadata.metadata,
          strategy: methodMetadata.strategy,
        });
      }

      // Apply hierarchical resolution
      const baseMetadata = MetadataResolutionStrategies.applyHierarchy(sources);

      // Apply format-specific overrides
      const result = FormatSpecificResolver.resolveForFormat(baseMetadata, format);
      results[methodName] = result;
    }

    // Log final cache statistics
    const finalStats = this.fileCache.getStats();
    console.log(`[hierarchical-resolver] BATCH - Cache stats after resolution:`, finalStats);
    console.log(
      `[hierarchical-resolver] BATCH - Memory usage: ${this.fileCache.getMemoryUsage()} bytes`
    );
    console.log(
      `[hierarchical-resolver] BATCH - Processed ${Object.keys(results).length} methods in one operation`
    );

    return results;
  }

  /**
   * Resolve metadata for specific method with hierarchy
   */
  async resolveForMethod(config: HierarchyConfig): Promise<ResolvedMetadata | null> {
    const { packageName, className, methodName, format = 'jsdoc' } = config;

    console.log(`[hierarchical-resolver] resolveForMethod called with config:`, config);

    // Log cache statistics for performance monitoring
    const initialStats = this.fileCache.getStats();
    console.log(`[hierarchical-resolver] Cache stats before resolution:`, initialStats);

    // Collect all metadata sources (sorted by level)
    const sources = await this.collectMetadataSources(packageName, className, methodName);

    console.log(`[hierarchical-resolver] Found ${sources.length} metadata sources`);

    // If no sources found, return null
    if (sources.length === 0) {
      console.log(`[hierarchical-resolver] No metadata sources found, returning null`);
      return null;
    }

    // Apply hierarchical resolution
    const baseMetadata = MetadataResolutionStrategies.applyHierarchy(sources);

    console.log(
      `[hierarchical-resolver] Base metadata after hierarchy:`,
      Object.keys(baseMetadata)
    );

    // Apply format-specific overrides
    const result = FormatSpecificResolver.resolveForFormat(baseMetadata, format);

    console.log(
      `[hierarchical-resolver] Final result after format resolution:`,
      Object.keys(result)
    );

    // Log final cache statistics
    const finalStats = this.fileCache.getStats();
    console.log(`[hierarchical-resolver] Cache stats after resolution:`, finalStats);
    console.log(`[hierarchical-resolver] Memory usage: ${this.fileCache.getMemoryUsage()} bytes`);

    return result;
  }

  private async collectMetadataSources(
    packageName: string,
    className: string,
    methodName: string
  ): Promise<MetadataSource[]> {
    console.log(
      `[hierarchical-resolver] Collecting metadata sources for: ${packageName}/${className}/${methodName}`
    );
    console.log(`[hierarchical-resolver] Base directory: ${this.baseDir}`);

    const sources: MetadataSource[] = [];

    // Level 0: Global settings
    const globalSettings = await this.loadGlobalSettings();
    if (globalSettings) {
      sources.push({
        level: MetadataLevel.GLOBAL,
        filePath: 'docs/global-settings.yaml',
        metadata: globalSettings.metadata,
        strategy: globalSettings.strategy,
      });
    }

    // Level 1: Package settings
    const packageSettings = await this.loadPackageSettings(packageName);
    if (packageSettings) {
      sources.push({
        level: MetadataLevel.PACKAGE,
        filePath: `packages/${packageName}/.md-settings.yaml`,
        metadata: packageSettings.metadata,
        strategy: packageSettings.strategy,
      });
    }

    // Level 2: Class metadata
    const classMetadata = await this.loadClassMetadata(packageName, className);
    if (classMetadata) {
      sources.push({
        level: MetadataLevel.CLASS,
        filePath: `docs/examples/domain/${packageName}/${className}.yaml`,
        metadata: classMetadata.metadata,
        strategy: classMetadata.strategy,
      });
    }

    // Level 3: Method metadata (highest priority)
    const methodMetadata = await this.loadMethodMetadata(packageName, className, methodName);
    if (methodMetadata) {
      sources.push({
        level: MetadataLevel.METHOD,
        filePath: `docs/examples/domain/${packageName}/${className}/${methodName}.yaml`,
        metadata: methodMetadata.metadata,
        strategy: methodMetadata.strategy,
      });
    }

    return sources.sort((a, b) => a.level - b.level);
  }

  /**
   * Collect base metadata sources (global, package, class) - shared for all methods
   */
  private async collectBaseMetadataSources(
    packageName: string,
    className: string
  ): Promise<MetadataSource[]> {
    const sources: MetadataSource[] = [];

    // Level 0: Global settings
    const globalSettings = await this.loadGlobalSettings();
    if (globalSettings) {
      sources.push({
        level: MetadataLevel.GLOBAL,
        filePath: 'docs/global-settings.yaml',
        metadata: globalSettings.metadata,
        strategy: globalSettings.strategy,
      });
    }

    // Level 1: Package settings
    const packageSettings = await this.loadPackageSettings(packageName);
    if (packageSettings) {
      sources.push({
        level: MetadataLevel.PACKAGE,
        filePath: `packages/${packageName}/.md-settings.yaml`,
        metadata: packageSettings.metadata,
        strategy: packageSettings.strategy,
      });
    }

    // Level 2: Class metadata
    const classMetadata = await this.loadClassMetadata(packageName, className);
    if (classMetadata) {
      sources.push({
        level: MetadataLevel.CLASS,
        filePath: `docs/examples/domain/${packageName}/${className}.yaml`,
        metadata: classMetadata.metadata,
        strategy: classMetadata.strategy,
      });
    }

    return sources.sort((a, b) => a.level - b.level);
  }

  /**
   * Load ALL methods metadata from class file at once - KEY OPTIMIZATION
   * Instead of reading file 13 times for 13 methods, read ONCE and parse all methods
   */
  private async loadAllMethodsMetadata(
    packageName: string,
    className: string
  ): Promise<Record<string, MetadataParseResult>> {
    console.log(
      `[hierarchical-resolver] BATCH - Loading all methods from YAML class metadata for ${packageName}/${className}`
    );

    try {
      // Load class metadata from YAML file
      const classMetadata = await this.loadClassMetadata(packageName, className);
      if (!classMetadata) {
        console.log(`[hierarchical-resolver] BATCH - No class metadata found for ${className}`);
        return {};
      }

      const results: Record<string, MetadataParseResult> = {};

      // Extract method data from YAML structure
      if (classMetadata.metadata && typeof classMetadata.metadata === 'object') {
        const metadata = classMetadata.metadata as Record<string, unknown>;

        // Look for classes section in YAML
        if (metadata.classes && typeof metadata.classes === 'object') {
          const classesData = metadata.classes as Record<string, unknown>;

          // Find the specific class in the classes section
          for (const [yamlClassName, classData] of Object.entries(classesData)) {
            if (typeof classData === 'object' && classData !== null) {
              const classInfo = classData as Record<string, unknown>;

              // Extract methods from this class
              if (classInfo.methods && typeof classInfo.methods === 'object') {
                const methodsData = classInfo.methods as Record<string, unknown>;

                for (const [methodName, methodData] of Object.entries(methodsData)) {
                  if (typeof methodData === 'object' && methodData !== null) {
                    const methodInfo = methodData as Record<string, unknown>;

                    // Convert YAML method data to MetadataParseResult format
                    const methodMetadata: Record<string, unknown> = {};

                    // Copy basic fields
                    if (methodInfo.description) methodMetadata.description = methodInfo.description;
                    if (methodInfo.businessContext)
                      methodMetadata.businessContext = methodInfo.businessContext;
                    if (methodInfo.parameters) methodMetadata.parameters = methodInfo.parameters;
                    if (methodInfo.returns) methodMetadata.returns = methodInfo.returns;
                    if (methodInfo.customTags) methodMetadata.customTags = methodInfo.customTags;

                    // Handle examples array - preserve full structure with id and code
                    if (methodInfo.examples && Array.isArray(methodInfo.examples)) {
                      const examples: Array<{ id?: string; code: string }> = [];
                      for (const example of methodInfo.examples) {
                        if (typeof example === 'object' && example !== null) {
                          const exampleData = example as Record<string, unknown>;
                          if (exampleData.code && typeof exampleData.code === 'string') {
                            const exampleObj: { id?: string; code: string } = {
                              code: exampleData.code,
                            };
                            if (exampleData.id && typeof exampleData.id === 'string') {
                              exampleObj.id = exampleData.id;
                            }
                            examples.push(exampleObj);
                          }
                        }
                      }
                      methodMetadata.examples = examples;
                    }

                    // Handle hierarchy configuration
                    let strategy: ResolutionStrategy = 'merge';
                    if (methodInfo.hierarchy && typeof methodInfo.hierarchy === 'object') {
                      const hierarchyData = methodInfo.hierarchy as Record<string, unknown>;
                      if (hierarchyData.strategy && typeof hierarchyData.strategy === 'string') {
                        strategy = hierarchyData.strategy as ResolutionStrategy;
                      }
                    }

                    results[methodName] = {
                      metadata: methodMetadata,
                      strategy,
                    };

                    console.log(
                      `[hierarchical-resolver] BATCH - Extracted method ${methodName} from YAML with ${methodMetadata.examples ? (methodMetadata.examples as string[]).length : 0} examples`
                    );
                  }
                }
              }
            }
          }
        }
      }

      console.log(
        `[hierarchical-resolver] BATCH - Extracted ${Object.keys(results).length} methods from YAML class metadata`
      );
      return results;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(
        `[hierarchical-resolver] BATCH - Error loading methods from YAML: ${errorMessage}`
      );
      return {};
    }
  }

  private async loadGlobalSettings(): Promise<MetadataParseResult | null> {
    const filePath = path.join(this.baseDir, 'docs', 'global-settings.yaml');
    return this.parseMetadataFile(filePath);
  }

  private async loadPackageSettings(packageName: string): Promise<MetadataParseResult | null> {
    const filePath = path.join(this.baseDir, 'packages', packageName, '.md-settings.yaml');
    return this.parseMetadataFile(filePath);
  }

  private async loadClassMetadata(
    packageName: string,
    className: string
  ): Promise<MetadataParseResult | null> {
    // Convert class name to lowercase kebab-case for YAML files
    const yamlFileName = className
      .toLowerCase()
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();
    const filePath = path.join(
      this.baseDir,
      'docs',
      'examples',
      'domain',
      packageName,
      `${yamlFileName}.yaml`
    );
    return this.parseMetadataFile(filePath);
  }

  private async loadMethodMetadata(
    packageName: string,
    className: string,
    methodName: string
  ): Promise<MetadataParseResult | null> {
    console.log(
      `[hierarchical-resolver] Loading YAML method metadata for ${packageName}/${className}/${methodName}`
    );

    try {
      // Load class metadata from YAML file
      const classMetadata = await this.loadClassMetadata(packageName, className);
      if (!classMetadata) {
        console.log(`[hierarchical-resolver] No class metadata found for ${className}`);
        return null;
      }

      // Extract method data from YAML structure
      if (classMetadata.metadata && typeof classMetadata.metadata === 'object') {
        const metadata = classMetadata.metadata as Record<string, unknown>;

        // Look for classes section in YAML
        if (metadata.classes && typeof metadata.classes === 'object') {
          const classesData = metadata.classes as Record<string, unknown>;

          // Find the specific class in the classes section
          for (const [yamlClassName, classData] of Object.entries(classesData)) {
            if (typeof classData === 'object' && classData !== null) {
              const classInfo = classData as Record<string, unknown>;

              // Extract methods from this class
              if (classInfo.methods && typeof classInfo.methods === 'object') {
                const methodsData = classInfo.methods as Record<string, unknown>;

                // Find the specific method
                if (methodsData[methodName] && typeof methodsData[methodName] === 'object') {
                  const methodData = methodsData[methodName] as Record<string, unknown>;

                  // Convert YAML method data to MetadataParseResult format
                  const methodMetadata: Record<string, unknown> = {};

                  // Copy basic fields
                  if (methodData.description) methodMetadata.description = methodData.description;
                  if (methodData.businessContext)
                    methodMetadata.businessContext = methodData.businessContext;
                  if (methodData.parameters) methodMetadata.parameters = methodData.parameters;
                  if (methodData.returns) methodMetadata.returns = methodData.returns;
                  if (methodData.customTags) methodMetadata.customTags = methodData.customTags;

                  // Handle examples array - preserve full structure with id and code
                  if (methodData.examples && Array.isArray(methodData.examples)) {
                    const examples: Array<{ id?: string; code: string }> = [];
                    for (const example of methodData.examples) {
                      if (typeof example === 'object' && example !== null) {
                        const exampleData = example as Record<string, unknown>;
                        if (exampleData.code && typeof exampleData.code === 'string') {
                          const exampleObj: { id?: string; code: string } = {
                            code: exampleData.code,
                          };
                          if (exampleData.id && typeof exampleData.id === 'string') {
                            exampleObj.id = exampleData.id;
                          }
                          examples.push(exampleObj);
                        }
                      }
                    }
                    methodMetadata.examples = examples;
                  }

                  // Handle hierarchy configuration
                  let strategy: ResolutionStrategy = 'merge';
                  if (methodData.hierarchy && typeof methodData.hierarchy === 'object') {
                    const hierarchyData = methodData.hierarchy as Record<string, unknown>;
                    if (hierarchyData.strategy && typeof hierarchyData.strategy === 'string') {
                      strategy = hierarchyData.strategy as ResolutionStrategy;
                    }
                  }

                  console.log(
                    `[hierarchical-resolver] Found YAML method metadata for ${methodName}:`,
                    Object.keys(methodMetadata)
                  );

                  return {
                    metadata: methodMetadata,
                    strategy,
                  };
                }
              }
            }
          }
        }
      }

      console.log(
        `[hierarchical-resolver] No method metadata found for ${methodName} in YAML structure`
      );
      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`[hierarchical-resolver] Error loading YAML method metadata: ${errorMessage}`);
      return null;
    }
  }

  private async parseMetadataFile(filePath: string): Promise<MetadataParseResult | null> {
    try {
      // Use FileCache for cached file parsing
      return await this.fileCache.getParsedMetadata(filePath, content =>
        this.parseMetadata(content)
      );
    } catch (_error) {
      // File doesn't exist or can't be read - this is OK for hierarchical system
      console.log(
        `[hierarchical-resolver] Failed to parse metadata file ${filePath}, using fallback`
      );
      return null;
    }
  }

  private parseMetadata(content: string): MetadataParseResult {
    const metadata: Record<string, unknown> = {};
    let strategy: ResolutionStrategy = 'merge'; // default

    try {
      // Try parsing as YAML first
      const yamlData = yaml.load(content) as Record<string, unknown>;
      if (yamlData && typeof yamlData === 'object') {
        console.log(`[hierarchical-resolver] Parsing as YAML file`);

        for (const [key, value] of Object.entries(yamlData)) {
          if (key === 'strategy' && typeof value === 'string') {
            strategy = value as ResolutionStrategy;
          } else if (key && value !== undefined) {
            // Convert hyphenated keys to camelCase for consistency with adapter expectations
            const normalizedKey = this.convertToCamelCase(key);
            metadata[normalizedKey] = typeof value === 'string' ? value.trim() : value;
            console.log(
              `[hierarchical-resolver] Extracted YAML metadata: ${key} -> ${normalizedKey} = ${String(value).trim()}`
            );
          }
        }

        console.log(
          `[hierarchical-resolver] Found YAML metadata with ${Object.keys(metadata).length} keys: ${Object.keys(metadata).join(', ')}`
        );
        return { metadata, strategy };
      }
    } catch (yamlError) {
      console.log(
        `[hierarchical-resolver] Failed to parse as YAML, trying @ tags format:`,
        (yamlError as Error).message
      );
    }

    // Fallback to @ tags format (for .md files and legacy format)
    const metadataRegex = /@([\w-]+(?:\.[\w-]+)?)\s*:\s*(.+)/gm;
    let match;

    while ((match = metadataRegex.exec(content)) !== null) {
      const [, key, value] = match;

      if (key === 'strategy' && value) {
        strategy = value.trim() as ResolutionStrategy;
      } else if (key && value) {
        // Convert hyphenated keys to camelCase for consistency with adapter expectations
        const normalizedKey = this.convertToCamelCase(key);
        metadata[normalizedKey] = value.trim();
        console.log(
          `[hierarchical-resolver] Extracted @ metadata: ${key} -> ${normalizedKey} = ${value.trim()}`
        );
      }
    }

    // CRITICAL FIX: Do NOT extract @extract blocks from entire content in parseMetadata
    // This was causing cross-contamination where method A would get examples from methods B, C, D
    // Examples should ONLY be extracted at the method level in parseMethodFromClassFile
    // This fixes the issue: "buildWithAllCapabilities ma kilka przykładów a w pliku md tylko 1"
    console.log(
      `[hierarchical-resolver] FIXED: Not extracting examples from entire content to prevent cross-contamination`
    );

    // Log what we found
    if (Object.keys(metadata).length > 0) {
      console.log(
        `[hierarchical-resolver] Found metadata with ${Object.keys(metadata).length} keys: ${Object.keys(metadata).join(', ')}`
      );
    } else {
      console.log(`[hierarchical-resolver] No metadata found, trying markdown fallback parsing`);
      this.parseMarkdownSections(content, metadata);
    }

    return { metadata, strategy };
  }

  /**
   * Convert hyphenated keys to camelCase for consistency
   */
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

  /**
   * Fallback parser for standard markdown sections (backward compatibility)
   */
  private parseMarkdownSections(content: string, metadata: Record<string, unknown>): void {
    // Parse ## Description section
    const descriptionMatch = content.match(/## Description\s*\n\n([\s\S]*?)(?=\n##|$)/);
    if (descriptionMatch) {
      metadata.description = descriptionMatch?.[1]?.trim();
      console.log(`[hierarchical-resolver] Extracted description from markdown section`);
    }

    // Parse ## Business Context section
    const businessContextMatch = content.match(/## Business Context\s*\n\n([\s\S]*?)(?=\n##|$)/);
    if (businessContextMatch) {
      metadata.businessContext = businessContextMatch?.[1]?.trim();
      console.log(`[hierarchical-resolver] Extracted business context from markdown section`);
    }

    // Parse Code Example section and extract TypeScript examples
    const codeExampleMatch = content.match(/## Code Example\s*\n\n```typescript\n([\s\S]*?)```/);
    if (codeExampleMatch) {
      metadata.examples = [codeExampleMatch?.[1]?.trim()];
      console.log(`[hierarchical-resolver] Extracted example from markdown code block`);
    }

    // Set default values for other fields
    metadata.author = 'DDD Team';
    metadata.since = '1.0.0';
    metadata.tags = [];
    metadata.warnings = [];
  }

  /**
   * Parse method-specific metadata from class file
   */
  private parseMethodFromClassFile(
    content: string,
    methodName: string
  ): MetadataParseResult | null {
    const metadata: Record<string, unknown> = {};
    let strategy: ResolutionStrategy = 'merge'; // default

    // Split content into sections by ### headers to avoid regex issues
    const sections = content.split(/(?=^###\s+)/m);

    // Find the section for this method
    const methodSection = sections.find(section => {
      const headerMatch = section.match(/^###\s+(\w+)/);
      return headerMatch && headerMatch[1] === methodName;
    });

    if (!methodSection) {
      console.log(`[hierarchical-resolver] No section found for method ${methodName}`);
      return null;
    }

    console.log(
      `[hierarchical-resolver] Found method section for ${methodName}, length: ${methodSection.length}`
    );

    // Extract metadata tags from method section
    // Updated regex to support hyphens in metadata keys (e.g., business-context)
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

    // Extract @extract blocks for examples from method section ONLY
    // This prevents cross-contamination between methods
    const examples: string[] = [];

    // Reset regex to avoid global state issues
    const extractRegex = new RegExp(EXTRACT_BLOCK_REGEX.source, EXTRACT_BLOCK_REGEX.flags);

    while ((match = extractRegex.exec(methodSection)) !== null) {
      const [, extractMethodName, domain, complexity, code] = match;

      // Only include examples that match this method or are generic
      if (extractMethodName === methodName || extractMethodName === 'generic') {
        if (code) {
          examples.push(code.trim());
          console.log(
            `[hierarchical-resolver] Extracted method-specific example for ${methodName}: ${extractMethodName}:${domain}:${complexity}`
          );
        }
      } else {
        console.log(
          `[hierarchical-resolver] Skipping non-matching example for ${methodName}: ${extractMethodName}:${domain}:${complexity}`
        );
      }
    }

    if (examples.length > 0) {
      metadata.examples = examples;
      strategy = 'replace'; // Use replace strategy when method has specific examples
      console.log(
        `[hierarchical-resolver] Found ${examples.length} method-specific examples for ${methodName}, using replace strategy`
      );
    } else {
      // Explicitly set empty examples to prevent inheritance from class level
      metadata.examples = [];
      console.log(
        `[hierarchical-resolver] No method-specific examples found for ${methodName}, setting empty array`
      );
    }

    console.log(
      `[hierarchical-resolver] Parsed ${Object.keys(metadata).length} metadata fields for ${methodName}`
    );

    return { metadata, strategy };
  }

  /**
   * BATCH OPTIMIZATION: Parse ALL methods from class file at once
   * This is the KEY performance optimization - instead of parsing file 13 times,
   * parse once and extract all methods
   */
  private parseAllMethodsFromClassFile(content: string): Record<string, MetadataParseResult> {
    const methods: Record<string, MetadataParseResult> = {};

    // Split content into sections by ### headers to find all methods
    const sections = content.split(/(?=^###\s+)/m);

    console.log(`[hierarchical-resolver] BATCH - Found ${sections.length} sections in class file`);

    for (const section of sections) {
      // Check if this section is a method section
      const headerMatch = section.match(/^###\s+(\w+)/);
      if (!headerMatch) continue;

      const methodName = headerMatch[1];
      if (!methodName) continue;

      console.log(`[hierarchical-resolver] BATCH - Processing method section: ${methodName}`);

      const metadata: Record<string, unknown> = {};
      let strategy: ResolutionStrategy = 'merge';

      // Extract metadata tags from method section
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

      // Extract @extract blocks for examples from method section ONLY
      // Reset regex to avoid global state issues
      const extractRegex = new RegExp(EXTRACT_BLOCK_REGEX.source, EXTRACT_BLOCK_REGEX.flags);
      const examples: string[] = [];

      while ((match = extractRegex.exec(section)) !== null) {
        const [, extractMethodName, domain, complexity, code] = match;

        // Only include examples that match this method or are generic
        if (extractMethodName === methodName || extractMethodName === 'generic') {
          if (code) {
            examples.push(code.trim());
            console.log(
              `[hierarchical-resolver] BATCH - Extracted example for ${methodName}: ${extractMethodName}:${domain}:${complexity}`
            );
          }
        }
      }

      if (examples.length > 0) {
        metadata.examples = examples;
        strategy = 'replace'; // Use replace strategy when method has specific examples
        console.log(
          `[hierarchical-resolver] BATCH - Found ${examples.length} examples for ${methodName}, using replace strategy`
        );
      } else {
        // Explicitly set empty examples to prevent inheritance from class level
        metadata.examples = [];
        console.log(
          `[hierarchical-resolver] BATCH - No examples found for ${methodName}, setting empty array`
        );
      }

      methods[methodName] = { metadata, strategy };
      console.log(
        `[hierarchical-resolver] BATCH - Completed processing method ${methodName} with ${Object.keys(metadata).length} metadata fields`
      );
    }

    console.log(
      `[hierarchical-resolver] BATCH - Finished parsing all methods: ${Object.keys(methods).join(', ')}`
    );
    return methods;
  }
}
