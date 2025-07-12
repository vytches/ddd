import type { IEventSerializer, IStoredDomainEvent } from '@vytches-ddd/contracts';
import { Logger } from '@vytches-ddd/logging';
import type { ILogger } from '@vytches-ddd/logging';
import { EventSerializationError, EventDeserializationError } from '../errors';

/**
 * JSON Event Serializer
 * Default serializer that converts events to/from JSON
 */
export class JsonEventSerializer implements IEventSerializer {
  private readonly logger: ILogger;
  private readonly pretty: boolean;

  constructor(pretty = false) {
    this.logger = Logger.forContext('JsonEventSerializer');
    this.pretty = pretty;
  }

  /**
   * Serialize event to JSON string
   */
  serialize(event: IStoredDomainEvent): string {
    try {
      return this.pretty ? JSON.stringify(event, null, 2) : JSON.stringify(event);
    } catch (error) {
      this.logger.error('Failed to serialize event', undefined, {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw EventSerializationError.withEvent(
        event.eventType,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Deserialize JSON string to event
   */
  deserialize<T = unknown>(data: string): IStoredDomainEvent<T> {
    try {
      const parsed = JSON.parse(data);

      // Restore Date objects
      if (parsed.timestamp && typeof parsed.timestamp === 'string') {
        parsed.timestamp = new Date(parsed.timestamp);
      }

      if (parsed.metadata?.timestamp && typeof parsed.metadata.timestamp === 'string') {
        parsed.metadata.timestamp = new Date(parsed.metadata.timestamp);
      }

      return parsed;
    } catch (error) {
      this.logger.error('Failed to deserialize event', undefined, {
        dataLength: data.length,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw EventDeserializationError.withData(
        data.length,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get content type
   */
  getContentType(): string {
    return 'application/json';
  }
}
