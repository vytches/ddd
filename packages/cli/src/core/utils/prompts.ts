/**
 * @fileoverview Prompts - Interactive prompt system
 * Minimal implementation for user interaction without external dependencies
 */

import * as readline from 'readline';
import { Colors } from './colors';
import { CLIError } from '../../types';

export interface PromptOptions {
  message: string;
  default?: string;
  validate?: (input: string) => boolean | string;
  mask?: boolean; // For password inputs
}

export interface SelectOptions {
  message: string;
  choices: Array<{ name: string; value: any; description?: string }>;
  default?: number;
}

export interface ConfirmOptions {
  message: string;
  default?: boolean;
}

/**
 * Interactive prompts for CLI user interaction
 */
export class Prompts {
  private static rl: readline.Interface | null = null;

  /**
   * Initialize readline interface
   */
  private static getReadline(): readline.Interface {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }
    return this.rl;
  }

  /**
   * Close readline interface
   */
  static close(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  /**
   * Ask a simple question
   */
  static async ask(options: PromptOptions): Promise<string> {
    const rl = this.getReadline();

    return new Promise((resolve, reject) => {
      const promptText = this.formatPrompt(options.message, options.default);

      const askQuestion = () => {
        rl.question(promptText, (answer) => {
          const input = answer.trim() || options.default || '';

          // Validate input
          if (options.validate) {
            const validation = options.validate(input);
            if (validation !== true) {
              console.log(Colors.red(`❌ ${typeof validation === 'string' ? validation : 'Invalid input'}`));
              askQuestion(); // Ask again
              return;
            }
          }

          resolve(input);
        });
      };

      askQuestion();
    });
  }

  /**
   * Ask for password input (hidden)
   */
  static async password(options: Omit<PromptOptions, 'mask'>): Promise<string> {
    return new Promise((resolve) => {
      const promptText = this.formatPrompt(options.message);

      process.stdout.write(promptText);

      // Hide input
      process.stdin.setRawMode(true);
      process.stdin.resume();

      let password = '';

      const onData = (char: Buffer) => {
        const str = char.toString();

        switch (str) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            process.stdin.setRawMode(false);
            process.stdin.removeListener('data', onData);
            process.stdout.write('\n');
            resolve(password);
            break;
          case '\u0003': // Ctrl+C
            process.exit(1);
            break;
          case '\u007f': // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
            }
            break;
          default:
            password += str;
            break;
        }
      };

      process.stdin.on('data', onData);
    });
  }

  /**
   * Ask for confirmation (yes/no)
   */
  static async confirm(options: ConfirmOptions): Promise<boolean> {
    const defaultText = options.default !== undefined
      ? (options.default ? 'Y/n' : 'y/N')
      : 'y/n';

    const defaultValue = options.default !== undefined ? (options.default ? 'y' : 'n') : undefined;

    const answer = await this.ask({
      message: `${options.message} (${defaultText})`,
      ...(defaultValue && { default: defaultValue }),
      validate: (input) => {
        const normalized = input.toLowerCase();
        return ['y', 'yes', 'n', 'no'].includes(normalized) || 'Please answer y/yes or n/no';
      }
    });

    const normalized = answer.toLowerCase();
    return ['y', 'yes'].includes(normalized);
  }

  /**
   * Select from a list of options
   */
  static async select(options: SelectOptions): Promise<any> {
    console.log(Colors.bold(options.message));

    // Display choices
    options.choices.forEach((choice, index) => {
      const isDefault = options.default === index;
      const prefix = isDefault ? Colors.cyan('❯') : ' ';
      const name = isDefault ? Colors.cyan(choice.name) : choice.name;
      const description = choice.description ? Colors.dim(` - ${choice.description}`) : '';

      console.log(`${prefix} ${index + 1}. ${name}${description}`);
    });

    const defaultValue = options.default !== undefined ? String(options.default + 1) : undefined;

    const answer = await this.ask({
      message: 'Select option',
      ...(defaultValue && { default: defaultValue }),
      validate: (input) => {
        const num = parseInt(input, 10);
        return (num >= 1 && num <= options.choices.length) ||
               `Please select a number between 1 and ${options.choices.length}`;
      }
    });

    const selectedIndex = parseInt(answer, 10) - 1;
    return options.choices[selectedIndex]?.value;
  }

  /**
   * Multi-select from a list of options
   */
  static async multiSelect(options: SelectOptions): Promise<any[]> {
    console.log(Colors.bold(options.message));
    console.log(Colors.dim('(Use comma-separated numbers, e.g., 1,3,5)'));

    // Display choices
    options.choices.forEach((choice, index) => {
      const description = choice.description ? Colors.dim(` - ${choice.description}`) : '';
      console.log(`  ${index + 1}. ${choice.name}${description}`);
    });

    const answer = await this.ask({
      message: 'Select options',
      validate: (input) => {
        if (!input.trim()) return 'Please select at least one option';

        const indices = input.split(',').map(s => parseInt(s.trim(), 10));
        const invalid = indices.find(num => isNaN(num) || num < 1 || num > options.choices.length);

        return invalid === undefined ||
               `Invalid selection: ${invalid}. Please use numbers between 1 and ${options.choices.length}`;
      }
    });

    const selectedIndices = answer.split(',').map(s => parseInt(s.trim(), 10) - 1);
    return selectedIndices.map(index => options.choices[index]?.value).filter(Boolean);
  }

  /**
   * Display a loading spinner
   */
  static spinner(message: string): {
    start: () => void;
    stop: () => void;
    update: (newMessage: string) => void;
  } {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frame = 0;
    let interval: NodeJS.Timeout | null = null;
    let currentMessage = message;

    return {
      start: () => {
        if (interval) return;

        interval = setInterval(() => {
          process.stdout.write(`\r${Colors.cyan(frames[frame] || '⠋')} ${currentMessage || ''}`);
          frame = (frame + 1) % frames.length;
        }, 100);
      },

      stop: () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
          process.stdout.write(`\r${  ' '.repeat((currentMessage?.length || 0) + 2)  }\r`);
        }
      },

      update: (newMessage: string) => {
        currentMessage = newMessage;
      }
    };
  }

  /**
   * Format prompt text
   */
  private static formatPrompt(message: string, defaultValue?: string): string {
    const defaultText = defaultValue ? Colors.dim(` (${defaultValue})`) : '';
    return Colors.bold(`? ${message}${defaultText}: `);
  }

  /**
   * Display progress bar
   */
  static progressBar(current: number, total: number, message?: string): void {
    const percentage = Math.round((current / total) * 100);
    const width = 30;
    const filled = Math.round((current / total) * width);
    const empty = width - filled;

    const bar = Colors.green('█'.repeat(filled)) + Colors.dim('░'.repeat(empty));
    const text = message ? ` ${message}` : '';

    process.stdout.write(`\r${bar} ${percentage}%${text}`);

    if (current === total) {
      process.stdout.write('\n');
    }
  }

  /**
   * Clear current line
   */
  static clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }

  /**
   * Move cursor up
   */
  static cursorUp(lines = 1): void {
    process.stdout.write(`\x1b[${lines}A`);
  }

  /**
   * Move cursor down
   */
  static cursorDown(lines = 1): void {
    process.stdout.write(`\x1b[${lines}B`);
  }
}

/**
 * Helper function for input prompts
 */
export async function promptForInput(
  message: string,
  options: { defaultValue?: string; required?: boolean; validate?: (input: string) => boolean | string } = {}
): Promise<string> {
  const promptOptions: PromptOptions = {
    message,
    ...(options.defaultValue && { default: options.defaultValue }),
    ...(options.validate && { validate: options.validate })
  };

  const result = await Prompts.ask(promptOptions);

  if (options.required && !result) {
    throw new CLIError('Input is required');
  }

  return result;
}

/**
 * Helper function for choice prompts
 */
export async function promptForChoice(
  message: string,
  choices: Array<{ name: string; value: any; description?: string }>,
  defaultIndex?: number
): Promise<any> {
  const selectOptions: SelectOptions = {
    message,
    choices,
    ...(defaultIndex !== undefined && { default: defaultIndex })
  };

  return await Prompts.select(selectOptions);
}

/**
 * Helper function for confirmation prompts
 */
export async function promptForConfirmation(
  message: string,
  defaultValue?: boolean
): Promise<boolean> {
  const confirmOptions: ConfirmOptions = {
    message,
    ...(defaultValue !== undefined && { default: defaultValue })
  };

  return await Prompts.confirm(confirmOptions);
}

/**
 * Helper function for multi-select prompts
 */
export async function promptForMultiSelect(
  message: string,
  choices: Array<{ name: string; value: any; description?: string }>
): Promise<any[]> {
  return await Prompts.multiSelect({
    message,
    choices
  });
}
