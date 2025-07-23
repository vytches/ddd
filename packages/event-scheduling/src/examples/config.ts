import type { PackageExampleConfig } from '@vytches-ddd/contracts';

export const packageExampleConfig: PackageExampleConfig = {
  // === REQUIRED BASIC PROPERTIES ===
  packageName: 'event-scheduling',
  displayName: 'Event Scheduling',
  version: '1.0.0',
  description:
    'Time-based event scheduling with priority queuing, recurring patterns, and distributed coordination capabilities',
  domain: 'Infrastructure',
  patterns: [
    'event-scheduling',
    'job-queuing',
    'priority-scheduling',
    'recurring-events',
    'delayed-execution',
  ],
  dependencies: [
    '@vytches-ddd/contracts',
    '@vytches-ddd/events',
    '@vytches-ddd/domain-primitives',
    '@vytches-ddd/utils',
  ],

  // === REQUIRED COMPLEXITY LEVELS ===
  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: true,
      diRequired: false,
      description: 'Simple event scheduling with basic retry policies and priority queuing',
    },
    intermediate: {
      level: 'intermediate',
      diSupport: true,
      diRequired: true,
      description:
        'Advanced scheduling patterns with distributed coordination and sophisticated queue management',
    },
    advanced: {
      level: 'advanced',
      diSupport: true,
      diRequired: true,
      description:
        'Enterprise-scale scheduling with clustering, high availability, and global coordination',
    },
  },

  // === REQUIRED FRAMEWORK INTEGRATIONS ===
  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description:
        'NestJS integration with decorators, health checks, and dependency injection support',
      complexityLevels: ['basic', 'intermediate', 'advanced'],
      dependencies: ['@nestjs/core', '@nestjs/common', '@nestjs/schedule'],
      minimumVersion: '9.0.0',
    },
  ],

  // === REQUIRED EXAMPLES ARRAY ===
  examples: [
    // Basic Examples
    {
      id: 'basic-simple-scheduling',
      name: 'Simple Event Scheduling',
      description: 'Basic time-based event scheduling with cancellation and retry policies',
      file: 'basic/example-1.md',
      tags: ['event-scheduling:basic', 'scheduling:simple', 'retry-policies'],
      complexity: 'basic',
      priority: 'high',
      validation: { fileExists: true },
    },
    {
      id: 'basic-recurring-events',
      name: 'Recurring Events and Cron Scheduling',
      description: 'Periodic task scheduling with recurring patterns and cron-like functionality',
      file: 'basic/example-2.md',
      tags: ['event-scheduling:basic', 'recurring-events', 'cron-scheduling', 'periodic-tasks'],
      complexity: 'basic',
      priority: 'high',
      validation: { fileExists: true },
    },
    {
      id: 'basic-priority-queuing',
      name: 'Priority Queuing and Resource Management',
      description: 'Priority-based event scheduling with queue management and resource constraints',
      file: 'basic/example-3.md',
      tags: [
        'event-scheduling:basic',
        'priority-queuing',
        'resource-management',
        'job-prioritization',
      ],
      complexity: 'basic',
      priority: 'high',
      validation: { fileExists: true },
    },

    // Intermediate Examples
    {
      id: 'intermediate-distributed-scheduling',
      name: 'Distributed Event Scheduling',
      description: 'Multi-node event scheduling with leader election and partition management',
      file: 'intermediate/example-1.md',
      tags: [
        'event-scheduling:intermediate',
        'distributed-systems',
        'leader-election',
        'partitioning',
      ],
      complexity: 'intermediate',
      priority: 'high',
      validation: { fileExists: true },
    },
    {
      id: 'intermediate-advanced-queuing',
      name: 'Advanced Queue Management',
      description:
        'Sophisticated queue management with dead letter queues and backpressure handling',
      file: 'intermediate/example-2.md',
      tags: [
        'event-scheduling:intermediate',
        'queue-management',
        'dead-letter-queue',
        'backpressure',
      ],
      complexity: 'intermediate',
      priority: 'high',
      validation: { fileExists: true },
    },
    {
      id: 'intermediate-scheduling-patterns',
      name: 'Complex Scheduling Patterns',
      description:
        'Advanced scheduling patterns with conditional execution and dynamic rescheduling',
      file: 'intermediate/example-3.md',
      tags: [
        'event-scheduling:intermediate',
        'scheduling-patterns',
        'conditional-execution',
        'dynamic-scheduling',
      ],
      complexity: 'intermediate',
      priority: 'medium',
      validation: { fileExists: true },
    },

    // Advanced Examples
    {
      id: 'advanced-enterprise-scheduling',
      name: 'Enterprise Scheduling Platform',
      description: 'Global enterprise scheduling with multi-region coordination and failover',
      file: 'advanced/example-1.md',
      tags: [
        'event-scheduling:advanced',
        'enterprise-scheduling',
        'multi-region',
        'global-coordination',
      ],
      complexity: 'advanced',
      priority: 'high',
      validation: { fileExists: true },
    },
    {
      id: 'advanced-high-availability',
      name: 'High Availability Scheduling',
      description: 'Highly available scheduling system with clustering and automatic failover',
      file: 'advanced/example-2.md',
      tags: ['event-scheduling:advanced', 'high-availability', 'clustering', 'failover'],
      complexity: 'advanced',
      priority: 'high',
      validation: { fileExists: true },
    },
    {
      id: 'advanced-performance-optimization',
      name: 'Performance-Optimized Scheduling',
      description: 'Ultra-high performance scheduling with advanced optimization techniques',
      file: 'advanced/example-3.md',
      tags: [
        'event-scheduling:advanced',
        'performance-optimization',
        'high-throughput',
        'low-latency',
      ],
      complexity: 'advanced',
      priority: 'medium',
      validation: { fileExists: true },
    },

    // NestJS Framework Integration
    {
      id: 'nestjs-basic-scheduling',
      name: 'NestJS Basic Scheduling Integration',
      description: 'Basic NestJS integration with manual scheduler setup and service injection',
      file: 'frameworks/nestjs/basic/example-1.md',
      tags: ['nestjs:basic', 'event-scheduling:nestjs', 'framework-integration'],
      complexity: 'basic',
      priority: 'high',
      framework: 'nestjs',
      validation: { fileExists: true },
    },
    {
      id: 'nestjs-intermediate-scheduling',
      name: 'NestJS Advanced DI Integration',
      description:
        'Advanced NestJS integration with VytchesDDD DI and comprehensive scheduling features',
      file: 'frameworks/nestjs/intermediate/example-1.md',
      tags: ['nestjs:intermediate', 'event-scheduling:di', 'vytches-ddd:integration'],
      complexity: 'intermediate',
      priority: 'high',
      framework: 'nestjs',
      validation: { fileExists: true },
    },
    {
      id: 'nestjs-advanced-enterprise',
      name: 'NestJS Enterprise Scheduling Platform',
      description: 'Enterprise-grade NestJS integration with distributed scheduling and monitoring',
      file: 'frameworks/nestjs/advanced/example-1.md',
      tags: [
        'nestjs:advanced',
        'event-scheduling:enterprise',
        'distributed-scheduling',
        'monitoring',
      ],
      complexity: 'advanced',
      priority: 'high',
      framework: 'nestjs',
      validation: { fileExists: true },
    },
  ],

  // === REQUIRED TAGS SYSTEM ===
  tags: {
    core: [
      'event-scheduling',
      'job-queuing',
      'time-based-execution',
      'delayed-events',
      'scheduled-tasks',
    ],
    integrations: [
      'retry-policies',
      'priority-queuing',
      'recurring-events',
      'cron-scheduling',
      'distributed-coordination',
    ],
    frameworks: ['nestjs'],
    patterns: [
      'scheduler-pattern',
      'queue-pattern',
      'priority-pattern',
      'recurring-pattern',
      'distributed-pattern',
    ],
  },

  // === REQUIRED CONTENT CONFIG ===
  contentConfig: {
    showImportStatements: true,
    showErrorHandling: true,
    showTesting: true,
    showPerformance: true,
    includeBestPractices: true,
    includeCommonPitfalls: true,
    showVersionHistory: false,
  },

  // === REQUIRED LLM SUPPORT ===
  llmSupport: {
    enabled: true,
    includePrompts: true,
    includeTips: true,
    includePatterns: true,
    optimizeForCodeGeneration: true,
  },

  // === REQUIRED SECTIONS ===
  sections: ['implementation', 'use-case', 'framework-integration'],

  // === REQUIRED RELATED PACKAGES ===
  relatedPackages: {
    events: {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['basic-simple-scheduling', 'intermediate-distributed-scheduling'],
    },
    contracts: {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['basic-priority-queuing', 'advanced-enterprise-scheduling'],
    },
    utils: {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['basic-simple-scheduling', 'intermediate-advanced-queuing'],
    },
    'domain-primitives': {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['basic-recurring-events', 'advanced-performance-optimization'],
    },
    resilience: {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['intermediate-advanced-queuing', 'advanced-high-availability'],
    },
    messaging: {
      priority: 'low',
      relationship: 'enables',
      integrationExamples: ['advanced-enterprise-scheduling'],
    },
    di: {
      priority: 'high',
      relationship: 'enables',
      integrationExamples: ['nestjs-intermediate-scheduling', 'nestjs-advanced-enterprise'],
    },
  },
};

export default packageExampleConfig;
