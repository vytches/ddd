# ADR-0017: Vytches Organization Naming Convention

## Status

**ACCEPTED** - July 24, 2025

## Context

Following ADR-0016's decision to publish individual packages with organization
scope, we needed to determine the optimal GitHub organization structure and
package naming convention. The initial consideration was `@vytches/ddd-*`
packages, which created redundancy in the organization/repository relationship.

### GitHub Structure Challenges

The initial approach would have resulted in:

```
Organization: vytches-ddd
Repository: vytches-ddd
URL: github.com/ddd/vytches-ddd
```

This created visual redundancy and suboptimal URLs for enterprise presentation.

### Options Considered

1. **Keep vytches-ddd organization**: Results in `github.com/ddd/vytches-ddd`
2. **Generic vytches organization**: Allows for future expansion and cleaner
   URLs
3. **Separate DDD-specific organization**: Dedicated but limits organizational
   growth

## Decision

We will use **"vytches" organization with "ddd" repository** and
`@vytches/ddd-*` package naming.

### Final Structure

```
Organization: vytches
Repository: ddd
URL: github.com/vytches/ddd
Packages: @vytches/ddd-core, @vytches/ddd-logging, etc.
```

## Rationale

### ✅ **Benefits of Vytches Organization Structure**

1. **Clean GitHub URLs**

   - Professional URL: `github.com/vytches/ddd`
   - No redundancy between organization and repository names
   - Scales well for additional projects

2. **Namespace Organization**

   - `@vytches/ddd-*` clearly indicates DDD library packages
   - Allows future expansion: `@vytches/ui-*`, `@vytches/utils-*`
   - Maintains clear product boundaries within organization

3. **Professional Branding**

   - Organization name represents company/brand identity
   - Repository name represents specific product
   - Package names combine both for clarity

4. **Enterprise Scalability**

   - Organization can house multiple product lines
   - Clear separation between different libraries
   - Easier management of organization-wide settings

5. **Import Clarity**

   ```typescript
   // Clear product identification in imports
   import { AggregateRoot } from '@vytches/ddd-core';
   import { Logger } from '@vytches/ddd-logging';

   // Future other products
   import { Button } from '@vytches/ui-button';
   import { validator } from '@vytches/utils-validation';
   ```

### 🚫 **Drawbacks Considered**

1. **Slightly Longer Package Names**

   - `@vytches/ddd-core` vs `@vytches/ddd-core`
   - **Mitigation**: Clear product identification worth the extra characters

2. **Organization Management Complexity**
   - Need to manage organization-wide settings
   - **Mitigation**: Better long-term structure for growth

## Implementation

### Package Name Updates

```
OLD: @vytches/ddd-core     → NEW: @vytches/ddd-core
OLD: @vytches/ddd-logging  → NEW: @vytches/ddd-logging
OLD: @vytches/ddd-policies → NEW: @vytches/ddd-policies
```

### Usage Examples

```typescript
// Core DDD functionality
import { AggregateRoot, EntityId } from '@vytches/ddd-core';
import { Logger } from '@vytches/ddd-logging';

// Advanced patterns
import { PolicyBuilder } from '@vytches/ddd-policies';
import { OutboxPattern } from '@vytches/ddd-messaging';
import { CircuitBreaker } from '@vytches/ddd-resilience';

// Event-driven architecture
import { UnifiedEventBus } from '@vytches/ddd-events';
import { CommandBus, QueryBus } from '@vytches/ddd-cqrs';
```

### Installation

```bash
# Configure registry for @vytches packages
echo "@vytches:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}" >> .npmrc

# Install specific packages
pnpm add @vytches/ddd-core @vytches/ddd-logging
```

### Publishing

```bash
# Lerna handles all @vytches/ddd-* packages
pnpm release:changed  # See what will be published
pnpm release          # Publish changed packages
```

## Consequences

### **Positive**

- ✅ **Professional URLs**: Clean `github.com/vytches/ddd` structure
- ✅ **Scalable Organization**: Can expand to other products
- ✅ **Clear Package Identity**: Product prefix in all package names
- ✅ **Enterprise Ready**: Professional organization structure
- ✅ **Future Growth**: Easy to add new product lines
- ✅ **Brand Consistency**: Vytches organization represents overall brand

### **Negative**

- ❌ **Package Name Length**: Slightly longer than alternatives
- ❌ **Organization Overhead**: Need to manage org-level settings
- ❌ **Migration Effort**: One-time cost to update all references

## Migration Checklist

- [x] Create "vytches" GitHub organization
- [x] Create "ddd" repository in organization
- [x] Update all package.json files with new names
- [x] Update inter-package dependencies
- [x] Update root package.json with new repository URLs
- [ ] Transfer repository to vytches organization
- [ ] Update source code imports
- [ ] Update documentation and examples
- [ ] Configure GitHub Packages publishing
- [ ] Test complete publishing workflow

## Future Considerations

### Cross-Repository Architecture

The chosen structure enables seamless cross-repository dependencies within the
Vytches ecosystem:

```bash
# Organization structure
github.com/vytches/ddd          # DDD framework
github.com/vytches/seeder       # Database seeding utilities
github.com/vytches/migrations   # Database migrations
github.com/vytches/auth         # Authentication library
```

### Package Naming Strategy

1. **DDD Framework** (current repository)

   ```
   @vytches/ddd-core
   @vytches/ddd-events
   @vytches/ddd-cqrs
   ```

2. **Future Independent Repositories**
   ```
   @vytches/seeder         # Standalone seeding tool
   @vytches/migrations     # Migration framework
   @vytches/auth           # Authentication/authorization
   @vytches/graphql        # GraphQL utilities
   @vytches/testing        # Testing helpers
   ```

### Cross-Repository Dependencies

Independent repositories can freely depend on each other:

```typescript
// In @vytches/seeder repository
import { EntityId, AggregateRoot } from '@vytches/ddd-core';
import { DomainEvent } from '@vytches/ddd-events';

export class DomainAwareSeeder {
  // Seeder can use DDD concepts
}

// In @vytches/ddd-domain-services
import { DatabaseSeeder } from '@vytches/seeder';

export class DataInitializationService {
  // DDD can use seeder utilities
}
```

### Benefits of Multi-Repository Strategy

1. **Independent Versioning**: Each repository has its own release cycle
2. **Focused Responsibility**: Each repository has a clear, single purpose
3. **Optional Dependencies**: Users install only what they need
4. **Easier Maintenance**: Smaller, focused codebases
5. **Team Scalability**: Different teams can own different repositories

### Package Publishing Configuration

Each repository publishes to the same @vytches organization scope:

```json
{
  "name": "@vytches/seeder",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  }
}
```

### User Experience

```bash
# Users can mix and match packages from different repos
npm install @vytches/ddd-core      # From ddd repo
npm install @vytches/seeder        # From seeder repo
npm install @vytches/auth          # From auth repo

# All under unified @vytches organization
```

### Long-term Vision

1. **Core Infrastructure** (`@vytches/ddd-*`): Domain-Driven Design framework
2. **Data Tools** (`@vytches/seeder`, `@vytches/migrations`): Database utilities
3. **API Layer** (`@vytches/graphql`, `@vytches/rest`): API development tools
4. **Security** (`@vytches/auth`, `@vytches/crypto`): Security utilities
5. **Developer Experience** (`@vytches/cli`, `@vytches/testing`): Development
   tools

This structure scales infinitely while maintaining clarity and professional
organization.

## Related Decisions

- **ADR-0016**: Individual packages with organization scope
- **ADR-0002**: Meta-package pattern for API stability
- **ADR-0005**: Modular package architecture

---

**Decision made by**: Development Team  
**Date**: July 24, 2025  
**Review date**: January 24, 2026
