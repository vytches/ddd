/**
 * Types for the JSDoc Examples Engine
 * Provides interfaces for example extraction and validation system
 */

export type LayerType = 'domain' | 'service' | 'integration';
export type ComplexityLevel = 'basic' | 'intermediate' | 'advanced';
export type OutputType = 'jsdoc' | 'cli';

export interface ExampleFile {
  filePath: string;
  packageName: string;
  complexity: ComplexityLevel;
  content: string;
  metadata: {
    title: string;
    description: string;
    patterns: string[];
    dependencies: string[];
  };
}

export interface ExtractedExample {
  methodName: string;
  layer: LayerType;
  complexity: ComplexityLevel;
  content: string;
  lineCount: number;
  packageName: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type:
    | 'max_lines_exceeded'
    | 'missing_required_element'
    | 'forbidden_element_found'
    | 'compilation_error';
  message: string;
  line?: number;
  element?: string;
}

export interface ValidationWarning {
  type: 'style_suggestion' | 'best_practice';
  message: string;
  line?: number;
}

export interface ExampleValidationRules {
  domain: {
    maxLines: 5;
    required: string[];
    forbidden: string[];
  };
  service: {
    maxLines: 8;
    required: string[];
    forbidden: string[];
  };
  integration: {
    maxLines: 10;
    required: string[];
    forbidden: string[];
  };
}

export interface ExtractionTag {
  methodName: string;
  layer: LayerType;
  complexity: ComplexityLevel;
  startLine: number;
  endLine: number;
}

export interface GenerationOptions {
  packageName?: string;
  framework?: 'nestjs' | 'express' | 'fastify';
  complexity?: ComplexityLevel;
  outputType: OutputType;
  maxExamples?: number;
}
