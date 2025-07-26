// aggregates/src/examples/config.ts

import type { PackageExampleConfig } from '@vytches/ddd-contracts';

export const aggregatesExamplesConfig: PackageExampleConfig = {
  packageName: '@vytches/ddd-aggregates',
  displayName: 'Aggregates',
  version: '1.0.0',
  description:
    'Aggregate root patterns with capabilities, event sourcing, and complex business logic',
  domain: 'Core',
  patterns: ['aggregate-pattern', 'event-sourcing', 'capability-pattern'],
  dependencies: ['@vytches/ddd-domain-primitives', '@vytches/ddd-contracts'],
  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: false,
      diRequired: false,
      description: 'Foundation aggregate patterns with basic domain operations',
    },
    intermediate: {
      level: 'intermediate',
      diSupport: true,
      diRequired: false,
      description: 'Advanced aggregate patterns with event sourcing and capabilities',
    },
    advanced: {
      level: 'advanced',
      diSupport: true,
      diRequired: true,
      description: 'Enterprise-scale patterns with AI integration and distributed coordination',
    },
  },
  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description: 'NestJS integration with @vytches/ddd-di service locator pattern',
      complexityLevels: ['basic', 'intermediate', 'advanced'],
      dependencies: ['@nestjs/core', '@nestjs/common', '@vytches/ddd-di'],
      minimumVersion: '10.0.0',
    },
  ],

  examples: [
    // Basic Examples
    {
      id: 'user-aggregate',
      name: 'User Aggregate - Basic Factory and Operations',
      description:
        'Simple user aggregate with factory methods, invariant protection, and domain events',
      file: 'basic/example-1.md',
      tags: ['factory-methods', 'invariant-protection', 'domain-events'],
      complexity: 'basic',
      priority: 'high',
    },
    {
      id: 'order-aggregate',
      name: 'Order Aggregate - State Machine Pattern',
      description: 'Order lifecycle management with state machine validation and transitions',
      file: 'basic/example-2.md',
      tags: ['state-machine', 'lifecycle-management', 'validation'],
      complexity: 'basic',
      priority: 'high',
    },
    {
      id: 'product-inventory',
      name: 'Product Inventory - Multi-Location Stock Management',
      description: 'Inventory tracking with reservations, locations, and optimistic locking',
      file: 'basic/example-3.md',
      tags: ['inventory-management', 'reservations', 'multi-location', 'optimistic-locking'],
      complexity: 'basic',
      priority: 'medium',
    },

    // Intermediate Examples
    {
      id: 'event-sourced-cart',
      name: 'Event Sourced Shopping Cart - Complete Audit Trail',
      description: 'Shopping cart with event sourcing, snapshots, and temporal queries',
      file: 'intermediate/example-1.md',
      tags: ['event-sourcing', 'snapshots', 'temporal-queries', 'audit-trail'],
      complexity: 'intermediate',
      priority: 'high',
    },
    {
      id: 'banking-account-capabilities',
      name: 'Banking Account - Capability Pattern',
      description:
        'Bank account with separated capabilities for transactions, risk, compliance, and audit',
      file: 'intermediate/example-2.md',
      tags: ['capability-pattern', 'separation-of-concerns', 'banking-domain'],
      complexity: 'intermediate',
      priority: 'high',
    },
    {
      id: 'loan-application-workflow',
      name: 'Multi-Tenant Loan Application - Complex Workflow',
      description: 'Loan application with workflow management, multi-tenancy, and approval chains',
      file: 'intermediate/example-3.md',
      tags: ['workflow-management', 'multi-tenant', 'approval-chain', 'document-management'],
      complexity: 'intermediate',
      priority: 'medium',
    },

    // Advanced Examples
    {
      id: 'enterprise-process-orchestrator',
      name: 'Enterprise Process Orchestration Platform',
      description: 'Global process orchestration with AI decision making and saga coordination',
      file: 'advanced/example-1.md',
      tags: ['ai-integration', 'saga-pattern', 'global-orchestration', 'process-management'],
      complexity: 'advanced',
      priority: 'medium',
    },
    {
      id: 'ai-risk-management',
      name: 'AI-Powered Global Financial Risk Management',
      description:
        'Risk management with machine learning, predictive analytics, and real-time assessment',
      file: 'advanced/example-2.md',
      tags: ['ai-powered', 'risk-management', 'predictive-analytics', 'machine-learning'],
      complexity: 'advanced',
      priority: 'medium',
    },
    {
      id: 'blockchain-orchestrator',
      name: 'Enterprise Blockchain Transaction Orchestrator',
      description: 'Cross-chain operations with consensus management and cryptographic validation',
      file: 'advanced/example-3.md',
      tags: ['blockchain', 'cross-chain', 'consensus-management', 'cryptographic-validation'],
      complexity: 'advanced',
      priority: 'low',
    },

    // Framework Examples
    {
      id: 'nestjs-user-aggregate',
      name: 'User Aggregate - NestJS Integration',
      description: 'Basic user aggregate integration with NestJS dependency injection',
      file: 'frameworks/nestjs/basic/example-1.md',
      tags: ['nestjs', 'dependency-injection', 'service-locator'],
      complexity: 'basic',
      framework: 'nestjs',
      priority: 'high',
    },
    {
      id: 'nestjs-event-sourced-cart',
      name: 'Event Sourced Shopping Cart - NestJS Integration',
      description: 'Event sourced shopping cart with NestJS and @vytches/ddd-di integration',
      file: 'frameworks/nestjs/intermediate/example-1.md',
      tags: ['nestjs', 'event-sourcing', 'snapshots', 'di-integration'],
      complexity: 'intermediate',
      framework: 'nestjs',
      priority: 'high',
    },
  ],

  tags: {
    core: ['aggregates:basic', 'aggregates:intermediate', 'aggregates:advanced'],
    integrations: ['nestjs:basic', 'nestjs:intermediate'],
    frameworks: ['nestjs'],
    patterns: ['aggregate-pattern', 'event-sourcing', 'capability-pattern'],
  },

  contentConfig: {
    showImportStatements: true,
    showErrorHandling: true,
    showTesting: true,
    showPerformance: true,
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
    'domain-primitives': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['user-aggregate'],
    },
    events: {
      priority: 'high',
      relationship: 'consumes-from',
      integrationExamples: ['event-sourced-cart'],
    },
    di: {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['nestjs-user-aggregate'],
    },
  },
};

export default aggregatesExamplesConfig;
