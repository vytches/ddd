import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';

type CommandConstructor<T extends ICommand = ICommand> = new (...args: unknown[]) => T;

export abstract class ICommandBus {
  abstract register<T extends ICommand>(
    commandType: CommandConstructor<T>,
    handler: ICommandHandler<T>,
  ): void;
  abstract registerFactory<T extends ICommand>(
    commandType: CommandConstructor<T>,
    factory: () => ICommandHandler<T>,
  ): void;
  abstract use(middleware: ICQRSMiddleware): this;
  abstract discoverHandlers(): void;
  abstract execute<T extends ICommand>(command: T): Promise<void>;
}
