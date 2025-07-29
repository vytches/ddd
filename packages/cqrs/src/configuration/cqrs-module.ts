import { CQRSConfiguration } from './cqrs-configuration';
import type { CQRSOptions } from './cqrs-options.interface';
import type { IDependencyContainer } from '@vytches/ddd-di';

/**
 * @llm-summary CQRSModule class for c q r s module operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * CQRSModule class implementing architectural component for c q r s module operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CQRSModule();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
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
