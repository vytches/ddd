import type { PackageExampleConfig } from '@vytches/ddd-contracts';

/**
 * Logging Package Examples Configuration
 *
 * Complete structure:
 * - Basic examples with foundation patterns
 * - Intermediate examples with framework integration
 * - Advanced examples with enterprise observability
 * - NestJS framework integration across all complexity levels
 * - Focus on practical logging usage patterns
 */

export const packageExampleConfig: PackageExampleConfig = {
  packageName: 'logging',
  displayName: 'Structured Logging',
  version: '1.0.0',
  description: 'DDD-first structured logging with automatic context detection and data masking',
  domain: 'Infrastructure',
  patterns: ['logging', 'structured-logging', 'context-detection'],
  dependencies: ['@vytches/ddd-utils'],
  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: false,
      diRequired: false,
      description: 'Basic logging patterns',
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
      description: 'Enterprise observability with comprehensive distributed tracing',
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
    // Basic Examples (3 examples)
    {
      id: 'basic-logger-setup',
      name: 'Basic Logger Setup',
      file: 'basic/example-1.md',
      tags: ['logging:basic', 'setup:configuration', 'context:detection'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic logger configuration with context detection and data masking',
      validation: { fileExists: true },
    },
    {
      id: 'basic-cqrs-logging',
      name: 'CQRS Integration Logging',
      file: 'basic/example-2.md',
      tags: ['logging:cqrs', 'decorators:commands', 'decorators:queries'],
      complexity: 'basic',
      priority: 'high',
      description: 'CQRS logging with decorators for commands and queries',
      validation: { fileExists: true },
    },
    {
      id: 'basic-result-logging',
      name: 'Result Pattern Logging',
      file: 'basic/example-3.md',
      tags: ['logging:result-pattern', 'success:failure', 'extensions:utils'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Result pattern integration with success/failure logging',
      validation: { fileExists: true },
    },

    // Implementation and Use Cases
    {
      id: 'basic-implementation',
      name: 'Basic Implementation Guide',
      file: 'basic/implementation.md',
      tags: ['logging:implementation', 'setup:guide', 'best-practices'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Implementation guide for basic logging patterns',
      validation: { fileExists: true },
    },
    {
      id: 'basic-use-cases',
      name: 'Common Logging Use Cases',
      file: 'basic/use-case.md',
      tags: ['logging:use-cases', 'scenarios:common', 'patterns:practical'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Common logging scenarios and practical applications',
      validation: { fileExists: true },
    },

    // NestJS Framework Integration
    {
      id: 'nestjs-basic-manual',
      name: 'NestJS Basic Manual Setup',
      file: 'frameworks/nestjs/basic/example-1.md',
      tags: ['nestjs:basic', 'setup:manual', 'integration:framework'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic NestJS integration with manual logger setup',
      validation: { fileExists: true },
    },
    {
      id: 'nestjs-basic-service',
      name: 'NestJS Service Integration',
      file: 'frameworks/nestjs/basic/example-2.md',
      tags: ['nestjs:service', 'integration:complete', 'middleware:logging'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Complete NestJS service integration with logging middleware',
      validation: { fileExists: true },
    },
    {
      id: 'nestjs-intermediate-di',
      name: 'NestJS Advanced DI Integration',
      file: 'frameworks/nestjs/intermediate/example-1.md',
      tags: ['nestjs:di', 'vytches:ddd:integration', 'enterprise:logging'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced NestJS integration with VytchesDDD DI system',
      validation: { fileExists: true },
    },
    {
      id: 'nestjs-intermediate-monitoring',
      name: 'NestJS Enterprise Monitoring',
      file: 'frameworks/nestjs/intermediate/example-2.md',
      tags: ['nestjs:monitoring', 'enterprise:features', 'observability:complete'],
      complexity: 'intermediate',
      priority: 'medium',
      description: 'Enterprise monitoring and observability with structured logging',
      validation: { fileExists: true },
    },

    // Advanced Examples (2 examples)
    {
      id: 'advanced-enterprise-observability',
      name: 'Enterprise Observability with Distributed Tracing',
      file: 'advanced/example-1.md',
      tags: [
        'logging:advanced',
        'observability:enterprise',
        'tracing:distributed',
        'correlation:tracking',
      ],
      complexity: 'advanced',
      priority: 'high',
      description:
        'Enterprise-grade observability with comprehensive distributed tracing, correlation tracking, and performance monitoring',
      validation: { fileExists: true },
    },
    {
      id: 'nestjs-advanced-production',
      name: 'NestJS Production Logging Infrastructure',
      file: 'frameworks/nestjs/advanced/example-1.md',
      tags: [
        'nestjs:production',
        'infrastructure:logging',
        'monitoring:advanced',
        'alerting:automated',
      ],
      complexity: 'advanced',
      priority: 'high',
      description:
        'Production-ready logging infrastructure with NestJS integration, threat detection, and automated incident response',
      validation: { fileExists: true },
    },

    // Configuration and Infrastructure
    {
      id: 'logging-types',
      name: 'Logging Type Definitions',
      file: 'types/index.ts',
      tags: ['types:logging', 'interfaces:core', 'configuration:types'],
      complexity: 'basic',
      priority: 'low',
      description: 'Core logging type definitions and interfaces',
      validation: { fileExists: true },
    },
  ],

  tags: {
    core: ['logging:basic', 'logging:advanced'],
    integrations: ['nestjs:basic', 'nestjs:intermediate', 'nestjs:advanced'],
    frameworks: ['nestjs'],
    patterns: [
      'logging',
      'structured-logging',
      'context-detection',
      'observability',
      'distributed-tracing',
    ],
  },

  contentConfig: {
    showImportStatements: true,
    showErrorHandling: true,
    showTesting: false,
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
    cqrs: {
      priority: 'high',
      relationship: 'enables',
      integrationExamples: ['basic-cqrs-logging'],
    },
    utils: {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['basic-result-logging'],
    },
  },
};
