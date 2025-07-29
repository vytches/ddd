/**
 * @llm-summary Contract for log context functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * LogContext interface implementing infrastructure service for log context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteLogContext implements LogContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface LogContext {
  readonly name: string;
  readonly boundedContext?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly userId?: string | undefined;
  readonly tenantId?: string | undefined;
  readonly requestId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

/**
 * @llm-summary Contract for log context builder functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * LogContextBuilder interface implementing infrastructure service for log context builder operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteLogContextBuilder implements LogContextBuilder {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface LogContextBuilder {
  withBoundedContext(context: string): LogContextBuilder;
  withCorrelationId(id: string): LogContextBuilder;
  withUserId(id: string): LogContextBuilder;
  withTenantId(id: string): LogContextBuilder;
  withRequestId(id: string): LogContextBuilder;
  withSessionId(id: string): LogContextBuilder;
  withMetadata(key: string, value: unknown): LogContextBuilder;
  withMetadata(metadata: Record<string, unknown>): LogContextBuilder;
  build(): LogContext;
}

/**
 * @llm-summary DefaultLogContextBuilder class for default log context builder operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * DefaultLogContextBuilder class implementing infrastructure service for default log context builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new DefaultLogContextBuilder();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class DefaultLogContextBuilder implements LogContextBuilder {
  private context: {
    name: string;
    boundedContext?: string;
    correlationId?: string;
    userId?: string;
    tenantId?: string;
    requestId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  };

  constructor(name: string) {
    this.context = { name };
  }

  withBoundedContext(boundedContext: string): LogContextBuilder {
    this.context = { ...this.context, boundedContext };
    return this;
  }

  withCorrelationId(correlationId: string): LogContextBuilder {
    this.context = { ...this.context, correlationId };
    return this;
  }

  withUserId(userId: string): LogContextBuilder {
    this.context = { ...this.context, userId };
    return this;
  }

  withTenantId(tenantId: string): LogContextBuilder {
    this.context = { ...this.context, tenantId };
    return this;
  }

  withRequestId(requestId: string): LogContextBuilder {
    this.context = { ...this.context, requestId };
    return this;
  }

  withSessionId(sessionId: string): LogContextBuilder {
    this.context = { ...this.context, sessionId };
    return this;
  }

  withMetadata(
    keyOrMetadata: string | Record<string, unknown>,
    value?: unknown
  ): LogContextBuilder {
    if (typeof keyOrMetadata === 'string') {
      this.context = {
        ...this.context,
        metadata: {
          ...this.context.metadata,
          [keyOrMetadata]: value,
        },
      };
    } else {
      this.context = {
        ...this.context,
        metadata: {
          ...this.context.metadata,
          ...keyOrMetadata,
        },
      };
    }
    return this;
  }

  build(): LogContext {
    return {
      name: this.context.name,
      ...(this.context.boundedContext !== undefined && {
        boundedContext: this.context.boundedContext,
      }),
      ...(this.context.correlationId !== undefined && {
        correlationId: this.context.correlationId,
      }),
      ...(this.context.userId !== undefined && { userId: this.context.userId }),
      ...(this.context.tenantId !== undefined && { tenantId: this.context.tenantId }),
      ...(this.context.requestId !== undefined && { requestId: this.context.requestId }),
      ...(this.context.sessionId !== undefined && { sessionId: this.context.sessionId }),
      ...(this.context.metadata !== undefined && { metadata: this.context.metadata }),
    };
  }
}
