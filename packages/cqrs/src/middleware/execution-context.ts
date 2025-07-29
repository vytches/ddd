import type { ExecutionContext } from './middleware.interface';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../interfaces';

/**
 * @llm-summary CQRSExecutionContext class for c q r s execution context operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * CQRSExecutionContext class implementing architectural component for c q r s execution context operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CQRSExecutionContext();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class CQRSExecutionContext implements ExecutionContext {
  private _metadata = new Map<string, unknown>();

  constructor(
    public readonly commandOrQuery: ICommand | IQuery<unknown>,
    public readonly handler: ICommandHandler<ICommand> | IQueryHandler<IQuery<unknown>, unknown>,
    public readonly type: 'command' | 'query'
  ) {}

  get metadata(): Map<string, unknown> {
    return this._metadata;
  }

  setMetadata(key: string, value: unknown): void {
    this._metadata.set(key, value);
  }

  getMetadata<T>(key: string): T | undefined {
    return this._metadata.get(key) as T | undefined;
  }
}
