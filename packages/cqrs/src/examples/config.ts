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
      id: 'command-handlers-automatic-registration',
      name: 'Command Handlers with Automatic Registration',
      file: 'basic/example-1.md',
      tags: ['cqrs:commands', 'cqrs:handlers', 'cqrs:validation'],
      complexity: 'basic',
      priority: 'high',
      description: 'Command handlers with automatic registration, validation, and business logic processing',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/di', '@vytches-ddd/utils']
    },
    {
      id: 'query-handlers-caching-optimization',
      name: 'Query Handlers with Caching and Performance Optimization',
      file: 'basic/example-2.md',
      tags: ['cqrs:queries', 'cqrs:handlers', 'cqrs:caching', 'cqrs:performance'],
      complexity: 'basic',
      priority: 'high',
      description: 'Query handlers with intelligent caching, pagination, and performance optimization strategies',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/di', '@vytches-ddd/utils']
    },
    {
      id: 'middleware-pipeline-cross-cutting-concerns',
      name: 'Middleware Pipeline for Cross-Cutting Concerns',
      file: 'basic/example-3.md',
      tags: ['cqrs:middleware', 'cqrs:validation', 'cqrs:logging', 'cqrs:performance'],
      complexity: 'basic',
      priority: 'high',
      description: 'Middleware pipeline for validation, logging, performance monitoring, and error handling',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/logging', '@vytches-ddd/validation']
    },
    {
      id: 'event-integration-cqrs-operations',
      name: 'Event Integration with CQRS Operations',
      file: 'intermediate/example-1.md',
      tags: ['cqrs:events', 'cqrs:integration', 'cqrs:projections'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced CQRS integration with event publishing, projections, and cross-context communication',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/events', '@vytches-ddd/di', '@vytches-ddd/utils']
    },
    {
      id: 'policy-based-authorization-cqrs',
      name: 'CQRS with Policy-Based Authorization',
      file: 'intermediate/example-2.md',
      tags: ['cqrs:policies', 'cqrs:authorization', 'cqrs:security'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Integrating policy-based authorization with CQRS patterns for secure command and query processing',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/policies', '@vytches-ddd/di', '@vytches-ddd/utils']
    },
    {
      id: 'distributed-tracing-observability',
      name: 'CQRS with Distributed Tracing and Observability',
      file: 'intermediate/example-3.md',
      tags: ['cqrs:observability', 'cqrs:tracing', 'cqrs:monitoring'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Implementing comprehensive observability for CQRS operations in distributed systems',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/logging', '@vytches-ddd/resilience', '@vytches-ddd/utils']
    },
    {
      id: 'nestjs-manual-setup',
      name: 'NestJS Manual Setup',
      file: 'frameworks/nestjs/basic/manual-setup.md',
      tags: ['cqrs:nestjs', 'cqrs:manual', 'cqrs:basic'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Basic CQRS integration with NestJS using manual command and query bus setup',
      dependencies: ['@nestjs/common', '@vytches-ddd/cqrs']
    },
    {
      id: 'nestjs-di-integration',
      name: 'NestJS DI Integration',
      file: 'frameworks/nestjs/intermediate/di-integration.md',
      tags: ['cqrs:nestjs', 'cqrs:di', 'cqrs:enterprise'],
      complexity: 'intermediate',
      priority: 'medium',
      description: 'Advanced NestJS integration with @vytches-ddd/di for automatic handler discovery',
      dependencies: ['@nestjs/common', '@vytches-ddd/cqrs', '@vytches-ddd/di', '@vytches-ddd/events']
    },
    {
      id: 'cqrs-implementation-overview',
      name: 'CQRS Implementation Overview',
      file: 'basic/implementation.md',
      tags: ['cqrs:core', 'cqrs:overview', 'cqrs:patterns'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Comprehensive overview of CQRS implementation patterns and foundational concepts',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/utils']
    },
    {
      id: 'enterprise-saga-orchestration',
      name: 'Enterprise CQRS with Saga Orchestration',
      file: 'advanced/example-1.md',
      tags: ['cqrs:advanced', 'cqrs:saga', 'cqrs:distributed', 'cqrs:compensation'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise-grade CQRS with saga orchestration for managing complex distributed transactions',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/messaging', '@vytches-ddd/events', '@vytches-ddd/resilience', '@vytches-ddd/di']
    },
    {
      id: 'ai-enhanced-cqrs-predictive',
      name: 'AI-Enhanced CQRS with Predictive Analytics',
      file: 'advanced/example-2.md',
      tags: ['cqrs:ai', 'cqrs:ml', 'cqrs:analytics', 'cqrs:prediction'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Integrating artificial intelligence and machine learning capabilities with CQRS patterns',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/events', '@vytches-ddd/projections', '@vytches-ddd/resilience', '@vytches-ddd/utils']
    },
    {
      id: 'realtime-analytics-stream-processing',
      name: 'Real-time Analytics CQRS with Stream Processing',
      file: 'advanced/example-3.md',
      tags: ['cqrs:analytics', 'cqrs:streaming', 'cqrs:realtime', 'cqrs:cep'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Real-time analytics using CQRS patterns with stream processing and complex event processing',
      dependencies: ['@vytches-ddd/cqrs', '@vytches-ddd/events', '@vytches-ddd/projections', '@vytches-ddd/event-store', '@vytches-ddd/utils']
    },
    {
      id: 'nestjs-enterprise-patterns',
      name: 'NestJS Enterprise CQRS Patterns',
      file: 'frameworks/nestjs/advanced/enterprise-patterns.md',
      tags: ['cqrs:nestjs', 'cqrs:enterprise', 'cqrs:distributed', 'cqrs:saga'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise-grade NestJS integration with distributed CQRS, saga orchestration, and compensation patterns',
      dependencies: ['@nestjs/common', '@vytches-ddd/cqrs', '@vytches-ddd/messaging', '@vytches-ddd/di']
    },
    {
      id: 'cqrs-use-cases',
      name: 'CQRS Use Cases and Applications',
      file: 'basic/use-case.md',
      tags: ['cqrs:use-cases', 'cqrs:business', 'cqrs:scenarios'],
      complexity: 'basic',
      priority: 'medium',
      description: 'Real-world use cases and business scenarios where CQRS patterns provide significant value',
      dependencies: ['@vytches-ddd/cqrs']
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
