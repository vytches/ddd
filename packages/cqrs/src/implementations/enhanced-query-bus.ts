import type { IQuery, IQueryHandler } from '../interfaces';
import { LoggingMiddleware } from '../middleware';
import { QueryBus } from './query-bus';

type HandlerResolver = (handlerClass: unknown) => IQueryHandler<IQuery<unknown>, unknown>;

export class EnhancedQueryBus extends QueryBus {
  private metrics = {
    executionCount: 0,
    totalExecutionTime: 0,
    errors: 0,
  };

  constructor(handlerResolver?: HandlerResolver) {
    super(handlerResolver);

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
