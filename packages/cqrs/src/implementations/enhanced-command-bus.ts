import type { ICommand, ICommandHandler } from '../interfaces';
import { LoggingMiddleware } from '../middleware';
import { CommandBus } from './command-bus';

type HandlerResolver = (handlerClass: unknown) => ICommandHandler<ICommand>;

export class EnhancedCommandBus extends CommandBus {
  private metrics = {
    executionCount: 0,
    totalExecutionTime: 0,
    errors: 0,
  };

  constructor(handlerResolver?: HandlerResolver) {
    super(handlerResolver);

    this.use(new LoggingMiddleware());
  }

  override async execute<T extends ICommand>(command: T): Promise<void> {
    const startTime = performance.now();

    try {
      await super.execute(command);

      // Update metrics
      this.metrics.executionCount++;
      this.metrics.totalExecutionTime += performance.now() - startTime;
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
