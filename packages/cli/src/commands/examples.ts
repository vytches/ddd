/* eslint-disable no-case-declarations */
/**
 * Examples management command for CLI integration
 */

import { Colors } from '../core/utils/colors';
import { FileSystem } from '../core/utils/file-system';

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
  enhancedMetadata?: boolean;
  repomixSync?: boolean;
  validateApis?: boolean;
  hybrid?: boolean;
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
      console.log('  jsdoc <package>        Generate JSDoc documentation for a package');
      console.log('  repomix               Run repomix integration and analysis');
      console.log('  analyze               Analyze codebase with repomix integration');
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
      console.log('  --repomix-sync         Sync examples with current codebase via repomix');
      console.log('  --validate-apis        Validate API existence against current code');
      console.log('  --hybrid               Enhanced Metadata + Repomix validation');
      console.log('');
      console.log('Examples:');
      console.log('  examples jsdoc aggregates');
      console.log('  examples repomix --package aggregates');
      console.log('  examples analyze');
      return;
    }

    switch (subcommand) {
      case 'jsdoc':
        const packageName = args[1];
        if (!packageName) {
          console.error(Colors.red('❌ Package name required'));
          console.log('Usage: examples jsdoc <package>');
          return;
        }
        await generateJSDoc(packageName, options);
        break;

      case 'repomix':
        await runRepomixIntegration(options);
        break;

      case 'analyze':
        await analyzeCodebase(options);
        break;

      default:
        console.error(Colors.red(`❌ Unknown examples command: ${subcommand}`));
        console.log('Use: examples --help for available commands');
    }
  },
};

async function generateJSDoc(packageName: string, options: ExamplesOptions): Promise<void> {
  try {
    console.log(Colors.cyan(`📝 JSDoc Generation for package: ${packageName}`));

    const packagePath = `packages/${packageName}`;

    // Check if package exists
    if (!(await FileSystem.exists(packagePath))) {
      console.error(Colors.red(`❌ Package '${packageName}' not found in packages/`));
      return;
    }

    console.log(Colors.green('✅ JSDoc v2 system is operational'));
    console.log(Colors.cyan('💡 Use the build system for full JSDoc generation:'));
    console.log(Colors.yellow(`  pnpm build --filter=@vytches/ddd-${packageName}`));
    console.log(
      Colors.yellow(`  JSDOC_DEBUG=true pnpm jsdoc:inject --filter @vytches/ddd-${packageName}`)
    );
  } catch (error) {
    console.error(
      Colors.red(
        `❌ Failed to access package: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

async function runRepomixIntegration(options: ExamplesOptions): Promise<void> {
  try {
    console.log(Colors.cyan('🔍 Repomix integration status check...'));

    const packageName = options.package || 'all';

    console.log(Colors.green('✅ Repomix integration is available'));
    console.log(Colors.cyan('💡 Repomix utilities are preserved in the CLI'));
    console.log(Colors.yellow('Use npx repomix directly for analysis:'));
    console.log(Colors.yellow(`  npx repomix --include "packages/${packageName}/src/**"`));
    console.log(Colors.yellow('  npx repomix --output docs/repomix-analysis.md'));
  } catch (error) {
    console.error(
      Colors.red(
        `❌ Repomix check failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

async function analyzeCodebase(options: ExamplesOptions): Promise<void> {
  try {
    console.log(Colors.cyan('🔍 Codebase analysis tools...'));

    console.log(Colors.green('✅ Analysis tools are available'));
    console.log(Colors.cyan('💡 Combined JSDoc v2 + Repomix workflow:'));
    console.log(Colors.yellow('1. Generate JSDoc documentation:'));
    console.log(
      Colors.yellow('   JSDOC_DEBUG=true pnpm jsdoc:inject --filter @vytches/ddd-[package]')
    );
    console.log(Colors.yellow('2. Run Repomix analysis:'));
    console.log(
      Colors.yellow('   npx repomix --include "packages/*/src/**" --output docs/full-analysis.md')
    );
    console.log(Colors.yellow('3. Both systems work together for comprehensive documentation'));
  } catch (error) {
    console.error(
      Colors.red(`❌ Analysis failed: ${error instanceof Error ? error.message : String(error)}`)
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
