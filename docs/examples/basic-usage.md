# Basic Usage Examples

## Creating a Value Object

```typescript
import { ValueObject } from '@vytches-ddd/core';

export class Email extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    this.validate();
  }

  private validate(): void {
    if (!this.isValidEmail(this.value)) {
      throw new Error('Invalid email format');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
```

## Creating an Entity

```typescript
import { Entity } from '@vytches-ddd/core';

export class User extends Entity<string> {
  constructor(
    id: string,
    private email: Email,
    private name: string
  ) {
    super(id);
  }

  updateEmail(newEmail: Email): void {
    this.email = newEmail;
    // Emit domain event if needed
  }

  getName(): string {
    return this.name;
  }

  getEmail(): Email {
    return this.email;
  }
}
```
