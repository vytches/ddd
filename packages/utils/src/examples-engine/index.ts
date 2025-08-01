/**
 * JSDoc Examples Engine - Main exports
 * 
 * @llm-summary Example extraction system for JSDoc injection and CLI generation
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 */

// Core engine
export { ExampleEngine } from './engine';

// Interfaces
export type {
  IExampleEngine,
  IJSDocAdapter,
  ICLIAdapter,
  IExampleValidator,
  IFileScanner,
} from './interfaces';

// Types
export type {
  ExampleFile,
  ExtractedExample,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ExampleValidationRules,
  ExtractionTag,
  GenerationOptions,
  LayerType,
  ComplexityLevel,
  OutputType,
} from './types';

// Components
export { FileScanner } from './scanner/file-scanner';
export { TagExtractor } from './extractor/tag-extractor';
export { ExampleValidator } from './validation/validator';

// Validation rules
export {
  DEFAULT_VALIDATION_RULES,
  COMPILATION_PATTERNS,
  BEST_PRACTICES,
  LINE_COUNTING_RULES,
  QUALITY_THRESHOLDS,
} from './validation/rules';

// Enhanced Metadata System V2
export { HierarchicalMetadataResolver } from './hierarchy/hierarchical-metadata-resolver';
export { FormatSpecificResolver } from './hierarchy/format-specific-resolver';
export { MetadataResolutionStrategies } from './hierarchy/resolution-strategies';
export { MultiLevelCache, PerformanceMonitor } from './cache/multi-level-cache';
export { HierarchicalJSDocAdapter } from './adapters/hierarchical-jsdoc-adapter';
export { PostCompilationDTSProcessor } from './adapters/post-compilation-dts-processor';

// Enhanced Metadata Types
export type {
  ResolvedMetadata,
  MetadataSource,
  HierarchyConfig,
  ResolutionStrategy,
  MetadataLevel,
} from './hierarchy/types';

// Re-export for convenience
export { ExampleEngine as Engine } from './engine';