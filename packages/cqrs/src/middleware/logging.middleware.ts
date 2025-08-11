/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ExecutionContext, ICQRSMiddleware } from './middleware.interface';

export class LoggingMiddleware implements ICQRSMiddleware {
  constructor(private logger?: { log: (message: string) => void }) {
    this.logger = logger || console;
  }

  async handle(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    const { commandOrQuery, type } = context;
    const name = (commandOrQuery as { constructor: { name: string } }).constructor.name;

    const startTime = Date.now();
    this.logger!.log(`[CQRS] Executing ${type}: ${name}`);

    try {
      const result = await next();
      const duration = Date.now() - startTime;
      this.logger!.log(`[CQRS] ${type} ${name} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger!.log(`[CQRS] ${type} ${name} failed after ${duration}ms: ${error}`);
      throw error;
    }
  }
}
