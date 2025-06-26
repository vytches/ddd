import type { IDomainEvent, IEventBus } from '@vytches-ddd/contracts';

import type { IAuditEvent } from './audit';
import type { IIntegrationEvent } from './integration';

/**
 * Common type aliases for clarity
 */
export type IDomainEventBus = IEventBus<IDomainEvent>;
export type IIntegrationEventBus = IEventBus<IIntegrationEvent>;
export type IAuditEventBus = IEventBus<IAuditEvent>;


