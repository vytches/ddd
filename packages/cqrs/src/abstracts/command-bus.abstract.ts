import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';

type CommandConstructor<T extends ICommand = ICommand> = new (...args: unknown[]) => T;

/**
 * @llm-summary CommandBus class for command bus operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * CommandBus class implementing architectural component for command bus operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ICommandBus();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ICommandBus());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
