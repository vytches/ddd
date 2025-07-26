import type { PackageExampleConfig } from '@vytches/ddd-contracts';

export const packageExampleConfig: PackageExampleConfig = {
  packageName: 'validation',
  displayName: 'Validation',
  version: '1.0.0',
  description:
    'Domain validation patterns with specifications, composite validation, and business rules',
  domain: 'Core',
  patterns: ['specification-pattern', 'composite-validation', 'business-rules'],
  dependencies: ['@vytches/ddd-domain-primitives', '@vytches/ddd-utils'],

  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: false,
      diRequired: false,
      description: 'Basic validation patterns',
    },
    intermediate: {
      level: 'intermediate',
      diSupport: true,
      diRequired: false,
      description: 'Advanced patterns with optional DI',
    },
    advanced: {
      level: 'advanced',
      diSupport: true,
      diRequired: true,
      description: 'Enterprise patterns requiring DI',
    },
  },

  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description: 'NestJS framework integration',
      complexityLevels: ['basic', 'intermediate', 'advanced'],
      dependencies: ['@nestjs/core', '@nestjs/common'],
    },
  ],

  examples: [
    // Basic Examples
    {
      id: 'validation-basic-specification',
      name: 'Basic Specification Pattern Implementation',
      description:
        'Fundamental specification pattern for validation with email and age validation examples',
      file: 'basic/example-1.md',
      tags: ['specification', 'validation', 'business-rules', 'field-validation'],
      complexity: 'basic',
      priority: 'high',
    },
    {
      id: 'validation-basic-composite',
      name: 'Composite Validation with Business Rules',
      description:
        'Product validation using configurable business rules and field-level validation with quality assessment',
      file: 'basic/example-2.md',
      tags: ['composite-validation', 'product', 'quality-assessment', 'field-validation'],
      complexity: 'basic',
      priority: 'high',
    },
    {
      id: 'validation-basic-use-case',
      name: 'Basic Validation Use Cases',
      description:
        'Common validation scenarios including user registration, product creation, and order processing',
      file: 'basic/use-case.md',
      tags: ['use-cases', 'domain-validation', 'error-handling', 'best-practices'],
      complexity: 'basic',
      priority: 'medium',
    },

    // Intermediate Examples
    {
      id: 'validation-intermediate-advanced-spec',
      name: 'Advanced Specification Patterns',
      description:
        'Complex specification composition with AND/OR logic and conditional validation rules',
      file: 'intermediate/example-1.md',
      tags: [
        'advanced-specification',
        'composition',
        'conditional-validation',
        'logical-operators',
      ],
      complexity: 'intermediate',
      priority: 'high',
    },
    {
      id: 'validation-intermediate-facade',
      name: 'Validation Facade Pattern',
      description:
        'Centralized validation orchestration with multiple validation engines and error aggregation',
      file: 'intermediate/example-2.md',
      tags: ['facade-pattern', 'validation-orchestration', 'error-aggregation', 'multiple-engines'],
      complexity: 'intermediate',
      priority: 'medium',
    },
    {
      id: 'validation-intermediate-use-case',
      name: 'Intermediate Validation Use Cases',
      description:
        'Complex validation scenarios with multi-step validation and conditional business rules',
      file: 'intermediate/use-case.md',
      tags: ['complex-scenarios', 'multi-step-validation', 'conditional-rules', 'business-logic'],
      complexity: 'intermediate',
      priority: 'medium',
    },

    // Advanced Examples
    {
      id: 'validation-advanced-plugin-system',
      name: 'Plugin-based Validation System',
      description:
        'Extensible validation architecture with dynamic plugin loading and custom validation engines',
      file: 'advanced/example-1.md',
      tags: ['plugin-architecture', 'extensible-validation', 'dynamic-loading', 'custom-engines'],
      complexity: 'advanced',
      priority: 'medium',
    },
    {
      id: 'validation-advanced-performance',
      name: 'High-Performance Validation Pipeline',
      description:
        'Optimized validation with parallel execution, caching, and performance monitoring',
      file: 'advanced/example-2.md',
      tags: ['performance-optimization', 'parallel-execution', 'caching', 'monitoring'],
      complexity: 'advanced',
      priority: 'medium',
    },
    {
      id: 'validation-advanced-use-case',
      name: 'Advanced Validation Use Cases',
      description: 'Enterprise-scale validation scenarios with global validation orchestration',
      file: 'advanced/use-case.md',
      tags: ['enterprise-scale', 'global-orchestration', 'complex-business-rules', 'scalability'],
      complexity: 'advanced',
      priority: 'low',
    },

    // Framework Examples
    {
      id: 'validation-nestjs-basic',
      name: 'NestJS Basic Validation Integration',
      description: 'Basic validation patterns integrated with NestJS dependency injection',
      file: 'frameworks/nestjs/basic/example-1.md',
      tags: ['nestjs', 'dependency-injection', 'basic-integration'],
      complexity: 'basic',
      framework: 'nestjs',
      priority: 'high',
    },
    {
      id: 'validation-nestjs-intermediate',
      name: 'NestJS Advanced Validation Integration',
      description: 'Advanced validation patterns with NestJS interceptors and custom decorators',
      file: 'frameworks/nestjs/intermediate/example-1.md',
      tags: ['nestjs', 'interceptors', 'custom-decorators', 'advanced-integration'],
      complexity: 'intermediate',
      framework: 'nestjs',
      priority: 'medium',
    },
  ],

  tags: {
    core: ['validation:basic', 'validation:intermediate', 'validation:advanced'],
    integrations: ['nestjs:basic', 'nestjs:intermediate'],
    frameworks: ['nestjs'],
    patterns: ['specification-pattern', 'composite-validation', 'business-rules'],
  },

  contentConfig: {
    showImportStatements: true,
    showErrorHandling: true,
    showTesting: true,
    showPerformance: false,
    includeBestPractices: true,
    includeCommonPitfalls: true,
    showVersionHistory: false,
  },

  llmSupport: {
    enabled: true,
    includePrompts: true,
    includeTips: true,
    includePatterns: true,
    optimizeForCodeGeneration: true,
  },

  sections: ['implementation', 'use-case', 'framework-integration'],

  relatedPackages: {
    'domain-primitives': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['validation-basic-specification'],
    },
    utils: {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['validation-basic-composite'],
    },
  },
};

export default packageExampleConfig;
