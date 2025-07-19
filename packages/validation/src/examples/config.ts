import type { PackageExampleConfig } from '@vytches-ddd/contracts';

export const config: PackageExampleConfig = {
  packageName: 'validation',
  displayName: 'Validation & Specifications',
  version: '1.0.0',
  description: 'Validation & Specifications provides comprehensive validation patterns including Business Rules, Specifications, and Composite Validation for domain-driven validation.',
  domain: 'Core',
  patterns: ['specification-pattern', 'business-rules', 'composite-validation', 'domain-validation', 'validation-facade'],
  tags: {
    core: ['validation:core', 'validation:specifications', 'validation:business-rules', 'validation:composite'],
    integrations: ['validation:policies', 'validation:events', 'validation:messaging', 'validation:di'],
    frameworks: ['validation:nestjs', 'validation:express', 'validation:fastify'],
    patterns: ['validation:specs', 'validation:rules', 'validation:facade', 'validation:adapter', 'validation:registry']
  },
  dependencies: ['@vytches-ddd/core', '@vytches-ddd/validation', '@vytches-ddd/utils'],
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
      description: 'Basic validation with specifications and business rules'
    },
    intermediate: {
      level: 'intermediate',
      diSupport: true,
      diRequired: false,
      description: 'Advanced validation with composite patterns and integration'
    },
    advanced: {
      level: 'advanced',
      diSupport: true,
      diRequired: true,
      description: 'Enterprise validation system with events, policies, and comprehensive validation orchestration'
    }
  },
  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description: 'Integration with NestJS framework',
      complexityLevels: ['basic', 'intermediate', 'advanced'],
      dependencies: ['@nestjs/common', 'class-validator', 'class-transformer']
    },
    {
      name: 'express',
      displayName: 'Express',
      description: 'Integration with Express framework',
      complexityLevels: ['basic', 'intermediate'],
      dependencies: ['express', 'joi', 'express-validator']
    }
  ],
  examples: [
    {
      id: 'basic-validation-specs',
      name: 'Basic Validation with Specifications',
      file: 'basic/implementation.md',
      tags: ['validation:core', 'validation:specifications', 'business-rules'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic validation using specifications and business rules for domain validation',
      dependencies: ['@vytches-ddd/validation', '@vytches-ddd/utils']
    },
    {
      id: 'intermediate-composite-validation',
      name: 'Composite Validation with Integration',
      file: 'intermediate/implementation.md',
      tags: ['validation:composite', 'validation:policies', 'validation:events'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced composite validation patterns integrated with policies and events',
      dependencies: ['@vytches-ddd/validation', '@vytches-ddd/policies', '@vytches-ddd/events', '@vytches-ddd/di']
    },
    {
      id: 'advanced-validation-orchestration',
      name: 'Enterprise Validation Orchestration',
      file: 'advanced/implementation.md',
      tags: ['validation:orchestration', 'validation:messaging', 'validation:enterprise'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise validation orchestration with messaging, policies, and comprehensive validation workflows',
      dependencies: ['@vytches-ddd/validation', '@vytches-ddd/policies', '@vytches-ddd/events', '@vytches-ddd/messaging', '@vytches-ddd/di']
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
    'policies': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['validation-policies', 'policy-validation']
    },
    'events': {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['validation-events', 'event-validation']
    },
    'messaging': {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['validation-messaging', 'message-validation']
    },
    'domain-services': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['service-validation', 'domain-validation']
    }
  }
};