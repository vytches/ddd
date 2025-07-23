import type { PackageExampleConfig } from '@vytches-ddd/contracts';

export const packageExampleConfig: PackageExampleConfig = {
  packageName: 'domain-primitives',
  displayName: 'Domain Primitives',
  description: 'Core building blocks for DDD: errors, actors, and domain interfaces',
  version: '1.0.0',
  domain: 'Core',
  patterns: ['error-handling', 'actors', 'interfaces'],
  dependencies: ['@vytches-ddd/utils'],
  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: false,
      diRequired: false,
      description: 'Basic domain primitives patterns'
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
      id: 'basic-errors-simple',
      name: 'Simple Domain Errors',
      description: 'Basic error handling with domain context',
      file: 'basic/example-1.md',
      tags: ['domain-primitives:basic', 'error-handling:simple', 'foundation'],
      complexity: 'basic',
      framework: 'none',
      priority: 'high',
    },
    {
      id: 'basic-actors-simple',
      name: 'Simple Actor Pattern',
      description: 'Basic actor implementation for action tracking',
      file: 'basic/example-2.md',
      tags: ['domain-primitives:basic', 'actors:simple', 'audit'],
      complexity: 'basic',
      framework: 'none',
      priority: 'high',
    },
    {
      id: 'basic-domain-interfaces',
      name: 'Domain Interface Patterns',
      description: 'Essential domain interfaces and contracts',
      file: 'basic/example-3.md',
      tags: ['domain-primitives:basic', 'interfaces:core', 'contracts'],
      complexity: 'basic',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'basic-implementation',
      name: 'Basic Implementation Guide',
      description: 'Implementing basic domain primitives',
      file: 'basic/implementation.md',
      tags: ['domain-primitives:basic', 'implementation:guide'],
      complexity: 'basic',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'basic-use-case',
      name: 'Basic Use Cases',
      description: 'Real-world basic use cases',
      file: 'basic/use-case.md',
      tags: ['domain-primitives:basic', 'use-cases:real-world'],
      complexity: 'basic',
      framework: 'none',
      priority: 'medium',
    },

    // Intermediate Examples
    {
      id: 'intermediate-error-hierarchies',
      name: 'Advanced Error Hierarchies',
      description: 'Complex error inheritance and categorization',
      file: 'intermediate/example-1.md',
      tags: ['domain-primitives:intermediate', 'error-handling:advanced', 'hierarchies'],
      complexity: 'intermediate',
      framework: 'none',
      priority: 'high',
    },
    {
      id: 'intermediate-actor-contexts',
      name: 'Context-Aware Actors',
      description: 'Actors with rich context and metadata',
      file: 'intermediate/example-2.md',
      tags: ['domain-primitives:intermediate', 'actors:context', 'metadata'],
      complexity: 'intermediate',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'intermediate-composite-patterns',
      name: 'Composite Domain Patterns',
      description: 'Combining primitives for complex domains',
      file: 'intermediate/example-3.md',
      tags: ['domain-primitives:intermediate', 'patterns:composite', 'architecture'],
      complexity: 'intermediate',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'intermediate-implementation',
      name: 'Intermediate Implementation Guide',
      description: 'Advanced implementation patterns',
      file: 'intermediate/implementation.md',
      tags: ['domain-primitives:intermediate', 'implementation:advanced'],
      complexity: 'intermediate',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'intermediate-use-case',
      name: 'Intermediate Use Cases',
      description: 'Enterprise use cases',
      file: 'intermediate/use-case.md',
      tags: ['domain-primitives:intermediate', 'use-cases:enterprise'],
      complexity: 'intermediate',
      framework: 'none',
      priority: 'medium',
    },

    // Advanced Examples
    {
      id: 'advanced-distributed-errors',
      name: 'Distributed Error Management',
      description: 'Error handling across microservices',
      file: 'advanced/example-1.md',
      tags: ['domain-primitives:advanced', 'error-handling:distributed', 'microservices'],
      complexity: 'advanced',
      framework: 'none',
      priority: 'high',
    },
    {
      id: 'advanced-actor-orchestration',
      name: 'Actor Orchestration System',
      description: 'Multi-actor coordination and orchestration',
      file: 'advanced/example-2.md',
      tags: ['domain-primitives:advanced', 'actors:orchestration', 'coordination'],
      complexity: 'advanced',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'advanced-ai-enhanced-primitives',
      name: 'AI-Enhanced Domain Primitives',
      description: 'ML-powered error prediction and actor intelligence',
      file: 'advanced/example-3.md',
      tags: ['domain-primitives:advanced', 'ai:integration', 'ml:patterns'],
      complexity: 'advanced',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'advanced-implementation',
      name: 'Advanced Implementation Guide',
      description: 'Enterprise-grade implementation patterns',
      file: 'advanced/implementation.md',
      tags: ['domain-primitives:advanced', 'implementation:enterprise'],
      complexity: 'advanced',
      framework: 'none',
      priority: 'medium',
    },
    {
      id: 'advanced-use-case',
      name: 'Advanced Use Cases',
      description: 'Global-scale use cases',
      file: 'advanced/use-case.md',
      tags: ['domain-primitives:advanced', 'use-cases:global'],
      complexity: 'advanced',
      framework: 'none',
      priority: 'medium',
    },

    // NestJS Framework Integration
    {
      id: 'nestjs-basic-manual',
      name: 'NestJS Basic Manual Setup',
      description: 'Manual error and actor setup in NestJS',
      file: 'frameworks/nestjs/basic/example-1.md',
      tags: ['domain-primitives:framework', 'nestjs:basic', 'manual:setup'],
      complexity: 'basic',
      framework: 'nestjs',
      priority: 'high',
    },
    {
      id: 'nestjs-basic-di',
      name: 'NestJS Basic DI Integration',
      description: 'DI-based primitives integration',
      file: 'frameworks/nestjs/basic/example-2.md',
      tags: ['domain-primitives:framework', 'nestjs:basic', 'di:integration'],
      complexity: 'basic',
      framework: 'nestjs',
      priority: 'high',
    },
    {
      id: 'nestjs-intermediate-manual',
      name: 'NestJS Intermediate Manual',
      description: 'Advanced error handling patterns',
      file: 'frameworks/nestjs/intermediate/example-1.md',
      tags: ['domain-primitives:framework', 'nestjs:intermediate', 'manual:advanced'],
      complexity: 'intermediate',
      framework: 'nestjs',
      priority: 'medium',
    },
    {
      id: 'nestjs-intermediate-di',
      name: 'NestJS Intermediate DI',
      description: 'Context-aware DI patterns',
      file: 'frameworks/nestjs/intermediate/example-2.md',
      tags: ['domain-primitives:framework', 'nestjs:intermediate', 'di:advanced'],
      complexity: 'intermediate',
      framework: 'nestjs',
      priority: 'medium',
    },
    {
      id: 'nestjs-advanced-manual',
      name: 'NestJS Advanced Manual',
      description: 'Enterprise error orchestration',
      file: 'frameworks/nestjs/advanced/example-1.md',
      tags: ['domain-primitives:framework', 'nestjs:advanced', 'manual:enterprise'],
      complexity: 'advanced',
      framework: 'nestjs',
      priority: 'medium',
    },
    {
      id: 'nestjs-advanced-di',
      name: 'NestJS Advanced DI',
      description: 'AI-enhanced primitives with DI',
      file: 'frameworks/nestjs/advanced/example-2.md',
      tags: ['domain-primitives:framework', 'nestjs:advanced', 'di:ai'],
      complexity: 'advanced',
      framework: 'nestjs',
      priority: 'medium',
    },
  ],

  tags: {
    core: ['domain-primitives:basic', 'domain-primitives:intermediate', 'domain-primitives:advanced'],
    integrations: ['nestjs:basic', 'nestjs:intermediate', 'nestjs:advanced'],
    frameworks: ['nestjs'],
    patterns: ['error-handling', 'actors', 'interfaces']
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
    'utils': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['basic-errors-simple']
    },
    'di': {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['nestjs-basic-di']
    }
  },
};
