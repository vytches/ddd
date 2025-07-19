import type { PackageExampleConfig } from '@vytches-ddd/contracts';

export const config: PackageExampleConfig = {
  packageName: 'policies',
  displayName: 'Business Policies',
  version: '2.0.0',
  description: 'Business Policies V2 provides a unified Promise-based API with rich enterprise features for policy validation and business rule enforcement.',
  domain: 'Validation',
  patterns: ['business-rules', 'policy-pattern', 'specification-pattern', 'validation-pattern'],
  tags: {
    core: ['policies:core', 'policies:validation', 'policies:business-rules'],
    integrations: ['policies:specifications', 'policies:registry', 'policies:events', 'policies:audit'],
    frameworks: ['policies:nestjs', 'policies:express', 'policies:fastify'],
    patterns: ['policies:builder', 'policies:group', 'policies:behaviors', 'policies:context']
  },
  dependencies: ['@vytches-ddd/core', '@vytches-ddd/policies', '@vytches-ddd/utils'],
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
      description: 'Basic policy validation with simple specifications'
    },
    intermediate: {
      level: 'intermediate',
      diSupport: true,
      diRequired: true,
      description: 'Advanced policy features with conditional logic and group policies'
    },
    advanced: {
      level: 'advanced',
      diSupport: true,
      diRequired: true,
      description: 'Enterprise policy system with behaviors, registry, and event-driven architecture'
    }
  },
  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description: 'Integration with NestJS framework',
      complexityLevels: ['basic', 'intermediate', 'advanced'],
      dependencies: ['@nestjs/common', '@nestjs/config']
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
      id: 'basic-business-policy',
      name: 'Basic Business Policy',
      file: 'basic/implementation.md',
      tags: ['policies:core', 'policies:validation', 'business-rules'],
      complexity: 'basic',
      priority: 'high',
      description: 'E-commerce order validation with basic business rules',
      dependencies: ['@vytches-ddd/policies', '@vytches-ddd/utils']
    },
    {
      id: 'intermediate-conditional-policy',
      name: 'Conditional Policy with Groups',
      file: 'intermediate/implementation.md',
      tags: ['policies:advanced', 'policies:group', 'conditional-logic'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Advanced policy with conditional logic and group policies',
      dependencies: ['@vytches-ddd/policies', '@vytches-ddd/di', '@vytches-ddd/utils']
    },
    {
      id: 'advanced-enterprise-policy',
      name: 'Enterprise Policy System',
      file: 'advanced/implementation.md',
      tags: ['policies:enterprise', 'policies:behaviors', 'policies:registry', 'events'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise policy system with behaviors, registry, and event-driven architecture',
      dependencies: ['@vytches-ddd/policies', '@vytches-ddd/di', '@vytches-ddd/utils', '@vytches-ddd/events']
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
    'validation': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['specification-integration', 'composite-validation']
    },
    'events': {
      priority: 'medium',
      relationship: 'publishes-to',
      integrationExamples: ['policy-events', 'audit-events']
    },
    'domain-services': {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['business-rule-enforcement']
    }
  }
};