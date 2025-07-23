# Basic Aggregate Root - User Management

**Version**: 1.0.0 **Package**: @vytches-ddd/aggregates **Complexity**: Basic
**Domain**: User Management **Patterns**: Aggregate Root, Domain Events,
Invariant Protection **Dependencies**: @vytches-ddd/aggregates,
@vytches-ddd/domain-primitives, @vytches-ddd/contracts

## Description

This example demonstrates a basic aggregate root implementation for user
management. The aggregate enforces business rules, maintains consistency, and
emits domain events for state changes.

## Business Context

A user management system needs to maintain user profiles with strict business
rules: unique usernames, valid email formats, and activity tracking. The
aggregate ensures all invariants are protected and changes are properly recorded
through domain events.

## Code Example

```typescript
// user.aggregate.ts
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { DomainEvent } from '@vytches-ddd/contracts';
import { BaseError, EntityId } from '@vytches-ddd/domain-primitives';
import { UserData, CreateUserData, UpdateUserData } from './types'; // From your application

// Domain Events
export class UserCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly username: string
  ) {
    super();
  }
}

export class UserUpdatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly changes: Partial<UserData>
  ) {
    super();
  }
}

export class UserDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly reason: string
  ) {
    super();
  }
}

// Domain Errors
export class InvalidUserDataError extends BaseError {
  constructor(message: string) {
    super('INVALID_USER_DATA', message);
  }
}

export class UserAlreadyDeactivatedError extends BaseError {
  constructor(userId: string) {
    super('USER_ALREADY_DEACTIVATED', `User ${userId} is already deactivated`);
  }
}

// User Aggregate Root
export class UserAggregate extends AggregateRoot {
  private email: string;
  private username: string;
  private firstName: string;
  private lastName: string;
  private phoneNumber?: string;
  private isActive: boolean;
  private createdAt: Date;
  private updatedAt: Date;

  // Private constructor enforces factory method usage
  private constructor(id: EntityId) {
    super(id);
    this.isActive = true;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  // ⭐ Factory method for creating new users
  static create(data: CreateUserData): UserAggregate {
    const user = new UserAggregate(EntityId.generate());

    // Validate invariants
    user.validateEmail(data.email);
    user.validateUsername(data.username);
    user.validateName(data.firstName, data.lastName);

    // Set initial state
    user.email = data.email.toLowerCase();
    user.username = data.username.toLowerCase();
    user.firstName = data.firstName;
    user.lastName = data.lastName;
    user.phoneNumber = data.phoneNumber;

    // Emit domain event
    user.addDomainEvent(
      new UserCreatedEvent(user.id.value, user.email, user.username)
    );

    return user;
  }

  // ⭐ Reconstitute from persistence
  static fromSnapshot(id: EntityId, data: UserData): UserAggregate {
    const user = new UserAggregate(id);

    user.email = data.email;
    user.username = data.username;
    user.firstName = data.firstName;
    user.lastName = data.lastName;
    user.phoneNumber = data.phoneNumber;
    user.isActive = data.isActive;
    user.createdAt = data.createdAt;
    user.updatedAt = data.updatedAt;

    // Important: Don't emit events when reconstituting
    user.markAsHydrated();

    return user;
  }

  // ⭐ Business operations
  updateProfile(data: UpdateUserData): void {
    this.ensureActive();

    const changes: Partial<UserData> = {};

    if (data.email && data.email !== this.email) {
      this.validateEmail(data.email);
      this.email = data.email.toLowerCase();
      changes.email = this.email;
    }

    if (data.firstName && data.firstName !== this.firstName) {
      this.validateName(data.firstName, this.lastName);
      this.firstName = data.firstName;
      changes.firstName = this.firstName;
    }

    if (data.lastName && data.lastName !== this.lastName) {
      this.validateName(this.firstName, data.lastName);
      this.lastName = data.lastName;
      changes.lastName = this.lastName;
    }

    if (data.phoneNumber !== undefined) {
      this.phoneNumber = data.phoneNumber;
      changes.phoneNumber = this.phoneNumber;
    }

    if (Object.keys(changes).length > 0) {
      this.updatedAt = new Date();
      this.addDomainEvent(new UserUpdatedEvent(this.id.value, changes));
    }
  }

  deactivate(reason: string): void {
    if (!this.isActive) {
      throw new UserAlreadyDeactivatedError(this.id.value);
    }

    this.isActive = false;
    this.updatedAt = new Date();

    this.addDomainEvent(new UserDeactivatedEvent(this.id.value, reason));
  }

  reactivate(): void {
    if (this.isActive) {
      return; // Already active, no action needed
    }

    this.isActive = true;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new UserUpdatedEvent(this.id.value, { isActive: true })
    );
  }

  // ⭐ Invariant protection methods
  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new InvalidUserDataError('Invalid email format');
    }
  }

  private validateUsername(username: string): void {
    if (!username || username.length < 3) {
      throw new InvalidUserDataError('Username must be at least 3 characters');
    }

    if (username.length > 30) {
      throw new InvalidUserDataError('Username must not exceed 30 characters');
    }

    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      throw new InvalidUserDataError(
        'Username can only contain letters, numbers, underscores and hyphens'
      );
    }
  }

  private validateName(firstName: string, lastName: string): void {
    if (!firstName || firstName.trim().length === 0) {
      throw new InvalidUserDataError('First name is required');
    }

    if (!lastName || lastName.trim().length === 0) {
      throw new InvalidUserDataError('Last name is required');
    }

    if (firstName.length > 50 || lastName.length > 50) {
      throw new InvalidUserDataError('Names must not exceed 50 characters');
    }
  }

  private ensureActive(): void {
    if (!this.isActive) {
      throw new BaseError(
        'USER_INACTIVE',
        'Cannot perform operations on inactive user'
      );
    }
  }

  // ⭐ State accessors
  toSnapshot(): UserData {
    return {
      id: this.id.value,
      email: this.email,
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName,
      phoneNumber: this.phoneNumber,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get isUserActive(): boolean {
    return this.isActive;
  }

  get userEmail(): string {
    return this.email;
  }

  get userName(): string {
    return this.username;
  }
}

// Usage example
export function createUserExample(): void {
  // Create a new user
  const user = UserAggregate.create({
    email: 'john.doe@example.com',
    username: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
  });

  console.log('User created:', user.id.value);
  console.log('Full name:', user.fullName);
  console.log('Domain events:', user.getUncommittedEvents());

  // Update user profile
  user.updateProfile({
    email: 'john.doe@newdomain.com',
    firstName: 'Jonathan',
  });

  console.log('Updated user:', user.toSnapshot());
  console.log('New events:', user.getUncommittedEvents());

  // Deactivate user
  user.deactivate('Account suspension due to policy violation');

  // Try to update deactivated user (will throw error)
  try {
    user.updateProfile({ lastName: 'Smith' });
  } catch (error) {
    console.error('Expected error:', error.message);
  }

  // Commit events (mark as handled)
  user.markEventsAsCommitted();
  console.log('Uncommitted events after commit:', user.getUncommittedEvents());
}
```

## Key Features

- **Factory Method Pattern**: `create()` enforces valid initial state
- **Invariant Protection**: Business rules validated before state changes
- **Domain Events**: All state changes emit appropriate events
- **Encapsulation**: Private constructor prevents invalid instantiation
- **Snapshot Support**: `toSnapshot()` and `fromSnapshot()` for persistence
- **Error Handling**: Domain-specific errors for clear failure reasons

## Business Rules Enforced

1. **Email Validation**: Must be valid email format
2. **Username Constraints**: 3-30 characters, alphanumeric with
   underscores/hyphens
3. **Name Requirements**: First and last names required, max 50 characters
4. **Activity Status**: Inactive users cannot be modified
5. **Idempotency**: Reactivating active users is safe (no-op)

## Common Pitfalls

- **Forgetting to emit events**: Always emit domain events for state changes
- **Event emission on reconstitution**: Don't emit events in `fromSnapshot()`
- **Public constructors**: Use factory methods to ensure valid state
- **Missing invariant checks**: Validate all business rules before changes

## Related Examples

- [Order Aggregate with State Machine](./example-2.md)
- [Product Inventory Aggregate](./example-3.md)
- [Event Sourced Aggregate](../intermediate/example-1.md)
