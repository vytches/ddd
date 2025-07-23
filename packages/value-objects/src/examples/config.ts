import type { PackageExampleConfig } from '@vytches-ddd/contracts';

export const packageExampleConfig: PackageExampleConfig = {
  packageName: 'value-objects',
  displayName: 'Value Objects',
  version: '1.0.0',
  description: 'Domain-driven value objects with validation, immutability, and business logic',
  domain: 'Core',
  patterns: ['value-object', 'immutability', 'factory-pattern'],
  dependencies: ['@vytches-ddd/domain-primitives', '@vytches-ddd/utils'],

  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: false,
      diRequired: false,
      description: 'Basic value object patterns'
    },
    intermediate: {
      level: 'intermediate',
      diSupport: true,
      diRequired: false,
      description: 'Advanced patterns with optional DI'
    },
    advanced: {
      level: 'advanced',
      diSupport: true,
      diRequired: true,
      description: 'Enterprise patterns requiring DI'
    }
  },

  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description: 'NestJS framework integration',
      complexityLevels: ['basic', 'intermediate', 'advanced'],
      dependencies: ['@nestjs/core', '@nestjs/common']
    }
  ],

  examples: [
    // Basic Examples
    {
      id: 'money-value-object',
      name: 'Money Value Object',
      description: 'Currency-aware monetary calculations with precision handling',
      file: 'basic/example-1.md',
      tags: ['money', 'currency', 'arithmetic', 'validation'],
      complexity: 'basic',
      priority: 'high'
    },
    {
      id: 'email-value-object',
      name: 'Email Value Object',
      description: 'Email address validation, normalization, and domain extraction',
      file: 'basic/example-2.md',
      tags: ['email', 'validation', 'communication', 'normalization'],
      complexity: 'basic',
      priority: 'high'
    },
    {
      id: 'address-value-object',
      name: 'Address Value Object',
      description: 'Structured address representation with geographical validation',
      file: 'basic/example-3.md',
      tags: ['address', 'geography', 'validation', 'structured-data'],
      complexity: 'basic',
      priority: 'high'
    },
    {
      id: 'basic-implementation',
      name: 'Basic Value Objects Implementation',
      description: 'Implementation patterns for basic value objects',
      file: 'basic/implementation.md',
      tags: ['implementation', 'patterns', 'best-practices'],
      complexity: 'basic',
      priority: 'medium'
    },
    {
      id: 'basic-use-case',
      name: 'Basic Value Objects Use Cases',
      description: 'Common use cases for value objects in domain modeling',
      file: 'basic/use-case.md',
      tags: ['use-cases', 'domain-modeling', 'examples'],
      complexity: 'basic',
      priority: 'medium'
    },

    // Intermediate Examples
    {
      id: 'range-value-object',
      name: 'Range Value Object',
      description: 'Time and numeric ranges with overlap detection and validation',
      file: 'intermediate/example-1.md',
      tags: ['range', 'time', 'numeric', 'overlap-detection'],
      complexity: 'intermediate',
      priority: 'high'
    },
    {
      id: 'composite-value-object',
      name: 'Composite Value Object',
      description: 'Complex value objects composed of multiple primitive values',
      file: 'intermediate/example-2.md',
      tags: ['composite', 'complex-types', 'composition'],
      complexity: 'intermediate',
      priority: 'high'
    },
    {
      id: 'validated-value-object',
      name: 'Validated Value Object',
      description: 'Advanced validation patterns with business rule enforcement',
      file: 'intermediate/example-3.md',
      tags: ['validation', 'business-rules', 'enforcement'],
      complexity: 'intermediate',
      priority: 'medium'
    },
    {
      id: 'intermediate-implementation',
      name: 'Intermediate Value Objects Implementation',
      description: 'Advanced implementation patterns and techniques',
      file: 'intermediate/implementation.md',
      tags: ['implementation', 'advanced-patterns', 'techniques'],
      complexity: 'intermediate',
      priority: 'medium'
    },
    {
      id: 'intermediate-use-case',
      name: 'Intermediate Value Objects Use Cases',
      description: 'Complex business scenarios using advanced value objects',
      file: 'intermediate/use-case.md',
      tags: ['use-cases', 'complex-scenarios', 'business-logic'],
      complexity: 'intermediate',
      priority: 'medium'
    },

    // Advanced Examples
    {
      id: 'specification-value-object',
      name: 'Specification-based Value Object',
      description: 'Value objects with embedded business specifications and rules',
      file: 'advanced/example-1.md',
      tags: ['specification-pattern', 'business-rules', 'embedded-logic'],
      complexity: 'advanced',
      priority: 'medium'
    },
    {
      id: 'serializable-value-object',
      name: 'Serializable Value Object',
      description: 'Value objects with advanced serialization and deserialization',
      file: 'advanced/example-2.md',
      tags: ['serialization', 'persistence', 'marshalling'],
      complexity: 'advanced',
      priority: 'medium'
    },
    {
      id: 'performance-optimized-value-object',
      name: 'Performance-Optimized Value Object',
      description: 'High-performance value objects with caching and optimization',
      file: 'advanced/example-3.md',
      tags: ['performance', 'optimization', 'caching'],
      complexity: 'advanced',
      priority: 'low'
    },
    {
      id: 'advanced-implementation',
      name: 'Advanced Value Objects Implementation',
      description: 'Enterprise-grade implementation patterns',
      file: 'advanced/implementation.md',
      tags: ['implementation', 'enterprise', 'advanced-patterns'],
      complexity: 'advanced',
      priority: 'medium'
    },
    {
      id: 'advanced-use-case',
      name: 'Advanced Value Objects Use Cases',
      description: 'Enterprise-scale value object applications',
      file: 'advanced/use-case.md',
      tags: ['use-cases', 'enterprise-scale', 'applications'],
      complexity: 'advanced',
      priority: 'low'
    },

    // Framework Examples - NestJS
    {
      id: 'nestjs-money-value-object',
      name: 'NestJS Money Value Object',
      description: 'Money value object integrated with NestJS validation and serialization',
      file: 'frameworks/nestjs/basic/example-1.md',
      tags: ['nestjs', 'money', 'validation', 'serialization'],
      complexity: 'basic',
      framework: 'nestjs',
      priority: 'high'
    },
    {
      id: 'nestjs-email-value-object',
      name: 'NestJS Email Value Object',
      description: 'Email value object with NestJS DTO integration',
      file: 'frameworks/nestjs/basic/example-2.md',
      tags: ['nestjs', 'email', 'dto', 'integration'],
      complexity: 'basic',
      framework: 'nestjs',
      priority: 'high'
    },
    {
      id: 'nestjs-composite-value-object',
      name: 'NestJS Composite Value Object',
      description: 'Complex value objects with NestJS dependency injection',
      file: 'frameworks/nestjs/intermediate/example-1.md',
      tags: ['nestjs', 'composite', 'dependency-injection'],
      complexity: 'intermediate',
      framework: 'nestjs',
      priority: 'medium'
    },
    {
      id: 'nestjs-validated-value-object',
      name: 'NestJS Validated Value Object',
      description: 'Advanced validation with NestJS pipes and interceptors',
      file: 'frameworks/nestjs/intermediate/example-2.md',
      tags: ['nestjs', 'validation', 'pipes', 'interceptors'],
      complexity: 'intermediate',
      framework: 'nestjs',
      priority: 'medium'
    },
    {
      id: 'nestjs-specification-value-object',
      name: 'NestJS Specification Value Object',
      description: 'Specification-based value objects with enterprise NestJS patterns',
      file: 'frameworks/nestjs/advanced/example-1.md',
      tags: ['nestjs', 'specification', 'enterprise-patterns'],
      complexity: 'advanced',
      framework: 'nestjs',
      priority: 'medium'
    },
    {
      id: 'nestjs-performance-value-object',
      name: 'NestJS Performance Value Object',
      description: 'High-performance value objects with NestJS caching and optimization',
      file: 'frameworks/nestjs/advanced/example-2.md',
      tags: ['nestjs', 'performance', 'caching', 'optimization'],
      complexity: 'advanced',
      framework: 'nestjs',
      priority: 'low'
    }
  ],

  tags: {
    core: ['value-objects:basic', 'value-objects:intermediate', 'value-objects:advanced'],
    integrations: ['nestjs:basic', 'nestjs:intermediate', 'nestjs:advanced'],
    frameworks: ['nestjs'],
    patterns: ['value-object', 'immutability', 'factory-pattern']
  },

  contentConfig: {
    showImportStatements: true,
    showErrorHandling: true,
    showTesting: true,
    showPerformance: false,
    includeBestPractices: true,
    includeCommonPitfalls: true,
    showVersionHistory: false
  },

  llmSupport: {
    enabled: true,
    includePrompts: true,
    includeTips: true,
    includePatterns: true,
    optimizeForCodeGeneration: true
  },

  sections: ['implementation', 'use-case', 'framework-integration'],

  relatedPackages: {
    'domain-primitives': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['money-value-object']
    },
    'utils': {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['email-value-object']
    },
    'validation': {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['validated-value-object']
    }
  }
};

export default packageExampleConfig;
