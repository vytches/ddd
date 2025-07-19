import type { PackageExampleConfig } from '@vytches-ddd/contracts';

export const config: PackageExampleConfig = {
  packageName: 'messaging',
  displayName: 'Messaging & Sagas',
  version: '1.0.0',
  description: 'Messaging & Sagas provides comprehensive messaging patterns including Outbox Pattern, Message Queues, and Saga orchestration for reliable distributed communication.',
  domain: 'Integration',
  patterns: ['outbox-pattern', 'message-queues', 'saga-orchestration', 'reliable-messaging', 'event-sourcing'],
  tags: {
    core: ['messaging:core', 'messaging:outbox', 'messaging:reliable', 'messaging:sagas'],
    integrations: ['messaging:events', 'messaging:resilience', 'messaging:policies', 'messaging:di'],
    frameworks: ['messaging:nestjs', 'messaging:express', 'messaging:fastify'],
    patterns: ['messaging:outbox', 'messaging:saga', 'messaging:queue', 'messaging:batch', 'messaging:retry']
  },
  dependencies: ['@vytches-ddd/core', '@vytches-ddd/messaging', '@vytches-ddd/utils'],
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
      description: 'Basic outbox pattern with reliable message delivery'
    },
    intermediate: {
      level: 'intermediate',
      diSupport: true,
      diRequired: true,
      description: 'Advanced messaging with events integration and resilience patterns'
    },
    advanced: {
      level: 'advanced',
      diSupport: true,
      diRequired: true,
      description: 'Enterprise saga orchestration with policies and comprehensive fault tolerance'
    }
  },
  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description: 'Integration with NestJS framework',
      complexityLevels: ['basic', 'intermediate', 'advanced'],
      dependencies: ['@nestjs/common', '@nestjs/cqrs', '@nestjs/bull']
    },
    {
      name: 'express',
      displayName: 'Express',
      description: 'Integration with Express framework',
      complexityLevels: ['basic', 'intermediate'],
      dependencies: ['express', 'bull']
    }
  ],
  examples: [
    {
      id: 'basic-outbox-pattern',
      name: 'Basic Outbox Pattern',
      file: 'basic/implementation.md',
      tags: ['messaging:core', 'messaging:outbox', 'reliable-messaging'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic outbox pattern for reliable message delivery in distributed systems',
      dependencies: ['@vytches-ddd/messaging', '@vytches-ddd/utils']
    },
    {
      id: 'intermediate-messaging-events',
      name: 'Messaging with Events & Resilience',
      file: 'intermediate/implementation.md',
      tags: ['messaging:advanced', 'messaging:events', 'messaging:resilience'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced messaging patterns integrated with events system and resilience',
      dependencies: ['@vytches-ddd/messaging', '@vytches-ddd/events', '@vytches-ddd/resilience', '@vytches-ddd/di']
    },
    {
      id: 'advanced-saga-orchestration',
      name: 'Enterprise Saga Orchestration',
      file: 'advanced/implementation.md',
      tags: ['messaging:sagas', 'messaging:orchestration', 'messaging:policies', 'messaging:enterprise'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise saga orchestration with policies, events, and comprehensive fault tolerance',
      dependencies: ['@vytches-ddd/messaging', '@vytches-ddd/policies', '@vytches-ddd/events', '@vytches-ddd/resilience', '@vytches-ddd/di']
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
    'events': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['outbox-events', 'saga-events']
    },
    'resilience': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['resilient-messaging', 'saga-resilience']
    },
    'policies': {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['messaging-policies', 'saga-policies']
    },
    'repositories': {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['outbox-persistence', 'saga-persistence']
    }
  }
};