/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import type { ICommand, ICommandHandler } from '../interfaces';
import type { CommandHandlerOptions, DIHandlerMetadata } from './di-types';

// Note: `any` is required in decorator signatures for TypeScript constructor compatibility.
// TypeScript decorators need `new (...args: any[]) => T` to match arbitrary class constructors.

/**
 * Class decorator that binds a handler class to a command type and registers
 * it for DI auto-discovery via the {@link CQRSDiscoveryPlugin}.
 *
 * Two pieces of metadata are written:
 *
 * - `di:command-handler` on the *command* class — used by `CommandBus.execute()`
 *   to look up the handler at runtime.
 * - `di:handler-metadata` + `di:handler-type` on the *handler* class — used
 *   by the discovery plugin during DI bootstrap to register the handler
 *   under the appropriate service token.
 *
 * Set `options.autoRegister: false` to register metadata only and wire the
 * handler manually with `bus.register(...)`. Set `options.serviceId` to
 * override the default service token (defaults to handler class name).
 *
 * @example Basic decorator usage
 * ```typescript
 * import { CommandHandler } from '@vytches/ddd-cqrs';
 *
 * class CreateOrder { constructor(public customerId: string) {} }
 *
 * @CommandHandler(CreateOrder)
 * export class CreateOrderHandler implements ICommandHandler<CreateOrder, Order> {
 *   async execute(cmd: CreateOrder): Promise<Order> {
 *     return Order.create(cmd.customerId);
 *   }
 * }
 *
 * // After CQRSModule.bootstrap(), the handler is auto-registered:
 * await commandBus.execute(new CreateOrder('c-1'));
 * ```
 *
 * @example Custom service token
 * ```typescript
 * @CommandHandler(CreateOrder, { serviceId: 'order.handlers.create' })
 * export class CreateOrderHandler { ... }
 *
 * // Token must match in container resolution / tests
 * container.resolve('order.handlers.create');
 * ```
 *
 * @example Disable auto-registration (manual wiring)
 * ```typescript
 * @CommandHandler(CreateOrder, { autoRegister: false })
 * export class CreateOrderHandler { ... }
 *
 * // Required: register manually
 * commandBus.register(CreateOrder, new CreateOrderHandler());
 * ```
 *
 * @param commandType - The command class this handler responds to
 * @param options - DI / registration options
 * @returns Class decorator preserving handler type
 *
 * @public
 * @stable
 * @since 0.1.0
 */
export function CommandHandler<TCommand extends ICommand>(
  commandType: new (...args: any[]) => TCommand,
  options?: CommandHandlerOptions
): <THandler extends ICommandHandler<TCommand, any>>(
  target: new (...args: any[]) => THandler
) => new (...args: any[]) => THandler;

export function CommandHandler<TCommand extends ICommand, TResult>(
  commandType: new (...args: any[]) => TCommand,
  options?: CommandHandlerOptions
): <THandler extends ICommandHandler<TCommand, TResult>>(
  target: new (...args: any[]) => THandler
) => new (...args: any[]) => THandler;

export function CommandHandler<TCommand extends ICommand, TResult = any>(
  commandType: new (...args: any[]) => TCommand,
  options?: CommandHandlerOptions
) {
  return function <THandler extends ICommandHandler<TCommand, TResult>>(
    target: new (...args: any[]) => THandler
  ) {
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
    Reflect.defineMetadata('di:handler-scope', diOptions.scope ?? 'context', target);

    // Mark for DI auto-registration
    if (diOptions.autoRegister !== false) {
      Reflect.defineMetadata('di:registration-pending', true, target);
    }

    return target;
  };
}
