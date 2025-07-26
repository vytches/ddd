# EntityId Usage Patterns

**Version**: 1.0.0 **Package**: @vytches/ddd-contracts **Complexity**: Basic
**Domain**: Foundation **Patterns**: entity-id, identity-patterns,
factory-methods **Dependencies**: @vytches/ddd-contracts

## Description

EntityId is the fundamental building block for entity identification throughout
the VytchesDDD library. This example shows comprehensive usage patterns
including factory methods, validation, type safety, and best practices.

## Business Context

Every domain entity needs a unique identifier. EntityId provides type-safe,
validated, and consistent identity management across your entire domain model,
supporting multiple ID formats while maintaining architectural integrity.

## Core EntityId Implementation

### Basic EntityId Usage

```typescript
// src/domain/foundation/entity-id-usage.ts
import { EntityId } from '@vytches/ddd-contracts';

// Basic EntityId creation
export class BasicEntityIdUsage {
  // Text-based IDs
  static createTextId(): EntityId<string> {
    const id = EntityId.createText('user-12345');
    console.log('Text ID:', id.getValue()); // "user-12345"
    console.log('Type:', id.getType()); // "text"
    return id;
  }

  // UUID-based IDs
  static createUuidId(): EntityId<string> {
    const id = EntityId.createUuid('550e8400-e29b-41d4-a716-446655440000');
    console.log('UUID ID:', id.getValue());
    console.log('Is UUID type:', id.isType('uuid')); // true
    return id;
  }

  // Auto-generated UUID
  static createRandomUuid(): EntityId<string> {
    const id = EntityId.createWithRandomUUID();
    console.log('Generated UUID:', id.getValue());
    return id;
  }

  // Integer-based IDs
  static createIntegerId(): EntityId<string> {
    const id = EntityId.createInteger(12345);
    console.log('Integer ID:', id.getValue()); // "12345"
    console.log('Type:', id.getType()); // "integer"
    return id;
  }

  // BigInt-based IDs (for very large numbers)
  static createBigIntId(): EntityId<string> {
    const id = EntityId.createBigInt(9007199254740991n);
    console.log('BigInt ID:', id.getValue());
    console.log('Type:', id.getType()); // "bigint"
    return id;
  }
}
```

### Factory Method Patterns

```typescript
// src/domain/users/user-id.ts
export class UserId {
  // Safe factory methods with validation
  static fromUuid(value: string): EntityId<string> {
    try {
      return EntityId.fromUUID(value);
    } catch (error) {
      throw new Error(`Invalid User UUID: ${error.message}`);
    }
  }

  static fromInteger(value: number): EntityId<string> {
    try {
      return EntityId.fromInteger(value);
    } catch (error) {
      throw new Error(`Invalid User ID: ${error.message}`);
    }
  }

  static fromText(value: string): EntityId<string> {
    try {
      return EntityId.fromText(value);
    } catch (error) {
      throw new Error(`Invalid User Text ID: ${error.message}`);
    }
  }

  // Domain-specific factory with business validation
  static createForNewUser(): EntityId<string> {
    return EntityId.createWithRandomUUID();
  }

  static createFromExternalSystem(externalId: string): EntityId<string> {
    // Validate external ID format
    if (!externalId || externalId.length < 3) {
      throw new Error('External ID must be at least 3 characters');
    }

    // Add prefix to distinguish external IDs
    const prefixedId = `ext_${externalId}`;
    return EntityId.createText(prefixedId);
  }
}
```

### EntityId Validation and Comparison

```typescript
// src/domain/foundation/entity-id-operations.ts
export class EntityIdOperations {
  // Equality comparison
  static demonstrateEquality(): void {
    const id1 = EntityId.createText('user-123');
    const id2 = EntityId.createText('user-123');
    const id3 = EntityId.createText('user-456');

    console.log('Same value:', id1.equals(id2)); // true
    console.log('Different value:', id1.equals(id3)); // false

    // Type-aware equality
    const textId = EntityId.createText('123');
    const intId = EntityId.createInteger(123);
    console.log('Same value, different type:', textId.equals(intId)); // false
  }

  // Validation patterns
  static validateEntityIds(ids: EntityId<string>[]): EntityId<string>[] {
    return ids.filter(id => {
      // Basic validation
      if (!id.validate(id.getValue())) {
        console.warn(`Invalid ID: ${id.getValue()}`);
        return false;
      }

      // Type-specific validation
      switch (id.getType()) {
        case 'uuid':
          return this.isValidUuid(id.getValue());
        case 'integer':
          return /^\d+$/.test(id.getValue());
        case 'text':
          return id.getValue().length >= 3;
        default:
          return true;
      }
    });
  }

  private static isValidUuid(value: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  // Serialization patterns
  static demonstrateSerialization(): void {
    const id = EntityId.createUuid('550e8400-e29b-41d4-a716-446655440000');

    // String representation
    const stringValue = id.toString();
    console.log('String:', stringValue);

    // JSON serialization
    const jsonValue = id.toJSON();
    console.log('JSON:', jsonValue);

    // Parse back from JSON
    const parsed = JSON.parse(jsonValue);
    const recreated = new EntityId(parsed.value, parsed.type);
    console.log('Recreated equals original:', id.equals(recreated)); // true
  }
}
```

### Domain Entity Integration

```typescript
// src/domain/users/user.entity.ts
import { EntityId } from '@vytches/ddd-contracts';

export interface UserData {
  email: string;
  name: string;
  createdAt: Date;
}

export class User {
  constructor(
    private readonly _id: EntityId<string>,
    private _data: UserData
  ) {}

  get id(): EntityId<string> {
    return this._id;
  }

  get email(): string {
    return this._data.email;
  }

  get name(): string {
    return this._data.name;
  }

  // Business methods using EntityId
  isSameUser(other: User): boolean {
    return this._id.equals(other._id);
  }

  updateProfile(newData: Partial<UserData>): void {
    this._data = { ...this._data, ...newData };
  }

  // Factory methods
  static create(data: UserData): User {
    const id = EntityId.createWithRandomUUID();
    return new User(id, data);
  }

  static createWithId(id: EntityId<string>, data: UserData): User {
    return new User(id, data);
  }

  static fromExistingData(id: string, data: UserData): User {
    const entityId = EntityId.createText(id);
    return new User(entityId, data);
  }

  // Serialization support
  toPlainObject(): { id: string; data: UserData } {
    return {
      id: this._id.getValue(),
      data: this._data,
    };
  }

  static fromPlainObject(obj: { id: string; data: UserData }): User {
    const entityId = EntityId.createText(obj.id);
    return new User(entityId, obj.data);
  }
}
```

### Repository Patterns with EntityId

```typescript
// src/infrastructure/users/user.repository.ts
export interface IUserRepository {
  findById(id: EntityId<string>): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: EntityId<string>): Promise<void>;
  findByEmail(email: string): Promise<User | null>;
}

export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, User>();

  async findById(id: EntityId<string>): Promise<User | null> {
    // Use string representation for storage key
    const key = id.toString();
    return this.users.get(key) || null;
  }

  async save(user: User): Promise<void> {
    const key = user.id.toString();
    this.users.set(key, user);
  }

  async delete(id: EntityId<string>): Promise<void> {
    const key = id.toString();
    this.users.delete(key);
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  // Utility methods
  async existsById(id: EntityId<string>): Promise<boolean> {
    const key = id.toString();
    return this.users.has(key);
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async count(): Promise<number> {
    return this.users.size;
  }
}
```

### Advanced EntityId Patterns

```typescript
// src/domain/foundation/advanced-entity-id.ts
export class AdvancedEntityIdPatterns {
  // Composite ID pattern for multi-tenant scenarios
  static createTenantScopedId(
    tenantId: string,
    entityId: string
  ): EntityId<string> {
    const compositeId = `${tenantId}:${entityId}`;
    return EntityId.createText(compositeId);
  }

  static parseTenantScopedId(id: EntityId<string>): {
    tenantId: string;
    entityId: string;
  } {
    const parts = id.getValue().split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid tenant-scoped ID format');
    }
    return { tenantId: parts[0], entityId: parts[1] };
  }

  // Hierarchical ID pattern
  static createHierarchicalId(hierarchy: string[]): EntityId<string> {
    const hierarchicalId = hierarchy.join('/');
    return EntityId.createText(hierarchicalId);
  }

  // Typed ID wrapper for domain safety
  static createTypedId<T extends string>(
    value: string,
    type: T
  ): EntityId<string> & { entityType: T } {
    const id = EntityId.createText(value) as EntityId<string> & {
      entityType: T;
    };
    id.entityType = type;
    return id;
  }

  // ID generation with metadata
  static createWithMetadata(
    value: string,
    metadata: Record<string, any>
  ): EntityId<string> & { metadata: Record<string, any> } {
    const id = EntityId.createText(value) as EntityId<string> & {
      metadata: Record<string, any>;
    };
    id.metadata = metadata;
    return id;
  }

  // Batch ID operations
  static validateBatch(ids: EntityId<string>[]): {
    valid: EntityId<string>[];
    invalid: { id: EntityId<string>; reason: string }[];
  } {
    const valid: EntityId<string>[] = [];
    const invalid: { id: EntityId<string>; reason: string }[] = [];

    for (const id of ids) {
      try {
        if (id.validate(id.getValue())) {
          valid.push(id);
        } else {
          invalid.push({ id, reason: 'Failed basic validation' });
        }
      } catch (error) {
        invalid.push({
          id,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { valid, invalid };
  }

  // ID conversion utilities
  static convertToUuid(textId: EntityId<string>): EntityId<string> {
    if (textId.getType() === 'uuid') {
      return textId;
    }

    // Generate deterministic UUID from text (example)
    const text = textId.getValue();
    const hash = this.simpleHash(text);
    const uuid = this.hashToUuid(hash);

    return EntityId.createUuid(uuid);
  }

  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private static hashToUuid(hash: number): string {
    const hex = hash.toString(16).padStart(8, '0');
    return `${hex.substr(0, 8)}-${hex.substr(0, 4)}-4${hex.substr(1, 3)}-8${hex.substr(4, 3)}-${hex}${hex}`;
  }
}
```

## Key Features

- **Type Safety**: Full TypeScript support with generic types
- **Multiple ID Types**: UUID, text, integer, and bigint support
- **Factory Methods**: Safe creation patterns with validation
- **Equality & Comparison**: Type-aware equality checking
- **Serialization**: JSON and string serialization support
- **Validation**: Built-in and custom validation patterns
- **Domain Integration**: Seamless entity and repository integration

## Common Pitfalls

- **Type Mixing**: Don't compare EntityIds of different types expecting equality
- **Direct Construction**: Use factory methods instead of direct constructor
  calls
- **Validation Skipping**: Always validate IDs from external sources
- **Serialization Assumptions**: Remember to preserve type information when
  serializing

## Related Examples

- Foundation Contracts - Core interfaces and patterns
- Event Interfaces - EntityId usage in domain events
- Cross-Package Architecture - EntityId across multiple domains

## Best Practices

- Use specific factory methods (`fromUUID`, `fromInteger`) for type safety
- Implement domain-specific ID classes that wrap EntityId
- Always validate IDs from external sources
- Use meaningful prefixes for text-based IDs
- Consider composite IDs for multi-tenant scenarios
- Implement proper serialization for persistence
