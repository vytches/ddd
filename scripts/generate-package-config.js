#!/usr/bin/env node

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

// Package layer mappings based on CLAUDE.md architecture
const PACKAGE_LAYERS = {
  // Foundation Layer
  contracts: 'foundation',
  'domain-primitives': 'foundation',
  'value-objects': 'foundation',
  repositories: 'foundation',
  aggregates: 'foundation',
  core: 'foundation',
  di: 'foundation',
  utils: 'foundation',
  logging: 'foundation',

  // Patterns Layer
  validation: 'patterns',
  policies: 'patterns',
  'domain-services': 'patterns',

  // Architecture Layer
  events: 'architecture',
  cqrs: 'architecture',
  projections: 'architecture',

  // Integration Layer
  acl: 'integration',
  messaging: 'integration',

  // Infrastructure Layer
  resilience: 'infrastructure',
  enterprise: 'infrastructure',
  'event-store': 'infrastructure',
  'event-scheduling': 'infrastructure',

  // Tooling Layer
  testing: 'tooling',
  cli: 'tooling',
};

// Dependencies by layer
const LAYER_DEPENDENCIES = {
  foundation: {
    contracts: [],
    'domain-primitives': ['@vytches-ddd/utils'],
    'value-objects': ['@vytches-ddd/contracts', '@vytches-ddd/utils'],
    repositories: ['@vytches-ddd/contracts', '@vytches-ddd/domain-primitives'],
    aggregates: [
      '@vytches-ddd/contracts',
      '@vytches-ddd/domain-primitives',
      '@vytches-ddd/value-objects',
    ],
    core: [
      '@vytches-ddd/domain-primitives',
      '@vytches-ddd/value-objects',
      '@vytches-ddd/repositories',
      '@vytches-ddd/aggregates',
      '@vytches-ddd/utils',
      '@vytches-ddd/contracts',
      '@vytches-ddd/logging',
    ],
    di: ['@vytches-ddd/contracts', '@vytches-ddd/logging'],
    utils: [],
    logging: ['@vytches-ddd/contracts'],
  },
  patterns: {
    validation: ['@vytches-ddd/core'],
    policies: ['@vytches-ddd/core'],
    'domain-services': ['@vytches-ddd/core'],
  },
  architecture: {
    events: ['@vytches-ddd/core'],
    cqrs: ['@vytches-ddd/core', '@vytches-ddd/events'],
    projections: ['@vytches-ddd/core', '@vytches-ddd/events'],
  },
  integration: {
    acl: ['@vytches-ddd/core'],
    messaging: ['@vytches-ddd/core', '@vytches-ddd/events'],
  },
  infrastructure: {
    resilience: ['@vytches-ddd/core'],
    enterprise: ['@vytches-ddd/core'],
    'event-store': ['@vytches-ddd/core', '@vytches-ddd/logging'],
    'event-scheduling': ['@vytches-ddd/core', '@vytches-ddd/events'],
  },
  tooling: {
    testing: ['@vytches-ddd/utils'],
    cli: ['@vytches-ddd/core'],
  },
};

// Package descriptions
const PACKAGE_DESCRIPTIONS = {
  contracts: 'Enterprise-grade contracts & fundamental types for Domain-Driven Design',
  'domain-primitives': 'Core domain primitives and foundational types for Domain-Driven Design',
  'value-objects': 'Enhanced value objects and EntityId implementations',
  repositories: 'Repository patterns and Unit of Work for DDD aggregates',
  aggregates: 'Aggregate root implementations with capabilities',
  core: 'Meta-package: Enterprise API stability for DDD building blocks',
  di: 'Enterprise dependency injection with auto-discovery',
  utils: 'Common utilities and helper functions',
  logging: 'Enterprise logging with DDD-first design',
  validation: 'Business rules and specifications for domain validation',
  policies: 'Business policies and policy builder patterns',
  'domain-services': 'Domain services and domain logic coordination',
  events: 'Unified event system with context-aware routing',
  cqrs: 'Command Query Responsibility Segregation patterns',
  projections: 'Event projections and read model capabilities',
  acl: 'Anti-Corruption Layer for external system integration',
  messaging: 'Outbox pattern and reliable message delivery',
  resilience: 'Circuit breakers and resilience patterns',
  enterprise: 'Health checks and enterprise monitoring',
  'event-store': 'Enterprise-grade Event Store with Event Sourcing support',
  'event-scheduling': 'Event scheduling and delayed processing',
  testing: 'Test utilities and DDD-specific testing helpers',
  cli: 'Code generation tools and CLI framework',
};

function generatePackageConfig(packageName, options = {}) {
  const {
    templateDir = join(__dirname, '..', 'templates'),
    outputDir = join(__dirname, '..', 'packages', packageName),
    dryRun = false,
  } = options;

  console.log(`\n🔧 Generating configuration for package: @vytches-ddd/${packageName}`);

  // Get package metadata
  const layer = PACKAGE_LAYERS[packageName];
  if (!layer) {
    throw new Error(`Unknown package: ${packageName}. Please add it to PACKAGE_LAYERS.`);
  }

  const dependencies = LAYER_DEPENDENCIES[layer]?.[packageName] || [];
  const description =
    PACKAGE_DESCRIPTIONS[packageName] || `${packageName} package for Domain-Driven Design`;

  console.log(`📁 Layer: ${layer}`);
  console.log(`📦 Dependencies: ${dependencies.join(', ') || 'none'}`);

  // Template replacements
  const replacements = {
    '{PACKAGE_NAME}': packageName,
    '{PACKAGE_DESCRIPTION}': description,
    '{LAYER_TAG}': layer,
    '{PACKAGE_KEYWORDS}': packageName.replace(/-/g, ', '),
    '{PEER_DEPENDENCIES}':
      dependencies.length > 0
        ? '    ' + dependencies.map(dep => `"${dep}": "workspace:*"`).join(',\n    ')
        : '',
    '{DEPENDENCIES}':
      packageName === 'core'
        ? '    ' + dependencies.map(dep => `"${dep}": "workspace:*"`).join(',\n    ')
        : '',
  };

  // Generate files from templates
  const templates = [
    { file: 'vite.config.template.mts', output: 'vite.config.mts' },
    { file: 'tsconfig.template.json', output: 'tsconfig.json' },
    { file: 'project.template.json', output: 'project.json' },
    { file: 'package.template.json', output: 'package.json' },
  ];

  for (const template of templates) {
    const templatePath = join(templateDir, template.file);
    const outputPath = join(outputDir, template.output);

    if (!existsSync(templatePath)) {
      console.warn(`⚠️  Template not found: ${templatePath}`);
      continue;
    }

    let content = readFileSync(templatePath, 'utf8');

    // Apply replacements
    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(placeholder, 'g'), value);
    }

    // Clean up empty dependencies sections and fix JSON formatting
    if (template.file === 'package.template.json') {
      // Remove empty peer dependencies section
      content = content.replace(/,?\s*"peerDependencies":\s*{\s*\n?\s*},?\s*/g, '');
      // Remove empty dependencies section
      content = content.replace(/,?\s*"dependencies":\s*{\s*\n?\s*},?\s*/g, '');

      // Fix missing comma after peerDependencies
      content = content.replace(/}\s*"devDependencies"/g, '},\n  "devDependencies"');

      // Fix trailing commas
      content = content.replace(/,(\s*})/g, '$1');
      content = content.replace(/,(\s*\])/g, '$1');
    }

    if (dryRun) {
      console.log(`📝 Would write: ${outputPath}`);
    } else {
      writeFileSync(outputPath, content);
      console.log(`✅ Generated: ${outputPath}`);
    }
  }
}

// CLI interface
if (process.argv.length < 3) {
  console.log(`
🚀 Package Configuration Generator

Usage:
  node scripts/generate-package-config.js <package-name> [options]

Options:
  --dry-run    Show what would be generated without writing files
  --all        Generate configs for all known packages

Examples:
  node scripts/generate-package-config.js event-store
  node scripts/generate-package-config.js core --dry-run
  node scripts/generate-package-config.js --all

Available packages:
${Object.keys(PACKAGE_LAYERS)
  .map(pkg => `  - ${pkg} (${PACKAGE_LAYERS[pkg]} layer)`)
  .join('\n')}
`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const all = args.includes('--all');

try {
  if (all) {
    console.log('🔧 Generating configurations for all packages...');
    for (const packageName of Object.keys(PACKAGE_LAYERS)) {
      generatePackageConfig(packageName, { dryRun });
    }
    console.log('\n✨ All package configurations generated!');
  } else {
    const packageName = args[0];
    generatePackageConfig(packageName, { dryRun });
    console.log('\n✨ Package configuration generated!');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
