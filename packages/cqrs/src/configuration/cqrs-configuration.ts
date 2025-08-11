import type { IDependencyContainer } from '@vytches/ddd-di';
import type { ICommandBus, IQueryBus } from '../abstracts';
import { CommandBus, EnhancedCommandBus, EnhancedQueryBus, QueryBus } from '../implementations';
import type { CQRSOptions } from './cqrs-options.interface';

export class CQRSConfiguration {
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
        console.warn(
          'autoDiscovery option is deprecated. Use DI container auto-discovery instead.'
        );
      }
      this.commandBus.discoverHandlers();
      this.queryBus.discoverHandlers();
    }
  }
}
