/**
 * Core interfaces for the Examples Engine system
 */

import type {
  ExampleFile,
  ExtractedExample,
  ValidationResult,
  ExampleValidationRules,
  LayerType,
  ComplexityLevel,
  OutputType,
  GenerationOptions,
} from './types';

/**
 * Core example extraction engine interface
 */
export interface IExampleEngine {
  /**
   * Scan a folder for example files with metadata extraction
   */
  scanFolder(folderPath: string): Promise<ExampleFile[]>;

  /**
   * Extract tagged content from example file
   */
  extractTaggedContent(file: ExampleFile, tag: string): Promise<ExtractedExample | null>;

  /**
   * Format extracted content for specific output type
   */
  formatOutput(content: string, outputType: OutputType): string;

  /**
   * Get examples for a specific method across all layers
   */
  getExamplesForMethod(methodName: string, packageName: string): Promise<ExtractedExample[]>;

  /**
   * Validate extracted example against layer rules
   */
  validateExample(example: ExtractedExample): Promise<ValidationResult>;
}

/**
 * JSDoc-specific adapter interface
 */
export interface IJSDocAdapter {
  /**
   * Get best example for method at specific layer
   */
  getExampleForMethod(
    methodName: string,
    packageName: string,
    layer?: LayerType,
    complexity?: ComplexityLevel
  ): Promise<string>;

  /**
   * Inject examples into JSDoc comments
   */
  injectIntoJSDoc(code: string, methodName: string, packageName: string): Promise<string>;

  /**
   * Process JSDoc directives using YAML metadata system
   */
  processInjectionDirectives(code: string, filePath: string): Promise<string>;
}

/**
 * CLI-specific adapter interface
 */
export interface ICLIAdapter {
  /**
   * Get complete example file for package
   */
  getCompleteExample(packageName: string, framework?: string): Promise<string>;

  /**
   * Generate documentation with specified options
   */
  generateDocumentation(options: GenerationOptions): Promise<string>;

  /**
   * List available examples for package
   */
  listExamples(packageName?: string): Promise<ExampleFile[]>;
}

/**
 * Example validation engine interface
 */
export interface IExampleValidator {
  /**
   * Validate example against layer-specific rules
   */
  validateExample(example: ExtractedExample, rules: ExampleValidationRules): ValidationResult;

  /**
   * Check if example compiles successfully
   */
  validateCompilation(content: string): Promise<ValidationResult>;

  /**
   * Validate example follows best practices
   */
  validateBestPractices(example: ExtractedExample): ValidationResult;
}

/**
 * File system operations interface
 */
export interface IFileScanner {
  /**
   * Scan directory for markdown files
   */
  scanDirectory(path: string): Promise<string[]>;

  /**
   * Read and parse example file
   */
  parseExampleFile(filePath: string): Promise<ExampleFile>;

  /**
   * Extract metadata from file headers
   */
  extractMetadata(content: string): ExampleFile['metadata'];
}