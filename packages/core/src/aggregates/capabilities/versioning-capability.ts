import type {
  IAggregateRoot,
  IVersioningCapability,
  IAggregateEventHandler,
} from '../aggregate-interfaces';
import type { IExtendedDomainEvent, IEventUpcaster } from '@vytches-ddd/contracts';

import { AggregateError } from '../aggregate-errors';

/**
 * Versioning capability implementation
 * Handles event versioning and upcasting for backward compatibility
 */
export class VersioningCapability implements IVersioningCapability {
  private aggregate?: IAggregateRoot<any> | undefined;
  private _eventUpcasters = new Map<string, Map<number, IEventUpcaster>>();

  attach(aggregate: IAggregateRoot<any>): void {
    this.aggregate = aggregate;
  }

  detach?(): void {
    this.aggregate = null as any;
    this._eventUpcasters.clear();
  }

  registerUpcaster<TFrom = any, TTo = any>(
    eventType: string,
    sourceVersion: number,
    upcaster: IEventUpcaster<TFrom, TTo>,
  ): this {
    if (!this._eventUpcasters.has(eventType)) {
      this._eventUpcasters.set(eventType, new Map());
    }

    const typeUpcasters = this._eventUpcasters.get(eventType)!;

    if (typeUpcasters.has(sourceVersion)) {
      throw AggregateError.duplicateUpcaster(eventType, sourceVersion);
    }

    typeUpcasters.set(sourceVersion, upcaster);
    return this;
  }

  handleVersionedEvent(
    event: IExtendedDomainEvent,
    handlers: Map<string, IAggregateEventHandler>,
  ): void {
    // Upcast event if needed
    const upcastedEvent = this.upcastEvent(event);

    // Try version-specific handler first
    const eventVersion = upcastedEvent.metadata?.eventVersion;
    if (eventVersion) {
      const versionedHandlerName = `${upcastedEvent.eventType}_v${eventVersion}`;
      const versionedHandler = handlers.get(versionedHandlerName);
      if (versionedHandler) {
        versionedHandler(upcastedEvent.payload, upcastedEvent.metadata);
        return;
      }
    }

    // Fall back to default handler
    const defaultHandler = handlers.get(upcastedEvent.eventType);
    if (defaultHandler) {
      defaultHandler(upcastedEvent.payload, upcastedEvent.metadata);
    }
  }

  private upcastEvent(event: IExtendedDomainEvent): IExtendedDomainEvent {
    const eventType = event.eventType;
    const typeUpcasters = this._eventUpcasters.get(eventType);

    if (!typeUpcasters || typeUpcasters.size === 0) {
      return event;
    }

    const sourceVersion = event.metadata?.eventVersion || 1;
    const latestVersion = this.getLatestEventVersion(eventType);

    if (sourceVersion >= latestVersion) {
      return event;
    }

    // Perform sequential upcasting
    let currentPayload = event.payload;
    const currentMetadata = { ...event.metadata };
    let currentVersion = sourceVersion;

    while (currentVersion < latestVersion) {
      const upcaster = typeUpcasters.get(currentVersion);
      if (!upcaster) {
        throw AggregateError.missingUpcaster(
          eventType,
          currentVersion,
          currentVersion + 1,
        );
      }

      currentPayload = upcaster.upcast(currentPayload, currentMetadata);
      currentVersion++;
      currentMetadata.eventVersion = currentVersion;
    }

    return {
      ...event,
      payload: currentPayload,
      metadata: currentMetadata,
    };
  }

  private getLatestEventVersion(eventType: string): number {
    const typeUpcasters = this._eventUpcasters.get(eventType);
    if (!typeUpcasters || typeUpcasters.size === 0) {
      return 1;
    }
    return Math.max(...Array.from(typeUpcasters.keys())) + 1;
  }

  /**
   * Gets all registered event types for this capability
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this._eventUpcasters.keys());
  }

  /**
   * Gets the latest version for a specific event type
   */
  getLatestVersionForEventType(eventType: string): number {
    return this.getLatestEventVersion(eventType);
  }

  /**
   * Checks if an upcaster exists for a specific event type and version
   */
  hasUpcaster(eventType: string, version: number): boolean {
    const typeUpcasters = this._eventUpcasters.get(eventType);
    return typeUpcasters?.has(version) || false;
  }
}
