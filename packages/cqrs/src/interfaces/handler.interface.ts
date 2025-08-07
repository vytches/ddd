import type { ICommand } from './command.interface';
import type { IQuery } from './query.interface';

/**
 * @llm-summary Contract for command handler functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * CommandHandler interface implementing architectural component for command handler operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCommandHandler implements ICommandHandler {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
  execute(command: TCommand): Promise<TResult>;
}

/**
 * @llm-summary Contract for query handler functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * QueryHandler interface implementing architectural component for query handler operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteQueryHandler implements IQueryHandler {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IQueryHandler<TQuery extends IQuery<TResult>, TResult> {
  execute(query: TQuery): Promise<TResult>;
}
