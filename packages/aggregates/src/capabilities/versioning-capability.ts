import { Capability } from '@vytches/ddd-contracts';
import type {
  IVersioningCapability,
  IExtendedDomainEvent,
  IEventUpcaster,
} from '@vytches/ddd-contracts';
import type { IAggregateRoot, IAggregateEventHandler } from '../aggregate-interfaces';

/**
 * @description-inject
 * @business-context-inject
 * @example-inject
 */
export class VersioningCapability
  extends Capability<'versioning'>
  implements IVersioningCapability
{
  override readonly type = 'versioning' as const;

  static override get capabilityType(): string {
    return 'versioning';
  }
  private aggregate!: IAggregateRoot;
  private upcasters = new Map<string, Map<number, IEventUpcaster>>();

  /**
   * @description-inject
   * @business-context-inject
   * @param {unknown} aggregate - Aggregate to attach this capability to
   * @example-inject
   */
  attach(aggregate: unknown): void {
    this.aggregate = aggregate as IAggregateRoot;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @example-inject
   */
  detach?(): void {
    this.aggregate = undefined!;
    this.upcasters.clear();
  }

  /**
   * @description-inject
   * @business-context-inject
   * @param {string} eventType - Type of event to register upcaster for
   * @param {number} sourceVersion - Source version number to upcast from
   * @param {IEventUpcaster<TFrom, TTo>} upcaster - Upcaster instance to transform events
   * @example-inject
   */
  registerUpcaster<TFrom = unknown, TTo = unknown>(
    eventType: string,
    sourceVersion: number,
    upcaster: IEventUpcaster<TFrom, TTo>
  ): void {
    if (!this.upcasters.has(eventType)) {
      this.upcasters.set(eventType, new Map());
    }
    this.upcasters.get(eventType)!.set(sourceVersion, upcaster);
  }

  /**
   * @description-inject
   * @business-context-inject
   * @param {IExtendedDomainEvent} event - Event to process with version handling
   * @param {Map<string, IAggregateEventHandler>} handlers - Map of event handlers
   * @example-inject
   */
  handleVersionedEvent(
    event: IExtendedDomainEvent,
    handlers: Map<string, IAggregateEventHandler>
  ): void {
    const eventVersion = (event.metadata?.version as number) || 1;
    const currentVersion =
      (event.metadata as { targetVersion?: number })?.targetVersion || eventVersion;

    let processedEvent = event;

    // Apply upcasters in sequence if needed
    if (eventVersion < currentVersion && this.upcasters.has(event.eventType)) {
      const eventUpcasters = this.upcasters.get(event.eventType)!;

      for (let version = eventVersion; version < currentVersion; version++) {
        const upcaster = eventUpcasters.get(version);
        if (upcaster) {
          const upcastedPayload = upcaster.upcast(processedEvent.payload, processedEvent.metadata);
          processedEvent = {
            ...processedEvent,
            payload: upcastedPayload,
            metadata: {
              ...processedEvent.metadata,
              version: version + 1,
            },
          };
        }
      }
    }

    // Call the appropriate handler
    const handler = handlers.get(processedEvent.eventType);
    if (handler) {
      handler(processedEvent.payload, processedEvent.metadata);
    }
  }

  /**
   * @description-inject
   * @business-context-inject
   * @returns {string[]} Array of event types that have registered upcasters
   * @example-inject
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.upcasters.keys());
  }

  /**
   * @description-inject
   * @business-context-inject
   * @param {string} eventType - Event type to check
   * @param {number} version - Version number to check for upcaster
   * @returns {boolean} True if upcaster exists for specified event type and version
   * @example-inject
   */
  hasUpcaster(eventType: string, version: number): boolean {
    return this.upcasters.get(eventType)?.has(version) || false;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @param {string} eventType - Event type to get upcasters for
   * @returns {Map<number, IEventUpcaster> | undefined} Map of upcasters by version or undefined
   * @example-inject
   */
  getUpcastersForType(eventType: string): Map<number, IEventUpcaster> | undefined {
    return this.upcasters.get(eventType);
  }

  /**
   * @description-inject
   * @business-context-inject
   * @param {string} eventType - Event type to clear upcasters for
   * @example-inject
   */
  clearUpcastersForType(eventType: string): void {
    this.upcasters.delete(eventType);
  }

  /**
   * @description-inject
   * @business-context-inject
   * @returns {number} Total count of all registered upcasters across all event types
   * @example-inject
   */
  getTotalUpcasterCount(): number {
    let count = 0;
    for (const eventUpcasters of this.upcasters.values()) {
      count += eventUpcasters.size;
    }
    return count;
  }
}
