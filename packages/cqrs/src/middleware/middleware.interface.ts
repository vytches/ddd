export interface ICQRSMiddleware {
  handle(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown>;
}

export interface ExecutionContext {
  readonly commandOrQuery: unknown;
  readonly handler: unknown;
  readonly type: 'command' | 'query';
  readonly metadata: Map<string, unknown>;
}
