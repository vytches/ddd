import type { PackageExampleConfig } from '@vytches/ddd-contracts';

/**
 * CLI Package Examples Configuration
 *
 * Practical structure:
 * - Command documentation (generate, examples, domain-builder)
 * - Workflow guides (new-project, add-bounded-context, migration)
 * - Template customization (custom-templates, configuration)
 * - Troubleshooting (common-errors, debugging)
 * - Focus on practical usage rather than complex patterns
 */

export const config: PackageExampleConfig = {
  packageName: 'cli',
  displayName: 'VytchesDDD CLI',
  version: '1.0.0',
  description:
    'Enterprise-Grade Domain-Driven Design CLI for code generation, domain modeling, and project management',
  domain: 'Development Tools',
  patterns: ['cli', 'code-generation', 'domain-modeling', 'project-scaffolding'],
  tags: {
    core: ['cli:commands', 'cli:workflows'],
    integrations: ['cli:templates', 'cli:frameworks'],
    frameworks: ['nestjs'],
    patterns: ['code-generation', 'domain-modeling', 'scaffolding', 'validation'],
  },
  dependencies: ['@vytches/ddd-core', '@vytches/ddd-utils'],
  complexityLevels: {
    basic: {
      level: 'basic',
      diSupport: false,
      diRequired: false,
      description: 'Basic CLI usage and commands',
    },
    intermediate: {
      level: 'intermediate',
      diSupport: false,
      diRequired: false,
      description: 'Workflows and template customization',
    },
    advanced: {
      level: 'advanced',
      diSupport: false,
      diRequired: false,
      description: 'Advanced configuration and troubleshooting',
    },
  },
  frameworks: [
    {
      name: 'nestjs',
      displayName: 'NestJS',
      description: 'NestJS integration and code generation',
      complexityLevels: ['basic', 'intermediate'],
      dependencies: ['@nestjs/common', '@nestjs/core'],
    },
  ],

  examples: [
    // Commands Documentation (3 examples)
    {
      id: 'generate-command',
      name: 'Generate Command',
      file: 'commands/generate.md',
      tags: ['cli:generate', 'commands:core', 'code-generation'],
      complexity: 'basic',
      priority: 'high',
      description:
        'Generate DDD components with intelligent templates - aggregates, entities, commands, queries, and more',
      dependencies: ['@vytches/ddd-core'],
      validation: { fileExists: true },
    },
    {
      id: 'examples-command',
      name: 'Examples Command',
      file: 'commands/examples.md',
      tags: ['cli:examples', 'documentation:generation', 'package:management'],
      complexity: 'basic',
      priority: 'high',
      description:
        'Manage and generate package examples and documentation with validation and bundling capabilities',
      dependencies: ['@vytches/ddd-contracts'],
      validation: { fileExists: true },
    },
    {
      id: 'domain-builder-command',
      name: 'Domain Builder Command',
      file: 'commands/domain-builder.md',
      tags: ['cli:domain', 'modeling:interactive', 'ai:assistance'],
      complexity: 'intermediate',
      priority: 'high',
      description:
        'Interactive domain modeling with AI-assisted guidance, context mapping, and validation',
      dependencies: ['@vytches/ddd-core', '@vytches/ddd-utils'],
      validation: { fileExists: true },
    },

    // Workflows Documentation (2 examples)
    {
      id: 'new-project-workflow',
      name: 'New Project Workflow',
      file: 'workflows/new-project.md',
      tags: ['workflow:new-project', 'scaffolding:complete', 'setup:guide'],
      complexity: 'intermediate',
      priority: 'high',
      description:
        'Complete workflow for creating a DDD project from scratch with multiple bounded contexts',
      dependencies: ['@vytches/ddd-core', '@vytches/ddd-cqrs', '@vytches/ddd-events'],
      validation: { fileExists: true },
    },
    {
      id: 'add-bounded-context-workflow',
      name: 'Add Bounded Context Workflow',
      file: 'workflows/add-bounded-context.md',
      tags: ['workflow:integration', 'bounded-context:add', 'domain:expansion'],
      complexity: 'intermediate',
      priority: 'high',
      description:
        'Add new bounded context to existing DDD project with proper integration and anti-corruption layers',
      dependencies: ['@vytches/ddd-core', '@vytches/ddd-events'],
      validation: { fileExists: true },
    },

    // Templates Documentation (1 example)
    {
      id: 'custom-templates',
      name: 'Custom Templates',
      file: 'templates/custom-templates.md',
      tags: ['templates:custom', 'code-generation:advanced', 'customization:templates'],
      complexity: 'advanced',
      priority: 'medium',
      description:
        'Creating and customizing code generation templates with Handlebars for project-specific patterns',
      dependencies: ['handlebars'],
      validation: { fileExists: true },
    },

    // Troubleshooting Documentation (1 example)
    {
      id: 'common-errors',
      name: 'Common Errors & Solutions',
      file: 'troubleshooting/common-errors.md',
      tags: ['troubleshooting:errors', 'debugging:cli', 'solutions:common'],
      complexity: 'advanced',
      priority: 'medium',
      description:
        'Quick solutions to frequent CLI issues including generation errors, dependency issues, and configuration problems',
      validation: { fileExists: true },
    },
  ],

  sections: [
    'hero',
    'description',
    'installation',
    'quickStart',
    'commands',
    'workflows',
    'templates',
    'troubleshooting',
    'examples',
  ],

  contentConfig: {
    showImportStatements: false,
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
    optimizeForCodeGeneration: false,
  },

  relatedPackages: {
    core: {
      priority: 'high',
      relationship: 'enables',
      integrationExamples: ['generate-command'],
    },
    cqrs: {
      priority: 'high',
      relationship: 'enables',
      integrationExamples: ['generate-command', 'new-project-workflow'],
    },
    events: {
      priority: 'medium',
      relationship: 'enables',
      integrationExamples: ['domain-builder-command'],
    },
    utils: {
      priority: 'medium',
      relationship: 'depends-on',
      integrationExamples: ['domain-builder-command'],
    },
  },
};
