/**
 * Optional metadata for policy requests
 * Provides additional context for policy evaluation
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
 * Builder for creating policy metadata
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
