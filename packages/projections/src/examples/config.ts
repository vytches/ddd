import type { PackageExampleConfig } from '@vytches-ddd/contracts';

export const packageExampleConfig: PackageExampleConfig = {
  packageName: 'projections',
  displayName: 'Event Projections',
  version: '1.0.0',
  description: 'Event projections system with capabilities, engines, and advanced orchestration patterns',
  domain: 'Architecture',
  patterns: ['projection-pattern', 'event-sourcing', 'cqrs'],
  dependencies: ['@vytches-ddd/events', '@vytches-ddd/domain-primitives'],

  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: false,
      diRequired: false,
      description: 'Basic projection patterns'
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
    // Basic Level Examples
    {
      id: 'projections-basic-simple',
      name: 'Simple Event Projection',
      file: 'basic/example-1.md',
      tags: ['projections:basic', 'event-sourcing:simple', 'read-models:basic'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic event projection implementation for user data views',
      validation: { fileExists: true }
    },
    {
      id: 'projections-basic-capabilities',
      name: 'Projection with Capabilities',
      file: 'basic/example-2.md',
      tags: ['projections:basic', 'capabilities:checkpoint', 'resilience:basic'],
      complexity: 'basic',
      priority: 'high',
      description: 'Event projection enhanced with checkpoint and circuit-breaker capabilities',
      validation: { fileExists: true }
    },
    {
      id: 'projections-basic-engine',
      name: 'Projection Engine Setup',
      file: 'basic/example-3.md',
      tags: ['projections:basic', 'engine:setup', 'orchestration:simple'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Projection engine with multiple projections and basic management',
      validation: { fileExists: true }
    },
    {
      id: 'projections-basic-implementation',
      name: 'Basic Implementation Guide',
      file: 'basic/implementation.md',
      tags: ['projections:basic', 'implementation:guide', 'setup:basic'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Comprehensive guide to implementing basic event projections',
      validation: { fileExists: true }
    },
    {
      id: 'projections-basic-use-cases',
      name: 'Basic Use Cases',
      file: 'basic/use-case.md',
      tags: ['projections:basic', 'use-cases:real-world', 'examples:business'],
      complexity: 'basic',
      priority: 'low',
      description: 'Real-world use cases for basic event projection patterns',
      validation: { fileExists: true }
    },

    // Intermediate Level Examples
    {
      id: 'projections-intermediate-rebuilder',
      name: 'Projection Rebuilding System',
      file: 'intermediate/example-1.md',
      tags: ['projections:intermediate', 'rebuilding:system', 'snapshots:optimization'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced projection rebuilding with snapshots and optimization',
      validation: { fileExists: true }
    },
    {
      id: 'projections-intermediate-multi-tenant',
      name: 'Multi-Tenant Projections',
      file: 'intermediate/example-2.md',
      tags: ['projections:intermediate', 'multi-tenant:saas', 'isolation:data'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'SaaS projection system with tenant isolation and scaling',
      validation: { fileExists: true }
    },
    {
      id: 'projections-intermediate-analytics',
      name: 'Real-Time Analytics Projections',
      file: 'intermediate/example-3.md',
      tags: ['projections:intermediate', 'analytics:real-time', 'metrics:business'],
      complexity: 'intermediate',
      priority: 'medium',
      description: 'Business intelligence projections with real-time analytics',
      validation: { fileExists: true }
    },
    {
      id: 'projections-intermediate-implementation',
      name: 'Intermediate Implementation Guide',
      file: 'intermediate/implementation.md',
      tags: ['projections:intermediate', 'implementation:guide', 'patterns:advanced'],
      complexity: 'intermediate',
      priority: 'medium',
      description: 'Advanced implementation patterns for scalable projections',
      validation: { fileExists: true }
    },
    {
      id: 'projections-intermediate-use-cases',
      name: 'Intermediate Use Cases',
      file: 'intermediate/use-case.md',
      tags: ['projections:intermediate', 'use-cases:enterprise', 'scaling:patterns'],
      complexity: 'intermediate',
      priority: 'low',
      description: 'Enterprise use cases for intermediate projection patterns',
      validation: { fileExists: true }
    },

    // Advanced Level Examples
    {
      id: 'projections-advanced-orchestration',
      name: 'Global Projection Orchestration',
      file: 'advanced/example-1.md',
      tags: ['projections:advanced', 'orchestration:global', 'coordination:distributed'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise-scale projection orchestration across multiple regions',
      validation: { fileExists: true }
    },
    {
      id: 'projections-advanced-ai-enhanced',
      name: 'AI-Enhanced Projections',
      file: 'advanced/example-2.md',
      tags: ['projections:advanced', 'ai:integration', 'ml:predictions'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Machine learning enhanced projections with predictive analytics',
      validation: { fileExists: true }
    },
    {
      id: 'projections-advanced-stream-processing',
      name: 'High-Performance Stream Processing',
      file: 'advanced/example-3.md',
      tags: ['projections:advanced', 'streaming:high-performance', 'optimization:extreme'],
      complexity: 'advanced',
      priority: 'medium',
      description: 'Extreme performance projections for high-throughput systems',
      validation: { fileExists: true }
    },
    {
      id: 'projections-advanced-implementation',
      name: 'Advanced Implementation Guide',
      file: 'advanced/implementation.md',
      tags: ['projections:advanced', 'implementation:enterprise', 'architecture:distributed'],
      complexity: 'advanced',
      priority: 'medium',
      description: 'Enterprise-grade implementation strategies for complex projection systems',
      validation: { fileExists: true }
    },
    {
      id: 'projections-advanced-use-cases',
      name: 'Advanced Use Cases',
      file: 'advanced/use-case.md',
      tags: ['projections:advanced', 'use-cases:global', 'systems:mission-critical'],
      complexity: 'advanced',
      priority: 'low',
      description: 'Global-scale use cases for mission-critical projection systems',
      validation: { fileExists: true }
    },

    // NestJS Framework Integration
    {
      id: 'projections-nestjs-basic-manual',
      name: 'NestJS Basic Manual Setup',
      file: 'frameworks/nestjs/basic/example-1.md',
      tags: ['projections:nestjs', 'framework:nestjs', 'setup:manual'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Basic NestJS projection setup with manual service registration',
      validation: { fileExists: true }
    },
    {
      id: 'projections-nestjs-basic-di',
      name: 'NestJS Basic DI Integration',
      file: 'frameworks/nestjs/basic/example-2.md',
      tags: ['projections:nestjs', 'framework:nestjs', 'di:basic'],
      complexity: 'basic',
      priority: 'medium',
      description: 'NestJS projection with basic dependency injection patterns',
      validation: { fileExists: true }
    },
    {
      id: 'projections-nestjs-intermediate-advanced-di',
      name: 'NestJS Advanced DI Integration',
      file: 'frameworks/nestjs/intermediate/example-1.md',
      tags: ['projections:nestjs', 'framework:nestjs', 'di:advanced'],
      complexity: 'intermediate',
      priority: 'medium',
      description: 'Advanced NestJS integration with VytchesDDD DI system',
      validation: { fileExists: true }
    },
    {
      id: 'projections-nestjs-intermediate-capabilities',
      name: 'NestJS with Projection Capabilities',
      file: 'frameworks/nestjs/intermediate/example-2.md',
      tags: ['projections:nestjs', 'framework:nestjs', 'capabilities:integration'],
      complexity: 'intermediate',
      priority: 'low',
      description: 'NestJS projection service with full capability integration',
      validation: { fileExists: true }
    },
    {
      id: 'projections-nestjs-advanced-orchestration',
      name: 'NestJS Enterprise Orchestration',
      file: 'frameworks/nestjs/advanced/example-1.md',
      tags: ['projections:nestjs', 'framework:nestjs', 'orchestration:enterprise'],
      complexity: 'advanced',
      priority: 'low',
      description: 'Enterprise NestJS projection orchestration with microservices',
      validation: { fileExists: true }
    }
  ],

  tags: {
    core: ['projections:basic', 'projections:intermediate', 'projections:advanced'],
    integrations: ['nestjs:basic', 'nestjs:intermediate', 'nestjs:advanced'],
    frameworks: ['nestjs'],
    patterns: ['projection-pattern', 'event-sourcing', 'cqrs']
  },

  contentConfig: {
    showImportStatements: true,
    showErrorHandling: true,
    showTesting: true,
    showPerformance: true,
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
    'events': {
      priority: 'high',
      relationship: 'consumes-from',
      integrationExamples: ['projections-basic-simple']
    },
    'aggregates': {
      priority: 'high',
      relationship: 'consumes-from',
      integrationExamples: ['projections-intermediate-rebuilder']
    }
  }
};

