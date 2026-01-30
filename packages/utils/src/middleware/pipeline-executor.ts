import type { IMiddleware, MiddlewareHandler, SimpleHandler } from './middleware.interfaces';

/**
 * Executes a pipeline of middleware functions in sequence.
 *
 * This class provides a reusable abstraction for middleware pipeline execution,
 * eliminating code duplication across packages (ACL, CQRS, Events, Messaging).
 *
 * @typeParam TContext - The context type passed through the pipeline
 * @typeParam TResult - The result type returned by the pipeline
 *
 * @example
 * ```typescript
 * // With context-aware handler
 * const executor = new MiddlewarePipelineExecutor([
 *   loggingMiddleware,
 *   validationMiddleware,
 * ]);
 *
 * const result = await executor.execute(
 *   { userId: '123', action: 'create' },
 *   (ctx) => handleRequest(ctx)
 * );
 * ```
 *
 * @example
 * ```typescript
 * // With simple handler (no context needed)
 * const result = await executor.executeSimple(
 *   context,
 *   () => performOperation()
 * );
 * ```
 */
export class MiddlewarePipelineExecutor<TContext, TResult> {
  private readonly middlewares: ReadonlyArray<IMiddleware<TContext, TResult>>;

  /**
   * Creates a new middleware pipeline executor.
   *
   * @param middlewares - Array of middleware to execute in order
   */
  constructor(middlewares: IMiddleware<TContext, TResult>[]) {
    this.middlewares = [...middlewares];
  }

  /**
   * Executes the middleware pipeline with a context-aware handler.
   *
   * Middleware is executed in order, with each middleware calling `next()`
   * to proceed to the next middleware or the final handler.
   *
   * @param context - The context to pass through the pipeline
   * @param handler - The final handler that processes the request
   * @returns Promise resolving to the result
   */
  async execute(
    context: TContext,
    handler: MiddlewareHandler<TContext, TResult>
  ): Promise<TResult> {
    if (this.middlewares.length === 0) {
      return handler(context);
    }

    let index = 0;

    const next = async (): Promise<TResult> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++]!;
        return middleware.handle(context, next);
      }
      return handler(context);
    };

    return next();
  }

  /**
   * Executes the middleware pipeline with a simple handler that doesn't need context.
   *
   * Useful when the handler already has access to all needed data through closure.
   *
   * @param context - The context to pass through middleware
   * @param handler - The final handler function
   * @returns Promise resolving to the result
   */
  async executeSimple(context: TContext, handler: SimpleHandler<TResult>): Promise<TResult> {
    return this.execute(context, () => handler());
  }

  /**
   * Returns the number of middleware in the pipeline.
   */
  get length(): number {
    return this.middlewares.length;
  }

  /**
   * Checks if the pipeline has any middleware.
   */
  get isEmpty(): boolean {
    return this.middlewares.length === 0;
  }

  /**
   * Creates a new executor with additional middleware appended.
   *
   * @param middleware - Middleware to append
   * @returns New executor with combined middleware
   */
  append(
    ...middleware: IMiddleware<TContext, TResult>[]
  ): MiddlewarePipelineExecutor<TContext, TResult> {
    return new MiddlewarePipelineExecutor([...this.middlewares, ...middleware]);
  }

  /**
   * Creates a new executor with middleware prepended.
   *
   * @param middleware - Middleware to prepend
   * @returns New executor with combined middleware
   */
  prepend(
    ...middleware: IMiddleware<TContext, TResult>[]
  ): MiddlewarePipelineExecutor<TContext, TResult> {
    return new MiddlewarePipelineExecutor([...middleware, ...this.middlewares]);
  }

  /**
   * Creates an empty pipeline executor.
   *
   * @returns Empty executor
   */
  static empty<TContext, TResult>(): MiddlewarePipelineExecutor<TContext, TResult> {
    return new MiddlewarePipelineExecutor([]);
  }

  /**
   * Creates a pipeline executor from an array of middleware.
   *
   * @param middlewares - Array of middleware
   * @returns New executor
   */
  static from<TContext, TResult>(
    middlewares: IMiddleware<TContext, TResult>[]
  ): MiddlewarePipelineExecutor<TContext, TResult> {
    return new MiddlewarePipelineExecutor(middlewares);
  }
}
