/**
 * Generic middleware interface for pipeline execution.
 *
 * @typeParam TContext - The context type passed through the pipeline
 * @typeParam TResult - The result type returned by the pipeline
 *
 * @example
 * ```typescript
 * class LoggingMiddleware implements IMiddleware<RequestContext, Response> {
 *   async handle(context: RequestContext, next: () => Promise<Response>): Promise<Response> {
 *     console.log('Before:', context);
 *     const result = await next();
 *     console.log('After:', result);
 *     return result;
 *   }
 * }
 * ```
 */
export interface IMiddleware<TContext, TResult> {
  /**
   * Handles the middleware logic and calls the next middleware in the pipeline.
   *
   * @param context - The context object containing request data
   * @param next - Function to call the next middleware or final handler
   * @returns Promise resolving to the result
   */
  handle(context: TContext, next: () => Promise<TResult>): Promise<TResult>;
}

/**
 * Type for the final handler function in a middleware pipeline.
 *
 * @typeParam TContext - The context type
 * @typeParam TResult - The result type
 */
export type MiddlewareHandler<TContext, TResult> = (context: TContext) => Promise<TResult>;

/**
 * Type for a simple handler that doesn't need context.
 *
 * @typeParam TResult - The result type
 */
export type SimpleHandler<TResult> = () => Promise<TResult>;
