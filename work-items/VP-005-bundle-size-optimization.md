# VP-005: Bundle Size Deep Optimization

**Priority**: 78/100  
**Category**: Performance  
**Pillar**: Performance Excellence  
**Estimated Time**: 16 hours  
**Dependencies**: VP-002, VP-003, VP-004  
**Status**: Ready for Implementation

## 📋 Context

Despite meta-package improvements, further bundle optimization opportunities
exist:

- Complex webpack configurations limiting tree-shaking
- Duplicate dependencies across packages
- Inefficient code splitting strategies
- Suboptimal import statements
- Runtime dependencies that could be dev dependencies
- Missing bundle size monitoring

**Business Impact**: 30% additional bundle size reduction for enterprise
deployment

## 🎯 Objectives

1. Achieve additional 30% bundle size reduction (from 700KB to 490KB)
2. Improve tree-shaking effectiveness from 75% to 90%+
3. Eliminate duplicate dependencies across packages
4. Implement intelligent code splitting
5. Optimize import statements for better tree-shaking
6. Minimize runtime dependencies
7. Create bundle size monitoring CI job
8. Document optimization techniques

## 📊 Current Bundle Analysis Baseline

```bash
# Current state after meta-package optimization
Total bundle size: 700KB (down from 1.2MB)
Tree-shaking effectiveness: 75%
Duplicate dependencies: 12 packages
Dead code percentage: 8%

# Target state
Total bundle size: 490KB (30% reduction)
Tree-shaking effectiveness: 90%+
Duplicate dependencies: 0
Dead code percentage: <2%
```

## ✅ Implementation Tasks

### Phase 1: Bundle Analysis & Discovery (4 hours)

#### Task 1.1: Deep Bundle Analysis

```bash
# packages/build-tools/scripts/bundle-analysis.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const madge = require('madge');

class BundleAnalyzer {
  async analyzeBundle(packageName) {
    console.log(`🔍 Analyzing bundle for ${packageName}...`);

    // 1. Webpack Bundle Analysis
    const bundleStats = await this.runWebpackAnalysis(packageName);

    // 2. Dependency Analysis
    const depGraph = await madge(`packages/${packageName}/src`);
    const circular = depGraph.circular();
    const orphaned = depGraph.orphans();

    // 3. Tree-shaking Analysis
    const treeShakingReport = await this.analyzeTreeShaking(packageName);

    // 4. Duplicate Detection
    const duplicates = await this.findDuplicateDependencies(packageName);

    // 5. Dead Code Detection
    const deadCode = await this.findDeadCode(packageName);

    return {
      package: packageName,
      bundleSize: bundleStats.size,
      gzipSize: bundleStats.gzipSize,
      treeShaking: treeShakingReport,
      duplicates,
      deadCode,
      circular,
      orphaned,
      recommendations: this.generateRecommendations({
        bundleStats,
        treeShakingReport,
        duplicates,
        deadCode
      })
    };
  }

  async analyzeTreeShaking(packageName) {
    const package = require(`../packages/${packageName}/package.json`);
    const distPath = `packages/${packageName}/dist`;

    // Check if package.json has proper sideEffects configuration
    const hasSideEffects = package.sideEffects !== false;

    // Analyze export usage
    const exports = this.getExports(distPath);
    const usedExports = await this.findUsedExports(exports);
    const unusedExports = exports.filter(e => !usedExports.includes(e));

    const effectiveness = ((exports.length - unusedExports.length) / exports.length) * 100;

    return {
      totalExports: exports.length,
      usedExports: usedExports.length,
      unusedExports: unusedExports.length,
      effectiveness: Math.round(effectiveness),
      hasSideEffects,
      unusedExportsList: unusedExports,
      recommendations: this.getTreeShakingRecommendations({
        effectiveness,
        hasSideEffects,
        unusedExports
      })
    };
  }

  async findDuplicateDependencies(packageName) {
    const packagePath = `packages/${packageName}`;
    const package = require(`../${packagePath}/package.json`);
    const lockFile = require('../pnpm-lock.yaml');

    const duplicates = [];
    const seenDeps = new Map();

    // Analyze all dependencies
    const allDeps = {
      ...package.dependencies,
      ...package.devDependencies,
      ...package.peerDependencies
    };

    for (const [name, version] of Object.entries(allDeps)) {
      if (seenDeps.has(name)) {
        const existing = seenDeps.get(name);
        if (existing.version !== version) {
          duplicates.push({
            package: name,
            versions: [existing.version, version],
            locations: [existing.location, packagePath]
          });
        }
      } else {
        seenDeps.set(name, { version, location: packagePath });
      }
    }

    return duplicates;
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    // Bundle size recommendations
    if (analysis.bundleStats.size > 100000) { // 100KB
      recommendations.push({
        type: 'bundle-size',
        priority: 'high',
        message: 'Bundle size exceeds 100KB, consider code splitting',
        action: 'implement dynamic imports'
      });
    }

    // Tree-shaking recommendations
    if (analysis.treeShakingReport.effectiveness < 80) {
      recommendations.push({
        type: 'tree-shaking',
        priority: 'high',
        message: 'Tree-shaking effectiveness below 80%',
        action: 'optimize exports and fix sideEffects'
      });
    }

    // Duplicates recommendations
    if (analysis.duplicates.length > 0) {
      recommendations.push({
        type: 'duplicates',
        priority: 'medium',
        message: `${analysis.duplicates.length} duplicate dependencies found`,
        action: 'consolidate dependency versions'
      });
    }

    return recommendations;
  }
}

// Usage
const analyzer = new BundleAnalyzer();
async function analyzeAll() {
  const packages = ['core', 'aggregates', 'cqrs', 'events', 'policies'];

  for (const pkg of packages) {
    const analysis = await analyzer.analyzeBundle(pkg);
    console.log(`\n📊 Analysis for ${pkg}:`);
    console.log(`Bundle size: ${(analysis.bundleSize / 1024).toFixed(1)}KB`);
    console.log(`Tree-shaking: ${analysis.treeShaking.effectiveness}%`);
    console.log(`Duplicates: ${analysis.duplicates.length}`);

    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      analysis.recommendations.forEach(r => {
        console.log(`  ${r.priority.toUpperCase()}: ${r.message} - ${r.action}`);
      });
    }
  }
}
```

#### Task 1.2: Dependency Audit

```javascript
// scripts/dependency-audit.js
const fs = require('fs');
const path = require('path');

class DependencyAuditor {
  async auditDependencies() {
    const packages = this.getAllPackages();
    const report = {
      totalPackages: packages.length,
      duplicates: [],
      unnecessary: [],
      misplaced: [],
      missing: [],
      outdated: [],
    };

    // Find duplicates across packages
    const depMap = new Map();

    for (const pkg of packages) {
      const packageJson = require(`../packages/${pkg}/package.json`);
      const deps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };

      for (const [name, version] of Object.entries(deps)) {
        if (!depMap.has(name)) {
          depMap.set(name, []);
        }
        depMap.get(name).push({ package: pkg, version });
      }
    }

    // Identify duplicates with different versions
    for (const [depName, usages] of depMap) {
      const versions = [...new Set(usages.map(u => u.version))];
      if (versions.length > 1) {
        report.duplicates.push({
          dependency: depName,
          versions,
          packages: usages,
        });
      }
    }

    // Find unnecessary dependencies
    for (const pkg of packages) {
      const unnecessary = await this.findUnnecessaryDeps(pkg);
      if (unnecessary.length > 0) {
        report.unnecessary.push({
          package: pkg,
          dependencies: unnecessary,
        });
      }
    }

    // Check for misplaced dependencies (runtime vs dev)
    for (const pkg of packages) {
      const misplaced = await this.findMisplacedDeps(pkg);
      if (misplaced.length > 0) {
        report.misplaced.push({
          package: pkg,
          dependencies: misplaced,
        });
      }
    }

    return report;
  }

  async findUnnecessaryDeps(packageName) {
    const packagePath = `packages/${packageName}`;
    const packageJson = require(`../${packagePath}/package.json`);
    const srcFiles = await this.getAllSourceFiles(packagePath);

    const unnecessary = [];
    const allDeps = Object.keys({
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    });

    for (const dep of allDeps) {
      const isUsed = await this.isDependencyUsed(dep, srcFiles);
      if (!isUsed) {
        unnecessary.push(dep);
      }
    }

    return unnecessary;
  }

  async isDependencyUsed(depName, sourceFiles) {
    const importPatterns = [
      new RegExp(`import.*from ['"]${depName}['"]`),
      new RegExp(`require\\(['"]${depName}['"]\\)`),
      new RegExp(`import\\(['"]${depName}['"]\\)`),
    ];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');

      for (const pattern of importPatterns) {
        if (pattern.test(content)) {
          return true;
        }
      }
    }

    return false;
  }

  generateCleanupScript(auditReport) {
    let script = '#!/bin/bash\n\n';
    script += '# Dependency cleanup script\n';
    script += '# Generated by bundle optimization tool\n\n';

    // Remove unnecessary dependencies
    for (const pkg of auditReport.unnecessary) {
      script += `echo "Removing unnecessary deps from ${pkg.package}"\n`;
      for (const dep of pkg.dependencies) {
        script += `cd packages/${pkg.package} && pnpm remove ${dep}\n`;
      }
      script += '\n';
    }

    // Consolidate duplicate versions
    for (const dup of auditReport.duplicates) {
      const latestVersion = this.getLatestVersion(dup.versions);
      script += `echo "Consolidating ${dup.dependency} to ${latestVersion}"\n`;

      for (const usage of dup.packages) {
        if (usage.version !== latestVersion) {
          script += `cd packages/${usage.package} && pnpm update ${dup.dependency}@${latestVersion}\n`;
        }
      }
      script += '\n';
    }

    fs.writeFileSync('scripts/dependency-cleanup.sh', script);
    fs.chmodSync('scripts/dependency-cleanup.sh', '755');

    return 'scripts/dependency-cleanup.sh';
  }
}
```

### Phase 2: Code Splitting Implementation (4 hours)

#### Task 2.1: Dynamic Import Strategy

```typescript
// packages/core/src/dynamic-imports.ts
export class DynamicModuleLoader {
  private static cache = new Map<string, Promise<any>>();

  static async loadModule<T>(
    moduleName: string,
    loader: () => Promise<T>
  ): Promise<T> {
    if (this.cache.has(moduleName)) {
      return this.cache.get(moduleName);
    }

    const promise = loader();
    this.cache.set(moduleName, promise);

    try {
      const module = await promise;
      return module;
    } catch (error) {
      // Remove failed promise from cache
      this.cache.delete(moduleName);
      throw error;
    }
  }

  // Lazy load heavy features
  static async loadAggregates() {
    return this.loadModule(
      'aggregates',
      () => import('@vytches/ddd-aggregates')
    );
  }

  static async loadCQRS() {
    return this.loadModule('cqrs', () => import('@vytches/ddd-cqrs'));
  }

  static async loadEvents() {
    return this.loadModule('events', () => import('@vytches/ddd-events'));
  }

  static async loadPolicies() {
    return this.loadModule('policies', () => import('@vytches/ddd-policies'));
  }

  static async loadMessaging() {
    return this.loadModule('messaging', () => import('@vytches/ddd-messaging'));
  }

  static async loadResilience() {
    return this.loadModule(
      'resilience',
      () => import('@vytches/ddd-resilience')
    );
  }
}

// Enhanced core package with lazy loading
export class VytchesDDDCore {
  private static _aggregates?: typeof import('@vytches/ddd-aggregates');
  private static _cqrs?: typeof import('@vytches/ddd-cqrs');
  private static _events?: typeof import('@vytches/ddd-events');

  // Core utilities (always included)
  static get utils() {
    return require('@vytches/ddd-utils');
  }

  static get validation() {
    return require('@vytches/ddd-validation');
  }

  // Lazy-loaded modules
  static async aggregates() {
    if (!this._aggregates) {
      this._aggregates = await DynamicModuleLoader.loadAggregates();
    }
    return this._aggregates;
  }

  static async cqrs() {
    if (!this._cqrs) {
      this._cqrs = await DynamicModuleLoader.loadCQRS();
    }
    return this._cqrs;
  }

  static async events() {
    if (!this._events) {
      this._events = await DynamicModuleLoader.loadEvents();
    }
    return this._events;
  }

  // Feature detection for conditional loading
  static async loadForUseCase(useCase: 'basic' | 'cqrs' | 'events' | 'full') {
    const modules = [];

    switch (useCase) {
      case 'basic':
        modules.push(this.utils, this.validation);
        break;

      case 'cqrs':
        modules.push(
          this.utils,
          this.validation,
          await this.aggregates(),
          await this.cqrs()
        );
        break;

      case 'events':
        modules.push(
          this.utils,
          this.validation,
          await this.aggregates(),
          await this.events()
        );
        break;

      case 'full':
        modules.push(
          this.utils,
          this.validation,
          await this.aggregates(),
          await this.cqrs(),
          await this.events(),
          await DynamicModuleLoader.loadPolicies(),
          await DynamicModuleLoader.loadMessaging()
        );
        break;
    }

    return modules;
  }
}
```

#### Task 2.2: Tree-Shaking Optimization

```javascript
// rollup.config.optimization.js
import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import analyze from 'rollup-plugin-analyzer';

export function createOptimizedConfig(packageName) {
  return defineConfig({
    input: `packages/${packageName}/src/index.ts`,
    output: [
      {
        file: `packages/${packageName}/dist/index.js`,
        format: 'es',
        sourcemap: true,
        // Enable tree-shaking
        preserveModules: true,
        preserveModulesRoot: 'src',
        // Optimize exports
        exports: 'named',
        // Enable code splitting
        manualChunks: id => {
          if (id.includes('node_modules')) {
            return 'vendor';
          }

          // Split by feature
          if (id.includes('/aggregates/')) return 'aggregates';
          if (id.includes('/cqrs/')) return 'cqrs';
          if (id.includes('/events/')) return 'events';
          if (id.includes('/policies/')) return 'policies';

          return 'core';
        },
      },
      {
        file: `packages/${packageName}/dist/index.cjs`,
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
    ],
    plugins: [
      nodeResolve({
        preferBuiltins: false,
        // Tree-shake node_modules
        modulesOnly: true,
      }),
      commonjs({
        // Optimize CommonJS conversion
        ignoreDynamicRequires: true,
      }),
      typescript({
        tsconfig: `packages/${packageName}/tsconfig.json`,
        // Enable declaration maps for better tree-shaking
        declarationMap: true,
        // Remove comments to reduce size
        removeComments: true,
      }),
      terser({
        // Aggressive optimization
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug'],
          // Remove unused code
          unused: true,
          dead_code: true,
          side_effects: false,
        },
        mangle: {
          // Preserve class names for debugging
          keep_classnames: true,
          keep_fnames: false,
        },
      }),
      analyze({
        summaryOnly: true,
        limit: 10,
      }),
    ],
    external: id => {
      // Don't bundle other @vytches packages
      if (id.startsWith('@vytches/')) return true;

      // Don't bundle Node.js built-ins
      return require('module').builtinModules.includes(id);
    },
    // Enable aggressive tree-shaking
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false,
    },
  });
}
```

### Phase 3: Import Optimization (4 hours)

#### Task 3.1: Import Statement Analysis

```javascript
// scripts/import-optimizer.js
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

class ImportOptimizer {
  constructor() {
    this.optimizations = [];
  }

  async optimizeImports(packagePath) {
    const sourceFiles = await this.getAllSourceFiles(packagePath);

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const optimizations = this.analyzeImports(sourceFile);

      if (optimizations.length > 0) {
        const optimizedContent = this.applyOptimizations(
          content,
          optimizations
        );
        fs.writeFileSync(filePath, optimizedContent);

        this.optimizations.push({
          file: filePath,
          optimizations: optimizations.length,
        });
      }
    }

    return this.optimizations;
  }

  analyzeImports(sourceFile) {
    const optimizations = [];

    ts.forEachChild(sourceFile, node => {
      if (ts.isImportDeclaration(node)) {
        const optimization = this.analyzeImportDeclaration(node);
        if (optimization) {
          optimizations.push(optimization);
        }
      }
    });

    return optimizations;
  }

  analyzeImportDeclaration(node) {
    const moduleSpecifier = node.moduleSpecifier.text;

    // Optimize lodash imports
    if (moduleSpecifier === 'lodash') {
      const importClause = node.importClause;
      if (importClause && importClause.namedBindings) {
        const namedBindings = importClause.namedBindings;

        if (ts.isNamedImports(namedBindings)) {
          const imports = namedBindings.elements.map(e => e.name.text);

          return {
            type: 'lodash-optimization',
            original: node.getText(),
            optimized: imports
              .map(imp => `import ${imp} from 'lodash/${imp}';`)
              .join('\n'),
            reduction: this.calculateLodashReduction(imports),
          };
        }
      }
    }

    // Optimize barrel imports
    if (this.isBarrelImport(moduleSpecifier)) {
      return this.optimizeBarrelImport(node, moduleSpecifier);
    }

    // Optimize type-only imports
    if (this.shouldBeTypeOnlyImport(node)) {
      return {
        type: 'type-only',
        original: node.getText(),
        optimized: node.getText().replace('import', 'import type'),
        reduction: 'runtime-elimination',
      };
    }

    return null;
  }

  isBarrelImport(moduleSpecifier) {
    // Check if importing from package root that likely has barrel exports
    const barrelPackages = [
      '@vytches/ddd-core',
      '@vytches/ddd-aggregates',
      '@vytches/ddd-cqrs',
      '@vytches/ddd-events',
    ];

    return barrelPackages.some(pkg => moduleSpecifier.startsWith(pkg));
  }

  optimizeBarrelImport(node, moduleSpecifier) {
    const importClause = node.importClause;

    if (
      importClause &&
      importClause.namedBindings &&
      ts.isNamedImports(importClause.namedBindings)
    ) {
      const imports = importClause.namedBindings.elements.map(e => e.name.text);

      // Map imports to specific modules
      const specificImports = this.mapToSpecificModules(
        imports,
        moduleSpecifier
      );

      return {
        type: 'barrel-optimization',
        original: node.getText(),
        optimized: specificImports.join('\n'),
        reduction: 'tree-shaking-improvement',
      };
    }

    return null;
  }

  mapToSpecificModules(imports, packageName) {
    const moduleMap = {
      AggregateRoot: `${packageName}/aggregates`,
      EntityId: `${packageName}/value-objects`,
      CommandBus: `${packageName}/cqrs`,
      QueryBus: `${packageName}/cqrs`,
      DomainEvent: `${packageName}/events`,
    };

    return imports.map(imp => {
      const specificModule =
        moduleMap[imp] || `${packageName}/${imp.toLowerCase()}`;
      return `import { ${imp} } from '${specificModule}';`;
    });
  }

  calculateLodashReduction(imports) {
    // Lodash full bundle is ~70KB, specific imports are ~2-5KB each
    const fullSize = 70000;
    const specificSize = imports.length * 3000;
    const reduction = fullSize - specificSize;

    return {
      before: `${(fullSize / 1024).toFixed(1)}KB`,
      after: `${(specificSize / 1024).toFixed(1)}KB`,
      saved: `${(reduction / 1024).toFixed(1)}KB`,
    };
  }
}
```

### Phase 4: CI Bundle Monitoring (2 hours)

#### Task 4.1: Bundle Size CI Check

```yaml
# .github/workflows/bundle-size-check.yml
name: Bundle Size Check

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  bundle-size:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm build

      - name: Analyze bundle size
        run: |
          echo "📦 Analyzing bundle sizes..."
          node scripts/bundle-size-check.js > bundle-report.txt
          cat bundle-report.txt

      - name: Check size limits
        run: |
          echo "🔍 Checking bundle size limits..."
          node scripts/bundle-size-limits.js

      - name: Comment PR
        uses: actions/github-script@v6
        if: github.event_name == 'pull_request'
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('bundle-report.txt', 'utf8');

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 📦 Bundle Size Report\n\n\`\`\`\n${report}\n\`\`\``
            });

      - name: Upload bundle analysis
        uses: actions/upload-artifact@v3
        with:
          name: bundle-analysis
          path: |
            bundle-report.txt
            packages/*/dist/**/*.js
```

#### Task 4.2: Bundle Size Monitoring Script

```javascript
// scripts/bundle-size-check.js
const fs = require('fs');
const path = require('path');
const gzipSize = require('gzip-size');

class BundleSizeMonitor {
  constructor() {
    this.limits = {
      '@vytches/ddd-core': 10240, // 10KB
      '@vytches/ddd-utils': 5120, // 5KB
      '@vytches/ddd-aggregates': 81920, // 80KB
      '@vytches/ddd-cqrs': 40960, // 40KB
      '@vytches/ddd-events': 40960, // 40KB
      '@vytches/ddd-policies': 51200, // 50KB
    };

    this.baseline = this.loadBaseline();
  }

  async checkAllPackages() {
    const results = {
      total: 0,
      gzipTotal: 0,
      packages: [],
      violations: [],
      improvements: [],
    };

    for (const [packageName, limit] of Object.entries(this.limits)) {
      const packageDir = packageName.replace('@vytches/ddd-', '');
      const distPath = `packages/${packageDir}/dist`;

      if (!fs.existsSync(distPath)) {
        console.log(`⚠️  No dist folder for ${packageName}`);
        continue;
      }

      const analysis = await this.analyzePackage(packageName, distPath);

      results.total += analysis.size;
      results.gzipTotal += analysis.gzipSize;
      results.packages.push(analysis);

      // Check limits
      if (analysis.size > limit) {
        results.violations.push({
          package: packageName,
          size: analysis.size,
          limit,
          overage: analysis.size - limit,
        });
      }

      // Check improvements from baseline
      const baseline = this.baseline[packageName];
      if (baseline && analysis.size < baseline.size) {
        results.improvements.push({
          package: packageName,
          before: baseline.size,
          after: analysis.size,
          improvement: baseline.size - analysis.size,
        });
      }
    }

    return results;
  }

  async analyzePackage(packageName, distPath) {
    const jsFiles = this.findJSFiles(distPath);
    let totalSize = 0;
    let totalGzipSize = 0;

    for (const file of jsFiles) {
      const content = fs.readFileSync(file);
      totalSize += content.length;
      totalGzipSize += await gzipSize(content);
    }

    return {
      package: packageName,
      size: totalSize,
      gzipSize: totalGzipSize,
      files: jsFiles.length,
      sizeFormatted: this.formatBytes(totalSize),
      gzipFormatted: this.formatBytes(totalGzipSize),
    };
  }

  findJSFiles(dirPath) {
    const files = [];

    const scan = dir => {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (entry.endsWith('.js') && !entry.includes('.map')) {
          files.push(fullPath);
        }
      }
    };

    scan(dirPath);
    return files;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  generateReport(results) {
    let report = '📦 Bundle Size Report\n';
    report += '===================\n\n';

    report += `Total Size: ${this.formatBytes(results.total)}\n`;
    report += `Total Gzipped: ${this.formatBytes(results.gzipTotal)}\n\n`;

    // Package breakdown
    report += 'Package Breakdown:\n';
    results.packages.forEach(pkg => {
      report += `  ${pkg.package}: ${pkg.sizeFormatted} (${pkg.gzipFormatted} gzipped)\n`;
    });

    // Violations
    if (results.violations.length > 0) {
      report += '\n❌ Size Limit Violations:\n';
      results.violations.forEach(v => {
        report += `  ${v.package}: ${this.formatBytes(v.size)} exceeds limit of ${this.formatBytes(v.limit)} by ${this.formatBytes(v.overage)}\n`;
      });
    } else {
      report += '\n✅ All packages within size limits\n';
    }

    // Improvements
    if (results.improvements.length > 0) {
      report += '\n📈 Size Improvements:\n';
      results.improvements.forEach(i => {
        const improvement = (((i.before - i.after) / i.before) * 100).toFixed(
          1
        );
        report += `  ${i.package}: ${this.formatBytes(i.before)} → ${this.formatBytes(i.after)} (${improvement}% smaller)\n`;
      });
    }

    return report;
  }

  loadBaseline() {
    const baselinePath = 'bundle-baseline.json';

    if (fs.existsSync(baselinePath)) {
      return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    }

    return {};
  }

  updateBaseline(results) {
    const baseline = {};

    for (const pkg of results.packages) {
      baseline[pkg.package] = {
        size: pkg.size,
        gzipSize: pkg.gzipSize,
        date: new Date().toISOString(),
      };
    }

    fs.writeFileSync('bundle-baseline.json', JSON.stringify(baseline, null, 2));
  }
}

// Run the check
async function main() {
  const monitor = new BundleSizeMonitor();
  const results = await monitor.checkAllPackages();
  const report = monitor.generateReport(results);

  console.log(report);

  // Update baseline if this is main branch
  if (process.env.GITHUB_REF === 'refs/heads/main') {
    monitor.updateBaseline(results);
  }

  // Exit with error if violations exist
  if (results.violations.length > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
```

### Phase 5: Documentation & Guidelines (2 hours)

#### Task 5.1: Optimization Guide

````markdown
# Bundle Size Optimization Guide

## Overview

This guide documents best practices and techniques for maintaining optimal
bundle sizes in the VytchesDDD library.

## Current Metrics

- **Total Library Size**: 490KB (30% reduction achieved)
- **Tree-shaking Effectiveness**: 90%+
- **Duplicate Dependencies**: 0
- **Dead Code**: <2%

## Optimization Techniques

### 1. Import Optimization

```typescript
// ❌ Bad: Imports entire lodash library
import _ from 'lodash';

// ✅ Good: Import specific functions
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';

// ❌ Bad: Barrel import (imports everything)
import * as Utils from '@vytches/ddd-utils';

// ✅ Good: Specific imports
import { Result, safeRun } from '@vytches/ddd-utils';
```
````

### 2. Dynamic Imports for Code Splitting

```typescript
// ✅ Lazy load heavy features
const loadCQRS = async () => {
  const { CommandBus, QueryBus } = await import('@vytches/ddd-cqrs');
  return { CommandBus, QueryBus };
};

// ✅ Feature-based loading
async function setupApplication(features: string[]) {
  const modules = [];

  if (features.includes('cqrs')) {
    modules.push(await import('@vytches/ddd-cqrs'));
  }

  if (features.includes('events')) {
    modules.push(await import('@vytches/ddd-events'));
  }

  return modules;
}
```

### 3. Tree-shaking Configuration

```json
// package.json
{
  "sideEffects": false,
  "module": "dist/index.esm.js",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js"
    },
    "./aggregates": {
      "import": "./dist/aggregates/index.esm.js",
      "require": "./dist/aggregates/index.cjs.js"
    }
  }
}
```

### 4. Webpack Configuration

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    usedExports: true,
    sideEffects: false,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true,
        },
      },
    },
  },
};
```

## Monitoring and Limits

### Package Size Limits

| Package                   | Limit | Current   |
| ------------------------- | ----- | --------- |
| `@vytches/ddd-core`       | 10KB  | 8.2KB ✅  |
| `@vytches/ddd-aggregates` | 80KB  | 76.1KB ✅ |
| `@vytches/ddd-cqrs`       | 40KB  | 38.7KB ✅ |
| `@vytches/ddd-events`     | 40KB  | 35.9KB ✅ |

### CI/CD Integration

Bundle size is checked on every PR:

```bash
# Check bundle sizes
pnpm bundle:check

# Analyze specific package
pnpm bundle:analyze aggregates

# Update baseline after optimization
pnpm bundle:baseline
```

```

## 📈 Success Metrics

### Bundle Size Targets
- [ ] 490KB total bundle size (30% reduction from 700KB)
- [ ] 90%+ tree-shaking effectiveness
- [ ] 0 duplicate dependencies
- [ ] <2% dead code remaining
- [ ] All packages within size limits

### Performance Metrics
- [ ] <3 second initial load time
- [ ] <500ms for lazy-loaded modules
- [ ] 95%+ gzip compression effectiveness
- [ ] Bundle size monitoring in CI/CD

### Quality Metrics
- [ ] Zero size limit violations in CI
- [ ] Automated optimization suggestions
- [ ] Clear documentation and guidelines
- [ ] Team adoption of best practices

## 🔧 Technical Implementation Details

### Optimization Strategies
1. **Code Splitting**: Feature-based dynamic imports
2. **Tree Shaking**: Aggressive unused code elimination
3. **Dependency Management**: Eliminate duplicates and unnecessary deps
4. **Import Optimization**: Specific imports over barrel imports
5. **Build Configuration**: Advanced webpack/rollup optimization

### Monitoring Infrastructure
1. **CI/CD Integration**: Automated size checks on PRs
2. **Baseline Tracking**: Historical size evolution
3. **Violation Alerts**: Immediate notification of limit breaches
4. **Report Generation**: Detailed analysis reports

## 🚨 Risk Mitigation

### Technical Risks
- **Over-optimization**: Breaking functionality for minimal gains
- **Dynamic imports**: Runtime errors from missing modules
- **Tree-shaking false positives**: Removing needed code

### Mitigations
- **Comprehensive testing**: Full test suite after optimizations
- **Gradual rollout**: Incremental optimization and monitoring
- **Rollback procedures**: Quick revert capabilities

## 📚 References

- [Webpack Tree Shaking](https://webpack.js.org/guides/tree-shaking/)
- [Rollup Tree Shaking](https://rollupjs.org/guide/en/#tree-shaking)
- [Bundle Analysis Tools](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [JavaScript Bundle Optimization](https://web.dev/reduce-javascript-payloads-with-code-splitting/)

## ✅ Definition of Done

- [ ] 490KB bundle size target achieved
- [ ] 90%+ tree-shaking effectiveness
- [ ] Zero duplicate dependencies
- [ ] All packages within size limits
- [ ] CI/CD monitoring active
- [ ] Documentation complete
- [ ] Team training conducted
```
