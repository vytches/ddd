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
  /**
   * Removes this task's abort listener from its context signal. Set by
   * `enqueue()`; called once the task leaves the queue, whatever its outcome.
   * Absent on tasks that never went through the queue.
   */
  releaseAbortListener?: () => void;
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

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return Promise.race([
      operation(timeoutContext).finally(() => {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
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

      // UX-C6: `{ once: true }` alone removes the listener only if the signal
      // actually aborts. A task that leaves the queue normally — the common
      // case — used to strand one listener per call on a caller-supplied
      // context, which is typically reused across many bulkhead calls. The
      // task's settle path now removes it explicitly.
      const onAbort = (): void => {
        const index = this.queue.indexOf(task);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(context.signal.reason);
        }
      };

      task.releaseAbortListener = () => {
        context.signal.removeEventListener('abort', onAbort);
      };

      context.signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.activeTasks >= this.config.maxConcurrency) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    // The task has left the queue, so its abort listener can no longer do
    // anything useful — drop it now rather than waiting for an abort that may
    // never come (UX-C6).
    task.releaseAbortListener?.();

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
