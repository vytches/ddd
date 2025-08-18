import type { PolicyContext } from '../shared';
export type PolicyViolationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export class PolicyViolation extends Error {
  /**
   * Unique error code for programmatic handling
   */
  public readonly code: string;

  /**
   * Human-readable error message
   */
  public override readonly message: string;

  /**
   * Severity level of this violation
   */
  public readonly severity: PolicyViolationSeverity;

  /**
   * Optional field name if violation is field-specific
   */
  public readonly field?: string;

  /**
   * Additional details about the violation
   */
  public readonly details: Record<string, unknown>;

  /**
   * Policy context when violation occurred
   */
  public readonly context?: PolicyContext;

  /**
   * Policy ID that generated this violation
   */
  public readonly policyId?: string;

  /**
   * Domain of the policy that generated this violation
   */
  public readonly domain?: string;

  /**
   * Timestamp when violation was created
   */
  public readonly timestamp: Date;

  constructor(options: PolicyViolationOptions) {
    super(options.message);

    this.name = 'PolicyViolation';
    this.code = options.code;
    this.message = options.message;
    this.severity = options.severity;
    this.details = options.details ?? {};
    this.timestamp = options.timestamp ?? new Date();

    if (options.field !== undefined) {
      this.field = options.field;
    }
    if (options.context !== undefined) {
      this.context = options.context;
    }
    if (options.policyId !== undefined) {
      this.policyId = options.policyId;
    }
    if (options.domain !== undefined) {
      this.domain = options.domain;
    }

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PolicyViolation);
    }
  }

  /**
   * Check if this violation is an error (blocks operation)
   */
  public isError(): boolean {
    return this.severity === 'ERROR';
  }

  /**
   * Check if this violation is a warning (logged but doesn't block)
   */
  public isWarning(): boolean {
    return this.severity === 'WARNING';
  }

  /**
   * Check if this violation is informational
   */
  public isInfo(): boolean {
    return this.severity === 'INFO';
  }

  /**
   * Get a detailed string representation
   */
  public override toString(): string {
    const parts = [`[${this.severity}]`, `${this.code}:`, this.message];

    if (this.field) {
      parts.push(`(field: ${this.field})`);
    }

    if (this.policyId) {
      parts.push(`(policy: ${this.policyId})`);
    }

    return parts.join(' ');
  }

  /**
   * Convert to plain object for serialization
   */
  public toJSON(): PolicyViolationData {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      ...(this.field && { field: this.field }),
      details: this.details,
      ...(this.policyId && { policyId: this.policyId }),
      ...(this.domain && { domain: this.domain }),
      timestamp: this.timestamp.toISOString(),
      ...(this.stack && { stack: this.stack }),
    };
  }

  /**
   * Create from plain object (for deserialization)
   */
  public static fromJSON(data: PolicyViolationData): PolicyViolation {
    return new PolicyViolation({
      code: data.code,
      message: data.message,
      severity: data.severity,
      ...(data.field && { field: data.field }),
      details: data.details || {},
      ...(data.policyId && { policyId: data.policyId }),
      ...(data.domain && { domain: data.domain }),
      timestamp: new Date(data.timestamp),
    });
  }

  /**
   * Create a new violation with ERROR severity
   */
  public static error(options: Omit<PolicyViolationOptions, 'severity'>): PolicyViolation {
    return new PolicyViolation({ ...options, severity: 'ERROR' });
  }

  /**
   * Create a new violation with WARNING severity
   */
  public static warning(options: Omit<PolicyViolationOptions, 'severity'>): PolicyViolation {
    return new PolicyViolation({ ...options, severity: 'WARNING' });
  }

  /**
   * Create a new violation with INFO severity
   */
  public static info(options: Omit<PolicyViolationOptions, 'severity'>): PolicyViolation {
    return new PolicyViolation({ ...options, severity: 'INFO' });
  }

  // Future extensibility methods (placeholders for i18n, metrics, etc.)

  /**
   * Future: Localize the message for different languages
   */
  // localize?(locale: string): string;

  /**
   * Future: Convert to metrics data for monitoring
   */
  // toMetrics?(): PolicyMetrics;

  /**
   * Future: Get user-friendly message based on context
   */
  // getUserFriendlyMessage?(context?: Record<string, unknown>): string;
}

export interface PolicyViolationOptions {
  /**
   * Unique error code for programmatic handling
   */
  readonly code: string;

  /**
   * Human-readable error message
   */
  readonly message: string;

  /**
   * Severity level of this violation
   */
  readonly severity: PolicyViolationSeverity;

  /**
   * Optional field name if violation is field-specific
   */
  readonly field?: string;

  /**
   * Additional details about the violation
   */
  readonly details?: Record<string, unknown>;

  /**
   * Policy context when violation occurred
   */
  readonly context?: PolicyContext;

  /**
   * Policy ID that generated this violation
   */
  readonly policyId?: string;

  /**
   * Domain of the policy that generated this violation
   */
  readonly domain?: string;

  /**
   * Timestamp when violation was created
   */
  readonly timestamp?: Date;
}

export interface PolicyViolationData {
  readonly name: string;
  readonly code: string;
  readonly message: string;
  readonly severity: PolicyViolationSeverity;
  readonly field?: string;
  readonly details?: Record<string, unknown>;
  readonly policyId?: string;
  readonly domain?: string;
  readonly timestamp: string;
  readonly stack?: string;
}

export class PolicyViolationCollection {
  private readonly violations: PolicyViolation[] = [];

  constructor(violations: PolicyViolation[] = []) {
    this.violations = [...violations];
  }

  /**
   * Add a violation to the collection
   */
  public add(violation: PolicyViolation): void {
    this.violations.push(violation);
  }

  /**
   * Get all violations
   */
  public getAll(): readonly PolicyViolation[] {
    return [...this.violations];
  }

  /**
   * Get violations by severity
   */
  public getBySeverity(severity: PolicyViolationSeverity): PolicyViolation[] {
    return this.violations.filter(v => v.severity === severity);
  }

  /**
   * Get error violations only
   */
  public getErrors(): PolicyViolation[] {
    return this.getBySeverity('ERROR');
  }

  /**
   * Get warning violations only
   */
  public getWarnings(): PolicyViolation[] {
    return this.getBySeverity('WARNING');
  }

  /**
   * Get info violations only
   */
  public getInfo(): PolicyViolation[] {
    return this.getBySeverity('INFO');
  }

  /**
   * Check if collection has any violations
   */
  public hasAny(): boolean {
    return this.violations.length > 0;
  }

  /**
   * Check if collection has any error violations
   */
  public hasErrors(): boolean {
    return this.getErrors().length > 0;
  }

  /**
   * Check if collection has any warning violations
   */
  public hasWarnings(): boolean {
    return this.getWarnings().length > 0;
  }

  /**
   * Get total count of violations
   */
  public count(): number {
    return this.violations.length;
  }

  /**
   * Clear all violations
   */
  public clear(): void {
    this.violations.length = 0;
  }

  /**
   * Convert to array
   */
  public toArray(): PolicyViolation[] {
    return [...this.violations];
  }

  /**
   * Create from array
   */
  public static from(violations: PolicyViolation[]): PolicyViolationCollection {
    return new PolicyViolationCollection(violations);
  }
}
