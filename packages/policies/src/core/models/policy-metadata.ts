/**
 * @llm-summary Contract for policy metadata functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyMetadata interface implementing domain pattern implementation for policy metadata operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyMetadata implements PolicyMetadata {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PolicyMetadata {
  /**
   * Correlation ID for request tracking across services
   */
  readonly correlationId?: string;

  /**
   * Source system or service making the request
   */
  readonly source?: string;

  /**
   * Operation being performed (create, update, delete, etc.)
   */
  readonly operation?: string;

  /**
   * IP address of the request origin
   */
  readonly ipAddress?: string;

  /**
   * User agent string for web requests
   */
  readonly userAgent?: string;

  /**
   * Additional custom metadata
   */
  readonly custom?: Record<string, unknown>;
}

/**
 * @llm-summary PolicyMetadataBuilder class for policy metadata builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyMetadataBuilder class implementing domain pattern implementation for policy metadata builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyMetadataBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PolicyMetadataBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PolicyMetadataBuilder {
  private correlationId?: string;
  private source?: string;
  private operation?: string;
  private ipAddress?: string;
  private userAgent?: string;
  private custom?: Record<string, unknown>;

  /**
   * Set correlation ID
   */
  public withCorrelationId(correlationId: string): PolicyMetadataBuilder {
    this.correlationId = correlationId;
    return this;
  }

  /**
   * Set source system
   */
  public withSource(source: string): PolicyMetadataBuilder {
    this.source = source;
    return this;
  }

  /**
   * Set operation
   */
  public withOperation(operation: string): PolicyMetadataBuilder {
    this.operation = operation;
    return this;
  }

  /**
   * Set IP address
   */
  public withIpAddress(ipAddress: string): PolicyMetadataBuilder {
    this.ipAddress = ipAddress;
    return this;
  }

  /**
   * Set user agent
   */
  public withUserAgent(userAgent: string): PolicyMetadataBuilder {
    this.userAgent = userAgent;
    return this;
  }

  /**
   * Set custom metadata
   */
  public withCustom(custom: Record<string, unknown>): PolicyMetadataBuilder {
    this.custom = custom;
    return this;
  }

  /**
   * Add a single custom property
   */
  public addCustom(key: string, value: unknown): PolicyMetadataBuilder {
    if (!this.custom) {
      this.custom = {};
    }
    this.custom[key] = value;
    return this;
  }

  /**
   * Build the metadata
   */
  public build(): PolicyMetadata {
    return {
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.source && { source: this.source }),
      ...(this.operation && { operation: this.operation }),
      ...(this.ipAddress && { ipAddress: this.ipAddress }),
      ...(this.userAgent && { userAgent: this.userAgent }),
      ...(this.custom && { custom: this.custom }),
    };
  }

  /**
   * Create a new builder
   */
  public static create(): PolicyMetadataBuilder {
    return new PolicyMetadataBuilder();
  }
}
