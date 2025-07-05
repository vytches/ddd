import type { ICommandBus, IQueryBus } from '../abstracts';
import { CommandBus, QueryBus, EnhancedCommandBus, EnhancedQueryBus } from '../implementations';
import type { CQRSOptions } from './cqrs-options.interface';

export class CQRSConfiguration {
  public readonly commandBus: ICommandBus;
  public readonly queryBus: IQueryBus;

  constructor(options: CQRSOptions = {}) {
    const {
      commandBusType = 'basic',
      queryBusType = 'basic',
      handlerResolver,
      autoDiscovery = false,
      middlewares = [],
    } = options;

    // Create buses
    this.commandBus =
      commandBusType === 'enhanced'
        ? new EnhancedCommandBus(handlerResolver)
        : new CommandBus(handlerResolver);

    this.queryBus =
      queryBusType === 'enhanced'
        ? new EnhancedQueryBus(handlerResolver)
        : new QueryBus(handlerResolver);

    // Apply middlewares
    middlewares.forEach(middleware => {
      this.commandBus.use(middleware);
      this.queryBus.use(middleware);
    });

    // Auto-discovery if enabled
    if (autoDiscovery) {
      this.commandBus.discoverHandlers();
      this.queryBus.discoverHandlers();
    }
  }
}
