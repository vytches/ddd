/**
 * @fileoverview DI Package Examples Index
 * @version 1.0.0
 * @package @vytches-ddd/di
 */

export { diExampleConfig as default } from './config';
export * from './types';

// Re-export configuration for external consumers
export { diExampleConfig } from './config';

/**
 * Example categories available in the DI package
 */
export const DI_EXAMPLE_CATEGORIES = {
  BASIC: 'basic',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  FRAMEWORKS: 'frameworks'
} as const;

/**
 * Framework examples available
 */
export const DI_FRAMEWORK_EXAMPLES = {
  NESTJS: 'nestjs'
} as const;

/**
 * Example complexity levels
 */
export const DI_COMPLEXITY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert'
} as const;

/**
 * Example tags for filtering
 */
export const DI_EXAMPLE_TAGS = {
  // Core DI concepts
  CORE: 'di:core',
  REGISTRATION: 'di:registration',
  DECORATOR: 'di:decorator',
  LIFETIME: 'di:lifetime',
  PATTERNS: 'di:patterns',
  LOCATOR: 'di:locator',
  GLOBAL: 'di:global',

  // Discovery and automation
  DISCOVERY: 'di:discovery',
  DECORATORS: 'di:decorators',
  AUTOMATION: 'di:automation',

  // Context and isolation
  CONTEXT: 'di:context',
  ISOLATION: 'di:isolation',
  DDD: 'di:ddd',

  // CQRS integration
  CQRS: 'di:cqrs',
  HANDLERS: 'di:handlers',

  // Advanced patterns
  INTEGRATION: 'di:integration',
  ENTERPRISE: 'di:enterprise',
  CONTAINER: 'di:container',
  CUSTOM: 'di:custom',
  PRODUCTION: 'di:production',
  MONITORING: 'di:monitoring',

  // Framework integration
  NESTJS: 'di:nestjs',
  BASIC: 'di:basic',
  MODULES: 'di:modules',
  CONFIG: 'di:config',
  BRIDGE: 'di:bridge',
  PROVIDERS: 'di:providers',
  FACTORY: 'di:factory'
} as const;

/**
 * Gets all available example tags
 */
export function getDIExampleTags(): string[] {
  return Object.values(DI_EXAMPLE_TAGS);
}

/**
 * Gets example tags by category
 */
export function getDIExampleTagsByCategory(category: string): string[] {
  switch (category) {
    case 'core':
      return [
        DI_EXAMPLE_TAGS.CORE,
        DI_EXAMPLE_TAGS.REGISTRATION,
        DI_EXAMPLE_TAGS.DECORATOR,
        DI_EXAMPLE_TAGS.LIFETIME,
        DI_EXAMPLE_TAGS.PATTERNS,
        DI_EXAMPLE_TAGS.LOCATOR,
        DI_EXAMPLE_TAGS.GLOBAL
      ];

    case 'discovery':
      return [
        DI_EXAMPLE_TAGS.DISCOVERY,
        DI_EXAMPLE_TAGS.DECORATORS,
        DI_EXAMPLE_TAGS.AUTOMATION
      ];

    case 'context':
      return [
        DI_EXAMPLE_TAGS.CONTEXT,
        DI_EXAMPLE_TAGS.ISOLATION,
        DI_EXAMPLE_TAGS.DDD
      ];

    case 'cqrs':
      return [
        DI_EXAMPLE_TAGS.CQRS,
        DI_EXAMPLE_TAGS.HANDLERS
      ];

    case 'advanced':
      return [
        DI_EXAMPLE_TAGS.INTEGRATION,
        DI_EXAMPLE_TAGS.ENTERPRISE,
        DI_EXAMPLE_TAGS.CONTAINER,
        DI_EXAMPLE_TAGS.CUSTOM,
        DI_EXAMPLE_TAGS.PRODUCTION,
        DI_EXAMPLE_TAGS.MONITORING
      ];

    case 'frameworks':
      return [
        DI_EXAMPLE_TAGS.NESTJS,
        DI_EXAMPLE_TAGS.BASIC,
        DI_EXAMPLE_TAGS.MODULES,
        DI_EXAMPLE_TAGS.CONFIG,
        DI_EXAMPLE_TAGS.BRIDGE,
        DI_EXAMPLE_TAGS.PROVIDERS,
        DI_EXAMPLE_TAGS.FACTORY
      ];

    default:
      return getDIExampleTags();
  }
}

/**
 * Validates if a tag is supported
 */
export function isDIExampleTagSupported(tag: string): boolean {
  return Object.values(DI_EXAMPLE_TAGS).includes(tag as any);
}

/**
 * Gets complexity level display name
 */
export function getDIComplexityDisplayName(level: string): string {
  switch (level) {
    case DI_COMPLEXITY_LEVELS.BEGINNER:
      return 'Beginner';
    case DI_COMPLEXITY_LEVELS.INTERMEDIATE:
      return 'Intermediate';
    case DI_COMPLEXITY_LEVELS.ADVANCED:
      return 'Advanced';
    case DI_COMPLEXITY_LEVELS.EXPERT:
      return 'Expert';
    default:
      return 'Unknown';
  }
}

/**
 * Gets category display name
 */
export function getDICategoryDisplayName(category: string): string {
  switch (category) {
    case DI_EXAMPLE_CATEGORIES.BASIC:
      return 'Basic Examples';
    case DI_EXAMPLE_CATEGORIES.INTERMEDIATE:
      return 'Intermediate Examples';
    case DI_EXAMPLE_CATEGORIES.ADVANCED:
      return 'Advanced Examples';
    case DI_EXAMPLE_CATEGORIES.FRAMEWORKS:
      return 'Framework Integration';
    default:
      return 'Unknown Category';
  }
}

/**
 * Gets framework display name
 */
export function getDIFrameworkDisplayName(framework: string): string {
  switch (framework) {
    case DI_FRAMEWORK_EXAMPLES.NESTJS:
      return 'NestJS';
    default:
      return 'Unknown Framework';
  }
}
