/**
 * @fileoverview Command Registry - Plugin-based command system
 * Enterprise-grade command management with Commander.js wrapper
 */

import { Command as CommanderCommand, program } from 'commander';
import type { CLIConfig, Command, CommandAction } from '../../types';
import { CLIError } from '../../types';
import { Colors } from '../utils/colors';
import { Performance } from '../utils/performance';
import { workflowCommand } from '../../commands/workflow';
import { suggestCommand } from '../../commands/suggest';
import { domainBuilderCommand } from '../../commands/domain-builder';
import { generateCommand } from '../../commands/generate';

/**
 * @llm-summary CommandRegistry class for command registry operations
 * @llm-domain Infrastructure
 * @llm-complexity Simple
 *
 * @description
 * CommandRegistry class implementing infrastructure service for command registry operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CommandRegistry();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CommandRegistry());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CommandRegistry {
  private commands = new Map<string, Command>();
  private program: CommanderCommand;
  private config: CLIConfig;

  constructor(config: CLIConfig) {
    this.config = config;
    this.program = new CommanderCommand();
    this.setupProgram();
  }

  /**
   * Factory method to create command registry
   */
  static create(config: CLIConfig): CommandRegistry {
    return new CommandRegistry(config);
  }

  /**
   * Setup the base Commander.js program
   */
  private setupProgram(): void {
    this.program
      .name('vytches-ddd')
      .description('🎯 VytchesDDD CLI - Enterprise-Grade Domain Builder')
      .version('1.0.0')
      .option('-d, --debug', 'Enable debug output', false)
      .option('-c, --config <path>', 'Configuration file path')
      .option('--dry-run', 'Preview changes without executing', false)
      .configureOutput({
        writeOut: str => {
          if (process.stdout && process.stdout.write) {
            process.stdout.write(Colors.cyan(str));
          } else {
            console.log(Colors.cyan(str));
          }
        },
        writeErr: str => {
          if (process.stderr && process.stderr.write) {
            process.stderr.write(Colors.red(str));
          } else {
            console.error(Colors.red(str));
          }
        },
      });
  }

  /**
   * Register a command
   */
  registerCommand(command: Command): void {
    // Store in our registry
    this.commands.set(command.name, command);

    // Create Commander command
    const cmd = this.program.command(command.name).description(command.description);

    // Add aliases
    if (command.aliases) {
      command.aliases.forEach(alias => cmd.alias(alias));
    }

    // Add options
    if (command.options) {
      command.options.forEach(option => {
        const flags = option.flags;
        const description = option.description;
        const defaultValue = option.defaultValue;

        const opt = cmd.option(flags, description, defaultValue);
        if (option.choices) {
          // Commander.js doesn't have runtime choices validation by default
          // We'll handle this in the action function if needed
          // For now, just add the option
        }
      });
    }

    // Add examples to help
    if (command.examples) {
      const examples = command.examples
        .map(example => `  ${Colors.dim('$')} ${example}`)
        .join('\n');
      cmd.addHelpText('after', `\n${Colors.bold('Examples:')}\n${examples}\n`);
    }

    // Set action
    cmd.action(async (...args) => {
      const startTime = Performance.now();

      try {
        // Extract options and arguments
        const options = args[args.length - 1] || {};
        const cmdArgs = args.slice(0, -1);

        // Merge global options
        const globalOptions = this.program.opts();
        const mergedOptions = { ...globalOptions, ...options };

        // Execute command
        await command.action(cmdArgs, mergedOptions);

        // Performance tracking
        if (mergedOptions.debug) {
          const duration = Performance.since(startTime);
          console.log(Colors.dim(`\n⚡ Command '${command.name}' completed in ${duration}ms`));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(Colors.red(`❌ Error in command '${command.name}': ${message}`));

        if (this.config.debug && error instanceof Error && error.stack) {
          console.error(Colors.dim(error.stack));
        }

        if (typeof process !== 'undefined' && process.exit) {
          process.exit(1);
        } else {
          throw error;
        }
      }
    });
  }

  /**
   * Load all commands from command modules
   */
  async loadCommands(): Promise<void> {
    try {
      // Register core commands
      await this.loadCoreCommands();

      // Load plugin commands
      await this.loadPluginCommands();

      // Add help enhancements
      this.enhanceHelp();
    } catch (error) {
      throw new CLIError(
        `Failed to load commands: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Load core commands
   */
  private async loadCoreCommands(): Promise<void> {
    // Generate commands
    this.registerCommand(generateCommand);

    // Analyze commands
    this.registerCommand({
      name: 'analyze',
      description: 'Analyze domain compliance, performance, and architecture',
      aliases: ['a'],
      options: [
        {
          flags: '-p, --path <path>',
          description: 'Path to analyze',
          defaultValue: './src',
        },
        {
          flags: '-t, --type <type>',
          description: 'Analysis type',
          choices: ['domain', 'performance', 'security', 'architecture', 'all'],
          defaultValue: 'all',
        },
        {
          flags: '--format <format>',
          description: 'Output format',
          choices: ['console', 'json', 'html'],
          defaultValue: 'console',
        },
      ],
      examples: [
        'vytches-ddd analyze --path ./src/domain',
        'vytches-ddd analyze --type security --format json',
      ],
      action: this.createAnalyzeAction(),
    });

    // Setup commands
    this.registerCommand({
      name: 'setup',
      description: 'Setup project structure and framework integration',
      aliases: ['init'],
      options: [
        {
          flags: '-s, --structure <structure>',
          description: 'Project structure',
          choices: [
            'clean-architecture',
            'hexagonal',
            'onion',
            'modular-monolith',
            'microservices',
          ],
          defaultValue: 'clean-architecture',
        },
        {
          flags: '-f, --framework <framework>',
          description: 'Framework to integrate',
          choices: ['nestjs', 'express', 'fastify'],
          defaultValue: 'nestjs',
        },
        {
          flags: '--enterprise',
          description: 'Include enterprise features',
          defaultValue: false,
        },
      ],
      examples: [
        'vytches-ddd setup --structure hexagonal --framework nestjs',
        'vytches-ddd setup --enterprise',
      ],
      action: this.createSetupAction(),
    });

    // Workflow commands
    this.registerCommand(workflowCommand);

    // Suggestion commands
    this.registerCommand(suggestCommand);

    // Domain Builder commands
    this.registerCommand(domainBuilderCommand);
  }

  /**
   * Load plugin commands
   */
  private async loadPluginCommands(): Promise<void> {
    // Plugin loading will be implemented in future phases
    // For now, this is a placeholder
  }

  /**
   * Enhance help output
   */
  private enhanceHelp(): void {
    this.program.addHelpText(
      'before',
      `
${Colors.bold(Colors.cyan('🎯 VytchesDDD CLI'))} - ${Colors.dim('Enterprise-Grade Domain Builder')}

${Colors.bold('Revolutionary Features:')}
  • Complete domain generation in minutes
  • All VytchesDDD patterns supported
  • Flexible architecture support (Clean, Hexagonal, Onion)
  • Interactive AI-powered workflows
  • Enterprise-grade features out of the box

`
    );

    this.program.addHelpText(
      'after',
      `
${Colors.bold('Examples:')}
  ${Colors.dim('# Generate complete e-commerce domain')}
  $ vytches-ddd create-domain "E-commerce Platform"

  ${Colors.dim('# Generate aggregate with CQRS')}
  $ vytches-ddd generate --type aggregate --name Order --with-cqrs

  ${Colors.dim('# Analyze domain compliance')}
  $ vytches-ddd analyze --type domain --path ./src

  ${Colors.dim('# Setup NestJS project with hexagonal architecture')}
  $ vytches-ddd setup --structure hexagonal --framework nestjs

${Colors.bold('Documentation:')} ${Colors.cyan('https://github.com/vytches/vytches-ddd')}
${Colors.bold('Issues & Support:')} ${Colors.cyan('https://github.com/vytches/vytches-ddd/issues')}
`
    );
  }

  /**
   * Execute the CLI with provided arguments
   */
  async execute(args: string[]): Promise<void> {
    await this.program.parseAsync(args);
  }

  /**
   * Get registered command
   */
  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  /**
   * Get all registered commands
   */
  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Create analyze action (placeholder)
   */
  private createAnalyzeAction(): CommandAction {
    return async (args: string[], options: Record<string, any>) => {
      console.log(Colors.yellow('📊 Analyze command implementation coming soon...'));
      console.log('Options:', options);
    };
  }

  /**
   * Create setup action (placeholder)
   */
  private createSetupAction(): CommandAction {
    return async (args: string[], options: Record<string, any>) => {
      console.log(Colors.yellow('🏗️ Setup command implementation coming soon...'));
      console.log('Options:', options);
    };
  }
}
