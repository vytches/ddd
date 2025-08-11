import type { IDependencyContainer } from '@vytches/ddd-di';
import type { ICommand } from '../interfaces';
import { LoggingMiddleware } from '../middleware';
import { CommandBus } from './command-bus';

export class EnhancedCommandBus extends CommandBus {
  private metrics = {
    executionCount: 0,
    totalExecutionTime: 0,
    errors: 0,
  };

  constructor(container: IDependencyContainer) {
    super(container);

    this.use(new LoggingMiddleware());
  }

  override async execute<T extends ICommand, TResult = void>(command: T): Promise<TResult> {
    const startTime = performance.now();

    try {
      const result = await super.execute<T, TResult>(command);

      // Update metrics
      this.metrics.executionCount++;
      this.metrics.totalExecutionTime += performance.now() - startTime;

      return result;
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
