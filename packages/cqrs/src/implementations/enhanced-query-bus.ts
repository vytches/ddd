import type { IDependencyContainer } from '@vytches/ddd-di';
import type { IQuery } from '../interfaces';
import { LoggingMiddleware } from '../middleware';
import { QueryBus } from './query-bus';

/**
 * @llm-summary EnhancedQueryBus class for enhanced query bus operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * EnhancedQueryBus class implementing architectural component for enhanced query bus operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EnhancedQueryBus();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new EnhancedQueryBus());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class EnhancedQueryBus extends QueryBus {
  private metrics = {
    executionCount: 0,
    totalExecutionTime: 0,
    errors: 0,
  };

  constructor(container: IDependencyContainer) {
    super(container);

    this.use(new LoggingMiddleware());
  }

  override async execute<T extends IQuery<R>, R>(query: T): Promise<R> {
    const startTime = performance.now();

    try {
      const result = await super.execute(query);

      this.metrics.executionCount++;
      this.metrics.totalExecutionTime += performance.now() - startTime;

      return result as R;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      averageExecutionTime:
        this.metrics.executionCount > 0
          ? this.metrics.totalExecutionTime / this.metrics.executionCount
          : 0,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      executionCount: 0,
      totalExecutionTime: 0,
      errors: 0,
    };
  }
}
