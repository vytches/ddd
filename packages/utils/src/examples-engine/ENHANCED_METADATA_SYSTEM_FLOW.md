# Enhanced Metadata System - Complete Developer Guide

## Overview

The Enhanced Metadata System is a sophisticated build-time code transformation system that injects rich metadata from Markdown files into TypeScript source code. It replaces JSDoc directive placeholders (`@*-inject`) with actual examples, descriptions, and business context during the Vite build process.

## 🚀 Quick Start for New Developers

### ⚡ If You're Taking Over This System - READ THIS FIRST

**🚨 CRITICAL STATUS:** The Enhanced Metadata System is **PARTIALLY WORKING** with known issues that need immediate attention.

**❗ Before touching ANY code, run this diagnostic:**
```bash
cd packages/aggregates && pnpm build
echo "=== SYSTEM HEALTH CHECK ==="
unprocessed=$(grep -c "@.*-inject" dist/index.js)
duplicates=$(grep -c "@business.*@business" dist/index.js)
metadata=$(grep -c "@business\|@description\|@example" dist/index.js)

echo "❌ Unprocessed directives: $unprocessed (should be 0)"
echo "⚠️  Duplicate tags: $duplicates (should be 0)" 
echo "📊 Total metadata: $metadata (should be >200)"

if [ "$unprocessed" -gt 0 ]; then
    echo "🔴 CRITICAL: System not fully processing directives"
fi
if [ "$duplicates" -gt 0 ]; then
    echo "🟡 WARNING: Enhanced vs Legacy system conflicts"
fi
```

**🎯 Your Priority Tasks:**
1. **Fix unprocessed directives** - 30 directives not being replaced
2. **Resolve duplicate @business tags** - 15 duplicates from enhanced/legacy conflicts  
3. **Understand the current architecture** - Read this entire document
4. **Run quality checks after every change** - Use Definition of Done section

**🛠️ Quick Quality Check Script:**
```bash
# Use this automated script for comprehensive verification:
./scripts/verify-enhanced-metadata.sh

# This script will:
# ✅ Build the aggregates package  
# ✅ Run all Definition of Done checks
# ✅ Show detailed analysis of issues
# ✅ Provide clear PASS/FAIL/WARNING status
# ✅ Give next steps for fixes
```

### Prerequisites & Setup

**Required Software:**
- Node.js 18+ (check with `node --version`)
- pnpm 8+ (install with `npm install -g pnpm`)
- TypeScript 5+ (managed via project dependencies)
- Git (for version control)

**Environment Setup:**
```bash
# 1. Clone and setup project
git clone <repository-url>
cd vytches-ddd
pnpm install

# 2. Verify Enhanced Metadata System works
cd packages/aggregates
pnpm build

# 3. Check for successful processing
grep -c "@.*-inject" dist/index.js  # Should be 0 (all directives replaced)
grep -c "@business\|@description" dist/index.js  # Should be >0 (metadata injected)
```

**Project Structure Overview:**
```
vytches-ddd/
├── packages/utils/src/examples-engine/          # Core metadata system
│   ├── adapters/jsdoc-adapter.ts               # Main processing logic
│   ├── engine.ts                               # File scanning engine
│   ├── scanner/file-scanner.ts                 # Filesystem operations
│   └── extractor/tag-extractor.ts              # Metadata parsing
├── packages/utils/build-configs/plugins/       # Vite integration
│   └── jsdoc-examples.ts                       # Plugin entry point
├── docs/examples/domain/                       # Metadata source files
│   ├── aggregates/aggregate-root.md            # Global metadata
│   └── {package}/{method-name}.md              # Method-specific metadata
└── packages/{package}/src/**/*.ts              # Source files with @*-inject directives
```

### Development Workflow

**Daily Development Process:**
```bash
# 1. Make changes to TypeScript source files (add @*-inject directives)
vim packages/aggregates/src/core/aggregate-root.ts

# 2. Create/update corresponding markdown metadata
vim docs/examples/domain/aggregates/aggregate-root.md

# 3. Test the transformation
cd packages/aggregates && pnpm build

# 4. 🚨 MANDATORY: Run quality verification (Definition of Done)
echo "=== MANDATORY QUALITY CHECKS ==="
[ $(grep -c "@.*-inject" dist/index.js) -eq 0 ] && echo "✅ Directives processed" || echo "❌ FAIL: Unprocessed directives"
[ $(grep -c "@business.*@business" dist/index.js) -eq 0 ] && echo "✅ No duplicates" || echo "⚠️ WARNING: Duplicates found"
metadata_count=$(grep -c "@business\|@description\|@example" dist/index.js)
echo "📊 Metadata count: $metadata_count (target: >200)"

# 5. If checks fail, debug with detailed logs
if [ $(grep -c "@.*-inject" dist/index.js) -gt 0 ]; then
    echo "=== DEBUGGING UNPROCESSED DIRECTIVES ==="
    pnpm build | grep -E "\[jsdoc|ERROR|WARN"
    grep -n "@.*-inject" dist/index.js | head -5
fi
```

**Safe Development Testing:**
```bash
# Test single package without affecting others
pnpm -F @vytches/ddd-aggregates build

# Dry-run mode (check directives without building)
grep -r "@.*-inject" packages/aggregates/src/

# Verify metadata files exist
find docs/examples/domain/aggregates/ -name "*.md" | head -10
```

## Architecture Components

### 1. Entry Points & Startup

**Primary Entry Point:**
```
packages/utils/build-configs/plugins/jsdoc-examples.ts
```

**Activation:**
- Triggered during `pnpm build` commands for packages
- Activated by Vite plugin system when `shouldEnableJSDocPlugin()` returns true
- Works only for "foundation" package types (aggregates, value-objects, etc.)

**Build Commands:**
```bash
# Build specific package (triggers the system)
pnpm -F @vytches/ddd-aggregates build

# From package directory
cd packages/aggregates && pnpm build
```

### 2. Plugin Architecture

**Vite Plugin Hook Sequence:**
1. **`buildStart`**: Clears global cache
2. **`load`**: Processes each TypeScript file before TypeScript compilation
3. **`buildEnd`**: Final cleanup

**Critical Implementation Detail:**
Uses `load` hook (not `transform`) to process files BEFORE TypeScript transpilation.

## Core Processing Flow

### Stage 1: File Detection & Plugin Initialization

```
Vite Build Process
├── jsdoc-examples.ts (Vite Plugin)
├── shouldEnableJSDocPlugin() → Check if package needs processing
├── Package type detection (foundation/enterprise/etc.)
└── Plugin registration
```

**Key File:** `packages/utils/build-configs/plugins/jsdoc-examples.ts`

```typescript
// Plugin entry point
const jsDocPlugin = {
  name: 'jsdoc-examples',
  async load(id: string) {
    if (!id.endsWith('.ts')) return null;
    
    // Process TypeScript source files
    const result = await adapter.processInjectionDirectives(code, id);
    return result; // Returns modified code or null
  }
}
```

### Stage 2: Directive Detection & Parsing

**Key File:** `packages/utils/src/examples-engine/adapters/jsdoc-adapter.ts`

**Process:**
1. **Scan TypeScript source** for `@*-inject` directives
2. **Parse each directive** (`@description-inject`, `@business-context-inject`, `@example-inject`)
3. **Determine context** (class vs method)
4. **Process in reverse order** to maintain file position integrity

```typescript
// Core processing method
async processInjectionDirectives(code: string, filePath: string): Promise<string | null> {
  // 1. Find all @*-inject directives
  const directives = this.findInjectionDirectives(code);
  
  // 2. Process each directive (reverse order for position stability)
  for (const directive of directives.reverse()) {
    // 3. Determine if class or method context
    const isClass = this.isClassDeclaration(code, directive.position);
    
    // 4. Route to appropriate handler
    if (isClass) {
      await this.processClassDirective(directive, code, filePath);
    } else {
      await this.processMethodDirective(directive, code, filePath);
    }
  }
}
```

### Stage 3: Metadata Discovery & Resolution

**Key Files:**
- `packages/utils/src/examples-engine/engine.ts` (Core Engine)
- `packages/utils/src/examples-engine/scanner/file-scanner.ts` (File Discovery)
- `packages/utils/src/examples-engine/extractor/tag-extractor.ts` (Metadata Parsing)

**Discovery Process:**

```
Method/Class Detected
├── Extract package name from file path (/packages/aggregates/src/...)
├── Scan markdown files in /docs/examples/domain/{package}/
├── Find matching .md files for method/class
└── Extract metadata blocks
```

**Example Directory Structure:**
```
docs/examples/domain/
├── aggregates/
│   ├── aggregate-root.md          # Global class metadata
│   └── specific-method.md         # Method-specific metadata
├── value-objects/
└── repositories/
```

### Stage 4: Metadata Extraction & Processing

**Enhanced Metadata Blocks in MD Files:**

```markdown
@global-settings
@strategy: merge
@description: Base class for domain aggregates with event sourcing capabilities
@business-context: Foundation for implementing aggregate pattern in DDD applications
@author: DDD Team
@since: 1.0.0
@global-settings-end

### Method-Specific Metadata

@extract: methodName:domain:complexity
// TypeScript example code
const result = methodCall();
@extract-end
```

**Processing Hierarchy:**
1. **Global Settings** (for classes)
2. **Method-Specific Blocks** (for methods)
3. **Fallback Hardcoded Values** (if no metadata found)

### Stage 5: Code Generation & Replacement

**JSDoc Tag Mapping:**
```typescript
const tagMapping = {
  'description': '@description',
  'business-context': '@business',
  'author': '@author',
  'since': '@since',
  'example': '@example'
};
```

**Replacement Logic:**
1. **Find directive position** in source code
2. **Load appropriate metadata** from MD files
3. **Generate JSDoc-compatible replacement**
4. **Replace directive with formatted content**
5. **Maintain code structure and indentation**

## File System Architecture

### Input Sources

**TypeScript Source Files:**
```
packages/{package}/src/**/*.ts
├── Contains @*-inject directives
├── Processed during build
└── Directives replaced with actual metadata
```

**Markdown Metadata Files:**
```
docs/examples/domain/{package}/
├── {class-name}.md                # Global class metadata
├── {method-name}.md              # Method-specific examples
└── subdirectories for organization
```

### Output Artifacts

**Generated JavaScript:**
```
packages/{package}/dist/
├── index.js                      # ES modules with injected metadata
├── index.cjs                     # CommonJS with injected metadata
└── **/*.d.ts                     # TypeScript declarations (unprocessed)
```

**Important:** TypeScript declaration files (`.d.ts`) are NOT processed and retain `@*-inject` directives.

## Critical Implementation Details

### Concurrent Processing Protection

**Problem:** Vite processes files concurrently, causing race conditions in filesystem operations.

**Solution:** Global cache with mutex-like behavior

```typescript
// Global shared cache to prevent concurrent filesystem access
private static globalCache = new Map<string, ExampleFile[]>();
private static pendingScans = new Map<string, Promise<ExampleFile[]>>();
```

### JSDoc Token Handling

**Critical Bug Fixed:** Plugin was generating malformed JSDoc by inserting full JSDoc blocks into existing comments.

**Solution:** Strip JSDoc structural tokens (`/**`, `*/`) when inserting into existing JSDoc:

```typescript
// Strip JSDoc markers since we're inserting into existing JSDoc
const contentLines = lines
  .filter(line => !line.trim().startsWith('/**') && !line.trim().endsWith('*/'))
  .map(line => line.replace(/^\s*\*\s?/, '')); // Remove leading "* "
```

### Duplicate Tag Prevention

**Problem:** Same metadata being added multiple times for different directives.

**Solution:** Conditional tag addition logic:

```typescript
if (metadataValueTrimmed.startsWith(tagName)) {
  // Already formatted, use as-is
  cleanedReplacementText = metadataValueTrimmed;
} else {
  // Add tag name
  cleanedReplacementText = `${tagName} ${metadataValue}`;
}
```

## Debugging & Troubleshooting

### Debug Commands

**Enable Debug Output:**
```bash
cd packages/aggregates && pnpm build
# Outputs detailed processing logs to console
```

**Key Debug Markers:**
- `[jsdoc-examples]` - Plugin lifecycle
- `[jsdoc-adapter]` - Directive processing
- `[processEnhancedBlocks]` - Metadata extraction
- `[findExampleFileForMethod]` - File discovery
- `[FileScanner]` - Filesystem operations

### Common Issues

**1. Directives Not Replaced:**
- Check if package type is "foundation"
- Verify markdown files exist in correct location
- Ensure directive syntax is correct (`@description-inject`, not `@description_inject`)

**2. Duplicate Tags (`@business @business`):**
- Issue with different directives using same global metadata
- Check for multiple directive processing same metadata

**3. Build Hanging:**
- Concurrent filesystem access issue
- Global cache should prevent this
- Check for infinite loops in file scanning

**4. Missing Examples:**
- Verify `@extract:` blocks exist in markdown files
- Check method name matching (case-sensitive)
- Ensure package name extraction is correct

### File Verification Commands

```bash
# Check processed output
grep -n "@.*-inject" packages/aggregates/dist/index.js  # Should be empty

# Check for successful replacements
grep -n "@business\|@description\|@example" packages/aggregates/dist/index.js

# Verify source directives
grep -n "@.*-inject" packages/aggregates/src/**/*.ts
```

## Performance Characteristics

### Build Impact
- **Processing Time:** ~2-3 seconds per package
- **Memory Usage:** Moderate (global cache for scanned files)
- **File I/O:** Optimized with caching, concurrent protection

### Caching Strategy
- **Global File Cache:** Prevents duplicate filesystem scans
- **Mutex Pattern:** Prevents race conditions
- **Build Lifecycle:** Cache cleared between builds

## Extension Points

### Adding New Directive Types

1. **Add to directive detection regex:**
```typescript
const directivePattern = /@(description|business-context|example|NEW_TYPE)-inject/g;
```

2. **Add tag mapping:**
```typescript
const tagMapping = {
  'new-type': '@new-type'
};
```

3. **Handle in processing logic:**
```typescript
case 'new-type':
  cleanedReplacementText = processNewType(metadataValue);
  break;
```

### Supporting New Metadata Sources

Extend `findExampleFileForMethod()` to support additional file patterns or locations.

### Framework Integration

The system is framework-agnostic but can be extended for specific frameworks by:
1. Adding framework-specific metadata extraction
2. Customizing output format for different JSDoc processors
3. Supporting framework-specific directive patterns

## 🧪 Comprehensive Testing Guide

### Testing Framework Setup

**Available Test Types:**
- **Unit Tests**: Test individual functions/classes
- **Integration Tests**: Test component interactions  
- **Build Tests**: Test actual build output
- **Regression Tests**: Prevent known issues from returning

**Running Tests:**
```bash
# Run all tests for utils package (includes metadata system)
cd packages/utils && pnpm test

# Run specific test files
pnpm test examples-engine

# Run tests with coverage
pnpm test --coverage

# Watch mode during development
pnpm test --watch
```

### Testing the Metadata System

**🚨 CRITICAL: Always run quality verification after testing:**
```bash
# After any test changes, verify system still works:
cd packages/aggregates && pnpm build
# Then run the Definition of Done checks from Known Issues section
```

**1. Unit Testing Components:**
```bash
# Test individual components
cd packages/utils
pnpm test tag-extractor.test.ts     # Metadata parsing
pnpm test file-scanner.test.ts      # File discovery
pnpm test jsdoc-adapter.test.ts     # Main processing logic
```

**2. Integration Testing:**
```bash
# Test complete flow with sample files
cd packages/utils
pnpm test integration.test.ts       # Full system integration

# Expected test output should show:
# ✓ Directives are detected correctly
# ✓ Metadata files are found and parsed
# ✓ JSDoc replacement works correctly
# ✓ No race conditions in concurrent processing
```

**3. Build Output Testing:**
```bash
# Test real build output
./scripts/test-enhanced-metadata.sh

# Manual verification
cd packages/aggregates
pnpm build

# Check for successful processing
echo "=== CHECKING FOR UNPROCESSED DIRECTIVES ==="
grep -n "@.*-inject" dist/index.js || echo "✅ All directives processed"

echo "=== CHECKING FOR SUCCESSFUL METADATA INJECTION ==="
grep -c "@business\|@description\|@example" dist/index.js

echo "=== CHECKING FOR DUPLICATE TAGS (KNOWN ISSUE) ==="
grep -c "@business.*@business" dist/index.js || echo "✅ No duplicates found"
```

**4. Adding New Test Cases:**

**Example Unit Test:**
```typescript
// packages/utils/tests/examples-engine/jsdoc-adapter.test.ts
import { JSDocAdapter } from '../../src/examples-engine/adapters/jsdoc-adapter';

describe('JSDocAdapter', () => {
  it('should replace @description-inject with actual description', async () => {
    const adapter = new JSDocAdapter();
    const input = `
      /**
       * @description-inject
       */
      function testMethod() {}
    `;
    
    const result = await adapter.processInjectionDirectives(input, 'test.ts');
    
    expect(result).toContain('@description');
    expect(result).not.toContain('@description-inject');
  });
});
```

**5. Testing New Features:**
```bash
# When adding new directive types
# 1. Add unit test for directive detection
# 2. Add integration test for end-to-end flow
# 3. Add build test for real output verification
# 4. Update regression test suite

# Example workflow:
cd packages/utils
cp tests/examples-engine/jsdoc-adapter.test.ts tests/examples-engine/new-feature.test.ts
# Edit test file for new feature
pnpm test new-feature.test.ts
```

### Integration Testing
- Build packages and verify output
- Check directive replacement completeness
- Validate generated JSDoc correctness

### Unit Testing
- Test individual components in isolation
- Mock filesystem operations
- Verify metadata extraction logic

### End-to-End Testing
```bash
# Full system test
pnpm build && node -e "console.log(require('./packages/aggregates/dist/index.cjs'))"
```

## 🔧 Common Developer Tasks

### Task 1: Adding a New Directive Type

**Step-by-Step Guide:**
```bash
# 1. Update directive detection pattern
vim packages/utils/src/examples-engine/adapters/jsdoc-adapter.ts
# Add your new directive to: /@(description|business-context|example|NEW_TYPE)-inject/g

# 2. Add tag mapping
# Add to tagMapping object: 'new-type': '@new-type'

# 3. Handle processing logic
# Add case to switch statement in directive processing

# 4. Create test markdown file
mkdir -p docs/examples/domain/test/
echo "@new-type: Sample new metadata" > docs/examples/domain/test/example.md

# 5. Add test TypeScript file
echo "/** @new-type-inject */" > /tmp/test.ts

# 6. Test the new directive
cd packages/utils && pnpm test
```

### Task 2: Adding Support for New Package

**Complete Workflow:**
```bash
# 1. Create new package structure
mkdir -p packages/new-package/src
echo "/** @description-inject */" > packages/new-package/src/index.ts

# 2. Add package configuration
# Ensure vite.config.ts includes the JSDoc plugin

# 3. Create metadata directory
mkdir -p docs/examples/domain/new-package/

# 4. Add initial metadata file
cat > docs/examples/domain/new-package/index.md << 'EOF'
@global-settings
@strategy: merge
@description: New package description
@business-context: Business use case for new package
@author: Development Team
@since: 1.0.0
@global-settings-end
EOF

# 5. Test package processing
cd packages/new-package && pnpm build

# 6. Verify successful processing
grep -c "@description-inject" dist/index.js  # Should be 0
grep -c "@description" dist/index.js          # Should be >0
```

### Task 3: Debugging Processing Issues

**Systematic Debugging Process:**
```bash
# 1. Enable full debug logging
cd packages/aggregates
DEBUG=true pnpm build 2>&1 | tee build.log

# 2. Check for common issues
echo "=== Checking for directive detection ==="
grep "\[jsdoc-adapter\] Found.*directives" build.log

echo "=== Checking for file discovery ==="
grep "\[findExampleFileForMethod\]" build.log

echo "=== Checking for metadata extraction ==="
grep "\[processEnhancedBlocks\]" build.log

echo "=== Checking for errors ==="
grep -i "error\|fail\|exception" build.log

# 3. Verify file system state
echo "=== Verifying source files ==="
find packages/aggregates/src/ -name "*.ts" -exec grep -l "@.*-inject" {} \;

echo "=== Verifying metadata files ==="
find docs/examples/domain/aggregates/ -name "*.md" | head -5

# 4. Check for race conditions
echo "=== Checking for concurrent access issues ==="
grep "Scan already in progress" build.log || echo "✅ No race conditions detected"
```

### Task 4: Performance Optimization

**Performance Analysis:**
```bash
# 1. Measure build time
time (cd packages/aggregates && pnpm build)

# 2. Analyze filesystem operations
DEBUG=true pnpm build 2>&1 | grep -c "FileScanner\|scanFolder" 

# 3. Check cache effectiveness
grep -c "Using cached" build.log || echo "Cache might not be working"

# 4. Optimize if needed
# - Review file scanning patterns
# - Check for duplicate file reads
# - Verify global cache is working
```

## 🚨 Critical Error Recovery Guide

### Issue 1: Build Hangs During Processing

**Symptoms:** Build process freezes, no output for >30 seconds

**Recovery Steps:**
```bash
# 1. Kill hung process
pkill -f "vite build"

# 2. Clear any stale cache
rm -rf packages/*/dist/ packages/*/.vite/

# 3. Check for infinite loops in file scanning
grep -r "pendingScans\|globalCache" packages/utils/src/examples-engine/

# 4. Try single-threaded build
FORCE_COLOR=0 pnpm build 2>&1 | head -100

# 5. If still hanging, add debug breakpoints
# Edit jsdoc-adapter.ts and add console.log statements
```

### Issue 2: Directives Not Being Replaced

**Symptoms:** `@*-inject` still visible in dist/index.js

**Recovery Steps:**
```bash
# 1. Verify plugin is enabled
grep -r "shouldEnableJSDocPlugin" packages/*/vite.config.ts

# 2. Check package type detection
grep -A5 -B5 "foundation" packages/utils/build-configs/

# 3. Verify directive syntax
grep -r "@.*-inject" packages/*/src/ | head -5  # Should use hyphens, not underscores

# 4. Check for load hook issues
grep -A10 "async load(" packages/utils/build-configs/plugins/jsdoc-examples.ts

# 5. Test minimal case
echo '/** @description-inject */' > /tmp/test-directive.ts
# Process manually through jsdoc-adapter.ts
```

### Issue 3: Metadata Files Not Found

**Symptoms:** `Enhanced metadata not found` in logs

**Recovery Steps:**
```bash
# 1. Verify directory structure
ls -la docs/examples/domain/aggregates/

# 2. Check file naming conventions
# Files should be lowercase: aggregate-root.md, not AggregateRoot.md

# 3. Verify markdown structure
head -10 docs/examples/domain/aggregates/aggregate-root.md

# 4. Check for @global-settings blocks
grep -A10 "@global-settings" docs/examples/domain/aggregates/*.md

# 5. Test file scanning directly
cd packages/utils
node -e "
const { FileScanner } = require('./dist/examples-engine/scanner/file-scanner');
const scanner = new FileScanner();
scanner.scanDirectory('/absolute/path/to/docs/examples/domain/aggregates/')
  .then(files => console.log('Found files:', files.length));
"
```

## 📦 Deployment & CI/CD

### Production Deployment Checklist

**Pre-Deployment Verification:**
```bash
# 1. Run full test suite
pnpm test

# 2. Build all packages
pnpm build

# 3. Verify no unprocessed directives remain
for pkg in packages/*/; do
  echo "=== Checking $pkg ==="
  grep -c "@.*-inject" "$pkg/dist/index.js" 2>/dev/null || echo "✅ Clean"
done

# 4. Check for regression in metadata quality
grep -c "@business.*@business" packages/*/dist/index.js || echo "✅ No duplicates"

# 5. Verify JSDoc output quality
node -e "
const fs = require('fs');
const content = fs.readFileSync('packages/aggregates/dist/index.js', 'utf8');
const businessTags = (content.match(/@business/g) || []).length;
console.log('Business tags found:', businessTags);
if (businessTags < 10) console.warn('⚠️ Low metadata count, check processing');
"
```

**CI/CD Integration:**
```yaml
# .github/workflows/enhanced-metadata-check.yml
name: Enhanced Metadata System Check
on: [push, pull_request]

jobs:
  test-metadata-system:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install -g pnpm
      - run: pnpm install
      - name: Test metadata processing
        run: |
          cd packages/aggregates
          pnpm build
          # Verify no unprocessed directives
          ! grep -q "@.*-inject" dist/index.js
          # Verify metadata was injected
          grep -q "@business\|@description" dist/index.js
```

**Rollback Procedure:**
```bash
# If deployment causes issues:
# 1. Identify problematic commit
git log --oneline packages/utils/src/examples-engine/

# 2. Revert specific changes
git revert <commit-hash>

# 3. Test rollback
pnpm -F @vytches/ddd-aggregates build

# 4. Verify functionality restored
grep -c "@business" packages/aggregates/dist/index.js
```

## Maintenance Guidelines

### Regular Maintenance
1. **Monitor build logs** for processing failures
2. **Verify output quality** in generated files
3. **Update markdown examples** as code evolves
4. **Check for new edge cases** in directive processing

### When Adding New Packages
1. Ensure package type is correctly detected
2. Create corresponding markdown structure in `docs/examples/domain/`
3. Test build process with new package
4. Verify generated output quality

## 🚨 Known Issues & Current Status

### Critical Issues (Require Immediate Attention)

#### Issue 1: Unprocessed Directives in JavaScript Output
**Status**: 🔴 CRITICAL BUG  
**Description**: `@*-inject` directives still present in `dist/index.js` files  
**Current Count**: ~30 unprocessed directives in aggregates package  
**Impact**: Metadata system not fully functional  
**Root Cause**: Plugin load hook may have timing issues or file filtering problems  
**Detection**: `grep -c "@.*-inject" packages/aggregates/dist/index.js` should return 0  
**Workaround**: Manual verification required after each build  

#### Issue 2: Duplicate @business Tags
**Status**: 🟡 PARTIALLY FIXED  
**Description**: Enhanced vs Legacy metadata system creates duplicate tags  
**Current Count**: ~15 duplicate occurrences in aggregates package  
**Impact**: Polluted JSDoc output, poor documentation quality  
**Root Cause**: Method-based conflict detection works but enhanced/legacy coordination incomplete  
**Detection**: `grep -c "@business.*@business" packages/aggregates/dist/index.js` should return 0  
**Progress**: Conflict detection implemented, coordination layer needs work  

### Quality Verification Requirements

**✅ Definition of Done for Builds:**
```bash
# All of these checks must PASS:
cd packages/aggregates && pnpm build

# 1. Zero unprocessed directives
[ $(grep -c "@.*-inject" dist/index.js) -eq 0 ] || echo "❌ FAIL: Unprocessed directives"

# 2. Zero duplicate tags  
[ $(grep -c "@business.*@business" dist/index.js) -eq 0 ] || echo "⚠️ WARNING: Duplicates"

# 3. Adequate metadata injection
[ $(grep -c "@business\|@description\|@example" dist/index.js) -gt 200 ] || echo "❌ FAIL: Low metadata"

# 4. TypeScript declarations preserve directives (expected behavior)
[ $(grep -c "@.*-inject" dist/**/*.d.ts) -gt 0 ] || echo "❌ FAIL: Missing .d.ts directives"
```

**🎯 Success Criteria:**
- Zero unprocessed directives in JavaScript output
- Zero duplicate metadata tags
- Metadata count >200 in aggregates package
- Build completes without hanging (<30 seconds)
- No `METADATA CONFLICT DETECTED` errors in console

### Emergency Recovery Procedures

**If system completely fails:**
```bash
# 1. Kill any hung processes
pkill -f "vite build"

# 2. Clear all caches
rm -rf packages/*/dist/ packages/*/.vite/ node_modules/.vite/

# 3. Reinstall and rebuild
pnpm install && pnpm build

# 4. If still failing, disable plugin temporarily
# Edit vite.config.ts and comment out jsDocPlugin
```

## Known Limitations

1. **TypeScript Declarations:** `.d.ts` files are not processed (by design)
2. **Complex JSDoc:** May not handle all JSDoc edge cases perfectly
3. **Markdown Format:** Requires specific markdown structure
4. **Build-Time Only:** Processing happens only during build, not in development
5. **Concurrent Processing:** Race conditions possible under high load
6. **Enhanced/Legacy Coordination:** Duplicate tag generation in some scenarios

## Future Improvements

1. **Development Mode:** Support for live reloading during development
2. **Better Error Handling:** More descriptive error messages
3. **Performance:** Further optimization of file scanning
4. **Validation:** Markdown structure validation
5. **IDE Integration:** Better development experience with IDE plugins

---

*This documentation reflects the current state of the Enhanced Metadata System as of the latest implementation.*