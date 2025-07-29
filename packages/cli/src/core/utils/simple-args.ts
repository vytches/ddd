/**
 * @llm-summary Contract for parsed args functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ParsedArgs interface implementing infrastructure service for parsed args operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteParsedArgs implements ParsedArgs {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */

export interface ParsedArgs {
  command?: string | undefined;
  args: string[];
  options: Record<string, any>;
}

/**
 * @llm-summary SimpleArgsParser class for simple args parser operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * SimpleArgsParser class implementing infrastructure service for simple args parser operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SimpleArgsParser();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class SimpleArgsParser {
  static parse(argv: string[]): ParsedArgs {
    // Skip node and script path
    const args = argv.slice(2);

    // Debug what we're parsing (remove in production)
    // console.log(`🔍 Debug parsing - Raw argv:`, argv);
    // console.log(`🔍 Debug parsing - Args after slice:`, args);

    if (args.length === 0) {
      return { args: [], options: {} };
    }

    const command = args[0] && !args[0].startsWith('-') ? args[0] : undefined;
    const remaining = command ? args.slice(1) : args;

    const options: Record<string, any> = {};
    const positional: string[] = [];

    for (let i = 0; i < remaining.length; i++) {
      const arg = remaining[i];

      if (!arg) continue;

      if (arg.startsWith('--')) {
        if (arg.includes('=')) {
          // --key=value
          const [key, value] = arg.substring(2).split('=', 2);
          if (key && value !== undefined) {
            options[this.toCamelCase(key)] = this.parseValue(value);
          }
        } else {
          // --key [value]
          const key = arg.substring(2);
          const nextArg = remaining[i + 1];

          // Handle component shortcuts and regular flags
          const result = this.handleComponentShortcuts(key, nextArg);

          // Special handling for component shortcuts with name
          if (result.key === 'componentWithName') {
            options.type = result.value.type;
            options.name = result.value.name;
          } else {
            options[this.toCamelCase(result.key)] = result.value;
          }

          if (result.skipNext) {
            i++; // Skip next arg
          }
        }
      } else if (arg.startsWith('-') && arg.length === 2) {
        // -f [value]
        const key = arg.substring(1);
        const nextArg = remaining[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          // -f value
          options[this.expandShortFlag(key)] = this.parseValue(nextArg);
          i++; // Skip next arg
        } else {
          // -f
          options[this.expandShortFlag(key)] = true;
        }
      } else {
        // Positional argument
        positional.push(arg);
      }
    }

    return {
      command,
      args: positional,
      options,
    };
  }

  /**
   * Convert kebab-case to camelCase
   */
  private static toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Expand short flags to full names and handle component shortcuts
   */
  private static expandShortFlag(flag: string): string {
    const shortFlags: Record<string, string> = {
      t: 'type',
      n: 'name',
      o: 'output',
      f: 'framework',
      d: 'debug',
      c: 'config',
      h: 'help',
      v: 'version',
    };

    return shortFlags[flag] || flag;
  }

  /**
   * Handle component type shortcuts like --specification
   */
  private static handleComponentShortcuts(
    key: string,
    nextArg?: string
  ): { key: string; value: any; skipNext: boolean } {
    const componentShortcuts: Record<string, string> = {
      specification: 'specification',
      aggregate: 'aggregate',
      entity: 'entity',
      'value-object': 'value-object',
      policy: 'policy',
      command: 'command',
      query: 'query',
      event: 'event',
      repository: 'repository',
      'domain-service': 'domain-service',
    };

    if (componentShortcuts[key]) {
      // If next arg looks like a name (not a flag), treat it as name
      if (nextArg && !nextArg.startsWith('-')) {
        // Return special signal that we need to set both type and name
        return {
          key: 'componentWithName',
          value: { type: componentShortcuts[key], name: nextArg },
          skipNext: true,
        };
      }
      return {
        key: 'type',
        value: componentShortcuts[key],
        skipNext: false,
      };
    }

    return {
      key,
      value: nextArg && !nextArg.startsWith('-') ? this.parseValue(nextArg) : true,
      skipNext: !!(nextArg && !nextArg.startsWith('-')),
    };
  }

  /**
   * Parse value to appropriate type
   */
  private static parseValue(value: string): any {
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Number
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

    // String
    return value;
  }

  /**
   * Show help for command
   */
  static showHelp(commandName?: string): void {
    console.log('🎯 VytchesDDD CLI - Enterprise-Grade Domain Builder');
    console.log('');

    if (!commandName || commandName === 'generate') {
      console.log('Usage: vytches-ddd generate [options]');
      console.log('');
      console.log('Options:');
      console.log(
        '  -t, --type <type>        Component type (aggregate, entity, value-object, specification, etc.)'
      );
      console.log('  -n, --name <name>        Component name');
      console.log('  -o, --output <path>      Output directory (default: ./src)');
      console.log('  -f, --framework <fw>     Framework (nestjs, express, fastify, standalone)');
      console.log('  --interactive            Use interactive mode');
      console.log('  --with-tests             Generate tests');
      console.log('  --dry-run                Preview without creating files');
      console.log('  -h, --help               Show help');
      console.log('');
      console.log('Examples:');
      console.log('  vytches-ddd generate --type aggregate --name Order');
      console.log('  vytches-ddd generate --type specification --name OrderValidation');
      console.log('  vytches-ddd generate --interactive');
    }

    if (!commandName || commandName === 'domain') {
      console.log('Usage: vytches-ddd domain [options]');
      console.log('');
      console.log('Options:');
      console.log('  --name <name>            Domain name');
      console.log('  --guided                 Use guided mode');
      console.log('  --dry-run                Preview without creating files');
    }
  }
}
