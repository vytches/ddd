import type { IDomainEvent, IEventBus } from '@vytches/ddd-contracts';

import type { IAuditEvent } from './audit';
import type { IIntegrationEvent } from './integration';

/**
 * @public
 * @stable
 * @since 0.22.0
 */
export type IDomainEventBus = IEventBus<IDomainEvent>;

/**
 * @public
 * @stable
 * @since 0.22.0
 */
export type IIntegrationEventBus = IEventBus<IIntegrationEvent>;

/**
 * @public
 * @stable
 * @since 0.22.0
 */
export type IAuditEventBus = IEventBus<IAuditEvent>;
