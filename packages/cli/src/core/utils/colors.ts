/**
 * @fileoverview Colors - ANSI color utilities
 * Minimal implementation for terminal styling without external dependencies
 */

/**
 * ANSI escape codes for terminal colors and styles
 */
const ANSI = {
  // Reset
  reset: '\x1b[0m',

  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Text styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  strikethrough: '\x1b[9m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
} as const;

/**
 * Check if colors should be enabled
 */
function shouldUseColors(): boolean {
  // Disable colors if NO_COLOR environment variable is set
  if (process.env.NO_COLOR) {
    return false;
  }

  // Disable colors if TERM is 'dumb'
  if (process.env.TERM === 'dumb') {
    return false;
  }

  // Check if stdout is a TTY
  return Boolean(process.stdout && process.stdout.isTTY);
}

/**
 * Apply ANSI color to text
 */
function colorize(text: string, code: string): string {
  if (!shouldUseColors()) {
    return text;
  }
  return `${code}${text}${ANSI.reset}`;
}

/**
 * @llm-summary Colors class for colors operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * Colors class implementing infrastructure service for colors operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new Colors();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new Colors());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class Colors {
  // Basic colors
  static black(text: string): string {
    return colorize(text, ANSI.black);
  }

  static red(text: string): string {
    return colorize(text, ANSI.red);
  }

  static green(text: string): string {
    return colorize(text, ANSI.green);
  }

  static yellow(text: string): string {
    return colorize(text, ANSI.yellow);
  }

  static blue(text: string): string {
    return colorize(text, ANSI.blue);
  }

  static magenta(text: string): string {
    return colorize(text, ANSI.magenta);
  }

  static cyan(text: string): string {
    return colorize(text, ANSI.cyan);
  }

  static white(text: string): string {
    return colorize(text, ANSI.white);
  }

  static gray(text: string): string {
    return colorize(text, ANSI.gray);
  }

  // Bright colors
  static brightRed(text: string): string {
    return colorize(text, ANSI.brightRed);
  }

  static brightGreen(text: string): string {
    return colorize(text, ANSI.brightGreen);
  }

  static brightYellow(text: string): string {
    return colorize(text, ANSI.brightYellow);
  }

  static brightBlue(text: string): string {
    return colorize(text, ANSI.brightBlue);
  }

  static brightMagenta(text: string): string {
    return colorize(text, ANSI.brightMagenta);
  }

  static brightCyan(text: string): string {
    return colorize(text, ANSI.brightCyan);
  }

  static brightWhite(text: string): string {
    return colorize(text, ANSI.brightWhite);
  }

  // Text styles
  static bold(text: string): string {
    return colorize(text, ANSI.bold);
  }

  static dim(text: string): string {
    return colorize(text, ANSI.dim);
  }

  static italic(text: string): string {
    return colorize(text, ANSI.italic);
  }

  static underline(text: string): string {
    return colorize(text, ANSI.underline);
  }

  static strikethrough(text: string): string {
    return colorize(text, ANSI.strikethrough);
  }

  // Background colors
  static bgBlack(text: string): string {
    return colorize(text, ANSI.bgBlack);
  }

  static bgRed(text: string): string {
    return colorize(text, ANSI.bgRed);
  }

  static bgGreen(text: string): string {
    return colorize(text, ANSI.bgGreen);
  }

  static bgYellow(text: string): string {
    return colorize(text, ANSI.bgYellow);
  }

  static bgBlue(text: string): string {
    return colorize(text, ANSI.bgBlue);
  }

  static bgMagenta(text: string): string {
    return colorize(text, ANSI.bgMagenta);
  }

  static bgCyan(text: string): string {
    return colorize(text, ANSI.bgCyan);
  }

  static bgWhite(text: string): string {
    return colorize(text, ANSI.bgWhite);
  }

  // Utility methods
  static strip(text: string): string {
    // Remove all ANSI escape codes
    return text.replace(/\\x1b\[[0-9;]*m/g, '');
  }

  static isColorSupported(): boolean {
    return shouldUseColors();
  }

  // Semantic colors for CLI output
  static success(text: string): string {
    return this.green(`✅ ${text}`);
  }

  static warning(text: string): string {
    return this.yellow(`⚠️  ${text}`);
  }

  static error(text: string): string {
    return this.red(`❌ ${text}`);
  }

  static info(text: string): string {
    return this.blue(`ℹ️  ${text}`);
  }

  static debug(text: string): string {
    return this.dim(`🐛 ${text}`);
  }

  static highlight(text: string): string {
    return this.cyan(this.bold(text));
  }

  static muted(text: string): string {
    return this.dim(text);
  }

  // Progressive enhancement with fallbacks
  static progressBar(completed: number, total: number, width = 20): string {
    if (!shouldUseColors()) {
      return `[${completed}/${total}]`;
    }

    const percentage = Math.round((completed / total) * 100);
    const filled = Math.max(0, Math.min(width, Math.round((completed / total) * width)));
    const empty = Math.max(0, width - filled);

    const bar = this.green('█'.repeat(filled)) + this.dim('░'.repeat(empty));
    return `${bar} ${percentage}%`;
  }
}
