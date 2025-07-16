import type { IDomainEvent, IEventBus } from '@vytches-ddd/contracts';

import type { IAuditEvent } from './audit';
import type { IIntegrationEvent } from './integration';

/**
 * @llm-summary Type definition for domain event bus
 * @llm-domain Architecture
 * @llm-usage Frequent
 *
 * @description
 * DomainEventBus type implementing architectural component for domain event bus operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: IDomainEventBus = {} as IDomainEventBus;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type IDomainEventBus = IEventBus<IDomainEvent>;

/**
 * @llm-summary Type definition for integration event bus
 * @llm-domain Architecture
 * @llm-usage Frequent
 *
 * @description
 * IntegrationEventBus type implementing architectural component for integration event bus operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: IIntegrationEventBus = {} as IIntegrationEventBus;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type IIntegrationEventBus = IEventBus<IIntegrationEvent>;

/**
 * @llm-summary Type definition for audit event bus
 * @llm-domain Architecture
 * @llm-usage Frequent
 *
 * @description
 * AuditEventBus type implementing architectural component for audit event bus operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: IAuditEventBus = {} as IAuditEventBus;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type IAuditEventBus = IEventBus<IAuditEvent>;
