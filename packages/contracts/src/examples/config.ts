import type { PackageExampleConfig } from './types';

/**
 * Contracts Package Examples Configuration
 *
 * Foundation-focused structure:
 * - EntityId usage patterns (factory methods, validation, equality)
 * - Event interface architecture (domain events, event bus, handlers)
 * - Foundation contracts (specifications, actors, basic interfaces)
 * - Capability system patterns (registry, types, base implementations)
 * - Cross-package interface usage examples
 */

export const config: PackageExampleConfig = {
  packageName: 'contracts',
  displayName: 'VytchesDDD Contracts',
  version: '1.0.0',
  description: 'Foundation interfaces and contracts for the entire VytchesDDD library ecosystem',
  domain: 'Foundation',
  patterns: ['interfaces', 'contracts', 'foundation', 'entity-id', 'specifications'],
  tags: {
    core: ['contracts:interfaces', 'contracts:foundation'],
    integrations: ['contracts:cross-package', 'contracts:architecture'],
    frameworks: ['nestjs'],
    patterns: [
      'entity-id',
      'event-interfaces',
      'specifications',
      'capability-system',
      'foundation-contracts',
    ],
  },
  dependencies: ['typescript'],
  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: false,
      diRequired: false,
      description: 'Basic contract usage and EntityId patterns',
    },
    intermediate: {
      level: 'intermediate',
      diSupport: false,
      diRequired: false,
      description: 'Advanced event interfaces and capability system',
    },
    advanced: {
      level: 'advanced',
      diSupport: false,
      diRequired: false,
      description: 'Cross-package architecture and foundation patterns',
    },
  },
  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description: 'NestJS integration with contracts and interfaces',
      complexityLevels: ['basic', 'intermediate'],
      dependencies: ['@nestjs/common', '@nestjs/core'],
    },
  ],

  examples: [
    // Basic Level (3 examples)
    {
      id: 'entity-id-usage',
      name: 'EntityId Usage Patterns',
      file: 'basic/entity-id-usage.md',
      tags: ['contracts:entity-id', 'foundation:core', 'identity:patterns'],
      complexity: 'basic',
      priority: 'high',
      description: 'Comprehensive EntityId usage with factory methods, validation, and type safety',
      dependencies: ['@vytches/ddd-contracts'],
      validation: { fileExists: true },
    },
    {
      id: 'event-interfaces',
      name: 'Event Interface Architecture',
      file: 'basic/event-interfaces.md',
      tags: ['contracts:events', 'architecture:interfaces', 'event-driven:foundation'],
      complexity: 'basic',
      priority: 'high',
      description: 'Essential event interfaces for domain events, event bus, and handlers',
      dependencies: ['@vytches/ddd-contracts'],
      validation: { fileExists: true },
    },
    {
      id: 'foundation-contracts',
      name: 'Foundation Contracts',
      file: 'basic/foundation-contracts.md',
      tags: ['contracts:foundation', 'architecture:base', 'specifications:core'],
      complexity: 'basic',
      priority: 'high',
      description:
        'Core foundation contracts including specifications, actors, and basic interfaces',
      dependencies: ['@vytches/ddd-contracts'],
      validation: { fileExists: true },
    },

    // Intermediate Level (2 examples)
    {
      id: 'event-architecture',
      name: 'Advanced Event Architecture',
      file: 'intermediate/event-architecture.md',
      tags: ['contracts:advanced-events', 'architecture:event-driven', 'persistence:interfaces'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced event interfaces including persistence, replay, and store patterns',
      dependencies: ['@vytches/ddd-contracts'],
      validation: { fileExists: true },
    },
    {
      id: 'capability-system',
      name: 'Capability System Architecture',
      file: 'intermediate/capability-system.md',
      tags: ['contracts:capabilities', 'architecture:extensible', 'registry:patterns'],
      complexity: 'intermediate',
      priority: 'medium',
      description:
        'Capability registry, types, and base implementations for extensible architecture',
      dependencies: ['@vytches/ddd-contracts'],
      validation: { fileExists: true },
    },

    // Advanced Level (1 example)
    {
      id: 'cross-package-architecture',
      name: 'Cross-Package Architecture Patterns',
      file: 'advanced/cross-package-architecture.md',
      tags: ['contracts:architecture', 'integration:cross-package', 'foundation:enterprise'],
      complexity: 'advanced',
      priority: 'medium',
      description:
        'Enterprise architecture patterns using foundation contracts across multiple packages',
      dependencies: ['@vytches/ddd-contracts', '@vytches/ddd-core'],
      validation: { fileExists: true },
    },

    // NestJS Framework Integration (2 examples)
    {
      id: 'nestjs-contracts-integration',
      name: 'NestJS Contracts Integration',
      file: 'frameworks/nestjs/basic/contracts-integration.md',
      tags: ['contracts:nestjs', 'framework:integration', 'dependency-injection:contracts'],
      complexity: 'basic',
      priority: 'medium',
      framework: 'nestjs',
      description: 'Basic NestJS integration with contracts, interfaces, and EntityId usage',
      dependencies: ['@vytches/ddd-contracts', '@nestjs/common'],
      validation: { fileExists: true },
    },
    {
      id: 'nestjs-event-interfaces',
      name: 'NestJS Event Interface Patterns',
      file: 'frameworks/nestjs/intermediate/event-interfaces.md',
      tags: ['contracts:nestjs-events', 'framework:event-driven', 'architecture:integration'],
      complexity: 'intermediate',
      priority: 'medium',
      framework: 'nestjs',
      description: 'Advanced NestJS integration with event interfaces and capability system',
      dependencies: ['@vytches/ddd-contracts', '@nestjs/common', '@nestjs/cqrs'],
      validation: { fileExists: true },
    },
  ],

  sections: [
    'foundation',
    'entity-id',
    'event-interfaces',
    'specifications',
    'capabilities',
    'cross-package-integration',
    'framework-integration',
  ],

  contentConfig: {
    showImportStatements: true,
    showErrorHandling: true,
    showTesting: false,
    showPerformance: false,
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

  relatedPackages: {
    core: {
      priority: 'high',
      relationship: 'enables',
      integrationExamples: ['cross-package-architecture'],
    },
    'domain-primitives': {
      priority: 'high',
      relationship: 'enables',
      integrationExamples: ['foundation-contracts', 'entity-id-usage'],
    },
    events: {
      priority: 'high',
      relationship: 'enables',
      integrationExamples: ['event-interfaces', 'event-architecture'],
    },
    aggregates: {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['entity-id-usage', 'foundation-contracts'],
    },
    validation: {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['foundation-contracts'],
    },
    capabilities: {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['capability-system'],
    },
  },
};
