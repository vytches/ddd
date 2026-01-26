import { Capability } from '@vytches/ddd-contracts';
import type { IVersioningCapability, IDomainEvent, IEventUpcaster } from '@vytches/ddd-contracts';
import type { IAggregateRoot, IAggregateEventHandler } from '../aggregate-interfaces';

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
   * @param {unknown} aggregate - Aggregate to attach this capability to
   */
  attach(aggregate: unknown): void {
    this.aggregate = aggregate as IAggregateRoot;
  }

  detach?(): void {
    this.aggregate = undefined!;
    this.upcasters.clear();
  }

  /**
   * @param {string} eventType - Type of event to register upcaster for
   * @param {number} sourceVersion - Source version number to upcast from
   * @param {IEventUpcaster<TFrom, TTo>} upcaster - Upcaster instance to transform events
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
   * @param {IDomainEvent} event - Event to process with version handling
   * @param {Map<string, IAggregateEventHandler>} handlers - Map of event handlers
   */
  handleVersionedEvent(event: IDomainEvent, handlers: Map<string, IAggregateEventHandler>): void {
    const eventVersion = (event.metadata?.version as number) || 1;
    const currentVersion =
      (event.metadata as { targetVersion?: number })?.targetVersion || eventVersion;

    let processedEvent = event;

    // Apply upcasters in sequence if needed
    if (eventVersion < currentVersion && this.upcasters.has(event.eventName)) {
      const eventUpcasters = this.upcasters.get(event.eventName)!;

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
    const handler = handlers.get(processedEvent.eventName);
    if (handler) {
      handler(processedEvent.payload, processedEvent.metadata);
    }
  }

  /**
   * @returns {string[]} Array of event types that have registered upcasters
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.upcasters.keys());
  }

  /**
   * @param {string} eventType - Event type to check
   * @param {number} version - Version number to check for upcaster
   * @returns {boolean} True if upcaster exists for specified event type and version
   */
  hasUpcaster(eventType: string, version: number): boolean {
    return this.upcasters.get(eventType)?.has(version) || false;
  }

  /**
   * @param {string} eventType - Event type to get upcasters for
   * @returns {Map<number, IEventUpcaster> | undefined} Map of upcasters by version or undefined
   */
  getUpcastersForType(eventType: string): Map<number, IEventUpcaster> | undefined {
    return this.upcasters.get(eventType);
  }

  /**
   * @param {string} eventType - Event type to clear upcasters for
   */
  clearUpcastersForType(eventType: string): void {
    this.upcasters.delete(eventType);
  }

  /**
   * @returns {number} Total count of all registered upcasters across all event types
   */
  getTotalUpcasterCount(): number {
    let count = 0;
    for (const eventUpcasters of this.upcasters.values()) {
      count += eventUpcasters.size;
    }
    return count;
  }
}
