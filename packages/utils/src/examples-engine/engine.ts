/**
 * Core ExampleEngine implementation
 * Provides unified example extraction and validation system
 */

import { join } from 'path';
import type {
  ExampleFile,
  ExtractedExample,
  ValidationResult,
  LayerType,
  ComplexityLevel,
  OutputType,
} from './types';
import type { IExampleEngine } from './interfaces';
import { FileScanner } from './scanner/file-scanner';
import { TagExtractor } from './extractor/tag-extractor';
import { ExampleValidator } from './validation/validator';

export class ExampleEngine implements IExampleEngine {
  private fileScanner: FileScanner;
  public tagExtractor: TagExtractor; // Make public for JSDocAdapter access
  private validator: ExampleValidator;
  private cache: Map<string, ExampleFile[]> = new Map();

  // Global shared cache to prevent concurrent filesystem access
  private static globalCache = new Map<string, ExampleFile[]>();
  private static pendingScans = new Map<string, Promise<ExampleFile[]>>();

  constructor() {
    this.fileScanner = new FileScanner();
    this.tagExtractor = new TagExtractor();
    this.validator = new ExampleValidator();
  }

  /**
   * Clear global cache (useful for testing or between builds)
   */
  static clearGlobalCache(): void {
    console.log(
      `[ExampleEngine] Clearing global cache with ${ExampleEngine.globalCache.size} entries`
    );
    ExampleEngine.globalCache.clear();
    ExampleEngine.pendingScans.clear();
  }

  /**
   * Scan folder for example files with caching
   */
  async scanFolder(folderPath: string): Promise<ExampleFile[]> {
    console.log(`[scanFolder] Starting scan of: ${folderPath}`);

    const cacheKey = folderPath;

    // Check global cache first (shared across all instances)
    if (ExampleEngine.globalCache.has(cacheKey)) {
      console.log(`[scanFolder] Global cache hit for: ${folderPath}`);
      return ExampleEngine.globalCache.get(cacheKey)!;
    }

    // Check instance cache
    if (this.cache.has(cacheKey)) {
      console.log(`[scanFolder] Instance cache hit for: ${folderPath}`);
      return this.cache.get(cacheKey)!;
    }

    // Check if another scan is already in progress for this path
    if (ExampleEngine.pendingScans.has(cacheKey)) {
      console.log(`[scanFolder] Scan already in progress for: ${folderPath}, waiting...`);
      try {
        const result = await ExampleEngine.pendingScans.get(cacheKey)!;
        console.log(`[scanFolder] Completed waiting for concurrent scan: ${folderPath}`);
        return result;
      } catch (error) {
        console.log(`[scanFolder] Concurrent scan failed for: ${folderPath}, trying own scan`);
        // Fall through to try our own scan
      }
    }

    // Start new scan and store the promise to prevent concurrent scans
    const scanPromise = this._performScan(folderPath);
    ExampleEngine.pendingScans.set(cacheKey, scanPromise);

    try {
      const result = await scanPromise;

      // Cache in both global and instance cache
      ExampleEngine.globalCache.set(cacheKey, result);
      this.cache.set(cacheKey, result);

      console.log(
        `[scanFolder] Scan completed successfully for: ${folderPath}, found ${result.length} files`
      );
      return result;
    } catch (error) {
      console.error(`[scanFolder] Scan failed for ${folderPath}:`, error);
      throw error;
    } finally {
      // Clean up pending scan tracking
      ExampleEngine.pendingScans.delete(cacheKey);
    }
  }

  /**
   * Internal method to perform the actual scanning work
   */
  private async _performScan(folderPath: string): Promise<ExampleFile[]> {
    console.log(`[_performScan] Starting actual scan for: ${folderPath}`);

    try {
      // Add timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`_performScan timed out after 8 seconds for ${folderPath}`)),
          8000
        );
      });

      console.log(`[_performScan] About to scan directory: ${folderPath}`);
      const filePaths = await Promise.race([
        this.fileScanner.scanDirectory(folderPath),
        timeoutPromise,
      ]);

      console.log(`[_performScan] Found ${filePaths.length} files in: ${folderPath}`);
      const exampleFiles: ExampleFile[] = [];

      for (const filePath of filePaths) {
        try {
          console.log(`[_performScan] Parsing file: ${filePath}`);
          const exampleFile = await this.fileScanner.parseExampleFile(filePath);
          exampleFiles.push(exampleFile);
          console.log(`[_performScan] Successfully parsed: ${filePath}`);
        } catch (error) {
          console.warn(`Failed to parse example file ${filePath}:`, error);
          continue;
        }
      }

      console.log(
        `[_performScan] Successfully parsed ${exampleFiles.length} files from: ${folderPath}`
      );
      return exampleFiles;
    } catch (error) {
      console.error(`[_performScan] Failed to scan folder ${folderPath}:`, error);
      if (error instanceof Error && error.message.includes('timed out')) {
        // Return empty array on timeout to prevent hanging the build
        console.log(`[_performScan] Returning empty array due to timeout: ${folderPath}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Extract tagged content from example file
   */
  async extractTaggedContent(file: ExampleFile, tag: string): Promise<ExtractedExample | null> {
    try {
      // Parse tag: "methodName:layer:complexity"
      const [methodName, layer, complexity] = tag.split(':');

      if (!methodName || !layer || !complexity) {
        throw new Error(`Invalid tag format: ${tag}. Expected: methodName:layer:complexity`);
      }

      const example = this.tagExtractor.extractSpecificTag(
        file.content,
        methodName,
        layer as LayerType,
        complexity as ComplexityLevel,
        file.packageName
      );

      return example;
    } catch (error) {
      throw new Error(`Failed to extract tagged content from ${file.filePath}: ${error}`);
    }
  }

  /**
   * Format extracted content for output type
   */
  formatOutput(content: string, outputType: OutputType): string {
    switch (outputType) {
      case 'jsdoc':
        return this.formatForJSDoc(content);
      case 'cli':
        return this.formatForCLI(content);
      default:
        return content;
    }
  }

  /**
   * Get examples for specific method across all layers
   */
  async getExamplesForMethod(methodName: string, packageName: string): Promise<ExtractedExample[]> {
    try {
      // Determine base path for examples
      const basePath = this.resolveExamplesPath(packageName);
      const exampleFiles = await this.scanFolder(basePath);

      // Filter files by package
      const packageFiles = exampleFiles.filter(file => file.packageName === packageName);

      const examples: ExtractedExample[] = [];

      for (const file of packageFiles) {
        try {
          const fileExamples = this.tagExtractor.extractAllTags(file.content, packageName);
          const methodExamples = fileExamples.filter(ex => ex.methodName === methodName);
          examples.push(...methodExamples);
        } catch (error) {
          console.warn(`Failed to extract examples from ${file.filePath}:`, error);
          continue;
        }
      }

      return examples;
    } catch (error) {
      throw new Error(
        `Failed to get examples for method ${methodName} in package ${packageName}: ${error}`
      );
    }
  }

  /**
   * Find example file containing specific method
   */
  async findExampleFileForMethod(
    methodName: string,
    packageName: string
  ): Promise<ExampleFile | null> {
    try {
      console.log(
        `[findExampleFileForMethod] Starting search for method: ${methodName} in package: ${packageName}`
      );

      // Determine base path for examples
      const basePath = this.resolveExamplesPath(packageName);
      console.log(`[findExampleFileForMethod] Resolved base path: ${basePath}`);

      // Check if base path exists before scanning
      const fs = await import('fs/promises');
      try {
        await fs.access(basePath);
        console.log(`[findExampleFileForMethod] Base path exists: ${basePath}`);
      } catch (error) {
        console.log(`[findExampleFileForMethod] Base path does not exist: ${basePath}`);
        return null;
      }

      console.log(`[findExampleFileForMethod] About to scan folder: ${basePath}`);
      const exampleFiles = await this.scanFolder(basePath);
      console.log(`[findExampleFileForMethod] Scanned ${exampleFiles.length} files in ${basePath}`);

      // Filter files by package
      const packageFiles = exampleFiles.filter(file => file.packageName === packageName);
      console.log(
        `[findExampleFileForMethod] Found ${packageFiles.length} files for package: ${packageName}`
      );

      for (const file of packageFiles) {
        try {
          console.log(`[findExampleFileForMethod] Checking file: ${file.filePath}`);

          // Check if file name matches method (e.g., getValue.md for getValue method)
          const fileName = file.filePath.split('/').pop()?.toLowerCase();
          const methodNameLower = methodName.toLowerCase();

          if (fileName === `${methodNameLower}.md`) {
            console.log(`[findExampleFileForMethod] Found exact match: ${file.filePath}`);
            return file;
          }

          // Also check if file contains extract tags for this method
          console.log(`[findExampleFileForMethod] Checking for extract tags in: ${file.filePath}`);
          const fileExamples = this.tagExtractor.extractAllTags(file.content, packageName);
          const hasMethodExample = fileExamples.some(ex => ex.methodName === methodName);

          if (hasMethodExample) {
            console.log(`[findExampleFileForMethod] Found extract tags match: ${file.filePath}`);
            return file;
          }
        } catch (error) {
          console.warn(`Failed to check file ${file.filePath}:`, error);
          continue;
        }
      }

      console.log(`[findExampleFileForMethod] No matching file found for method: ${methodName}`);
      return null;
    } catch (error) {
      console.error(
        `Failed to find example file for method ${methodName} in package ${packageName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Validate extracted example
   */
  async validateExample(example: ExtractedExample): Promise<ValidationResult> {
    try {
      // Layer-specific validation
      const layerValidation = this.validator.validateExample(example);

      // Compilation validation
      const compilationValidation = await this.validator.validateCompilation(example.content);

      // Best practices validation
      const bestPracticesValidation = this.validator.validateBestPractices(example);

      // Combine results
      return {
        isValid: layerValidation.isValid && compilationValidation.isValid,
        errors: [...layerValidation.errors, ...compilationValidation.errors],
        warnings: [
          ...layerValidation.warnings,
          ...compilationValidation.warnings,
          ...bestPracticesValidation.warnings,
        ],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            type: 'compilation_error',
            message: `Validation failed: ${error}`,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Get best example for method (prioritized selection)
   */
  async getBestExampleForMethod(
    methodName: string,
    packageName: string,
    preferredLayer: LayerType = 'domain',
    preferredComplexity: ComplexityLevel = 'basic'
  ): Promise<ExtractedExample | null> {
    const examples = await this.getExamplesForMethod(methodName, packageName);

    if (examples.length === 0) {
      return null;
    }

    // Priority: exact match > same layer > same complexity > any
    const priorities = [
      // 1. Exact match
      examples.find(ex => ex.layer === preferredLayer && ex.complexity === preferredComplexity),
      // 2. Same layer, any complexity
      examples.find(ex => ex.layer === preferredLayer),
      // 3. Same complexity, any layer
      examples.find(ex => ex.complexity === preferredComplexity),
      // 4. Any valid example
      examples[0],
    ].filter(Boolean);

    return priorities[0] || null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Format content for JSDoc injection
   */
  private formatForJSDoc(content: string): string {
    const lines = content.split('\n');

    // Add proper JSDoc formatting - just the content, not the full @example wrapper
    const formattedLines = lines.map(line => {
      if (line.trim() === '') return ' *';
      return ` * ${line}`;
    });

    return [' * @example', ' * ```typescript', ...formattedLines, ' * ```'].join('\n');
  }

  /**
   * Format content for CLI display
   */
  private formatForCLI(content: string): string {
    return `\`\`\`typescript\n${content}\n\`\`\``;
  }

  /**
   * Resolve examples path for package
   */
  private resolveExamplesPath(packageName: string): string {
    // Find workspace root by looking for packages directory or pnpm-workspace.yaml
    let workspaceRoot = process.cwd();

    // If we're in a package directory, go up to find workspace root
    if (workspaceRoot.includes('/packages/')) {
      const parts = workspaceRoot.split('/');
      const packagesIndex = parts.lastIndexOf('packages');
      if (packagesIndex > 0) {
        workspaceRoot = parts.slice(0, packagesIndex).join('/');
      }
    }

    // Try domain examples first (for JSDoc)
    const domainPath = join(workspaceRoot, 'docs', 'examples', 'domain', packageName);

    return domainPath;
  }

  /**
   * Batch validate multiple examples
   */
  async validateExamples(examples: ExtractedExample[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const example of examples) {
      try {
        const result = await this.validateExample(example);
        results.push(result);
      } catch (error) {
        results.push({
          isValid: false,
          errors: [
            {
              type: 'compilation_error',
              message: `Validation failed for ${example.methodName}: ${error}`,
            },
          ],
          warnings: [],
        });
      }
    }

    return results;
  }

  /**
   * Get example statistics for package
   */
  async getPackageStatistics(packageName: string): Promise<{
    totalExamples: number;
    examplesByLayer: Record<LayerType, number>;
    examplesByComplexity: Record<ComplexityLevel, number>;
    methods: string[];
    validationResults: { valid: number; invalid: number };
  }> {
    try {
      const basePath = this.resolveExamplesPath(packageName);
      const exampleFiles = await this.scanFolder(basePath);
      const packageFiles = exampleFiles.filter(file => file.packageName === packageName);

      const allExamples: ExtractedExample[] = [];
      for (const file of packageFiles) {
        const examples = this.tagExtractor.extractAllTags(file.content, packageName);
        allExamples.push(...examples);
      }

      // Calculate statistics
      const stats = {
        totalExamples: allExamples.length,
        examplesByLayer: { domain: 0, service: 0, integration: 0 } as Record<LayerType, number>,
        examplesByComplexity: { basic: 0, intermediate: 0, advanced: 0 } as Record<
          ComplexityLevel,
          number
        >,
        methods: [...new Set(allExamples.map(ex => ex.methodName))],
        validationResults: { valid: 0, invalid: 0 },
      };

      // Count by layer and complexity
      allExamples.forEach(example => {
        stats.examplesByLayer[example.layer]++;
        stats.examplesByComplexity[example.complexity]++;
      });

      // Validate examples
      const validationResults = await this.validateExamples(allExamples);
      validationResults.forEach(result => {
        if (result.isValid) {
          stats.validationResults.valid++;
        } else {
          stats.validationResults.invalid++;
        }
      });

      return stats;
    } catch (error) {
      throw new Error(`Failed to get statistics for package ${packageName}: ${error}`);
    }
  }
}
