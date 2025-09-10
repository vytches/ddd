#!/usr/bin/env node

/**
 * @fileoverview VytchesDDD CLI Entry Point
 * Enterprise-Grade Domain-Driven Design CLI
 */

import { SimpleArgsParser } from './core/utils/simple-args';
import { ConfigManager } from './core/engines/config-manager';
import { Colors } from './core/utils/colors';
import { Performance } from './core/utils/performance';
import { generateCommand } from './commands/generate';
import { domainBuilderCommand } from './commands/domain-builder';
import { examplesCommand } from './commands/examples';
import { quickStartCommand } from './commands/quick-start';

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const startTime = Performance.now();

  try {
    // Parse arguments
    const parsed = SimpleArgsParser.parse(process.argv);

    // Show help if requested
    if (parsed.options.help || parsed.options.h) {
      SimpleArgsParser.showHelp(parsed.command);
      return;
    }

    // Show version if requested
    if (parsed.options.version || parsed.options.v) {
      console.log('🎯 VytchesDDD CLI v0.3.0');
      return;
    }

    // Initialize configuration
    const config = await ConfigManager.initialize();
    if (parsed.options.debug) {
      config.debug = true;
    }

    // Route to appropriate command
    switch (parsed.command) {
      case 'generate':
      case 'g':
        await generateCommand.action(parsed.args, parsed.options);
        break;

      case 'domain':
      case 'domain-builder':
        await domainBuilderCommand.action(parsed.args, parsed.options);
        break;

      case 'examples':
        await examplesCommand.action(parsed.args, parsed.options);
        break;

      case 'quick-start':
      case 'qs':
        await quickStartCommand.action(parsed.args, parsed.options);
        break;

      default:
        if (!parsed.command) {
          console.log(Colors.yellow('🎯 VytchesDDD CLI - Enterprise-Grade Domain Builder'));
          console.log('');
          console.log('Available commands:');
          console.log('  generate, g      Generate DDD components');
          console.log('  domain           Build complete domains');
          console.log('  examples         Manage and work with examples');
          console.log('  quick-start, qs  Generate AI-powered quick start guide');
          console.log('');
          console.log('Use --help with any command for more information');
        } else {
          console.error(Colors.red(`❌ Unknown command: ${parsed.command}`));
          console.log('Use --help to see available commands');
          process.exit(1);
        }
    }

    // Performance tracking
    const duration = Performance.since(startTime);
    if (config.debug) {
      console.log(Colors.dim(`\n⚡ Completed in ${duration}ms`));
    }
  } catch (error) {
    console.error(Colors.red('❌ CLI Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Export main function
export { main };

// Run CLI if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
