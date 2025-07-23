# Contributing to VytchesDDD

Thank you for your interest in contributing to VytchesDDD! This guide will help you get started with contributing to our enterprise-grade Domain-Driven Design library.

## 🎯 How to Contribute

We welcome contributions in many forms:

- 🐛 **Bug Reports**: Help us identify and fix issues
- 💡 **Feature Requests**: Suggest new functionality or improvements
- 📖 **Documentation**: Improve guides, examples, and API documentation
- 🧪 **Tests**: Add test coverage and testing utilities
- 💻 **Code**: Implement new features or fix bugs
- 🎨 **Examples**: Create real-world usage examples

## 🚀 Development Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (recommended) or npm
- **Git** with SSH keys configured

### Initial Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone git@github.com:YOUR_USERNAME/vytches-ddd.git
cd vytches-ddd

# 3. Add upstream remote
git remote add upstream git@github.com:vytches/vytches-ddd.git

# 4. Install dependencies
pnpm install

# 5. Setup git hooks
pnpm prepare

# 6. Verify setup
pnpm build
pnpm test
```

### Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Start development mode
pnpm dev                 # Watch mode for all packages
pnpm nx dev core         # Watch specific package

# 3. Run tests during development
pnpm test:watch          # Watch mode
pnpm test:affected       # Only affected by changes
pnpm nx test core        # Specific package

# 4. Before committing
pnpm lint:fix            # Fix linting issues
pnpm type-check          # Check TypeScript
pnpm test                # Run all tests
```

## 📝 Code Style Guidelines

### TypeScript Standards

- **Strict TypeScript**: Use strict mode with no `any` types
- **Explicit Return Types**: All functions must have explicit return types
- **Interface over Type**: Prefer interfaces for object shapes
- **Proper Imports**: Use type imports where appropriate

```typescript
// ✅ Good
export interface UserData {
  id: string;
  email: string;
  name: string;
}

export function createUser(data: UserData): User {
  return new User(data.id, data.email, data.name);
}

// ❌ Bad
export function createUser(data: any) {
  return new User(data.id, data.email, data.name);
}
```

### Naming Conventions

- **Classes**: PascalCase (`UserService`, `OrderAggregate`)
- **Interfaces**: PascalCase with `I` prefix (`IUserRepository`, `IEventHandler`)
- **Functions/Methods**: camelCase (`createUser`, `handleCommand`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- **Files**: kebab-case (`user-service.ts`, `order-aggregate.ts`)

### DDD Patterns

Follow established DDD patterns and our library conventions:

```typescript
// ✅ Good - Proper aggregate
export class OrderAggregate extends AggregateRoot {
  private constructor(
    id: EntityId<string>,
    private customerId: EntityId<string>,
    private items: OrderItem[]
  ) {
    super(id);
  }

  static create(customerId: EntityId<string>, items: OrderItem[]): OrderAggregate {
    const id = EntityId.createWithRandomUUID();
    const order = new OrderAggregate(id, customerId, items);
    
    order.addDomainEvent(new OrderCreatedEvent(id.getValue(), customerId.getValue()));
    
    return order;
  }
}
```

## 🧪 Testing Requirements

### Test Standards

- **Coverage**: Minimum 80% code coverage for new code
- **Test Types**: Unit tests for all public APIs
- **Error Testing**: Use `safeRun` from `@vytches-ddd/utils` for error scenarios
- **File Location**: All tests in `tests/` directory (NOT in `src/`)

### Test Naming Convention

```bash
# ✅ Correct test file naming
packages/core/tests/user-service.test.ts
packages/events/tests/domain/user-events.test.ts

# ❌ Incorrect
packages/core/src/user-service.spec.ts  # Wrong location
packages/core/tests/user-service.spec.ts  # Wrong extension
```

### Test Examples

```typescript
// user-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { UserService } from '../src/user-service';
import { ValidationError } from '@vytches-ddd/domain-primitives';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  describe('createUser', () => {
    it('should create user successfully', () => {
      const userData = { name: 'John', email: 'john@example.com' };
      const [error, user] = safeRun(() => service.createUser(userData));

      expect(error).toBeUndefined();
      expect(user).toBeDefined();
      expect(user?.name).toBe('John');
    });

    it('should throw ValidationError for invalid email', () => {
      const userData = { name: 'John', email: 'invalid-email' };
      const [validationError] = safeRun(() => service.createUser(userData));

      expect(validationError).toBeInstanceOf(ValidationError);
      expect(validationError?.message).toContain('Invalid email format');
    });
  });
});
```

## 📖 Documentation Standards

### JSDoc Requirements

All public APIs must have comprehensive JSDoc documentation:

```typescript
/**
 * @llm-summary Creates a new user with validation and domain events
 * @llm-domain Core
 * @llm-complexity Simple
 *
 * @description
 * Creates a new user entity with email validation, generates domain events,
 * and ensures data consistency through domain rules.
 *
 * @param userData - User data containing name and email
 * @returns Newly created User entity
 *
 * @throws {ValidationError} When email format is invalid
 * @throws {DomainError} When business rules are violated
 *
 * @example
 * ```typescript
 * // Basic usage
 * const user = userService.createUser({
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * try {
 *   const user = userService.createUser(userData);
 *   console.log('User created:', user.getId());
 * } catch (error) {
 *   console.error('Failed to create user:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function createUser(userData: CreateUserData): User {
  // Implementation
}
```

### README Updates

When adding new features:

1. **Update package README.md** with new functionality
2. **Add code examples** showing usage
3. **Update API sections** if interfaces change
4. **Keep LLM-METADATA current** with actual exports

## 🔄 Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
# Feature addition
feat(core): add new ValueObject base class with validation

# Bug fix
fix(acl): resolve translation error handling in adapter

# Documentation
docs(readme): update installation instructions for v2.0

# Breaking change
feat(events)!: redesign event bus API for better performance

BREAKING CHANGE: EventBus.publish() now returns Promise<void> instead of void
```

## 🔍 Pull Request Process

### Before Creating PR

1. **Sync with upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run quality checks**:
   ```bash
   pnpm lint:fix
   pnpm type-check
   pnpm test
   pnpm build
   ```

3. **Update documentation** if needed

### PR Template

Use this template for your PR description:

```markdown
## Summary
Brief description of changes

## Changes
- [ ] Feature: Description
- [ ] Fix: Description
- [ ] Documentation: Description

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] All tests pass

## Documentation
- [ ] README updated
- [ ] JSDoc comments added
- [ ] Examples updated

## Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes documented in commit message
```

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one maintainer approval required
3. **Documentation Review**: Ensure docs are updated
4. **Testing**: Verify test coverage and quality

## 🏗️ Package Architecture

### Adding New Packages

When creating new packages:

1. **Follow naming convention**: `@vytches-ddd/package-name`
2. **Use package template**: Copy from existing package structure
3. **Update workspace**: Add to root `package.json` and `nx.json`
4. **Create comprehensive README**: Follow established patterns
5. **Add examples**: Include basic, intermediate, and advanced examples

### Package Structure

```
packages/your-package/
├── src/
│   ├── index.ts              # Main exports
│   ├── types/                # Type definitions
│   ├── core/                 # Core implementations
│   └── examples/             # Usage examples
├── tests/                    # Test files (NOT in src/)
│   ├── core/
│   └── integration/
├── package.json              # Package configuration
├── README.md                 # Documentation
├── tsconfig.json            # TypeScript config
└── vite.config.mts          # Build configuration
```

## 🐛 Bug Reports

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Check documentation** for correct usage
3. **Test with latest version**

### Bug Report Template

```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Step one
2. Step two
3. Step three

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- VytchesDDD version: 
- Node.js version: 
- TypeScript version: 
- OS: 

**Code Sample**
Minimal code that reproduces the issue
```

## 💡 Feature Requests

### Feature Request Template

```markdown
**Feature Description**
Clear description of the proposed feature

**Use Case**
Why is this feature needed? What problem does it solve?

**Proposed API**
Example of how the feature would be used

**Alternatives Considered**
Other solutions you've considered

**Additional Context**
Any other relevant information
```

## ❓ Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community discussion
- **Discord**: Real-time chat (if available)

### Before Asking for Help

1. **Check documentation**: Package READMEs and examples
2. **Search issues**: Both open and closed issues
3. **Read troubleshooting**: Common issues and solutions

## 🏆 Recognition

Contributors are recognized in:

- **CONTRIBUTORS.md**: All contributors listed
- **Release Notes**: Major contributions highlighted
- **Package Documentation**: Example authors credited

## 📄 License

By contributing to VytchesDDD, you agree that your contributions will be licensed under the MIT License.
