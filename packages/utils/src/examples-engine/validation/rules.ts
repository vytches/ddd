/**
 * Validation rules for example extraction
 * Defines layer-specific constraints and quality standards
 */

import type { ExampleValidationRules } from '../types';

/**
 * Default validation rules per architecture layer
 */
export const DEFAULT_VALIDATION_RULES: ExampleValidationRules = {
  domain: {
    maxLines: 5,
    required: ['setup', 'execution', 'return'],
    forbidden: ['async', 'await', 'repository', 'eventBus', 'logger', 'this.'],
  },
  service: {
    maxLines: 8,
    required: ['command/query', 'service_call', 'result_handling'],
    forbidden: ['direct_domain_instantiation', 'new Entity', 'new ValueObject'],
  },
  integration: {
    maxLines: 10,
    required: ['persistence', 'event_publishing'],
    forbidden: ['business_logic', 'validation_logic'],
  },
};

/**
 * Compilation check patterns
 */
export const COMPILATION_PATTERNS = {
  requiredImports: {
    domain: ['@vytches/ddd-domain-primitives', '@vytches/ddd-value-objects'],
    service: ['@vytches/ddd-cqrs', '@vytches/ddd-domain-services'],
    integration: ['@vytches/ddd-repositories', '@vytches/ddd-events'],
  },
  forbiddenPatterns: [
    /console\.log/g,
    /debugger/g,
    /TODO:/g,
    /FIXME:/g,
    /any\s+=/g, // Avoid 'any' type
  ],
};

/**
 * Best practice patterns for examples
 */
export const BEST_PRACTICES = {
  naming: {
    variablePatterns: [/^[a-z][a-zA-Z0-9]*$/], // camelCase
    constantPatterns: [/^[A-Z][A-Z0-9_]*$/], // UPPER_CASE
  },
  structure: {
    maxNestingLevel: 2,
    preferExplicitTypes: true,
    requireErrorHandling: ['service', 'integration'],
  },
  dddPatterns: {
    domain: {
      mustUse: ['Result<', 'ValidationError', 'DomainEvent'],
      shouldAvoid: ['Promise<', 'async', 'await'],
    },
    service: {
      mustUse: ['Command', 'Query', 'Handler'],
      shouldAvoid: ['direct entity creation'],
    },
    integration: {
      mustUse: ['Repository', 'EventBus'],
      shouldAvoid: ['business validation'],
    },
  },
};

/**
 * Line counting rules
 */
export const LINE_COUNTING_RULES = {
  excludeFromCount: [
    /^\s*$/,           // Empty lines
    /^\s*\/\//,        // Single line comments
    /^\s*\/\*/,        // Multi-line comment start
    /^\s*\*/,          // Multi-line comment content
    /^\s*\*\//,        // Multi-line comment end
    /^\s*import\s+/,   // Import statements
    /^\s*export\s+/,   // Export statements (unless main logic)
  ],
  countAsOne: [
    /{\s*$/,           // Opening braces on their own line
    /^\s*}\s*$/,       // Closing braces on their own line
  ],
};

/**
 * Quality thresholds
 */
export const QUALITY_THRESHOLDS = {
  minExampleQuality: 0.8,
  maxComplexityScore: 10,
  requiredDocumentationCoverage: 0.9,
  maxCyclomaticComplexity: 3,
};