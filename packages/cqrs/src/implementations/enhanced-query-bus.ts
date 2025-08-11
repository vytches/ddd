import type { IDependencyContainer } from '@vytches/ddd-di';
import type { IQuery } from '../interfaces';
import { LoggingMiddleware } from '../middleware';
import { QueryBus } from './query-bus';

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
