/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IActor } from '@vytches-ddd/core';

/**
 * @llm-summary Enumeration of audit action type values
 * @llm-domain Architecture
 * @llm-usage Frequent
 *
 * @description
 * AuditActionType enum implementing architectural component for audit action type operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: AuditActionType = AuditActionType.VALUE;
 * ```
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
 * @llm-summary Enumeration of audit status values
 * @llm-domain Architecture
 * @llm-usage Frequent
 *
 * @description
 * AuditStatus enum implementing architectural component for audit status operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: AuditStatus = AuditStatus.VALUE;
 * ```
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
 * @llm-summary Contract for audit event metadata functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * AuditEventMetadata interface implementing architectural component for audit event metadata operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAuditEventMetadata implements IAuditEventMetadata {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAuditEventMetadata {
  /** Unikalny identyfikator eventu */
  eventId?: string;

  /** Kiedy event został utworzony */
  timestamp?: Date;

  /** ID korelacji dla powiązanych eventów */
  correlationId?: string;

  /** ID eventu, który spowodował ten event */
  causationId?: string;

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

  /** Aktor, który wykonał operację */
  actor?: IActor;

  /** Właściciel zasobu, którego dotyczy operacja */
  owner?: IActor;

  /** Identyfikator zasobu, którego dotyczy operacja */
  resourceId?: string;

  /** Typ zasobu, którego dotyczy operacja */
  resourceType?: string;

  /** Previous state captured for audit purposes */
  _previousState?: unknown;

  /** Dodatkowe metadane specyficzne dla aplikacji */
  [key: string]: unknown;
}

/**
 * @llm-summary Contract for audit event functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * AuditEvent interface implementing architectural component for audit event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAuditEvent implements IAuditEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IAuditEvent<P = unknown> {
  /** Typ eventu */
  eventType: string;

  /** Dane eventu */
  payload?: P;

  /** Metadane */
  metadata?: IAuditEventMetadata;
}

/**
 * @llm-summary Contract for domain to audit event transformer functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * DomainToAuditEventTransformer interface implementing architectural component for domain to audit event transformer operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDomainToAuditEventTransformer implements IDomainToAuditEventTransformer {
 *   // Implementation
 * }
 * ```
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
 * @llm-summary Contract for audit event filter functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * AuditEventFilter interface implementing architectural component for audit event filter operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAuditEventFilter implements IAuditEventFilter {
 *   // Implementation
 * }
 * ```
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
 * @llm-summary Contract for audit service functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * AuditService interface implementing architectural component for audit service operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAuditService implements IAuditService {
 *   // Implementation
 * }
 * ```
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
