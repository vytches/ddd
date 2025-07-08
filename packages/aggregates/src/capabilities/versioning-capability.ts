import { Capability } from '@vytches-ddd/contracts';
import type {
  IVersioningCapability,
  IExtendedDomainEvent,
  IEventUpcaster,
} from '@vytches-ddd/contracts';
import type { IAggregateRoot, IAggregateEventHandler } from '../aggregate-interfaces';

/**
 * Type-safe versioning capability implementation
 * Handles event versioning and upcasting for evolving domain events
 */
export class VersioningCapability extends Capability<'versioning'> implements IVersioningCapability {
  override readonly type = 'versioning' as const;

  static override get capabilityType(): string {
    return 'versioning';
  }
  private aggregate!: IAggregateRoot;
  private upcasters = new Map<string, Map<number, IEventUpcaster>>();

  attach(aggregate: unknown): void {
    this.aggregate = aggregate as IAggregateRoot;
  }

  detach?(): void {
    this.aggregate = undefined!;
    this.upcasters.clear();
  }

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

  handleVersionedEvent(
    event: IExtendedDomainEvent,
    handlers: Map<string, IAggregateEventHandler>
  ): void {
    const eventVersion = (event.metadata?.version as number) || 1;
    const currentVersion = (event.metadata as { targetVersion?: number })?.targetVersion || eventVersion;

    let processedEvent = event;

    // Apply upcasters in sequence if needed
    if (eventVersion < currentVersion && this.upcasters.has(event.eventType)) {
      const eventUpcasters = this.upcasters.get(event.eventType)!;

      for (let version = eventVersion; version < currentVersion; version++) {
        const upcaster = eventUpcasters.get(version);
        if (upcaster) {
          const upcastedPayload = upcaster.upcast(
            processedEvent.payload,
            processedEvent.metadata
          );
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

  getRegisteredEventTypes(): string[] {
    return Array.from(this.upcasters.keys());
  }

  hasUpcaster(eventType: string, version: number): boolean {
    return this.upcasters.get(eventType)?.has(version) || false;
  }

  /**
   * Get all upcasters for an event type
   */
  getUpcastersForType(eventType: string): Map<number, IEventUpcaster> | undefined {
    return this.upcasters.get(eventType);
  }

  /**
   * Clear all upcasters for an event type
   */
  clearUpcastersForType(eventType: string): void {
    this.upcasters.delete(eventType);
  }

  /**
   * Get total number of registered upcasters
   */
  getTotalUpcasterCount(): number {
    let count = 0;
    for (const eventUpcasters of this.upcasters.values()) {
      count += eventUpcasters.size;
    }
    return count;
  }
}