/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PolicyContext, PolicyMetadata, PolicyRequest } from './business-policy-interface';

/**
 * Policy context builder for creating contexts fluently
 * Enforces required fields and provides convenient factory methods
 */
export class PolicyContextBuilder {
  private context: Partial<PolicyContext> = {};

  /**
   * Set the user ID (required field)
   */
  withUserId(userId: string): PolicyContextBuilder {
    this.context.userId = userId;
    return this;
  }

  /**
   * Set the timestamp (defaults to current time if not provided)
   */
  withTimestamp(timestamp?: Date): PolicyContextBuilder {
    this.context.timestamp = timestamp || new Date();
    return this;
  }

  /**
   * Set the environment (required field)
   */
  withEnvironment(environment: string): PolicyContextBuilder {
    this.context.environment = environment;
    return this;
  }

  /**
   * Set the session ID
   */
  withSessionId(sessionId: string): PolicyContextBuilder {
    this.context.sessionId = sessionId;
    return this;
  }

  /**
   * Set the tenant ID
   */
  withTenantId(tenantId: string): PolicyContextBuilder {
    this.context.tenantId = tenantId;
    return this;
  }

  /**
   * Set feature flags
   */
  withFeatures(features: Record<string, boolean>): PolicyContextBuilder {
    this.context.features = { ...this.context.features, ...features };
    return this;
  }

  /**
   * Add a single feature flag
   */
  withFeature(name: string, enabled: boolean): PolicyContextBuilder {
    if (!this.context.features) {
      this.context.features = {};
    }
    this.context.features[name] = enabled;
    return this;
  }

  /**
   * Add context metadata
   */
  withMetadata(metadata: Record<string, unknown>): PolicyContextBuilder {
    this.context.metadata = { ...this.context.metadata, ...metadata };
    return this;
  }

  /**
   * Add a single metadata entry
   */
  withMetadataEntry(key: string, value: unknown): PolicyContextBuilder {
    if (!this.context.metadata) {
      this.context.metadata = {};
    }
    this.context.metadata[key] = value;
    return this;
  }

  /**
   * Build the policy context
   * Validates that all required fields are present
   */
  build(): PolicyContext {
    if (!this.context.userId) {
      throw new Error('PolicyContext requires userId. Use .withUserId()');
    }
    if (!this.context.environment) {
      throw new Error('PolicyContext requires environment. Use .withEnvironment()');
    }

    const result: PolicyContext = {
      userId: this.context.userId,
      environment: this.context.environment,
      timestamp: this.context.timestamp || new Date(),
      features: this.context.features || {},
      metadata: this.context.metadata || {},
    };

    if (this.context.tenantId !== undefined) {
      result.tenantId = this.context.tenantId;
    }
    if (this.context.sessionId !== undefined) {
      result.sessionId = this.context.sessionId;
    }

    return result;
  }

  /**
   * Create a new builder
   */
  static create(): PolicyContextBuilder {
    return new PolicyContextBuilder();
  }

  /**
   * Create a context with minimal required fields
   */
  static createDefault(userId: string, environment = 'development'): PolicyContext {
    return PolicyContextBuilder.create()
      .withUserId(userId)
      .withEnvironment(environment)
      .withTimestamp()
      .build();
  }

  /**
   * Create a context for a specific user with environment detection
   */
  static forUser(userId: string, environment?: string): PolicyContext {
    const env = environment || process.env.NODE_ENV || 'development';
    return PolicyContextBuilder.create()
      .withUserId(userId)
      .withEnvironment(env)
      .withTimestamp()
      .build();
  }

  /**
   * Create a context for a specific tenant and user
   */
  static forTenantUser(tenantId: string, userId: string, environment?: string): PolicyContext {
    const env = environment || process.env.NODE_ENV || 'development';
    return PolicyContextBuilder.create()
      .withTenantId(tenantId)
      .withUserId(userId)
      .withEnvironment(env)
      .withTimestamp()
      .build();
  }

  /**
   * Create a production context with enhanced security
   */
  static forProduction(userId: string, sessionId: string, tenantId?: string): PolicyContext {
    const builder = PolicyContextBuilder.create()
      .withUserId(userId)
      .withEnvironment('production')
      .withSessionId(sessionId)
      .withTimestamp();

    if (tenantId) {
      builder.withTenantId(tenantId);
    }

    return builder.build();
  }
}

/**
 * Policy request builder for creating request objects fluently
 * Combines entity and context into a type-safe request
 */
export class PolicyRequestBuilder<T> {
  private entity?: T;
  private context?: PolicyContext;
  private metadata?: PolicyMetadata;

  /**
   * Set the entity to validate
   */
  withEntity(entity: T): PolicyRequestBuilder<T> {
    this.entity = entity;
    return this;
  }

  /**
   * Set the policy context
   */
  withContext(context: PolicyContext): PolicyRequestBuilder<T> {
    this.context = context;
    return this;
  }

  /**
   * Build context fluently
   */
  withContextBuilder(
    builder: (ctx: PolicyContextBuilder) => PolicyContextBuilder
  ): PolicyRequestBuilder<T> {
    this.context = builder(PolicyContextBuilder.create()).build();
    return this;
  }

  /**
   * Set request metadata
   */
  withMetadata(metadata: PolicyMetadata): PolicyRequestBuilder<T> {
    this.metadata = metadata;
    return this;
  }

  /**
   * Add source information to metadata
   */
  withSource(source: string): PolicyRequestBuilder<T> {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.source = source;
    return this;
  }

  /**
   * Add correlation ID for distributed tracing
   */
  withCorrelationId(correlationId: string): PolicyRequestBuilder<T> {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.correlationId = correlationId;
    return this;
  }

  /**
   * Build the policy request
   * Validates that all required fields are present
   */
  build(): PolicyRequest<T> {
    if (!this.entity) {
      throw new Error('PolicyRequest requires entity. Use .withEntity()');
    }
    if (!this.context) {
      throw new Error(
        'PolicyRequest requires context. Use .withContext() or .withContextBuilder()'
      );
    }

    const result: PolicyRequest<T> = {
      entity: this.entity,
      context: this.context,
    };

    if (this.metadata !== undefined) {
      result.metadata = this.metadata;
    }

    return result;
  }

  /**
   * Create a new request builder
   */
  static create<T>(): PolicyRequestBuilder<T> {
    return new PolicyRequestBuilder<T>();
  }

  /**
   * Create a simple request with minimal context
   */
  static simple<T>(entity: T, userId: string, environment?: string): PolicyRequest<T> {
    return PolicyRequestBuilder.create<T>()
      .withEntity(entity)
      .withContext(PolicyContextBuilder.forUser(userId, environment))
      .build();
  }

  /**
   * Create a production request with full context
   */
  static production<T>(
    entity: T,
    userId: string,
    sessionId: string,
    tenantId?: string
  ): PolicyRequest<T> {
    return PolicyRequestBuilder.create<T>()
      .withEntity(entity)
      .withContext(PolicyContextBuilder.forProduction(userId, sessionId, tenantId))
      .build();
  }
}
