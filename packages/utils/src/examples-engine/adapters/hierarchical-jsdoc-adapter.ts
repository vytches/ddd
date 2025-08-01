/* eslint-disable no-case-declarations */
/**
 * Hierarchical JSDoc Adapter for Enhanced Metadata System V2
 * Integrates hierarchical metadata resolution with existing JSDoc processing
 */

import * as path from 'path';
import * as fs from 'fs';
import { HierarchicalMetadataResolver, FormatSpecificResolver } from '../hierarchy';
import { MultiLevelCache, PerformanceMonitor } from '../cache';
import type { ResolvedMetadata, HierarchyConfig } from '../hierarchy/types';

export class HierarchicalJSDocAdapter {
  private resolver: HierarchicalMetadataResolver;
  private cache: typeof MultiLevelCache;

  constructor() {
    // Find project root - go up from packages/utils to project root
    const projectRoot = this.findProjectRoot(process.cwd());
    console.log(`[hierarchical-adapter] Initializing resolver with project root: ${projectRoot}`);

    this.resolver = new HierarchicalMetadataResolver(projectRoot);
    this.cache = MultiLevelCache;
  }

  /**
   * Find project root by looking for package.json with monorepo indicators
   */
  private findProjectRoot(startDir: string): string {
    let currentDir = startDir;

    while (currentDir !== path.dirname(currentDir)) { // Until we reach filesystem root
      const packageJsonPath = path.join(currentDir, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          // Look for monorepo indicators or specific project name
          if (packageJson.workspaces || packageJson.name === '@vytches/ddd-monorepo' ||
              fs.existsSync(path.join(currentDir, 'packages')) ||
              fs.existsSync(path.join(currentDir, 'docs', 'examples'))) {
            console.log(`[hierarchical-adapter] Found project root at: ${currentDir}`);
            return currentDir;
          }
        } catch (error) {
          // Continue searching if we can't parse package.json
        }
      }

      currentDir = path.dirname(currentDir);
    }

    // Fallback to current working directory
    console.warn(`[hierarchical-adapter] Could not find project root, using: ${startDir}`);
    return startDir;
  }

  /**
   * Initialize the adapter (sets up cache)
   */
  async initialize(): Promise<void> {
    await this.cache.initialize();
  }

  /**
   * Process injection directives with hierarchical metadata
   */
  async processInjectionDirectives(code: string, filePath: string): Promise<string> {
    return PerformanceMonitor.benchmark('processInjectionDirectives', async () => {
      console.log(`[hierarchical-adapter] Processing file: ${filePath}`);

      // Extract package name from file path
      const packageName = this.extractPackageFromPath(filePath);

      // Find all injection directives
      const directives = this.findInjectionDirectives(code);
      console.log(`[hierarchical-adapter] Found ${directives.length} directives`);

      // Sort directives by position (descending) to process from end to beginning
      directives.sort((a, b) => b.position - a.position);

      let processedCode = code;

      // Track injected metadata per method to prevent duplicates
      const injectedPerMethod = new Map<string, Set<string>>();

      // Process each directive
      for (const directive of directives) {
        const result = await this.processDirective(
          processedCode,
          directive,
          packageName,
          filePath,
          injectedPerMethod
        );

        if (result) {
          processedCode = result;
        }
      }

      return processedCode;
    });
  }

  /**
   * Process a single directive
   */
  private async processDirective(
    code: string,
    directive: { position: number; directive: string; type: string },
    packageName: string,
    filePath: string,
    injectedPerMethod: Map<string, Set<string>>
  ): Promise<string | null> {
    // Check if this is a class or method directive
    const isClass = this.isClassDeclaration(code, directive.position);

    if (isClass) {
      return this.processClassDirective(code, directive, packageName, filePath);
    } else {
      return this.processMethodDirective(code, directive, packageName, filePath, injectedPerMethod);
    }
  }

  /**
   * Process class-level directive
   */
  private async processClassDirective(
    code: string,
    directive: { position: number; directive: string; type: string },
    packageName: string,
    filePath: string
  ): Promise<string | null> {
    const className = this.extractClassNameFromContext(code, directive.position);
    if (!className) return null;

    console.log(`[hierarchical-adapter] Processing class directive for ${className}`);

    // Use hierarchical resolver for class metadata
    const config: HierarchyConfig = {
      packageName,
      className: className.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
      methodName: '', // Empty for class-level
      format: 'jsdoc'
    };

    const metadata = await this.resolveWithCache(config);

    if (metadata) {
      console.log(`[hierarchical-adapter] Processing directive '${directive.type}' for ${className}`);
      console.log(`[hierarchical-adapter] Available metadata keys:`, Object.keys(metadata));

      // Handle directive type conversion (e.g., business-context -> businessContext)
      const metadataKey = this.convertDirectiveTypeToMetadataKey(directive.type);
      console.log(`[hierarchical-adapter] Looking for metadata key '${metadataKey}' (from directive '${directive.type}')`);

      if (metadata[metadataKey]) {
        console.log(`[hierarchical-adapter] Found metadata for '${metadataKey}':`, metadata[metadataKey]);
        const tagName = this.getJSDocTagName(directive.type);
        const replacementText = `${tagName} ${metadata[metadataKey]}`;
        return this.replaceDirective(code, directive, replacementText);
      } else {
        console.log(`[hierarchical-adapter] No metadata found for key '${metadataKey}'`);
      }
    } else {
      console.log(`[hierarchical-adapter] No metadata returned for ${className}`);
    }

    return null;
  }

  /**
   * Process method-level directive
   */
  private async processMethodDirective(
    code: string,
    directive: { position: number; directive: string; type: string },
    packageName: string,
    filePath: string,
    injectedPerMethod: Map<string, Set<string>>
  ): Promise<string | null> {
    const methodName = this.extractMethodNameFromContext(code, directive.position);
    if (!methodName) return null;

    console.log(`[hierarchical-adapter] Processing method directive for ${methodName}`);

    // Check for duplicates
    if (!injectedPerMethod.has(methodName)) {
      injectedPerMethod.set(methodName, new Set());
    }
    const injected = injectedPerMethod.get(methodName)!;

    if (injected.has(directive.type)) {
      console.log(`[hierarchical-adapter] Skipping duplicate ${directive.type} for ${methodName}`);
      return null;
    }

    // Extract class name for hierarchical resolution
    const className = this.extractClassNameFromPath(filePath);

    // Use hierarchical resolver
    const config: HierarchyConfig = {
      packageName,
      className,
      methodName,
      format: 'jsdoc'
    };

    const metadata = await this.resolveWithCache(config);

    if (metadata) {
      injected.add(directive.type);

      // Handle different directive types
      let replacementText = '';

      switch (directive.type) {
        case 'description':
          replacementText = metadata.description ? `@description ${metadata.description}` : '';
          break;
        case 'business-context':
          replacementText = metadata.businessContext ? `@businessContext ${metadata.businessContext}` : '';
          break;
        case 'example':
          if (metadata.examples && metadata.examples.length > 0) {
            replacementText = this.formatExamples(metadata.examples);
          }
          break;
        default:
          // Check if metadata has this field (support any custom fields)
          const metadataValue = this.findMetadataValue(metadata, directive.type);
          if (metadataValue !== undefined) {
            const tagName = this.getJSDocTagName(directive.type);

            // Handle different value types
            if (Array.isArray(metadataValue)) {
              replacementText = `${tagName} ${metadataValue.join(', ')}`;
            } else if (typeof metadataValue === 'object') {
              replacementText = `${tagName} ${JSON.stringify(metadataValue)}`;
            } else {
              replacementText = `${tagName} ${metadataValue}`;
            }
          }
      }

      if (replacementText) {
        return this.replaceDirective(code, directive, replacementText);
      }
    }

    return null;
  }

  /**
   * Resolve metadata with caching
   */
  private async resolveWithCache(config: HierarchyConfig): Promise<ResolvedMetadata | null> {
    const cacheKey = `${config.packageName}:${config.className}:${config.methodName}:${config.format}`;

    console.log(`[hierarchical-adapter] Resolving metadata for: ${cacheKey}`);

    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      console.log(`[hierarchical-adapter] Using cached metadata for: ${cacheKey}`);
      const parsedCache = JSON.parse(cached);
      console.log(`[hierarchical-adapter] Cached metadata content:`, parsedCache);
      return parsedCache;
    }

    console.log(`[hierarchical-adapter] No cache hit for: ${cacheKey}, proceeding to resolve...`);

    // Resolve metadata
    console.log(`[hierarchical-adapter] Calling resolver.resolveForMethod with config:`, config);
    const metadata = await this.resolver.resolveForMethod(config);

    if (metadata) {
      console.log(`[hierarchical-adapter] Resolver returned metadata with keys:`, Object.keys(metadata));
    } else {
      console.log(`[hierarchical-adapter] Resolver returned null for config:`, config);
    }

    // Cache result
    await this.cache.set(cacheKey, JSON.stringify(metadata));

    return metadata;
  }

  /**
   * Replace directive in code
   */
  private replaceDirective(
    code: string,
    directive: { position: number; directive: string; type: string },
    replacementText: string
  ): string {
    const beforeDirective = code.substring(0, directive.position);
    const afterDirective = code.substring(directive.position);

    // Find the end of directive line
    const lineEnd = afterDirective.indexOf('\n');
    const hasNewline = lineEnd !== -1;

    // Extract the line containing the directive
    const directiveLine = hasNewline ? afterDirective.substring(0, lineEnd) : afterDirective;
    const remainingCode = hasNewline ? afterDirective.substring(lineEnd + 1) : '';

    // Extract indentation from the line
    const indentMatch = directiveLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';

    // Build replacement with proper indentation
    const replacement = indent + replacementText;

    return beforeDirective + replacement + (hasNewline ? `\n${  remainingCode}` : '');
  }

  /**
   * Format examples for JSDoc
   */
  private formatExamples(examples: string[]): string {
    const lines: string[] = [];

    examples.forEach((example, index) => {
      if (examples.length > 1 && index > 0) {
        lines.push('   *');
      }
      lines.push('   * @example');
      lines.push('   * ```typescript');

      const exampleLines = example.split('\n');
      exampleLines.forEach(line => {
        lines.push(`   * ${  line}`);
      });

      lines.push('   * ```');
    });

    return lines.join('\n');
  }

  /**
   * Extract package name from file path
   */
  private extractPackageFromPath(filePath: string): string {
    // Match both src and dist directories
    const match = filePath.match(/packages\/([^/]+)\/(src|dist)/);
    return match?.[1] ?? 'unknown';
  }

  /**
   * Extract class name from file path
   */
  private extractClassNameFromPath(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    // Remove .d.ts or .ts extension
    const baseName = fileName.replace(/\.d\.ts$|\.ts$/, '');
    
    // Special mappings for class names that don't match file names
    const classNameMappings: Record<string, string> = {
      'aggregate-root.builder': 'aggregate-builder',
      'aggregate-root': 'aggregate-root'
    };
    
    const normalizedName = baseName.toLowerCase();
    return classNameMappings[normalizedName] || normalizedName;
  }

  /**
   * Find all injection directives
   */
  private findInjectionDirectives(code: string): Array<{ position: number; directive: string; type: string }> {
    const directives: Array<{ position: number; directive: string; type: string }> = [];
    const pattern = /@([\w-]+)-inject/g;

    let match;
    while ((match = pattern.exec(code)) !== null) {
      if (match[1]) {
        directives.push({
          position: match.index,
          directive: match[0],
          type: match[1]
        });
      }
    }

    return directives;
  }

  /**
   * Check if directive is for a class
   */
  private isClassDeclaration(code: string, position: number): boolean {
    const afterPosition = code.substring(position);
    const jsDocEndMatch = afterPosition.match(/\*\/\s*/);

    if (!jsDocEndMatch) return false;

    const afterJSDoc = afterPosition.substring((jsDocEndMatch.index || 0) + jsDocEndMatch[0].length);
    const limitedSearch = afterJSDoc.substring(0, 100);

    return /(?:export\s+)?class\s+\w+/.test(limitedSearch);
  }

  /**
   * Extract class name from context
   */
  private extractClassNameFromContext(code: string, position: number): string | null {
    const afterPosition = code.substring(position);
    const jsDocEndMatch = afterPosition.match(/\*\/\s*/);

    if (!jsDocEndMatch) return null;

    const afterJSDoc = afterPosition.substring((jsDocEndMatch.index || 0) + jsDocEndMatch[0].length);
    const match = afterJSDoc.match(/(?:export\s+)?class\s+(\w+)/);

    return match?.[1] ?? null;
  }

  /**
   * Extract method name from context
   */
  private extractMethodNameFromContext(code: string, position: number): string | null {
    const afterPosition = code.substring(position);
    const jsDocEndMatch = afterPosition.match(/\*\/\s*/);

    if (!jsDocEndMatch) return null;

    const afterJSDoc = afterPosition.substring((jsDocEndMatch.index || 0) + jsDocEndMatch[0].length);
    const limitedSearch = afterJSDoc.substring(0, 200);

    // Try various method patterns
    const patterns = [
      /(\w+)\?\s*\([^)]*\)\s*:\s*\w+/,    // method?(): ReturnType (optional method)
      /(\w+)\s*\([^)]*\)\s*:\s*\w+\s*\{/,  // method(): ReturnType {
      /(\w+)\s*\([^)]*\)\s*\{/,           // method() {
      /static\s+(\w+)\s*\(/,              // static method(
      /async\s+(\w+)\s*\(/,               // async method(
      /(\w+)\s*\(/                        // method(
    ];

    for (const pattern of patterns) {
      const match = limitedSearch.match(pattern);
      if (match && match[1] && match[1] !== 'constructor') {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Find metadata value supporting various key formats
   */
  private findMetadataValue(metadata: ResolvedMetadata, key: string): any {
    // Try exact key first
    if (metadata[key] !== undefined) {
      return metadata[key];
    }

    // Try camelCase conversion
    const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (metadata[camelKey] !== undefined) {
      return metadata[camelKey];
    }

    // Try kebab-case conversion
    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (metadata[kebabKey] !== undefined) {
      return metadata[kebabKey];
    }

    return undefined;
  }

  /**
   * Convert directive type to metadata key
   */
  private convertDirectiveTypeToMetadataKey(directiveType: string): string {
    const conversions: Record<string, string> = {
      'business-context': 'businessContext',
      'llm-summary': 'llmSummary',
      'llm-domain': 'llmDomain'
    };

    return conversions[directiveType] || directiveType;
  }

  /**
   * Map metadata keys to JSDoc tags
   */
  private getJSDocTagName(key: string): string {
    // Standard mappings
    const mapping: Record<string, string> = {
      'description': '@description',
      'business-context': '@businessContext',
      'businessContext': '@businessContext',
      'author': '@author',
      'since': '@since',
      'warning': '@warning',
      'deprecated': '@deprecated',
      'see': '@see',
      'todo': '@todo',
      'note': '@note',
      'license': '@license',
      'complexity': '@complexity',
      'performance': '@performance'
    };

    // If we have a specific mapping, use it
    if (mapping[key]) {
      return mapping[key];
    }

    // For custom keys, format them nicely
    // If already starts with @, return as-is
    if (key.startsWith('@')) {
      return key;
    }

    // Convert camelCase to kebab-case and add @
    const kebabCase = key
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase();

    return `@${kebabCase}`;
  }
}
