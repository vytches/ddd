import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';

type CommandConstructor<T extends ICommand = ICommand> = new (...args: unknown[]) => T;

export abstract class ICommandBus {
  abstract register<T extends ICommand, TResult = void>(
    commandType: CommandConstructor<T>,
    handler: ICommandHandler<T, TResult>
  ): void;
  abstract registerFactory<T extends ICommand, TResult = void>(
    commandType: CommandConstructor<T>,
    factory: () => ICommandHandler<T, TResult>
  ): void;
  abstract use(middleware: ICQRSMiddleware): this;
  abstract discoverHandlers(): void;
  abstract execute<T extends ICommand, TResult = void>(command: T): Promise<TResult>;
}
