/* eslint-disable no-useless-escape */

/**
 * @llm-summary Contract for context detection result functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ContextDetectionResult interface implementing infrastructure service for context detection result operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteContextDetectionResult implements ContextDetectionResult {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ContextDetectionResult {
  contextName: string;
  boundedContext?: string | undefined;
  fileName?: string | undefined;
  className?: string | undefined;
  methodName?: string | undefined;
}

interface StackTraceFrame {
  className?: string | undefined;
  methodName?: string | undefined;
  fileName?: string | undefined;
  filePath?: string | undefined;
}

/**
 * @llm-summary ContextDetector class for context detector operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * ContextDetector class implementing infrastructure service for context detector operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ContextDetector();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ContextDetector {
  private static readonly BOUNDED_CONTEXT_PATTERNS = [
    /packages\/([^\/]+)\/src/,
    /src\/([^\/]+)\//,
    /([A-Z][a-z]+(?:[A-Z][a-z]+)*?)(?:Service|Handler|Repository|Controller)/,
  ];

  private static readonly CLASS_PATTERNS = [
    /class\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
    /export\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
  ];

  static detectContext(skipFrames = 3): ContextDetectionResult {
    try {
      const stack = this.captureStackTrace();
      if (!stack) {
        return { contextName: 'Unknown' };
      }

      const frame = this.parseStackFrame(stack, skipFrames);

      if (!frame) {
        return {
          contextName: 'Unknown',
          boundedContext: undefined,
          fileName: undefined,
          className: undefined,
          methodName: undefined,
        };
      }

      const contextName = this.extractContextName(frame);
      const boundedContext = this.extractBoundedContext(frame);

      return {
        contextName,
        boundedContext,
        fileName: frame.fileName,
        className: frame.className,
        methodName: frame.methodName,
      };
    } catch (error) {
      // If anything fails, return Unknown
      return {
        contextName: 'Unknown',
        boundedContext: undefined,
        fileName: undefined,
        className: undefined,
        methodName: undefined,
      };
    }
  }

  private static captureStackTrace(): string {
    const originalPrepareStackTrace = Error.prepareStackTrace;
    const originalStackTraceLimit = Error.stackTraceLimit;

    try {
      Error.stackTraceLimit = 10;
      Error.prepareStackTrace = (_, stack) => stack;

      const err = new Error();
      const stack = err.stack;

      // Handle both string stack traces and CallSite arrays
      if (typeof stack === 'string') {
        return stack;
      }

      if (Array.isArray(stack)) {
        return (stack as NodeJS.CallSite[])
          .map((frame: NodeJS.CallSite) => `    at ${frame.toString()}`)
          .join('\n');
      }

      // Fallback if stack is neither string nor array
      return err.stack || '';
    } catch (error) {
      // If stack trace capture fails, return empty string
      return '';
    } finally {
      Error.prepareStackTrace = originalPrepareStackTrace;
      Error.stackTraceLimit = originalStackTraceLimit;
    }
  }

  private static parseStackFrame(stack: string, skipFrames: number): StackTraceFrame | null {
    if (!stack || stack.trim() === '') {
      return null;
    }

    const lines = stack.split('\n').slice(skipFrames);

    for (const line of lines) {
      const match = line.match(/at\s+(?:([^.]+)\.)?([^.\s]+)\s+\((.+):(\d+):(\d+)\)/);
      if (match) {
        const [, className, methodName, filePath] = match;

        // Skip if this is from vitest or test files
        if (
          filePath &&
          (filePath.includes('vitest') ||
            filePath.includes('.test.') ||
            filePath.includes('.spec.'))
        ) {
          continue;
        }

        return {
          className: className || (filePath ? this.extractClassNameFromFile(filePath) : undefined),
          methodName,
          fileName: filePath ? this.extractFileName(filePath) : undefined,
          filePath,
        };
      }
    }

    return null;
  }

  private static extractContextName(frame: StackTraceFrame): string {
    if (frame.className) {
      return frame.className;
    }

    if (frame.fileName) {
      const fileName = frame.fileName.replace(/\.(ts|js)$/, '');
      return this.toPascalCase(fileName);
    }

    return 'Unknown';
  }

  private static extractBoundedContext(frame: StackTraceFrame): string | undefined {
    if (!frame.filePath) return undefined;

    const filePath = frame.filePath;
    for (const pattern of this.BOUNDED_CONTEXT_PATTERNS) {
      const match = filePath.match(pattern);
      if (match && match[1]) {
        return this.toPascalCase(match[1]);
      }
    }

    return undefined;
  }

  private static extractClassNameFromFile(filePath: string): string | undefined {
    // Skip file reading in browser/ESM environments for safety
    // This would require dynamic import of fs which is complex in ESM
    return undefined;
  }

  private static extractFileName(filePath: string): string {
    return (
      filePath
        .split('/')
        .pop()
        ?.replace(/\.(ts|js)$/, '') || 'unknown'
    );
  }

  private static toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}
