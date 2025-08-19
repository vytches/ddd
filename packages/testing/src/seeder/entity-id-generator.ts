/**
 * Utilities for generating proper EntityId instances using the factory methods
 * from @vytches/ddd-value-objects. Supports various generation strategies
 * including sequential, UUID, and custom patterns.
 */

import { faker } from '@faker-js/faker';
import type { EntityId } from '@vytches/ddd-contracts';

/**
 * Configuration for EntityId generation patterns
 */
export interface EntityIdPattern {
  /** Base prefix for the ID */
  prefix?: string;

  /** Suffix for the ID */
  suffix?: string;

  /** Separator between parts */
  separator?: string;

  /** Include timestamp component */
  includeTimestamp?: boolean;

  /** Include random component */
  includeRandom?: boolean;

  /** Custom template with placeholders */
  template?: string;
}

/**
 * Sequential counter management for predictable ID generation
 */
class SequenceCounter {
  private static counters: Map<string, number> = new Map();

  static get(key: string): number {
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + 1);
    return current + 1;
  }

  static reset(key?: string): void {
    if (key) {
      this.counters.delete(key);
    } else {
      this.counters.clear();
    }
  }

  static peek(key: string): number {
    return this.counters.get(key) ?? 0;
  }
}

/**
 * Utility class for generating EntityId instances with various strategies.
 *
 * This generator provides multiple strategies for creating EntityIds that
 * are appropriate for different testing scenarios:
 * - UUID-based for realistic production-like IDs
 * - Sequential for predictable test scenarios
 * - Pattern-based for domain-specific ID formats
 * - Custom strategies for specialized requirements
 */
export class EntityIdGenerator {
  /**
   * Generates a UUID-based EntityId using the proper factory method.
   *
   * @returns New EntityId with random UUID
   *
   * @example
   * ```typescript
   * const userId = EntityIdGenerator.uuid();
   * console.log(userId.toString()); // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
   * ```
   */
  static uuid(): EntityId {
    // Import dynamically to avoid circular dependencies
    const { EntityId: EntityIdImpl } = require('@vytches/ddd-value-objects');
    return EntityIdImpl.createWithRandomUUID();
  }

  /**
   * Generates a text-based EntityId with optional custom value.
   *
   * @param value Optional custom text value (generates random if not provided)
   * @returns New EntityId with text value
   *
   * @example
   * ```typescript
   * const customId = EntityIdGenerator.text('user-123');
   * const randomId = EntityIdGenerator.text(); // Generates random text ID
   * ```
   */
  static text(value?: string): EntityId {
    const { EntityId: EntityIdImpl } = require('@vytches/ddd-value-objects');
    const textValue = value ?? `id_${faker.string.alphanumeric(8)}`;
    return EntityIdImpl.fromText(textValue);
  }

  /**
   * Generates a sequential EntityId with a base prefix.
   *
   * @param prefix Base prefix for the sequential ID
   * @param padding Number of digits for zero-padding (default: 3)
   * @returns New EntityId with sequential number
   *
   * @example
   * ```typescript
   * const user1 = EntityIdGenerator.sequential('user'); // "user-001"
   * const user2 = EntityIdGenerator.sequential('user'); // "user-002"
   * const order1 = EntityIdGenerator.sequential('order', 5); // "order-00001"
   * ```
   */
  static sequential(prefix: string, padding = 3): EntityId {
    const { EntityId: EntityIdImpl } = require('@vytches/ddd-value-objects');
    const sequence = SequenceCounter.get(prefix);
    const paddedSequence = String(sequence).padStart(padding, '0');
    const textValue = `${prefix}-${paddedSequence}`;
    return EntityIdImpl.fromText(textValue);
  }

  /**
   * Generates an EntityId based on a pattern template.
   *
   * Supported placeholders:
   * - {{uuid}} - Full UUID
   * - {{uuid:8}} - First 8 characters of UUID
   * - {{sequence}} - Sequential number
   * - {{sequence:4}} - Sequential number with 4-digit padding
   * - {{timestamp}} - Unix timestamp
   * - {{date}} - YYYY-MM-DD format
   * - {{year}} - Current year
   * - {{month}} - Current month (01-12)
   * - {{random:6}} - Random alphanumeric string of specified length
   * - {{faker:word}} - Faker.js word
   *
   * @param template Template string with placeholders
   * @param context Optional context for sequential counting
   * @returns New EntityId based on pattern
   *
   * @example
   * ```typescript
   * // Order IDs with year and sequence
   * const orderId = EntityIdGenerator.pattern('ORDER-{{year}}-{{sequence:4}}');
   * // Result: "ORDER-2025-0001"
   *
   * // User IDs with random component
   * const userId = EntityIdGenerator.pattern('USER-{{random:6}}');
   * // Result: "USER-A1B2C3"
   *
   * // Event IDs with timestamp
   * const eventId = EntityIdGenerator.pattern('EVENT-{{timestamp}}-{{uuid:8}}');
   * // Result: "EVENT-1706123456-a1b2c3d4"
   * ```
   */
  static pattern(template: string, context = 'default'): EntityId {
    const { EntityId: EntityIdImpl } = require('@vytches/ddd-value-objects');

    let result = template;
    const now = new Date();

    // Replace placeholders
    result = result.replace(/\{\{uuid(?::(\d+))?\}\}/g, (_, length) => {
      const uuid = faker.string.uuid();
      return length ? uuid.substring(0, parseInt(length || '36')) : uuid;
    });

    result = result.replace(/\{\{sequence(?::(\d+))?\}\}/g, (_, padding) => {
      const sequence = SequenceCounter.get(context);
      return padding ? String(sequence).padStart(parseInt(padding || '0'), '0') : String(sequence);
    });

    result = result.replace(/\{\{timestamp\}\}/g, () => String(Math.floor(now.getTime() / 1000)));
    result = result.replace(
      /\{\{date\}\}/g,
      () => now.toISOString().split('T')[0] || now.toISOString().substring(0, 10)
    );
    result = result.replace(/\{\{year\}\}/g, () => String(now.getFullYear()));
    result = result.replace(/\{\{month\}\}/g, () => String(now.getMonth() + 1).padStart(2, '0'));

    result = result.replace(/\{\{random:(\d+)\}\}/g, (_, length) => {
      return faker.string.alphanumeric(parseInt(length || '6')).toUpperCase();
    });

    result = result.replace(/\{\{faker:(\w+)\}\}/g, (_, method) => {
      // Simple faker method calls
      switch (method) {
        case 'word':
          return faker.lorem.word();
        case 'city':
          return faker.location.city();
        case 'country':
          return faker.location.countryCode();
        default:
          return faker.lorem.word();
      }
    });

    return EntityIdImpl.fromText(result);
  }

  /**
   * Generates an EntityId using a custom pattern configuration.
   *
   * @param pattern Pattern configuration object
   * @param context Optional context for sequential counting
   * @returns New EntityId based on configuration
   *
   * @example
   * ```typescript
   * const orderId = EntityIdGenerator.fromPattern({
   *   prefix: 'ORDER',
   *   includeTimestamp: true,
   *   includeRandom: true,
   *   separator: '-'
   * });
   * // Result: "ORDER-1706123456-A1B2C3"
   * ```
   */
  static fromPattern(pattern: EntityIdPattern, context = 'default'): EntityId {
    const { EntityId: EntityIdImpl } = require('@vytches/ddd-value-objects');

    const parts: string[] = [];
    const separator = pattern.separator ?? '-';

    // Add prefix
    if (pattern.prefix) {
      parts.push(pattern.prefix);
    }

    // Add timestamp component
    if (pattern.includeTimestamp) {
      parts.push(String(Math.floor(Date.now() / 1000)));
    }

    // Add random component
    if (pattern.includeRandom) {
      parts.push(faker.string.alphanumeric(6).toUpperCase());
    }

    // Add suffix
    if (pattern.suffix) {
      parts.push(pattern.suffix);
    }

    // If template is provided, use pattern method
    if (pattern.template) {
      return EntityIdGenerator.pattern(pattern.template, context);
    }

    // If no parts, generate UUID
    if (parts.length === 0) {
      return EntityIdGenerator.uuid();
    }

    const textValue = parts.join(separator);
    return EntityIdImpl.fromText(textValue);
  }

  /**
   * Generates multiple EntityIds using the specified strategy.
   *
   * @param count Number of EntityIds to generate
   * @param strategy Generation strategy function
   * @returns Array of generated EntityIds
   *
   * @example
   * ```typescript
   * // Generate 10 UUID-based EntityIds
   * const uuids = EntityIdGenerator.many(10, () => EntityIdGenerator.uuid());
   *
   * // Generate 5 sequential user IDs
   * const users = EntityIdGenerator.many(5, () => EntityIdGenerator.sequential('user'));
   *
   * // Generate 3 pattern-based order IDs
   * const orders = EntityIdGenerator.many(3, () =>
   *   EntityIdGenerator.pattern('ORDER-{{year}}-{{sequence:4}}')
   * );
   * ```
   */
  static many(count: number, strategy: () => EntityId): EntityId[] {
    const results: EntityId[] = [];
    for (let i = 0; i < count; i++) {
      results.push(strategy());
    }
    return results;
  }

  /**
   * Resets sequential counters for clean test scenarios.
   *
   * @param context Optional specific context to reset (resets all if not provided)
   *
   * @example
   * ```typescript
   * // Reset all counters
   * EntityIdGenerator.resetCounters();
   *
   * // Reset specific context
   * EntityIdGenerator.resetCounters('user');
   * ```
   */
  static resetCounters(context?: string): void {
    SequenceCounter.reset(context);
  }

  /**
   * Gets the current counter value for a context.
   *
   * @param context Context name to check
   * @returns Current counter value
   */
  static getCounterValue(context: string): number {
    return SequenceCounter.peek(context);
  }

  /**
   * Generates EntityIds for common domain scenarios.
   * Provides convenient presets for typical business domains.
   */
  static readonly presets = {
    /**
     * User-related EntityId generators
     */
    users: {
      /** Standard user ID: USER-001, USER-002, etc. */
      standard: (): EntityId => EntityIdGenerator.sequential('USER', 3),

      /** Admin user ID: ADMIN-YYYY-001 */
      admin: (): EntityId => EntityIdGenerator.pattern('ADMIN-{{year}}-{{sequence:3}}'),

      /** Customer ID: CUST-{{random:6}} */
      customer: (): EntityId => EntityIdGenerator.pattern('CUST-{{random:6}}'),

      /** Guest user ID: GUEST-{{timestamp}} */
      guest: (): EntityId => EntityIdGenerator.pattern('GUEST-{{timestamp}}'),
    },

    /**
     * Order-related EntityId generators
     */
    orders: {
      /** Standard order ID: ORDER-2025-0001 */
      standard: (): EntityId => EntityIdGenerator.pattern('ORDER-{{year}}-{{sequence:4}}'),

      /** Draft order ID: DRAFT-{{random:8}} */
      draft: (): EntityId => EntityIdGenerator.pattern('DRAFT-{{random:8}}'),

      /** Subscription order: SUB-{{year}}{{month}}-{{sequence:3}} */
      subscription: (): EntityId =>
        EntityIdGenerator.pattern('SUB-{{year}}{{month}}-{{sequence:3}}'),

      /** Return order: RET-{{uuid:12}} */
      return: (): EntityId => EntityIdGenerator.pattern('RET-{{uuid:12}}'),
    },

    /**
     * Product-related EntityId generators
     */
    products: {
      /** Standard product ID: PROD-001 */
      standard: (): EntityId => EntityIdGenerator.sequential('PROD', 3),

      /** SKU-based ID: SKU-{{random:6}}-{{sequence:2}} */
      sku: (): EntityId => EntityIdGenerator.pattern('SKU-{{random:6}}-{{sequence:2}}'),

      /** Category-based: CAT-{{faker:word}}-{{sequence:3}} */
      category: (): EntityId => EntityIdGenerator.pattern('CAT-{{faker:word}}-{{sequence:3}}'),
    },

    /**
     * Event-related EntityId generators
     */
    events: {
      /** Domain event: EVT-{{timestamp}}-{{uuid:8}} */
      domain: (): EntityId => EntityIdGenerator.pattern('EVT-{{timestamp}}-{{uuid:8}}'),

      /** Integration event: INT-{{date}}-{{sequence:4}} */
      integration: (): EntityId => EntityIdGenerator.pattern('INT-{{date}}-{{sequence:4}}'),

      /** Audit event: AUDIT-{{year}}{{month}}-{{sequence:5}} */
      audit: (): EntityId => EntityIdGenerator.pattern('AUDIT-{{year}}{{month}}-{{sequence:5}}'),
    },
  };
}
