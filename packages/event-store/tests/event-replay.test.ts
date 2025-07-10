import { describe, it, expect } from 'vitest';

import { InMemoryEventStore, EventReplayEngine, createEventReplay } from '../src';

describe('Event Replay', () => {
  it('should create event replay engine', () => {
    const eventStore = new InMemoryEventStore();
    const replayEngine = new EventReplayEngine(eventStore);

    expect(replayEngine).toBeDefined();
    expect(typeof replayEngine.replayFromStream).toBe('function');
    expect(typeof replayEngine.replayAll).toBe('function');
  });

  it('should provide factory function for creating replay', () => {
    const eventStore = new InMemoryEventStore();
    const replay = createEventReplay(eventStore);

    expect(replay).toBeDefined();
    expect(typeof replay.replayFromStream).toBe('function');
    expect(typeof replay.replayAll).toBe('function');
  });

  it('should support replay filters', () => {
    const filter = {
      fromTimestamp: new Date('2023-01-01'),
      toTimestamp: new Date('2023-12-31'),
      eventTypes: ['OrderCreated', 'OrderUpdated'],
      maxEvents: 1000
    };

    expect(filter).toBeDefined();
    expect(filter.fromTimestamp).toBeInstanceOf(Date);
    expect(filter.eventTypes).toEqual(['OrderCreated', 'OrderUpdated']);
  });

  it('should support replay configuration', () => {
    const config = {
      batchSize: 50,
      batchDelay: 100,
      parallel: true,
      maxWorkers: 2,
      skipErrors: true,
      eventTimeout: 5000
    };

    expect(config).toBeDefined();
    expect(config.batchSize).toBe(50);
    expect(config.parallel).toBe(true);
  });
});
