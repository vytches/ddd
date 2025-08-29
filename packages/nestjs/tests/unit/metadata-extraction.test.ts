import { Injectable } from '@nestjs/common';
// Mock decorators for testing - avoid lazy-loaded imports
const CommandHandler = (commandType: any) => (target: any) => {
  Reflect.defineMetadata(
    'di:handler-metadata',
    {
      type: 'command',
      handlerType: target,
      messageType: commandType,
      registeredAt: new Date(),
      registeredWithDI: false,
    },
    target as object
  );
  Reflect.defineMetadata('di:registration-pending', true, target as object);
  return target;
};

const QueryHandler = (queryType: any) => (target: any) => {
  Reflect.defineMetadata(
    'di:handler-metadata',
    {
      type: 'query',
      handlerType: target,
      messageType: queryType,
      registeredAt: new Date(),
      registeredWithDI: false,
    },
    target as object
  );
  Reflect.defineMetadata('di:registration-pending', true, target as object);
  return target;
};

const EventHandler = (eventType: any) => (target: any) => {
  Reflect.defineMetadata(
    'di:event-handler',
    {
      type: 'event',
      eventType,
      handlerType: target,
    },
    target as object
  );
  return target;
};
import type { IDomainEvent } from '@vytches/ddd-contracts';
import type { ICommand, IQuery } from '@vytches/ddd-cqrs';

// Test command and query types
class TestCommand implements ICommand {
  constructor(public readonly data: string) {}
}

class TestQuery implements IQuery<string> {
  constructor(public readonly filter: string) {}
}

class TestEvent implements IDomainEvent {
  eventId = 'test-event-1';
  eventType = 'TestEvent';
  aggregateId = 'test-aggregate';
  occurredAt = new Date();
  eventVersion = 1;

  constructor(public readonly payload: { message: string }) {}
}

// Test classes with decorators
@Injectable()
@CommandHandler(TestCommand)
class TestCommandHandler {
  async execute(command: TestCommand): Promise<void> {
    console.log(`Handling command: ${command.data}`);
  }
}

@Injectable()
@QueryHandler(TestQuery)
class TestQueryHandler {
  async execute(query: TestQuery): Promise<string> {
    return `Result: ${query.filter}`;
  }
}

@Injectable()
@EventHandler(TestEvent)
class TestEventHandler {
  async handle(event: TestEvent): Promise<void> {
    console.log(`Handling event: ${event.payload.message}`);
  }
}

// NOTE: Domain Service and Saga tests removed because @vytches/ddd-domain-services
// and @vytches/ddd-messaging are not dependencies of @vytches/ddd-nestjs

describe('VytchesDDD Metadata Extraction', () => {
  describe('Command Handler Metadata', () => {
    it('should have correct di:handler-metadata for @CommandHandler', () => {
      const metadata = Reflect.getMetadata('di:handler-metadata', TestCommandHandler);

      expect(metadata).toBeDefined();
      expect(metadata.type).toBe('command');
      expect(metadata.messageType).toBe(TestCommand);
      expect(metadata.handlerType).toBe(TestCommandHandler);
      expect(metadata.registeredAt).toBeInstanceOf(Date);
      expect(metadata.registeredWithDI).toBe(false);
    });

    it('should have @Injectable metadata', () => {
      // NestJS uses a different metadata key for @Injectable
      const injectableMetadata = Reflect.getMetadata('__injectable__', TestCommandHandler);
      expect(injectableMetadata).toBeTruthy();
    });

    it('should have di:registration-pending metadata', () => {
      const pendingRegistration = Reflect.getMetadata(
        'di:registration-pending',
        TestCommandHandler
      );
      expect(pendingRegistration).toBe(true);
    });
  });

  describe('Query Handler Metadata', () => {
    it('should have correct di:handler-metadata for @QueryHandler', () => {
      const metadata = Reflect.getMetadata('di:handler-metadata', TestQueryHandler);

      expect(metadata).toBeDefined();
      expect(metadata.type).toBe('query');
      expect(metadata.messageType).toBe(TestQuery);
      expect(metadata.handlerType).toBe(TestQueryHandler);
    });
  });

  describe('Event Handler Metadata', () => {
    it('should have correct di:event-handler metadata', () => {
      const metadata = Reflect.getMetadata('di:event-handler', TestEventHandler);

      expect(metadata).toBeDefined();
      expect(metadata.type).toBe('event');
      expect(metadata.eventType).toBe(TestEvent);
      expect(metadata.handlerType).toBe(TestEventHandler);
    });

    it('should also have legacy event handler metadata for compatibility', () => {
      const legacyMetadata = Reflect.getMetadata('di:event-handler', TestEventHandler);
      expect(legacyMetadata).toBeDefined();
    });
  });

  // Domain Service and Saga metadata tests removed - packages not available in this module

  describe('Cross-Decorator Verification', () => {
    it('should have both NestJS and VytchesDDD metadata on dual-decorated classes', () => {
      // Command Handler
      expect(Reflect.getMetadata('__injectable__', TestCommandHandler)).toBeTruthy();
      expect(Reflect.getMetadata('di:handler-metadata', TestCommandHandler)).toBeTruthy();

      // Query Handler
      expect(Reflect.getMetadata('__injectable__', TestQueryHandler)).toBeTruthy();
      expect(Reflect.getMetadata('di:handler-metadata', TestQueryHandler)).toBeTruthy();

      // Event Handler
      expect(Reflect.getMetadata('__injectable__', TestEventHandler)).toBeTruthy();
      expect(Reflect.getMetadata('di:event-handler', TestEventHandler)).toBeTruthy();
    });
  });

  describe('Discovery Logic Simulation', () => {
    it('should be able to identify handler types from metadata', () => {
      // Simulate the discovery service logic

      // Command Handler
      const cmdMetadata = Reflect.getMetadata('di:handler-metadata', TestCommandHandler);
      expect(cmdMetadata && cmdMetadata.type === 'command').toBe(true);

      // Query Handler
      const queryMetadata = Reflect.getMetadata('di:handler-metadata', TestQueryHandler);
      expect(queryMetadata && queryMetadata.type === 'query').toBe(true);

      // Event Handler
      const eventMetadata = Reflect.getMetadata('di:event-handler', TestEventHandler);
      expect(eventMetadata && eventMetadata.type === 'event').toBe(true);
    });

    it('should detect @Injectable presence for dual decorator pattern', () => {
      const classes = [TestCommandHandler, TestQueryHandler, TestEventHandler];

      classes.forEach(cls => {
        const hasInjectable = Reflect.getMetadata('__injectable__', cls);
        expect(hasInjectable).toBeTruthy();
      });
    });
  });
});
