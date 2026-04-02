import type { ResilienceContext } from '../core/resilience-context';

export interface BulkheadConfig {
  readonly maxConcurrency: number;
  readonly queueCapacity: number;
  readonly timeout?: number;
  readonly name?: string;
}

export interface BulkheadMetrics {
  readonly activeTasks: number;
  readonly queuedTasks: number;
  readonly totalCompleted: number;
  readonly totalRejected: number;
  readonly avgExecutionTime: number;
}

export class BulkheadRejectedException extends Error {
  constructor(bulkheadName: string, reason: 'QUEUE_FULL' | 'MAX_CONCURRENCY') {
    super(`Bulkhead '${bulkheadName}' rejected request: ${reason}`);
    this.name = 'BulkheadRejectedException';
  }
}

interface QueuedTask<T = unknown> {
  operation: (context: ResilienceContext) => Promise<T>;
  context: ResilienceContext;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  startTime: number;
}

export class Bulkhead {
  private activeTasks = 0;
  private queue: QueuedTask[] = [];
  private totalCompleted = 0;
  private totalRejected = 0;
  private totalExecutionTime = 0;

  constructor(private readonly config: BulkheadConfig) {}

  async execute<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    if (this.activeTasks < this.config.maxConcurrency) {
      return this.executeImmediately(operation, context);
    }

    if (this.queue.length >= this.config.queueCapacity) {
      this.totalRejected++;
      throw new BulkheadRejectedException(this.config.name ?? 'unnamed', 'QUEUE_FULL');
    }

    return this.enqueue(operation, context);
  }

  private async executeImmediately<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    this.activeTasks++;
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(operation, context);
      this.onTaskCompleted(startTime);
      return result;
    } catch (error) {
      this.onTaskCompleted(startTime);
      throw error;
    } finally {
      this.activeTasks--;
      this.processQueue();
    }
  }

  private async executeWithTimeout<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    if (!this.config.timeout) {
      return operation(context);
    }

    const timeoutContext = context.withTimeout(this.config.timeout);

    return Promise.race([
      operation(timeoutContext),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Bulkhead operation timed out after ${this.config.timeout}ms`));
        }, this.config.timeout);
      }),
    ]);
  }

  private enqueue<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask = {
        operation: operation as (context: ResilienceContext) => Promise<unknown>,
        context,
        resolve: resolve as (value: unknown) => void,
        reject,
        startTime: Date.now(),
      };

      this.queue.push(task);

      context.signal.addEventListener('abort', () => {
        const index = this.queue.indexOf(task);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(context.signal.reason);
        }
      }, { once: true });
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.activeTasks >= this.config.maxConcurrency) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeTasks++;

    this.executeWithTimeout(task.operation, task.context)
      .then(result => {
        task.resolve(result);
        this.onTaskCompleted(task.startTime);
      })
      .catch(error => {
        task.reject(error);
        this.onTaskCompleted(task.startTime);
      })
      .finally(() => {
        this.activeTasks--;
        this.processQueue();
      });
  }

  private onTaskCompleted(startTime: number): void {
    this.totalCompleted++;
    const executionTime = Date.now() - startTime;
    this.totalExecutionTime += executionTime;
  }

  getMetrics(): BulkheadMetrics {
    return {
      activeTasks: this.activeTasks,
      queuedTasks: this.queue.length,
      totalCompleted: this.totalCompleted,
      totalRejected: this.totalRejected,
      avgExecutionTime: this.totalCompleted > 0 ? this.totalExecutionTime / this.totalCompleted : 0,
    };
  }

  getName(): string {
    return this.config.name ?? 'unnamed';
  }
}
