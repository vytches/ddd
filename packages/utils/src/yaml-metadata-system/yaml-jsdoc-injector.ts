/**
 * YAML Front Matter JSDoc Injection System V2
 * Flexible, hierarchical, environment-aware metadata injection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';

export interface YamlMetadata {
  [key: string]: any;
  hierarchy?: {
    strategy: 'merge' | 'replace' | 'append';
    scope: string;
  };
  formats?: {
    jsdoc?: Record<string, any>;
    cli?: Record<string, any>;
  };
  methods?: Record<string, any>;
  environment?: Record<string, any>;
  'custom-tags'?: Record<string, string>;
}

export interface ProcessedMetadata {
  jsdocTags: Record<string, string>;
  examples: Array<{ id: string; code: string; complexity: string }>;
  customTags: Record<string, string>;
}

export class YamlJSDocInjector {
  private globalMetadata: YamlMetadata | null = null;
  private packageMetadata: Map<string, YamlMetadata> = new Map();
  private classMetadata: Map<string, YamlMetadata> = new Map();
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  /**
   * Process .d.ts file and inject metadata from YAML sources
   */
  async processFile(dtsPath: string): Promise<string> {
    console.log(`[yaml-injector] Processing file: ${dtsPath}`);

    let content = await fs.readFile(dtsPath, 'utf-8');
    
    // Extract package name from file path
    const packageName = this.extractPackageFromPath(dtsPath);
    const className = this.extractClassNameFromPath(dtsPath);
    
    // Load hierarchical metadata
    await this.loadHierarchicalMetadata(packageName, className);

    // Find all injection directives
    const directives = this.findAllDirectives(content);
    console.log(`[yaml-injector] Found ${directives.length} directives`);

    // Process directives from end to beginning to maintain positions
    directives.sort((a, b) => b.position - a.position);

    for (const directive of directives) {
      const replacement = await this.processDirective(directive, packageName, className);
      if (replacement) {
        content = this.replaceDirective(content, directive, replacement);
      }
    }

    return content;
  }

  /**
   * Load hierarchical metadata: global → package → class
   */
  private async loadHierarchicalMetadata(packageName: string, className: string): Promise<void> {
    // 1. Load global metadata
    if (!this.globalMetadata) {
      this.globalMetadata = await this.loadYamlFile(
        path.join(this.baseDir, 'docs', 'global-settings.yaml')
      );
    }

    // 2. Load package metadata
    if (!this.packageMetadata.has(packageName)) {
      const packageMeta = await this.loadYamlFile(
        path.join(this.baseDir, 'packages', packageName, '.md-settings.yaml')
      );
      if (packageMeta) {
        this.packageMetadata.set(packageName, packageMeta);
      }
    }

    // 3. Load class metadata
    const classKey = `${packageName}:${className}`;
    if (!this.classMetadata.has(classKey)) {
      const classMeta = await this.loadYamlFile(
        path.join(this.baseDir, 'docs', 'examples', 'domain', packageName, `${className}.yaml`)
      );
      if (classMeta) {
        this.classMetadata.set(classKey, classMeta);
      }
    }
  }

  /**
   * Load YAML file and parse front matter
   */
  private async loadYamlFile(filePath: string): Promise<YamlMetadata | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Handle pure YAML files (without front matter delimiters)
      if (!content.startsWith('---')) {
        // Pure YAML file
        const yamlContent = `---\n${content}\n---\n`;
        const parsed = matter(yamlContent);
        return parsed.data;
      } else {
        // YAML front matter file
        const parsed = matter(content);
        return parsed.data;
      }
    } catch (error) {
      console.log(`[yaml-injector] Could not load ${filePath}: ${error}`);
      return null;
    }
  }

  /**
   * Find all injection directives in content
   */
  private findAllDirectives(content: string): Array<{
    position: number;
    fullMatch: string;
    type: string;
    methodName?: string;
    customParam?: string;
  }> {
    const directives: Array<any> = [];
    
    // Standard metadata injection: @metadata-inject:methodName
    const metadataRegex = /@metadata-inject:(\w+)/g;
    let match;
    while ((match = metadataRegex.exec(content)) !== null) {
      directives.push({
        position: match.index,
        fullMatch: match[0],
        type: 'metadata',
        methodName: match[1]
      });
    }

    // Custom injection: @custom-inject:methodName:customParam
    const customRegex = /@custom-inject:(\w+):(\w+)/g;
    while ((match = customRegex.exec(content)) !== null) {
      directives.push({
        position: match.index,
        fullMatch: match[0],
        type: 'custom',
        methodName: match[1],
        customParam: match[2]
      });
    }

    // Environment injection: @env-inject:methodName:ENV_VAR
    const envRegex = /@env-inject:(\w+):([A-Z_]+)/g;
    while ((match = envRegex.exec(content)) !== null) {
      directives.push({
        position: match.index,
        fullMatch: match[0],
        type: 'environment',
        methodName: match[1],
        customParam: match[2]
      });
    }

    return directives;
  }

  /**
   * Process single directive and generate JSDoc content
   */
  private async processDirective(
    directive: any,
    packageName: string,
    className: string
  ): Promise<string | null> {
    try {
      const resolvedMetadata = this.resolveHierarchicalMetadata(
        packageName,
        className,
        directive.methodName
      );

      switch (directive.type) {
        case 'metadata':
          return this.buildStandardJSDoc(resolvedMetadata, directive.methodName);
        
        case 'custom':
          return this.buildCustomJSDoc(resolvedMetadata, directive.methodName, directive.customParam);
        
        case 'environment':
          return this.buildEnvironmentJSDoc(resolvedMetadata, directive.methodName, directive.customParam);
        
        default:
          console.warn(`[yaml-injector] Unknown directive type: ${directive.type}`);
          return null;
      }
    } catch (error) {
      console.error(`[yaml-injector] Error processing directive:`, error);
      return null;
    }
  }

  /**
   * Resolve hierarchical metadata with merge strategies
   */
  private resolveHierarchicalMetadata(
    packageName: string,
    className: string,
    methodName?: string
  ): ProcessedMetadata {
    const resolved: any = {};

    // Start with global metadata
    if (this.globalMetadata) {
      this.mergeMetadata(resolved, this.globalMetadata);
    }

    // Merge package metadata
    const packageMeta = this.packageMetadata.get(packageName);
    if (packageMeta) {
      this.mergeMetadata(resolved, packageMeta);
    }

    // Merge class metadata
    const classKey = `${packageName}:${className}`;
    const classMeta = this.classMetadata.get(classKey);
    if (classMeta) {
      this.mergeMetadata(resolved, classMeta);
    }

    // Merge method-specific metadata
    if (methodName && classMeta?.methods?.[methodName]) {
      this.mergeMetadata(resolved, classMeta.methods[methodName]);
    }

    // Apply environment-specific metadata
    this.applyEnvironmentMetadata(resolved, methodName);

    return this.processResolvedMetadata(resolved);
  }

  /**
   * Merge metadata based on hierarchy strategy
   */
  private mergeMetadata(target: any, source: any): void {
    const strategy = source.hierarchy?.strategy || 'merge';

    switch (strategy) {
      case 'replace':
        Object.assign(target, source);
        break;
      
      case 'append':
        Object.keys(source).forEach(key => {
          if (typeof source[key] === 'string' && target[key]) {
            target[key] = `${target[key]}\n${source[key]}`;
          } else {
            target[key] = source[key];
          }
        });
        break;
      
      case 'merge':
      default:
        this.deepMerge(target, source);
        break;
    }
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): void {
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
  }

  /**
   * Apply environment-specific metadata
   */
  private applyEnvironmentMetadata(resolved: any, methodName?: string): void {
    Object.keys(process.env).forEach(envVar => {
      if (process.env[envVar] === 'true' && resolved.environment?.[envVar]) {
        const envSettings = resolved.environment[envVar];
        
        // Apply global environment settings
        if (envSettings['custom-tags']) {
          if (!resolved['custom-tags']) resolved['custom-tags'] = {};
          Object.assign(resolved['custom-tags'], envSettings['custom-tags']);
        }

        // Apply method-specific environment settings
        if (methodName && envSettings.methods?.[methodName]) {
          this.mergeMetadata(resolved, envSettings.methods[methodName]);
        }
      }
    });
  }

  /**
   * Process resolved metadata into JSDoc format
   */
  private processResolvedMetadata(resolved: any): ProcessedMetadata {
    const jsdocFormat = resolved.formats?.jsdoc || resolved;
    
    return {
      jsdocTags: this.extractJSDocTags(jsdocFormat),
      examples: this.extractExamples(resolved.examples || []),
      customTags: resolved['custom-tags'] || {}
    };
  }

  /**
   * Extract JSDoc tags - DYNAMIC PROPERTY MAPPING
   */
  private extractJSDocTags(data: any): Record<string, string> {
    const tags: Record<string, string> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim() && 
          !['hierarchy', 'formats', 'examples', 'methods', 'environment', 'custom-tags'].includes(key)) {
        tags[key] = value;
      }
    });

    return tags;
  }

  /**
   * Extract examples from YAML data
   */
  private extractExamples(examples: any[]): Array<{ id: string; code: string; complexity: string }> {
    return examples.map(example => ({
      id: example.id || 'example',
      code: example.code || '',
      complexity: example.complexity || 'basic'
    }));
  }

  /**
   * Build standard JSDoc content
   */
  private buildStandardJSDoc(metadata: ProcessedMetadata, methodName: string): string {
    const lines: string[] = [];

    // Add all JSDoc tags dynamically
    Object.entries(metadata.jsdocTags).forEach(([key, value]) => {
      lines.push(`@${key} ${value}`);
    });

    // Add custom tags
    Object.entries(metadata.customTags).forEach(([key, value]) => {
      lines.push(`@${key} ${value}`);
    });

    // Add examples
    metadata.examples.forEach((example, index) => {
      if (index > 0) lines.push('*');
      lines.push('@example');
      lines.push('```typescript');
      example.code.split('\n').forEach(line => {
        lines.push(line);
      });
      lines.push('```');
    });

    return lines.map(line => ` * ${line}`).join('\n');
  }

  /**
   * Build custom JSDoc with custom parameter
   */
  private buildCustomJSDoc(metadata: ProcessedMetadata, methodName: string, customParam: string): string {
    // Custom logic based on customParam
    const lines: string[] = [];
    
    lines.push(`@custom-${customParam} Custom content for ${methodName}`);
    
    // Add relevant metadata
    if (metadata.customTags[customParam]) {
      lines.push(`@${customParam} ${metadata.customTags[customParam]}`);
    }

    return lines.map(line => ` * ${line}`).join('\n');
  }

  /**
   * Build environment-specific JSDoc
   */
  private buildEnvironmentJSDoc(metadata: ProcessedMetadata, methodName: string, envVar: string): string {
    const lines: string[] = [];
    
    if (process.env[envVar] === 'true') {
      lines.push(`@env-enabled Environment variable ${envVar} is enabled`);
      
      // Add environment-specific custom tags
      Object.entries(metadata.customTags).forEach(([key, value]) => {
        if (key.includes(envVar.toLowerCase())) {
          lines.push(`@${key} ${value}`);
        }
      });
    } else {
      lines.push(`@env-disabled Environment variable ${envVar} is disabled`);
    }

    return lines.map(line => ` * ${line}`).join('\n');
  }

  /**
   * Replace directive in content with generated JSDoc
   */
  private replaceDirective(
    content: string,
    directive: any,
    replacement: string
  ): string {
    const beforeDirective = content.substring(0, directive.position);
    const afterDirective = content.substring(directive.position + directive.fullMatch.length);

    return beforeDirective + replacement + afterDirective;
  }

  /**
   * Extract package name from file path
   */
  private extractPackageFromPath(filePath: string): string {
    const match = filePath.match(/packages\/([^/]+)\//);
    return match?.[1] || 'unknown';
  }

  /**
   * Extract class name from file path
   */
  private extractClassNameFromPath(filePath: string): string {
    const fileName = path.basename(filePath, '.d.ts');
    return fileName.replace(/\./g, '-'); // Handle aggregate-root.builder → aggregate-root-builder
  }
}