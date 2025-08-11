# CLAUDE.md

## CRITICAL: Implementation Verification Before Documentation

**🚨 MANDATORY BEFORE ANY EXAMPLE/DOCUMENTATION GENERATION 🚨**

**When creating ANY documentation or examples, FIRST verify implementation:**

- ✅ **ALWAYS READ SOURCE**: Read actual TypeScript implementation files before
  creating examples
- ✅ **VERIFY METHODS EXIST**: Check that all methods used in examples actually
  exist in the codebase
- ✅ **CHECK METHOD SIGNATURES**: Ensure parameter types, return types, and
  method names match reality
- ✅ **VALIDATE INHERITANCE**: Understand which methods come from base classes
  vs specific implementations
- ❌ **NEVER ASSUME**: Never assume methods like `create()`, `fromEvents()`,
  `fromData()` exist without verification
- ❌ **NO FICTIONAL CODE**: Don't create examples with non-existent methods or
  patterns

**Critical Implementation Facts (DO NOT FORGET):**

- ❌ `AggregateRoot.create()` - **DOES NOT EXIST**, use
  `new AggregateRoot(params)` constructor
- ❌ `AggregateRoot.fromEvents()` - **DOES NOT EXIST**, use
  `new AggregateRoot(params)` + `loadFromHistory(events)`
- ✅ `AggregateBuilder.create()` - **EXISTS**, this is the correct static
  factory method for builder
- ✅ `aggregate.loadFromHistory(events)` - **EXISTS**, use this for event
  sourcing reconstruction
- ✅ `EntityId.createWithRandomUUID()` - **EXISTS**, correct factory method for
  EntityId

**Verification Process:**

1. Read relevant TypeScript files in `packages/[package]/src/`
2. Use Grep tool to search for method definitions
3. Verify method signatures and return types
4. Check base class methods vs derived class methods
5. Only then create documentation examples

## CRITICAL: Documentation Generation Procedure

**🚨 MANDATORY CHECKLIST FOR ALL MD FILE GENERATION 🚨**

**IMPORTANT: Only update MD files in `/docs/` directory, NOT in package
`/examples/` folders!**

**When creating ANY markdown documentation file, ALWAYS follow this procedure:**

**CRITICAL FILE LOCATION RULE:**

- ✅ **UPDATE ONLY**: Files in `/home/node/projects/vytches-ddd/docs/examples/`
  directory
- ❌ **DO NOT UPDATE**: Files in `packages/*/src/examples/` directories (these
  are old and will be removed)
- ⚠️ **REMINDER**: The proper documentation location is the root `/docs/`
  folder, not package-specific examples

### 1. **Template Structure Validation**

- ✅ **HEADER**: Must include Version, Package, Complexity, Domain, Patterns,
  Dependencies
- ✅ **DESCRIPTION**: Clear explanation of what the example demonstrates
- ✅ **BUSINESS CONTEXT**: Why this pattern is useful in enterprise scenarios
- ✅ **CODE EXAMPLE**: Real working code using actual implementation methods
- ✅ **KEY FEATURES**: List of important functionality demonstrated
- ✅ **COMMON PITFALLS**: Mistakes to avoid when using the library
- ✅ **RELATED EXAMPLES**: Links to other relevant examples
- ✅ **TRAILING NEWLINE**: File must end with exactly one newline character

### 2. **Enhanced Metadata System V2 Integration**

**🚨 CRITICAL: Enhanced Metadata System V2 - Performance & Hierarchical
Architecture 🚨**

**Enhanced Metadata System now supports:**

- ✅ **Hierarchical Metadata Resolution** - Global → Package → Class → Method
  levels
- ✅ **Performance Optimization** - Worker threads, multi-level caching, smart
  change detection
- ✅ **Format-Specific Overrides** - Different content for JSDoc vs CLI output
- ✅ **Resolution Strategies** - merge, replace, append strategies for metadata
  inheritance
- ✅ **TypeScript Example Formatting** - All @example blocks must use

  ```typescript

  ```

**For Implementation Files (.ts) - YAML-based Documentation:**

- Documentation is managed entirely through YAML files
- NO special markers or directives in source code
- JSDoc is generated automatically during build process

**For Interface Files (.ts) - Use Static JSDoc:**

````typescript
/**
 * Brief description of the interface method contract
 * @param param Description of the parameter and its constraints
 * @returns Description of what the method returns
 * @throws Description of when and what errors are thrown
 * @example
 * ```typescript
 * // Concise example showing interface usage
 * const instance: IInterface = new Implementation();
 * const result = instance.methodName(param);
 * ```
 */
````

**🎯 Hierarchical Metadata Structure:**

**Level 0: Global Settings**

```markdown
<!-- docs/global-settings.md -->

@global-settings @strategy: merge @description: Global description for all
examples @business-context: Standard business context for enterprise
applications @author: DDD Team @since: 1.0.0 @global-settings-end
```

**Level 1: Package Settings**

```markdown
<!-- packages/aggregates/.md-settings.md -->

@package-settings @strategy: merge @description.jsdoc: Aggregate operations and
domain event handling @business-context.jsdoc: Core aggregate patterns for
domain modeling @author: Aggregates Team @complexity: intermediate
@package-settings-end
```

**Level 2: Class Metadata**

```markdown
<!-- docs/examples/domain/aggregates/aggregate-root.md -->

@description: Base aggregate root functionality @business-context: Core DDD
aggregate pattern implementation @strategy: merge @author: Core Team
```

**Level 3: Method Metadata (Highest Priority)**

````markdown
<!-- docs/examples/domain/aggregates/aggregate-root/commit.md -->

@description: Commits all pending domain events and updates aggregate version
@description.jsdoc: Commits pending domain events and updates version
@business-context: Used after completing business operations to persist state
changes @business-context.jsdoc: Essential for event sourcing and domain event
handling @strategy: replace @since: 1.0.0

@extract: commit:domain:basic

```typescript
const aggregate = new AggregateRoot({ id: EntityId.fromText('order-123') });
aggregate.apply('OrderCreated', { amount: 100 });
aggregate.commit(); // Commits events and clears pending list
```
````

@extract-end

````

**🚀 Performance Commands:**
```bash
JSDOC_DEBUG=true pnpm dev        # Enhanced logging with hierarchy resolution
pnpm jsdoc:verify               # Post-build verification with performance metrics
pnpm jsdoc:manual               # CLI fallback processing for debugging
pnpm jsdoc:benchmark            # Performance testing and cache analysis
pnpm metadata:validate          # Validate all metadata files for common issues
````

**🛠️ CRITICAL: Common Issues Prevention**

**Class Name Mapping Issues:**

- ✅ System now handles `aggregate-root.builder` → `aggregate-builder.md`
  mapping
- ✅ Automatic detection of class name mismatches in validation script
- ⚠️ Always verify .d.ts filename matches expected .md filename

**@extract Block Format Issues:**

- ✅ **MANDATORY**: All @extract blocks MUST use ```typescript wrappers
- ✅ **MANDATORY**: All @extract blocks MUST end with @extract-end
- ❌ **FORBIDDEN**: @extract blocks without proper markdown formatting
- 🔧 **FIX**: Run `pnpm metadata:validate` to catch formatting issues

**Validation Commands:**

```bash
pnpm metadata:validate          # Check all MD files for common issues
pnpm build                      # Full build with Enhanced Metadata System V2
JSDOC_DEBUG=true pnpm build     # Debug build with detailed logging
```

**Expected Performance Gains:**

- **Before**: ~45s (single thread, no cache)
- **After**: ~12s (initial), ~2s (incremental), ~0.5s (no changes)

### 3. **Mandatory Pre-Generation Checks**

- ✅ **READ IMPLEMENTATION**: Always read source .ts files first
- ✅ **VERIFY METHODS**: Confirm all methods used in examples exist
- ✅ **CHECK IMPORTS**: Ensure all imports reference actual exported
  types/classes
- ✅ **VALIDATE PATTERNS**: Verify usage patterns match actual implementation
- ✅ **TEST EXAMPLES**: Ensure code examples would actually compile and run

### 4. **Quality Assurance**

- ✅ **NO FICTIONAL CODE**: Only use methods that actually exist in the codebase
- ✅ **CONSISTENT FORMATTING**: Follow established markdown formatting patterns
- ✅ **PROPER LINKING**: Ensure all internal links point to existing files
- ✅ **LINTING COMPLIANCE**: File must pass markdown linting (proper newlines)

### 5. **Forbidden Patterns**

- ❌ **NO ASSUMPTIONS**: Don't assume method signatures without verification
- ❌ **NO PLACEHOLDER CODE**: Don't use `// Implementation here` or similar
- ❌ **NO BROKEN EXAMPLES**: All code must be valid and executable
- ❌ **NO MISSING NEWLINES**: Files must end with single newline character

## CRITICAL: Complete MD File Structure Template

**🚨 ALWAYS USE THIS TEMPLATE FOR MARKDOWN FILES 🚨**

````markdown
# [ComponentName] - [ComplexityLevel] Example

**Version**: 1.0.0 **Package**: @vytches/ddd-[package-name] **Complexity**:
[beginner|intermediate|advanced] **Domain**: [domain-name] **Patterns**:
[pattern1, pattern2, pattern3] **Dependencies**: [list-of-dependencies]

## Description

[Clear explanation of what the example demonstrates]

## Business Context

[Why this pattern is useful in enterprise scenarios]

## Code Example

@extract: [methodName]:[domain]:[complexity]

```typescript
// [filename].ts
import { [Classes] } from '@vytches/ddd-[package]';

// Code example (3-5 lines for basic, more for advanced)
const result = SomeClass.method(params);
// Result: [explanation]
```
````

@extract-end

## Key Features

- **[Feature 1]**: [Description of feature]
- **[Feature 2]**: [Description of feature]
- **[Feature 3]**: [Description of feature]

## Common Pitfalls

- [Pitfall 1 description]
- [Pitfall 2 description]
- [Pitfall 3 description]

## Related Examples

- [[RelatedExample1]](./related-example-1.md) - [Brief description]
- [[RelatedExample2]](./related-example-2.md) - [Brief description]

````

### Enhanced Metadata System V2 - Resolution Strategies

**🎯 Resolution Strategies (Hierarchical Inheritance):**

**1. @strategy: merge** (Default)
- Combines content from lower levels
- Preserves existing metadata from global/package/class levels
- Method-level metadata adds to existing content

**2. @strategy: replace**
- Completely overrides content from lower levels
- Method-level metadata replaces all previous content
- Use for method-specific customization

**3. @strategy: append**
- Adds content to existing metadata
- Concatenates descriptions with newlines
- Useful for extending base descriptions

**🎨 Format-Specific Overrides:**
```markdown
@description: Base description for all formats
@description.jsdoc: Concise JSDoc-specific description
@description.cli: ## Extended CLI Description\n\nWith markdown formatting
@business-context: Standard business context
@business-context.jsdoc: Brief context for JSDoc
@warning.jsdoc: JSDoc-only warning message
````

**📋 Enhanced Metadata Tags Reference:**

**Global Settings (docs/global-settings.md):**

```markdown
@global-settings @strategy: merge @description: Global description for all
examples @business-context: Standard business context @author: DDD Team @since:
1.0.0 @global-settings-end
```

**Package Settings (packages/[package]/.md-settings.md):**

```markdown
@package-settings @strategy: merge @description.jsdoc: Package-specific JSDoc
description @business-context: Package domain context @author: Package Team
@complexity: [beginner|intermediate|advanced] @package-settings-end
```

**Method-Specific Metadata (before @extract):**

```markdown
@description: Method-specific description @description.jsdoc: Concise JSDoc
description @business-context: Business scenario explaining usage  
@strategy: [merge|replace|append] @since: 1.0.0 @warning.jsdoc: Important usage
warning
```

**🚨 CRITICAL: TypeScript Example Formatting** \*\*ALL @example blocks must use

`````typescript formatting:**

````markdown
@extract: methodName:domain:complexity

```typescript
// Always use typescript code blocks
const result = SomeClass.method(params);
console.log('TypeScript formatted example');
`````

```

@extract-end

```

**CRITICAL: Always close @extract blocks with @extract-end**

## CRITICAL: Test Files Location

**When generating or creating test files, ALWAYS place them in the `tests/`
directory, NOT in `src/`.**

- ✅ CORRECT: `packages/[package]/tests/my-component.test.ts`
- ❌ WRONG: `packages/[package]/src/my-component.test.ts`

## CRITICAL: Documentation Updates

**When creating or updating functionality, ALWAYS update the corresponding
README.md file.**

- ✅ **REQUIRED**: Update `packages/[package]/README.md` when modifying package
  code
- ✅ **REQUIRED**: Include code examples showing new/updated functionality
- ✅ **REQUIRED**: Update API sections if public interfaces change
- ✅ **REQUIRED**: Keep LLM-METADATA sections current with actual exports
- ⚠️ **NOTE**: Focus on the specific package being changed, not all packages

## CRITICAL: JSDoc Documentation

**When creating or updating code, ALWAYS add comprehensive JSDoc
documentation.**

- ✅ **REQUIRED**: Add JSDoc to all exported classes, interfaces, functions, and
  types
- ✅ **REQUIRED**: Documentation is now managed through YAML files in Enhanced
  Metadata System V2
- ✅ **REQUIRED**: Provide minimum 2 `@example` blocks per public API in YAML
  files
- ✅ **REQUIRED**: Document all `@param`, `@returns`, and `@throws`
- ❌ **AVOID**: Using `console.log()` in code examples unless specifically
  demonstrating logging
- ✅ **PREFER**: Use comments like `// Result: variable contains expected value`
  instead
- ⚠️ **VALIDATION**: Run `pnpm jsdoc:validate` to check compliance
- 📖 **REFERENCE**: See `.jsdoc-template.md` for exact format requirements

### JSDoc Template Examples:

#### **For Implementations (Classes) - YAML Metadata System:**

**CRITICAL**: All JSDoc documentation is now managed through YAML files. This
system supports:

- **Hierarchical configuration**: Global, package, and local metadata layers
- **Format-specific overrides**: Different content for JSDoc vs CLI via dot
  notation (`@description.jsdoc`, `@description.cli`)
- **Selective display**: Tags can be omitted in one format while displayed in
  another
- **Automatic generation**: JSDoc is generated from YAML during build process

**Source code should NOT contain any special markers or directives**

Example YAML configuration:

```yaml
# docs/examples/domain/{package-name}/{class-name}/{method-name}.yaml
@description: Method description from YAML
@business-context: Business context explanation
@parameters:
  - name: param
    type: Type
    description: Parameter description
@returns:
  type: ReturnType
  description: Return value description
@throws:
  - type: ErrorType
    description: When validation fails
@example:
  - code: |
      const result = instance.methodName(param);
```

#### **For Interfaces (Contracts) - Static JSDoc Documentation:**

````typescript
/**
 * Brief description of the interface method contract
 * @param param Description of the parameter and its constraints
 * @returns Description of what the method returns
 * @throws Description of when and what errors are thrown
 * @example
 * ```typescript
 * // Concise example showing interface usage
 * const instance: IInterface = new Implementation();
 * const result = instance.methodName(param);
 * ```
 * @since 1.0.0
 */
methodName(param: Type): ReturnType;
````

### JSDoc Strategy by Code Type:

| Code Type                   | JSDoc Approach     | Purpose                                 | Example Source                                                  |
| --------------------------- | ------------------ | --------------------------------------- | --------------------------------------------------------------- |
| **Classes/Implementations** | Dynamic Directives | Business examples, real usage scenarios | MD files in `docs/examples/domain/{package-name}/{class-name}/` |
| **Interfaces/Contracts**    | Static Inline      | API contracts, parameter specifications | Written directly in interface                                   |
| **Types/Enums**             | Static Inline      | Type definitions, usage constraints     | Written directly in code                                        |

**Key Principle**: Avoid duplication - interfaces get precise contract
documentation, implementations get rich business examples.

### Enhanced Metadata System Structure

**CRITICAL: All method example MD files use the Enhanced Metadata System with
hierarchical configuration:**

#### **0. MANDATORY: Implementation Verification Protocol**

**🚨 BEFORE creating ANY enhanced metadata examples, ALWAYS verify
implementation 🚨**

```bash
# 1. READ THE ACTUAL IMPLEMENTATION FIRST
Read packages/[package]/src/**/*.ts

# 2. VERIFY METHOD EXISTENCE
Grep -r "methodName" packages/[package]/src/

# 3. CHECK METHOD SIGNATURES
Read the specific class file to understand parameters and return types

# 4. ONLY THEN create enhanced metadata documentation
```

**Enhanced Metadata MUST reflect actual implementation:**

- ✅ Use only methods that exist in the actual TypeScript code
- ✅ Match exact parameter types and names from implementation
- ✅ Use correct constructor patterns (e.g., `new ClassName(params)`)
- ❌ Never use fictional methods in enhanced metadata examples
- ❌ Don't assume factory methods exist without verification

#### **1. File Placement Pattern:**

**🚨 CRITICAL: ONE YAML file per TypeScript file (1:1 mapping)**

```
docs/examples/domain/
├── {package-name}/                 # Package folder (e.g., domain-services, aggregates)
│   ├── {typescript-filename}.yaml  # YAML file matching TypeScript filename EXACTLY
│   │                               # e.g., base-repository.ts → base-repository.yaml
│   │                               # Contains ALL classes/interfaces from that .ts file
│   └── {typescript-filename}/      # Optional: Folder for method-specific files
│       ├── methodName.yaml         # Method-specific metadata file
│       └── anotherMethod.yaml      # Another method metadata
```

**MANDATORY RULES:**

- ✅ **1:1 Mapping**: ONE YAML file per TypeScript file
- ✅ **Exact Name Match**: `aggregate-root.ts` → `aggregate-root.yaml`
- ✅ **All Elements**: YAML file contains ALL classes, interfaces, types, enums
  from the .ts file
- ❌ **NO Separate Files**: Do NOT create separate YAML files for each class
  (e.g., NO `version-error.yaml` if VersionError is in `base-repository.ts`)
- ✅ **Multiple Classes**: If `base-repository.ts` contains VersionError AND
  IBaseRepository, put BOTH in `base-repository.yaml`

#### **2. YAML File Structure - Hierarchical System**

**🚨 CRITICAL: Enhanced Metadata System V2 uses HIERARCHICAL INHERITANCE 🚨**

**Inheritance Chain**: `global-settings.yaml` → `.md-settings.yaml` →
`{class-name}.yaml`

**A. Global Settings Structure (`docs/global-settings.yaml`):**

```yaml
# Global Settings for VytchesDDD Enhanced Metadata System V2
# Provides base metadata for ALL packages and classes

# === GLOBAL DEFAULTS ===
author: 'VytchesDDD Team'
since: '1.0.0'
license: 'MIT'
documentation-url: 'https://docs.vytches.com/ddd'

# === HIERARCHICAL STRATEGY ===
hierarchy:
  strategy: 'merge' # merge | replace | append
  scope: 'global'

# === GLOBAL JSDOC PLACEMENT ===
jsdoc:
  placement-strategy: 'separate'
  class-documentation: 'enabled'
  constructor-documentation: 'enabled'

  class-defaults:
    description: 'VytchesDDD implementation'
    business-context: 'DDD library patterns'
```

**B. Package Settings Structure (`domain/[package]/.md-settings.yaml`):**

```yaml
# Package Settings - Inherits from global-settings.yaml

# === PACKAGE IDENTITY ===
package-name: 'aggregates'
display-name: 'DDD Aggregates'
description: 'Core aggregate patterns'

# === HIERARCHICAL STRATEGY ===
hierarchy:
  strategy: 'merge'
  scope: 'package'

# === PACKAGE METADATA ===
domain: 'domain-modeling'
complexity: 'intermediate'
patterns:
  - 'aggregate-pattern'
  - 'event-sourcing'
```

**C. Class/File Metadata Structure (`{class-name}.yaml`):**

```yaml
# [ClassName] - Universal Enhanced Metadata System V2

# === FILE METADATA ===
file-name: 'aggregate-root'
title: 'AggregateRoot - Enterprise Implementation'
description: 'Core aggregate root class'
business-context: 'Main DDD aggregate'

# === HIERARCHY ===
hierarchy:
  strategy: 'merge'
  scope: 'file'

# === CLASSES ===
classes:
  AggregateRoot:
    # JSDoc Configuration
    jsdoc:
      placement-strategy: 'separate'
      class-documentation: 'enabled'

    # Class Documentation
    class-doc:
      description: 'Enterprise aggregate root'
      business-context: 'Core DDD building block'

      # Format-specific
      formats:
        jsdoc:
          description: 'Aggregate with event sourcing'
        cli:
          description: |
            ## AggregateRoot
            Complete aggregate implementation

      custom-tags:
        since: '1.0.0'
        capabilities: 'Extensible capability system'

    # Methods
    methods:
      constructor:
        description: 'Creates new instance'
        business-context: 'Initializes aggregate'

        parameters:
          - name: 'params'
            type: 'IAggregateConstructorParams<TId>'
            description: 'Construction parameters'

        examples:
          - id: 'basic'
            code: |
              const aggregate = new AggregateRoot({
                id: EntityId.fromText('order-123'),
                version: 0
              });

      commit:
        description: 'Commits pending events'
        business-context: 'Finalizes transaction'

        returns:
          type: 'void'
          description: 'Clears pending events'

        custom-tags:
          warning: 'Clears pending events'
          event-sourcing: 'Persists events'

# === FILE-LEVEL ELEMENTS ===
types:
  ABC:
    description: 'Test type'
    business-context: 'Testing metadata'

interfaces:
  ITest:
    description: 'Test interface'
    properties:
      - name: 'name'
        type: 'string'

enums:
  IDtype:
    description: 'ID types'
    values:
      - name: 'UUID'
        value: "'uuid'"

functions:
  isIdType:
    description: 'Type guard'
    returns:
      type: 'boolean'
```

#### **3. Key Structural Elements**

**Core Sections in Class YAML Files:**

- `file-name`: Base name without extension
- `hierarchy`: Strategy configuration (merge/replace/append)
- `classes`: Main classes defined in the file
- `types`: Type aliases defined in the file
- `interfaces`: Interfaces defined in the file
- `enums`: Enumerations defined in the file
- `functions`: Standalone functions defined in the file
- `imported`: Optional documentation of imported types

**Method-Level Structure:**

- `description`: Technical description
- `business-context`: Business value explanation
- `parameters`: Array of parameter definitions
- `returns`: Return type and description
- `custom-tags`: Additional metadata tags
- `examples`: Array of code examples
- `formats`: Format-specific overrides

**Hierarchy Strategies:**

- `merge`: Combines with inherited metadata (default)
- `replace`: Completely overrides inherited metadata
- `append`: Adds to existing metadata

#### **4. YAML Structure Rules**

**🚨 MANDATORY RULES FOR HIERARCHICAL YAML FILES 🚨**

1. **Nested structure**: Use proper YAML nesting, NOT flat `@tag:` format
2. **Section headers**: Use `# === SECTION ===` format for clarity
3. **Hierarchy blocks**: Always specify `hierarchy:` with strategy and scope
4. **Multi-line strings**: Use pipe (`|`) for formatted text blocks
5. **Arrays**: Use proper YAML array syntax with `-` for lists
6. **Comments**: Use `#` for documentation and section markers
7. **Encoding**: UTF-8 without BOM
8. **Indentation**: Consistent 2-space indentation
9. **No document markers**: Never use `---`
10. **Case sensitivity**: Method names must match exactly (case-sensitive)

**Example of CORRECT hierarchical structure:**

```yaml
# === FILE METADATA ===
file-name: 'aggregate-root'
hierarchy:
  strategy: 'merge'
  scope: 'file'

# === CLASSES ===
classes:
  AggregateRoot:
    class-doc:
      description: 'Aggregate implementation'
      formats:
        jsdoc:
          description: 'Concise JSDoc version'
        cli:
          description: |
            ## Extended CLI Description
            With multiple lines

    methods:
      commit:
        description: 'Commits events'
        returns:
          type: 'void'
          description: 'No return value'
```

**Example of INCORRECT structure:**

```yaml
# ❌ WRONG - Using flat @ format
@description: Aggregate root
@businessContext: DDD pattern

# ❌ WRONG - Missing hierarchy configuration
classes:
  AggregateRoot:
    description: "Missing hierarchy block"

# ❌ WRONG - Using document markers
---
file-name: "aggregate-root"
```

#### **5. Examples:**

**Correct file paths:**

- ✅ `docs/examples/domain/aggregates/aggregate-root.yaml` (class metadata)
- ✅ `docs/examples/domain/aggregates/aggregate-root/commit.yaml` (method
  metadata)
- ✅ `docs/examples/domain/value-objects/entity-id.yaml` (class metadata)
- ✅ `docs/examples/domain/value-objects/entity-id/createwithrandomuuid.yaml`
  (method metadata)

**Incorrect file paths:**

- ❌ `packages/aggregates/src/examples/aggregate-root.yaml`
- ❌ `docs/examples/aggregates/AggregateRoot.yaml` (use lowercase)
- ❌ `docs/examples/domain/aggregates/methods/commit.yaml` (wrong structure)

**File naming**:

- Class names: Convert to lowercase with hyphens (e.g., `AggregateRoot` →
  `aggregate-root.yaml`)
- Method names: Convert to lowercase, no special chars (e.g.,
  `createWithRandomUUID` → `createwithrandomuuid.yaml`)
- Constructors: Always named `constructor.yaml`

#### **6. YAML Template Reference**

**🎯 Complete YAML template available at: `docs/examples/yaml-template.yaml`**

This template file contains:

- Complete class-level metadata structure
- Complete method-level metadata structure
- Constructor metadata examples
- Type/Interface/Enum metadata patterns
- All available metadata tags with descriptions
- Format-specific override examples
- Special metadata tags for advanced scenarios

**Use this template as a reference when creating new YAML metadata files!**

#### **7. CRITICAL: Enhanced Metadata System V2 Troubleshooting**

**🚨 COMMON ISSUES AND SOLUTIONS 🚨**

**A. .d.ts File Generation Issues:**

If TypeScript declaration files are missing method declarations or generating
incorrectly:

1. **Vite DTS Plugin Issues**: The vite-plugin-dts may not generate complete
   .d.ts files for builder patterns

   ```bash
   # Rebuild the package to regenerate .d.ts files
   pnpm build --filter=@vytches/ddd-aggregates

   # Check if methods are missing from .d.ts
   cat packages/aggregates/dist/core/aggregate-root.builder.d.ts
   ```

2. **Missing Method Declarations**: If .d.ts only shows class/function but no
   methods:

   - This is a build system issue, not YAML metadata issue
   - Methods must exist in .d.ts before JSDoc can be applied
   - Manually add method declarations if necessary during development

3. **JSDoc Injection Not Working**: If YAML metadata isn't applied to methods:

   ```bash
   # Debug JSDoc injection process
   JSDOC_DEBUG=true node scripts/inject-yaml-jsdoc-ast.js --package=aggregates

   # Check class name mapping (aggregate-root.builder.d.ts → aggregate-builder.yaml)
   ls docs/examples/domain/aggregates/
   ```

**B. File Naming Convention Issues:**

- **Source**: `aggregate-root.builder.ts`
- **Generated**: `aggregate-root.builder.d.ts`
- **YAML**: `aggregate-builder.yaml` (class name: AggregateBuilder)
- **Script expects**: Match between class name and YAML filename

**C. Build Order Dependencies:**

1. **TypeScript compilation** → generates .d.ts files
2. **JSDoc injection** → applies YAML metadata to .d.ts files
3. **Manual fixes** → may be needed if build system issues occur

**D. Debug Commands:**

```bash
# Step-by-step debugging
JSDOC_DEBUG=true node scripts/inject-yaml-jsdoc-ast.js --package=aggregates packages/aggregates/dist/core/aggregate-root.builder.d.ts

# Check build output
pnpm build --filter=@vytches/ddd-aggregates
wc -l packages/aggregates/dist/core/aggregate-root.builder.d.ts

# Verify YAML file structure
cat docs/examples/domain/aggregates/aggregate-builder.yaml
```

**E. Resolution Workflow:**

1. **Verify source code** has all expected methods
2. **Check .d.ts generation** after build
3. **Manually fix .d.ts** if build system issues
4. **Run JSDoc injection** to apply YAML metadata
5. **Verify final result** has both declarations and documentation

## CRITICAL: YAML-Only System Status (2025-08-09)

### 🚨 CURRENT STATE: TRANSITIONING TO PURE YAML CONFIGURATION 🚨

**The Enhanced Metadata System V2 has transitioned to a YAML-only approach:**

**✅ COMPLETED TRANSITIONS:**

- ✅ **Documentation System**: Fully operational YAML-based configuration
- ✅ **Build Integration**: TypeScript AST processing with YAML metadata
  injection
- ✅ **Package Coverage**: 5/22 packages fully documented with YAML files
- ✅ **File Structure**: All YAML files properly organized in
  `docs/examples/domain/`

**🔄 ONGOING CLEANUP:**

- **Source File Cleanup**: Removing old JSDoc markers from 244 TypeScript source
  files
- **Progress**: 4 files cleaned, 240+ remaining
- **Target**: Complete cleanup within 1-2 weeks

**📋 OLD PATTERNS (COMPLETELY REMOVED):**

```typescript
// ❌ OBSOLETE - All old JSDoc markers have been removed from source files
// Documentation is now entirely managed through YAML files
```

**✅ NEW APPROACH - Pure implementation files:**

```typescript
// ✅ CURRENT - Clean implementation only
export class SomeClass {
  // Pure implementation, no documentation markers
}
```

**✅ YAML Configuration drives all documentation:**

```yaml
# docs/examples/domain/{package}/{filename}.yaml
classes:
  SomeClass:
    class-doc:
      description: 'Class description'
      business-context: 'Business use case'
    methods:
      methodName:
        description: 'Method description'
        examples:
          - code: |
              const instance = new SomeClass();
```

**🚨 IMPORTANT FOR CONTRIBUTORS:**

- **DO NOT** add any JSDoc to TypeScript source files (it will be overwritten by
  YAML injection)
- **DO NOT** add `*-inject` directives to source files
- **DO** create YAML files in `docs/examples/domain/{package}/` for all
  documentation
- **DO** use the hierarchical YAML structure documented above

**📖 REFERENCE DOCUMENTATION:**

- `docs/JSDOC_EXAMPLES_ROADMAP.md` - Updated YAML-only system overview
- `docs/YAML_ONLY_CLEANUP_STATUS.md` - Current transition status
- `docs/examples/yaml-template.yaml` - YAML structure template

## Development Commands

```bash
# Primary workflow
pnpm dev           # Smart development mode
pnpm playground    # Testing/prototyping
pnpm test          # Run all tests
pnpm build         # Build all packages
pnpm lint          # Lint code
pnpm type-check    # Type checking
pnpm quality       # Run quality checks

# Enhanced Metadata System V2 & JSDoc Documentation
pnpm jsdoc:validate   # Validate JSDoc compliance with enhanced metadata V2
pnpm jsdoc:generate   # Generate JSDoc using hierarchical metadata system
pnpm jsdoc:publish    # Generate HTML documentation with hierarchical metadata
pnpm jsdoc:serve      # Generate and serve locally
pnpm jsdoc:watch      # Watch for changes and regenerate with metadata
pnpm jsdoc:verify     # Post-build verification with performance metrics
pnpm jsdoc:manual     # CLI fallback processing for debugging
pnpm jsdoc:benchmark  # Performance testing and cache analysis

# Enhanced Metadata System V2 Debug Commands
JSDOC_DEBUG=true pnpm dev        # Enhanced logging with hierarchy resolution
JSDOC_PERFORMANCE=true pnpm dev  # Performance monitoring and cache metrics
```

### Enhanced CLI Documentation Generation

**IMPORTANT**: Use `pnpm cli examples` with Enhanced Metadata System for all
documentation generation tasks.

```bash
# Generate Package Documentation with Enhanced Metadata
pnpm cli examples generate <package> --complexity <level> --enhanced-metadata
pnpm cli examples generate domain-services --complexity intermediate --format cli
pnpm cli examples generate policies --framework nestjs --llm-optimized --enhanced-metadata

# Generate Multi-Package Bundles with Metadata Hierarchy
pnpm cli examples bundle --packages <packages> --framework <framework> --enhanced-metadata
pnpm cli examples bundle --packages policies,domain-services --framework nestjs --format cli

# Find Examples by Tag (Enhanced Metadata Compatible)
pnpm cli examples find-by-tag <tag> --complexity <level> --enhanced-metadata
pnpm cli examples find-by-tag "policies:core" --max-examples 3 --format jsdoc

# Validate Examples with Enhanced Metadata
pnpm cli examples validate --package <package> --fix --enhanced-metadata
pnpm cli examples validate --package policies --fix --check-metadata

# Test Enhanced Metadata Workflow
pnpm cli examples test-metadata --file <path-to-md> --format <jsdoc|cli>
pnpm cli examples parse-metadata --file aggregate-root.md --debug

# Available CLI Options
--complexity <level>     # basic, intermediate, advanced
--framework <name>       # nestjs, express, fastify
--llm-optimized         # Optimize for LLM consumption
--enhanced-metadata     # Use enhanced metadata system (default: true)
--format <type>         # jsdoc, cli - controls format-specific resolution
--max-examples <num>    # Limit number of examples
--randomize            # Randomize example selection
--seed <string>        # Seed for reproducible randomization
--output <path>        # Output file path
--di-only              # Show only @vytches/ddd-di examples
--fix                  # Auto-fix validation issues
--check-metadata       # Validate enhanced metadata structure
--debug                # Debug metadata parsing and resolution
```

### Architecture Decision Records

```bash
pnpm adr:new "Decision Title"  # Create new ADR
pnpm adr:list                  # List all ADRs
```

All significant architectural decisions MUST be documented as ADRs.

## Package Architecture

### Import Strategy

**External Consumers:**

```typescript
import { AggregateRoot, EntityId, BaseError } from '@vytches/ddd-core';
import { Logger } from '@vytches/ddd-logging';
import { CommandBus } from '@vytches/ddd-cqrs';
```

**Internal Packages:**

```typescript
// Core building blocks - direct imports
import { IActor } from '@vytches/ddd-domain-primitives';
import type { EntityId } from '@vytches/ddd-contracts';

// Higher-level packages - meta-package imports
import { AggregateRoot, EntityId } from '@vytches/ddd-core';
```

### Module Boundaries & Import Strategy

The project enforces strict module boundaries via ESLint and uses an
**Enterprise Meta-Package Pattern** for API stability:

#### **Import Strategy - CRITICAL for Enterprise Usage:**

**1. External Consumers (Applications using the library):**

```typescript
// ✅ ALWAYS import from meta-package for stable API
import { AggregateRoot, EntityId, BaseError } from '@vytches/ddd-core';
import { Logger } from '@vytches/ddd-logging';
import { CommandBus } from '@vytches/ddd-cqrs';
import { VytchesDDD, DomainService, ServiceLifetime } from '@vytches/ddd-di';
```

**2. Internal Monorepo Packages:**

**Core Building Blocks** (domain-primitives, value-objects, repositories,
aggregates):

```typescript
// ✅ Direct imports to prevent circular dependencies
import { IActor } from '@vytches/ddd-domain-primitives';
import type { EntityId } from '@vytches/ddd-contracts'; // EntityId interfaces from contracts
import { EntityId } from '@vytches/ddd-value-objects'; // Enhanced EntityId implementation
```

**Higher-Level Packages** (events, cqrs, domain-services, etc.):

```typescript
// ✅ Import through meta-package for stability
import { AggregateRoot, EntityId } from '@vytches/ddd-core';
```

**3. Examples & Testing:**

```typescript
// ✅ Can import directly for development/testing
import { AggregateRoot } from '@vytches/ddd-aggregates';
import type { EntityId } from '@vytches/ddd-contracts'; // For type definitions
// OR through stable API
import { AggregateRoot } from '@vytches/ddd-core';
```

#### **Module Boundary Rules:**

- **Contracts package**: Foundation layer providing core interfaces (EntityId,
  domain contracts)
- **Core building blocks**: Import EntityId from contracts, minimal other
  dependencies
- **Higher-level packages**: Must import through `@vytches/ddd-core`
- **Testing package**: Can depend on all packages, uses contracts for EntityId
- **Examples**: Can use any import pattern
- **ESLint enforcement**: Prevents inappropriate cross-dependencies
- **Circular dependency prevention**: Contracts package breaks circular
  dependencies

## Development Workflow

### Recommended Development Flow

1. Use `pnpm playground` for feature development and testing
2. The playground automatically watches core packages and provides hot reload
3. Edit packages in `packages/*/src/` and test in `examples/playground/src/`
4. Tests run automatically on file changes

### Working with Specific Packages

- Use `pnpm dev:<package-name>` to focus on specific packages
- Dependencies are automatically included in watch mode
- TypeScript paths are configured for seamless imports

### Package Structure Convention

Each package follows this structure:

```text
packages/<package-name>/
├── src/
│   ├── index.ts           # Main export file
│   ├── <domain>/          # Domain-specific code
│   └── types/             # Type definitions
├── tests/                 # Test files (OUTSIDE of src/)
│   ├── *.test.ts          # Unit tests
│   ├── *.spec.ts          # Spec tests
│   └── <domain>/          # Tests organized by domain
├── package.json           # Package configuration
├── project.json           # Nx project configuration
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite/Vitest configuration
```

**IMPORTANT**: Test files MUST be placed in the `tests/` directory, NOT in
`src/`. This prevents circular dependencies where foundation packages would
import from the testing package.

## Testing Strategy

### Test File Naming Convention

**IMPORTANT**: Use `.test.ts` extension for all test files, NOT `.spec.ts`. This
is the standard convention used throughout the codebase and aligns with modern
TypeScript frameworks like Jest, Vitest, and others.

- ✅ CORRECT: `user-service.test.ts`
- ❌ WRONG: `user-service.spec.ts`

### Test Organization

- Unit tests: `*.test.ts` files in `tests/` directory (NOT in `src/`)
- Integration tests: In `examples/` directory
- API surface tests: `api-surface.test.ts` files in `tests/` directory
- Test file structure mirrors source structure: `src/domain/entity.ts` →
  `tests/domain/entity.test.ts`

### Test Utilities

- Use `@vytches/ddd-testing` package for DDD-specific test utilities
- Vitest configuration supports package aliases
- Coverage thresholds: 80% for branches, functions, lines, statements

### Test Error Handling Patterns

**CRITICAL**: All test files MUST use `safeRun` from `@vytches/ddd-utils` for
error testing. Never use Jest/Vitest `toThrow` patterns.

**NOTE**: `safeRun` is specifically designed for testing scenarios. In normal
implementation code, use standard try/catch blocks or Result patterns from
`@vytches/ddd-utils` for error handling.

**Required Patterns:**

```typescript
// ✅ CORRECT: Use safeRun for synchronous error testing
import { safeRun } from '@vytches/ddd-utils';

const [error] = safeRun(() => someFunction());
expect(error).toBeInstanceOf(ErrorClass);
expect(error?.message).toBe('Expected error message');
expect(error).toBeDefined(); // For any error
expect(error).toBeNull(); // For no error

// ✅ CORRECT: Use safeRun for asynchronous error testing
const [asyncError] = await safeRun(async () => await someAsyncFunction());
expect(asyncError).toBeInstanceOf(ErrorClass);

// ✅ CORRECT: Use safeRun for functions that should not throw
const [noError] = safeRun(() => validFunction());
expect(noError).toBeNull();
```

**Deprecated Patterns to Avoid:**

```typescript
// ❌ WRONG: Do not use these patterns
expect(() => someFunction()).toThrow(ErrorClass);
expect(() => someFunction()).toThrow('error message');
expect(() => someFunction()).not.toThrow();
await expect(async () => someFunction()).rejects.toThrow(ErrorClass);
```

**Migration Guidelines:**

- Always import `safeRun` from `@vytches/ddd-utils` at the top of test files
- Replace `expect(() => fn()).toThrow(ErrorClass)` with
  `const [error] = safeRun(() => fn()); expect(error).toBeInstanceOf(ErrorClass)`
- Replace `expect(() => fn()).toThrow(message)` with
  `const [error] = safeRun(() => fn()); expect(error?.message).toBe(message)`
- Replace `expect(() => fn()).not.toThrow()` with
  `const [error] = safeRun(() => fn()); expect(error).toBeUndefined()`
- Use descriptive variable names for errors: `throwError`, `validationError`,
  `configError`, etc.

### Test Generation Examples

When generating test files, follow these patterns:

**Example Test File Structure:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { UserService } from '../src/user-service';
import { ValidationError, NotFoundError } from '@vytches/ddd-domain-primitives';

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

    it('should handle async operations correctly', async () => {
      const [saveError, result] = await safeRun(
        async () => await service.saveUser({ name: 'Jane' })
      );

      expect(saveError).toBeUndefined();
      expect(result?.id).toBeDefined();
    });
  });
});
```

**Key Points for Test Generation:**

1. **File naming**: Always use `.test.ts` extension
2. **Import safeRun**: Always import from `@vytches/ddd-utils`
3. **Error handling**: Use safeRun for all error assertions
4. **Variable naming**: Use descriptive names like `validationError`,
   `notFoundError`
5. **Async handling**: Use `await safeRun(async () => ...)` for async operations
6. **Error checks**: Use `.toBeUndefined()` for no error, `.toBeInstanceOf()`
   for error types
7. **Message checks**: Use `.toContain()` for error messages that might have
   prefixes

## Code Style & Quality

### TypeScript Configuration

- Strict mode enabled with additional checks
- Exact optional property types
- No unchecked indexed access
- No implicit returns or fallthrough cases

### ESLint Rules

- Explicit function return types required
- Consistent type imports preferred
- Module boundary enforcement
- No unused variables (except underscore-prefixed)

### Conventions

- Use interfaces over type aliases
- Prefer type imports for better tree-shaking
- Follow established patterns for new components
- Maintain consistency with existing code style

### TypeScript Typing Guidelines

**CRITICAL**: When creating functionality, avoid using the `any` type whenever
possible

- ❌ **AVOID**: Using `any` type unless there's a strong business justification
- ✅ **PREFER**: Proper typing with specific interfaces, types, or generics
- ✅ **USE**: `unknown` instead of `any` when the type is truly unknown
- ✅ **USE**: Generic types `<T>` for flexible but type-safe code

**Examples:**

```typescript
// ❌ WRONG: Avoid any
function processData(data: any): any {
  return data.value;
}

// ✅ CORRECT: Use proper types
function processData<T extends { value: string }>(data: T): string {
  return data.value;
}

// ✅ CORRECT: Use unknown for truly unknown types
function handleUnknownData(data: unknown): void {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    console.log(data.value);
  }
}
```

**Exceptions**: Only use `any` when:

- Integrating with third-party libraries that lack proper types
- Creating temporary workarounds that will be properly typed later (add TODO
  comment)
- The business logic explicitly requires dynamic typing (document the reason)

## Enterprise Features

### Bundle Strategies

- **Core Bundle**: Core building blocks (core + utils + validation)
- **Advanced Bundle**: Core + event-driven patterns (+ events + cqrs +
  projections)
- **Enterprise Bundle**: All features (+ acl + policies + messaging +
  resilience)

### Development Tooling

- Smart development mode detects changes automatically
- Package-specific workflows with dependency resolution
- Comprehensive validation and analysis scripts
- Automated bundle size and export validation

## Notes for Development

### Current State

- **Core Infrastructure**: Complete monorepo setup with build tooling and
  comprehensive logging
- **Foundation Layer**: Modular core architecture with meta-package pattern
  (99.2% size reduction)
  - **@vytches/ddd-core**: Enterprise meta-package (1.4KB) providing stable API
  - **@vytches/ddd-domain-primitives**: Base classes, errors, interfaces (40KB)
  - **@vytches/ddd-value-objects**: Value object implementations, EntityId
    (36KB)
  - **@vytches/ddd-repositories**: Repository patterns, UnitOfWork (40KB)
  - **@vytches/ddd-aggregates**: Aggregate root + capabilities (82KB)
- **Patterns Layer**: Advanced validation with specifications and fluent policy
  builder implemented
- **Architecture Layer**: Event-driven architecture with domain events, CQRS,
  and projections with capabilities
- **Integration Layer**: Anti-corruption layer and outbox pattern messaging
  implemented
- **Infrastructure Layer**: Comprehensive resilience patterns with observability
  and logging
- **Tooling Layer**: CLI framework and testing utilities with logging
  integration
- **Development Workflow**: Fully functional with smart development mode and
  testing
- **Package Structure**: Enterprise-grade module boundaries with import strategy
  enforcement
- **Enterprise Logging**: Complete structured logging system integrated across
  all packages
- **API Stability**: Meta-package pattern provides enterprise-grade API
  stability
- **Circular Dependency Resolution**: Enterprise-grade architecture with
  contracts foundation
- **TypeScript Configuration**: Standardized across all packages with proper
  include paths
- **Test File Organization**: All test files moved to `tests/` directories to
  prevent circular dependencies

### Recently Implemented Features

#### NEW: Test Files Migration to Prevent Circular Dependencies - COMPLETED

**IMPORTANT ARCHITECTURAL CHANGE**: All test files moved from `src/` to `tests/`
directories

- **Problem Solved**: Foundation packages (value-objects, repositories) were
  importing from @vytches/ddd-testing in their test files
- **Solution**: Moved all `*.test.ts` and `*.spec.ts` files to dedicated
  `tests/` directories
- **Scope**: 16 packages updated with ~80 test files migrated
- **Configuration Updates**:
  - All `vite.config.ts` updated to look for tests in `tests/` directory
  - All `tsconfig.json` updated to include `tests/**/*` in compilation
  - Import paths in test files updated to reference `../src/` appropriately
- **Result**: Foundation layers now have zero runtime dependencies on testing
  package
- **ESLint Compliance**: Relative imports used within packages as enforced by
  module boundary rules

#### NEW: Enterprise Circular Dependency Resolution - COMPLETED

**BREAKING CHANGE**: EntityId moved to contracts package for enterprise-grade
architecture

- **Contracts Foundation**: EntityId interfaces moved to
  `@vytches/ddd-contracts` as fundamental building block
- **Circular Dependency Elimination**: Resolved circular dependencies between
  testing and value-objects packages
- **Enterprise Architecture**: Two-layer EntityId pattern with base
  implementation in contracts and enhanced validation in value-objects
- **Type Safety**: Full TypeScript compliance with IEntityId interface contracts
- **Factory Methods**: Built-in UUID, text, integer, and bigint factory methods
  in base EntityId
- **Enhanced Validation**: Value-objects package provides enhanced EntityId with
  LibUtils integration
- **Testing Integration**: Testing package now uses contracts EntityId,
  eliminating circular dependencies
- **Backward Compatibility**: All existing APIs maintained while improving
  architecture
- **Import Strategy**: Clear separation between base EntityId (contracts) and
  enhanced EntityId (value-objects)
- **Enterprise Grade**: No shortcuts, comprehensive solution following DDD
  principles
- **TypeScript Configuration**: Standardized tsconfig.json across all 22
  packages for proper dependency resolution
- **ADR Documentation**: Architectural decision recorded for future reference

#### NEW: Unified Event System (@vytches/ddd-events) - MAJOR REFACTOR COMPLETED

**BREAKING CHANGE**: Complete event system redesign for enterprise-grade event
handling

- **3→1 Event Bus Consolidation**: Eliminated `InMemoryDomainEventBus`,
  `InMemoryIntegrationEventBus`, and redundant dispatcher layers
- **UnifiedEventBus**: Single, optimized event bus handling all event types
  (domain, integration, audit)
- **Context-Aware Routing**: Smart event filtering by contextId with flexible
  subscription patterns
- **Repository Integration**: Full integration with `IBaseRepository.save()` for
  automatic event publishing
- **UniversalEventDispatcher**: Enhanced dispatcher with middleware pipeline and
  event processors
- **Enterprise Features**:
  - Concurrent event publishing with `publishMany()`
  - Aggregate convenience methods with `publishEventsForAggregate()`
  - Transaction-safe event persistence and publishing
  - Optimistic concurrency control
- **Industry Alignment**: Follows patterns from MediatR (.NET), Spring
  Framework, and Axon Framework
- **Performance**: 67% reduction in event handling code, ~50% faster processing
- **Type Safety**: Zero `any` types, full TypeScript compliance
- **Clean Architecture**: Repository pattern handles event publishing
  automatically
- **ADR Documentation**: Complete architectural decision record (ADR-0006) with
  implementation results

#### NEW: Enterprise Meta-Package Architecture (@vytches/ddd-core)

- **Core Package Decomposition**: Transformed monolithic core (184KB) into
  modular architecture (1.4KB meta-package)
  - **@vytches/ddd-domain-primitives**: Base classes, errors, and interfaces
    (40KB)
  - **@vytches/ddd-value-objects**: Value object implementations and EntityId
    (36KB)
  - **@vytches/ddd-repositories**: Repository patterns and UnitOfWork (40KB)
  - **@vytches/ddd-aggregates**: Aggregate root with capabilities (82KB)
- **Enterprise API Stability**: Single stable entry point through meta-package
  pattern
- **Import Strategy Enforcement**: Standardized import patterns for internal vs
  external usage
- **Backward Compatibility**: Zero breaking changes during decomposition
- **Tree-Shaking Excellence**: 100% effective tree-shaking with explicit exports
- **Bundle Size Optimization**: 99.2% reduction in core package size
- **Module Boundaries**: ESLint-enforced architectural boundaries

#### NEW: Logging Package (@vytches/ddd-logging)

- **DDD-First Design**: Built specifically for Domain-Driven Design patterns
  with automatic bounded context detection
- **Smart Context Detection**: Automatically detects class names, method names,
  and bounded contexts from stack traces
- **Structured Logging**: JSON-based logging with rich metadata support and
  correlation tracking
- **Data Masking**: Automatic PII and sensitive data masking with customizable
  patterns and replacement strategies
- **Zero Configuration**: Works out of the box with sensible defaults, no
  configuration required
- **Pluggable Providers**: Easy integration with Winston, Pino, or custom
  logging providers
- **CQRS Integration**: Decorators (`@LogCommands`, `@LogQueries`, `@LogCQRS`)
  with automatic execution timing and payload logging
- **Result Pattern Integration**: Extensions for `@vytches/ddd-utils` Result
  pattern with success/failure logging
- **Aggregate State Logging**: `@LogStateChanges` decorator for automatic
  aggregate state change tracking
- **Context Propagation**: Built-in support for correlation IDs, user IDs,
  tenant IDs, request IDs, and session IDs
- **Enterprise Features**: Multiple log levels, conditional logging, child
  loggers, and context enrichment
- **Integration Coverage**: Fully integrated across all packages (core, events,
  cqrs, resilience, messaging, etc.)

#### Business Policies Package (@vytches/ddd-policies) - V2

- **Unified Promise-Based API**: Consistent async interface across all policy
  operations
- **Enterprise Context System**: Built-in audit trails, multi-tenancy, and
  correlation tracking
- **Advanced Fluent Builder**: Rich API with `.must()`, `.mustAsync()`,
  `.when().then().otherwise()`
- **Specification Integration**: Direct support for ISpecification and
  IAsyncSpecification patterns
- **Complex Group Logic**: PolicyGroup for sophisticated AND/OR business rule
  combinations
- **Rich Violation System**: Structured violations with severity levels
  (ERROR/WARNING/INFO)
- **Conditional Policies**: Dynamic policy execution based on runtime conditions
- **Event-Driven Architecture**: Automatic policy evaluation events for
  observability
- **Policy Registry**: Central registration with domain-based organization and
  querying
- **Policy Behaviors**: MediatR-style behaviors for cross-cutting concerns
  - `PolicyRetryBehavior`: Business rule retry logic for transient failures
  - `PolicyCachingBehavior`: Policy-specific caching with business semantics
  - `PolicyTemporalBehavior`: Time-aware policy execution for business rules
- **Adapter Pattern Ready**: Framework for integrating external validation
  libraries

#### Event Projections Package (@vytches/ddd-projections)

- **Projection Engine**: Enhanced projection engine with retry capabilities
- **Capability System**: Extensible capabilities (checkpoints, circuit breakers,
  dead letter handling)
- **Error Strategies**: Configurable retry strategies with exponential backoff
- **Lifecycle Hooks**: Before/after hooks for projection processing
- **State Management**: Automated initial state creation and persistence

#### Shared Contracts Package (@vytches/ddd-contracts)

- **Foundation Layer**: Core interfaces and contracts for entire library
- **EntityId Foundation**: Base EntityId interface and implementation breaking
  circular dependencies
- **Domain Event Interfaces**: Standardized event contracts across packages
- **Aggregate Interfaces**: Common aggregate behavior contracts
- **Validation Interfaces**: Specification and validator contracts
- **Event Infrastructure**: Event bus, dispatcher, and store interfaces
- **Factory Methods**: Built-in UUID, text, integer, and bigint EntityId
  factories
- **Type Safety**: Full TypeScript interface contracts with IEntityId
- **Enterprise Architecture**: Prevents circular dependencies while maintaining
  functionality

#### Enhanced Validation Package (@vytches/ddd-validation)

- **Composite Specifications**: Combine specifications with AND/OR/NOT
  operations
- **Business Rule Validators**: Domain-specific validation with error context
- **Adapter Pattern**: External validator integration support
- **Validation Facade**: Simplified validation API with comprehensive error
  reporting
- **Logging Integration**: All validation operations now include structured
  logging

#### Event Store Package (@vytches/ddd-event-store)

- **Stream-based Storage**: Organize events by aggregate streams with version
  control
- **Optimistic Concurrency Control**: Version-based conflict detection and
  resolution
- **Snapshot Support**: Performance optimization for large aggregates with
  configurable frequency
- **Global Event Log**: Read all events across streams with filtering and
  pagination
- **Event Serialization**: Pluggable serialization strategies with JSON default
- **Storage Adapters**: In-memory implementation with pattern for PostgreSQL,
  MongoDB adapters
- **Rich Metadata**: Correlation, causation, and custom metadata support for
  events
- **Error Handling**: Comprehensive error hierarchy with domain-specific
  exceptions
- **NestJS Integration**: Production-ready TypeORM entities and module
  configuration
- **Security Features**: Encryption, checksums, and audit logging for sensitive
  events
- **Performance Optimization**: Connection pooling, caching, and indexing
  strategies
- **Testing Support**: Complete test coverage with event store test harness
  utilities

#### Enhanced CQRS Package (@vytches/ddd-cqrs)

- **Advanced Middleware System**: Enhanced execution context and logging
  middleware
- **Decorator-Based Logging**: `@LogCommands`, `@LogQueries`, and `@LogCQRS`
  decorators for automatic logging
- **Performance Monitoring**: Built-in execution timing and performance metrics
- **Handler Registration**: Enhanced decorator-based handler registration with
  metadata
- **Context Propagation**: Rich context propagation with correlation tracking

#### Enhanced Resilience Package (@vytches/ddd-resilience)

- **Circuit Breaker Pattern**: Three-state circuit breaker
  (CLOSED/OPEN/HALF_OPEN) with automatic recovery
- **Retry Pattern**: Exponential backoff with jitter, configurable retry
  conditions and maximum attempts
- **Bulkhead Pattern**: Resource isolation with concurrency limits and queue
  management
- **Timeout Strategy**: Operation timeouts with AbortSignal integration
- **Strategy Composition**: Combine multiple resilience patterns via
  CompositeResilienceStrategy
- **Fluent Policy Builder**: Chainable pattern configuration with
  ResiliencePolicyBuilder
- **Resilience Context**: Correlation tracking, attempt counting, and metadata
  propagation
- **Comprehensive Observability**: Metrics collection, event bus, and multiple
  export formats
- **Decorator System**: Method decorators for applying resilience patterns
- **Zero Dependencies**: Pure TypeScript implementation with no external runtime
  dependencies
- **Logging Integration**: All resilience operations include structured logging
  with context

#### Enhanced Messaging Package (@vytches/ddd-messaging)

- **Outbox Pattern**: Complete implementation with reliable message delivery
- **Priority Processing**: Configurable message priorities
  (LOW/NORMAL/HIGH/CRITICAL)
- **Delayed Messages**: Support for scheduled message processing
- **Batch Operations**: Efficient bulk message handling
- **Retry Mechanism**: Configurable retry logic with exponential backoff
- **Middleware Support**: Extensible message processing pipeline
- **Domain Event Integration**: Seamless conversion of domain events to outbox
  messages
- **Comprehensive Testing**: Full test coverage for outbox functionality
- **Sagas Support**: Basic interfaces defined (implementation pending)
- **Logging Integration**: All messaging operations include comprehensive
  structured logging

#### Enterprise Package (@vytches/ddd-enterprise)

- **Bundle Architecture**: Enterprise-grade package aggregation
- **Health Checks**: Interface for system health monitoring (implementation
  pending)
- **Monitoring**: Basic monitoring configuration (implementation pending)
- **Enterprise Configuration**: Centralized configuration management

#### CLI Package (@vytches/ddd-cli)

- **Code Generation Framework**: Basic structure for DDD component generation
- **Template System**: Foundation for Value Objects, Entities, and Aggregates
- **Command Interface**: CLI runner with help system
- **Configuration Support**: Output directory and template configuration
- **Binary Distribution**: `vytches-ddd` command available after installation

#### Dependency Injection Package (@vytches/ddd-di)

- **Global Service Locator**: Unified approach following MediatR pattern with
  enterprise-grade capabilities
- **Auto-Discovery System**: Plugin-based discovery through enhanced decorators
  (@DomainService, @CommandHandler, @QueryHandler)
- **Context Isolation**: Optional bounded context support for DDD scenarios with
  smart resolution
- **Framework Integration**: Adapter pattern for NestJS, InversifyJS, TSyringe,
  and custom containers
- **Service Lifetimes**: Support for Transient, Singleton, and Scoped service
  registration
- **Enhanced Decorators**: Rich configuration options for timeout, middleware,
  retry policies, and dependencies
- **Type Safety**: Full TypeScript support with generic type resolution and
  compile-time validation
- **Testing Support**: Easy mocking and isolated testing with container reset
  and disposal
- **Performance**: Zero overhead with lazy resolution, compile-time
  registration, and tree-shaking friendly
- **Enterprise Ready**: Production-grade service locator with comprehensive
  error handling and logging integration

## Logging Usage Guide

### Basic Logging Setup

```typescript
import { Logger } from '@vytches/ddd-logging';

// Auto-detects context from class name
class UserService {
  private logger = Logger.forContext(); // Auto-detects "UserService"

  createUser(userData: UserData): void {
    this.logger.info('Creating user', { userId: userData.id });
  }
}
```

### Advanced Context and Correlation

```typescript
// With correlation tracking
const logger = Logger.forContext('OrderService')
  .withCorrelationId('req-123')
  .withUserId('user-456')
  .withContext({ boundedContext: 'OrderManagement' });

logger.info('Processing order', { orderId: 'order-789' });
```

### CQRS Integration

```typescript
@LogCommands({ includePayload: true, logLevel: 'debug' })
class CreateUserCommandHandler {
  async handle(command: CreateUserCommand): Promise<Result<User, Error>> {
    // Automatic logging of command execution with timing
    return await this.userService.createUser(command);
  }
}
```

### Data Masking Configuration

```typescript
Logger.configure({
  masking: {
    enabled: true,
    sensitiveKeys: ['password', 'email', 'ssn', 'creditCard'],
    replacement: '[MASKED]',
  },
});
```

## Dependency Injection Usage Guide

### Basic DI Setup

```typescript
import { VytchesDDD, SimpleContainer, DomainService } from '@vytches/ddd-di';

// One-time setup with auto-discovery
const container = new SimpleContainer();
VytchesDDD.configure(container); // Auto-discovers all decorated services

// Services are automatically registered and available
const service = VytchesDDD.resolve<UserService>('userService');
```

### Framework Integration with Bridge Pattern

**CRITICAL**: Use Bridge Pattern to avoid Double Instance Risk when integrating
with frameworks like NestJS.

#### NestJS Integration (Recommended Pattern)

```typescript
// 1. Domain service with VytchesDDD
@DomainService('userService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'UserManagement',
})
class UserService {
  // Business logic with @Resilience, timeouts, etc.
  async createUser(data: CreateUserData): Promise<Result<User, Error>> {
    // Business implementation
  }
}

// 2. Framework bridge service
@Injectable()
export class UserController {
  private readonly userService: UserService;

  constructor() {
    // ⭐ Bridge Pattern: Get existing instance from VytchesDDD
    this.userService = VytchesDDD.resolve<UserService>('userService');
  }

  @Post('users')
  async createUser(@Body() userData: CreateUserData) {
    // Delegate to VytchesDDD instance
    const result = await this.userService.createUser(userData);
    // Handle result...
  }
}

// 3. Module configuration
@Module({
  controllers: [UserController],
})
export class UserModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
    await VytchesDDD.configure();
  }
}
```

#### Bridge Utility for Complex Scenarios

```typescript
export class VytchesDDDBridge {
  static createNestJSProvider<T>(serviceId: string) {
    return {
      provide: serviceId,
      useFactory: () => {
        const instance = VytchesDDD.resolve<T>(serviceId);
        if (!instance) {
          throw new Error(
            `Service ${serviceId} not found in VytchesDDD container`
          );
        }
        return instance;
      },
    };
  }
}

@Module({
  providers: [
    VytchesDDDBridge.createNestJSProvider<UserService>('userService'),
    VytchesDDDBridge.createNestJSProvider<OrderService>('orderService'),
  ],
})
export class DomainModule implements OnModuleInit {
  async onModuleInit() {
    await VytchesDDD.configure();
  }
}
```

### Key Principles for Framework Integration

1. **VytchesDDD First**: Always initialize VytchesDDD container before framework
   DI
2. **Single Instance**: Use factory pattern to get existing instances, never
   create new ones
3. **No Dual Decorators**: Either `@DomainService` OR `@Injectable`, never both
   on same class
4. **Business Logic in Domain**: Keep business functionality in `@DomainService`
   classes
5. **Framework as Bridge**: Framework services are thin wrappers that delegate
   to VytchesDDD instances

### Domain Service with DI

```typescript
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';

// Simple service registration
@DomainService('userService')
class UserService {
  async createUser(userData: UserData): Promise<User> {
    // Service automatically discovered and registered
    return User.create(userData);
  }
}

// Advanced service with full DI options
@DomainService({
  serviceId: 'orderService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement',
  dependencies: ['paymentService', 'inventoryService'],
  autoRegister: true,
})
class OrderService {
  async processOrder(order: Order): Promise<OrderResult> {
    // Context-aware service resolution
    const paymentService = VytchesDDD.resolve<PaymentService>(
      'paymentService',
      'OrderManagement'
    );
    return await paymentService.processPayment(order);
  }
}
```

### CQRS Integration with DI

```typescript
import { CommandHandler, DomainService } from '@vytches/ddd-di';

// Enhanced command handler with DI options
@CommandHandler(CreateOrderCommand, {
  context: 'OrderManagement',
  timeout: 30000,
  middleware: [ValidationMiddleware, LoggingMiddleware],
})
class CreateOrderHandler {
  async execute(command: CreateOrderCommand): Promise<void> {
    // Services resolved automatically through DI
    const orderService = VytchesDDD.resolve<OrderService>('orderService');
    await orderService.createOrder(command);
  }
}
```

### Context Isolation for DDD

```typescript
// Setup context-specific containers for bounded contexts
const orderContainer = new SimpleContainer();
const paymentContainer = new SimpleContainer();

// Register context-specific services
orderContainer.registerInstance('orderConfig', { timeout: 30000 });
paymentContainer.registerInstance('paymentConfig', { retries: 3 });

// Configure contexts
VytchesDDD.configureContext('OrderManagement', orderContainer);
VytchesDDD.configureContext('PaymentProcessing', paymentContainer);

// Context-aware service resolution
const orderService = VytchesDDD.resolve<OrderService>(
  'orderService',
  'OrderManagement'
);
const paymentService = VytchesDDD.resolve<PaymentService>(
  'paymentService',
  'PaymentProcessing'
);
```

## Saga Framework Usage Guide

### Basic Saga Implementation

```typescript
import { BaseSaga, SagaStatus } from '@vytches/ddd-messaging';
import type {
  IExtendedDomainEvent,
  ISagaExecutionContext,
  ISagaActionResult,
} from '@vytches/ddd-messaging';

// Define saga for long-running business processes
class OrderProcessingSaga extends BaseSaga {
  constructor() {
    super('OrderProcessingSaga', 'Order Processing Workflow');
  }

  // Handle domain events in the saga
  async handleEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    switch (event.eventType) {
      case 'OrderCreated':
        return await this.handleOrderCreated(event, context);
      case 'PaymentProcessed':
        return await this.handlePaymentProcessed(event, context);
      case 'InventoryReserved':
        return await this.handleInventoryReserved(event, context);
      default:
        return {
          success: false,
          error: { message: 'Unhandled event type', code: 'UNHANDLED_EVENT' },
        };
    }
  }

  // Define which events this saga can handle
  canHandle(event: IExtendedDomainEvent): boolean {
    return [
      'OrderCreated',
      'PaymentProcessed',
      'InventoryReserved',
      'OrderFailed',
    ].includes(event.eventType);
  }

  // Compensation logic for failed transactions
  async compensate(
    stepName: string,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Implement compensation logic based on current step
    switch (stepName) {
      case 'PaymentProcessed':
        return await this.refundPayment(context);
      case 'InventoryReserved':
        return await this.releaseInventory(context);
      default:
        return { success: true };
    }
  }

  private async handleOrderCreated(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Move to next step and emit commands
    this.updateState({
      currentStep: 'ProcessPayment',
      stepData: { ...this.state.stepData, orderId: event.payload.orderId },
    });

    return {
      success: true,
      commands: [{ type: 'ProcessPayment', payload: event.payload }],
      events: [{ eventType: 'PaymentRequested', payload: event.payload }],
    };
  }
}
```

### Saga Orchestrator Usage

```typescript
import {
  SagaOrchestrator,
  InMemorySagaRepository,
} from '@vytches/ddd-messaging';

// Setup saga infrastructure
const sagaRepository = new InMemorySagaRepository();
const orchestrator = new SagaOrchestrator(sagaRepository, {
  maxConcurrentExecutions: 50,
  enableMetrics: true,
  enableAutoRetry: true,
});

// Register saga definitions
const orderSagaDefinition: ISagaDefinition = {
  sagaType: 'OrderProcessingSaga',
  displayName: 'Order Processing Workflow',
  description: 'Handles complete order processing with compensation',
  startEvents: ['OrderCreated'],
  defaultTimeout: 3600000, // 1 hour
  maxInstances: 100,
  steps: [],
  createInstance: async (event, context) => new OrderProcessingSaga(),
  getCorrelationData: event => ({ orderId: event.payload.orderId }),
  validate: () => [],
};

orchestrator.registerSagaDefinition(orderSagaDefinition);

// Process events through orchestrator
const event = createOrderCreatedEvent();
const context = { correlationId: 'order-123', userId: 'user-456' };

// Start new saga or process existing ones
const results = await orchestrator.processEvent(event, context);
```

### Saga Repository Operations

```typescript
import { InMemorySagaRepository } from '@vytches/ddd-messaging';

const repository = new InMemorySagaRepository({
  enableOptimisticLocking: true,
  enableAuditLog: true,
  retentionPolicy: {
    completedAfterDays: 30,
    compensatedAfterDays: 60,
    failedAfterDays: 90,
  },
});

// Save saga state
await repository.save(sagaInstance);

// Find sagas by correlation
const relatedSagas = await repository.findByCorrelation({
  orderId: 'order-123',
});

// Find timed out sagas for cleanup
const timedOutSagas = await repository.findTimedOut(new Date());

// Query sagas with advanced criteria
const queryResult = await repository.query({
  sagaType: 'OrderProcessingSaga',
  status: [SagaStatus.STARTED, SagaStatus.EXECUTING],
  createdBetween: { start: yesterday, end: today },
  limit: 50,
  sortBy: 'createdAt',
  sortOrder: 'desc',
});
```

### Saga Middleware

```typescript
import {
  LoggingMiddleware,
  RetryMiddleware,
  CircuitBreakerMiddleware,
} from '@vytches/ddd-messaging';

// Create middleware pipeline
const loggingMiddleware = new LoggingMiddleware();
const retryMiddleware = new RetryMiddleware({
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
});
const circuitBreakerMiddleware = new CircuitBreakerMiddleware({
  failureThreshold: 5,
  resetTimeout: 60000,
});

// Apply middleware to saga execution
const middlewarePipeline = [
  loggingMiddleware,
  retryMiddleware,
  circuitBreakerMiddleware,
];

// Middleware automatically handles cross-cutting concerns:
// - Structured logging with context
// - Automatic retry on transient failures
// - Circuit breaker for fault tolerance
```

## Unified Event System Usage Guide

### Basic Event Publishing with Repository Pattern (Recommended)

```typescript
// Clean use case - automatic event publishing through repository
class CreateOrderUseCase {
  constructor(private orderRepository: IOrderRepository) {}

  async execute(command: CreateOrderCommand): Promise<void> {
    const order = OrderAggregate.create(command);

    // ✅ Repository automatically:
    // 1. Persists aggregate
    // 2. Publishes domain events
    // 3. Handles transaction safety
    // 4. Commits aggregate events
    await this.orderRepository.save(order);
  }
}

// Order Aggregate with domain events
class OrderAggregate extends AggregateRoot {
  create(data: CreateOrderData): void {
    this.validateOrder(data);

    // Add domain and integration events
    this.addDomainEvent(new OrderCreatedEvent(data));
    this.addDomainEvent(new InventoryReservationRequestedEvent(data));
  }
}
```

### Direct Event Publishing (Advanced scenarios)

```typescript
// Direct UnifiedEventBus usage
class OrderEventDispatcher {
  constructor(private eventBus: UnifiedEventBus) {}

  async dispatchOrderCreated(orderData: OrderData): Promise<void> {
    // Mixed event types in single batch
    await this.eventBus.publishMany([
      new OrderCreatedEvent(orderData), // Domain
      new BillingProcessingEvent(orderData), // Integration
      new CustomerNotificationEvent(orderData), // Integration
      new AuditOrderCreatedEvent(orderData), // Audit
    ]);
  }
}
```

### Event Handlers with Context Filtering

```typescript
// Context-specific event handling
@EventHandler(OrderCreatedEvent, {
  eventContext: 'order-context',
})
class OrderCreatedHandler {
  async handle(event: OrderCreatedEvent): Promise<void> {
    // Only handles events from order context
    console.log('Order created:', event.payload.orderId);
  }
}

// Multi-context event handling
@EventHandler(InventoryUpdatedEvent, {
  eventContext: ['order-context', 'inventory-context'],
})
class InventoryHandler {
  async handle(event: InventoryUpdatedEvent): Promise<void> {
    // Handles events from both contexts
  }
}
```

### Repository Setup with Event Publishing

```typescript
// Repository implementation with automatic event publishing
class OrderRepository extends IBaseRepository<OrderAggregate> {
  constructor() {
    const unifiedEventBus = new UnifiedEventBus();
    const universalDispatcher = new UniversalEventDispatcher(unifiedEventBus);

    super(
      universalDispatcher, // Event publishing
      new PostgreSQLEventPersistenceHandler() // Event storage
    );
  }
}
```

### Framework Integration

```typescript
// NestJS Integration Example
import { NestJSContainerAdapter } from '@vytches/ddd-di';

@Module({
  providers: [OrderService, PaymentService],
})
export class OrderModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit() {
    // Integrate with VytchesDDD
    const adapter = new NestJSContainerAdapter(this.moduleRef);
    VytchesDDD.configure(adapter);
  }
}
```

## Policies V2 Usage Guide

### Basic Policy Creation

The new Policies V2 provides a unified Promise-based API with rich enterprise
features:

```typescript
import { PolicyBuilder, PolicyContext } from '@vytches/ddd-policies';
import {
  AgeSpecification,
  EmailSpecification,
} from '@your-domain/specifications';

// Basic policy with specifications
const userPolicy = PolicyBuilder.create<User>()
  .withId('user-validation')
  .withDomain('authentication')
  .withName('User Registration Policy')
  .must(new AgeSpecification(18))
  .withCode('AGE_TOO_LOW')
  .withMessage('Must be at least 18 years old')
  .withSeverity('ERROR')
  .and()
  .must(new EmailSpecification())
  .withCode('INVALID_EMAIL')
  .withMessage('Valid email required')
  .withSeverity('ERROR')
  .build();

// Execute policy with context
const context = PolicyContext.create()
  .withUserId('user-123')
  .withSessionId('session-456')
  .withRequestId('req-789')
  .build();

const result = await userPolicy.check({ entity: user, context });
if (result.isFailure()) {
  console.log('Violations:', result.error.violations);
}
```

### Advanced Policy Features

```typescript
// Conditional policies with when/then/otherwise
const dynamicPolicy = PolicyBuilder.create<Order>()
  .withId('order-validation')
  .withDomain('orders')
  .must(new BasicOrderValidation())
  .when(order => order.amount > 10000)
  .then()
  .must(new ManagerApprovalSpec())
  .withCode('APPROVAL_REQUIRED')
  .withMessage('Manager approval required for large orders')
  .when(ctx => ctx.environment === 'production')
  .then()
  .must(new StrictSecurityPolicy())
  .otherwise()
  .should(new RelaxedValidation())
  .withSeverity('WARNING')
  .build();
```

### Complex Group Logic

```typescript
import { PolicyGroup } from '@vytches/ddd-policies';

// OR group logic for flexible business rules
const excellentCreditGroup = PolicyGroup.create<LoanApplication>(
  'excellent-credit'
).mustSatisfy(
  app => app.creditScore >= 800,
  'CREDIT_NOT_EXCELLENT',
  'Excellent credit required'
);

const goodCreditWithCollateralGroup = PolicyGroup.create<LoanApplication>(
  'good-credit-collateral'
)
  .mustSatisfy(
    app => app.creditScore >= 650,
    'CREDIT_NOT_GOOD',
    'Good credit required'
  )
  .and()
  .mustSatisfy(
    app => app.collateral >= 50000,
    'INSUFFICIENT_COLLATERAL',
    'Collateral required'
  );

const loanPolicy = PolicyBuilder.create<LoanApplication>()
  .withId('loan-approval')
  .withDomain('lending')
  .shouldSatisfyAny(excellentCreditGroup, goodCreditWithCollateralGroup)
  .build();
```

### Event-Driven Policies

```typescript
// Policy with automatic event emission
const auditedPolicy = PolicyBuilder.create<User>()
  .withId('user-security')
  .withDomain('security')
  .must(new SecuritySpecification())
  .withEvents({ enabled: true })
  .build();

// Listen to policy events
policyEventBus.subscribe('POLICY_EVALUATED', event => {
  console.log(
    `Policy ${event.policyId} evaluated with result: ${event.result.isSuccess()}`
  );
});
```

### Specification Integration

```typescript
// Direct specification support
const specPolicy = PolicyBuilder.create<User>()
  .must(AgeSpecification.create({ min: 18, max: 65 }))
  .and()
  .must(EmailSpecification.create())
  .and()
  .mustSatisfyRules(rules =>
    rules
      .forProperty('name', Rules.required().minLength(2))
      .forProperty('phone', Rules.required().phone())
  )
  .build();

// Custom async specifications
class CreditCheckSpecification implements IAsyncSpecification<LoanApplication> {
  async isSatisfiedByAsync(app: LoanApplication): Promise<boolean> {
    const score = await creditService.getScore(app.applicantId);
    return score >= app.requiredMinScore;
  }
}

const asyncPolicy = PolicyBuilder.create<LoanApplication>()
  .mustAsync(new CreditCheckSpecification())
  .withCode('CREDIT_CHECK_FAILED')
  .build();
```

### Policy Registry Usage

```typescript
import { PolicyRegistry } from '@vytches/ddd-policies';

const registry = new PolicyRegistry();

// Register policies
registry.register({
  id: 'user-validation',
  domain: 'authentication',
  name: 'User Validation Policy',
  policy: userPolicy,
  version: '1.0.0',
  tags: ['security', 'validation'],
});

// Retrieve policies
const policy = registry.resolve<User>({
  domain: 'authentication',
  id: 'user-validation',
});

// Query policies by domain
const securityPolicies = registry.findByDomain('security');
```

### Error Handling and Violations

```typescript
// Rich violation handling
const result = await policy.check({ entity: user, context });

if (result.isFailure()) {
  const violations = result.error.violations;

  violations.forEach(violation => {
    console.log({
      code: violation.code,
      message: violation.message,
      severity: violation.severity, // ERROR, WARNING, INFO
      field: violation.field,
      details: violation.details,
      timestamp: violation.timestamp,
    });
  });

  // Filter by severity
  const errors = violations.filter(v => v.severity === 'ERROR');
  const warnings = violations.filter(v => v.severity === 'WARNING');
}
```

## Policy Behaviors Usage Guide

### Basic Policy Behavior Usage

Policy Behaviors follow the MediatR pattern and wrap business policies with
cross-cutting concerns like retry logic, caching, and temporal validation.

```typescript
import {
  PolicyRetryBehavior,
  PolicyCachingBehavior,
  PolicyTemporalBehavior,
} from '@vytches/ddd-policies';

// Create a base business policy
class PaymentValidationPolicy extends BaseBusinessPolicy<PaymentData> {
  async check(
    request: PolicyRequest<PaymentData>
  ): Promise<Result<PaymentData, PolicyViolation>> {
    // Business validation logic
    return this.success(request.entity);
  }
}

// Wrap with retry behavior for transient failures
const retryPolicy = PolicyRetryBehavior.create(new PaymentValidationPolicy(), {
  maxAttempts: 3,
  baseDelay: 1000,
  backoff: 'exponential',
  shouldRetry: violation => violation.code.includes('TIMEOUT'),
});

// Wrap with caching for performance
const cachedPolicy = PolicyCachingBehavior.create(retryPolicy, {
  ttl: 60000, // 1 minute
  maxSize: 100,
});

// Execute the wrapped policy
const result = await cachedPolicy.check({ entity: paymentData, context });
```

### Policy Retry Behavior

```typescript
import {
  PolicyRetryBehavior,
  PolicyRetryBehaviorFactory,
} from '@vytches/ddd-policies';

// Factory methods for common scenarios
const transientFailurePolicy = PolicyRetryBehaviorFactory.forTransientFailures(
  basePolicy,
  3 // max attempts
);

const externalServicePolicy = PolicyRetryBehaviorFactory.forExternalServices(
  basePolicy,
  { maxAttempts: 5, baseDelay: 2000, maxDelay: 60000 }
);

// Custom retry logic
const customRetryPolicy = PolicyRetryBehaviorFactory.withCustomLogic(
  basePolicy,
  violation => violation.severity === 'WARNING', // Only retry warnings
  3,
  1000
);

// Monitor retry metrics
const metrics = retryPolicy.getRetryMetrics();
console.log(
  `Success rate: ${metrics.successfulEvaluations / metrics.totalAttempts}`
);
```

### Policy Caching Behavior

```typescript
import {
  PolicyCachingBehavior,
  PolicyCachingBehaviorFactory,
} from '@vytches/ddd-policies';

// Simple TTL-based caching
const cachedPolicy = PolicyCachingBehaviorFactory.withTTL(basePolicy, 30000); // 30 seconds

// Custom key generation
const customCachedPolicy = PolicyCachingBehavior.create(basePolicy, {
  ttl: 60000,
  keyGenerator: request => `${request.entity.id}_${request.context.userId}`,
  namespace: 'payment-validation',
  maxSize: 500,
});

// Cache with metrics
const metricsPolicy = PolicyCachingBehaviorFactory.withMetrics(
  basePolicy,
  60000, // TTL
  request => `custom_${request.entity.type}` // Custom key
);
```

### Policy Temporal Behavior

```typescript
import {
  PolicyTemporalBehavior,
  PolicyTemporalBehaviorBuilder,
  PolicyTemporalBehaviorFactory,
} from '@vytches/ddd-policies';

// Business hours policy
const businessHoursPolicy = PolicyTemporalBehaviorFactory.forBusinessHours(
  strictPolicy,
  relaxedPolicy,
  { start: '09:00', end: '17:00' }
);

// Working days vs weekends
const workingDaysPolicy = PolicyTemporalBehaviorFactory.forWorkingDays(
  businessPolicy,
  weekendPolicy,
  [1, 2, 3, 4, 5] // Monday to Friday
);

// Complex temporal builder
const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
  .withBusinessHours('09:00', '17:00')
  .withWorkingDays([1, 2, 3, 4, 5])
  .withTimezone('America/New_York')
  .duringBusinessHours(strictPolicy)
  .duringAfterHours(relaxedPolicy)
  .duringWeekends(weekendPolicy)
  .withTemporalInfo(true) // Include timing info in results
  .build();
```

### Behavior Composition

```typescript
// Chain multiple behaviors
const composedPolicy = PolicyCachingBehavior.create(
  PolicyRetryBehavior.create(
    PolicyTemporalBehavior.create(basePolicy, temporalConfig),
    retryConfig
  ),
  cacheConfig
);

// Execution order: Cache → Retry → Temporal → Base Policy
const result = await composedPolicy.check(request);
```

### Backward Compatibility

All policy behaviors maintain backward compatibility through aliases:

```typescript
// New naming (recommended)
import { PolicyRetryBehavior } from '@vytches/ddd-policies';

// Old naming (deprecated in v2.1)
import { RetryPolicy, PolicyRetryDecorator } from '@vytches/ddd-policies';

// All work identically
const policy1 = PolicyRetryBehavior.create(basePolicy, config);
const policy2 = RetryPolicy.create(basePolicy, config); // Same as above
const policy3 = PolicyRetryDecorator.create(basePolicy, config); // Same as above
```

## Examples Infrastructure - Library-First Philosophy

### **CRITICAL: Library-First Framework Integration**

**When creating framework examples, show ONLY the integration points that
actually use library features.**

- ✅ **INCLUDE**: Direct library usage (ACL setup, event publishing, CQRS
  handlers)
- ✅ **INCLUDE**: Framework-specific integration patterns (DI configuration,
  decorators)
- ✅ **INCLUDE**: Essential configuration that enables library features
- ❌ **EXCLUDE**: Complete application implementations (controllers, guards,
  interceptors)
- ❌ **EXCLUDE**: Business logic not related to library features
- ❌ **EXCLUDE**: Framework ceremony (DTOs, validation, authentication)
- ❌ **EXCLUDE**: Repository patterns unless they're part of the library feature

**Core Principle**: "We don't want to show the framework, but our library"

### **MANDATORY: Example Generation Pattern**

**When generating ANY example, follow this strict pattern:**

#### **1. Domain/Basic Examples (\*.md files in basic/)**

````markdown
# [ComponentName] - [ComplexityLevel] Example

**Version**: [current-version] **Package**: @vytches/ddd-[package-name]
**Complexity**: [beginner|intermediate|advanced] **Domain**: [domain-name]
**Patterns**: [pattern1, pattern2, pattern3] **Dependencies**:
[list-of-dependencies]

## Description

[What this example demonstrates - library usage focus]

## Business Context

[Why this pattern is useful - business scenario]

## Code Example

```typescript
// [filename].ts
import { [LibraryClasses] } from '@vytches/ddd-[package]';
import { [ExistingTypes] } from './types'; // ALWAYS import existing types

// ✅ FOCUS: Library implementation only
export class [ComponentName] extends [LibraryBaseClass] {
  // Implementation using library features
}
```
````

## Key Features

- [Library-specific features demonstrated]

## Common Pitfalls

- [Mistakes to avoid when using library]

## Related Examples

- [Links to related examples]

````

#### **2. Framework Examples (*.md files in frameworks/)**

**HYBRID APPROACH**: Create separate files for manual and DI approaches

**A. Manual Setup (Beginner) - manual.md**
```markdown
# [ComponentName] - [Framework] Manual Setup

**Focus**: Basic [LibraryClass] usage in [Framework] with manual instantiation
**Base Example**: [link-to-basic-example]
**Dependencies**: [framework-deps], @vytches/ddd-[package]

## Service Implementation
```typescript
// [component].service.ts
import { Injectable } from '@nestjs/common';
import { [LibraryClass] } from '@vytches/ddd-[package]';
import { [ExistingTypes] } from './types'; // ALWAYS import from app

@Injectable()
export class [ComponentName]Service {
  private readonly [libraryInstance]: [LibraryClass];

  constructor() {
    // ⭐ FOCUS: Manual library setup (beginner-friendly)
    this.[libraryInstance] = new [LibraryClass]([config]);
  }

  // ✅ FOCUS: Thin wrapper around library
  async [method](): Promise<Result<[Type], Error>> {
    return await this.[libraryInstance].[method]();
  }
}
````

**Key Points:**

- Simple manual instantiation for beginners
- Focus on library usage, not DI complexity
- Standard NestJS patterns for framework integration

````

**B. DI Integration (Intermediate+) - di.md**
```markdown
# [ComponentName] - [Framework] DI Integration

**Focus**: Advanced [LibraryClass] usage with @vytches/ddd-di integration
**Base Example**: [link-to-basic-example]
**Dependencies**: [framework-deps], @vytches/ddd-[package], @vytches/ddd-di

## Service Implementation
```typescript
// [component].service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { [ExistingTypes] } from './types'; // ALWAYS import from app

@Injectable()
export class [ComponentName]Service {
  private readonly [libraryInstance]: [LibraryClass];

  constructor() {
    // ⭐ FOCUS: @vytches/ddd-di integration
    this.[libraryInstance] = VytchesDDD.resolve<[LibraryClass]>('[serviceId]');
  }

  // ✅ FOCUS: Thin wrapper around library
  async [method](): Promise<Result<[Type], Error>> {
    return await this.[libraryInstance].[method]();
  }
}
````

**Key Points:**

- Advanced DI integration with @vytches/ddd-di
- Service locator pattern usage
- Enterprise-grade dependency management

````

#### **3. STRICT VALIDATION CHECKLIST**
**Before creating ANY example, verify:**

- [ ] **NO generated interfaces/DTOs**: All types imported from `./types` or similar
- [ ] **NO business logic in framework services**: Keep as thin wrappers
- [ ] **SEPARATE FILES**: manual.md for beginners, di.md for intermediate+
- [ ] **APPROPRIATE APPROACH**: Manual setup for beginner, @vytches/ddd-di for advanced
- [ ] **NO unnecessary files**: interfaces.md, config.md unless library-specific
- [ ] **LIBRARY FOCUS**: Every code block shows actual library usage
- [ ] **PROPER IMPORTS**: All external types imported with comments
- [ ] **MARKDOWN LINTING**: Proper trailing newlines and formatting
- [ ] **DOCUMENTATION**: Clear focus on library integration points

#### **4. FORBIDDEN PATTERNS**
```typescript
// ❌ NEVER DO THIS - Creating interfaces
export interface User {
  id: string;
  email: string;
}

// ❌ NEVER DO THIS - Business logic in service
async createUser(userData: CreateUserData): Promise<User> {
  const user: User = {
    id: generateId(),
    email: userData.email,
    // ... more business logic
  };
  return await this.acl.createUser(user);
}

// ❌ NEVER DO THIS - Manual instantiation in constructor
constructor(api: ExternalAPI) {
  this.acl = new UserManagementACL(api, translator);
}
````

#### **5. REQUIRED PATTERNS**

```typescript
// ✅ ALWAYS DO THIS - Import existing types
import { User, CreateUserData } from './types'; // From your app

// ✅ ALWAYS DO THIS - Thin wrapper service
async createUser(userData: CreateUserData): Promise<Result<User, Error>> {
  return await this.acl.createUser(userData);
}

// ✅ ALWAYS DO THIS - DI injection
constructor(
  private readonly acl: UserManagementACL // Pre-configured instance
) {}
```

### **VALIDATION COMMAND**

Run this mental checklist before submitting ANY example:

1. Does it show library usage prominently?
2. Are all types imported from application?
3. Is framework service a thin wrapper?
4. Does it avoid generating supporting code?
5. Does it follow established patterns?

**Framework-Specific Guidelines**:

**NestJS Examples**:

- ✅ **USE STANDARD NestJS DI**: Standard @Injectable(), useFactory patterns for
  framework integration
- ✅ **LIBRARY DI HYBRID APPROACH**: Separate files for manual setup vs
  @vytches/ddd-di integration
- ✅ **BEGINNER = MANUAL SETUP**: Basic examples use manual library
  instantiation (simple, clear)
- ✅ **INTERMEDIATE+ = LIBRARY DI**: Advanced examples show @vytches/ddd-di
  integration (@DomainService, VytchesDDD.resolve())
- ✅ **SEPARATE FILES**: manual.md and di.md files that can be merged in output
- ✅ **KEEP SIMPLE**: 1-3 methods max, focus on core library operations
- ✅ **IMPORT EXISTING**: Import ALL DTOs, interfaces from application (don't
  create ANY)
- ✅ **ASSUME EXISTS**: Assume User, CreateUserData, UpdateUserData exist in
  application
- ❌ **AVOID**: Creating interfaces, DTOs, types, or any supporting code
- ❌ **AVOID**: Business logic in framework services (keep as thin wrapper)
- ❌ **AVOID**: Mixing manual and DI approaches in same example file

**Error Handling**:

- ✅ **USE standard try/catch**: Simple, clear error handling in implementation
  code
- ✅ **USE safeRun in tests**: Always use safeRun from @vytches/ddd-utils in
  test files
- ❌ **AVOID safeRun in implementation**: Don't use safeRun in usage examples or
  service code
- ❌ **AVOID logging**: Skip unnecessary logging in examples

**Code Style**:

- ✅ **KEEP SIMPLE**: Focus on library integration, not complex patterns
- ✅ **USE framework conventions**: Follow each framework's standard patterns
- ✅ **ASSUME EXTERNAL CODE**: Import and use existing DTOs, services,
  interfaces
- ❌ **AVOID over-engineering**: Don't add complexity that doesn't show library
  usage
- ❌ **AVOID creating supporting code**: Don't generate DTOs, validation, etc.

### Philosophy: "Show Library, Not Framework"

```typescript
// ✅ CORRECT: Service that actually uses library features with DI
@Injectable()
export class PaymentService {
  constructor(private readonly paymentACL: PaymentACLService) {}

  async processPayment(payment: Payment): Promise<Payment> {
    // ⭐ Main focus: Use our ACL from @vytches/ddd-acl
    try {
      return await this.paymentACL.execute('process', payment);
    } catch (error) {
      throw new Error(`Payment failed: ${error.message}`);
    }
  }
}

// ❌ WRONG: Complex business logic that doesn't show library
@Injectable()
export class OrderService {
  async validateOrder(order: Order): Promise<void> {
    // Complex validation logic
    // Repository operations
    // Business rules
    // NO LIBRARY USAGE - this shouldn't be in library examples
  }
}
```

### Framework Examples Structure

**Only include files that demonstrate meaningful library integration:**

```
packages/[package]/examples/
├── basic/                             # Domain-focused examples
│   ├── business-policy/
│   │   ├── domain.md                 # Core library implementation
│   │   ├── interfaces.md             # Supporting contracts
│   │   └── usage.md                  # Usage patterns
├── frameworks/                       # Framework integrations
│   └── nestjs/
│       └── business-policy/
│           └── service.md            # ONLY file - shows library usage
```

**Files to EXCLUDE from framework examples:**

- `module.md` - Just DI configuration, no library features
- `controller.md` - HTTP handling, no library interaction
- `dto.md` - Framework validation, not library feature
- `repository.md` - External concern unless using library repository patterns

### Available Examples

- **Logging Showcase** (`examples/logging-showcase/`) - Comprehensive logging
  examples showing all features
- **Simple Example** (`examples/simple/`) - Basic library usage
- **Playground** (`examples/playground/`) - Interactive development environment

### Running Examples

```bash
# Build and run logging showcase
cd examples/logging-showcase
pnpm build && node dist/index.js

# Use playground for testing
pnpm playground
```

### Key Files to Understand

- `tsconfig.base.json`: TypeScript path mappings and compilation settings
- `.eslintrc.json`: Module boundary rules and code style enforcement (includes
  logging dependencies)
- `nx.json`: Build system configuration and caching
- `vitest.config.ts`: Test configuration with package aliases
- `package.json`: Development scripts and workflow commands
- `packages/logging/`: Complete enterprise logging implementation
- `renovate.json`: Automated dependency management configuration
- `scripts/quality-gates/`: Enterprise quality monitoring system

## Library Status Summary

### Package Count: 21 Packages

- **Foundation**: core (meta-package), domain-primitives, value-objects,
  repositories, aggregates, di, utils, contracts, logging
- **Patterns**: validation, policies, domain-services
- **Architecture**: events, cqrs, projections
- **Integration**: acl, messaging
- **Infrastructure**: resilience, enterprise, event-store
- **Tooling**: cli, testing

### Development Readiness

- ✅ **Production Ready**: All packages fully implemented with comprehensive
  features
- ✅ **Enterprise Grade**: Advanced logging, observability, resilience patterns,
  and DI system
- ✅ **Type Safe**: Full TypeScript implementation with strict type checking
- ✅ **Well Tested**: Comprehensive test coverage across all packages (1460
  tests)
- ✅ **Documented**: Rich documentation with examples and usage guides
- ✅ **Integrated**: Seamless package integration with structured logging and DI
  auto-discovery throughout

### Recent Major Updates

- **🔥 COMPLETED**: **Unified Event System Refactor** - Complete redesign of
  event handling architecture
  - 3→1 event bus consolidation with 67% code reduction
  - Repository-integrated automatic event publishing
  - Industry-standard patterns (MediatR, Spring, Axon alignment)
  - Enterprise transaction safety and optimistic concurrency
- **🔥 COMPLETED**: **Enterprise Circular Dependency Resolution** - EntityId
  moved to contracts package
  - Enterprise-grade architecture with contracts foundation layer
  - Circular dependency elimination between testing and value-objects packages
  - TypeScript configuration standardization across all 22 packages
  - Two-layer EntityId pattern with enhanced validation
- **🔥 COMPLETED**: **Saga Framework Implementation** - Enterprise-grade
  long-running business processes
  - Complete saga orchestration system with state management and compensation
    patterns
  - Advanced saga repository with optimistic concurrency control and querying
    capabilities
  - Middleware pipeline for cross-cutting concerns (logging, retry, circuit
    breaker)
  - Comprehensive test coverage with 100% functionality verification
  - Enterprise features: timeout handling, instance limits, correlation tracking
- **NEW**: Enterprise dependency injection system with auto-discovery and
  context isolation
- **NEW**: Global service locator pattern following MediatR architecture
- **NEW**: Enhanced decorators (@DomainService, @CommandHandler, @QueryHandler)
  with DI options
- **NEW**: Plugin-based discovery system for automatic service registration
- **NEW**: Enterprise meta-package architecture with 99.2% core bundle reduction
- **NEW**: Modular foundation layer (domain-primitives, value-objects,
  repositories, aggregates)
- **NEW**: Enterprise import strategy for API stability
- **NEW**: Enterprise logging package with DDD-first design
- **NEW**: CI/CD Quality Gates system with automated monitoring
- **NEW**: Renovate Bot integration for dependency management
- **ENHANCED**: All packages now include structured logging and DI integration
- **IMPROVED**: CQRS with advanced decorators and middleware
- **EXPANDED**: Resilience patterns with comprehensive observability
- **STANDARDIZED**: Import patterns across all internal packages
- **ADDED**: Comprehensive examples and usage showcases
- **AUTOMATED**: Quality assurance with regression prevention
