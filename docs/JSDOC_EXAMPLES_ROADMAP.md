# JSDoc Example Injection System - Implementation Roadmap

**Version**: 3.0.0  
**Last Updated**: 2025-07-29  
**Status**: Specifications Complete - Ready for Implementation  
**Scope**: 45 Foundation Examples + Framework CLI Support  

## Executive Summary

Complete implementation plan for a JSDoc example injection system that extracts method-specific examples from comprehensive scenario-based MD files and injects them into JSDoc comments during build time. The system also supports on-demand CLI documentation generation with the same underlying engine.

### Key Statistics
- **Phase 1 Scope**: 45 concept learning examples (3 packages × 5 methods × 3 layers)
- **Foundation Packages**: domain-primitives, value-objects, aggregates
- **Framework Support**: NestJS examples for CLI only (68 files preserved)
- **Architecture**: Shared extraction engine with dual output modes
- **Implementation Timeline**: 4 weeks with concrete deliverables

## Solution Architecture

### Concept Learning vs Complete Scenarios

**JSDoc Examples** - Focused concept learning:
- **Purpose**: Teach individual method usage with clean, focused examples
- **Content**: 3-10 line examples showing method setup, execution, and return
- **Layers**: domain (pure logic), service (orchestration), integration (infrastructure)
- **Generation**: Automatic injection via @example-inject during build

**CLI Examples** - Complete usage scenarios:
- **Purpose**: Show full integration patterns and real-world workflows
- **Content**: Complete example files with business context and setup
- **Frameworks**: NestJS integration patterns preserved for CLI generation
- **Generation**: On-demand via CLI commands with framework targeting

### Unified ExampleEngine Architecture
**Single extraction engine serves both purposes:**
- **Shared Core**: File scanning, content parsing, tag extraction
- **Dual Adapters**: JSDoc adapter (concept extraction) + CLI adapter (complete files)
- **Folder Strategy**: domain examples for JSDoc, framework examples for CLI

## Architecture Overview

### Core Components

```typescript
// Simplified Shared Engine
interface IExampleEngine {
  // Core extraction functionality
  scanFolder(folderPath: string): ExampleFile[];
  extractTaggedContent(file: ExampleFile, tag: string): string;
  formatOutput(content: string, outputType: 'jsdoc' | 'cli'): string;
}

// JSDoc integration
interface IJSDocAdapter {
  getExampleForMethod(methodName: string, layer: 'domain' | 'service' | 'integration'): string;
  injectIntoJSDoc(code: string, examples: string[]): string;
}

// CLI integration  
interface ICLIAdapter {
  getCompleteExample(packageName: string, framework?: 'nestjs'): string;
  generateDocumentation(options: GenerationOptions): string;
}
```

## Example Templates and Standards

### Universal Layer System

**3-Layer Architecture for Concept Learning:**

**Domain Layer (3-5 lines) - Pure Business Logic:**
```typescript
@extract: createUser:domain:basic
const userData = { name: 'John Doe', email: 'john@example.com' };
const result = User.create(userData);
// Returns: Result<User, ValidationError>
@extract-end
```

**Service Layer (5-8 lines) - Application Orchestration:**
```typescript
@extract: createUser:service:basic
const command = new CreateUserCommand('John Doe', 'john@example.com');
const result = await this.userService.createUser(command);
if (result.isSuccess()) {
  return result.value;
}
throw new ServiceError(result.error.message);
@extract-end
```

**Integration Layer (7-10 lines) - Infrastructure Concerns:**
```typescript
@extract: createUser:integration:basic
const user = User.create(userData);
await this.userRepository.save(user);
await this.eventBus.publish(new UserCreatedEvent({
  userId: user.id,
  name: user.name,
  email: user.email
}));
return user;
@extract-end
```

### Validation Rules and Quality Standards

```typescript
interface ExampleValidationRules {
  domain: {
    maxLines: 5;
    required: ['setup', 'execution', 'return'];
    forbidden: ['async', 'await', 'repository', 'eventBus'];
  };
  service: {
    maxLines: 8;
    required: ['command/query', 'service_call', 'result_handling'];
    forbidden: ['direct_domain_instantiation'];
  };
  integration: {
    maxLines: 10;
    required: ['persistence', 'event_publishing'];
    forbidden: ['business_logic'];
  };
}
```

### JSDoc Integration Pattern

**Zero-Configuration Approach:**
```typescript
/**
 * Creates a new user with validation
 * @example-inject  // Automatically injects domain layer example
 */
static create(data: UserData): Result<User, ValidationError> {
  // Implementation...
}
```

## Technical Implementation

### Build Integration with Vite Plugin

```typescript
// packages/utils/build-configs/plugins/jsdoc-examples.ts
export function createJSDocExamplesPlugin(): Plugin {
  return {
    name: 'jsdoc-examples',
    transform(code: string, id: string) {
      if (id.endsWith('.ts') && code.includes('@example-inject')) {
        return processJSDocInjection(code, id);
      }
      return null;
    }
  };
}

async function processJSDocInjection(code: string, filePath: string): Promise<string> {
  const exampleEngine = new ExampleEngine();
  const methodName = extractMethodName(code);
  const packageName = extractPackageName(filePath);
  
  const examples = await exampleEngine.getExamplesForMethod(methodName, packageName);
  return injectExamplesIntoJSDoc(code, examples);
}
```

### Folder Structure Strategy

**New Simplified Structure:**
```
docs/examples/
├── domain/                    # JSDoc concept learning examples
│   ├── domain-primitives/    # 5 methods × 3 layers = 15 examples
│   │   ├── create.md         # @extract: create:domain:basic
│   │   ├── validate.md       # @extract: validate:service:basic
│   │   └── ...              # Tagged for extraction
│   ├── value-objects/        # 5 methods × 3 layers = 15 examples
│   └── aggregates/           # 5 methods × 3 layers = 15 examples
└── frameworks/               # CLI complete scenarios
    └── nestjs/              # 68 existing files preserved
        ├── basic/           # Complete integration examples
        ├── intermediate/    # Advanced patterns
        └── advanced/        # Enterprise scenarios
```


### Content Strategy

**Phase 1 Priority Methods (Foundation Packages):**

**domain-primitives (5 methods):**
- `create` - Entity/value object creation
- `validate` - Input validation patterns  
- `equals` - Equality comparison logic
- `toString` - String representation
- `fromString` - Parsing from string

**value-objects (5 methods):**
- `EntityId.generate` - ID generation patterns
- `Email.create` - Email validation
- `Money.create` - Money value objects
- `Address.create` - Complex value objects
- `DateRange.create` - Temporal value objects

**aggregates (5 methods):**
- `create` - Aggregate creation
- `addDomainEvent` - Event registration
- `markEventsAsCommitted` - Event lifecycle
- `updateState` - State modifications
- `validate` - Aggregate validation

**Total: 45 examples (3 packages × 5 methods × 3 layers)**

## 4-Week Implementation Timeline

### Week 1: Shared Extraction Engine
**Goal**: Build core extraction functionality

**Deliverables**:
- [ ] `ExampleEngine` interface implementation
- [ ] File scanning and tagging system for @extract tags
- [ ] Basic extraction methods with layer support
- [ ] Validation engine with rule enforcement
- [ ] Unit tests for extraction logic

**Technical Implementation**:
```typescript
// packages/utils/src/examples-engine/engine.ts
class ExampleEngine implements IExampleEngine {
  scanFolder(folderPath: string): ExampleFile[] {
    // Scan docs/examples/domain/ for tagged content
  }
  
  extractTaggedContent(file: ExampleFile, tag: string): string {
    // Extract @extract: methodName:layer:complexity sections
  }
  
  formatOutput(content: string, outputType: 'jsdoc' | 'cli'): string {
    // Format for JSDoc injection or CLI display
  }
}

```

### Week 2: JSDoc Build Integration
**Goal**: Enable @example-inject processing during TypeScript build

**Deliverables**:
- [ ] Vite plugin for @example-inject processing
- [ ] TypeScript AST parsing for method detection
- [ ] Example injection into JSDoc comments
- [ ] Build pipeline integration testing
- [ ] Error handling and fallback mechanisms

**Technical Implementation**:
```typescript
// Vite plugin processes @example-inject during build
export function createJSDocExamplesPlugin(): Plugin {
  return {
    name: 'jsdoc-examples',
    transform(code: string, id: string) {
      if (id.endsWith('.ts') && code.includes('@example-inject')) {
        return processJSDocInjection(code, id);
      }
      return null;
    }
  };
}

// Automatic example injection replaces @example-inject
// with actual examples from docs/examples/domain/
```

### Week 3: Example Content Creation
**Goal**: Create 45 tagged examples following validation rules

**Deliverables**:
- [ ] 45 tagged examples (3 packages × 5 methods × 3 layers)
- [ ] Content validation using defined rules
- [ ] Example templates documentation
- [ ] Quality review and approval process
- [ ] Content testing with actual extraction

**Content Creation Process**:
```typescript
// Each method gets 3 examples following templates:
// 1. Domain layer (3-5 lines, pure business logic)
// 2. Service layer (5-8 lines, orchestration)
// 3. Integration layer (7-10 lines, infrastructure)

// Validation ensures:
// - Line limits respected
// - Required elements present
// - Forbidden elements absent
// - Examples compile and execute
```

### Week 4: Integration Testing & Production
**Goal**: End-to-end validation and production deployment

**Deliverables**:
- [ ] End-to-end build testing with all packages
- [ ] JSDoc output quality validation
- [ ] Performance benchmarking (<2s build impact)
- [ ] Documentation and usage examples
- [ ] Production deployment preparation

**Quality Assurance**:
```typescript
// Automated validation pipeline:
// 1. All 45 examples compile successfully
// 2. Extracted examples match validation rules
// 3. JSDoc injection works correctly
// 4. Build performance within acceptable limits
// 5. Documentation output meets quality standards

// Success criteria:
// - 100% extraction success rate
// - <2s build time impact
// - All validation rules enforced
// - Zero breaking changes to existing APIs
```

## Framework Examples Strategy

### CLI-Only Framework Support

**NestJS Examples Preserved (68 files):**
- **Purpose**: Complete integration scenarios for CLI generation
- **Location**: `docs/examples/frameworks/nestjs/`
- **Usage**: `pnpm cli examples aggregates --framework nestjs`
- **Content**: Full NestJS integration with services, controllers, modules

**Framework Generation Pattern**:
```bash
# CLI generates complete framework examples
pnpm cli examples aggregates --framework nestjs
# Returns: Complete NestJS integration file with:
# - Service implementation
# - Controller setup
# - Module configuration
# - Testing examples
# - All in proper NestJS context

# JSDoc stays framework-agnostic
@example-inject  // Always returns domain/service/integration layers
                // Never framework-specific code
```

## Technical Implementation Details

### Build Integration Strategy

**Vite Plugin Architecture**:
```typescript
// packages/utils/build-configs/plugins/jsdoc-examples.ts
export function createJSDocExamplesPlugin(options: JSDocPluginOptions): Plugin {
  return {
    name: 'jsdoc-examples',
    transform(code: string, id: string) {
      if (id.endsWith('.ts') && code.includes('@example-inject')) {
        return processJSDocExamples(code, options);
      }
      return null;
    },
  };
}
```

**TypeScript Integration**:
```typescript
// Enhanced JSDoc comment processing
/**
 * Creates a new user aggregate with validation
 * 
 * @example-inject create:basic
 * // Automatically replaced with extracted example during build
 * 
 * @param data - User creation data
 * @returns New user aggregate instance
 */
static create(data: CreateUserData): UserAggregate {
  // Implementation...
}
```

### Framework Examples Integration

**Framework Focus - NestJS Only**:
- **NestJS**: 68 files (100% of current framework examples)
  - Comprehensive integration patterns across all DDD packages
  - Focus on dependency injection, decorators, and module organization
  - Examples cover: Services, Controllers, Modules, Guards, Interceptors, Filters
  - Progressive complexity from basic DI to enterprise microservices
  - Full integration with VytchesDDD patterns

**Future Framework Support** (not in current scope):
- Express and Fastify examples will be added in future phases
- Same tagging system will be extended to support their patterns

**NestJS Complete Integration Pattern** (68 files with unified structure):
```typescript
// Current: packages/aggregates/src/examples/frameworks/nestjs/basic/example-1.md
// Complete NestJS integration scenario with multiple extraction points

<!-- @extract: createUser:service:basic -->
```typescript
@Injectable()
export class UserService {
  constructor(private readonly userAggregate: UserAggregate) {}

  async createUser(userData: CreateUserData): Promise<User> {
    try {
      return await this.userAggregate.create(userData);
    } catch (error) {
      throw new BadRequestException(`User creation failed: ${error.message}`);
    }
  }
}
```
<!-- @extract-end -->

<!-- @extract: createUser:controller:basic -->
```typescript
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() userData: CreateUserData): Promise<User> {
    return await this.userService.createUser(userData);
  }
}
```
<!-- @extract-end -->

<!-- @extract: module:basic -->
```typescript
@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```
<!-- @extract-end -->
```


**Benefits for Unified Framework Examples**:
- **Complete Integration Story**: Full framework setup in single file per complexity level
- **Consistent Structure**: Same `basic/intermediate/advanced` progression as domain examples  
- **Multiple Extraction Points**: Different tags for each framework's components
- **Framework-Specific Patterns**: Tags respect each framework's architecture
- **Progressive Complexity**: Basic → Simple integration, Intermediate → +Middleware/Plugins, Advanced → +Enterprise patterns
- **Holistic Learning**: Developers see complete integration flow, not fragments

### Validation and Quality Assurance

**Automated Validation Pipeline**:
```typescript
// packages/utils/src/examples-engine/validation/example-validator.ts
export class ExampleValidator {
  async validateExtraction(filePath: string, methodName: string): Promise<ValidationResult> {
    const extractedCode = await this.engine.extractMethodExample(filePath, methodName);
    
    // 1. TypeScript compilation check
    const compileResult = await this.compileTypeScript(extractedCode);
    
    // 2. Runtime execution validation (if possible)
    const executionResult = await this.executeExample(extractedCode);
    
    // 3. Business logic validation
    const businessResult = await this.validateBusinessLogic(extractedCode);
    
    return { compileResult, executionResult, businessResult };
  }
}
```

**Quality Gates**:
- **Compilation**: All extracted examples must compile without errors
- **Execution**: Examples should execute successfully in test environment  
- **Business Logic**: Extracted methods should maintain business rule consistency
- **Documentation**: Generated JSDoc should pass documentation linting rules

## Migration Timeline

### Week-by-Week Breakdown


## Success Metrics & Quality Gates

### Phase 1 Success Criteria
- [ ] **Example Coverage**: 100% of 45 tagged examples created and validated
- [ ] **Compilation**: All extracted examples compile successfully
- [ ] **Build Performance**: JSDoc preprocessing adds <2s to build time
- [ ] **Validation**: All examples pass defined quality rules
- [ ] **Integration**: @example-inject works across all foundation packages

### Quality Standards
- [ ] **Layer Separation**: Domain examples contain no infrastructure code
- [ ] **Line Limits**: Domain (≤5), Service (≤8), Integration (≤10) lines respected
- [ ] **Consistency**: All examples follow defined templates
- [ ] **Maintainability**: Examples remain accurate with code changes
- [ ] **Framework Agnostic**: JSDoc examples work for any framework consumer

## JSDoc Formatting Requirements

### Critical Formatting Standards

**JSDoc Comment Structure** - Must preserve proper formatting:
```typescript
/**
 * Method description
 * @example
 * ```typescript
 * const result = method.call();
 * console.log(result);
 * ```
 */
methodName() {
  // implementation
}
```

**Regex Replacement Rules**:
1. **Pattern Matching**: `@example-inject` must be replaced with complete `@example` block
2. **Line Integrity**: Preserve JSDoc comment markers (`*`) on each line  
3. **Code Block Wrapping**: Always wrap extracted code in ```typescript blocks
4. **Indentation**: Maintain consistent 2-space indentation within JSDoc comments

**Common Formatting Issues to Avoid**:
- ❌ **Malformed Comments**: `* Get the aggregate's unique identifier * @example`
- ❌ **Missing Line Breaks**: Comment description running into @example
- ❌ **Duplicate Asterisks**: `*  * @example` instead of `* @example`
- ❌ **Incorrect Code Blocks**: Missing closing ``` or wrong language

**Correct Injection Pattern**:
```typescript
// BEFORE injection:
/**
 * Get the aggregate's unique identifier
 * @example-inject
 */

// AFTER injection:
/**
 * Get the aggregate's unique identifier
 * @example
 * ```typescript
 * const user = UserAggregate.create(userData);
 * const userId = user.getId();
 * return userId.getValue(); // string value
 * ```
 */
```

## Risk Assessment & Mitigation

### Technical Risks (Reduced Scope)
1. **Build Integration Complexity**: Vite plugin might conflict with existing build
   - *Mitigation*: Incremental integration with fallback mechanisms
   
2. **JSDoc Formatting Issues**: Regex replacement might create malformed comments
   - *Mitigation*: Strict formatting rules and comprehensive test coverage
   
3. **Example Quality Consistency**: 45 examples might have inconsistent quality
   - *Mitigation*: Automated validation rules and manual review process
   
4. **Performance Impact**: @example-inject processing might slow builds
   - *Mitigation*: Caching and lazy loading with <2s performance target

### Project Risks (Minimized)
1. **Scope Creep**: Temptation to add more packages/examples
   - *Mitigation*: Strict adherence to 45-example Phase 1 scope
   
2. **Template Rigidity**: Fixed line limits might be too restrictive
   - *Mitigation*: Template validation with documented exception process

3. **Developer Workflow**: New tagging might slow content creation
   - *Mitigation*: Simple templates and automated validation tools

4. **Formatting Consistency**: JSDoc injection might break across different methods
   - *Mitigation*: Standardized regex patterns and extensive testing

## Conclusion

This roadmap transforms the JSDoc example system from a complex 423-file migration to a focused 45-example implementation with clear architectural separation:

**Key Innovations:**
- **Concept Learning**: JSDoc provides focused, layer-specific examples for API understanding
- **Complete Scenarios**: CLI provides full framework integration examples for implementation
- **Shared Engine**: Single extraction system serves both needs efficiently
- **Quality Standards**: Automated validation ensures consistent, maintainable examples

**Strategic Benefits:**
- **Reduced Complexity**: 45 examples vs 423 files (90% scope reduction)
- **Clear Purpose**: Each system serves distinct learning needs
- **Enterprise Ready**: Validation rules and quality gates ensure consistency
- **Framework Agnostic**: JSDoc examples work for any consumer framework

**Next Steps:**
1. **Week 1**: Begin extraction engine implementation
2. **Validation**: Create first 15 examples and validate approach
3. **Iteration**: Refine templates based on real usage
4. **Scale**: Complete remaining 30 examples and integrate build system

## Appendix: Technical Specifications

### Example Engine Interface

```typescript
interface IExampleEngine {
  // Core extraction
  scanFolder(folderPath: string): ExampleFile[];
  extractTaggedContent(file: ExampleFile, tag: string): string;
  formatOutput(content: string, outputType: 'jsdoc' | 'cli'): string;
  
  // Validation
  validateExample(content: string, layer: LayerType): ValidationResult;
  enforceRules(example: Example, rules: ExampleValidationRules): boolean;
}

interface ExampleValidationRules {
  domain: { maxLines: 5; required: string[]; forbidden: string[]; };
  service: { maxLines: 8; required: string[]; forbidden: string[]; };
  integration: { maxLines: 10; required: string[]; forbidden: string[]; };
}
```

### Build Integration

```typescript
// Vite plugin automatically processes @example-inject
export function createJSDocExamplesPlugin(): Plugin {
  return {
    name: 'jsdoc-examples',
    transform(code: string, id: string) {
      if (code.includes('@example-inject')) {
        return injectExamples(code, extractMethodInfo(id));
      }
    }
  };
}
```

### Framework Examples (CLI Only)

**NestJS Examples Preserved (68 files):**
- Location: `docs/examples/frameworks/nestjs/`
- Usage: `pnpm cli examples [package] --framework nestjs`
- Content: Complete integration scenarios with services, controllers, modules
**Preserved Structure**: Framework examples maintain complete integration context for CLI generation while JSDoc focuses on universal domain concepts.

---

**Implementation Owner**: Development Team  
**Review Date**: 2025-08-04  
**Next Milestone**: Week 1 - Extraction Engine Implementation
**Status**: Ready for Development
