// Re-export for backward compatibility
export type {
  ParsedDocumentationSet as ParsedExample,
  BaseDocumentationContent as BaseExample,
  FrameworkIntegrationContent as FrameworkExample,
  MergedDocumentationContent as MergedExample,
  DocumentationParseOptions as ParseExampleOptions,
  DocumentationFilterOptions as FilterOptions,
  FrameworkComponentType as ComponentType,
} from './documentation-types';

export type {
  ExampleDefinition,
  PackageExampleConfig,
  ComplexityLevel,
  FrameworkIntegration,
  ContentConfig,
  LLMSupport,
  TagSystem,
  RelatedPackage,
} from './legacy-contracts';
