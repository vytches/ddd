import type { PolicyContext } from '../core/interfaces/business-policy.interface';

/**
 * @llm-summary PolicyContextBuilder class for policy context builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyContextBuilder class implementing domain pattern implementation for policy context builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyContextBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PolicyContextBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PolicyContextBuilder {
  private userId?: string;
  private tenantId?: string;
  private sessionId?: string;
  private timestamp?: Date;
  private environment?: string;
  private features?: Record<string, boolean>;
  private metadata?: Record<string, unknown>;

  /**
   * Set the user ID (required)
   */
  public withUserId(userId: string): PolicyContextBuilder {
    this.userId = userId;
    return this;
  }

  /**
   * Set the tenant ID (optional, for multi-tenant applications)
   */
  public withTenantId(tenantId: string): PolicyContextBuilder {
    this.tenantId = tenantId;
    return this;
  }

  /**
   * Set the session ID (optional, for request correlation)
   */
  public withSessionId(sessionId: string): PolicyContextBuilder {
    this.sessionId = sessionId;
    return this;
  }

  /**
   * Set the timestamp (optional, defaults to current time)
   */
  public withTimestamp(timestamp: Date): PolicyContextBuilder {
    this.timestamp = timestamp;
    return this;
  }

  /**
   * Set the environment (optional, defaults to 'unknown')
   */
  public withEnvironment(environment: string): PolicyContextBuilder {
    this.environment = environment;
    return this;
  }

  /**
   * Set all feature flags at once
   */
  public withFeatures(features: Record<string, boolean>): PolicyContextBuilder {
    this.features = { ...features };
    return this;
  }

  /**
   * Add a single feature flag
   */
  public withFeature(name: string, enabled: boolean): PolicyContextBuilder {
    if (!this.features) {
      this.features = {};
    }
    this.features[name] = enabled;
    return this;
  }

  /**
   * Enable a feature flag (shorthand for withFeature(name, true))
   */
  public enableFeature(name: string): PolicyContextBuilder {
    return this.withFeature(name, true);
  }

  /**
   * Disable a feature flag (shorthand for withFeature(name, false))
   */
  public disableFeature(name: string): PolicyContextBuilder {
    return this.withFeature(name, false);
  }

  /**
   * Set all metadata at once
   */
  public withMetadata(metadata: Record<string, unknown>): PolicyContextBuilder {
    this.metadata = { ...metadata };
    return this;
  }

  /**
   * Add a single metadata property
   */
  public addMetadata(key: string, value: unknown): PolicyContextBuilder {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata[key] = value;
    return this;
  }

  /**
   * Build the PolicyContext
   * @throws Error if required fields are missing
   */
  public build(): PolicyContext {
    if (!this.userId) {
      throw new Error('User ID is required for PolicyContext');
    }

    return {
      userId: this.userId,
      ...(this.tenantId && { tenantId: this.tenantId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      timestamp: this.timestamp || new Date(),
      environment: this.environment || 'unknown',
      features: this.features || {},
      metadata: this.metadata || {},
    };
  }

  /**
   * Create a new builder instance
   */
  public static create(): PolicyContextBuilder {
    return new PolicyContextBuilder();
  }

  /**
   * Create a context for a specific user
   */
  public static forUser(userId: string): PolicyContextBuilder {
    return new PolicyContextBuilder().withUserId(userId);
  }

  /**
   * Create a context for a specific user and tenant
   */
  public static forUserAndTenant(userId: string, tenantId: string): PolicyContextBuilder {
    return new PolicyContextBuilder().withUserId(userId).withTenantId(tenantId);
  }

  /**
   * Create a development context with common defaults
   */
  public static development(userId = 'dev-user'): PolicyContextBuilder {
    return new PolicyContextBuilder()
      .withUserId(userId)
      .withEnvironment('development')
      .enableFeature('debug-mode')
      .enableFeature('verbose-logging');
  }

  /**
   * Create a production context with common defaults
   */
  public static production(userId: string): PolicyContextBuilder {
    return new PolicyContextBuilder()
      .withUserId(userId)
      .withEnvironment('production')
      .disableFeature('debug-mode')
      .disableFeature('verbose-logging');
  }

  /**
   * Create a test context with common defaults
   */
  public static test(userId = 'test-user'): PolicyContextBuilder {
    return new PolicyContextBuilder()
      .withUserId(userId)
      .withEnvironment('test')
      .enableFeature('test-mode')
      .enableFeature('mock-external-services');
  }

  /**
   * Create from an existing context (for modification)
   */
  public static from(context: PolicyContext): PolicyContextBuilder {
    const builder = new PolicyContextBuilder();
    builder.userId = context.userId;
    if (context.tenantId) builder.tenantId = context.tenantId;
    if (context.sessionId) builder.sessionId = context.sessionId;
    builder.timestamp = context.timestamp;
    builder.environment = context.environment;
    builder.features = { ...context.features };
    builder.metadata = { ...context.metadata };
    return builder;
  }
}

/**
 * @llm-summary PolicyContextFactory class for policy context factory operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyContextFactory class implementing domain pattern implementation for policy context factory operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyContextFactory();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PolicyContextFactory());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PolicyContextFactory {
  /**
   * Create a minimal context with just user ID
   */
  public static minimal(userId: string): PolicyContext {
    return PolicyContextBuilder.forUser(userId).build();
  }

  /**
   * Create a context with user and tenant
   */
  public static withTenant(userId: string, tenantId: string): PolicyContext {
    return PolicyContextBuilder.forUserAndTenant(userId, tenantId).build();
  }

  /**
   * Create a web request context
   */
  public static webRequest(options: {
    userId: string;
    tenantId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): PolicyContext {
    const builder = PolicyContextBuilder.forUser(options.userId);

    if (options.tenantId) {
      builder.withTenantId(options.tenantId);
    }

    if (options.sessionId) {
      builder.withSessionId(options.sessionId);
    }

    if (options.ipAddress) {
      builder.addMetadata('ipAddress', options.ipAddress);
    }

    if (options.userAgent) {
      builder.addMetadata('userAgent', options.userAgent);
    }

    return builder.withEnvironment('web').build();
  }

  /**
   * Create an API request context
   */
  public static apiRequest(options: {
    userId: string;
    tenantId?: string;
    apiKey?: string;
    clientId?: string;
  }): PolicyContext {
    const builder = PolicyContextBuilder.forUser(options.userId);

    if (options.tenantId) {
      builder.withTenantId(options.tenantId);
    }

    if (options.apiKey) {
      builder.addMetadata('apiKey', options.apiKey);
    }

    if (options.clientId) {
      builder.addMetadata('clientId', options.clientId);
    }

    return builder.withEnvironment('api').build();
  }

  /**
   * Create a background job context
   */
  public static backgroundJob(options: {
    userId?: string;
    jobId: string;
    jobType: string;
  }): PolicyContext {
    return PolicyContextBuilder.forUser(options.userId || 'system')
      .withEnvironment('background')
      .addMetadata('jobId', options.jobId)
      .addMetadata('jobType', options.jobType)
      .build();
  }
}
