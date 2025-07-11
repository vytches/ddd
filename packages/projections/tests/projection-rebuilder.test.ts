import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectionRebuilder } from '../src/projection-rebuilder';

describe('ProjectionRebuilder', () => {
  let eventStore: any;
  let projectionEngine: any;
  let projectionStore: any;
  let eventReplay: any;
  let rebuilder: ProjectionRebuilder<any>;

  const mockReplayResult = {
    eventsReplayed: 100,
    eventsFailed: 0,
    eventsSkipped: 0,
    duration: 1000,
    averageSpeed: 100,
    errors: [],
    finalProgress: {
      totalEvents: 100,
      processedEvents: 100,
      skippedEvents: 0,
      failedEvents: 0,
      currentPosition: 100n,
      percentComplete: 100,
      eventsPerSecond: 100,
      startTime: new Date(),
      lastUpdate: new Date(),
    },
    success: true,
  };

  beforeEach(() => {
    // Mock event replay
    eventReplay = {
      replayFromStream: vi.fn().mockResolvedValue(mockReplayResult),
      replayAll: vi.fn().mockResolvedValue(mockReplayResult),
      replayWithFilter: vi.fn().mockResolvedValue(mockReplayResult),
      getEventsAsIterable: vi.fn(),
    };

    // Mock event store
    eventStore = {
      appendToStream: vi.fn(),
      readStream: vi.fn(),
      readAll: vi.fn(),
      deleteStream: vi.fn(),
      getStreamMetadata: vi.fn(),
      setStreamMetadata: vi.fn(),
      createEventReplay: vi.fn().mockReturnValue(eventReplay),
      createAdvancedEventReplay: vi.fn(),
      createSnapshot: vi.fn(),
      loadSnapshot: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as any;

    // Mock projection engine
    projectionEngine = {
      getProjectionName: vi.fn().mockReturnValue('TestProjection'),
      getEventTypes: vi.fn().mockReturnValue(['EventA', 'EventB']),
      processEvent: vi.fn().mockResolvedValue(undefined),
      isInterestedIn: vi.fn().mockReturnValue(true),
      getState: vi.fn(),
      reset: vi.fn(),
      addCapability: vi.fn(),
      getCapability: vi.fn(),
      hasCapability: vi.fn(),
      removeCapability: vi.fn(),
      rebuild: vi.fn(),
    };

    // Mock projection store
    projectionStore = {
      load: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      deleteAll: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn(),
    };

    rebuilder = new ProjectionRebuilder(eventStore, projectionEngine, projectionStore);
  });

  describe('rebuild', () => {
    it('should rebuild projection from all events', async () => {
      const filter = { eventTypes: ['EventA'] };
      const config = { clearBeforeReplay: true, skipErrors: false };

      const result = await rebuilder.rebuild(filter, config);

      expect(projectionStore.deleteAll).toHaveBeenCalled();
      expect(eventStore.createEventReplay).toHaveBeenCalled();
      expect(eventReplay.replayAll).toHaveBeenCalled();
      expect(result).toEqual(mockReplayResult);
    });

    it('should filter events by projection event types', async () => {
      await rebuilder.rebuild();

      const [handler, filter] = (eventReplay.replayAll as any).mock.calls[0];
      expect(filter.eventTypes).toEqual(['EventA', 'EventB']);
    });

    it('should not clear state if clearBeforeReplay is false', async () => {
      const config = { clearBeforeReplay: false };

      await rebuilder.rebuild(undefined, config);

      expect(projectionStore.deleteAll).not.toHaveBeenCalled();
    });

    it('should handle event processing errors when skipErrors is true', async () => {
      const error = new Error('Processing failed');
      projectionEngine.processEvent = vi.fn().mockRejectedValueOnce(error);

      const testEvent = {
        eventId: '1',
        eventType: 'EventA',
        aggregateId: 'agg-1',
        eventTimestamp: new Date(),
        eventVersion: 1,
        payload: {},
        metadata: {},
      };

      await rebuilder.rebuild(undefined, { skipErrors: true });

      const [handler] = (eventReplay.replayAll as any).mock.calls[0];
      await expect(handler(testEvent)).resolves.toBeUndefined();
    });

    it('should propagate event processing errors when skipErrors is false', async () => {
      const error = new Error('Processing failed');
      projectionEngine.processEvent = vi.fn().mockRejectedValueOnce(error);

      const testEvent = {
        eventId: '1',
        eventType: 'EventA',
        aggregateId: 'agg-1',
        eventTimestamp: new Date(),
        eventVersion: 1,
        payload: {},
        metadata: {},
      };

      await rebuilder.rebuild(undefined, { skipErrors: false });

      const [handler] = (eventReplay.replayAll as any).mock.calls[0];
      await expect(handler(testEvent)).rejects.toThrow(error);
    });
  });

  describe('rebuildFromStream', () => {
    it('should rebuild projection from specific stream', async () => {
      const streamId = 'stream-1';
      const filter = { fromStreamVersion: 1 };
      const config = { skipErrors: true };

      const result = await rebuilder.rebuildFromStream(streamId, filter, config);

      expect(eventStore.createEventReplay).toHaveBeenCalled();
      expect(eventReplay.replayFromStream).toHaveBeenCalledWith(
        streamId,
        expect.any(Function),
        filter,
        config
      );
      expect(result).toEqual(mockReplayResult);
    });
  });

  describe('rebuildMany', () => {
    it('should rebuild multiple projections', async () => {
      const projection2 = {
        ...projectionEngine,
        getProjectionName: vi.fn().mockReturnValue('Projection2'),
      };
      const projections = [projectionEngine, projection2];

      const results = await rebuilder.rebuildMany(projections);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockReplayResult);
      expect(results[1]).toEqual(mockReplayResult);
    });

    it('should continue on error when skipErrors is true', async () => {
      const projection2 = {
        ...projectionEngine,
        getProjectionName: vi.fn().mockReturnValue('Projection2'),
      };
      const projections = [projectionEngine, projection2];

      // Make first rebuild fail
      eventReplay.replayAll = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(mockReplayResult);

      const results = await rebuilder.rebuildMany(projections, undefined, { skipErrors: true });

      expect(results).toHaveLength(2);
      expect(results[0]?.success).toBe(false);
      expect(results[1]).toEqual(mockReplayResult);
    });

    it('should stop on error when skipErrors is false', async () => {
      const projection2 = {
        ...projectionEngine,
        getProjectionName: vi.fn().mockReturnValue('Projection2'),
      };
      const projections = [projectionEngine, projection2];

      const error = new Error('Failed to rebuild projection TestProjection');
      eventReplay.replayAll = vi.fn().mockRejectedValueOnce(error);

      await expect(
        rebuilder.rebuildMany(projections, undefined, { skipErrors: false })
      ).rejects.toThrow(error.message);
    });
  });

  describe('clearProjectionState', () => {
    it('should clear projection store', async () => {
      await rebuilder.clearProjectionState();

      expect(projectionStore.deleteAll).toHaveBeenCalled();
    });

    it('should handle clear errors', async () => {
      const error = new Error('Clear failed');
      projectionStore.deleteAll = vi.fn().mockRejectedValue(error);

      await expect(rebuilder.clearProjectionState()).rejects.toThrow(
        'Failed to clear state for projection TestProjection'
      );
    });
  });
});
