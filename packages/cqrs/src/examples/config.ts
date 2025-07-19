import type { PackageExampleConfig } from '@vytches-ddd/contracts';

export const config: PackageExampleConfig = {
  packageName: 'cqrs',
  displayName: 'CQRS & Command Query Separation',
  version: '1.0.0',
  description: 'CQRS provides comprehensive Command Query Responsibility Segregation patterns including Command & Query Buses, Handlers, and Middleware for scalable application architecture.',
  domain: 'Architecture',
  patterns: ['cqrs', 'command-query-separation', 'command-bus', 'query-bus', 'handler-pattern', 'middleware-pattern'],
  tags: {
    core: ['cqrs:core', 'cqrs:commands', 'cqrs:queries', 'cqrs:handlers', 'cqrs:buses'],
    integrations: ['cqrs:events', 'cqrs:validation', 'cqrs:policies', 'cqrs:resilience', 'cqrs:di'],
    frameworks: ['cqrs:nestjs', 'cqrs:express', 'cqrs:fastify'],
    patterns: ['cqrs:command-bus', 'cqrs:query-bus', 'cqrs:middleware', 'cqrs:validation', 'cqrs:logging']
  },
  dependencies: ['@vytches-ddd/core', '@vytches-ddd/cqrs', '@vytches-ddd/utils'],
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
      diSupport: false,
      diRequired: false,
      description: 'Basic CQRS with commands, queries, and handlers'
    },
    intermediate: {
      level: 'intermediate',
      diSupport: true,
      diRequired: false,
      description: 'Advanced CQRS with middleware, validation, and event integration'
    },
    advanced: {
      level: 'advanced',
      diSupport: true,
      diRequired: true,
      description: 'Enterprise CQRS with comprehensive middleware, policies, and distributed processing'
    }
  },
  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description: 'Integration with NestJS framework',
      complexityLevels: ['basic', 'intermediate', 'advanced'],
      dependencies: ['@nestjs/common', '@nestjs/cqrs', '@nestjs/microservices']
    },
    {
      name: 'express',
      displayName: 'Express',
      description: 'Integration with Express framework',
      complexityLevels: ['basic', 'intermediate'],
      dependencies: ['express', 'express-validator']
    }
  ],
  examples: [
    {
      id: 'basic-cqrs-commands-queries',
      name: 'Basic CQRS with Commands & Queries',
      file: 'basic/implementation.md',
      tags: ['cqrs:core', 'cqrs:commands', 'cqrs:queries', 'cqrs:handlers'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic CQRS implementation with commands, queries, and handlers for application architecture',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/utils']
    },
    {
      id: 'intermediate-cqrs-middleware',
      name: 'Advanced CQRS with Middleware & Integration',
      file: 'intermediate/implementation.md',
      tags: ['cqrs:middleware', 'cqrs:validation', 'cqrs:events'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced CQRS patterns with middleware, validation, and event integration',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/validation', '@vytches-ddd/events', '@vytches-ddd/di']
    },
    {
      id: 'advanced-enterprise-cqrs',
      name: 'Enterprise CQRS Orchestration',
      file: 'advanced/implementation.md',
      tags: ['cqrs:enterprise', 'cqrs:policies', 'cqrs:messaging', 'cqrs:orchestration'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise CQRS with comprehensive middleware, policies, and distributed processing',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/policies', '@vytches-ddd/events', '@vytches-ddd/messaging', '@vytches-ddd/resilience', '@vytches-ddd/di']
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
      integrationExamples: ['cqrs-events', 'event-driven-commands']
    },
    'validation': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['command-validation', 'query-validation']
    },
    'policies': {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['policy-commands', 'cqrs-policies']
    },
    'messaging': {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['command-messaging', 'distributed-cqrs']
    },
    'resilience': {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['resilient-commands', 'cqrs-resilience']
    }
  }
};