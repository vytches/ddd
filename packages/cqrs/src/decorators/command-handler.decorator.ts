/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import type { ICommand, ICommandHandler } from '../interfaces';
import type { CommandHandlerOptions, DIHandlerMetadata } from './di-types';

/**
 * @llm-summary command handler function
 * @llm-domain Architecture
 * @llm-pure false
 *
 * @description
 * CommandHandler function implementing architectural component for command handler operations.
 *
 *
 * @param {new (...args: unknown[]} commandType - commandType parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = CommandHandler(commandType);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => CommandHandler(commandType));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function CommandHandler<T extends ICommand>(
  commandType: new (...args: unknown[]) => T,
  options?: CommandHandlerOptions
) {
  return function <K extends ICommandHandler<T>>(target: new (...args: unknown[]) => K) {
    const diOptions = options || {};
    const metadata: DIHandlerMetadata = {
      type: 'command',
      messageType: commandType,
      handlerType: target,
      options: diOptions,
      registeredAt: new Date(),
      registeredWithDI: false,
    };

    // Store metadata in command class (for resolution)
    Reflect.defineMetadata(
      'di:command-handler',
      {
        ...metadata,
        serviceId: diOptions.serviceId || target.name,
      },
      commandType
    );

    // Store metadata in handler class (for auto-discovery)
    Reflect.defineMetadata('di:handler-metadata', metadata, target);
    Reflect.defineMetadata('di:handler-type', 'command', target);

    // Mark for DI auto-registration
    if (diOptions.autoRegister !== false) {
      Reflect.defineMetadata('di:registration-pending', true, target);
    }

    return target;
  };
}
