# Quality Gates System

Enterprise-grade quality monitoring and enforcement for the VytchesDDD project.
This system prevents regressions and maintains code quality through automated
checks and monitoring.

## 🚀 Features

### Core Monitoring Systems

1. **TypeScript `any` Type Monitor** (`any-type-monitor.js`)

   - Tracks and limits `any` type usage
   - Configurable thresholds per package
   - Justification patterns for infrastructure code
   - Baseline regression detection

2. **Bundle Size Monitor** (`bundle-size-monitor.js`)

   - Package size monitoring with thresholds
   - Tree-shaking effectiveness analysis
   - Regression detection and improvement tracking
   - Source vs built size comparison

3. **Performance Monitor** (`performance-monitor.js`)
   - Build time tracking per package and globally
   - Test execution performance monitoring
   - Memory usage analysis
   - Performance regression detection

### Integration & Automation

4. **Quality Gates Orchestrator** (`quality-gates.js`)

   - Centralized execution of all quality checks
   - Parallel execution for performance
   - Comprehensive reporting and CI/CD integration
   - Baseline management

5. **Dashboard & Analytics** (`dashboard.js`)

   - Historical data tracking and trend analysis
   - Quality metrics visualization
   - Export capabilities (JSON, CSV, HTML)
   - Actionable recommendations

6. **Pre-commit Hooks** (`pre-commit-hook.js`)
   - Fast quality validation before commits
   - Changed-file-only analysis for speed
   - Bypass options for emergency commits
   - Integration with git hooks

### ESLint Integration

7. **Custom ESLint Plugin** (`eslint-plugin-quality-gates.js`)
   - Custom rules for quality enforcement
   - Infrastructure pattern exceptions
   - Auto-fixing capabilities where possible

## 📊 Current Quality Metrics (July 2025)

Based on IMPROVE.md analysis:

- **TypeScript any types**: 67 total (target: 0, threshold: 70)
- **Bundle sizes**: All packages <100KB (excellent)
- **Core package**: 1.4KB (99.2% reduction achieved)
- **Test coverage**: >95% maintained
- **Type safety**: 0 compilation errors

## 🔧 Usage

### Quick Start

```bash
# Run all quality gates
pnpm quality

# Run in CI mode (exit on failures)
pnpm quality:ci

# Save current state as baseline
pnpm quality:baseline

# View detailed output
pnpm quality:verbose
```

### Individual Monitors

```bash
# Check any types only
pnpm quality:any

# Check bundle sizes only
pnpm quality:bundle

# Check performance only
pnpm quality:performance
```

### Dashboard & Analytics

```bash
# View quality dashboard
node scripts/quality-gates/dashboard.js

# Show trend analysis for last 30 days
node scripts/quality-gates/dashboard.js trends 30

# Export data
node scripts/quality-gates/dashboard.js export html report.html
node scripts/quality-gates/dashboard.js export csv data.csv
```

### Pre-commit Integration

```bash
# Run pre-commit checks manually
node scripts/quality-gates/pre-commit-hook.js

# Install as git hook (automatic)
echo "node scripts/quality-gates/pre-commit-hook.js" > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## ⚙️ Configuration

### Any Type Thresholds

Current thresholds per package (in `any-type-monitor.js`):

```javascript
packageThresholds: {
  'core': 0,           // Meta-package should have no any types
  'domain-primitives': 5,  // Foundation packages should be strict
  'value-objects': 5,
  'repositories': 5,
  'aggregates': 10,
  // ... see file for complete configuration
}
```

### Bundle Size Limits

Current size limits in KB (in `bundle-size-monitor.js`):

```javascript
sizeThresholds: {
  'core': 5,              // Meta-package: Target <5KB
  'domain-primitives': 50,  // Foundation: <50KB
  'events': 70,
  'cqrs': 100,           // Complex architecture patterns
  // ... see file for complete configuration
}
```

### Performance Thresholds

Build time limits in seconds (in `performance-monitor.js`):

```javascript
buildTimeThresholds: {
  package: {
    'core': 5,           // Meta-package should build very fast
    'domain-primitives': 30,
    'cqrs': 50,          // Complex architecture
    // ... see file for complete configuration
  },
  total: 300,           // Total build time should be under 5 minutes
  average: 35           // Average package build time
}
```

## 🔍 Quality Gate Details

### TypeScript Any Type Monitor

**Purpose**: Prevent regression in type safety by monitoring `any` type usage.

**Features**:

- Scans all TypeScript files in packages/
- Excludes test files and type definition files
- Recognizes justified patterns (decorators, event constructors)
- Tracks baseline and prevents regression
- Configurable per-package thresholds

**Justified Patterns**:

- Decorator parameters: `target: any`, `propertyKey: any`
- Event constructors: `constructor(...args: any[])`
- Type utilities: `Record<string, any>`
- Infrastructure interfaces

### Bundle Size Monitor

**Purpose**: Prevent bundle bloat and ensure optimal package sizes.

**Features**:

- Monitors source and built bundle sizes
- Calculates tree-shaking effectiveness
- Tracks size regression over time
- Package-specific size limits
- Analysis of largest files per package

**Thresholds**:

- Foundation packages: <50KB
- Architecture packages: <100KB
- Core meta-package: <5KB

### Performance Monitor

**Purpose**: Ensure development workflow remains fast and efficient.

**Features**:

- Build time monitoring per package
- Test execution performance tracking
- Memory usage analysis
- Global performance metrics
- Parallel execution measurement

**Thresholds**:

- Individual package build: <60s
- Total build time: <300s (5 minutes)
- Test execution: <180s (3 minutes)

## 🎯 CI/CD Integration

### GitHub Actions Integration

Quality gates are automatically run in CI/CD:

```yaml
- name: Run Quality Gates
  run: node scripts/quality-gates/quality-gates.js --ci --parallel
  env:
    NODE_ENV: ci
```

### Exit Codes

- `0`: All quality gates passed
- `1`: Quality gate violations detected

### Bypass Options

For emergency situations, quality gates can be bypassed:

```bash
# In commit message
git commit -m "Emergency fix --skip-quality"

# Or using bypass flags
git commit -m "Hotfix [skip quality]"
```

## 📈 Baseline Management

### Creating Baselines

```bash
# Save current state as baseline for all monitors
pnpm quality:baseline

# Save individual baselines
node scripts/quality-gates/any-type-monitor.js --baseline
node scripts/quality-gates/bundle-size-monitor.js --baseline
node scripts/quality-gates/performance-monitor.js --baseline
```

### Baseline Files

Baselines are stored in `.quality-gates/`:

- `any-types-baseline.json`
- `bundle-size-baseline.json`
- `performance-baseline.json`
- `quality-history.json` (dashboard data)

### Regression Detection

The system automatically detects regressions by comparing current metrics to
baseline:

- **Any types**: Any increase triggers regression warning
- **Bundle size**: >10% increase triggers violation
- **Performance**: >15% build time increase triggers violation

## 🛠️ Development Workflow

### Recommended Workflow

1. **Before starting work**: Check current quality status

   ```bash
   pnpm quality:verbose
   ```

2. **During development**: Run individual monitors as needed

   ```bash
   pnpm quality:any     # Check any types
   pnpm quality:bundle  # Check bundle sizes
   ```

3. **Before committing**: Pre-commit hooks automatically run

4. **After major changes**: Update baselines if improvements are intentional
   ```bash
   pnpm quality:baseline
   ```

### Quality Gate Failures

When quality gates fail:

1. **Review violations**: Check the detailed report
2. **Fix issues**: Address any types, bundle sizes, or performance
3. **Re-run checks**: Verify fixes work
4. **Update baselines**: If changes are intentional improvements

### Emergency Bypass

For urgent fixes that can't wait for quality improvements:

```bash
git commit -m "Critical security fix --skip-quality"
```

## 📊 Monitoring & Analytics

### Dashboard Features

- **Historical tracking**: Quality metrics over time
- **Trend analysis**: Identify patterns and regressions
- **Success rate**: Overall quality gate pass rate
- **Recommendations**: Actionable improvement suggestions

### Export Options

- **JSON**: Machine-readable data for external tools
- **CSV**: Spreadsheet analysis and charts
- **HTML**: Visual reports for stakeholders

### Metrics Tracked

1. **Code Quality**:

   - Any type count and trends
   - Type safety violations
   - ESLint violations

2. **Performance**:

   - Build times per package and globally
   - Test execution times
   - Memory usage patterns

3. **Bundle Health**:
   - Package sizes and growth
   - Tree-shaking effectiveness
   - Bundle composition analysis

## 🔧 Troubleshooting

### Common Issues

1. **False Positives on Any Types**:

   - Add justified patterns to configuration
   - Use infrastructure file patterns
   - Document reasons in comments

2. **Bundle Size Violations**:

   - Review largest files in package
   - Ensure tree-shaking is working
   - Consider package splitting

3. **Performance Regressions**:
   - Profile build and test operations
   - Check for dependency changes
   - Consider parallel execution optimizations

### Debug Mode

Run with verbose output for debugging:

```bash
node scripts/quality-gates/quality-gates.js --verbose
```

### Configuration Updates

Quality gate configurations can be updated in the respective monitor files:

- `any-type-monitor.js`: CONFIG object
- `bundle-size-monitor.js`: CONFIG object
- `performance-monitor.js`: CONFIG object

## 📈 Future Enhancements

Planned improvements:

1. **Advanced Analytics**:

   - Machine learning for anomaly detection
   - Predictive quality metrics
   - Advanced trend analysis

2. **Integration Expansion**:

   - IDE extensions for real-time feedback
   - Slack/Teams notifications
   - Integration with project management tools

3. **Quality Metrics**:
   - Code complexity analysis
   - Dependency health monitoring
   - Security vulnerability tracking

## 🎉 Success Metrics

Current achievements (July 2025):

- ✅ **99.2% core bundle reduction** (184KB → 1.4KB)
- ✅ **67 any types** (down from 77, -13% improvement)
- ✅ **0 compilation errors** (from 100+ errors)
- ✅ **All packages <100KB** (excellent bundle health)
- ✅ **>95% test coverage** maintained
- ✅ **Enterprise-grade quality infrastructure** implemented

The VytchesDDD project now has comprehensive quality gates that prevent
regressions while maintaining development velocity!
