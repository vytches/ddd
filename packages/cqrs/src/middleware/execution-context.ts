/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ExecutionContext } from './middleware.interface';
import type {
  ICommand,
  ICommandHandler,
  IQuery,
  IQueryHandler,
} from '../interfaces';

export class CQRSExecutionContext implements ExecutionContext {
  private _metadata = new Map<string, any>();

  constructor(
    public readonly commandOrQuery: ICommand | IQuery<any>,
    public readonly handler: ICommandHandler<any> | IQueryHandler<any, any>,
    public readonly type: 'command' | 'query',
  ) {}

  get metadata(): Map<string, any> {
    return this._metadata;
  }

  setMetadata(key: string, value: any): void {
    this._metadata.set(key, value);
  }

  getMetadata<T>(key: string): T | undefined {
    return this._metadata.get(key);
  }
}
