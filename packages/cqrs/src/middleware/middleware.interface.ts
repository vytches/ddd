/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ICQRSMiddleware {
  handle(context: ExecutionContext, next: () => Promise<any>): Promise<any>;
}

export interface ExecutionContext {
  readonly commandOrQuery: any;
  readonly handler: any;
  readonly type: 'command' | 'query';
  readonly metadata: Map<string, any>;
}
