# ADR-0018: Intelligent CI/CD Workflow Optimization with Context-Aware Validation

**Date:** 2025-07-27  
**Status:** Proposed  
**Context:** Optimize CI/CD workflows to eliminate duplication, reduce resource
consumption, and provide context-aware validation for different release
scenarios

## Context

After implementing ADR-0010 (Release Process and Branching Strategy), we
identified several optimization opportunities in our CI/CD workflows:

1. **Resource Waste**: Full test suites running for documentation-only changes
2. **Workflow Duplication**: CI.yml and Release.yml duplicate validation steps
3. **Hotfix Inefficiency**: Hotfixes bypass CI but require full validation in
   Release workflow
4. **Manual Release Control**: Need for manual release triggers as per
   enterprise best practices
5. **Debugging Overhead**: Temporary debugging steps consuming CI resources

## Decision

We adopt **Intelligent Context-Aware CI/CD** strategy that optimizes workflow
execution based on:

- Change type (code vs docs vs config)
- Trigger source (PR vs push vs manual vs hotfix)
- Previous validation status (CI passed vs skipped)

## Workflow Strategy Matrix

### **Execution Matrix by Scenario**

| Scenario                    | Trigger                                | Path Filter    | CI.yml         | Release.yml Validation | Release.yml Publish | Resource Usage |
| --------------------------- | -------------------------------------- | -------------- | -------------- | ---------------------- | ------------------- | -------------- |
| **PR to main**              | `pull_request`                         | ✅ Smart paths | **Full Suite** | ❌ Skip                | ❌ Skip             | Moderate       |
| **Merge to main (post-CI)** | `push`                                 | ✅ Smart paths | ❌ Skip        | **Quick Check**        | ❌ Skip             | Minimal        |
| **Manual Release**          | `workflow_dispatch`                    | N/A            | ❌ Skip        | **Context-Aware**      | **Full Release**    | High           |
| **Hotfix Release**          | `workflow_dispatch` from hotfix branch | N/A            | ❌ Skip        | **Quick Validation**   | **Hotfix Release**  | Medium         |
| **Docs-only changes**       | Any                                    | ✅ Filtered    | **Docs-only**  | ❌ Skip                | ❌ Skip             | Minimal        |
| **Tag push**                | `push` tags                            | N/A            | ❌ Skip        | ❌ Skip                | **Publish-only**    | Low            |

### **Detailed Operations by Scenario**

#### **1. Pull Request Validation**

| Step      | Operation                   | Duration        | Resource |
| --------- | --------------------------- | --------------- | -------- |
| 1         | Checkout + Setup            | ~45s            | Low      |
| 2         | Install dependencies        | ~2m             | Medium   |
| 3         | NX affected analysis        | ~15s            | Low      |
| 4         | Format check (conditional)  | ~30s            | Low      |
| 5         | Lint affected projects      | ~1-3m           | Medium   |
| 6         | Type check affected         | ~1-2m           | Medium   |
| 7         | JSDoc validation            | ~30s            | Low      |
| 8         | Test affected projects      | ~2-8m           | High     |
| 9         | Build affected projects     | ~1-3m           | Medium   |
| 10        | Quality gates (conditional) | ~2-5m           | High     |
| **Total** | **~8-22m**                  | **Medium-High** |

#### **2. Standard Release (Manual Trigger)**

| Step      | Operation                       | Duration        | Resource |
| --------- | ------------------------------- | --------------- | -------- |
| 1         | Checkout + Setup                | ~45s            | Low      |
| 2         | Install dependencies            | ~2m             | Medium   |
| 3         | Detect context                  | ~5s             | Low      |
| 4         | Quick validation (if CI passed) | ~2m             | Low      |
| 5         | Full validation (if no CI)      | ~8-15m          | High     |
| 6         | Build all packages              | ~3-5m           | Medium   |
| 7         | Check package changes           | ~30s            | Low      |
| 8         | Version packages                | ~1m             | Medium   |
| 9         | Publish to GitHub Packages      | ~2-3m           | Medium   |
| **Total** | **~9-26m**                      | **Medium-High** |

#### **3. Hotfix Release (Quick Path)**

| Step      | Operation                | Duration   | Resource |
| --------- | ------------------------ | ---------- | -------- |
| 1         | Checkout + Setup         | ~45s       | Low      |
| 2         | Install dependencies     | ~2m        | Medium   |
| 3         | Detect hotfix context    | ~5s        | Low      |
| 4         | Quick validation only    | ~3-5m      | Medium   |
| 5         | Build affected packages  | ~1-2m      | Low      |
| 6         | Version packages (patch) | ~30s       | Low      |
| 7         | Publish hotfix           | ~2m        | Medium   |
| **Total** | **~9-12m**               | **Medium** |

#### **4. Documentation-only Changes**

| Step      | Operation           | Duration | Resource |
| --------- | ------------------- | -------- | -------- |
| 1         | Checkout + Setup    | ~30s     | Low      |
| 2         | Markdown linting    | ~15s     | Low      |
| 3         | Link validation     | ~30s     | Low      |
| 4         | Documentation build | ~1m      | Low      |
| **Total** | **~2-3m**           | **Low**  |

## Workflow Implementation

### **CI.yml (Pull Request Validation)**

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop, 'release/**']
    paths-ignore:
      - '**/*.md'
      - 'docs/**'
      - '*.md'
      - 'LICENSE'
      - '.gitignore'
      - '.vscode/**'
      - '.idea/**'

jobs:
  validation:
    runs-on: ubuntu-latest
    steps:
      # Smart NX affected validation
      - name: NX affected analysis
      - name: Conditional validation based on changes
      - name: Quality gates for affected projects
```

### **Release.yml (Production Release)**

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      release_type:
        type: choice
        options: [patch, minor, major, hotfix]
  push:
    tags: ['v*']

jobs:
  context-detection:
    outputs:
      is_hotfix: ${{ steps.detect.outputs.is_hotfix }}
      validation_needed: ${{ steps.detect.outputs.validation_needed }}

  validation:
    needs: [context-detection]
    if: needs.context-detection.outputs.validation_needed == 'true'
    strategy:
      matrix:
        validation_type:
          - ${{ needs.context-detection.outputs.is_hotfix == 'true' && 'quick'
            || 'full' }}

  release:
    needs: [context-detection, validation]
    if: github.event_name == 'workflow_dispatch'
```

## Release Commands with Context

### **Standard Release Process**

```bash
# 1. Feature development (NO release commands in feature branches)
git checkout -b feature/add-new-functionality
git commit -m "feat(core): add new validation system"
git push origin feature/add-new-functionality
# → Creates PR → Triggers CI.yml (full validation)

# 2. PR merge to main
# → Triggers minimal validation in Release.yml
# → NO automatic publish (manual control)

# 3. Manual release preparation
# Check what will be released
pnpm release:preview
pnpm release:collect

# Manual release via GitHub UI
# Actions → Release → Run workflow → Select release type
# → Triggers Release.yml with context detection
```

### **Hotfix Process with Optimized Commands**

```bash
# 1. Hotfix branch creation
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-fix

# 2. Make critical fixes
git commit -m "fix(security): resolve XSS vulnerability"

# 3. Manual hotfix release
# Actions → Release → Run workflow → Select "hotfix"
# → Triggers optimized hotfix path in Release.yml
#   ✅ Quick validation (3-5m instead of 15-20m)
#   ✅ Automatic patch version
#   ✅ Fast publish path
```

### **Emergency Release Commands**

```bash
# For critical production issues requiring immediate release
# Skip standard validation, minimal safety checks only

# Option 1: GitHub UI (recommended)
# Actions → Release → Run workflow → release_type: "hotfix"

# Option 2: Direct command (if workflow fails)
git checkout hotfix/emergency-fix
pnpm release:hotfix  # Uses release:hotfix script from package.json
```

## Context Detection Logic

### **Automatic Context Recognition**

```yaml
# In Release.yml
- name: Detect release context
  id: context
  run: |
    echo "Analyzing release context..."

    # Hotfix detection
    if [[ "${{ github.ref }}" == *"hotfix"* ]] || [[ "${{ github.event.inputs.release_type }}" == "hotfix" ]]; then
      echo "is_hotfix=true" >> $GITHUB_OUTPUT
      echo "validation_mode=quick" >> $GITHUB_OUTPUT
      echo "🚨 HOTFIX MODE: Using quick validation path"
    fi

    # CI status detection
    if [[ "${{ github.event.head_commit.message }}" == *"[ci passed]"* ]]; then
      echo "ci_passed=true" >> $GITHUB_OUTPUT
      echo "validation_needed=false" >> $GITHUB_OUTPUT
      echo "✅ CI PASSED: Skipping duplicate validation"
    else
      echo "ci_passed=false" >> $GITHUB_OUTPUT
      echo "validation_needed=true" >> $GITHUB_OUTPUT
      echo "🔍 NO CI: Full validation required"
    fi

    # Manual release detection
    if [[ "${{ github.event_name }}" == "workflow_dispatch" ]]; then
      echo "is_manual=true" >> $GITHUB_OUTPUT
      echo "🎯 MANUAL RELEASE: Using manual release path"
    fi
```

## Resource Optimization Benefits

### **Before Optimization**

| Scenario     | CI.yml Time | Release.yml Time | Total Time | Resource Usage |
| ------------ | ----------- | ---------------- | ---------- | -------------- |
| PR + Release | 15-20m      | 20-25m           | **35-45m** | Very High      |
| Hotfix       | 0m          | 20-25m           | **20-25m** | High           |
| Docs change  | 15-20m      | 20-25m           | **35-45m** | Very High      |

### **After Optimization**

| Scenario     | CI.yml Time | Release.yml Time | Total Time | Resource Usage | Savings        |
| ------------ | ----------- | ---------------- | ---------- | -------------- | -------------- |
| PR + Release | 8-15m       | 3-8m             | **11-23m** | Medium         | **48% faster** |
| Hotfix       | 0m          | 9-12m            | **9-12m**  | Medium         | **52% faster** |
| Docs change  | 2-3m        | 0m               | **2-3m**   | Low            | **92% faster** |

### **Monthly Resource Savings Estimate**

```
Assumptions:
- 20 PRs/month (avg 4 per week)
- 4 releases/month (weekly releases)
- 2 hotfixes/month
- 10 docs-only changes/month

Before: 20×35m + 4×25m + 2×25m + 10×35m = 1,200 minutes/month
After:  20×15m + 4×10m + 2×10m + 10×3m = 390 minutes/month

Savings: 810 minutes/month (13.5 hours) = 67% reduction
```

## Path Filtering Strategy

### **Intelligent Path Detection**

```yaml
# Documentation-only changes
docs_only_paths:
  - '**/*.md'
  - 'docs/**'
  - '*.md'
  - 'LICENSE'
  - 'README.md'

# Configuration-only changes
config_only_paths:
  - '.vscode/**'
  - '.idea/**'
  - '.github/workflows/**'
  - '*.config.js'
  - '*.config.ts'

# Source code changes (require full validation)
source_code_paths:
  - 'packages/**/*.ts'
  - 'packages/**/*.js'
  - 'examples/**/*.ts'
  - 'scripts/**/*.js'
```

## Error Recovery and Debugging

### **Failed Release Recovery (Context-Aware)**

```bash
# Standard release failure
git reset --hard HEAD~1  # Undo version commit
git tag -d v1.2.0        # Delete created tag
pnpm release:dry         # Preview what would happen
# → Manual trigger with full validation

# Hotfix release failure
git reset --hard HEAD~1
git tag -d v1.2.1
# → Manual trigger with hotfix context (quick validation)

# Emergency bypass (if all automation fails)
pnpm lerna version patch --no-conventional-commits --no-push
pnpm lerna publish from-git --yes
```

## Quality Gates Integration

### **Conditional Quality Gates**

```yaml
- name: Run Quality Gates
  if: |
    steps.context.outputs.is_hotfix != 'true' &&
    steps.context.outputs.validation_needed == 'true'
  run: node scripts/quality-gates/quality-gates.js --ci --parallel

- name: Quick Quality Check (Hotfix)
  if: steps.context.outputs.is_hotfix == 'true'
  run: |
    echo "🚨 HOTFIX MODE: Running essential checks only"
    pnpm test --testPathPattern="critical"
    pnpm lint --fix=false
    echo "✅ Hotfix validation complete"
```

## Monitoring and Metrics

### **Workflow Performance Tracking**

```yaml
- name: Track workflow metrics
  run: |
    echo "workflow_type=${{ steps.context.outputs.validation_mode }}" >> $GITHUB_ENV
    echo "start_time=$(date +%s)" >> $GITHUB_ENV

- name: Report completion metrics
  if: always()
  run: |
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "⏱️ Workflow completed in ${duration}s"
    echo "📊 Context: ${{ env.workflow_type }}"
```

## Benefits Summary

### **🚀 Performance Improvements**

- **67% reduction** in average CI/CD time
- **48% faster** standard releases
- **52% faster** hotfix releases
- **92% faster** documentation updates

### **💰 Resource Efficiency**

- **13.5 hours/month** saved CI/CD time
- **Reduced GitHub Actions** minutes consumption
- **Lower infrastructure** costs
- **Faster feedback** loops for developers

### **🛡️ Quality Assurance**

- **Context-appropriate** validation levels
- **Hotfix safety** without speed compromise
- **Full validation** when needed
- **Emergency procedures** for critical fixes

### **👥 Developer Experience**

- **Faster PR** feedback (affected projects only)
- **Quick hotfix** deployment for emergencies
- **Manual release** control for production safety
- **Clear workflow** paths for different scenarios

## Implementation Checklist

- [ ] Update Release.yml with context detection
- [ ] Add intelligent path filtering
- [ ] Remove debugging steps from workflows
- [ ] Test hotfix path with sample release
- [ ] Validate resource usage improvements
- [ ] Update team documentation
- [ ] Monitor performance metrics for 2 weeks

---

**Implementation Status:** 🔄 **In Progress**  
**Last Updated:** 2025-07-27  
**Next Review:** After 2 weeks of production usage

**References:**

- ADR-0010: Release Process and Branching Strategy
- ADR-0011: CI/CD Optimization with Smart Path Filtering
- [GitHub Actions Best Practices](https://docs.github.com/en/actions/learn-github-actions/best-practices-for-github-actions)
- [NX Affected Documentation](https://nx.dev/concepts/affected)
