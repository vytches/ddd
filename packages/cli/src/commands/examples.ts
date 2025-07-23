/* eslint-disable no-case-declarations */
/**
 * Examples management command for CLI integration
 */

import { Colors } from '../core/utils/colors';
import { DocumentationGenerator } from '../generators/documentation-generator';
import { DocumentationBundler } from '../generators/documentation-bundler';
import { SmartTagFinder } from '../core/smart-tag-finder';
import { ExampleValidator } from '../validators/example-validator';

interface ExamplesOptions {
  help?: boolean;
  complexity?: string;
  framework?: string;
  sections?: string;
  llmOptimized?: boolean;
  llm?: boolean;
  showRelated?: boolean;
  maxExamples?: number;
  noRandomize?: boolean;
  seed?: string;
  diOnly?: boolean;
  output?: string;
  packages?: string;
  package?: string;
  fix?: boolean;
  verbose?: boolean;
}

export const examplesCommand = {
  name: 'examples',
  description: 'Manage and generate documentation from examples',

  async action(args: string[], options: ExamplesOptions): Promise<void> {
    const subcommand = args[0];

    if (options.help || !subcommand) {
      console.log(Colors.yellow('📚 Examples Management'));
      console.log('');
      console.log('Usage: examples <command> [options]');
      console.log('');
      console.log('Commands:');
      console.log('  generate <package>     Generate documentation for a package');
      console.log('  bundle                 Generate bundled documentation');
      console.log('  find-by-tag <tag>      Find examples by tag pattern');
      console.log('  validate               Validate example configurations');
      console.log('');
      console.log('Options:');
      console.log('  --complexity <level>   Complexity level (basic, intermediate, advanced)');
      console.log('  --framework <fw>       Framework integration (nestjs, express, fastify)');
      console.log('  --sections <sections>  Comma-separated sections to include');
      console.log('  --llm-optimized        Generate LLM-optimized documentation');
      console.log('  --show-related         Include related examples from other packages');
      console.log('  --max-examples <n>     Maximum number of examples to include');
      console.log('  --no-randomize         Disable randomization of examples');
      console.log('  --seed <seed>          Custom seed for randomization');
      console.log('  --di-only              Show only examples that support DI');
      console.log('  --output <file>        Output file path');
      console.log('');
      console.log('Examples:');
      console.log('  examples generate policies --complexity intermediate');
      console.log('  examples generate policies --framework nestjs --llm-optimized');
      console.log('  examples bundle --packages policies,domain-services --framework nestjs');
      console.log('  examples find-by-tag "policies:core" --complexity intermediate');
      console.log('  examples validate --package policies --fix');
      return;
    }

    switch (subcommand) {
      case 'generate':
        const packageName = args[1];
        if (!packageName) {
          console.error(Colors.red('❌ Package name required'));
          console.log('Usage: examples generate <package>');
          return;
        }
        await generateDocumentation(packageName, options);
        break;

      case 'bundle':
        await generateBundle(options);
        break;

      case 'find-by-tag':
        const tagPattern = args[1];
        if (!tagPattern) {
          console.error(Colors.red('❌ Tag pattern required'));
          console.log('Usage: examples find-by-tag <tag>');
          return;
        }
        await findByTag(tagPattern, options);
        break;

      case 'validate':
        await validateExamples(options);
        break;

      default:
        console.error(Colors.red(`❌ Unknown examples command: ${subcommand}`));
        console.log('Use: examples --help for available commands');
    }
  },
};

async function generateDocumentation(packageName: string, options: ExamplesOptions): Promise<void> {
  try {
    const generator = new DocumentationGenerator();

    // Parse complexity levels
    const complexityLevels = options.complexity
      ? options.complexity.split(',').map(c => c.trim())
      : undefined;

    // Parse sections
    const sections = options.sections ? options.sections.split(',').map(s => s.trim()) : undefined;

    // Generate documentation
    const result = await generator.generate({
      packageName,
      ...(complexityLevels && { complexityLevels }),
      ...(options.framework && { framework: options.framework }),
      ...(sections && { sections }),
      ...(options.llmOptimized && { llmOptimized: options.llmOptimized }),
      ...(options.llm && { llmOptimized: options.llm }),
      ...(options.showRelated && { showRelated: options.showRelated }),
      ...(options.maxExamples && { maxExamples: options.maxExamples }),
      randomize: !options.noRandomize,
      ...(options.seed && { seed: options.seed }),
      ...(options.diOnly && { diOnly: options.diOnly }),
      ...(options.output && { outputPath: options.output }),
    });

    console.log(Colors.green(`✅ Documentation generated: ${result.outputPath}`));

    if (options.llmOptimized || options.llm) {
      console.log(Colors.cyan('💡 Tip: Use this file with LLM prompts for code generation'));
    }

    if (result.randomizedExamples && result.randomizedExamples.length > 0) {
      console.log(
        Colors.yellow('🎲 Examples were randomized. Run again to see different examples')
      );
    }
  } catch (error) {
    console.error(
      Colors.red(
        `❌ Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

async function generateBundle(options: ExamplesOptions): Promise<void> {
  try {
    const bundler = new DocumentationBundler();

    // Parse packages
    const packages = options.packages ? options.packages.split(',').map(p => p.trim()) : [];

    // Parse complexity levels
    const complexityLevels = options.complexity
      ? options.complexity.split(',').map(c => c.trim())
      : undefined;

    // Parse sections
    const sections = options.sections ? options.sections.split(',').map(s => s.trim()) : undefined;

    // Generate bundle
    const result = await bundler.generateBundle({
      packages,
      framework: options.framework,
      complexityLevels,
      sections,
      llmOptimized: options.llmOptimized || options.llm,
      diOnly: options.diOnly,
      outputPath: options.output,
    });

    // Write the bundle to file
    const fs = await import('fs/promises');
    await fs.writeFile(result.outputPath!, result.content, 'utf8');

    console.log(Colors.green(`✅ Bundle generated: ${result.outputPath}`));
    console.log(
      Colors.cyan(
        `📦 Includes ${result.packageCount} packages with ${result.exampleCount} examples`
      )
    );

    if (options.llmOptimized || options.llm) {
      console.log(
        Colors.cyan('💡 Tip: Use this bundle with LLM prompts for complete library understanding')
      );
    }
  } catch (error) {
    console.error(
      Colors.red(
        `❌ Failed to generate bundle: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

async function findByTag(tagPattern: string, options: ExamplesOptions): Promise<void> {
  try {
    const tagFinder = new SmartTagFinder();

    // Find examples by tag
    const examples = await tagFinder.findExamplesByTag(tagPattern, options.complexity, {
      ...(options.framework && { framework: options.framework }),
      maxExamples: options.maxExamples || 10,
      randomize: !options.noRandomize,
      ...(options.seed && { seed: options.seed }),
    });

    if (examples.length === 0) {
      console.log(Colors.yellow(`⚠️  No examples found for tag pattern: ${tagPattern}`));

      // Suggest similar tags
      const suggestions = await tagFinder.suggestSimilarTags(tagPattern);
      if (suggestions.length > 0) {
        console.log(Colors.cyan('💡 Did you mean:'));
        suggestions.forEach(suggestion => {
          console.log(`   - ${suggestion}`);
        });
      }

      return;
    }

    // Display results
    console.log(Colors.cyan(`🔍 Found ${examples.length} examples for tag: ${tagPattern}`));
    console.log('');

    examples.forEach(example => {
      console.log(Colors.green(`🔹 ${example.id}`));
      console.log(`   Name: ${example.name}`);
      console.log(`   Package: ${Colors.dim('@vytches-ddd/')}${example.package}`);
      console.log(`   Complexity: ${getComplexityIcon(example.complexity)} ${example.complexity}`);
      console.log(`   DI Support: ${example.diSupport ? '✅' : '❌'}`);
      console.log(`   Tags: ${example.tags.join(', ')}`);
      console.log('');
    });

    // Show randomization info
    if (!options.noRandomize && examples.length > 0) {
      console.log(
        Colors.dim('🎲 Results were randomized. Use --no-randomize for deterministic results')
      );
    }
  } catch (error) {
    console.error(
      Colors.red(
        `❌ Failed to find examples: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

async function validateExamples(options: ExamplesOptions): Promise<void> {
  try {
    const validator = new ExampleValidator();

    // Validate examples
    const results = await validator.validateExamples(options.package || '', {
      packageName: options.package,
      autoFix: options.fix,
      verbose: options.verbose,
    });

    // Display results
    if (results.errors.length === 0 && results.warnings.length === 0) {
      console.log(Colors.green('✅ All examples are valid!'));
    } else {
      // Show errors
      if (results.errors.length > 0) {
        console.log(Colors.red(`❌ Found ${results.errors.length} errors:`));
        results.errors.forEach(error => {
          console.log(`   - ${error.package}/${error.example}: ${error.message}`);
        });
      }

      // Show warnings
      if (results.warnings.length > 0) {
        console.log(Colors.yellow(`⚠️  Found ${results.warnings.length} warnings:`));
        results.warnings.forEach(warning => {
          console.log(`   - ${warning.package}/${warning.example}: ${warning.message}`);
        });
      }

      // Show fixes applied
      if (options.fix && results.fixed && results.fixed.length > 0) {
        console.log(Colors.cyan(`🔧 Applied ${results.fixed.length} fixes:`));
        results.fixed.forEach(fix => {
          console.log(`   - ${fix.package}/${fix.example}: ${fix.description}`);
        });
      }
    }

    // Show summary
    console.log('');
    console.log(Colors.cyan('📊 Validation summary:'));
    console.log(`   - Packages validated: ${results.packagesValidated}`);
    console.log(`   - Examples validated: ${results.examplesValidated}`);
    console.log(`   - Errors: ${results.errors.length}`);
    console.log(`   - Warnings: ${results.warnings.length}`);

    if (options.fix) {
      console.log(`   - Fixes applied: ${results.fixed?.length || 0}`);
    }

    // Exit with error code if there are errors
    if (results.errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(
      Colors.red(`❌ Validation failed: ${error instanceof Error ? error.message : String(error)}`)
    );
    process.exit(1);
  }
}

function getComplexityIcon(complexity: string): string {
  switch (complexity) {
    case 'basic':
      return '🟢';
    case 'intermediate':
      return '🟡';
    case 'advanced':
      return '🔴';
    default:
      return '⚪';
  }
}
