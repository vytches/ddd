/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PolicyContext } from './business-policy-interface';

/**
 * Severity levels for policy violations
 * Enables different handling strategies based on violation impact
 */
export type PolicyViolationSeverity = 'ERROR' | 'WARNING' | 'INFO';

/**
 * Represents a business policy violation with rich context and metadata
 * Provides comprehensive information for error handling, logging, and user feedback
 */
export class PolicyViolation {
  constructor(
    /** Unique error code for programmatic handling */
    public readonly code: string,
    /** Human-readable error message */
    public readonly message: string,
    /** Severity level affecting how violation is handled */
    public readonly severity: PolicyViolationSeverity = 'ERROR',
    /** Specific field that caused the violation (if applicable) */
    public readonly field?: string,
    /** Additional details about the violation */
    public readonly details?: Record<string, any>,
    /** Context in which the violation occurred */
    public readonly context?: PolicyContext
  ) {}

  /**
   * String representation of the violation
   * Format: [SEVERITY] CODE: message
   */
  toString(): string {
    const severityPrefix = this.severity !== 'ERROR' ? `[${this.severity}] ` : '';
    return `${severityPrefix}${this.code}: ${this.message}`;
  }

  /**
   * Convert violation to JSON for serialization
   * Useful for API responses and logging
   */
  toJSON(): PolicyViolationJSON {
    const json: PolicyViolationJSON = {
      code: this.code,
      message: this.message,
      severity: this.severity,
    };

    if (this.field !== undefined) {
      json.field = this.field;
    }
    if (this.details !== undefined) {
      json.details = this.details;
    }
    if (this.context?.timestamp) {
      json.timestamp = this.context.timestamp.toISOString();
    }
    if (this.context?.userId) {
      json.userId = this.context.userId;
    }
    if (this.context?.sessionId) {
      json.sessionId = this.context.sessionId;
    }

    return json;
  }

  /**
   * Create a violation with ERROR severity (default)
   */
  static error(
    code: string,
    message: string,
    field?: string,
    details?: Record<string, any>,
    context?: PolicyContext
  ): PolicyViolation {
    return new PolicyViolation(code, message, 'ERROR', field, details, context);
  }

  /**
   * Create a violation with WARNING severity
   * Warnings don't prevent operation but should be logged/monitored
   */
  static warning(
    code: string,
    message: string,
    field?: string,
    details?: Record<string, any>,
    context?: PolicyContext
  ): PolicyViolation {
    return new PolicyViolation(code, message, 'WARNING', field, details, context);
  }

  /**
   * Create a violation with INFO severity
   * Informational violations for audit trail and analytics
   */
  static info(
    code: string,
    message: string,
    field?: string,
    details?: Record<string, any>,
    context?: PolicyContext
  ): PolicyViolation {
    return new PolicyViolation(code, message, 'INFO', field, details, context);
  }

  /**
   * Check if this is an error-level violation
   */
  isError(): boolean {
    return this.severity === 'ERROR';
  }

  /**
   * Check if this is a warning-level violation
   */
  isWarning(): boolean {
    return this.severity === 'WARNING';
  }

  /**
   * Check if this is an info-level violation
   */
  isInfo(): boolean {
    return this.severity === 'INFO';
  }

  /**
   * Create a new violation with additional context
   * Useful for adding context during policy composition
   */
  withContext(context: PolicyContext): PolicyViolation {
    return new PolicyViolation(
      this.code,
      this.message,
      this.severity,
      this.field,
      this.details,
      context
    );
  }

  /**
   * Create a new violation with additional details
   * Useful for enriching violations during processing
   */
  withDetails(additionalDetails: Record<string, any>): PolicyViolation {
    return new PolicyViolation(
      this.code,
      this.message,
      this.severity,
      this.field,
      { ...this.details, ...additionalDetails },
      this.context
    );
  }

  /**
   * Create a new violation with a specific field
   * Useful for field-level validation errors
   */
  withField(field: string): PolicyViolation {
    return new PolicyViolation(
      this.code,
      this.message,
      this.severity,
      field,
      this.details,
      this.context
    );
  }
}

/**
 * JSON representation of a policy violation
 * Used for serialization and API responses
 */
export interface PolicyViolationJSON {
  code: string;
  message: string;
  severity: PolicyViolationSeverity;
  field?: string;
  details?: Record<string, any>;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Collection of policy violations with utility methods
 * Useful for handling multiple violations from composite policies
 */
export class PolicyViolationCollection {
  constructor(private readonly violations: PolicyViolation[] = []) {}

  /**
   * Add a violation to the collection
   */
  add(violation: PolicyViolation): void {
    this.violations.push(violation);
  }

  /**
   * Get all violations
   */
  getAll(): readonly PolicyViolation[] {
    return this.violations;
  }

  /**
   * Get only error-level violations
   */
  getErrors(): PolicyViolation[] {
    return this.violations.filter(v => v.isError());
  }

  /**
   * Get only warning-level violations
   */
  getWarnings(): PolicyViolation[] {
    return this.violations.filter(v => v.isWarning());
  }

  /**
   * Get only info-level violations
   */
  getInfo(): PolicyViolation[] {
    return this.violations.filter(v => v.isInfo());
  }

  /**
   * Check if collection has any error-level violations
   */
  hasErrors(): boolean {
    return this.violations.some(v => v.isError());
  }

  /**
   * Check if collection has any violations
   */
  hasViolations(): boolean {
    return this.violations.length > 0;
  }

  /**
   * Get total number of violations
   */
  count(): number {
    return this.violations.length;
  }

  /**
   * Convert all violations to JSON array
   */
  toJSON(): PolicyViolationJSON[] {
    return this.violations.map(v => v.toJSON());
  }

  /**
   * Create a combined violation message
   */
  toString(): string {
    return this.violations.map(v => v.toString()).join('; ');
  }
}
