import type { PackageExampleConfig } from "@vytches-ddd/contracts";

export const config: PackageExampleConfig = {
  packageName: 'acl',
  displayName: 'Anti-Corruption Layer',
  version: '1.0.0',
  description: 'Anti-Corruption Layer provides a translation layer between your domain model and external systems, ensuring your domain remains pure and isolated from external concerns.',
  domain: 'Integration',
  patterns: ['anti-corruption-layer', 'adapter-pattern', 'model-translation', 'external-integration'],
  tags: {
    core: ['acl:core', 'acl:basic', 'acl:integration'],
    integrations: ['acl:identity', 'acl:e-commerce', 'acl:communication', 'acl:storage', 'acl:finance', 'acl:logistics', 'acl:infrastructure'],
    frameworks: ['acl:nestjs', 'acl:express', 'acl:fastify'],
    patterns: ['acl:adapter', 'acl:translator', 'acl:external-api', 'acl:model-mapping']
  },
  dependencies: ['@vytches-ddd/core', '@vytches-ddd/acl', '@vytches-ddd/utils'],
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
      description: 'Basic ACL implementation with simple model translation'
    },
    intermediate: {
      level: 'intermediate',
      diSupport: true,
      diRequired: true,
      description: 'Multi-provider ACL with advanced features'
    },
    advanced: {
      level: 'advanced',
      diSupport: true,
      diRequired: true,
      description: 'Enterprise ACL with security, federation, and compliance features'
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
      id: 'basic-user-management',
      name: 'Basic User Management ACL',
      file: 'basic/implementation.md',
      tags: ['acl:core', 'acl:basic', 'user-management'],
      complexity: 'basic',
      priority: 'high',
      description: 'Basic user management with external identity provider',
      dependencies: ['@vytches-ddd/acl', '@vytches-ddd/di', '@vytches-ddd/utils']
    },
    {
      id: 'intermediate-multi-provider',
      name: 'Multi-Provider ACL',
      file: 'intermediate/implementation.md',
      tags: ['acl:intermediate', 'multi-provider', 'sync'],
      complexity: 'intermediate',
      priority: 'high',
      description: 'Multi-provider user management with synchronization',
      dependencies: ['@vytches-ddd/acl', '@vytches-ddd/di', '@vytches-ddd/utils', '@vytches-ddd/logging']
    },
    {
      id: 'advanced-enterprise',
      name: 'Enterprise ACL',
      file: 'advanced/implementation.md',
      tags: ['acl:advanced', 'enterprise', 'security', 'federation'],
      complexity: 'advanced',
      priority: 'high',
      description: 'Enterprise-grade ACL with security and federation',
      dependencies: ['@vytches-ddd/acl', '@vytches-ddd/di', '@vytches-ddd/utils', '@vytches-ddd/logging', '@vytches-ddd/resilience']
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
    'domain-services': {
      priority: 'high',
      relationship: 'depends-on',
      integrationExamples: ['user-management', 'product-catalog']
    },
    'resilience': {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['enterprise-integration']
    },
    'logging': {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['audit-logging']
    }
  }
};
