import { describe, it, expect, beforeEach } from 'vitest';
import type { IStoredDomainEvent } from '@vytches-ddd/contracts';
import { InMemoryEventStore, EventStoreConcurrencyError, StreamNotFoundError, StreamDeletedError } from '../src';

describe('InMemoryEventStore', () => {
  let eventStore: InMemoryEventStore;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
  });

  describe('appendToStream', () => {
    it('should append events to a new stream', async () => {
      const streamId = 'test-stream-1';
      const events: IStoredDomainEvent[] = [
        {
          eventId: '1',
          eventType: 'TestEvent',
          aggregateId: 'agg-1',
          aggregateType: 'TestAggregate',
          aggregateVersion: 1,
          timestamp: new Date(),
          payload: { data: 'test' },
          metadata: {},
        },
      ];

      const result = await eventStore.appendToStream(streamId, events);

      expect(result.streamId).toBe(streamId);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(0);
      expect(result.events).toBe(1);
      expect(result.position).toBe(0n);
    });

    it('should append multiple events maintaining order', async () => {
      const streamId = 'test-stream-2';
      const events: IStoredDomainEvent[] = [
        {
          eventId: '1',
          eventType: 'Event1',
          aggregateId: 'agg-1',
          aggregateType: 'TestAggregate',
          aggregateVersion: 1,
          timestamp: new Date(),
          payload: { order: 1 },
          metadata: {},
        },
        {
          eventId: '2',
          eventType: 'Event2',
          aggregateId: 'agg-1',
          aggregateType: 'TestAggregate',
          aggregateVersion: 2,
          timestamp: new Date(),
          payload: { order: 2 },
          metadata: {},
        },
      ];

      await eventStore.appendToStream(streamId, events);
      const stream = await eventStore.readStream(streamId);

      expect(stream.events).toHaveLength(2);
      expect((stream.events[0]?.payload as any)?.order).toBe(1);
      expect((stream.events[1]?.payload as any)?.order).toBe(2);
    });

    it('should enforce optimistic concurrency control', async () => {
      const streamId = 'test-stream-3';
      const event: IStoredDomainEvent = {
        eventId: '1',
        eventType: 'TestEvent',
        aggregateId: 'agg-1',
        aggregateType: 'TestAggregate',
        aggregateVersion: 1,
        timestamp: new Date(),
        payload: {},
        metadata: {},
      };

      // First append succeeds
      await eventStore.appendToStream(streamId, [event], -1);

      // Second append with wrong version fails
      await expect(
        eventStore.appendToStream(streamId, [event], -1)
      ).rejects.toThrow(EventStoreConcurrencyError);
    });

    it('should allow appending without version check', async () => {
      const streamId = 'test-stream-4';
      const event: IStoredDomainEvent = {
        eventId: '1',
        eventType: 'TestEvent',
        aggregateId: 'agg-1',
        aggregateType: 'TestAggregate',
        aggregateVersion: 1,
        timestamp: new Date(),
        payload: {},
        metadata: {},
      };

      await eventStore.appendToStream(streamId, [event]);
      await eventStore.appendToStream(streamId, [event]); // Should succeed

      const stream = await eventStore.readStream(streamId);
      expect(stream.events).toHaveLength(2);
    });

    it('should throw error when appending to deleted stream', async () => {
      const streamId = 'test-stream-5';
      const event: IStoredDomainEvent = {
        eventId: '1',
        eventType: 'TestEvent',
        aggregateId: 'agg-1',
        aggregateType: 'TestAggregate',
        aggregateVersion: 1,
        timestamp: new Date(),
        payload: {},
        metadata: {},
      };

      await eventStore.appendToStream(streamId, [event]);
      await eventStore.deleteStream(streamId);

      await expect(
        eventStore.appendToStream(streamId, [event])
      ).rejects.toThrow(StreamDeletedError);
    });
  });

  describe('readStream', () => {
    beforeEach(async () => {
      const events: IStoredDomainEvent[] = Array.from({ length: 10 }, (_, i) => ({
        eventId: `${i}`,
        eventType: 'TestEvent',
        aggregateId: 'agg-1',
        aggregateType: 'TestAggregate',
        aggregateVersion: i,
        timestamp: new Date(),
        payload: { index: i },
        metadata: {},
      }));

      await eventStore.appendToStream('test-stream', events);
    });

    it('should read all events from stream', async () => {
      const stream = await eventStore.readStream('test-stream');

      expect(stream.streamId).toBe('test-stream');
      expect(stream.events).toHaveLength(10);
      expect(stream.fromVersion).toBe(0);
      expect(stream.lastVersion).toBe(9);
      expect(stream.isEndOfStream).toBe(true);
    });

    it('should read events from specific version', async () => {
      const stream = await eventStore.readStream('test-stream', { fromVersion: 5 });

      expect(stream.events).toHaveLength(5);
      expect(stream?.events?.[0]?.streamVersion).toBe(5);
      expect(stream.lastVersion).toBe(9);
    });

    it('should limit number of events returned', async () => {
      const stream = await eventStore.readStream('test-stream', { maxCount: 3 });

      expect(stream.events).toHaveLength(3);
      expect(stream.isEndOfStream).toBe(false);
      expect(stream.nextVersion).toBe(3);
    });

    it('should read events in backward direction', async () => {
      const stream = await eventStore.readStream('test-stream', {
        direction: 'backward',
        maxCount: 3,
      });

      expect(stream.events).toHaveLength(3);
      expect(stream.events?.[0]?.streamVersion).toBe(9);
      expect(stream.events?.[1]?.streamVersion).toBe(8);
      expect(stream.events?.[2]?.streamVersion).toBe(7);
    });

    it('should throw error for non-existent stream', async () => {
      await expect(
        eventStore.readStream('non-existent')
      ).rejects.toThrow(StreamNotFoundError);
    });
  });

  describe('readAll', () => {
    beforeEach(async () => {
      // Add events to multiple streams
      for (let stream = 0; stream < 3; stream++) {
        const events: IStoredDomainEvent[] = Array.from({ length: 5 }, (_, i) => ({
          eventId: `${stream}-${i}`,
          eventType: i % 2 === 0 ? 'EvenEvent' : 'OddEvent',
          aggregateId: `agg-${stream}`,
          aggregateType: 'TestAggregate',
          aggregateVersion: i,
          timestamp: new Date(),
          payload: { stream, index: i },
          metadata: {},
        }));

        await eventStore.appendToStream(`stream-${stream}`, events);
      }
    });

    it('should read all events globally', async () => {
      const result = await eventStore.readAll();

      expect(result.events).toHaveLength(15);
      expect(result.fromPosition).toBe(0n);
      expect(result.isEndOfStream).toBe(true);
    });

    it('should filter by event type', async () => {
      const result = await eventStore.readAll({
        filterByEventType: ['EvenEvent'],
      });

      expect(result.events).toHaveLength(9); // 3 streams * 3 even events
      expect(result.events.every((e: any) => e.eventType === 'EvenEvent')).toBe(true);
    });

    it('should filter by stream prefix', async () => {
      const result = await eventStore.readAll({
        filterByStreamPrefix: 'stream-1',
      });

      expect(result.events).toHaveLength(5);
      expect(result.events.every((e: any) => e.streamId === 'stream-1')).toBe(true);
    });

    it('should read from specific position', async () => {
      const result = await eventStore.readAll({
        fromPosition: 10n,
      });

      expect(result.events).toHaveLength(5);
      expect(result.events?.[0]?.position).toBeGreaterThanOrEqual(10n);
    });

    it('should read in backward direction', async () => {
      const result = await eventStore.readAll({
        direction: 'backward',
        maxCount: 5,
      });

      expect(result.events).toHaveLength(5);
      // Check that positions are decreasing
      for (let i = 1; i < result.events.length; i++) {
        expect(result.events?.[i]?.position).toBeLessThan(result.events?.[i - 1]?.position as any);
      }
    });
  });

  describe('snapshots', () => {
    it('should save and retrieve snapshot', async () => {
      const streamId = 'test-stream';
      const snapshot = {
        aggregateId: 'agg-1',
        aggregateType: 'TestAggregate',
        version: 5,
        timestamp: new Date(),
        state: { data: 'test' },
      };

      await eventStore.appendToStream(streamId, [
        {
          eventId: '1',
          eventType: 'TestEvent',
          aggregateId: 'agg-1',
          aggregateType: 'TestAggregate',
          aggregateVersion: 1,
          timestamp: new Date(),
          payload: {},
          metadata: {},
        },
      ]);

      await eventStore.saveSnapshot(streamId, snapshot);
      const retrieved = await eventStore.getSnapshot(streamId);

      expect(retrieved).toEqual(snapshot);
    });

    it('should return null for non-existent snapshot', async () => {
      const snapshot = await eventStore.getSnapshot('non-existent');
      expect(snapshot).toBeNull();
    });

    it('should throw error when saving snapshot to non-existent stream', async () => {
      const snapshot = {
        aggregateId: 'agg-1',
        aggregateType: 'TestAggregate',
        version: 5,
        timestamp: new Date(),
        state: {},
      };

      await expect(
        eventStore.saveSnapshot('non-existent', snapshot)
      ).rejects.toThrow(StreamNotFoundError);
    });
  });

  describe('stream management', () => {
    it('should check if stream exists', async () => {
      const streamId = 'test-stream';

      expect(await eventStore.streamExists(streamId)).toBe(false);

      await eventStore.appendToStream(streamId, [
        {
          eventId: '1',
          eventType: 'TestEvent',
          aggregateId: 'agg-1',
          aggregateType: 'TestAggregate',
          aggregateVersion: 1,
          timestamp: new Date(),
          payload: {},
          metadata: {},
        },
      ]);

      expect(await eventStore.streamExists(streamId)).toBe(true);
    });

    it('should get stream version', async () => {
      const streamId = 'test-stream';

      expect(await eventStore.getStreamVersion(streamId)).toBe(-1);

      await eventStore.appendToStream(streamId, [
        {
          eventId: '1',
          eventType: 'TestEvent',
          aggregateId: 'agg-1',
          aggregateType: 'TestAggregate',
          aggregateVersion: 1,
          timestamp: new Date(),
          payload: {},
          metadata: {},
        },
      ]);

      expect(await eventStore.getStreamVersion(streamId)).toBe(0);
    });

    it('should delete stream', async () => {
      const streamId = 'test-stream';

      await eventStore.appendToStream(streamId, [
        {
          eventId: '1',
          eventType: 'TestEvent',
          aggregateId: 'agg-1',
          aggregateType: 'TestAggregate',
          aggregateVersion: 1,
          timestamp: new Date(),
          payload: {},
          metadata: {},
        },
      ]);

      await eventStore.deleteStream(streamId);

      expect(await eventStore.streamExists(streamId)).toBe(false);
      await expect(eventStore.readStream(streamId)).rejects.toThrow(StreamNotFoundError);
    });

    it('should get and set stream metadata', async () => {
      const streamId = 'test-stream';

      await eventStore.setStreamMetadata(streamId, {
        customMetadata: { key: 'value' },
      });

      const metadata = await eventStore.getStreamMetadata(streamId);

      expect(metadata).toBeTruthy();
      expect(metadata?.customMetadata).toEqual({ key: 'value' });
    });
  });

  describe('connection management', () => {
    it('should handle connection state', async () => {
      expect(eventStore.isConnected()).toBe(true);

      await eventStore.disconnect();
      expect(eventStore.isConnected()).toBe(false);

      await expect(
        eventStore.appendToStream('test', [])
      ).rejects.toThrow('Event store is not connected');

      await eventStore.connect();
      expect(eventStore.isConnected()).toBe(true);
    });

    it('should clear all data', async () => {
      await eventStore.appendToStream('stream-1', [
        {
          eventId: '1',
          eventType: 'TestEvent',
          aggregateId: 'agg-1',
          aggregateType: 'TestAggregate',
          aggregateVersion: 1,
          timestamp: new Date(),
          payload: {},
          metadata: {},
        },
      ]);

      await eventStore.clear();

      expect(await eventStore.streamExists('stream-1')).toBe(false);
      const allEvents = await eventStore.readAll();
      expect(allEvents.events).toHaveLength(0);
    });
  });
});
