import type { PolicyRequest, PolicyContext } from '../core/interfaces/business-policy.interface';
import type { PolicyMetadata } from '../core/models/policy-metadata';
import { PolicyContextBuilder } from './policy-context-builder';

/**
 * @llm-summary PolicyRequestBuilder class for policy request builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyRequestBuilder class implementing domain pattern implementation for policy request builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyRequestBuilder();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class PolicyRequestBuilder<T> {
  private entity?: T;
  private context?: PolicyContext;
  private metadata?: PolicyMetadata;

  /**
   * Set the entity to be evaluated
   */
  public withEntity(entity: T): PolicyRequestBuilder<T> {
    this.entity = entity;
    return this;
  }

  /**
   * Set the policy context
   */
  public withContext(context: PolicyContext): PolicyRequestBuilder<T> {
    this.context = context;
    return this;
  }

  /**
   * Set the policy context using a builder
   */
  public withContextBuilder(
    builderFn: (builder: PolicyContextBuilder) => PolicyContextBuilder
  ): PolicyRequestBuilder<T> {
    this.context = builderFn(PolicyContextBuilder.create()).build();
    return this;
  }

  /**
   * Set the policy metadata
   */
  public withMetadata(metadata: PolicyMetadata): PolicyRequestBuilder<T> {
    this.metadata = metadata;
    return this;
  }

  /**
   * Add correlation ID to metadata
   */
  public withCorrelationId(correlationId: string): PolicyRequestBuilder<T> {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata = { ...this.metadata, correlationId };
    return this;
  }

  /**
   * Add source system to metadata
   */
  public withSource(source: string): PolicyRequestBuilder<T> {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata = { ...this.metadata, source };
    return this;
  }

  /**
   * Add operation to metadata
   */
  public withOperation(operation: string): PolicyRequestBuilder<T> {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata = { ...this.metadata, operation };
    return this;
  }

  /**
   * Add custom metadata property
   */
  public addMetadata(key: keyof PolicyMetadata, value: unknown): PolicyRequestBuilder<T> {
    if (!this.metadata) {
      this.metadata = {};
    }
    (this.metadata as Record<string, unknown>)[key] = value;
    return this;
  }

  /**
   * Add custom metadata to the custom object
   */
  public addCustomMetadata(key: string, value: unknown): PolicyRequestBuilder<T> {
    if (!this.metadata) {
      this.metadata = {};
    }
    if (!this.metadata.custom) {
      this.metadata = { ...this.metadata, custom: {} };
    }
    this.metadata.custom![key] = value;
    return this;
  }

  /**
   * Build the PolicyRequest
   * @throws Error if required fields are missing
   */
  public build(): PolicyRequest<T> {
    if (this.entity === undefined) {
      throw new Error('Entity is required for PolicyRequest');
    }
    if (!this.context) {
      throw new Error('Context is required for PolicyRequest');
    }

    return {
      entity: this.entity,
      context: this.context,
      ...(this.metadata && { metadata: this.metadata }),
    };
  }

  /**
   * Create a new builder instance
   */
  public static create<T>(): PolicyRequestBuilder<T> {
    return new PolicyRequestBuilder<T>();
  }

  /**
   * Create a builder with entity
   */
  public static forEntity<T>(entity: T): PolicyRequestBuilder<T> {
    return new PolicyRequestBuilder<T>().withEntity(entity);
  }

  /**
   * Create a builder with entity and context
   */
  public static forEntityAndContext<T>(entity: T, context: PolicyContext): PolicyRequestBuilder<T> {
    return new PolicyRequestBuilder<T>().withEntity(entity).withContext(context);
  }

  /**
   * Create a builder with entity and minimal context
   */
  public static forEntityAndUser<T>(entity: T, userId: string): PolicyRequestBuilder<T> {
    const context = PolicyContextBuilder.forUser(userId).build();
    return new PolicyRequestBuilder<T>().withEntity(entity).withContext(context);
  }
}

/**
 * @llm-summary PolicyRequestFactory class for policy request factory operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyRequestFactory class implementing domain pattern implementation for policy request factory operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyRequestFactory();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class PolicyRequestFactory {
  /**
   * Create a minimal request with entity and user
   */
  public static minimal<T>(entity: T, userId: string): PolicyRequest<T> {
    return PolicyRequestBuilder.forEntityAndUser(entity, userId).build();
  }

  /**
   * Create a request with entity, user, and tenant
   */
  public static withTenant<T>(entity: T, userId: string, tenantId: string): PolicyRequest<T> {
    const context = PolicyContextBuilder.forUserAndTenant(userId, tenantId).build();

    return PolicyRequestBuilder.forEntityAndContext(entity, context).build();
  }

  /**
   * Create a web request
   */
  public static webRequest<T>(options: {
    entity: T;
    userId: string;
    tenantId?: string;
    sessionId?: string;
    correlationId?: string;
    ipAddress?: string;
    userAgent?: string;
    operation?: string;
  }): PolicyRequest<T> {
    const contextBuilder = PolicyContextBuilder.forUser(options.userId);

    if (options.tenantId) {
      contextBuilder.withTenantId(options.tenantId);
    }

    if (options.sessionId) {
      contextBuilder.withSessionId(options.sessionId);
    }

    if (options.ipAddress) {
      contextBuilder.addMetadata('ipAddress', options.ipAddress);
    }

    if (options.userAgent) {
      contextBuilder.addMetadata('userAgent', options.userAgent);
    }

    const context = contextBuilder.withEnvironment('web').build();

    const requestBuilder = PolicyRequestBuilder.forEntityAndContext(
      options.entity,
      context
    ).withSource('web');

    if (options.correlationId) {
      requestBuilder.withCorrelationId(options.correlationId);
    }

    if (options.operation) {
      requestBuilder.withOperation(options.operation);
    }

    return requestBuilder.build();
  }

  /**
   * Create an API request
   */
  public static apiRequest<T>(options: {
    entity: T;
    userId: string;
    tenantId?: string;
    correlationId?: string;
    apiKey?: string;
    clientId?: string;
    operation?: string;
  }): PolicyRequest<T> {
    const contextBuilder = PolicyContextBuilder.forUser(options.userId);

    if (options.tenantId) {
      contextBuilder.withTenantId(options.tenantId);
    }

    if (options.apiKey) {
      contextBuilder.addMetadata('apiKey', options.apiKey);
    }

    if (options.clientId) {
      contextBuilder.addMetadata('clientId', options.clientId);
    }

    const context = contextBuilder.withEnvironment('api').build();

    const requestBuilder = PolicyRequestBuilder.forEntityAndContext(
      options.entity,
      context
    ).withSource('api');

    if (options.correlationId) {
      requestBuilder.withCorrelationId(options.correlationId);
    }

    if (options.operation) {
      requestBuilder.withOperation(options.operation);
    }

    return requestBuilder.build();
  }

  /**
   * Create a background job request
   */
  public static backgroundJob<T>(options: {
    entity: T;
    userId?: string;
    jobId: string;
    jobType: string;
    correlationId?: string;
  }): PolicyRequest<T> {
    const context = PolicyContextBuilder.forUser(options.userId || 'system')
      .withEnvironment('background')
      .addMetadata('jobId', options.jobId)
      .addMetadata('jobType', options.jobType)
      .build();

    const requestBuilder = PolicyRequestBuilder.forEntityAndContext(
      options.entity,
      context
    ).withSource('background-job');

    if (options.correlationId) {
      requestBuilder.withCorrelationId(options.correlationId);
    }

    return requestBuilder.build();
  }

  /**
   * Create a test request with minimal setup
   */
  public static test<T>(
    entity: T,
    overrides: Partial<{
      userId: string;
      tenantId: string;
      environment: string;
      metadata: Record<string, unknown>;
    }> = {}
  ): PolicyRequest<T> {
    const contextBuilder = PolicyContextBuilder.forUser(
      overrides.userId || 'test-user'
    ).withEnvironment(overrides.environment || 'test');

    if (overrides.tenantId) {
      contextBuilder.withTenantId(overrides.tenantId);
    }

    if (overrides.metadata) {
      Object.entries(overrides.metadata).forEach(([key, value]) => {
        contextBuilder.addMetadata(key, value);
      });
    }

    const context = contextBuilder.build();

    return PolicyRequestBuilder.forEntityAndContext(entity, context).withSource('test').build();
  }
}
