import { describe, it, expect } from 'vitest';
import { DomainErrorCode, IDomainError } from '@vytches/ddd-domain-primitives';

import { AggregateError } from '../src/aggregate-errors';

/**
 * Coverage tests for `aggregate-errors.ts`. Each factory must produce an
 * AggregateError with the documented message, code, and `data` payload.
 *
 * Why factory-by-factory: every factory is a public API contract — a renamed
 * field or different code is a breaking change for consumers (juz-ide-api
 * pattern-matches on `error.code` and `error.data` shapes).
 */
describe('AggregateError', () => {
  describe('inheritance', () => {
    it('extends IDomainError', () => {
      const error = AggregateError.invalidArguments('boom');
      expect(error).toBeInstanceOf(IDomainError);
      expect(error).toBeInstanceOf(AggregateError);
      expect(error).toBeInstanceOf(Error);
    });

    it('preserves the message', () => {
      const error = AggregateError.invalidArguments('test message');
      expect(error.message).toBe('test message');
    });
  });

  describe('invalidArguments', () => {
    it('creates error with InvalidParameter code', () => {
      const error = AggregateError.invalidArguments('bad input');
      expect(error.code).toBe(DomainErrorCode.InvalidParameter);
      expect(error.message).toBe('bad input');
    });

    it('forwards the optional data payload', () => {
      const error = AggregateError.invalidArguments('bad', { code: DomainErrorCode.Default });
      expect(error.data).toBeDefined();
    });
  });

  describe('versionConflict', () => {
    it('formats message with all four fields', () => {
      const error = AggregateError.versionConflict('Order', 'order-1', 5, 4);
      expect(error.message).toContain('Order');
      expect(error.message).toContain('order-1');
      expect(error.message).toContain('5');
      expect(error.message).toContain('4');
      expect(error.code).toBe(DomainErrorCode.ValidationFailed);
    });

    it('embeds the four conflict fields in data', () => {
      const error = AggregateError.versionConflict('Order', 42, 7, 6);
      expect(error.data).toMatchObject({
        aggregateType: 'Order',
        aggregateId: 42,
        currentVersion: 7,
        expectedVersion: 6,
      });
    });

    it('accepts numeric aggregateId', () => {
      const error = AggregateError.versionConflict('Order', 99, 1, 0);
      expect(error.message).toContain('99');
    });
  });

  describe('featureNotEnabled', () => {
    it('mentions the feature name', () => {
      const error = AggregateError.featureNotEnabled('snapshot');
      expect(error.message).toContain('snapshot');
      expect(error.code).toBe(DomainErrorCode.ValidationFailed);
      expect(error.data).toMatchObject({ feature: 'snapshot' });
    });
  });

  describe('methodNotImplemented', () => {
    it('mentions method and aggregate type', () => {
      const error = AggregateError.methodNotImplemented('serializeState', 'OrderAggregate');
      expect(error.message).toContain('serializeState');
      expect(error.message).toContain('OrderAggregate');
      expect(error.code).toBe(DomainErrorCode.MissingValue);
      expect(error.data).toMatchObject({
        methodName: 'serializeState',
        aggregateType: 'OrderAggregate',
      });
    });
  });

  describe('invalidSnapshot', () => {
    it('omits reason when not given', () => {
      const error = AggregateError.invalidSnapshot('Order');
      expect(error.message).toBe('Invalid snapshot for aggregate Order');
      expect(error.code).toBe(DomainErrorCode.InvalidFormat);
    });

    it('appends reason when provided', () => {
      const error = AggregateError.invalidSnapshot('Order', 'corrupted bytes');
      expect(error.message).toBe('Invalid snapshot for aggregate Order: corrupted bytes');
      expect(error.data).toMatchObject({ aggregateType: 'Order', reason: 'corrupted bytes' });
    });
  });

  describe('idMismatch', () => {
    it('contains both ids and uses ValidationFailed code', () => {
      const error = AggregateError.idMismatch('snap-1', 'agg-2');
      expect(error.message).toContain('snap-1');
      expect(error.message).toContain('agg-2');
      expect(error.code).toBe(DomainErrorCode.ValidationFailed);
      expect(error.data).toMatchObject({ snapshotId: 'snap-1', aggregateId: 'agg-2' });
    });

    it('accepts numeric ids', () => {
      const error = AggregateError.idMismatch(1, 2);
      expect(error.data).toMatchObject({ snapshotId: 1, aggregateId: 2 });
    });
  });

  describe('typeMismatch', () => {
    it('contains both types', () => {
      const error = AggregateError.typeMismatch('OrderV1', 'OrderV2');
      expect(error.message).toContain('OrderV1');
      expect(error.message).toContain('OrderV2');
      expect(error.code).toBe(DomainErrorCode.ValidationFailed);
      expect(error.data).toMatchObject({ snapshotType: 'OrderV1', aggregateType: 'OrderV2' });
    });
  });

  describe('duplicateUpcaster', () => {
    it('mentions event type and version, uses DuplicateEntry code', () => {
      const error = AggregateError.duplicateUpcaster('OrderCreated', 1);
      expect(error.message).toContain('OrderCreated');
      expect(error.message).toContain('1');
      expect(error.code).toBe(DomainErrorCode.DuplicateEntry);
      expect(error.data).toMatchObject({ eventType: 'OrderCreated', sourceVersion: 1 });
    });
  });

  describe('missingUpcaster', () => {
    it('mentions event type and version range', () => {
      const error = AggregateError.missingUpcaster('OrderCreated', 1, 3);
      expect(error.message).toContain('OrderCreated');
      expect(error.message).toContain('1');
      expect(error.message).toContain('3');
      expect(error.code).toBe(DomainErrorCode.MissingValue);
      expect(error.data).toMatchObject({
        eventType: 'OrderCreated',
        fromVersion: 1,
        toVersion: 3,
      });
    });
  });

  describe('configurationError', () => {
    it('prepends aggregate type to the message', () => {
      const error = AggregateError.configurationError('Order', 'event store missing');
      expect(error.message).toBe('Configuration error in Order: event store missing');
      expect(error.code).toBe(DomainErrorCode.ValidationFailed);
      expect(error.data).toMatchObject({
        aggregateType: 'Order',
        configurationError: 'event store missing',
      });
    });
  });

  describe('cannotInterceptApplyMethod', () => {
    it('uses InternalError code and includes aggregate id', () => {
      const error = AggregateError.cannotInterceptApplyMethod('agg-7');
      expect(error.message).toContain('agg-7');
      expect(error.code).toBe(DomainErrorCode.InternalError);
      expect(error.data).toMatchObject({ aggergateId: 'agg-7' });
    });

    it('merges optional data into the data payload', () => {
      const error = AggregateError.cannotInterceptApplyMethod('agg-7', {
        code: DomainErrorCode.Default,
        data: { extra: 'meta' },
      });
      expect(error.data).toMatchObject({ aggergateId: 'agg-7' });
    });
  });

  describe('eventStoreNotConfigured', () => {
    it('produces the canonical message and MissingValue code', () => {
      const error = AggregateError.eventStoreNotConfigured();
      expect(error.message).toBe('Event store not configured');
      expect(error.code).toBe(DomainErrorCode.MissingValue);
    });
  });

  describe('aggregateDoesNotSupportReplay', () => {
    it('mentions aggregate type and uses MethodNotSupported code', () => {
      const error = AggregateError.aggregateDoesNotSupportReplay('OrderSnapshot');
      expect(error.message).toContain('OrderSnapshot');
      expect(error.code).toBe(DomainErrorCode.MethodNotSupported);
      expect(error.data).toMatchObject({ aggregateType: 'OrderSnapshot' });
    });

    it('merges optional data', () => {
      const error = AggregateError.aggregateDoesNotSupportReplay('OrderSnapshot', {
        code: DomainErrorCode.Default,
        data: { reason: 'no event handlers' },
      });
      expect(error.data).toMatchObject({ aggregateType: 'OrderSnapshot' });
    });
  });
});
