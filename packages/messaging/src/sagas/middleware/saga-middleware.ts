import type { IDomainEvent } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import type {
  ISaga,
  ISagaActionResult,
  ISagaExecutionContext,
  ISagaMiddleware,
  ISagaMiddlewareContext,
} from '../interfaces';

export abstract class BaseSagaMiddleware implements ISagaMiddleware {
  protected readonly logger: ReturnType<typeof Logger.forContext>;

  constructor(protected readonly name: string) {
    this.logger = Logger.forContext(`SagaMiddleware:${name}`);
  }

  /**
   * Execute before saga step
   * @param context - Execution context
   * @param next - Next middleware in chain
   */
  async before(context: ISagaMiddlewareContext, next: () => Promise<void>): Promise<void> {
    await next();
  }

  /**
   * Execute after saga step
   * @param context - Execution context
   * @param result - Step execution result
   * @param next - Next middleware in chain
   */
  async after(
    context: ISagaMiddlewareContext,
    result: unknown,
    next: (result: unknown) => Promise<void>
  ): Promise<void> {
    await next(result);
  }

  /**
   * Handle saga step error
   * @param context - Execution context
   * @param error - Error that occurred
   * @param next - Next error handler in chain
   */
  async onError(
    context: ISagaMiddlewareContext,
    error: Error,
    next: (error: Error) => Promise<void>
  ): Promise<void> {
    await next(error);
  }

  /**
   * Get middleware name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Check if middleware should be applied to this context
   * @param context - Middleware context
   */
  shouldApply(context: ISagaMiddlewareContext): boolean {
    return true; // Default: apply to all contexts
  }
}

export class PerformanceMonitoringMiddleware extends BaseSagaMiddleware {
  private readonly performanceData: Map<string, number> = new Map();

  constructor() {
    super('PerformanceMonitoring');
  }

  override async before(context: ISagaMiddlewareContext, next: () => Promise<void>): Promise<void> {
    const startTime = performance.now();
    this.performanceData.set(context.sagaId, startTime);

    this.logger.debug('Starting saga step execution', {
      sagaId: context.sagaId,
      sagaType: context.sagaType,
      stepName: context.stepName,
      eventType: (context.event as IDomainEvent)?.eventType,
    });

    await next();
  }

  override async after(
    context: ISagaMiddlewareContext,
    result: unknown,
    next: (result: unknown) => Promise<void>
  ): Promise<void> {
    const startTime = this.performanceData.get(context.sagaId);
    if (startTime) {
      const executionTime = performance.now() - startTime;
      this.performanceData.delete(context.sagaId);

      this.logger.info('Saga step completed', {
        sagaId: context.sagaId,
        sagaType: context.sagaType,
        stepName: context.stepName,
        executionTime: Math.round(executionTime),
        success: (result as ISagaActionResult)?.success,
      });

      // Warn if execution is slow
      if (executionTime > 5000) {
        this.logger.warn('Slow saga step execution detected', {
          sagaId: context.sagaId,
          sagaType: context.sagaType,
          stepName: context.stepName,
          executionTime: Math.round(executionTime),
          threshold: 5000,
        });
      }
    }

    await next(result);
  }

  override async onError(
    context: ISagaMiddlewareContext,
    error: Error,
    next: (error: Error) => Promise<void>
  ): Promise<void> {
    const startTime = this.performanceData.get(context.sagaId);
    if (startTime) {
      const executionTime = performance.now() - startTime;
      this.performanceData.delete(context.sagaId);

      this.logger.error('Saga step execution failed', error, {
        saga_id: context.sagaId,
        saga_type: context.sagaType,
        step_name: context.stepName,
        execution_time: Math.round(executionTime),
        error_message: error.message,
      });
    }

    await next(error);
  }
}

export class RetryMiddleware extends BaseSagaMiddleware {
  private readonly retryAttempts: Map<string, number> = new Map();

  constructor(
    private readonly maxRetries = 3,
    private readonly retryDelay = 1000,
    private readonly backoffMultiplier = 2
  ) {
    super('Retry');
  }

  override async onError(
    context: ISagaMiddlewareContext,
    error: Error,
    next: (error: Error) => Promise<void>
  ): Promise<void> {
    const retryKey = `${context.sagaId}:${context.stepName}`;
    const currentAttempts = this.retryAttempts.get(retryKey) || 0;

    if (currentAttempts < this.maxRetries) {
      const nextAttempt = currentAttempts + 1;
      this.retryAttempts.set(retryKey, nextAttempt);

      const delay = this.retryDelay * Math.pow(this.backoffMultiplier, currentAttempts);

      this.logger.warn('Saga step failed, retrying', {
        sagaId: context.sagaId,
        stepName: context.stepName,
        attempt: nextAttempt,
        maxRetries: this.maxRetries,
        nextRetryIn: delay,
        error: error.message,
      });

      // Use setTimeout that works with vi.advanceTimersByTimeAsync
      await new Promise<void>(resolve => {
        setTimeout(() => {
          resolve();
        }, delay);
      });

      // Don't call next, which would propagate the error
      // Instead, let the retry mechanism handle it
      return;
    } else {
      this.retryAttempts.delete(retryKey);
      this.logger.error('Saga step failed after all retries', error, {
        saga_id: context.sagaId,
        step_name: context.stepName,
        total_attempts: this.maxRetries + 1,
        final_error: error.message,
      });
    }

    await next(error);
  }

  override async after(
    context: ISagaMiddlewareContext,
    result: unknown,
    next: (result: unknown) => Promise<void>
  ): Promise<void> {
    // Clear retry attempts on success
    const retryKey = `${context.sagaId}:${context.stepName}`;
    const attempts = this.retryAttempts.get(retryKey);

    if (attempts && attempts > 0) {
      this.logger.info('Saga step succeeded after retry', {
        sagaId: context.sagaId,
        stepName: context.stepName,
        successful_attempt: attempts + 1,
        total_attempts: this.maxRetries + 1,
      });
      this.retryAttempts.delete(retryKey);
    }

    await next(result);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      // Store timer reference for potential cleanup
      return timer;
    });
  }
}

export class CircuitBreakerMiddleware extends BaseSagaMiddleware {
  private readonly circuitStates: Map<
    string,
    {
      isOpen: boolean;
      failures: number;
      lastFailureTime: number;
      successCount: number;
    }
  > = new Map();

  constructor(
    private readonly failureThreshold = 5,
    private readonly recoveryTimeout = 60000, // 1 minute
    private readonly successThreshold = 3
  ) {
    super('CircuitBreaker');
  }

  override async before(context: ISagaMiddlewareContext, next: () => Promise<void>): Promise<void> {
    const circuitKey = `${context.sagaType}:${context.stepName}`;
    const circuitState = this.getCircuitState(circuitKey);

    // Check if circuit is open
    if (circuitState.isOpen) {
      const timeSinceLastFailure = Date.now() - circuitState.lastFailureTime;

      if (timeSinceLastFailure < this.recoveryTimeout) {
        this.logger.warn('Circuit breaker is open, rejecting saga step', {
          sagaId: context.sagaId,
          stepName: context.stepName,
          circuitKey,
          timeSinceLastFailure,
          recoveryTimeout: this.recoveryTimeout,
        });

        throw new Error(`Circuit breaker is open for ${circuitKey}`);
      } else {
        // Try to recover - move to half-open state
        circuitState.isOpen = false;
        circuitState.successCount = 0;
        this.logger.info('Circuit breaker entering half-open state', {
          sagaId: context.sagaId,
          stepName: context.stepName,
          circuitKey,
        });
      }
    }

    await next();
  }

  override async after(
    context: ISagaMiddlewareContext,
    result: unknown,
    next: (result: unknown) => Promise<void>
  ): Promise<void> {
    const circuitKey = `${context.sagaType}:${context.stepName}`;
    const circuitState = this.getCircuitState(circuitKey);

    const actionResult = result as ISagaActionResult;
    if (actionResult?.success) {
      this.recordSuccess(circuitKey, circuitState);
    } else {
      this.recordFailure(circuitKey, circuitState);
    }

    await next(result);
  }

  override async onError(
    context: ISagaMiddlewareContext,
    error: Error,
    next: (error: Error) => Promise<void>
  ): Promise<void> {
    const circuitKey = `${context.sagaType}:${context.stepName}`;
    const circuitState = this.getCircuitState(circuitKey);

    this.recordFailure(circuitKey, circuitState);
    await next(error);
  }

  private getCircuitState(circuitKey: string) {
    if (!this.circuitStates.has(circuitKey)) {
      this.circuitStates.set(circuitKey, {
        isOpen: false,
        failures: 0,
        lastFailureTime: 0,
        successCount: 0,
      });
    }
    return this.circuitStates.get(circuitKey)!;
  }

  private recordSuccess(circuitKey: string, circuitState: Record<string, unknown>): void {
    (circuitState.successCount as number)++;

    if ((circuitState.successCount as number) >= this.successThreshold) {
      circuitState.failures = 0;
      circuitState.isOpen = false;
      this.logger.info('Circuit breaker closed after successful operations', {
        circuitKey,
        successCount: circuitState.successCount,
        successThreshold: this.successThreshold,
      });
    }
  }

  private recordFailure(circuitKey: string, circuitState: Record<string, unknown>): void {
    (circuitState.failures as number)++;
    circuitState.lastFailureTime = Date.now();
    circuitState.successCount = 0;

    if ((circuitState.failures as number) >= this.failureThreshold) {
      circuitState.isOpen = true;
      this.logger.warn('Circuit breaker opened due to failures', {
        circuitKey,
        failures: circuitState.failures,
        failureThreshold: this.failureThreshold,
      });
    }
  }
}

export class SecurityMiddleware extends BaseSagaMiddleware {
  constructor(private readonly authorizer?: (context: ISagaMiddlewareContext) => Promise<boolean>) {
    super('Security');
  }

  override async before(context: ISagaMiddlewareContext, next: () => Promise<void>): Promise<void> {
    // Perform security checks
    const isAuthorized = await this.checkAuthorization(context);

    if (!isAuthorized) {
      this.logger.warn('Unauthorized saga operation attempted', {
        sagaId: context.sagaId,
        sagaType: context.sagaType,
        stepName: context.stepName,
        userId: context.executionContext.userId,
        tenantId: context.executionContext.tenantId,
      });

      throw new Error('Unauthorized operation');
    }

    await next();
  }

  private async checkAuthorization(context: ISagaMiddlewareContext): Promise<boolean> {
    if (this.authorizer) {
      return await this.authorizer(context);
    }

    // Default authorization: check if user context is present
    return !!context.executionContext.userId || !!context.executionContext.sessionId;
  }
}

export class SagaMiddlewarePipeline {
  private readonly logger: ReturnType<typeof Logger.forContext>;
  private readonly middlewares: (ISagaMiddleware & {
    getName?(): string;
    shouldApply?(context: unknown): boolean;
  })[] = [];

  constructor() {
    this.logger = Logger.forContext('SagaMiddlewarePipeline');
  }

  /**
   * Add middleware to the pipeline
   * @param middleware - Middleware to add
   */
  use(
    middleware: ISagaMiddleware & { getName?(): string; shouldApply?(context: unknown): boolean }
  ): void {
    this.middlewares.push(middleware);
    this.logger.debug('Middleware added to pipeline', {
      middlewareName: middleware.getName ? middleware.getName() : 'Unknown',
      totalMiddlewares: this.middlewares.length,
    });
  }

  /**
   * Execute the middleware pipeline for a saga operation
   * @param saga - Target saga
   * @param event - Processing event
   * @param executionContext - Execution context
   * @param stepName - Current step name
   * @param operation - Operation to execute
   */
  async execute(
    saga: ISaga,
    event: IDomainEvent,
    executionContext: ISagaExecutionContext,
    stepName: string,
    operation: () => Promise<ISagaActionResult>
  ): Promise<ISagaActionResult> {
    const middlewareContext: ISagaMiddlewareContext = {
      sagaId: saga.sagaId,
      sagaType: saga.sagaType,
      stepName,
      event,
      executionContext,
      sagaState: saga.state,
      metadata: {},
      startTime: new Date(),
    };

    // Filter applicable middlewares
    const applicableMiddlewares = this.middlewares.filter(
      middleware => !middleware.shouldApply || middleware.shouldApply(middlewareContext)
    );

    this.logger.debug('Executing middleware pipeline', {
      sagaId: saga.sagaId,
      stepName,
      totalMiddlewares: this.middlewares.length,
      applicableMiddlewares: applicableMiddlewares.length,
      middlewareNames: applicableMiddlewares.map(m => (m.getName ? m.getName() : 'Unknown')),
    });

    try {
      // Execute before middleware
      for (const middleware of applicableMiddlewares) {
        await middleware.before(middlewareContext, async () => {
          return;
        });
      }

      // Execute main operation
      const result = await operation();

      // Execute after middleware
      for (const middleware of [...applicableMiddlewares].reverse()) {
        await middleware.after(middlewareContext, result, async () => {
          return;
        });
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Execute error handling middleware
      for (const middleware of [...applicableMiddlewares].reverse()) {
        await middleware.onError(middlewareContext, err, async () => {
          return;
        });
      }

      throw err;
    }
  }

  /**
   * Get list of registered middleware names
   */
  getMiddlewareNames(): string[] {
    return this.middlewares.map(m => (m.getName ? m.getName() : 'Unknown'));
  }

  /**
   * Clear all middleware from the pipeline
   */
  clear(): void {
    this.middlewares.length = 0;
    this.logger.debug('Middleware pipeline cleared');
  }
}
