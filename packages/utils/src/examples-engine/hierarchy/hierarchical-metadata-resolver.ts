/**
 * Hierarchical Metadata Resolver for Enhanced Metadata System V2
 * Resolves metadata from multiple levels with inheritance strategies
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  MetadataLevel,
  type MetadataSource,
  type ResolvedMetadata,
  type HierarchyConfig,
  type MetadataParseResult,
  type ResolutionStrategy
} from './types';
import { MetadataResolutionStrategies } from './resolution-strategies';
import { FormatSpecificResolver } from './format-specific-resolver';

export class HierarchicalMetadataResolver {
  private metadataSources = new Map<string, MetadataSource[]>();
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  /**
   * Resolve metadata for specific method with hierarchy
   */
  async resolveForMethod(config: HierarchyConfig): Promise<ResolvedMetadata | null> {
    const { packageName, className, methodName, format = 'jsdoc' } = config;

    console.log(`[hierarchical-resolver] resolveForMethod called with config:`, config);

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

    console.log(`[hierarchical-resolver] Base metadata after hierarchy:`, Object.keys(baseMetadata));

    // Apply format-specific overrides
    const result = FormatSpecificResolver.resolveForFormat(baseMetadata, format);

    console.log(`[hierarchical-resolver] Final result after format resolution:`, Object.keys(result));

    return result;
  }

  private async collectMetadataSources(
    packageName: string,
    className: string,
    methodName: string
  ): Promise<MetadataSource[]> {
    console.log(`[hierarchical-resolver] Collecting metadata sources for: ${packageName}/${className}/${methodName}`);
    console.log(`[hierarchical-resolver] Base directory: ${this.baseDir}`);

    const sources: MetadataSource[] = [];

    // Level 0: Global settings
    const globalSettings = await this.loadGlobalSettings();
    if (globalSettings) {
      sources.push({
        level: MetadataLevel.GLOBAL,
        filePath: 'docs/global-settings.md',
        metadata: globalSettings.metadata,
        strategy: globalSettings.strategy
      });
    }

    // Level 1: Package settings
    const packageSettings = await this.loadPackageSettings(packageName);
    if (packageSettings) {
      sources.push({
        level: MetadataLevel.PACKAGE,
        filePath: `packages/${packageName}/.md-settings.md`,
        metadata: packageSettings.metadata,
        strategy: packageSettings.strategy
      });
    }

    // Level 2: Class metadata
    const classMetadata = await this.loadClassMetadata(packageName, className);
    if (classMetadata) {
      sources.push({
        level: MetadataLevel.CLASS,
        filePath: `docs/examples/domain/${packageName}/${className}.md`,
        metadata: classMetadata.metadata,
        strategy: classMetadata.strategy
      });
    }

    // Level 3: Method metadata (highest priority)
    const methodMetadata = await this.loadMethodMetadata(packageName, className, methodName);
    if (methodMetadata) {
      sources.push({
        level: MetadataLevel.METHOD,
        filePath: `docs/examples/domain/${packageName}/${className}/${methodName}.md`,
        metadata: methodMetadata.metadata,
        strategy: methodMetadata.strategy
      });
    }

    return sources.sort((a, b) => a.level - b.level);
  }

  private async loadGlobalSettings(): Promise<MetadataParseResult | null> {
    const filePath = path.join(this.baseDir, 'docs', 'global-settings.md');
    return this.parseMetadataFile(filePath);
  }

  private async loadPackageSettings(packageName: string): Promise<MetadataParseResult | null> {
    const filePath = path.join(this.baseDir, 'packages', packageName, '.md-settings.md');
    return this.parseMetadataFile(filePath);
  }

  private async loadClassMetadata(packageName: string, className: string): Promise<MetadataParseResult | null> {
    const filePath = path.join(this.baseDir, 'docs', 'examples', 'domain', packageName, `${className}.md`);
    return this.parseMetadataFile(filePath);
  }

  private async loadMethodMetadata(
    packageName: string,
    className: string,
    methodName: string
  ): Promise<MetadataParseResult | null> {
    // Method metadata is embedded in class metadata file, not separate files
    const classFilePath = path.join(
      this.baseDir,
      'docs',
      'examples',
      'domain',
      packageName,
      `${className}.md`
    );

    console.log(`[hierarchical-resolver] Looking for method metadata in class file: ${classFilePath}`);

    try {
      const content = await fs.readFile(classFilePath, 'utf-8');
      const methodMetadata = this.parseMethodFromClassFile(content, methodName);

      if (methodMetadata) {
        console.log(`[hierarchical-resolver] Found method metadata for ${methodName}:`, Object.keys(methodMetadata.metadata));
        return methodMetadata;
      } else {
        console.log(`[hierarchical-resolver] No method metadata found for ${methodName} in ${classFilePath}`);
        return null;
      }
    } catch (error: any) {
      console.log(`[hierarchical-resolver] Could not read class file ${classFilePath}:`, error['message']);
      return null;
    }
  }

  private async parseMetadataFile(filePath: string): Promise<MetadataParseResult | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseMetadata(content);
    } catch (error) {
      // File doesn't exist or can't be read - this is OK for hierarchical system
      return null;
    }
  }

  private parseMetadata(content: string): MetadataParseResult {
    const metadata: Record<string, any> = {};
    let strategy: ResolutionStrategy = 'merge'; // default

    // Extract metadata tags from ENTIRE content (not just global-settings)
    // Updated regex to support hyphens in metadata keys (e.g., business-context)
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
        console.log(`[hierarchical-resolver] Extracted V2 metadata: ${key} -> ${normalizedKey} = ${value.trim()}`);
      }
    }

    // Extract @extract blocks for examples (from the entire content)
    // Allow for optional whitespace/newlines between @extract and ```typescript
    const extractRegex = /@extract:\s*(\w+):(\w+):(\w+)\s*\n\s*```typescript\s*\n([\s\S]*?)```\s*\n@extract-end/g;
    const examples: string[] = [];

    while ((match = extractRegex.exec(content)) !== null) {
      if (match[4]) {
        examples.push(match[4].trim());
        console.log(`[hierarchical-resolver] Extracted example block: ${match[1]}:${match[2]}:${match[3]}`);
      }
    }

    if (examples.length > 0) {
      metadata.examples = examples;
    }

    // Log what we found
    if (Object.keys(metadata).length > 0) {
      console.log(`[hierarchical-resolver] Found V2 metadata with ${Object.keys(metadata).length} keys: ${Object.keys(metadata).join(', ')}`);
    } else {
      console.log(`[hierarchical-resolver] No V2 metadata found, trying markdown fallback parsing`);
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
      return `${this.toCamelCase(base!)}.${format}`;
    }
    
    return this.toCamelCase(key);
  }

  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Fallback parser for standard markdown sections (backward compatibility)
   */
  private parseMarkdownSections(content: string, metadata: Record<string, any>): void {
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
  private parseMethodFromClassFile(content: string, methodName: string): MetadataParseResult | null {
    const metadata: Record<string, any> = {};
    let strategy: ResolutionStrategy = 'merge'; // default

    // Look for method section in the class file
    // Pattern: ### methodName() - Description
    // Updated to only match until next method section (with parentheses) or major section heading
    const methodSectionRegex = new RegExp(`###\\s+${methodName}\\(\\)([\\s\\S]*?)(?=###\\s+\\w+\\(\\)|##\\s+[A-Z]|$)`, 'i');
    const methodMatch = content.match(methodSectionRegex);

    if (!methodMatch) {
      console.log(`[hierarchical-resolver] No section found for method ${methodName}`);
      return null;
    }

    const methodSection = methodMatch[1]!;
    console.log(`[hierarchical-resolver] Found method section for ${methodName}, length: ${methodSection.length}`);

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

    // Extract @extract blocks for examples from method section
    // Use the same regex pattern as in parseClassFile for consistency
    const extractRegex = /@extract:\s*(\w+):(\w+):(\w+)\s*\n\s*```typescript\s*\n([\s\S]*?)```\s*\n@extract-end/g;
    const examples: string[] = [];

    while ((match = extractRegex.exec(methodSection)) !== null) {
      const [, extractMethodName, domain, complexity, code] = match;
      
      // Only include examples that match this method or are generic
      if (extractMethodName === methodName || extractMethodName === 'generic') {
        if (code) {
          examples.push(code.trim());
          console.log(`[hierarchical-resolver] Extracted method-specific example for ${methodName}: ${extractMethodName}:${domain}:${complexity}`);
        }
      } else {
        console.log(`[hierarchical-resolver] Skipping non-matching example for ${methodName}: ${extractMethodName}:${domain}:${complexity}`);
      }
    }

    if (examples.length > 0) {
      metadata.examples = examples;
      strategy = 'replace'; // Use replace strategy when method has specific examples
      console.log(`[hierarchical-resolver] Found ${examples.length} method-specific examples for ${methodName}, using replace strategy`);
    } else {
      // Explicitly set empty examples to prevent inheritance from class level
      metadata.examples = [];
      console.log(`[hierarchical-resolver] No method-specific examples found for ${methodName}, setting empty array`);
    }

    console.log(`[hierarchical-resolver] Parsed ${Object.keys(metadata).length} metadata fields for ${methodName}`);

    return { metadata, strategy };
  }
}
