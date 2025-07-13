# ADR-0011: CI/CD Optimization with Smart Path Filtering

**Date:** 2025-07-12  
**Status:** Accepted  
**Context:** CI/CD Performance Optimization for VytchesDDD Enterprise Library

## Context

VytchesDDD is an enterprise monorepo with 23 packages requiring comprehensive
CI/CD validation. The current CI workflow runs full test suites, builds, and
quality gates for **every** change, including documentation-only updates. This
creates unnecessary resource consumption and delayed feedback for non-critical
changes.

### Problem Statement

- **Resource Waste**: Full CI runs for README updates, markdown changes
- **Slow Feedback**: Documentation contributors wait 5-10 minutes for
  unnecessary tests
- **GitHub Actions Costs**: Excessive compute usage for non-functional changes
- **Developer Experience**: Poor DX for documentation contributors

### Current CI Workflow Cost

```bash
# Full CI for ANY change:
✓ Format Check        (~30s)
✓ Lint               (~2min)
✓ Type Check         (~1min)
✓ Test Suite         (~5min) ← Unnecessary for docs
✓ Build All          (~3min) ← Unnecessary for docs
✓ Quality Gates      (~2min) ← Unnecessary for docs
Total: ~13min for a README typo fix
```

## Decision

We adopt **Smart Path-Based CI Optimization** with specialized workflows for
different change types while maintaining enterprise-grade validation for code
changes.

## Implementation Strategy

### **🎯 Path-Based Workflow Filtering**

#### **Main CI Workflow** (`.github/workflows/ci.yml`)

**Triggers:** Code changes only

```yaml
paths-ignore:
  - '**/*.md' # All markdown files
  - 'docs/**' # Documentation directory
  - 'LICENSE' # License file
  - '.gitignore' # Git configuration
  - '.vscode/**' # Editor settings
  - '.idea/**' # IDE settings
  - '**/.DS_Store' # System files
```

#### **Documentation Workflow** (`.github/workflows/docs.yml`)

**Triggers:** Documentation changes only

```yaml
paths:
  - '**/*.md'
  - 'docs/**'
  - '*.md'
```

#### **Dependencies Workflow** (`.github/workflows/dependencies.yml`)

**Triggers:** Dependency changes only

```yaml
paths:
  - '**/package.json'
  - 'pnpm-lock.yaml'
  - 'package.json'
```

#### **Workflow Validation** (`.github/workflows/workflow-validation.yml`)

**Triggers:** CI/CD changes only

```yaml
paths:
  - '.github/workflows/**'
```

### **🏷️ Commit Message Optimization**

Enable manual CI skipping via commit message patterns:

```bash
# Skip all CI workflows
git commit -m "docs: update README [skip ci]"

# Skip CI but run documentation validation
git commit -m "docs: add API examples [docs only]"
```

**Implementation:**

```yaml
if:
  "!contains(github.event.head_commit.message, '[skip ci]') &&
  !contains(github.event.head_commit.message, '[docs only]')"
```

## Workflow Specifications

### **📝 Documentation Workflow**

**Purpose:** Fast validation for documentation changes **Duration:** ~30 seconds
(vs 13 minutes)

**Validation Steps:**

1. **Markdown Formatting** - Prettier validation for consistent formatting
2. **CLAUDE.md Validation** - Project instruction file syntax check
3. **Link Validation** - Basic broken link detection

**Uses existing Prettier configuration** - No additional config needed

### **🔒 Dependencies Workflow**

**Purpose:** Security and license compliance for dependency changes
**Duration:** ~2 minutes

**Validation Steps:**

1. **Security Audit** - `pnpm audit` for vulnerabilities
2. **Outdated Check** - Identify outdated dependencies
3. **License Compliance** - License compatibility validation
4. **Package.json Validation** - JSON syntax and structure
5. **Weekly Scheduled Runs** - Proactive dependency monitoring

### **⚙️ Workflow Validation**

**Purpose:** Validate GitHub Actions workflow changes **Duration:** ~30 seconds

**Validation Steps:**

1. **YAML Syntax** - Validate workflow YAML structure
2. **Permissions Audit** - Ensure explicit permissions defined
3. **Security Check** - Validate workflow security practices

### **🚀 Main CI Workflow (Unchanged for Code)**

**Purpose:** Comprehensive validation for functional changes **Duration:** ~13
minutes (unchanged)

**Maintains full enterprise validation for:**

- TypeScript source code changes
- Configuration changes (tsconfig, eslint, etc.)
- Build system changes (vite.config, nx.json)
- Package.json changes affecting dependencies
- Test file changes

## Benefits Analysis

### **📈 Performance Improvements**

| Change Type   | Before | After  | Improvement    |
| ------------- | ------ | ------ | -------------- |
| Documentation | 13 min | 30 sec | **96% faster** |
| Dependencies  | 13 min | 2 min  | **85% faster** |
| Workflows     | 13 min | 30 sec | **96% faster** |
| Code Changes  | 13 min | 13 min | **Unchanged**  |

### **💰 Resource Savings**

**Estimated Monthly Savings:**

```bash
# Assumptions: 50 commits/month, 30% are docs-only
Documentation commits: 15/month
Savings per commit: 12.5 minutes
Monthly savings: 15 × 12.5 = 187.5 minutes = 3.1 hours

# GitHub Actions cost (hypothetical)
Saved compute: ~180 minutes/month × $0.008/minute = $1.44/month
Annual savings: $17.28 + improved developer experience
```

### **👥 Developer Experience**

**Documentation Contributors:**

- ✅ **Immediate Feedback** - 30 seconds vs 13 minutes
- ✅ **Focused Validation** - Only relevant checks
- ✅ **Lower Barrier** - Encourages documentation contributions
- ✅ **Clear Feedback** - Markdown-specific error messages

**Code Contributors:**

- ✅ **No Impact** - Full validation maintained
- ✅ **Faster Iterations** - When working on docs alongside code
- ✅ **Clear Separation** - Understand which checks apply

## Usage Examples

### **✅ Recommended Usage Patterns**

```bash
# Documentation-only changes
git commit -m "docs: update API documentation examples [docs only]"
git commit -m "docs: fix typo in README [skip ci]"
git commit -m "docs: add architecture decision record"

# Code changes (full CI)
git commit -m "feat(events): add retry mechanism"
git commit -m "fix(logging): resolve memory leak"
git commit -m "refactor(core): improve EntityId validation"

# Dependency changes
git commit -m "chore(deps): update TypeScript to 5.3"
git commit -m "security: patch vulnerable dependencies"

# Mixed changes (full CI runs)
git commit -m "feat(core): add validation with updated docs"
```

### **❌ Anti-patterns**

```bash
# Don't skip CI for functional changes
git commit -m "fix: critical security bug [skip ci]"  # ❌ NEVER

# Don't use [docs only] for code changes
git commit -m "feat: new feature [docs only]"        # ❌ WRONG

# Don't abuse skip patterns
git commit -m "refactor: major changes [skip ci]"    # ❌ DANGEROUS
```

## Configuration Files

### **Markdown Formatting**

Uses existing Prettier configuration - no additional config files needed.
Prettier handles:

- Consistent line length and wrapping
- Table formatting
- Code block formatting
- List indentation
- Quote formatting

### **Path Filter Patterns**

```yaml
# Ignore patterns for main CI
paths-ignore:
  - '**/*.md' # All markdown files
  - 'docs/**' # Documentation directory
  - '*.md' # Root markdown files
  - 'LICENSE' # License file
  - '.gitignore' # Git ignore
  - '.vscode/**' # VS Code settings
  - '.idea/**' # IntelliJ settings
  - '**/.DS_Store' # macOS system files
```

## Quality Assurance

### **No Quality Regression**

- ✅ **Code Changes**: Full enterprise validation maintained
- ✅ **Security**: All functional changes go through security audit
- ✅ **Type Safety**: TypeScript validation unchanged
- ✅ **Test Coverage**: Test suite coverage unchanged for code
- ✅ **Build Validation**: All packages still validate builds

### **Enhanced Documentation Quality**

- ✅ **Markdown Standards**: Enforced linting rules
- ✅ **Consistent Formatting**: Automated formatting validation
- ✅ **Link Validation**: Broken link detection
- ✅ **CLAUDE.md Compliance**: Project instruction validation

### **Security Considerations**

- ✅ **Workflow Permissions**: All workflows use explicit, minimal permissions
- ✅ **No Secret Exposure**: No credentials in workflow validation
- ✅ **Attack Surface**: Reduced CI complexity reduces attack vectors
- ✅ **Audit Trail**: All workflow changes validated before merge

## Monitoring and Metrics

### **Success Metrics**

**Performance:**

- Average CI duration for documentation changes
- Resource utilization per workflow type
- Feedback time for different contribution types

**Quality:**

- Documentation contribution frequency
- False positive/negative rates for path filtering
- Developer satisfaction with CI feedback speed

**Reliability:**

- Zero security regressions from optimization
- Maintained test coverage for code changes
- Workflow success rates by type

### **Monitoring Setup**

```bash
# Monitor workflow efficiency
- Documentation workflow success rate > 95%
- Main CI workflow unchanged success rate
- False positive rate < 2% (code changes triggering docs workflow)
- False negative rate = 0% (docs changes skipping main CI when code present)
```

## Migration Plan

### **Phase 1: Workflow Creation** ✅ **COMPLETED**

- ✅ Create specialized workflows
- ✅ Configure path-based filtering
- ✅ Set up markdownlint configuration
- ✅ Add commit message filtering

### **Phase 2: Team Education**

- [ ] Update contributing guidelines
- [ ] Train team on new commit message patterns
- [ ] Document workflow decision tree
- [ ] Create troubleshooting guide

### **Phase 3: Monitoring**

- [ ] Set up workflow analytics
- [ ] Monitor false positive/negative rates
- [ ] Collect developer feedback
- [ ] Optimize path filters based on usage

### **Phase 4: Advanced Optimization**

- [ ] Implement matrix builds for different change types
- [ ] Add automatic PR labeling based on change type
- [ ] Integrate workflow analytics into project dashboard

## Rollback Plan

If optimization causes issues:

```bash
# Emergency rollback (remove path filters)
git checkout main
git revert <commit-hash>  # Revert path filtering
git push origin main

# Selective rollback (disable specific workflows)
# Comment out paths-ignore in ci.yml temporarily
```

## Comparison with Alternatives

### **✅ Why Path-Based over Conditional Steps**

**Path-Based (Chosen):**

```yaml
# Different workflows triggered by different paths
- Documentation workflow: Fast, focused validation
- Main CI: Full validation for code
```

**Conditional Steps (Not Chosen):**

```yaml
# Single workflow with many conditional steps
- if: contains(github.event.modified_files, '*.md')
  run: markdownlint
- if: "!contains(github.event.modified_files, '*.md')"
  run: full-test-suite
```

**Why Path-Based Wins:**

- ✅ **Clearer Separation** - Easier to understand and maintain
- ✅ **Faster Startup** - Skip entire workflow instead of conditional steps
- ✅ **Better Monitoring** - Separate workflow analytics
- ✅ **Simpler Logic** - No complex conditional expressions

### **✅ Why Multiple Workflows over Monolithic**

**Multiple Workflows (Chosen):**

- ✅ **Specialized Validation** - Each workflow optimized for its purpose
- ✅ **Parallel Execution** - Different workflows can run simultaneously
- ✅ **Clear Responsibility** - Easy to understand what each workflow does
- ✅ **Independent Failure** - Documentation workflow failure doesn't block code

**Monolithic Workflow (Not Chosen):**

- ❌ **Complex Logic** - Many conditional branches
- ❌ **Slow Feedback** - Always runs maximum possible checks
- ❌ **Difficult Debugging** - Hard to identify which part failed
- ❌ **Poor Separation** - All concerns mixed together

## Enterprise Compliance

### **Standards Adherence**

- ✅ **Security**: No reduction in security validation for functional changes
- ✅ **Quality**: Documentation quality enforcement improved
- ✅ **Audit**: All workflows logged and auditable
- ✅ **Compliance**: Maintains SOC2/enterprise requirements for code validation

### **Risk Assessment**

**🟢 Low Risk:**

- Documentation workflow failures don't affect production
- Path filtering is deterministic and testable
- Full validation maintained for all functional changes

**🟡 Medium Risk:**

- False negatives (docs triggering main CI): Wastes resources but doesn't
  compromise quality
- False positives (code skipping validation): Prevented by conservative path
  patterns

**🔴 High Risk (Mitigated):**

- Security bypass: **PREVENTED** - Code changes always trigger full validation
- Quality regression: **PREVENTED** - No reduction in code validation standards

## Future Enhancements

### **Planned Improvements**

1. **Smart Change Detection**

   - Analyze actual file changes, not just paths
   - Detect mixed changes (code + docs) more accurately

2. **Dynamic Workflow Selection**

   - AI-based change classification
   - Automatic workflow optimization based on change patterns

3. **Advanced Caching**

   - Workflow-specific caching strategies
   - Dependency-aware cache invalidation

4. **Integration Testing**
   - Cross-package integration tests only when multiple packages changed
   - Smart test selection based on change impact

---

**Implementation Status:** ✅ **Implemented**  
**Performance Impact:** 96% faster feedback for documentation changes  
**Quality Impact:** Enhanced documentation validation, unchanged code
validation  
**Next Review:** After 3 months of usage data collection

**References:**

- [GitHub Actions Path Filtering](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#onpushpull_requestpaths)
- [Prettier Markdown Support](https://prettier.io/docs/en/index.html)
- [Enterprise CI/CD Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Monorepo CI Optimization Patterns](https://nx.dev/concepts/more-concepts/ci-setup)
