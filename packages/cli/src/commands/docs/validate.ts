import type { CommandModule } from 'yargs';
import { ExampleValidator } from '../../validators/example-validator';
import { logger } from '../../core/utils/logger';

interface ValidateArgs {
  package?: string;
  fix?: boolean;
  verbose?: boolean;
}

export const validateCommand: CommandModule<Record<string,unknown>, ValidateArgs> = {
  command: 'validate',
  describe: 'Validate example configurations and content',
  builder: {
    package: {
      type: 'string',
      describe: 'Validate specific package only',
      alias: 'p'
    },
    fix: {
      type: 'boolean',
      describe: 'Automatically fix issues where possible',
      default: false
    },
    verbose: {
      type: 'boolean',
      describe: 'Show detailed validation results',
      alias: 'v',
      default: false
    }
  },
  handler: async (argv) => {
    try {
      const validator = new ExampleValidator();

      // Validate examples
      const results = await validator.validateExamples(argv.package || '', {
        packageName: argv.package,
        autoFix: argv.fix,
        verbose: argv.verbose
      });

      // Display results
      if (results.errors.length === 0 && results.warnings.length === 0) {
        logger.success('✅ All examples are valid!');
      } else {
        // Show errors
        if (results.errors.length > 0) {
          logger.error(`❌ Found ${results.errors.length} errors:`);
          results.errors.forEach(error => {
            logger.error(`   - ${error.package}/${error.example}: ${error.message}`);
          });
        }

        // Show warnings
        if (results.warnings.length > 0) {
          logger.warn(`⚠️  Found ${results.warnings.length} warnings:`);
          results.warnings.forEach(warning => {
            logger.warn(`   - ${warning.package}/${warning.example}: ${warning.message}`);
          });
        }
      }

      // Show fixes applied (regardless of errors/warnings)
      if (argv.fix && results.fixed && results.fixed.length > 0) {
        logger.info(`🔧 Applied ${results.fixed.length} fixes:`);
        results.fixed.forEach(fix => {
          logger.info(`   - ${fix.package}/${fix.example}: ${fix.description}`);
        });
      }

      // Show summary
      logger.info(`📊 Validation summary:`);
      logger.info(`   - Packages validated: ${results.packagesValidated}`);
      logger.info(`   - Examples validated: ${results.examplesValidated}`);
      logger.info(`   - Errors: ${results.errors.length}`);
      logger.info(`   - Warnings: ${results.warnings.length}`);

      if (argv.fix) {
        logger.info(`   - Fixes applied: ${results.fixed?.length || 0}`);
      }

      // Exit with error code if there are errors
      if (results.errors.length > 0) {
        process.exit(1);
      }

    } catch (error) {
      logger.error(`❌ Validation failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
};
