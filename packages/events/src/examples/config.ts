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
    {
      id: 'basic-event-publishing',
      name: 'Basic Event Publishing',
      file: 'basic/implementation.md',
      tags: ['events:core', 'events:repository', 'domain-events'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic event publishing through repository pattern with automatic event handling',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/repositories', '@vytches-ddd/utils']
    },
    {
      id: 'intermediate-event-handling',
      name: 'Advanced Event Handling',
      file: 'intermediate/implementation.md',
      tags: ['events:advanced', 'events:context', 'events:batch'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced event handling with context filtering and batch processing',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/di', '@vytches-ddd/utils']
    },
    {
      id: 'advanced-event-sourcing',
      name: 'Event Sourcing System',
      file: 'advanced/implementation.md',
      tags: ['events:sourcing', 'events:projections', 'events:enterprise'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise event sourcing with projections and event store integration',
      dependencies: ['@vytches-ddd/events', '@vytches-ddd/event-store', '@vytches-ddd/projections', '@vytches-ddd/di']
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