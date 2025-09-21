import type { Arguments } from 'yargs';
import { globalDocumentationRegistry } from '../../core/documentation-registry';
import type { ExampleQueryOptions } from '../../types/documentation-types';

interface ListOptions {
  package?: string;
  complexity?: 'basic' | 'intermediate' | 'advanced';
  domain?: string;
  pattern?: string;
  framework?: 'nestjs' | 'express' | 'fastify';
  frameworks?: boolean;
  tags?: string[];
}

export const command = 'list';
export const describe = 'List available examples';

export const builder = (yargs: any) =>
  yargs
    .option('package', {
      type: 'string',
      describe: 'Filter by package name',
      choices: ['core', 'aggregates', 'policies', 'cqrs', 'events', 'validation'],
    })
    .option('complexity', {
      type: 'string',
      describe: 'Filter by complexity level',
      choices: ['basic', 'intermediate', 'advanced'],
    })
    .option('domain', {
      type: 'string',
      describe: 'Filter by business domain',
      choices: ['e-commerce', 'fintech', 'business-automation', 'tech-blog'],
    })
    .option('pattern', {
      type: 'string',
      describe: 'Filter by DDD pattern',
      choices: ['aggregate-root', 'domain-events', 'policies', 'cqrs', 'event-sourcing'],
    })
    .option('framework', {
      type: 'string',
      describe: 'Filter examples with specific framework integration',
      choices: ['nestjs', 'express', 'fastify'],
    })
    .option('frameworks', {
      type: 'boolean',
      describe: 'Show available frameworks for each example',
      default: false,
    })
    .option('tags', {
      type: 'array',
      string: true,
      describe: 'Filter by tags (can be used multiple times)',
    })
    .example('$0 examples list', 'List all examples')
    .example('$0 examples list --package aggregates', 'List examples from aggregates package')
    .example('$0 examples list --framework nestjs', 'List examples with NestJS integration')
    .example(
      '$0 examples list --complexity basic --domain e-commerce',
      'List basic e-commerce examples'
    )
    .example('$0 examples list --frameworks', 'Show available frameworks for each example');

export const handler = async (argv: Arguments<ListOptions>): Promise<void> => {
  try {
    // Load all examples
    await globalDocumentationRegistry.loadAll();

    // Build query options
    const queryOptions: ExampleQueryOptions = {
      ...(argv.package && { package: argv.package }),
      ...(argv.complexity && { complexity: argv.complexity }),
      ...(argv.domain && { domain: argv.domain }),
      ...(argv.pattern && { pattern: argv.pattern }),
      ...(argv.framework && { framework: argv.framework }),
      ...(argv.tags && { tags: argv.tags }),
    };

    // Query examples
    const examples = globalDocumentationRegistry.query(queryOptions);

    if (examples.length === 0) {
      console.log('No examples found matching the specified criteria.');
      return;
    }

    // Display results
    if (argv.frameworks) {
      // Show with framework information
      console.log('\n📚 Available Examples with Framework Support:\n');

      examples.forEach(example => {
        const frameworks = globalDocumentationRegistry.getAvailableFrameworks(example.id);

        console.log(`🔹 ${example.name}`);
        console.log(`   ID: ${example.id}`);
        console.log(`   Package: @vytches/ddd-${example.package}`);
        console.log(`   Complexity: ${example.complexity}`);
        console.log(`   Domain: ${example.domain || 'none'}`);
        console.log(`   Patterns: ${example.patterns?.join(', ') || 'none'}`);

        if (frameworks.length > 0) {
          console.log(`   Frameworks: ${frameworks.join(', ')}`);
        } else {
          console.log(`   Frameworks: base only`);
        }

        console.log(`   Description: ${example.description}`);
        console.log('');
      });
    } else {
      // Show as table
      const tableData = examples.map(example => ({
        ID: example.id,
        Name: example.name,
        Package: example.package,
        Complexity: example.complexity,
        Domain: example.domain || 'none',
        Patterns:
          example.patterns?.slice(0, 2).join(', ') +
            (example.patterns && example.patterns.length > 2 ? '...' : '') || 'none',
        Frameworks: globalDocumentationRegistry.getAvailableFrameworks(example.id).length || 'base',
      }));

      console.table(tableData);
    }

    // Show summary
    console.log(`\n📊 Found ${examples.length} example${examples.length !== 1 ? 's' : ''}`);

    if (argv.framework) {
      console.log(`   With ${argv.framework} integration`);
    }

    // Show available filters if no specific filters applied
    if (!argv.package && !argv.complexity && !argv.domain && !argv.pattern && !argv.framework) {
      const allPackages = globalDocumentationRegistry.getPackages();
      const allFrameworks = globalDocumentationRegistry.getAllFrameworks();

      console.log(`\n💡 Available filters:`);
      console.log(`   Packages: ${allPackages.join(', ')}`);
      if (allFrameworks.length > 0) {
        console.log(`   Frameworks: ${allFrameworks.join(', ')}`);
      }
      console.log(`   Use --help to see all filter options`);
    }
  } catch (error) {
    console.error('Error listing examples:', error);
    process.exit(1);
  }
};
