/**
 * Shared seeder types to avoid circular dependencies
 */

import type { Result } from '@vytches/ddd-utils';

/**
 * Base interface for domain objects that can be seeded.
 * This avoids circular dependency with AggregateRoot.
 */
export interface SeedableAggregate {
  readonly id: any;
  commit?(): void;
}

/**
 * Configuration options for DomainSeeder initialization
 */
export interface DomainSeederConfig {
  /** Enable automatic event generation for aggregates */
  enableEvents?: boolean;

  /** Default batch size for streaming operations */
  defaultBatchSize?: number;

  /** Enable performance metrics collection */
  enableMetrics?: boolean;

  /** Seed for reproducible randomization */
  randomSeed?: string | number;

  /** Maximum memory usage limit (in MB) */
  memoryLimit?: number;
}

/**
 * Geographic coordinate for location-aware seeding
 */
export interface GeographicCoordinate {
  lat: number;
  lng: number;
}

/**
 * Geographic context for location-aware scenarios
 */
export interface GeographicContext {
  center: GeographicCoordinate;
  radius: number;
  density?: 'sparse' | 'medium' | 'dense' | 'urban';
  districts?: string[];
}

/**
 * AI provider configuration for enhanced data generation
 */
export interface AIProviderConfig {
  provider: 'openai' | 'claude' | 'custom';
  model?: string;
  context?: string;
  maxTokens?: number;
}

/**
 * Crisis scenario configuration
 */
export interface CrisisConfig {
  type: 'natural-disaster' | 'system-failure' | 'security-breach' | 'market-crash';
  subtype?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggerAt: string;
  duration: string;
  affectedArea?: number;
}

/**
 * Timeline specification for scenario evolution
 */
export interface TimelineSpec {
  duration: string;
  checkpoints?: string[];
  events?: Array<{ at: string; type: string; data?: any }>;
}

/**
 * Type alias for seeding result that may contain errors
 */
export type SeederResult<T> = Result<T, Error>;

/**
 * Base interface for all seeder implementations
 */
export interface ISeeder<T> {
  build(): Promise<SeederResult<T>>;
  buildMany(count: number): Promise<SeederResult<T[]>>;
}

/**
 * Interface for streaming seeder implementations
 */
export interface IStreamingSeeder<T> extends ISeeder<T> {
  stream(count: number, batchSize?: number): AsyncIterable<SeederResult<T>>;
}
