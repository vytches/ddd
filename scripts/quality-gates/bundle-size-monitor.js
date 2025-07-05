#!/usr/bin/env node

/**
 * Bundle Size Monitor
 *
 * Monitors and protects against bundle size regression with configurable thresholds.
 * Tracks package sizes and prevents accidental bloat in production builds.
 *
 * Features:
 * - Package size monitoring with size limits
 * - Baseline comparison and regression detection
 * - Tree-shaking effectiveness analysis
 * - Bundle composition analysis
 * - CI/CD integration with quality gates
 * - Historical tracking and trends
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yargs = require('yargs');

// Configuration for bundle size monitoring
const CONFIG = {
  // Size limits in KB (based on IMPROVE.md targets)
  sizeThresholds: {
    // Foundation packages (should be lightweight)
    core: 5, // Meta-package: Target <5KB
    'domain-primitives': 50, // Foundation: <50KB
    'value-objects': 50,
    repositories: 50,
    aggregates: 90, // Slightly larger due to capabilities
    utils: 50,
    contracts: 90,
    logging: 50,

    // Pattern packages (medium size)
    validation: 100,
    policies: 80,
    'domain-services': 50,

    // Architecture packages (can be larger)
    events: 70,
    cqrs: 100, // Complex architecture patterns
    projections: 100,

    // Integration packages
    acl: 90,
    messaging: 80,

    // Infrastructure packages
    resilience: 80,
    enterprise: 50, // Should be lightweight coordination

    // Tooling packages (more flexible)
    cli: 80,
    testing: 100, // Test utilities can be larger
  },

  // Global thresholds
  globalLimits: {
    totalSourceSize: 2000, // Total source KB across all packages
    averagePackageSize: 80, // Average package size
    maxPackageSize: 100, // No single package should exceed this
  },

  // Regression thresholds (percentage increase)
  regressionThresholds: {
    package: 10, // 10% increase per package
    global: 5, // 5% total increase
  },

  // Files to include in size calculation
  includePatterns: [
    'dist/**/*.js',
    'dist/**/*.mjs',
    'dist/**/*.cjs',
    'src/**/*.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/*.d.ts',
  ],

  // Directories to exclude
  excludePatterns: [
    '**/node_modules/**',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/coverage/**',
  ],
};

class BundleSizeMonitor {
  constructor(options = {}) {
    this.config = { ...CONFIG, ...options };
    this.baseline = this.loadBaseline();
    this.results = {
      packages: new Map(),
      totalSourceSize: 0,
      totalBuiltSize: 0,
      violations: [],
      regressions: [],
      improvements: [],
      summary: {},
    };
  }

  /**
   * Load baseline from previous runs
   */
  loadBaseline() {
    const baselinePath = path.join(process.cwd(), '.quality-gates', 'bundle-size-baseline.json');

    try {
      if (fs.existsSync(baselinePath)) {
        return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load baseline:', error.message);
    }

    return {
      packages: {},
      totalSourceSize: 0,
      totalBuiltSize: 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Save current results as baseline
   */
  saveBaseline() {
    const baselineDir = path.join(process.cwd(), '.quality-gates');
    const baselinePath = path.join(baselineDir, 'bundle-size-baseline.json');

    if (!fs.existsSync(baselineDir)) {
      fs.mkdirSync(baselineDir, { recursive: true });
    }

    const baseline = {
      packages: Object.fromEntries(this.results.packages),
      totalSourceSize: this.results.totalSourceSize,
      totalBuiltSize: this.results.totalBuiltSize,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    console.log(`✅ Baseline saved to ${baselinePath}`);
  }

  /**
   * Get all package directories
   */
  getPackageDirectories() {
    const packagesDir = path.join(process.cwd(), 'packages');
    const packages = [];

    if (fs.existsSync(packagesDir)) {
      const entries = fs.readdirSync(packagesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const packagePath = path.join(packagesDir, entry.name);
          const packageJsonPath = path.join(packagePath, 'package.json');

          if (fs.existsSync(packageJsonPath)) {
            packages.push({
              name: entry.name,
              path: packagePath,
              packageJson: JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')),
            });
          }
        }
      }
    }

    return packages;
  }

  /**
   * Calculate directory size
   */
  calculateDirectorySize(dirPath, patterns = []) {
    if (!fs.existsSync(dirPath)) {
      return { totalSize: 0, files: [] };
    }

    let totalSize = 0;
    const files = [];

    const walkDir = currentPath => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(dirPath, fullPath);

        if (entry.isDirectory()) {
          if (!this.shouldExcludeDirectory(relativePath)) {
            walkDir(fullPath);
          }
        } else if (entry.isFile() && this.shouldIncludeFile(relativePath, patterns)) {
          const stats = fs.statSync(fullPath);
          totalSize += stats.size;
          files.push({
            path: relativePath,
            size: stats.size,
          });
        }
      }
    };

    walkDir(dirPath);

    return {
      totalSize,
      files,
      sizeKB: Math.round((totalSize / 1024) * 100) / 100,
    };
  }

  /**
   * Check if directory should be excluded
   */
  shouldExcludeDirectory(relativePath) {
    return this.config.excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(relativePath);
    });
  }

  /**
   * Check if file should be included
   */
  shouldIncludeFile(relativePath, patterns = []) {
    const allPatterns = patterns.length > 0 ? patterns : this.config.includePatterns;

    return allPatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(relativePath);
    });
  }

  /**
   * Analyze a single package
   */
  analyzePackage(packageInfo) {
    const { name, path: packagePath, packageJson } = packageInfo;

    // Calculate source size
    const sourceSize = this.calculateDirectorySize(path.join(packagePath, 'src'), [
      '**/*.ts',
      '!**/*.test.ts',
      '!**/*.spec.ts',
    ]);

    // Calculate built size
    const builtSize = this.calculateDirectorySize(path.join(packagePath, 'dist'), [
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
    ]);

    // Calculate tree-shaking effectiveness
    const treeshakingRatio =
      builtSize.sizeKB > 0 && sourceSize.sizeKB > 0
        ? Math.round((1 - builtSize.sizeKB / sourceSize.sizeKB) * 100)
        : 0;

    const result = {
      name,
      sourceSize: sourceSize.sizeKB,
      builtSize: builtSize.sizeKB,
      treeshakingRatio,
      sourceFiles: sourceSize.files.length,
      builtFiles: builtSize.files.length,
      packageJson: {
        version: packageJson.version,
        dependencies: Object.keys(packageJson.dependencies || {}).length,
        devDependencies: Object.keys(packageJson.devDependencies || {}).length,
      },
      threshold: this.config.sizeThresholds[name] || 100,
      largestFiles: [...sourceSize.files, ...builtSize.files]
        .sort((a, b) => b.size - a.size)
        .slice(0, 5)
        .map(f => ({
          ...f,
          sizeKB: Math.round((f.size / 1024) * 100) / 100,
        })),
    };

    return result;
  }

  /**
   * Run the analysis
   */
  async analyze() {
    console.log('📊 Analyzing bundle sizes...\n');

    const packages = this.getPackageDirectories();
    console.log(`Found ${packages.length} packages to analyze\n`);

    for (const packageInfo of packages) {
      const result = this.analyzePackage(packageInfo);
      this.results.packages.set(result.name, result);

      this.results.totalSourceSize += result.sourceSize;
      this.results.totalBuiltSize += result.builtSize;
    }

    // Calculate summary statistics
    this.results.summary = {
      packageCount: this.results.packages.size,
      averageSourceSize:
        Math.round((this.results.totalSourceSize / this.results.packages.size) * 100) / 100,
      averageBuiltSize:
        Math.round((this.results.totalBuiltSize / this.results.packages.size) * 100) / 100,
      totalTreeshakingRatio:
        this.results.totalBuiltSize > 0 && this.results.totalSourceSize > 0
          ? Math.round((1 - this.results.totalBuiltSize / this.results.totalSourceSize) * 100)
          : 0,
    };
  }

  /**
   * Check thresholds and generate violations
   */
  checkThresholds() {
    const violations = [];
    const regressions = [];
    const improvements = [];

    // Check package size thresholds
    for (const [packageName, result] of this.results.packages) {
      // Check source size threshold
      if (result.sourceSize > result.threshold) {
        violations.push({
          type: 'package_size',
          package: packageName,
          message: `Package '${packageName}' source size (${result.sourceSize}KB) exceeds threshold (${result.threshold}KB)`,
          current: result.sourceSize,
          threshold: result.threshold,
          exceeded: Math.round((result.sourceSize - result.threshold) * 100) / 100,
        });
      }

      // Check against baseline for regression
      if (this.baseline.packages[packageName]) {
        const baselineSize = this.baseline.packages[packageName].sourceSize;
        const change = result.sourceSize - baselineSize;
        const changePercent =
          baselineSize > 0 ? Math.round((change / baselineSize) * 100 * 100) / 100 : 0;

        if (changePercent > this.config.regressionThresholds.package) {
          regressions.push({
            type: 'package_regression',
            package: packageName,
            message: `Package '${packageName}' size increased by ${changePercent}% (${baselineSize}KB → ${result.sourceSize}KB)`,
            baseline: baselineSize,
            current: result.sourceSize,
            change: Math.round(change * 100) / 100,
            changePercent,
          });
        } else if (changePercent < -5) {
          // Improvement threshold
          improvements.push({
            type: 'package_improvement',
            package: packageName,
            message: `Package '${packageName}' size decreased by ${Math.abs(changePercent)}% (${baselineSize}KB → ${result.sourceSize}KB)`,
            baseline: baselineSize,
            current: result.sourceSize,
            change: Math.round(change * 100) / 100,
            changePercent,
          });
        }
      }
    }

    // Check global thresholds
    if (this.results.totalSourceSize > this.config.globalLimits.totalSourceSize) {
      violations.push({
        type: 'global_size',
        message: `Total source size (${this.results.totalSourceSize}KB) exceeds global limit (${this.config.globalLimits.totalSourceSize}KB)`,
        current: this.results.totalSourceSize,
        threshold: this.config.globalLimits.totalSourceSize,
        exceeded:
          Math.round(
            (this.results.totalSourceSize - this.config.globalLimits.totalSourceSize) * 100
          ) / 100,
      });
    }

    // Check average package size
    if (this.results.summary.averageSourceSize > this.config.globalLimits.averagePackageSize) {
      violations.push({
        type: 'average_size',
        message: `Average package size (${this.results.summary.averageSourceSize}KB) exceeds limit (${this.config.globalLimits.averagePackageSize}KB)`,
        current: this.results.summary.averageSourceSize,
        threshold: this.config.globalLimits.averagePackageSize,
      });
    }

    // Check for any package exceeding max size
    for (const [packageName, result] of this.results.packages) {
      if (result.sourceSize > this.config.globalLimits.maxPackageSize) {
        violations.push({
          type: 'max_package_size',
          package: packageName,
          message: `Package '${packageName}' exceeds maximum size limit (${result.sourceSize}KB > ${this.config.globalLimits.maxPackageSize}KB)`,
          current: result.sourceSize,
          threshold: this.config.globalLimits.maxPackageSize,
        });
      }
    }

    // Check global regression
    if (this.baseline.totalSourceSize > 0) {
      const totalChange = this.results.totalSourceSize - this.baseline.totalSourceSize;
      const totalChangePercent =
        Math.round((totalChange / this.baseline.totalSourceSize) * 100 * 100) / 100;

      if (totalChangePercent > this.config.regressionThresholds.global) {
        regressions.push({
          type: 'global_regression',
          message: `Total bundle size increased by ${totalChangePercent}% (${this.baseline.totalSourceSize}KB → ${this.results.totalSourceSize}KB)`,
          baseline: this.baseline.totalSourceSize,
          current: this.results.totalSourceSize,
          change: Math.round(totalChange * 100) / 100,
          changePercent: totalChangePercent,
        });
      }
    }

    this.results.violations = violations;
    this.results.regressions = regressions;
    this.results.improvements = improvements;

    return { violations, regressions, improvements };
  }

  /**
   * Generate detailed report
   */
  generateReport(options = {}) {
    const { verbose = false, format = 'console' } = options;

    if (format === 'json') {
      return JSON.stringify(this.results, null, 2);
    }

    let report = '';

    // Header
    report += '📦 Bundle Size Analysis Report\n';
    report += '='.repeat(50) + '\n\n';

    // Summary
    report += `📊 Summary:\n`;
    report += `   Total packages: ${this.results.summary.packageCount}\n`;
    report += `   Total source size: ${this.results.totalSourceSize}KB\n`;
    report += `   Total built size: ${this.results.totalBuiltSize}KB\n`;
    report += `   Average package size: ${this.results.summary.averageSourceSize}KB\n`;
    report += `   Tree-shaking effectiveness: ${this.results.summary.totalTreeshakingRatio}%\n`;

    if (this.baseline.timestamp) {
      const baselineDate = new Date(this.baseline.timestamp).toLocaleDateString();
      report += `   Baseline date: ${baselineDate}\n`;
    }
    report += '\n';

    // Package breakdown
    if (this.results.packages.size > 0) {
      report += `📦 Package Breakdown:\n`;

      // Sort packages by size
      const sortedPackages = Array.from(this.results.packages.entries()).sort(
        ([, a], [, b]) => b.sourceSize - a.sourceSize
      );

      for (const [packageName, result] of sortedPackages) {
        const status = result.sourceSize <= result.threshold ? '✅' : '❌';
        const treeshaking =
          result.treeshakingRatio > 0 ? ` (${result.treeshakingRatio}% tree-shaking)` : '';

        report += `   ${status} ${packageName}: ${result.sourceSize}KB → ${result.builtSize}KB${treeshaking}\n`;

        if (verbose) {
          report += `      - Threshold: ${result.threshold}KB\n`;
          report += `      - Source files: ${result.sourceFiles}\n`;
          report += `      - Built files: ${result.builtFiles}\n`;

          if (result.largestFiles.length > 0) {
            report += `      - Largest files:\n`;
            for (const file of result.largestFiles.slice(0, 3)) {
              report += `        • ${file.path}: ${file.sizeKB}KB\n`;
            }
          }
        }
      }
      report += '\n';
    }

    // Violations
    if (this.results.violations.length > 0) {
      report += `🚨 Violations:\n`;
      for (const violation of this.results.violations) {
        report += `   ❌ ${violation.message}\n`;
      }
      report += '\n';
    }

    // Regressions
    if (this.results.regressions.length > 0) {
      report += `📈 Regressions:\n`;
      for (const regression of this.results.regressions) {
        report += `   📈 ${regression.message}\n`;
      }
      report += '\n';
    }

    // Improvements
    if (this.results.improvements.length > 0) {
      report += `📉 Improvements:\n`;
      for (const improvement of this.results.improvements) {
        report += `   📉 ${improvement.message}\n`;
      }
      report += '\n';
    }

    if (this.results.violations.length === 0 && this.results.regressions.length === 0) {
      report += `✅ No size violations or regressions found!\n\n`;
    }

    return report;
  }

  /**
   * Get exit code based on results
   */
  getExitCode() {
    return this.results.violations.length > 0 || this.results.regressions.length > 0 ? 1 : 0;
  }
}

// CLI interface
async function main() {
  const argv = yargs
    .option('package', {
      type: 'string',
      description: 'Specific package to analyze',
    })
    .option('baseline', {
      type: 'boolean',
      description: 'Save current results as baseline',
      default: false,
    })
    .option('verbose', {
      type: 'boolean',
      description: 'Show detailed breakdown',
      default: false,
    })
    .option('format', {
      type: 'string',
      choices: ['console', 'json'],
      description: 'Output format',
      default: 'console',
    })
    .option('ci', {
      type: 'boolean',
      description: 'CI mode - exit with error code on violations',
      default: false,
    })
    .option('threshold', {
      type: 'number',
      description: 'Override global size threshold (KB)',
    })
    .help().argv;

  const options = {};
  if (argv.threshold) {
    options.globalLimits = { ...CONFIG.globalLimits, maxPackageSize: argv.threshold };
  }

  const monitor = new BundleSizeMonitor(options);

  try {
    await monitor.analyze();
    monitor.checkThresholds();

    const report = monitor.generateReport({
      verbose: argv.verbose,
      format: argv.format,
    });

    console.log(report);

    if (argv.baseline) {
      monitor.saveBaseline();
    }

    if (argv.ci && monitor.getExitCode() !== 0) {
      console.error('\n❌ Quality gate failed: bundle size violations detected');
      process.exit(monitor.getExitCode());
    }

    if (monitor.results.violations.length === 0 && monitor.results.regressions.length === 0) {
      console.log('🎉 All bundle size quality gates passed!');
    }
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    if (argv.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { BundleSizeMonitor, CONFIG };
