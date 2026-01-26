/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IActor } from '@vytches/ddd-domain-primitives';
import type { IDomainEvent, IEventMetadata } from '@vytches/ddd-contracts';

/**
 * Standard audit action types for compliance and monitoring.
 * Covers CRUD operations plus security and permission actions.
 *
 * @since 1.0.0
 * @public
 */
export enum AuditActionType {
  /** Dodanie nowego zasobu */
  CREATE = 'CREATE',

  /** Odczyt zasobu */
  READ = 'READ',

  /** Aktualizacja zasobu */
  UPDATE = 'UPDATE',

  /** Usunięcie zasobu */
  DELETE = 'DELETE',

  /** Dostęp do zasobu (np. logowanie) */
  ACCESS = 'ACCESS',

  /** Modyfikacja uprawnień */
  PERMISSION = 'PERMISSION',

  /** Inna akcja */
  OTHER = 'OTHER',
}

/**
 * Audit status values indicating operation outcome.
 * Used to track success, failure, or attempt status.
 *
 * @since 1.0.0
 * @public
 */
export enum AuditStatus {
  /** Operacja zakończona sukcesem */
  SUCCESS = 'SUCCESS',

  /** Operacja zakończona niepowodzeniem */
  FAILURE = 'FAILURE',

  /** Próba wykonania operacji */
  ATTEMPT = 'ATTEMPT',
}

/**
 * Comprehensive metadata interface for audit events.
 * Provides rich context including actors, resources, and operation details.
 * Extends IEventMetadata with audit-specific fields.
 *
 * @since 1.0.0
 * @public
 */
export interface IAuditEventMetadata extends IEventMetadata {
  /** Typ akcji (np. CREATE, READ, UPDATE, DELETE) */
  actionType?: AuditActionType | string;

  /** Status wykonania operacji (sukces, niepowodzenie, próba) */
  status?: AuditStatus | string;

  /** Identyfikator sesji użytkownika */
  sessionId?: string;

  /** Adres IP, z którego wykonano operację */
  ipAddress?: string;

  /** Źródło operacji (np. UI, API, SYSTEM) */
  source?: string;

  /** Poziom istotności audytu (np. INFO, WARNING, CRITICAL) */
  severity?: string;

  /** Moduł systemu, w którym wydarzyła się operacja */
  module?: string;

  /** Czas trwania operacji (w milisekundach) */
  duration?: number;

  /** Identyfikator zasobu, którego dotyczy operacja */
  resourceId?: string;

  /** Typ zasobu, którego dotyczy operacja */
  resourceType?: string;
}

/**
 * Standard structure for all audit events in the system.
 * Provides consistent format for compliance and monitoring.
 * Extends IDomainEvent with specialized audit metadata.
 *
 * @since 1.0.0
 * @public
 */
export interface IAuditEvent<P = unknown> extends IDomainEvent<P> {
  /** Metadane audytowe (rozszerzone) */
  metadata?: IAuditEventMetadata;
}

/**
 * Transformer interface for converting domain events to audit events.
 * Enables automatic audit trail generation from domain events.
 *
 * @since 1.0.0
 * @public
 */
export interface IDomainToAuditEventTransformer<D = unknown, A = unknown> {
  /**
   * Transformuje event domenowy na event audytowy
   * @param domainEvent Event domenowy do transformacji
   * @param additionalMetadata Opcjonalne dodatkowe metadane
   */
  transform(domainEvent: D, additionalMetadata?: Partial<IAuditEventMetadata>): IAuditEvent<A>;
}

/**
 * Filter interface for controlling which audit events are processed.
 * Enables selective audit processing based on business rules.
 *
 * @since 1.0.0
 * @public
 */
export interface IAuditEventFilter {
  /**
   * Sprawdza, czy event powinien być przetworzony
   * @param event Event audytowy do sprawdzenia
   * @returns True, jeśli event powinien być przetworzony, w przeciwnym razie false
   */
  shouldProcess<T = unknown>(event: IAuditEvent<T>): boolean;
}

/**
 * Main audit service interface for recording audit events.
 * Provides high-level audit recording and management capabilities.
 *
 * @since 1.0.0
 * @public
 */
export interface IAuditService {
  /**
   * Rejestruje zdarzenie audytowe
   * @param event Event audytowy do zarejestrowania
   */
  record<T = unknown>(event: IAuditEvent<T>): Promise<void>;

  /**
   * Tworzy i rejestruje zdarzenie audytowe na podstawie szczegółów akcji
   * @param action Typ akcji
   * @param resourceType Typ zasobu
   * @param resourceId Identyfikator zasobu
   * @param data Dodatkowe dane
   * @param metadata Opcjonalne metadane
   */
  recordAction(
    action: AuditActionType | string,
    resourceType: string,
    resourceId: string,
    data?: unknown,
    metadata?: Partial<IAuditEventMetadata>
  ): Promise<void>;
}
