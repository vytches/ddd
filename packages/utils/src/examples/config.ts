// Temporarily removed PackageExampleConfig type to avoid circular dependency:
// utils -> contracts -> utils (through domain-event-utils.ts and validator.interfaces.ts)
// This config follows the same structure as PackageExampleConfig but without the import

export const packageExampleConfig = {
  packageName: 'utils',
  displayName: 'Utilities',
  description: 'Core utilities for DDD: Result pattern, safe execution, and helper functions',
  version: '1.0.0',
  domain: 'Core',
  patterns: ['result-pattern', 'safe-execution', 'utilities'],
  dependencies: ['uuid'],
  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: false,
      diRequired: false,
      description: 'Basic utility patterns'
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
      id: 'basic-result-pattern',
      name: 'Result Pattern Fundamentals',
      description: 'Basic Result pattern for error handling',
      file: 'basic/example-1.md',
      tags: ['utils:basic', 'result:pattern', 'error-handling'],
      complexity: 'basic',
      framework: 'none',
      priority: 'high',
    },
    {
      id: 'basic-safe-execution',
      name: 'Safe Execution with safeRun',
      description: 'Safe function execution for testing and error handling',
      file: 'basic/example-2.md',
      tags: ['utils:basic', 'safe-run:simple', 'testing'],
      complexity: 'basic',
      framework: 'none',
      priority: 'high',
    },
    {
      id: 'basic-lib-utils',
      name: 'Library Utilities',
      description: 'Core utility functions and helpers',
      file: 'basic/example-3.md',
      tags: ['utils:basic', 'lib-utils:core', 'helpers'],
      complexity: 'basic',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'basic-implementation',
      name: 'Basic Implementation Guide',
      description: 'Implementing basic utility patterns',
      file: 'basic/implementation.md',
      tags: ['utils:basic', 'implementation:guide'],
      complexity: 'basic',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'basic-use-case',
      name: 'Basic Use Cases',
      description: 'Real-world basic use cases',
      file: 'basic/use-case.md',
      tags: ['utils:basic', 'use-cases:real-world'],
      complexity: 'basic',
      framework: 'none',
      priority: 'medium',
    },

    // Intermediate Examples
    {
      id: 'intermediate-advanced-result',
      name: 'Advanced Result Patterns',
      description: 'Result chaining, transformation, and composition',
      file: 'intermediate/example-1.md',
      tags: ['utils:intermediate', 'result:advanced', 'composition'],
      complexity: 'intermediate',
      framework: 'none',
      priority: 'high',
    },
    {
      id: 'intermediate-async-patterns',
      name: 'Async Result Patterns',
      description: 'Asynchronous operations with Result pattern',
      file: 'intermediate/example-2.md',
      tags: ['utils:intermediate', 'async:patterns', 'promises'],
      complexity: 'intermediate',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'intermediate-error-aggregation',
      name: 'Error Aggregation Patterns',
      description: 'Collecting and managing multiple errors',
      file: 'intermediate/example-3.md',
      tags: ['utils:intermediate', 'errors:aggregation', 'validation'],
      complexity: 'intermediate',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'intermediate-implementation',
      name: 'Intermediate Implementation Guide',
      description: 'Advanced implementation patterns',
      file: 'intermediate/implementation.md',
      tags: ['utils:intermediate', 'implementation:advanced'],
      complexity: 'intermediate',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'intermediate-use-case',
      name: 'Intermediate Use Cases',
      description: 'Enterprise use cases',
      file: 'intermediate/use-case.md',
      tags: ['utils:intermediate', 'use-cases:enterprise'],
      complexity: 'intermediate',
      framework: 'none',
      priority: 'medium',
    },

    // Advanced Examples
    {
      id: 'advanced-monadic-operations',
      name: 'Monadic Operations',
      description: 'Advanced functional programming with Result monad',
      file: 'advanced/example-1.md',
      tags: ['utils:advanced', 'monads:operations', 'functional'],
      complexity: 'advanced',
      framework: 'none',
      priority: 'high',
    },
    {
      id: 'advanced-railway-programming',
      name: 'Railway-Oriented Programming',
      description: 'Implementing railway-oriented programming patterns',
      file: 'advanced/example-2.md',
      tags: ['utils:advanced', 'railway:programming', 'pipelines'],
      complexity: 'advanced',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'advanced-performance-optimization',
      name: 'Performance-Optimized Utilities',
      description: 'High-performance utility implementations',
      file: 'advanced/example-3.md',
      tags: ['utils:advanced', 'performance:optimization', 'algorithms'],
      complexity: 'advanced',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'advanced-implementation',
      name: 'Advanced Implementation Guide',
      description: 'Enterprise-grade implementation patterns',
      file: 'advanced/implementation.md',
      tags: ['utils:advanced', 'implementation:enterprise'],
      complexity: 'advanced',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'advanced-use-case',
      name: 'Advanced Use Cases',
      description: 'Global-scale use cases',
      file: 'advanced/use-case.md',
      tags: ['utils:advanced', 'use-cases:global'],
      complexity: 'advanced',
      framework: 'none',
      priority: 'medium',
    },

    // NestJS Framework Integration
    {
      id: 'nestjs-basic-manual',
      name: 'NestJS Basic Manual Setup',
      description: 'Manual Result pattern integration in NestJS',
      file: 'frameworks/nestjs/basic/example-1.md',
      tags: ['utils:framework', 'nestjs:basic', 'manual:setup'],
      complexity: 'basic',
      framework: 'nestjs',
      priority: 'high',
    },
    {
      id: 'nestjs-basic-di',
      name: 'NestJS Basic DI Integration',
      description: 'DI-based utility integration',
      file: 'frameworks/nestjs/basic/example-2.md',
      tags: ['utils:framework', 'nestjs:basic', 'di:integration'],
      complexity: 'basic',
      framework: 'nestjs',
      priority: 'high',
    },
    {
      id: 'nestjs-intermediate-manual',
      name: 'NestJS Intermediate Manual',
      description: 'Advanced utility patterns in NestJS',
      file: 'frameworks/nestjs/intermediate/example-1.md',
      tags: ['utils:framework', 'nestjs:intermediate', 'manual:advanced'],
      complexity: 'intermediate',
      framework: 'nestjs',
      priority: 'medium',
    },
    {
      id: 'nestjs-intermediate-di',
      name: 'NestJS Intermediate DI',
      description: 'Advanced DI utility patterns',
      file: 'frameworks/nestjs/intermediate/example-2.md',
      tags: ['utils:framework', 'nestjs:intermediate', 'di:advanced'],
      complexity: 'intermediate',
      framework: 'nestjs',
      priority: 'medium',
    },
    {
      id: 'nestjs-advanced-manual',
      name: 'NestJS Advanced Manual',
      description: 'Enterprise utility orchestration',
      file: 'frameworks/nestjs/advanced/example-1.md',
      tags: ['utils:framework', 'nestjs:advanced', 'manual:enterprise'],
      complexity: 'advanced',
      framework: 'nestjs',
      priority: 'medium',
    },
    {
      id: 'nestjs-advanced-di',
      name: 'NestJS Advanced DI',
      description: 'High-performance utilities with DI',
      file: 'frameworks/nestjs/advanced/example-2.md',
      tags: ['utils:framework', 'nestjs:advanced', 'di:performance'],
      complexity: 'advanced',
      framework: 'nestjs',
      priority: 'medium',
    },
  ],

  tags: {
    core: ['utils:basic', 'utils:intermediate', 'utils:advanced'],
    integrations: ['nestjs:basic', 'nestjs:intermediate', 'nestjs:advanced'],
    frameworks: ['nestjs'],
    patterns: ['result-pattern', 'safe-execution', 'utilities']
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
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['basic-result-pattern']
    }
  }

};
