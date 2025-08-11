// Core engine
export { ExampleEngine } from './engine';

// Interfaces
export type {
  ICLIAdapter,
  IExampleEngine,
  IExampleValidator,
  IFileScanner,
  IJSDocAdapter,
} from './interfaces';

// Types
export type {
  ComplexityLevel,
  ExampleFile,
  ExampleValidationRules,
  ExtractedExample,
  ExtractionTag,
  GenerationOptions,
  LayerType,
  OutputType,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from './types';

// Components
export { TagExtractor } from './extractor/tag-extractor';
export { FileScanner } from './scanner/file-scanner';
export { ExampleValidator } from './validation/validator';

// Validation rules
export {
  BEST_PRACTICES,
  COMPILATION_PATTERNS,
  DEFAULT_VALIDATION_RULES,
  LINE_COUNTING_RULES,
  QUALITY_THRESHOLDS,
} from './validation/rules';

// Enhanced Metadata System V2 - Clean Architecture
export { CliOutputAdapter } from './adapters/cli-output-adapter';
export { JsDocOutputAdapter } from './adapters/jsdoc-output-adapter';
export {
  formatAllMethodsAsCLI,
  formatAllMethodsAsJSDoc,
  formatAsCLI,
  formatAsJSDoc,
  UnifiedAdapter,
  type OutputFormat,
} from './adapters/unified-adapter';
export { YamlMetadataEngine, type MetadataConfig } from './core/yaml-metadata-engine';

// Legacy Enhanced Metadata System (will be deprecated)
export { MultiLevelCache, PerformanceMonitor } from './cache/multi-level-cache';
export { FormatSpecificResolver } from './hierarchy/format-specific-resolver';
export { HierarchicalMetadataResolver } from './hierarchy/hierarchical-metadata-resolver';
export { MetadataResolutionStrategies } from './hierarchy/resolution-strategies';

// Enhanced Metadata Types
export type {
  HierarchyConfig,
  MetadataLevel,
  MetadataSource,
  ResolutionStrategy,
  ResolvedMetadata,
} from './hierarchy/types';

// Re-export for convenience
export { ExampleEngine as Engine } from './engine';
