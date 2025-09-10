import type { IProcessManagerSecurityContext } from '../security';

/**
 * Context object passed to process managers during event handling.
 * Provides access to external services and processing metadata.
 */
export interface IProcessManagerContext {
  /**
   * Unique identifier for this processing session
   */
  correlationId: string;

  /**
   * User or system that initiated the processing
   */
  userId?: string;

  /**
   * Tenant context for multi-tenant scenarios
   */
  tenantId?: string;

  /**
   * Request identifier for tracing
   */
  requestId?: string;

  /**
   * Session identifier if applicable
   */
  sessionId?: string;

  /**
   * Timestamp when processing started
   */
  processedAt: Date;

  /**
   * Additional metadata for processing
   */
  metadata?: Record<string, unknown>;

  /**
   * Services available during processing
   */
  services?: IProcessManagerServices;

  /**
   * Security context for authorization and audit
   */
  securityContext?: IProcessManagerSecurityContext;
}

/**
 * Services interface that can be injected into process manager context
 */
export interface IProcessManagerServices {
  /**
   * Command dispatcher for sending commands
   */
  commandDispatcher?:
    | {
        dispatch(command: { type: string; payload: unknown }): Promise<void>;
      }
    | undefined;

  /**
   * Event publisher for emitting events
   */
  eventPublisher?:
    | {
        publish(event: { eventType: string; payload: unknown }): Promise<void>;
      }
    | undefined;

  /**
   * Repository access for data operations
   */
  repositories?: Record<string, unknown> | undefined;

  /**
   * External service access
   */
  externalServices?: Record<string, unknown> | undefined;

  /**
   * Logging service
   */
  logger?:
    | {
        info(message: string, data?: Record<string, unknown>): void;
        warn(message: string, data?: Record<string, unknown>): void;
        error(message: string, error?: Error, data?: Record<string, unknown>): void;
        debug(message: string, data?: Record<string, unknown>): void;
      }
    | undefined;
}
