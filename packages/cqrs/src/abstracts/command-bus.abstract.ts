import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';

type CommandConstructor<T extends ICommand = ICommand> = new (...args: unknown[]) => T;

/**
 * Stable DI injection token for ICommandBus.
 *
 * Use `Symbol.for` so the token resolves to the same reference regardless of
 * whether the consumer imports from the ESM or CJS build of this package
 * (dual-package hazard). The string key `'vytches:cqrs:command-bus'` is a
 * public contract — do not change it across minor versions.
 *
 * @example
 * ```typescript
 * import { COMMAND_BUS_TOKEN } from '@vytches/ddd-cqrs';
 * // In a NestJS provider:
 * @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus
 * ```
 */
export const COMMAND_BUS_TOKEN: unique symbol = Symbol.for('vytches:cqrs:command-bus');

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
