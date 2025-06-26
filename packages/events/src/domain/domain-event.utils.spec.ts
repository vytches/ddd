import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LibUtils } from "@vytches-ddd/utils";
import { createDomainEvent } from '@vytches-ddd/contracts';


describe('createDomainEvent', () => {
  beforeEach(() => {
    // Reset mock before each test
    vi.clearAllMocks();
    // Reset Date mock if it was modified
    vi.restoreAllMocks();
  });

  it('should create a domain event with the given type and payload', () => {
    // Arrange
    const eventType = 'TestEvent';
    const payload = { data: 'test data' };

    // Act
    const event = createDomainEvent(eventType, payload);

    // Assert
    expect(event.eventType).toBe(eventType);
    expect(event.payload).toEqual(payload);
  });

  it('should generate basic metadata with UUID and timestamp', () => {
    // Arrange
    const eventType = 'TestEvent';
    const payload = { data: 'test data' };
    const mockDate = new Date('2023-01-01T00:00:00Z');

    // Mock Date constructor to return a fixed date
    vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    // Act
    const event = createDomainEvent(eventType, payload);

    // Assert
    expect(event.metadata).toBeDefined();
    expect(event?.metadata?.eventId).toBeTypeOf('string');
    expect(event?.metadata?.timestamp).toEqual(mockDate);
  });

  it('should merge provided metadata with default metadata', () => {
    // Arrange
    const correlationId = LibUtils.getUUID();
    const eventType = 'TestEvent';
    const payload = { data: 'test data' };
    const customMetadata = {
      correlationId,
      userId: 'user-456',
      customField: 'custom value',
    };

    // Act
    const event = createDomainEvent(eventType, payload, customMetadata);

    // Assert
    expect(event.metadata).toMatchObject({
      eventId: expect.any(String),
      correlationId,
      userId: 'user-456',
      customField: 'custom value',
    });
  });

  it('should not override provided eventId if present in metadata', () => {
    // Arrange
    const eventType = 'TestEvent';
    const payload = { data: 'test data' };
    const customMetadata = {
      eventId: 'custom-event-id',
    };

    // Act
    const event = createDomainEvent(eventType, payload, customMetadata);

    // Assert
    expect(event?.metadata?.eventId).toBe('custom-event-id');
  });

  it('should create a domain event with null payload', () => {
    // Arrange
    const eventType = 'TestEvent';
    const payload = null;

    // Act
    const event = createDomainEvent(eventType, payload);

    // Assert
    expect(event.eventType).toBe(eventType);
    expect(event.payload).toBeNull();
    expect(event.metadata).toBeDefined();
  });
});
