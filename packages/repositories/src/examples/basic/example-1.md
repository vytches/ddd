# Generic Repository Pattern - Basic CRUD Operations

**Version**: 1.0.0
**Package**: @vytches-ddd/repositories
**Complexity**: beginner
**Domain**: user-management
**Patterns**: repository-pattern, crud-operations, entity-management
**Dependencies**: @vytches-ddd/repositories, @vytches-ddd/domain-primitives

## Description
Basic repository implementation demonstrating fundamental CRUD operations with the @vytches-ddd/repositories package. Shows entity management, simple queries, and basic persistence operations.

## Business Context
User management system requiring standard create, read, update, and delete operations. Foundation pattern for entity persistence with proper separation between domain and data access concerns.

## Code Example

```typescript
// user-repository.ts
import { BaseRepository } from '@vytches-ddd/repositories';
import { EntityId } from '@vytches-ddd/domain-primitives';
import { User, CreateUserData, UpdateUserData, QueryOptions } from './types'; // From your application

// ✅ FOCUS: Basic repository extending library BaseRepository
export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users'); // Table/collection name
  }

  // ✅ FOCUS: Library CRUD operations
  async createUser(userData: CreateUserData): Promise<User> {
    // Use library create method with validation
    const user = await this.create({
      id: EntityId.generate().value,
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      isActive: true,
      roles: userData.roles || ['user'],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    });
    
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    // Use library findById method
    return await this.findById(EntityId.fromString(id));
  }

  async getUserByEmail(email: string): Promise<User | null> {
    // Use library findOne method with query
    return await this.findOne({
      where: [{ field: 'email', operator: 'eq', value: email }]
    });
  }

  async updateUser(id: string, updates: UpdateUserData): Promise<User | null> {
    // Use library update method
    const updated = await this.update(EntityId.fromString(id), {
      ...updates,
      updatedAt: new Date()
    });
    
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Use library delete method
    return await this.delete(EntityId.fromString(id));
  }

  // ✅ FOCUS: Basic queries with library methods
  async getActiveUsers(): Promise<User[]> {
    return await this.find({
      where: [{ field: 'isActive', operator: 'eq', value: true }],
      orderBy: [{ field: 'createdAt', direction: 'DESC' }]
    });
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await this.find({
      where: [{ field: 'roles', operator: 'in', value: [role] }]
    });
  }

  async getAllUsers(options: QueryOptions = {}): Promise<User[]> {
    // Use library find method with pagination
    return await this.find({
      limit: options.limit || 50,
      offset: options.offset || 0,
      orderBy: options.orderBy || [{ field: 'username', direction: 'ASC' }]
    });
  }

  // ✅ FOCUS: Count operations
  async countUsers(): Promise<number> {
    return await this.count();
  }

  async countActiveUsers(): Promise<number> {
    return await this.count({
      where: [{ field: 'isActive', operator: 'eq', value: true }]
    });
  }

  // ✅ FOCUS: Existence checks
  async userExists(id: string): Promise<boolean> {
    return await this.exists(EntityId.fromString(id));
  }

  async emailExists(email: string): Promise<boolean> {
    const user = await this.findOne({
      where: [{ field: 'email', operator: 'eq', value: email }]
    });
    return user !== null;
  }
}

// Usage Example
async function demonstrateBasicCrud() {
  const userRepo = new UserRepository();

  // Create a new user
  const newUser = await userRepo.createUser({
    username: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'securepassword'
  });
  console.log('Created user:', newUser.id);

  // Read user by ID
  const user = await userRepo.getUserById(newUser.id);
  console.log('Found user:', user?.username);

  // Update user
  const updated = await userRepo.updateUser(newUser.id, {
    firstName: 'Jonathan',
    isActive: true
  });
  console.log('Updated user:', updated?.firstName);

  // Query users
  const activeUsers = await userRepo.getActiveUsers();
  console.log('Active users count:', activeUsers.length);

  // Count users
  const totalUsers = await userRepo.countUsers();
  console.log('Total users:', totalUsers);

  // Check existence
  const exists = await userRepo.emailExists('john@example.com');
  console.log('Email exists:', exists);
}
```

## Key Features
- Basic CRUD operations using @vytches-ddd/repositories BaseRepository
- Entity ID management with EntityId from domain-primitives
- Simple query operations with where clauses and ordering
- Count and existence check operations
- Proper error handling and null checking

## Common Pitfalls
- Not using EntityId for type-safe ID management
- Forgetting to update version and timestamps on modifications
- Not validating data before persistence operations
- Ignoring null return values from find operations

## Related Examples
- [Event-Sourced Repository](example-2.md) - Repository with event sourcing
- [Cached Repository](example-3.md) - Repository with caching layer