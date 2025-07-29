# AggregateRoot Class Methods

**Package**: `@vytches/ddd-aggregates`  
**Class**: `AggregateRoot`  
**File**: `src/core/aggregate-root.ts`

## Overview

The `AggregateRoot` class is the core domain entity that represents a consistency boundary in Domain-Driven Design. It manages domain events, maintains version control, and provides capability support.

## Constructor

```typescript
constructor(params: IAggregateConstructorParams<TId>)
```

Creates a new AggregateRoot instance with the specified ID and optional version.

## Core Methods

### Identity & Versioning

#### `getId(): EntityId<TId>`
- **Purpose**: Get the aggregate's unique identifier
- **Returns**: The aggregate's EntityId
- **Example**: `const id = aggregate.getId();`

#### `getVersion(): number`
- **Purpose**: Get the current version of the aggregate
- **Returns**: Current version number (incremented with changes)
- **Example**: `const version = aggregate.getVersion();`

#### `getInitialVersion(): number`
- **Purpose**: Get the version when the aggregate was loaded/created
- **Returns**: Initial version number
- **Example**: `const initialVersion = aggregate.getInitialVersion();`

#### `hasChanges(): boolean`
- **Purpose**: Check if the aggregate has uncommitted changes
- **Returns**: `true` if there are uncommitted domain events
- **Example**: `if (aggregate.hasChanges()) { /* save changes */ }`

### Domain Events

#### `getDomainEvents(): ReadonlyArray<IExtendedDomainEvent>`
- **Purpose**: Get all uncommitted domain events
- **Returns**: Read-only array of domain events
- **Example**: `const events = aggregate.getDomainEvents();`

#### `commit(): void`
- **Purpose**: Mark all domain events as committed and clear the events list
- **Returns**: `void`
- **Example**: `aggregate.commit(); // After saving to repository`

### Protected Methods (for subclasses)

#### `apply<P>(eventType: string, payload: P, metadata?: IEventMetadata): void`
- **Purpose**: Apply a domain event to the aggregate
- **Parameters**: 
  - `eventType`: The type of event
  - `payload`: Event data
  - `metadata`: Optional event metadata
- **Example**: `this.apply('UserRegistered', { email: user.email });`

#### `registerEventHandler<T>(eventType: string, handler: IAggregateEventHandler<T>): this`
- **Purpose**: Register an event handler for a specific event type
- **Parameters**:
  - `eventType`: The event type to handle
  - `handler`: Function to handle the event
- **Returns**: `this` (for chaining)
- **Example**: `this.registerEventHandler('UserRegistered', this.handleUserRegistered);`

### Capabilities

#### `withCapability<T extends Capability & IAggregateCapability>(capability: T): this`
- **Purpose**: Add a capability to the aggregate
- **Parameters**: `capability` - The capability to add
- **Returns**: `this` (for chaining)
- **Example**: `aggregate.withCapability(new SnapshotCapability());`

#### `getCapability<T extends Capability>(type: CapabilityConstructor<T>): T | undefined`
- **Purpose**: Get a specific capability from the aggregate
- **Parameters**: `type` - The capability constructor
- **Returns**: The capability instance or undefined
- **Example**: `const snapshot = aggregate.getCapability(SnapshotCapability);`

#### `hasCapability<T extends Capability>(type: CapabilityConstructor<T>): boolean`
- **Purpose**: Check if the aggregate has a specific capability
- **Parameters**: `type` - The capability constructor
- **Returns**: `true` if the capability exists
- **Example**: `if (aggregate.hasCapability(SnapshotCapability)) { /* use snapshot */ }`

## Usage Example

```typescript
import { AggregateRoot, EntityId } from '@vytches/ddd-aggregates';

class UserAggregate extends AggregateRoot<string> {
  private email: string;
  private name: string;

  constructor(params: { id: EntityId<string>; email: string; name: string }) {
    super({ id: params.id });
    this.email = params.email;
    this.name = params.name;
  }

  static create(data: { email: string; name: string }): UserAggregate {
    const id = EntityId.createWithRandomUUID();
    const user = new UserAggregate({ id, ...data });
    
    // Apply domain event
    user.apply('UserCreated', {
      userId: id.getValue(),
      email: data.email,
      name: data.name
    });
    
    return user;
  }

  updateEmail(newEmail: string): void {
    if (this.email !== newEmail) {
      this.email = newEmail;
      this.apply('UserEmailUpdated', {
        userId: this.getId().getValue(),
        oldEmail: this.email,
        newEmail
      });
    }
  }
}

// Usage
const user = UserAggregate.create({
  email: 'user@example.com',
  name: 'John Doe'
});

console.log(user.getId().getValue()); // UUID string
console.log(user.hasChanges()); // true
console.log(user.getDomainEvents().length); // 1

user.commit(); // Clear events after saving
console.log(user.hasChanges()); // false
```

## Notes

- The `AggregateRoot` class is abstract in behavior - you should extend it to create domain-specific aggregates
- Always call `commit()` after successfully persisting the aggregate to clear domain events
- Use `apply()` to generate domain events that represent state changes
- The version is automatically incremented when domain events are applied