import type { CommandModule } from 'yargs';
import { promises as fs } from 'fs';
import { SmartTagFinder } from '../../core/smart-tag-finder';
import { logger } from '../../core/utils/logger';

export interface FindByTagArgs {
  tag: string;
  complexity?: string;
  framework?: string;
  maxExamples?: number;
  noRandomize?: boolean;
  seed?: string;
  output?: string;
}

export const findByTagCommand: CommandModule<Record<string, unknown>, FindByTagArgs> = {
  command: 'find-by-tag <tag>',
  describe: 'Find examples by tag pattern',
  builder: {
    tag: {
      type: 'string',
      describe: 'Tag pattern (e.g., "policies:core", "*:integration:*")',
      demandOption: true,
    },
    complexity: {
      type: 'string',
      describe: 'Filter by complexity level',
      alias: 'c',
    },
    framework: {
      type: 'string',
      choices: ['nestjs', 'express', 'fastify'],
      describe: 'Filter by framework support',
      alias: 'f',
    },
    maxExamples: {
      type: 'number',
      describe: 'Maximum number of examples to return',
      alias: 'm',
      default: 10,
    },
    noRandomize: {
      type: 'boolean',
      describe: 'Disable randomization of results',
      default: false,
    },
    seed: {
      type: 'string',
      describe: 'Custom seed for randomization',
    },
    output: {
      type: 'string',
      describe: 'Output results to file',
      alias: 'o',
    },
  },
  handler: async argv => {
    try {
      const tagFinder = new SmartTagFinder();

      // Find examples by tag
      const examples = await tagFinder.findExamplesByTag(argv.tag, argv.complexity, {
        ...(argv.framework && { framework: argv.framework }),
        ...(argv.maxExamples && { maxExamples: argv.maxExamples }),
        randomize: !argv.noRandomize,
        ...(argv.seed && { seed: argv.seed }),
      });

      if (examples.length === 0) {
        logger.warn(`⚠️  No examples found for tag pattern: ${argv.tag}`);

        // Suggest similar tags
        const suggestions = await tagFinder.suggestSimilarTags(argv.tag);
        if (suggestions.length > 0) {
          logger.info('💡 Did you mean:');
          suggestions.forEach(suggestion => {
            logger.info(`   - ${suggestion}`);
          });
        }

        return;
      }

      // Display results
      logger.info(`🔍 Found ${examples.length} examples for tag: ${argv.tag}`);

      if (argv.output) {
        // Save to file
        const output = examples.map(example => ({
          id: example.id,
          name: example.name,
          package: example.package,
          complexity: example.complexity,
          description: example.description,
          tags: example.tags,
          diSupport: example.diSupport,
          frameworkIntegrations: example.frameworkIntegrations,
        }));

        await fs.writeFile(argv.output, JSON.stringify(output, null, 2));

        logger.success(`✅ Results saved to: ${argv.output}`);
      } else {
        // Display in console
        console.table(
          examples.map(example => ({
            ID: example.id,
            Name: example.name,
            Package: example.package,
            Complexity: example.complexity,
            DI: example.diSupport ? '✅' : '❌',
            Tags: example.tags.join(', '),
          }))
        );
      }

      // Show randomization info
      if (!argv.noRandomize && examples.length > 0) {
        logger.info('🎲 Results were randomized. Use --no-randomize for deterministic results');
      }
    } catch (error) {
      logger.error(
        `❌ Failed to find examples: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  },
};
