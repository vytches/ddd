import { CQRSConfiguration } from './cqrs-configuration';
import type { CQRSOptions } from './cqrs-options.interface';
import type { IDependencyContainer } from '@vytches-ddd/di';

export class CQRSModule {
  static create(container: IDependencyContainer, options: CQRSOptions = {}): CQRSConfiguration {
    return new CQRSConfiguration(container, options);
  }

  static createBasic(container: IDependencyContainer): CQRSConfiguration {
    return new CQRSConfiguration(container, {
      commandBusType: 'basic',
      queryBusType: 'basic',
    });
  }

  static createEnhanced(container: IDependencyContainer): CQRSConfiguration {
    return new CQRSConfiguration(container, {
      commandBusType: 'enhanced',
      queryBusType: 'enhanced',
    });
  }
}
