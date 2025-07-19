# Basic Service Registration - Beginner Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: beginner  
**Domain**: User Management  
**Patterns**: Service Registration, Decorator Pattern  
**Dependencies**: @vytches-ddd/di  

## Description

This example demonstrates the fundamental concepts of service registration using the `@DomainService` decorator. You'll learn how to register services with VytchesDDD's dependency injection system and resolve them using the global service locator pattern.

## Business Context

In a typical enterprise application, you need to manage user operations across multiple layers. Instead of manually instantiating services and managing their dependencies, the DI system automatically handles service creation and lifecycle management, leading to cleaner, more maintainable code.

## Code Example

```typescript
// user.service.ts
import { DomainService } from '@vytches-ddd/di';
import { User, CreateUserData } from '../types'; // Import from application

/**
 * User service with basic DI registration
 */
@DomainService('userService')
export class UserService {
  /**
   * Creates a new user
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Business logic implementation
    const user: User = {
      id: this.generateId(),
      email: userData.email,
      name: userData.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Simulate database save
    await this.saveToDatabase(user);
    
    return user;
  }
  
  /**
   * Retrieves a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    // ⭐ FOCUS: Service implementation
    return await this.findInDatabase(id);
  }
  
  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async saveToDatabase(user: User): Promise<void> {
    // Simulate database operation
    console.log('Saving user to database:', user.id);
  }
  
  private async findInDatabase(id: string): Promise<User | null> {
    // Simulate database lookup
    console.log('Finding user in database:', id);
    return null; // Simplified for example
  }
}
```

```typescript
// app.ts
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { UserService } from './user.service';
import { CreateUserData } from '../types'; // Import from application

/**
 * Application setup and service usage
 */
async function setupApplication(): Promise<void> {
  // ⭐ FOCUS: Configure DI container
  const container = new SimpleContainer();
  await VytchesDDD.configure(container);
  
  // ⭐ FOCUS: Resolve service using global locator
  const userService = VytchesDDD.resolve<UserService>('userService');
  
  // ⭐ FOCUS: Use the service
  const userData: CreateUserData = {
    email: 'john.doe@example.com',
    name: 'John Doe'
  };
  
  const user = await userService.createUser(userData);
  console.log('Created user:', user);
  
  const retrievedUser = await userService.getUserById(user.id);
  console.log('Retrieved user:', retrievedUser);
}

// Run the application
setupApplication().catch(console.error);
```

## Key Features

- **Simple Registration**: Use `@DomainService` decorator with a service identifier
- **Auto-Discovery**: Services are automatically discovered and registered
- **Global Resolution**: Access services anywhere using `VytchesDDD.resolve()`
- **Type Safety**: Full TypeScript support with generic type resolution
- **Zero Configuration**: Works out of the box with sensible defaults

## Common Pitfalls

- **Missing Service ID**: Always provide a unique service identifier in `@DomainService('serviceId')`
- **Forgetting Configuration**: Must call `VytchesDDD.configure()` before resolving services
- **Circular Dependencies**: Avoid services that depend on each other directly
- **Type Mismatches**: Ensure the generic type matches the actual service type when resolving

## Related Examples

- [Service Lifetimes](./example-2.md) - Understanding different service lifetimes
- [VytchesDDD Global Service Locator](./example-3.md) - Advanced service locator usage
- [Auto-Discovery System](../intermediate/example-1.md) - Automatic service discovery