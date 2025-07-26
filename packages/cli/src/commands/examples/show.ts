import type { Arguments, CommandBuilder } from 'yargs';
import { UnifiedExampleParser } from '../../parsers/unified-parser';
import { globalDocumentationRegistry } from '../../core/documentation-registry';

interface ShowOptions {
  example: string;
  framework?: 'nestjs' | 'express' | 'fastify';
  version?: string;
  components?: boolean;
  raw?: boolean;
}

export const command = 'show <example>';
export const describe = 'Show example details';

export const builder = (yargs: any) =>
  yargs
    .positional('example', {
      type: 'string',
      describe: 'Example ID to show',
      demandOption: true,
    })
    .option('framework', {
      type: 'string',
      describe: 'Show framework-specific implementation',
      choices: ['nestjs', 'express', 'fastify'],
    })
    .option('version', {
      type: 'string',
      describe: 'Show specific version (default: latest)',
    })
    .option('components', {
      type: 'boolean',
      describe: 'Show available components for framework',
      default: false,
    })
    .option('raw', {
      type: 'boolean',
      describe: 'Show raw markdown content',
      default: false,
    })
    .example('$0 examples show order', 'Show base order example')
    .example(
      '$0 examples show order --framework nestjs',
      'Show order example with NestJS integration'
    )
    .example(
      '$0 examples show order --framework nestjs --components',
      'Show available NestJS components'
    )
    .example('$0 examples show order --raw', 'Show raw markdown content');

export const handler = async (argv: Arguments<ShowOptions>): Promise<void> => {
  try {
    // Load all examples
    await globalDocumentationRegistry.loadAll();

    // Find the example
    const example = globalDocumentationRegistry.findById(argv.example);

    if (!example) {
      console.error(`❌ Example '${argv.example}' not found.`);

      // Suggest similar examples
      const allExamples = globalDocumentationRegistry.query({});
      const suggestions = allExamples
        .filter(
          ex =>
            ex.id.includes(argv.example) ||
            ex.name.toLowerCase().includes(argv.example.toLowerCase())
        )
        .slice(0, 3);

      if (suggestions.length > 0) {
        console.log('\n💡 Did you mean:');
        suggestions.forEach(suggestion => {
          console.log(`   - ${suggestion.id} (${suggestion.name})`);
        });
      }

      return;
    }

    // Check framework availability
    if (argv.framework) {
      const availableFrameworks = globalDocumentationRegistry.getAvailableFrameworks(argv.example);

      if (!availableFrameworks.includes(argv.framework)) {
        console.error(
          `❌ Framework '${argv.framework}' not available for example '${argv.example}'.`
        );

        if (availableFrameworks.length > 0) {
          console.log(`\n💡 Available frameworks: ${availableFrameworks.join(', ')}`);
        } else {
          console.log(
            `\n💡 This example only has base implementation (no framework integrations).`
          );
        }

        return;
      }
    }

    // Show components if requested
    if (argv.components && argv.framework) {
      const components = globalDocumentationRegistry.getAvailableComponents(
        argv.example,
        argv.framework
      );

      console.log(`\n🧩 Available Components for ${argv.framework.toUpperCase()}:\n`);

      if (components.length > 0) {
        components.forEach(component => {
          console.log(`   - ${component}`);
        });

        console.log(
          `\n💡 Use --only or --exclude with generate command to select specific components.`
        );
      } else {
        console.log(`   No components defined for ${argv.framework} integration.`);
      }

      return;
    }

    // Parse and show example
    const parser = new UnifiedExampleParser();
    const parsedExample = await parser.parseExample({
      exampleId: argv.example,
      framework: argv.framework,
      version: argv.version,
    });

    if (argv.raw) {
      // Show raw markdown content
      console.log('📄 Base Example:\n');
      console.log('```markdown');
      // This would show the actual markdown file content
      console.log('# Example content would be shown here...');
      console.log('```');

      if (argv.framework && parsedExample.framework) {
        console.log(`\n📄 ${argv.framework.toUpperCase()} Integration:\n`);
        console.log('```markdown');
        console.log('# Framework integration content would be shown here...');
        console.log('```');
      }
    } else {
      // Show formatted output
      console.log(`\n📚 ${example.name}\n`);

      // Basic info
      console.log(`📦 Package: @vytches/ddd-${example.package}`);
      console.log(`🎯 Complexity: ${example.complexity}`);
      console.log(`🏢 Domain: ${example.domain || 'none'}`);
      console.log(`🔧 Patterns: ${example.patterns?.join(', ') || 'none'}`);
      console.log(`🏷️  Tags: ${example.tags.join(', ')}`);
      console.log(`📋 Dependencies: ${example.dependencies?.join(', ') || 'none'}`);

      if (argv.framework) {
        const integration = example.frameworkIntegrations?.find(
          fi => fi.framework === argv.framework
        );
        if (integration) {
          console.log(`🚀 Framework: ${argv.framework.toUpperCase()}`);
          console.log(`📦 Additional Dependencies: none`);
          console.log(`🧩 Components: ${integration.components.join(', ')}`);
        }
      }

      console.log(`\n📝 Description:`);
      console.log(`   ${example.description}`);

      // Show business context
      if (parsedExample.base.content.businessContext) {
        console.log(`\n🏢 Business Context:`);
        console.log(`   ${parsedExample.base.content.businessContext}`);
      }

      // Show available frameworks
      const availableFrameworks = globalDocumentationRegistry.getAvailableFrameworks(argv.example);
      if (availableFrameworks.length > 0) {
        console.log(`\n🚀 Available Framework Integrations:`);
        availableFrameworks.forEach(framework => {
          const isShown = framework === argv.framework ? ' (showing)' : '';
          console.log(`   - ${framework}${isShown}`);
        });
      }

      // Usage examples
      console.log(`\n💻 Usage Examples:`);
      console.log(`   # Show this example`);
      console.log(`   vytches-ddd examples show ${argv.example}`);

      if (availableFrameworks.length > 0) {
        console.log(`   # Show with framework integration`);
        console.log(
          `   vytches-ddd examples show ${argv.example} --framework ${availableFrameworks[0]}`
        );

        console.log(`   # Generate from this example`);
        console.log(
          `   vytches-ddd generate --example ${argv.example} --name MyComponent --framework ${availableFrameworks[0]}`
        );
      } else {
        console.log(`   # Generate from this example`);
        console.log(`   vytches-ddd generate --example ${argv.example} --name MyComponent`);
      }
    }
  } catch (error) {
    console.error('Error showing example:', error);
    process.exit(1);
  }
};
