import type { CommandModule } from 'yargs';
import { DocumentationGenerator } from '../../generators/documentation-generator';
import { logger } from '../../core/utils/logger';

export interface GenerateArgs {
  package: string;
  complexity?: string;
  framework?: string;
  sections?: string;
  llmOptimized?: boolean;
  showRelated?: boolean;
  maxExamples?: number;
  noRandomize?: boolean;
  seed?: string;
  diOnly?: boolean;
  output?: string;
}

export const generateCommand: CommandModule<Record<string, unknown>, GenerateArgs> = {
  command: 'generate <package>',
  describe: 'Generate documentation for a specific package',
  builder: {
    package: {
      type: 'string',
      describe: 'Package name (e.g., policies, domain-services, acl)',
      demandOption: true,
    },
    complexity: {
      type: 'string',
      describe: 'Complexity level: basic, intermediate, advanced, or comma-separated list',
      alias: 'c',
    },
    framework: {
      type: 'string',
      choices: ['nestjs', 'express', 'fastify'],
      describe: 'Framework integration',
      alias: 'f',
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
    showRelated: {
      type: 'boolean',
      describe: 'Include related examples from other packages',
      default: false,
    },
    maxExamples: {
      type: 'number',
      describe: 'Maximum number of examples to include',
      alias: 'm',
    },
    noRandomize: {
      type: 'boolean',
      describe: 'Disable randomization of examples',
      default: false,
    },
    seed: {
      type: 'string',
      describe: 'Custom seed for randomization',
    },
    diOnly: {
      type: 'boolean',
      describe: 'Show only examples that support DI',
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
      const generator = new DocumentationGenerator();

      // Parse complexity levels
      const complexityLevels = argv.complexity
        ? argv.complexity.split(',').map(c => c.trim())
        : undefined;

      // Parse sections
      const sections = argv.sections ? argv.sections.split(',').map(s => s.trim()) : undefined;

      // Generate documentation
      const result = await generator.generate({
        packageName: argv.package,
        complexityLevels: complexityLevels || [],
        ...(argv.framework && { framework: argv.framework }),
        sections: sections || [],
        ...(argv.llmOptimized && { llmOptimized: argv.llmOptimized }),
        ...(argv.showRelated && { showRelated: argv.showRelated }),
        ...(argv.maxExamples && { maxExamples: argv.maxExamples }),
        randomize: !argv.noRandomize,
        ...(argv.seed && { seed: argv.seed }),
        ...(argv.diOnly && { diOnly: argv.diOnly }),
        ...(argv.output && { outputPath: argv.output }),
      });

      logger.success(`✅ Documentation generated: ${result.outputPath}`);

      if (argv.llmOptimized) {
        logger.info('💡 Tip: Use this file with LLM prompts for code generation');
      }

      if (result.randomizedExamples && result.randomizedExamples.length > 0) {
        logger.info('🎲 Examples were randomized. Run again to see different examples');
      }
    } catch (error) {
      logger.error(
        `❌ Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  },
};
