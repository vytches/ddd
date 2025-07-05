/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Service lifetime enumeration for DI integration
 */
export type ServiceLifetime = 'transient' | 'singleton' | 'scoped';

/**
 * DI decorator options interface
 */
export interface DIDecoratorOptions {
  /** Service lifetime for DI registration */
  lifetime?: ServiceLifetime;
  
  /** Context for scoped services */
  context?: string;
  
  /** Tags for service organization */
  tags?: string[];
  
  /** Whether to auto-register with DI container (default: true) */
  autoRegister?: boolean;
}

/**
 * Options for EventHandler decorator with DI integration
 */
export interface EventHandlerOptions extends DIDecoratorOptions {
  /** Whether handler is active */
  active?: boolean;

  /** Available from version */
  availableFrom?: string;

  /** Handler priority (higher = earlier execution) */
  priority?: number;

  /** Additional metadata */
  [key: string]: any;
}

/**
 * DI Handler metadata stored by enhanced decorators
 */
export interface DIHandlerMetadata {
  /** Handler type identifier */
  type: 'event';
  
  /** Event type constructor */
  eventType: new (...args: any[]) => any;
  
  /** Handler constructor */
  handlerType: new (...args: any[]) => any;
  
  /** DI options from decorator */
  options: EventHandlerOptions;
  
  /** Registration timestamp */
  registeredAt: Date;
  
  /** Whether registered with DI container */
  registeredWithDI: boolean;
}