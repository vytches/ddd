import type { IDependencyContainer } from '@vytches/ddd-di';
import { Logger } from '@vytches/ddd-logging';
import type { ICommandBus, IQueryBus } from '../abstracts';
import { CommandBus, EnhancedCommandBus, EnhancedQueryBus, QueryBus } from '../implementations';
import type { CQRSOptions } from './cqrs-options.interface';

/**
 * One-stop CQRS bootstrap — wires `commandBus` + `queryBus` from a single
 * options object. Choose `'basic'` (light, no metrics) or `'enhanced'`
 * (metrics, performance tracking, retry hooks) per bus, then attach shared
 * middleware once for both.
 *
 * Use directly when you control the DI container, or via {@link CQRSModule}
 * when you want decorator-driven auto-discovery wired in.
 *
 * @example Basic setup
 * ```typescript
 * import { CQRSConfiguration } from '@vytches/ddd-cqrs';
 *
 * const cqrs = new CQRSConfiguration(container);
 * cqrs.commandBus.register(CreateOrder, new CreateOrderHandler());
 * await cqrs.commandBus.execute(new CreateOrder('c-1'));
 * ```
 *
 * @example With shared middleware and enhanced buses
 * ```typescript
 * import { CQRSConfiguration, LoggingMiddleware } from '@vytches/ddd-cqrs';
 *
 * const cqrs = new CQRSConfiguration(container, {
 *   commandBusType: 'enhanced',
 *   queryBusType: 'enhanced',
 *   middlewares: [new LoggingMiddleware()],
 * });
 * ```
 *
 * @example NestJS module integration
 * ```typescript
 * @Module({
 *   providers: [
 *     {
 *       provide: 'CQRS',
 *       useFactory: (c: IDependencyContainer) =>
 *         new CQRSConfiguration(c, { commandBusType: 'enhanced' }),
 *       inject: ['DI_CONTAINER'],
 *     },
 *   ],
 *   exports: ['CQRS'],
 * })
 * class AppModule {}
 * ```
 *
 * @public
 * @stable
 * @since 0.1.0
 */
export class CQRSConfiguration {
  private readonly logger = Logger.forContext('CQRSConfiguration');
  public readonly commandBus: ICommandBus;
  public readonly queryBus: IQueryBus;

  constructor(container: IDependencyContainer, options: CQRSOptions = {}) {
    const {
      commandBusType = 'basic',
      queryBusType = 'basic',
      autoDiscovery = false,
      middlewares = [],
    } = options;

    // Create buses with DI container
    this.commandBus =
      commandBusType === 'enhanced' ? new EnhancedCommandBus(container) : new CommandBus(container);

    this.queryBus =
      queryBusType === 'enhanced' ? new EnhancedQueryBus(container) : new QueryBus(container);

    // Apply middlewares
    middlewares.forEach(middleware => {
      this.commandBus.use(middleware);
      this.queryBus.use(middleware);
    });

    // Auto-discovery if enabled (deprecated - DI container handles this)
    if (autoDiscovery) {
      // Suppress deprecation warnings in CI to avoid stderr confusion
      if (!process.env.CI) {
        this.logger.warn(
          'autoDiscovery option is deprecated. Use DI container auto-discovery instead.'
        );
      }
      this.commandBus.discoverHandlers();
      this.queryBus.discoverHandlers();
    }
  }
}
