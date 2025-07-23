import type { PackageExampleConfig } from '@vytches-ddd/contracts';

export const config: PackageExampleConfig = {
  packageName: 'events',
  displayName: 'Unified Event System',
  version: '1.0.0',
  description: 'Unified Event System provides a consolidated event handling architecture with automatic event publishing through repository pattern and comprehensive event management.',
  domain: 'Architecture',
  patterns: ['event-driven-architecture', 'domain-events', 'integration-events', 'repository-pattern'],
  tags: {
    core: ['events:core', 'events:domain', 'events:integration', 'events:unified'],
    integrations: ['events:repository', 'events:handlers', 'events:dispatcher', 'events:bus'],
    frameworks: ['events:nestjs', 'events:express', 'events:fastify'],
    patterns: ['events:aggregate', 'events:publishing', 'events:context', 'events:batch']
  },
  dependencies: ['@vytches-ddd/core', '@vytches-ddd/events', '@vytches-ddd/utils'],
  sections: [
    'hero',
    'description', 
    'whenToUse',
    'whenNotToUse',
    'examples',
    'useCases',
    'frameworkIntegration',
    'commonPitfalls',
    'troubleshooting',
    'performance'
  ],
  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: true,
      diRequired: false,
      description: 'Basic event publishing with repository pattern'
    },
    intermediate: {
      level: 'intermediate',
      diSupport: true,
      diRequired: true,
      description: 'Advanced event handling with context filtering and batch processing'
    },
    advanced: {
      level: 'advanced',
      diSupport: true,
      diRequired: true,
      description: 'Enterprise event system with event sourcing and projections'
    }
  },
  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description: 'Integration with NestJS framework',
      complexityLevels: ['basic', 'intermediate', 'advanced'],
      dependencies: ['@nestjs/common', '@nestjs/cqrs']
    },
    {
      name: 'express',
      displayName: 'Express',
      description: 'Integration with Express framework',
      complexityLevels: ['basic', 'intermediate'],
      dependencies: ['express']
    }
  ],
  examples: [
    // Basic Examples
    {
      id: 'basic-repository-pattern',
      name: 'Repository Pattern with Event Publishing',
      file: 'basic/example-1.md',
      tags: ['events:core', 'events:repository', 'domain-events', 'automatic-publishing'],
      complexity: 'basic',
      priority: 'high',
      description: 'Core repository pattern with automatic event publishing when aggregates are saved',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/repositories', '@vytches-ddd/aggregates']
    },
    {
      id: 'basic-event-handlers',
      name: 'Event Handlers with Context Filtering',
      file: 'basic/example-2.md',
      tags: ['events:handlers', 'events:context', 'events:filtering'],
      complexity: 'basic',
      priority: 'high',
      description: 'Creating event handlers that automatically respond to published domain events',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/di']
    },
    {
      id: 'basic-context-aware',
      name: 'Context-Aware Event Processing',
      file: 'basic/example-3.md',
      tags: ['events:context', 'events:multi-tenant', 'events:routing'],
      complexity: 'basic',
      priority: 'high',
      description: 'Multi-tenant event processing with context-based filtering and routing',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/utils']
    },
    {
      id: 'basic-implementation-overview',
      name: 'Implementation Overview',
      file: 'basic/implementation.md',
      tags: ['events:overview', 'events:getting-started'],
      complexity: 'basic',
      priority: 'medium',
      description: 'High-level overview of event system implementation patterns',
      dependencies: ['@vytches-ddd/events']
    },
    {
      id: 'basic-use-cases',
      name: 'Business Use Cases',
      file: 'basic/use-case.md',
      tags: ['events:use-cases', 'events:business-scenarios'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Real-world business scenarios and use cases for event-driven architecture',
      dependencies: ['@vytches-ddd/events']
    },
    // Intermediate Examples
    {
      id: 'intermediate-batch-processing',
      name: 'Batch Event Processing',
      file: 'intermediate/example-1.md',
      tags: ['events:batch', 'events:performance', 'events:optimization'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'High-performance batch processing and bulk event publishing for large volumes',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/di', '@vytches-ddd/utils']
    },
    {
      id: 'intermediate-event-deduplication',
      name: 'Event Deduplication and Idempotency',
      file: 'intermediate/example-2.md',
      tags: ['events:deduplication', 'events:idempotency', 'events:reliability'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced event deduplication and idempotency handling for distributed systems',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/utils', '@vytches-ddd/logging']
    },
    {
      id: 'intermediate-event-middleware',
      name: 'Event Middleware and Pipeline Processing',
      file: 'intermediate/example-3.md',
      tags: ['events:middleware', 'events:pipeline', 'events:cross-cutting'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced event middleware system for cross-cutting concerns in event processing',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/utils', '@vytches-ddd/logging']
    },
    // Advanced Examples
    {
      id: 'advanced-event-sourcing',
      name: 'Event Sourcing with Snapshots',
      file: 'advanced/example-1.md',
      tags: ['events:event-sourcing', 'events:snapshots', 'events:aggregate-reconstruction'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Advanced event sourcing implementation with snapshot optimization for aggregate reconstruction',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/aggregates', '@vytches-ddd/event-store']
    },
    {
      id: 'advanced-stream-processing',
      name: 'Event Stream Processing with Real-time Analytics',
      file: 'advanced/example-2.md',
      tags: ['events:stream-processing', 'events:real-time-analytics', 'events:windowing'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Advanced event stream processing with real-time analytics and complex event processing',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/utils', '@vytches-ddd/logging']
    },
    {
      id: 'advanced-event-mesh',
      name: 'Enterprise Event Mesh Architecture',
      file: 'advanced/example-3.md',
      tags: ['events:event-mesh', 'events:distributed', 'events:microservices'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise-grade event mesh architecture for distributed microservices communication',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/resilience', '@vytches-ddd/logging', '@vytches-ddd/messaging']
    },
    {
      id: 'advanced-implementation-guide',
      name: 'Advanced Implementation Guide',
      file: 'advanced/implementation.md',
      tags: ['events:implementation', 'events:enterprise-patterns'],
      complexity: 'advanced',
      priority: 'medium',
      description: 'Comprehensive implementation patterns for advanced event-driven architectures',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/event-store', '@vytches-ddd/resilience']
    },
    {
      id: 'advanced-use-cases',
      name: 'Enterprise Use Cases',
      file: 'advanced/use-case.md',
      tags: ['events:use-cases', 'events:enterprise-scenarios'],
      complexity: 'advanced',
      priority: 'medium',
      description: 'Enterprise use cases and real-world applications of advanced event systems',
      dependencies: ['@vytches-ddd/events']
    },
    // Framework Examples - NestJS
    {
      id: 'nestjs-manual-setup',
      name: 'NestJS Manual Setup',
      file: 'frameworks/nestjs/basic/manual-setup.md',
      tags: ['events:nestjs', 'events:manual', 'framework:nestjs'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic NestJS integration with manual event system setup',
      dependencies: ['@nestjs/common', '@vytches-ddd/events']
    },
    {
      id: 'nestjs-basic-integration',
      name: 'NestJS Basic Integration',
      file: 'frameworks/nestjs/basic/example-1.md',
      tags: ['events:nestjs', 'events:repository-pattern', 'framework:nestjs'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic NestJS integration with automatic event publishing through repository pattern',
      dependencies: ['@nestjs/common', '@vytches-ddd/events', '@vytches-ddd/repositories']
    },
    {
      id: 'nestjs-di-integration',
      name: 'NestJS DI Integration',
      file: 'frameworks/nestjs/basic/example-2.md',
      tags: ['events:nestjs', 'events:di', 'framework:nestjs'],
      complexity: 'basic',
      priority: 'high',
      description: 'NestJS integration using @vytches-ddd/di service locator pattern',
      dependencies: ['@nestjs/common', '@vytches-ddd/events', '@vytches-ddd/di']
    },
    {
      id: 'nestjs-intermediate-integration',
      name: 'NestJS Intermediate Integration',
      file: 'frameworks/nestjs/intermediate/example-1.md',
      tags: ['events:nestjs', 'events:batch', 'events:resilience', 'framework:nestjs'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced NestJS integration with batch processing and resilience patterns',
      dependencies: ['@nestjs/common', '@vytches-ddd/events', '@vytches-ddd/di', '@vytches-ddd/resilience']
    },
    {
      id: 'nestjs-advanced-integration',
      name: 'NestJS Advanced Integration',
      file: 'frameworks/nestjs/advanced/example-1.md',
      tags: ['events:nestjs', 'events:event-sourcing', 'events:event-mesh', 'framework:nestjs'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise-grade NestJS integration with event sourcing and complex event processing',
      dependencies: ['@nestjs/common', '@vytches-ddd/events', '@vytches-ddd/event-store', '@vytches-ddd/di', '@vytches-ddd/resilience']
    }
  ],
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
  relatedPackages: {
    'repositories': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['aggregate-events', 'repository-integration']
    },
    'aggregates': {
      priority: 'high',
      relationship: 'consumes-from',
      integrationExamples: ['aggregate-events', 'domain-events']
    },
    'event-store': {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['event-sourcing', 'event-persistence']
    },
    'projections': {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['event-projections', 'read-models']
    }
  }
};