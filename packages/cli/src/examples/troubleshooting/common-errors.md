# Common Errors & Solutions

**Focus**: Quick solutions to frequent CLI issues
**Goal**: Get back to productive development fast

## Quick Diagnostics

```bash
# Run full diagnostics
vytches-ddd --diagnostic

# Check CLI health
vytches-ddd --version --verbose

# Validate project setup
vytches-ddd validate --project
```

## Generation Errors

### "Component not found" Error

**Error:**
```
❌ CLI Error: Component type 'agreggate' not found
Available components: aggregate, entity, value-object, command, query
```

**Solution:**
```bash
# Check available components
vytches-ddd generate --list-components

# Use correct spelling
vytches-ddd generate aggregate User  # Not 'agreggate'

# Use shortcuts
vytches-ddd g aggregate User  # 'g' is alias for 'generate'
```

### "Domain not found" Error

**Error:**
```
❌ Domain 'UserMangement' not found in project
```

**Solutions:**
```bash
# List existing domains
ls src/domain/

# Create domain first
vytches-ddd domain UserManagement --guided

# Use correct domain name (case-sensitive)
vytches-ddd g aggregate User --domain UserManagement

# Skip domain validation (for new domains)
vytches-ddd g aggregate User --domain UserManagement --skip-validation
```

### Template Rendering Errors

**Error:**
```
❌ Template Error: Missing required context 'properties'
Template: aggregate.hbs
```

**Solutions:**
```bash
# Use interactive mode to provide missing context
vytches-ddd g aggregate User --interactive

# Provide required properties
vytches-ddd g aggregate User --properties "name:string,email:string,age:number"

# Use simpler template
vytches-ddd g aggregate User --template basic

# Debug template context
vytches-ddd g aggregate User --dry-run --debug
```

## Import & Dependency Errors

### Missing Import Errors

**Error:**
```typescript
// Generated code has missing imports
export class UserAggregate extends AggregateRoot {
  // Error: Cannot find name 'AggregateRoot'
```

**Solutions:**
```bash
# Fix imports automatically
vytches-ddd validate --fix-imports

# Regenerate with proper imports
vytches-ddd g aggregate User --domain UserManagement --fix-imports

# Check template configuration
cat .vytches/config.json
```

**.vytches/config.json fix:**
```json
{
  "imports": {
    "autoResolve": true,
    "basePackage": "@vytches-ddd/core",
    "customMappings": {
      "AggregateRoot": "@vytches-ddd/core",
      "EntityId": "@vytches-ddd/value-objects",
      "DomainEvent": "@vytches-ddd/events"
    }
  }
}
```

### Circular Dependency Issues

**Error:**
```
❌ Circular dependency detected:
OrderAggregate → Customer → Order → OrderAggregate
```

**Solutions:**
```bash
# Analyze dependencies
vytches-ddd domain --context-map --check-cycles

# Fix with proper domain boundaries
vytches-ddd domain OrderManagement --refine --fix-cycles

# Use shared contracts
vytches-ddd g contract CustomerData --for-domains Order,Customer
```

**Fixed with shared contract:**
```typescript
// src/shared/contracts/customer-data.contract.ts
export interface CustomerDataContract {
  id: string;
  name: string;
  email: string;
}

// OrderAggregate uses contract instead of full Customer entity
import { CustomerDataContract } from '@shared/contracts/customer-data.contract';
```

## Domain Builder Issues

### Interactive Mode Stuck

**Problem:**
```
🎯 VytchesDDD Domain Builder
? What domain are you building? OrderManagement
[Hangs here without progress]
```

**Solutions:**
```bash
# Skip AI analysis, use manual mode
vytches-ddd domain OrderManagement --manual

# Use template instead
vytches-ddd domain OrderManagement --template ecommerce

# Debug interactive mode
vytches-ddd domain OrderManagement --guided --debug --verbose

# Reset CLI configuration
rm -rf .vytches/cache
vytches-ddd config reset
```

### Domain Validation Failures

**Error:**
```
🔍 Domain Validation: OrderManagement
❌ Repository pattern - Missing interfaces
❌ Domain events - Not consistently used
Score: 45/100 (Needs improvement)
```

**Solutions:**
```bash
# Auto-fix common issues
vytches-ddd domain OrderManagement --validate --fix

# Generate missing components
vytches-ddd domain OrderManagement --analyze-gaps --apply-fixes

# Use validation-compliant template
vytches-ddd domain OrderManagement --template enterprise --regenerate
```

## File System & Path Issues

### Permission Errors

**Error:**
```
❌ EACCES: permission denied, mkdir '/src/domain/user-management'
```

**Solutions:**
```bash
# Check current directory permissions
ls -la

# Run with proper permissions
sudo vytches-ddd g aggregate User --domain UserManagement

# Change ownership
sudo chown -R $USER:$USER src/

# Use different output directory
vytches-ddd g aggregate User --output ./custom-output/
```

### Path Resolution Errors

**Error:**
```
❌ Cannot resolve path: @domain/user-management/user.aggregate
```

**Solutions:**
```bash
# Check tsconfig.json paths
cat tsconfig.json

# Fix path mappings
vytches-ddd config fix-paths

# Regenerate with absolute paths
vytches-ddd g aggregate User --absolute-paths
```

**Fixed tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

## Template & Configuration Issues

### Template Not Found

**Error:**
```
❌ Template 'enterprise' not found
Available templates: basic, default
```

**Solutions:**
```bash
# List all available templates
vytches-ddd template list --verbose

# Install enterprise templates
vytches-ddd template install enterprise

# Create custom template
vytches-ddd template init --template enterprise

# Use default template
vytches-ddd g aggregate User  # Uses default template
```

### Configuration File Corruption

**Error:**
```
❌ Invalid configuration file: .vytches/config.json
SyntaxError: Unexpected token } in JSON
```

**Solutions:**
```bash
# Validate configuration
vytches-ddd config validate

# Reset to defaults
vytches-ddd config reset

# Repair configuration
vytches-ddd config repair

# Manual fix
rm .vytches/config.json
vytches-ddd config init
```

## Examples & Documentation Issues

### Package Documentation Generation Fails

**Error:**
```
❌ Failed to generate examples for package 'cqrs'
Error: Package configuration not found
```

**Solutions:**
```bash
# Check if package exists
ls packages/cqrs/src/examples/

# Validate package structure
vytches-ddd examples validate --package cqrs

# Regenerate package configuration
vytches-ddd examples init --package cqrs

# Force regeneration
vytches-ddd examples generate cqrs --force --clean
```

### Bundle Generation Issues

**Error:**
```
❌ Bundle generation failed: Conflicting example IDs
Example 'basic-command-handler' found in multiple packages
```

**Solutions:**
```bash
# Check for conflicts
vytches-ddd examples find-conflicts

# Resolve with explicit package selection
vytches-ddd examples bundle --packages cqrs,events --resolve-conflicts

# Generate unique IDs
vytches-ddd examples bundle --packages cqrs,events --unique-ids
```

## Performance Issues

### Slow Generation Times

**Problem:**
CLI takes 30+ seconds to generate simple components

**Solutions:**
```bash
# Clear cache
rm -rf .vytches/cache
vytches-ddd cache clear

# Disable AI analysis for faster generation
vytches-ddd g aggregate User --no-ai

# Use lightweight templates
vytches-ddd g aggregate User --template basic

# Profile generation
vytches-ddd g aggregate User --profile --debug
```

### Memory Issues

**Error:**
```
❌ JavaScript heap out of memory
```

**Solutions:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" vytches-ddd domain OrderManagement

# Use streaming mode for large operations
vytches-ddd examples generate --all --stream

# Process in smaller batches
vytches-ddd examples generate cqrs,events  # Instead of --all
```

## Environment & Setup Issues

### Node.js Version Incompatibility

**Error:**
```
❌ Node.js version 14.x is not supported
Required: Node.js 16+ 
```

**Solutions:**
```bash
# Check Node version
node --version

# Update Node.js
nvm install 18
nvm use 18

# Or use npx with specific Node version
npx --node-version=18 vytches-ddd generate aggregate User
```

### Missing Dependencies

**Error:**
```
❌ Cannot find module '@vytches-ddd/core'
```

**Solutions:**
```bash
# Install required dependencies
npm install @vytches-ddd/core @vytches-ddd/cqrs @vytches-ddd/events

# Check package.json
cat package.json

# Auto-install missing dependencies
vytches-ddd install --dependencies

# Verify installation
npm list @vytches-ddd/core
```

## Integration Issues

### Framework Integration Errors

**Error:**
```typescript
// NestJS integration
❌ Cannot resolve dependency CommandBus
```

**Solutions:**
```bash
# Generate proper NestJS integration
vytches-ddd g module UserManagement --framework nestjs

# Add required NestJS dependencies
npm install @nestjs/cqrs @nestjs/core @nestjs/common

# Fix DI configuration
vytches-ddd validate --fix-di --framework nestjs
```

**Fixed module:**
```typescript
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
  imports: [CqrsModule],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule {}
```

### Test Generation Issues

**Error:**
```
❌ Test generation failed: Cannot mock abstract class
```

**Solutions:**
```bash
# Generate with concrete implementations
vytches-ddd g test UserAggregate --with-mocks --concrete

# Use test utilities
vytches-ddd g test UserAggregate --test-utils

# Skip problematic dependencies
vytches-ddd g test UserAggregate --skip-deps "AbstractRepository"
```

## Emergency Recovery

### Complete CLI Reset

```bash
# Nuclear option - reset everything
rm -rf .vytches/
rm -rf node_modules/
npm cache clean --force
npm install
vytches-ddd config init
```

### Project Structure Recovery

```bash
# Recreate project structure
vytches-ddd project init --recovery

# Restore from templates
vytches-ddd generate --restore-structure

# Validate and fix
vytches-ddd validate --fix-all --force
```

## Getting Help

### Verbose Debugging

```bash
# Maximum verbosity
vytches-ddd g aggregate User --verbose --debug --trace

# Save debug output
vytches-ddd g aggregate User --debug > debug.log 2>&1

# Profile performance
vytches-ddd g aggregate User --profile --timing
```

### Reporting Issues

```bash
# Generate diagnostic report
vytches-ddd --diagnostic --export diagnostic-report.json

# Include system information
vytches-ddd --system-info

# Test with minimal reproduction
vytches-ddd g aggregate TestCase --dry-run --minimal
```

### Community Resources

- **GitHub Issues**: Report bugs with diagnostic information
- **Documentation**: Check latest docs for CLI updates
- **Examples**: Review working examples in the repository
- **Community**: Ask questions in discussions

## Prevention Tips

### Best Practices
- **Validate early**: Run `--validate` after major changes
- **Use version control**: Commit before major CLI operations
- **Start simple**: Use basic templates first, enhance later
- **Test templates**: Validate custom templates thoroughly

### Regular Maintenance
- **Update CLI**: Keep CLI version current
- **Clear cache**: Periodic cache cleanup
- **Validate project**: Regular project structure validation
- **Backup configuration**: Version control CLI configuration