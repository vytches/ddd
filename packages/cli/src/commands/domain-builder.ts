/**
 * @fileoverview Complete Domain Builder Command
 * AI-powered complete domain system generation with relationships and patterns
 */

import type { Command } from '../types';
import { Colors } from '../core/utils/colors';
import { DomainBuilderWorkflow } from '../workflows/domain-builder/domain-builder-workflow';
import { Performance } from '../core/utils/performance';

export const domainBuilderCommand: Command = {
  name: 'create-domain',
  description:
    'Create complete domain implementations with AI-powered guidance and pattern detection',
  aliases: ['domain', 'build-domain', 'cd'],
  options: [
    {
      flags: '-n, --name <name>',
      description: 'Domain name (will prompt if not provided)',
      required: false,
    },
    {
      flags: '-s, --structure <type>',
      description: 'Project structure',
      choices: [
        'clean-architecture',
        'hexagonal',
        'onion',
        'modular-monolith',
        'microservices',
        'custom',
      ],
      defaultValue: 'clean-architecture',
    },
    {
      flags: '-f, --framework <framework>',
      description: 'Target framework',
      choices: ['nestjs', 'express', 'fastify', 'standalone'],
      defaultValue: 'nestjs',
    },
    {
      flags: '--guided',
      description: 'Use guided interactive workflow (default)',
      defaultValue: true,
    },
    {
      flags: '--quick',
      description: 'Quick domain generation with smart defaults',
    },
    {
      flags: '--patterns <patterns>',
      description: 'Comma-separated list of patterns to include (cqrs,event-sourcing,saga,etc.)',
    },
    {
      flags: '--bounded-contexts <contexts>',
      description: 'Comma-separated list of bounded contexts',
    },
    {
      flags: '--compliance <standards>',
      description: 'Compliance standards to include (gdpr,hipaa,sox,pci)',
      choices: ['gdpr', 'hipaa', 'sox', 'pci'],
    },
    {
      flags: '--security <features>',
      description: 'Security features to include (jwt,oauth2,rbac,encryption)',
    },
    {
      flags: '--monitoring',
      description: 'Include monitoring and observability setup',
    },
    {
      flags: '--dry-run',
      description: 'Show what would be generated without creating files',
    },
  ],
  examples: [
    'vytches-ddd create-domain',
    'vytches-ddd create-domain --name "E-commerce Platform"',
    'vytches-ddd create-domain --guided',
    'vytches-ddd create-domain --quick --patterns cqrs,event-sourcing',
    'vytches-ddd create-domain "Banking System" --compliance sox,pci --security jwt,encryption',
    'vytches-ddd create-domain --bounded-contexts "Orders,Customers,Inventory" --framework nestjs',
  ],
  action: async (args: string[], options: Record<string, unknown>) => {
    const startTime = Performance.now();

    try {
      console.log(Colors.bold(Colors.cyan('🎯 VytchesDDD Complete Domain Builder')));
      console.log(
        Colors.dim('Building enterprise-grade domain implementations with AI assistance')
      );
      console.log('');

      // Extract domain name from args or options
      const domainName = (options.name as string) || args[0] || undefined;

      // Validate quick mode requirements
      if (options.quick && !domainName) {
        console.error(Colors.error('Domain name is required for quick mode'));
        console.log(Colors.dim('Use: vytches-ddd create-domain "Your Domain Name" --quick'));
        process.exit(1);
      }

      // Create and configure domain builder workflow
      const workflow = new DomainBuilderWorkflow({
        ...(domainName && { domainName }),
        structure: options.structure as string,
        framework: options.framework as string,
        guided: !options.quick,
        patterns: parseCommaSeparated(options.patterns as string),
        boundedContexts: parseCommaSeparated(options.boundedContexts as string),
        compliance: parseCommaSeparated(options.compliance as string),
        security: parseCommaSeparated(options.security as string),
        monitoring: Boolean(options.monitoring),
        dryRun: Boolean(options.dryRun),
      });

      // Execute domain building workflow
      const result = await workflow.execute();

      // Show completion summary
      const duration = Performance.since(startTime);
      console.log('');
      console.log(Colors.bold(Colors.green('🎉 Domain Generation Complete!')));
      console.log('');

      if (options.dryRun) {
        console.log(Colors.cyan('📋 Dry Run Summary:'));
        console.log(`  Would generate: ${result.plannedFiles.length} files`);
        console.log(`  Across: ${result.boundedContexts.length} bounded contexts`);
        console.log(`  With patterns: ${result.patterns.join(', ')}`);
        console.log(`  Estimated time: ${duration.toFixed(1)}ms`);
      } else {
        console.log(Colors.cyan('📊 Generation Summary:'));
        console.log(`  Generated: ${result.generatedFiles.length} files`);
        console.log(`  Bounded contexts: ${result.boundedContexts.length}`);
        console.log(`  Patterns applied: ${result.patterns.length}`);
        console.log(`  Generation time: ${duration.toFixed(1)}ms`);

        // Show next steps
        console.log('');
        console.log(Colors.bold('🚀 Next Steps:'));
        console.log(`  ${Colors.green('1.')} Install dependencies: ${Colors.dim('pnpm install')}`);
        console.log(`  ${Colors.green('2.')} Start development: ${Colors.dim('pnpm dev')}`);
        console.log(`  ${Colors.green('3.')} Run tests: ${Colors.dim('pnpm test')}`);

        if (result.hasDatabase) {
          console.log(
            `  ${Colors.green('4.')} Setup database: ${Colors.dim('docker-compose up -d')}`
          );
        }

        if (result.hasMonitoring) {
          console.log(
            `  ${Colors.green('5.')} View monitoring: ${Colors.dim('http://localhost:3001/metrics')}`
          );
        }

        console.log('');
        console.log(Colors.dim('💡 Use "vytches-ddd analyze" to verify domain compliance'));
        console.log(Colors.dim('💡 Use "vytches-ddd suggest" for optimization recommendations'));
      }
    } catch (error) {
      console.error('');
      console.error(
        Colors.error(
          `❌ Domain generation failed: ${error instanceof Error ? error.message : error}`
        )
      );

      if (error instanceof Error && error.stack) {
        console.error('');
        console.error(Colors.dim('Stack trace:'));
        console.error(Colors.dim(error.stack));
      }

      process.exit(1);
    }
  },
};

/**
 * Parse comma-separated string into array
 */
function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}
