import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../interfaces';

type CommandConstructor<T extends ICommand = ICommand> = new (...args: any[]) => T;
type CommandHandlerConstructor<T extends ICommand = ICommand> = new (...args: any[]) => ICommandHandler<T>;
type QueryConstructor<T extends IQuery<unknown> = IQuery<unknown>> = new (...args: any[]) => T;
type QueryHandlerConstructor<T extends IQuery<R>, R = unknown> = new (...args: any[]) => IQueryHandler<T, R>;

export class CQRSMetadataRegistry {
  private static commandHandlers = new Map<CommandConstructor, CommandHandlerConstructor>();
  private static queryHandlers = new Map<QueryConstructor, QueryHandlerConstructor<IQuery<unknown>, unknown>>();

  static registerCommandHandler<T extends ICommand>(
    commandType: CommandConstructor<T>, 
    handlerType: CommandHandlerConstructor<T>
  ): void {
    this.commandHandlers.set(commandType, handlerType);
  }

  static registerQueryHandler<T extends IQuery<R>, R>(
    queryType: QueryConstructor<T>, 
    handlerType: QueryHandlerConstructor<T, R>
  ): void {
    this.queryHandlers.set(queryType, handlerType as QueryHandlerConstructor<IQuery<unknown>, unknown>);
  }

  static getCommandHandlers(): Map<CommandConstructor, CommandHandlerConstructor> {
    return new Map(this.commandHandlers);
  }

  static getQueryHandlers(): Map<QueryConstructor, QueryHandlerConstructor<IQuery<unknown>, unknown>> {
    return new Map(this.queryHandlers);
  }

  static getAllHandlers(): {
    commands: Map<CommandConstructor, CommandHandlerConstructor>;
    queries: Map<QueryConstructor, QueryHandlerConstructor<IQuery<unknown>, unknown>>;
  } {
    return {
      commands: this.getCommandHandlers(),
      queries: this.getQueryHandlers(),
    };
  }

  // Testing helper
  static clearAll(): void {
    this.commandHandlers.clear();
    this.queryHandlers.clear();
  }
}
