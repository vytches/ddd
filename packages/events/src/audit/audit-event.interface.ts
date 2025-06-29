/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IActor } from '@vytches-ddd/core';

/**
 * Enum dla typów akcji audytowych
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
 * Enum dla statusów operacji audytowej
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
 * Metadata dla eventów audytowych
 * Zawiera dodatkowe informacje istotne dla rejestrowania i analizy działań w systemie
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
  _previousState?: any;

  /** Dodatkowe metadane specyficzne dla aplikacji */
  [key: string]: any;
}

/**
 * Podstawowy interfejs dla eventów audytowych
 * Reprezentuje zapis działania w systemie
 */
export interface IAuditEvent<P = any> {
  /** Typ eventu */
  eventType: string;

  /** Dane eventu */
  payload?: P;

  /** Metadane */
  metadata?: IAuditEventMetadata;
}

/**
 * Interfejs dla transformera eventów domenowych na audytowe
 * Odpowiada za transformację eventów domenowych na eventy audytowe
 */
export interface IDomainToAuditEventTransformer<D = any, A = any> {
  /**
   * Transformuje event domenowy na event audytowy
   * @param domainEvent Event domenowy do transformacji
   * @param additionalMetadata Opcjonalne dodatkowe metadane
   */
  transform(domainEvent: D, additionalMetadata?: Partial<IAuditEventMetadata>): IAuditEvent<A>;
}

/**
 * Interfejs dla filtra eventów audytowych
 * Określa, czy event powinien być przetworzony czy nie
 */
export interface IAuditEventFilter {
  /**
   * Sprawdza, czy event powinien być przetworzony
   * @param event Event audytowy do sprawdzenia
   * @returns True, jeśli event powinien być przetworzony, w przeciwnym razie false
   */
  shouldProcess<T = any>(event: IAuditEvent<T>): boolean;
}

/**
 * Interfejs dla usługi audytu
 * Definiuje metody do rejestrowania zdarzeń audytowych
 */
export interface IAuditService {
  /**
   * Rejestruje zdarzenie audytowe
   * @param event Event audytowy do zarejestrowania
   */
  record<T = any>(event: IAuditEvent<T>): Promise<void>;

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
    data?: any,
    metadata?: Partial<IAuditEventMetadata>
  ): Promise<void>;
}
