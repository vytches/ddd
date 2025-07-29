/**
 * @fileoverview Validation - Input validation utilities
 * Comprehensive validation functions for CLI inputs
 */

import { ValidationError } from '../../types';

/**
 * @llm-summary Validation class for validation operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * Validation class implementing infrastructure service for validation operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new Validation();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class Validation {
  /**
   * Validate that a string is not empty
   */
  static required(value: string, fieldName = 'Field'): void {
    if (!value || value.trim().length === 0) {
      throw new ValidationError(`${fieldName} is required`);
    }
  }

  /**
   * Validate string length
   */
  static stringLength(value: string, min?: number, max?: number, fieldName = 'Field'): void {
    const length = value.length;

    if (min !== undefined && length < min) {
      throw new ValidationError(`${fieldName} must be at least ${min} characters long`);
    }

    if (max !== undefined && length > max) {
      throw new ValidationError(`${fieldName} must not exceed ${max} characters`);
    }
  }

  /**
   * Validate that a string matches a pattern
   */
  static pattern(value: string, pattern: RegExp, message?: string, fieldName = 'Field'): void {
    if (!pattern.test(value)) {
      throw new ValidationError(message || `${fieldName} has invalid format`);
    }
  }

  /**
   * Validate component name (PascalCase, no spaces, valid identifier)
   */
  static componentName(name: string): void {
    this.required(name, 'Component name');

    // Check for valid identifier pattern (PascalCase recommended)
    const validPattern = /^[A-Z][a-zA-Z0-9]*$/;
    if (!validPattern.test(name)) {
      throw new ValidationError(
        'Component name must start with uppercase letter and contain only letters and numbers (PascalCase recommended)'
      );
    }

    // Check length
    this.stringLength(name, 2, 50, 'Component name');

    // Check for reserved words
    const reservedWords = [
      'abstract',
      'arguments',
      'await',
      'boolean',
      'break',
      'byte',
      'case',
      'catch',
      'char',
      'class',
      'const',
      'continue',
      'debugger',
      'default',
      'delete',
      'do',
      'double',
      'else',
      'enum',
      'eval',
      'export',
      'extends',
      'false',
      'final',
      'finally',
      'float',
      'for',
      'function',
      'goto',
      'if',
      'implements',
      'import',
      'in',
      'instanceof',
      'int',
      'interface',
      'let',
      'long',
      'native',
      'new',
      'null',
      'package',
      'private',
      'protected',
      'public',
      'return',
      'short',
      'static',
      'super',
      'switch',
      'synchronized',
      'this',
      'throw',
      'throws',
      'transient',
      'true',
      'try',
      'typeof',
      'var',
      'void',
      'volatile',
      'while',
      'with',
      'yield',
    ];

    if (reservedWords.includes(name.toLowerCase())) {
      throw new ValidationError(`Component name cannot be a reserved word: ${name}`);
    }
  }

  /**
   * Validate file path
   */
  static filePath(path: string): void {
    this.required(path, 'File path');

    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(path)) {
      throw new ValidationError('File path contains invalid characters');
    }

    // Check for relative path traversal
    if (path.includes('..')) {
      throw new ValidationError('File path cannot contain relative path traversal (..)');
    }
  }

  /**
   * Validate directory path
   */
  static directoryPath(path: string): void {
    this.filePath(path);

    // Additional directory-specific validations can be added here
  }

  /**
   * Validate email format
   */
  static email(email: string): void {
    this.required(email, 'Email');

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.pattern(email, emailPattern, 'Email must be in valid format', 'Email');
  }

  /**
   * Validate URL format
   */
  static url(url: string): void {
    this.required(url, 'URL');

    try {
      new URL(url);
    } catch {
      throw new ValidationError('URL must be in valid format');
    }
  }

  /**
   * Validate that value is one of allowed choices
   */
  static oneOf<T>(value: T, choices: T[], fieldName = 'Field'): void {
    if (!choices.includes(value)) {
      throw new ValidationError(`${fieldName} must be one of: ${choices.join(', ')}`);
    }
  }

  /**
   * Validate package name (npm package naming rules)
   */
  static packageName(name: string): void {
    this.required(name, 'Package name');

    // NPM package name rules
    const validPattern = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    if (!validPattern.test(name)) {
      throw new ValidationError(
        'Package name must be valid npm package name (lowercase, may contain hyphens, dots, underscores)'
      );
    }

    this.stringLength(name, 1, 214, 'Package name');

    // Check for reserved names
    const reservedNames = ['node_modules', 'favicon.ico'];
    if (reservedNames.includes(name)) {
      throw new ValidationError(`Package name cannot be a reserved name: ${name}`);
    }
  }

  /**
   * Validate version string (semantic versioning)
   */
  static version(version: string): void {
    this.required(version, 'Version');

    const semverPattern =
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    this.pattern(
      version,
      semverPattern,
      'Version must follow semantic versioning (e.g., 1.0.0)',
      'Version'
    );
  }

  /**
   * Validate port number
   */
  static port(port: number | string): void {
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port;

    if (isNaN(portNum)) {
      throw new ValidationError('Port must be a number');
    }

    if (portNum < 1 || portNum > 65535) {
      throw new ValidationError('Port must be between 1 and 65535');
    }

    // Check for commonly reserved ports
    const reservedPorts = [22, 23, 25, 53, 80, 110, 143, 443, 993, 995];
    if (reservedPorts.includes(portNum)) {
      console.warn(`Warning: Port ${portNum} is commonly reserved for system services`);
    }
  }

  /**
   * Validate JSON string
   */
  static json(jsonString: string): void {
    this.required(jsonString, 'JSON');

    try {
      JSON.parse(jsonString);
    } catch {
      throw new ValidationError('Must be valid JSON format');
    }
  }

  /**
   * Validate that all required fields are present in object
   */
  static requiredFields<T extends Record<string, any>>(
    obj: T,
    requiredFields: Array<keyof T>
  ): void {
    const missing = requiredFields.filter(
      field => obj[field] === undefined || obj[field] === null || obj[field] === ''
    );

    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Combine multiple validators
   */
  static combine(value: any, validators: Array<(value: any) => void>): void {
    for (const validator of validators) {
      validator(value);
    }
  }

  /**
   * Async validation wrapper
   */
  static async async<T>(value: T, validator: (value: T) => Promise<void>): Promise<void> {
    try {
      await validator(value);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Validation failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Create a validator function with custom message
   */
  static custom<T>(predicate: (value: T) => boolean, message: string): (value: T) => void {
    return (value: T) => {
      if (!predicate(value)) {
        throw new ValidationError(message);
      }
    };
  }

  /**
   * Safe validation that returns result instead of throwing
   */
  static safe<T>(
    value: T,
    validator: (value: T) => void
  ): {
    isValid: boolean;
    error?: string;
  } {
    try {
      validator(value);
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
