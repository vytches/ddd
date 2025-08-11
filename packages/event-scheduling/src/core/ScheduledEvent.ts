import type { IEventMetadata, IScheduledEvent, IScheduleOptions } from '@vytches/ddd-contracts';
import { DomainEvent } from '@vytches/ddd-events';

export abstract class ScheduledEvent<T = any> extends DomainEvent<T> implements IScheduledEvent {
  public readonly scheduleAt: Date;
  public readonly scheduleOptions?: IScheduleOptions | undefined;
  public readonly aggregateId: string;
  public readonly type: string;

  constructor(
    aggregateId: string,
    scheduleAt: Date,
    payload?: T,
    scheduleOptions?: IScheduleOptions,
    metadata?: IEventMetadata
  ) {
    super(payload, metadata);
    this.aggregateId = aggregateId;
    this.scheduleAt = scheduleAt;
    this.scheduleOptions = scheduleOptions;
    this.type = this.constructor.name; // Use class name as type
  }

  /**
   * Check if this event is a scheduled event
   */
  static isScheduledEvent(event: unknown): event is IScheduledEvent {
    return (
      event !== null &&
      typeof event === 'object' &&
      'scheduleAt' in event &&
      event.scheduleAt instanceof Date
    );
  }

  /**
   * Get delay in milliseconds from now
   */
  getDelayMs(): number {
    const delay = this.scheduleAt.getTime() - Date.now();
    return Math.max(0, delay);
  }

  /**
   * Check if event is overdue
   */
  isOverdue(): boolean {
    return this.getDelayMs() === 0 && this.scheduleAt.getTime() < Date.now();
  }

  /**
   * Create a copy with new schedule time
   */
  reschedule(newTime: Date): IScheduledEvent {
    const Constructor = this.constructor as new (
      aggregateId: string,
      scheduleAt: Date,
      payload?: T,
      scheduleOptions?: IScheduleOptions,
      metadata?: IEventMetadata
    ) => IScheduledEvent;

    // Access payload and metadata through getters if they exist, otherwise undefined
    const payload = 'payload' in this ? (this as any).payload : undefined;
    const metadata = 'metadata' in this ? (this as any).metadata : undefined;

    const rescheduled = new Constructor(
      this.aggregateId,
      newTime,
      payload,
      this.scheduleOptions,
      metadata
    );

    return rescheduled;
  }
}
