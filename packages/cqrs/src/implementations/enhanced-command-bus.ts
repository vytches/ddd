import type { IDependencyContainer } from '@vytches/ddd-di';
import type { ICommand } from '../interfaces';
import { LoggingMiddleware } from '../middleware';
import { CommandBus } from './command-bus';

/**
 * @llm-summary EnhancedCommandBus class for enhanced command bus operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * EnhancedCommandBus class implementing architectural component for enhanced command bus operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EnhancedCommandBus();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new EnhancedCommandBus());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
