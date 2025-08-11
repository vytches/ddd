import type { ICommand } from './command.interface';
import type { IQuery } from './query.interface';

export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
  execute(command: TCommand): Promise<TResult>;
}

export interface IQueryHandler<TQuery extends IQuery<TResult>, TResult> {
  execute(query: TQuery): Promise<TResult>;
}
