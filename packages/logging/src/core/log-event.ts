import type { LogLevel } from './log-level.js';
import type { LogContext } from './log-context.js';

export interface LogEvent {
  readonly id: string;
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly message: string;
  readonly context: LogContext;
  readonly data?: Record<string, unknown>;
  readonly error?: Error;
  readonly tags?: readonly string[];
}

export interface LogEventBuilder {
  withData(data: Record<string, unknown>): LogEventBuilder;
  withError(error: Error): LogEventBuilder;
  withTags(...tags: string[]): LogEventBuilder;
  build(): LogEvent;
}

export class DefaultLogEventBuilder implements LogEventBuilder {
  private event: {
    id: string;
    timestamp: Date;
    level: LogLevel;
    message: string;
    context: LogContext;
    data?: Record<string, unknown>;
    error?: Error;
    tags?: readonly string[];
  };

  constructor(level: LogLevel, message: string, context: LogContext) {
    this.event = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      context,
    };
  }

  withData(data: Record<string, unknown>): LogEventBuilder {
    this.event = {
      ...this.event,
      data: { ...(this.event.data || {}), ...data }
    };
    return this;
  }

  withError(error: Error): LogEventBuilder {
    this.event = {
      ...this.event,
      error
    };
    return this;
  }

  withTags(...tags: string[]): LogEventBuilder {
    this.event = {
      ...this.event,
      tags: [...(this.event.tags || []), ...tags]
    };
    return this;
  }

  build(): LogEvent {
    return {
      id: this.event.id,
      timestamp: this.event.timestamp,
      level: this.event.level,
      message: this.event.message,
      context: this.event.context,
      ...(this.event.data !== undefined && { data: this.event.data }),
      ...(this.event.error !== undefined && { error: this.event.error }),
      ...(this.event.tags !== undefined && { tags: this.event.tags }),
    };
  }

  private generateId(): string {
    return `log-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
