/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ICQRSMiddleware, ExecutionContext } from './middleware.interface';

export class LoggingMiddleware implements ICQRSMiddleware {
  constructor(private logger?: { log: (message: string) => void }) {
    this.logger = logger || console;
  }

  async handle(context: ExecutionContext, next: () => Promise<any>): Promise<any> {
    const { commandOrQuery, type } = context;
    const name = commandOrQuery.constructor.name;

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
