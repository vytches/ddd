import type { IAuditEvent, IDomainEvent, IEventBus } from '@vytches/ddd-contracts';

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
