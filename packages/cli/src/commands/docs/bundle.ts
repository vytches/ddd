import type { CommandModule } from 'yargs';
import { DocumentationBundler } from '../../generators/documentation-bundler';
import { logger } from '../../core/utils/logger';

interface BundleArgs {
  packages?: string;
  framework?: string;
  complexity?: string;
  sections?: string;
  llmOptimized?: boolean;
  diOnly?: boolean;
  output?: string;
}

export const bundleCommand: CommandModule<Record<string, unknown>, BundleArgs> = {
  command: 'bundle',
  describe: 'Generate bundled documentation for multiple packages',
  builder: {
    packages: {
      type: 'string',
      describe: 'Comma-separated list of packages to include',
      alias: 'p',
    },
    framework: {
      type: 'string',
      choices: ['nestjs', 'express', 'fastify'],
      describe: 'Framework integration for all packages',
      alias: 'f',
    },
    complexity: {
      type: 'string',
      describe: 'Complexity level: basic, intermediate, advanced, or comma-separated list',
      alias: 'c',
    },
    sections: {
      type: 'string',
      describe: 'Comma-separated list of sections to include',
      alias: 's',
    },
    llmOptimized: {
      type: 'boolean',
      describe: 'Generate LLM-optimized documentation',
      alias: 'llm',
      default: false,
    },
    diOnly: {
      type: 'boolean',
      describe: 'Include only examples that support DI',
      default: false,
    },
    output: {
      type: 'string',
      describe: 'Output file path',
      alias: 'o',
    },
  },
  handler: async argv => {
    try {
      const bundler = new DocumentationBundler();

      // Parse packages
      const packages = argv.packages ? argv.packages.split(',').map(p => p.trim()) : undefined; // If not specified, use all packages

      // Parse complexity levels
      const complexityLevels = argv.complexity
        ? argv.complexity.split(',').map(c => c.trim())
        : undefined;

      // Parse sections
      const sections = argv.sections ? argv.sections.split(',').map(s => s.trim()) : undefined;

      // Generate bundle
      const result = await bundler.generateBundle({
        packages: packages || [],
        framework: argv.framework,
        complexityLevels,
        sections,
        llmOptimized: argv.llmOptimized,
        diOnly: argv.diOnly,
        outputPath: argv.output,
      });

      logger.success(`✅ Bundle generated: ${result.outputPath}`);
      logger.info(
        `📦 Includes ${result.packageCount} packages with ${result.exampleCount} examples`
      );

      if (argv.llmOptimized) {
        logger.info('💡 Tip: Use this bundle with LLM prompts for complete library understanding');
      }
    } catch (error) {
      logger.error(
        `❌ Failed to generate bundle: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  },
};
