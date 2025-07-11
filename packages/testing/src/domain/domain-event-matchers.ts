import type { IExtendedDomainEvent, IEventMetadata } from '@vytches-ddd/contracts';
import { Logger } from '@vytches-ddd/logging';

/**
 * Event matching options for flexible assertions
 */
export interface EventMatchOptions {
  /** Match event type exactly */
  exactType?: boolean;
  /** Match payload partially or exactly */
  partialPayload?: boolean;
  /** Match metadata fields */
  metadata?: Partial<IEventMetadata>;
  /** Ignore specific fields in comparison */
  ignoreFields?: string[];
  /** Custom matcher function */
  customMatcher?: (event: IExtendedDomainEvent) => boolean;
  /** Case-sensitive matching for strings */
  caseSensitive?: boolean;
  /** Deep equality check for objects */
  deepEqual?: boolean;
}

/**
 * Event assertion result with detailed information
 */
export interface EventMatchResult {
  /** Whether the event matches the criteria */
  matches: boolean;
  /** Detailed reason if match failed */
  reason?: string | undefined;
  /** Score indicating how close the match was (0-1) */
  score: number;
  /** Matched event if any */
  matchedEvent?: IExtendedDomainEvent | undefined;
  /** Additional context about the match */
  context?: Record<string, unknown>;
}

/**
 * Complex event pattern for advanced matching
 */
export interface EventPattern {
  /** Pattern name for debugging */
  name: string;
  /** Event type pattern (supports wildcards) */
  eventType: string | RegExp;
  /** Expected payload shape */
  payload?: any;
  /** Metadata requirements */
  metadata?: Partial<IEventMetadata>;
  /** Ordering requirements */
  order?: {
    /** Must come after these event types */
    after?: string[];
    /** Must come before these event types */
    before?: string[];
    /** Exact position in sequence */
    position?: number;
  };
  /** Timing constraints */
  timing?: {
    /** Maximum time between this and previous event */
    maxDelay?: number;
    /** Minimum time between this and previous event */
    minDelay?: number;
    /** Must occur within time window */
    timeWindow?: { start: Date; end: Date };
  };
  /** Custom validation function */
  validator?: (event: IExtendedDomainEvent, context: EventMatchingContext) => boolean;
}

/**
 * Context for event matching with historical information
 */
export interface EventMatchingContext {
  /** All events being analyzed */
  allEvents: IExtendedDomainEvent[];
  /** Current event index */
  currentIndex: number;
  /** Previously matched events */
  matchedEvents: IExtendedDomainEvent[];
  /** Aggregate information if available */
  aggregate?: {
    id: string;
    type: string;
    version: number;
  };
}

/**
 * Comprehensive Domain Event Matchers for Testing
 *
 * Provides sophisticated event assertion utilities for DDD testing scenarios.
 * Supports pattern matching, temporal assertions, payload validation, and complex
 * event sequence analysis.
 *
 * Key Features:
 * - Flexible event matching with partial/exact comparisons
 * - Pattern-based event sequence validation
 * - Temporal event analysis (timing, ordering)
 * - Metadata and payload deep inspection
 * - Aggregate-aware event validation
 * - Custom matcher functions
 * - Detailed assertion reporting
 *
 * Usage Examples:
 * ```typescript
 * const matcher = new DomainEventMatchers();
 *
 * // Basic event matching
 * expect(matcher.hasEvent(events, 'OrderCreated')).toBe(true);
 *
 * // Payload matching
 * expect(matcher.hasEventWithPayload(events, 'OrderCreated', { customerId: '123' })).toBe(true);
 *
 * // Pattern matching
 * const pattern: EventPattern = {
 *   name: 'Order Processing Flow',
 *   eventType: /Order(Created|Updated)/,
 *   payload: { customerId: expect.any(String) },
 *   order: { after: ['CustomerValidated'] }
 * };
 * expect(matcher.matchesPattern(events, pattern)).toBe(true);
 *
 * // Sequence validation
 * expect(matcher.hasEventSequence(events, ['OrderCreated', 'PaymentProcessed', 'OrderShipped'])).toBe(true);
 * ```
 */
export class DomainEventMatchers {
  private logger: ReturnType<typeof Logger.forContext>;

  constructor() {
    this.logger = Logger.forContext('DomainEventMatchers');
  }

  // ==========================================
  // BASIC EVENT MATCHING
  // ==========================================

  /**
   * Check if events contain an event of specific type
   */
  hasEvent(
    events: IExtendedDomainEvent[],
    eventType: string,
    options: EventMatchOptions = {}
  ): boolean {
    const result = this.findEvent(events, eventType, options);
    return result.matches;
  }

  /**
   * Find first event matching the criteria
   */
  findEvent(
    events: IExtendedDomainEvent[],
    eventType: string,
    options: EventMatchOptions = {}
  ): EventMatchResult {
    this.logger.debug('Finding event', {
      eventType,
      eventCount: events.length,
      options,
    });

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;
      const result = this.matchEvent(event, eventType, undefined, options);

      if (result.matches) {
        this.logger.debug('Event found', {
          eventType: event.eventType,
          eventId: (event as any).eventId || 'unknown',
          index: i,
        });

        return {
          ...result,
          matchedEvent: event,
          context: { index: i, totalEvents: events.length },
        };
      }
    }

    return {
      matches: false,
      reason: `No event of type '${eventType}' found in ${events.length} events`,
      score: 0,
    };
  }

  /**
   * Find all events matching the criteria
   */
  findAllEvents(
    events: IExtendedDomainEvent[],
    eventType: string,
    options: EventMatchOptions = {}
  ): IExtendedDomainEvent[] {
    const matchedEvents: IExtendedDomainEvent[] = [];

    for (const event of events) {
      const result = this.matchEvent(event, eventType, undefined, options);
      if (result.matches) {
        matchedEvents.push(event);
      }
    }

    this.logger.debug('Found multiple events', {
      eventType,
      matchedCount: matchedEvents.length,
      totalEvents: events.length,
    });

    return matchedEvents;
  }

  /**
   * Count events of specific type
   */
  countEvents(
    events: IExtendedDomainEvent[],
    eventType: string,
    options: EventMatchOptions = {}
  ): number {
    return this.findAllEvents(events, eventType, options).length;
  }

  // ==========================================
  // PAYLOAD MATCHING
  // ==========================================

  /**
   * Check if events contain an event with specific payload
   */
  hasEventWithPayload(
    events: IExtendedDomainEvent[],
    eventType: string,
    expectedPayload: any,
    options: EventMatchOptions = {}
  ): boolean {
    const result = this.findEventWithPayload(events, eventType, expectedPayload, options);
    return result.matches;
  }

  /**
   * Find event with specific payload
   */
  findEventWithPayload(
    events: IExtendedDomainEvent[],
    eventType: string,
    expectedPayload: any,
    options: EventMatchOptions = {}
  ): EventMatchResult {
    this.logger.debug('Finding event with payload', {
      eventType,
      expectedPayload,
      eventCount: events.length,
    });

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;
      const result = this.matchEvent(event, eventType, expectedPayload, options);

      if (result.matches) {
        return {
          ...result,
          matchedEvent: event,
          context: { index: i, totalEvents: events.length },
        };
      }
    }

    return {
      matches: false,
      reason: `No event of type '${eventType}' with matching payload found`,
      score: 0,
    };
  }

  /**
   * Validate payload structure against expected shape
   */
  validatePayloadStructure(
    actualPayload: any,
    expectedStructure: any,
    options: EventMatchOptions = {}
  ): EventMatchResult {
    try {
      const matches = this.comparePayloads(actualPayload, expectedStructure, options);
      return {
        matches,
        score: matches ? 1 : 0,
        reason: matches ? undefined : 'Payload structure mismatch',
      };
    } catch (error) {
      return {
        matches: false,
        score: 0,
        reason: `Payload validation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ==========================================
  // PATTERN MATCHING
  // ==========================================

  /**
   * Check if events match a specific pattern
   */
  matchesPattern(events: IExtendedDomainEvent[], pattern: EventPattern): EventMatchResult {
    this.logger.debug('Matching event pattern', {
      patternName: pattern.name,
      eventCount: events.length,
    });

    const context: EventMatchingContext = {
      allEvents: events,
      currentIndex: 0,
      matchedEvents: [],
    };

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;
      context.currentIndex = i;

      const result = this.matchEventAgainstPattern(event, pattern, context);
      if (result.matches) {
        return {
          ...result,
          matchedEvent: event,
          context: { index: i, pattern: pattern.name },
        };
      }
    }

    return {
      matches: false,
      reason: `No event matching pattern '${pattern.name}' found`,
      score: 0,
    };
  }

  /**
   * Find all events matching a pattern
   */
  findEventsByPattern(
    events: IExtendedDomainEvent[],
    pattern: EventPattern
  ): IExtendedDomainEvent[] {
    const matchedEvents: IExtendedDomainEvent[] = [];
    const context: EventMatchingContext = {
      allEvents: events,
      currentIndex: 0,
      matchedEvents: [],
    };

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;
      context.currentIndex = i;

      const result = this.matchEventAgainstPattern(event, pattern, context);
      if (result.matches) {
        matchedEvents.push(event);
        context.matchedEvents.push(event);
      }
    }

    return matchedEvents;
  }

  // ==========================================
  // SEQUENCE MATCHING
  // ==========================================

  /**
   * Check if events contain a specific sequence of event types
   */
  hasEventSequence(
    events: IExtendedDomainEvent[],
    expectedSequence: string[],
    strict = false
  ): boolean {
    const result = this.findEventSequence(events, expectedSequence, strict);
    return result.matches;
  }

  /**
   * Find event sequence in the events array
   */
  findEventSequence(
    events: IExtendedDomainEvent[],
    expectedSequence: string[],
    strict = false
  ): EventMatchResult {
    this.logger.debug('Finding event sequence', {
      expectedSequence,
      eventCount: events.length,
      strict,
    });

    if (expectedSequence.length === 0) {
      return { matches: true, score: 1 };
    }

    if (events.length < expectedSequence.length) {
      return {
        matches: false,
        reason: `Not enough events: expected ${expectedSequence.length}, got ${events.length}`,
        score: 0,
      };
    }

    let sequenceIndex = 0;
    const matchedIndices: number[] = [];

    for (let i = 0; i < events.length && sequenceIndex < expectedSequence.length; i++) {
      const event = events[i];
      if (!event) continue;
      const expectedType = expectedSequence[sequenceIndex];
      if (!expectedType) continue;

      if (this.matchEventType(event.eventType, expectedType)) {
        matchedIndices.push(i);
        sequenceIndex++;
      } else if (strict) {
        // In strict mode, any non-matching event breaks the sequence
        return {
          matches: false,
          reason: `Sequence broken at index ${i}: expected '${expectedType}', got '${event.eventType}'`,
          score: sequenceIndex / expectedSequence.length,
        };
      }
    }

    const matches = sequenceIndex === expectedSequence.length;
    return {
      matches,
      score: sequenceIndex / expectedSequence.length,
      reason: matches
        ? undefined
        : `Incomplete sequence: found ${sequenceIndex}/${expectedSequence.length} events`,
      context: { matchedIndices, strict },
    };
  }

  /**
   * Validate complex event flow with multiple patterns
   */
  validateEventFlow(events: IExtendedDomainEvent[], patterns: EventPattern[]): EventMatchResult {
    this.logger.debug('Validating event flow', {
      patternCount: patterns.length,
      eventCount: events.length,
    });

    const results: EventMatchResult[] = [];
    let totalScore = 0;

    for (const pattern of patterns) {
      const result = this.matchesPattern(events, pattern);
      results.push(result);
      totalScore += result.score;
    }

    const averageScore = totalScore / patterns.length;
    const allMatched = results.every(r => r.matches);

    return {
      matches: allMatched,
      score: averageScore,
      reason: allMatched ? undefined : 'One or more patterns failed to match',
      context: { results, patterns: patterns.map(p => p.name) },
    };
  }

  // ==========================================
  // TEMPORAL ANALYSIS
  // ==========================================

  /**
   * Check if events occurred within specified time window
   */
  eventsWithinTimeWindow(
    events: IExtendedDomainEvent[],
    startTime: Date,
    endTime: Date
  ): IExtendedDomainEvent[] {
    return events.filter(event => {
      const eventTime = event.metadata?.timestamp;
      return eventTime ? eventTime >= startTime && eventTime <= endTime : false;
    });
  }

  /**
   * Analyze event timing and ordering
   */
  analyzeEventTiming(events: IExtendedDomainEvent[]): {
    totalDuration: number;
    averageInterval: number;
    eventIntervals: number[];
    timeline: Array<{
      event: IExtendedDomainEvent;
      timestamp: Date;
      intervalFromPrevious?: number | undefined;
    }>;
  } {
    if (events.length === 0) {
      return {
        totalDuration: 0,
        averageInterval: 0,
        eventIntervals: [],
        timeline: [],
      };
    }

    // Sort events by occurrence time
    const sortedEvents = [...events].sort(
      (a, b) => (a.metadata?.timestamp?.getTime() || 0) - (b.metadata?.timestamp?.getTime() || 0)
    );

    const timeline: Array<{
      event: IExtendedDomainEvent;
      timestamp: Date;
      intervalFromPrevious?: number | undefined;
    }> = [];
    const intervals: number[] = [];

    for (let i = 0; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      if (!event) continue;
      const timestamp = event.metadata?.timestamp;
      if (!timestamp) continue;

      let intervalFromPrevious: number | undefined;
      if (i > 0) {
        const prevEvent = sortedEvents[i - 1];
        intervalFromPrevious = prevEvent?.metadata?.timestamp
          ? timestamp.getTime() - prevEvent.metadata.timestamp.getTime()
          : 0;
        intervals.push(intervalFromPrevious);
      }

      timeline.push({ event, timestamp, intervalFromPrevious });
    }

    const totalDuration =
      sortedEvents.length > 1
        ? (sortedEvents[sortedEvents.length - 1]?.metadata?.timestamp?.getTime() || 0) -
          (sortedEvents[0]?.metadata?.timestamp?.getTime() || 0)
        : 0;

    const averageInterval =
      intervals.length > 0
        ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
        : 0;

    return {
      totalDuration,
      averageInterval,
      eventIntervals: intervals,
      timeline,
    };
  }

  /**
   * Check if two events occurred within specified time difference
   */
  eventsWithinTimeDifference(
    event1: IExtendedDomainEvent,
    event2: IExtendedDomainEvent,
    maxDifference: number
  ): boolean {
    const timeDiff = Math.abs(
      (event1.metadata?.timestamp?.getTime() || 0) - (event2.metadata?.timestamp?.getTime() || 0)
    );
    return timeDiff <= maxDifference;
  }

  // ==========================================
  // METADATA ANALYSIS
  // ==========================================

  /**
   * Find events with specific metadata
   */
  findEventsByMetadata(
    events: IExtendedDomainEvent[],
    metadataQuery: Partial<IEventMetadata>
  ): IExtendedDomainEvent[] {
    return events.filter(event => {
      if (!event.metadata) return false;
      return this.matchesMetadata(event.metadata, metadataQuery);
    });
  }

  /**
   * Group events by metadata field
   */
  groupEventsByMetadata<K extends keyof IEventMetadata>(
    events: IExtendedDomainEvent[],
    field: K
  ): Map<IEventMetadata[K], IExtendedDomainEvent[]> {
    const groups = new Map<IEventMetadata[K], IExtendedDomainEvent[]>();

    for (const event of events) {
      const value = event.metadata?.[field];
      if (value !== undefined) {
        if (!groups.has(value)) {
          groups.set(value, []);
        }
        groups.get(value)!.push(event);
      }
    }

    return groups;
  }

  /**
   * Analyze event correlation and causation
   */
  analyzeEventCorrelation(events: IExtendedDomainEvent[]): {
    correlationGroups: Map<string, IExtendedDomainEvent[]>;
    causationChains: Array<IExtendedDomainEvent[]>;
    orphanedEvents: IExtendedDomainEvent[];
  } {
    const correlationGroups = new Map<string, IExtendedDomainEvent[]>();
    const causationChains: Array<IExtendedDomainEvent[]> = [];
    const orphanedEvents: IExtendedDomainEvent[] = [];

    // Group by correlation ID
    for (const event of events) {
      const correlationId = event.metadata?.correlationId;
      if (correlationId) {
        if (!correlationGroups.has(correlationId)) {
          correlationGroups.set(correlationId, []);
        }
        correlationGroups.get(correlationId)!.push(event);
      } else {
        orphanedEvents.push(event);
      }
    }

    // Build causation chains
    for (const group of correlationGroups.values()) {
      // Sort by causation relationships or time
      const sortedGroup = group.sort((a, b) => {
        // If causation IDs are available, use them for ordering
        const aCausation = a.metadata?.causationId;
        const bCausation = b.metadata?.causationId;

        if (aCausation && bCausation) {
          return aCausation.localeCompare(bCausation);
        }

        // Fallback to time ordering
        return (a.metadata?.timestamp?.getTime() || 0) - (b.metadata?.timestamp?.getTime() || 0);
      });

      causationChains.push(sortedGroup);
    }

    return {
      correlationGroups,
      causationChains,
      orphanedEvents,
    };
  }

  // ==========================================
  // AGGREGATE-AWARE MATCHING
  // ==========================================

  /**
   * Find events for specific aggregate
   */
  findEventsForAggregate(
    events: IExtendedDomainEvent[],
    aggregateId: string
  ): IExtendedDomainEvent[] {
    return events.filter(event => {
      const eventAggregateId = event.metadata?.aggregateId;
      return eventAggregateId === aggregateId;
    });
  }

  /**
   * Validate aggregate event sequence
   */
  validateAggregateEventSequence(
    events: IExtendedDomainEvent[],
    aggregateId: string,
    expectedSequence: string[]
  ): EventMatchResult {
    const aggregateEvents = this.findEventsForAggregate(events, aggregateId);
    return this.findEventSequence(aggregateEvents, expectedSequence, true);
  }

  /**
   * Analyze aggregate version progression
   */
  analyzeAggregateVersions(
    events: IExtendedDomainEvent[],
    aggregateId: string
  ): {
    versions: number[];
    isSequential: boolean;
    gaps: number[];
    duplicates: number[];
  } {
    const aggregateEvents = this.findEventsForAggregate(events, aggregateId).sort(
      (a, b) => (a.metadata?.timestamp?.getTime() || 0) - (b.metadata?.timestamp?.getTime() || 0)
    );

    const versions = aggregateEvents
      .map(event => event.metadata?.aggregateVersion)
      .filter((version): version is number => typeof version === 'number');

    const gaps: number[] = [];
    const duplicates: number[] = [];
    const versionSet = new Set<number>();

    let isSequential = true;
    let expectedVersion = 1;

    for (const version of versions) {
      if (versionSet.has(version)) {
        duplicates.push(version);
      } else {
        versionSet.add(version);
      }

      if (version !== expectedVersion) {
        isSequential = false;
        if (version > expectedVersion) {
          for (let i = expectedVersion; i < version; i++) {
            gaps.push(i);
          }
        }
      }
      expectedVersion = Math.max(expectedVersion + 1, version + 1);
    }

    return {
      versions,
      isSequential,
      gaps,
      duplicates,
    };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Match individual event against criteria
   */
  private matchEvent(
    event: IExtendedDomainEvent,
    expectedType: string,
    expectedPayload?: any,
    options: EventMatchOptions = {}
  ): EventMatchResult {
    let score = 0;
    const maxScore = expectedPayload !== undefined ? 3 : 2; // Type + metadata + payload (if provided)

    // Match event type
    if (this.matchEventType(event.eventType, expectedType, options)) {
      score++;
    } else {
      return {
        matches: false,
        reason: `Event type mismatch: expected '${expectedType}', got '${event.eventType}'`,
        score: score / maxScore,
      };
    }

    // Match metadata if specified
    if (options.metadata) {
      if (this.matchesMetadata(event.metadata, options.metadata)) {
        score++;
      } else {
        return {
          matches: false,
          reason: 'Metadata mismatch',
          score: score / maxScore,
        };
      }
    } else {
      score++; // Full score for metadata if not specified
    }

    // Match payload if provided
    if (expectedPayload !== undefined) {
      if (this.comparePayloads(event.payload, expectedPayload, options)) {
        score++;
      } else {
        return {
          matches: false,
          reason: 'Payload mismatch',
          score: score / maxScore,
        };
      }
    }

    // Custom matcher
    if (options.customMatcher && !options.customMatcher(event)) {
      return {
        matches: false,
        reason: 'Custom matcher failed',
        score: score / maxScore,
      };
    }

    return {
      matches: score === maxScore,
      score: score / maxScore,
    };
  }

  /**
   * Match event against pattern
   */
  private matchEventAgainstPattern(
    event: IExtendedDomainEvent,
    pattern: EventPattern,
    context: EventMatchingContext
  ): EventMatchResult {
    // Check event type
    if (!this.matchEventTypePattern(event.eventType, pattern.eventType)) {
      return {
        matches: false,
        reason: `Event type '${event.eventType}' doesn't match pattern '${pattern.eventType}'`,
        score: 0,
      };
    }

    // Check payload if specified
    if (
      pattern.payload &&
      !this.comparePayloads(event.payload, pattern.payload, { partialPayload: true })
    ) {
      return {
        matches: false,
        reason: "Payload doesn't match pattern",
        score: 0.3,
      };
    }

    // Check metadata if specified
    if (pattern.metadata && !this.matchesMetadata(event.metadata, pattern.metadata)) {
      return {
        matches: false,
        reason: "Metadata doesn't match pattern",
        score: 0.5,
      };
    }

    // Check ordering constraints
    if (pattern.order && !this.validateOrderConstraints(event, pattern.order, context)) {
      return {
        matches: false,
        reason: 'Order constraints not satisfied',
        score: 0.7,
      };
    }

    // Check timing constraints
    if (pattern.timing && !this.validateTimingConstraints(event, pattern.timing, context)) {
      return {
        matches: false,
        reason: 'Timing constraints not satisfied',
        score: 0.8,
      };
    }

    // Custom validator
    if (pattern.validator && !pattern.validator(event, context)) {
      return {
        matches: false,
        reason: 'Custom validator failed',
        score: 0.9,
      };
    }

    return {
      matches: true,
      score: 1,
    };
  }

  /**
   * Match event type with support for exact and partial matching
   */
  private matchEventType(
    actualType: string,
    expectedType: string,
    options: EventMatchOptions = {}
  ): boolean {
    if (options.exactType !== false) {
      return options.caseSensitive !== false
        ? actualType === expectedType
        : actualType.toLowerCase() === expectedType.toLowerCase();
    }

    return options.caseSensitive !== false
      ? actualType.includes(expectedType)
      : actualType.toLowerCase().includes(expectedType.toLowerCase());
  }

  /**
   * Match event type against pattern (string or regex)
   */
  private matchEventTypePattern(actualType: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(actualType);
    }
    return actualType === pattern;
  }

  /**
   * Compare payloads with flexible options
   */
  private comparePayloads(actual: any, expected: any, options: EventMatchOptions = {}): boolean {
    if (expected === actual) return true;
    if (expected === null && actual === null) return true;
    if (expected === undefined && actual === undefined) return true;
    if (expected == null || actual == null) return expected === actual;

    // Handle Jest expect.any() matchers
    if (
      expected &&
      typeof expected === 'object' &&
      expected.constructor &&
      expected.constructor.name === 'AsymmetricMatcher'
    ) {
      return true; // For expect.any() matchers in tests
    }

    if (options.partialPayload) {
      return this.partialMatch(actual, expected, options);
    }

    if (options.deepEqual !== false) {
      return this.deepEqual(actual, expected, options);
    }

    return actual === expected;
  }

  /**
   * Partial payload matching
   */
  private partialMatch(actual: any, expected: any, options: EventMatchOptions): boolean {
    if (typeof expected !== 'object' || expected === null) {
      return actual === expected;
    }

    if (typeof actual !== 'object' || actual === null) {
      return false;
    }

    for (const key in expected) {
      if (options.ignoreFields?.includes(key)) continue;

      if (!(key in actual)) return false;

      if (!this.partialMatch(actual[key], expected[key], options)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Deep equality comparison
   */
  private deepEqual(a: any, b: any, options: EventMatchOptions): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      const keysA = Object.keys(a).filter(key => !options.ignoreFields?.includes(key));
      const keysB = Object.keys(b).filter(key => !options.ignoreFields?.includes(key));

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key], options)) return false;
      }

      return true;
    }

    return a === b;
  }

  /**
   * Check metadata matching
   */
  private matchesMetadata(actual?: IEventMetadata, expected?: Partial<IEventMetadata>): boolean {
    if (!expected) return true;
    if (!actual) return false;

    for (const key in expected) {
      const expectedValue = expected[key as keyof IEventMetadata];
      const actualValue = actual[key as keyof IEventMetadata];

      if (expectedValue !== actualValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate order constraints
   */
  private validateOrderConstraints(
    _event: IExtendedDomainEvent,
    order: NonNullable<EventPattern['order']>,
    context: EventMatchingContext
  ): boolean {
    const { allEvents, currentIndex } = context;

    // Check position constraint
    if (order.position !== undefined && currentIndex !== order.position) {
      return false;
    }

    // Check 'after' constraints
    if (order.after) {
      const eventsBeforeCurrent = allEvents.slice(0, currentIndex);
      for (const requiredType of order.after) {
        if (!eventsBeforeCurrent.some(e => e.eventType === requiredType)) {
          return false;
        }
      }
    }

    // Check 'before' constraints
    if (order.before) {
      const eventsAfterCurrent = allEvents.slice(currentIndex + 1);
      for (const requiredType of order.before) {
        if (!eventsAfterCurrent.some(e => e.eventType === requiredType)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Validate timing constraints
   */
  private validateTimingConstraints(
    event: IExtendedDomainEvent,
    timing: NonNullable<EventPattern['timing']>,
    context: EventMatchingContext
  ): boolean {
    const eventTime = event.metadata?.timestamp?.getTime() || 0;

    // Check time window
    if (timing.timeWindow) {
      const { start, end } = timing.timeWindow;
      if (eventTime < start.getTime() || eventTime > end.getTime()) {
        return false;
      }
    }

    // Check delays relative to previous event
    if ((timing.minDelay || timing.maxDelay) && context.currentIndex > 0) {
      const previousEvent = context.allEvents[context.currentIndex - 1];
      if (!previousEvent) return true;
      const delay = eventTime - (previousEvent.metadata?.timestamp?.getTime() || 0);

      if (timing.minDelay && delay < timing.minDelay) {
        return false;
      }

      if (timing.maxDelay && delay > timing.maxDelay) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Factory function for creating domain event matchers
 */
export function createDomainEventMatchers(): DomainEventMatchers {
  return new DomainEventMatchers();
}

/**
 * Convenience function for basic event assertions
 */
export function assertEvent(
  events: IExtendedDomainEvent[],
  eventType: string,
  options?: EventMatchOptions
): void {
  const matcher = new DomainEventMatchers();
  const result = matcher.findEvent(events, eventType, options);

  if (!result.matches) {
    throw new Error(`Event assertion failed: ${result.reason}`);
  }
}

/**
 * Convenience function for payload assertions
 */
export function assertEventWithPayload(
  events: IExtendedDomainEvent[],
  eventType: string,
  expectedPayload: any,
  options?: EventMatchOptions
): void {
  const matcher = new DomainEventMatchers();
  const result = matcher.findEventWithPayload(events, eventType, expectedPayload, options);

  if (!result.matches) {
    throw new Error(`Event payload assertion failed: ${result.reason}`);
  }
}

/**
 * Convenience function for sequence assertions
 */
export function assertEventSequence(
  events: IExtendedDomainEvent[],
  expectedSequence: string[],
  strict = false
): void {
  const matcher = new DomainEventMatchers();
  const result = matcher.findEventSequence(events, expectedSequence, strict);

  if (!result.matches) {
    throw new Error(`Event sequence assertion failed: ${result.reason}`);
  }
}
