/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';

export abstract class ICommandBus {
  abstract register<T extends ICommand>(
    commandType: any,
    handler: ICommandHandler<T>,
  ): void;
  abstract registerFactory<T extends ICommand>(
    commandType: any,
    factory: () => ICommandHandler<T>,
  ): void;
  abstract use(middleware: ICQRSMiddleware): this;
  abstract discoverHandlers(): void;
  abstract execute<T extends ICommand>(command: T): Promise<void>;
}
