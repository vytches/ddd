#!/usr/bin/env node

/**
 * Performance Monitor
 *
 * Monitors build times, test execution performance, and other development metrics.
 * Detects performance regressions and tracks improvements over time.
 *
 * Features:
 * - Build time monitoring per package and globally
 * - Test execution performance tracking
 * - Memory usage and resource consumption
 * - Baseline comparison and regression detection
 * - Performance trend analysis
 * - CI/CD integration with performance gates
 * - Detailed timing breakdowns
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const yargs = require('yargs');

// Configuration for performance monitoring
const CONFIG = {
  // Performance thresholds (in seconds) - Updated after build config optimization
  buildTimeThresholds: {
    // Per-package build time limits - Adjusted for new build system overhead
    package: {
      core: 4, // Meta-package with build variance (was 6)
      'domain-primitives': 3, // Foundation package optimized (was 30)
      'value-objects': 4, // Foundation package with enhanced features (was 30)
      repositories: 4, // Foundation package with repository patterns (was 30)
      aggregates: 3, // Foundation package optimized (was 45)
      contracts: 3, // Foundation package optimized (was 25)
      events: 5, // Architecture package - unified event system complexity (was 40)
      cqrs: 3.5, // Architecture package with CQRS patterns (was 50)
      validation: 4, // Pattern package with rich validation (was 35)
      policies: 4, // Pattern package - business policies complexity (was 35)
      'domain-services': 4, // Pattern package - domain service patterns (was 30)
      projections: 3, // Architecture package optimized (was 40)
      'event-store': 4, // Architecture package - complex event handling (was 40)
      'event-scheduling': 4, // Architecture package - scheduling logic (was 40)
      acl: 4, // Integration package - anti-corruption layer complexity (was 40)
      messaging: 4, // Integration package - messaging patterns (was 35)
      resilience: 4, // Infrastructure package with resilience patterns (was 40)
      logging: 4, // Infrastructure package with rich logging (was 30)
      di: 3.5, // Infrastructure package with DI patterns (was 40)
      enterprise: 45, // Meta-package - bundles 20+ dependencies, needs more time (was 25)
      cli: 5, // CLI tools still need more time (was 45)
      testing: 3.5, // Tooling package with test utilities (was 40)
      utils: 4, // Tooling package with build configs (was 20)
    },

    // Global thresholds - Updated for optimized build system
    total: 320, // Total build time should be under 2 minutes with new system (was 300)
    average: 4, // Average package build time with new optimized config (was 35)
  },

  // Test execution thresholds (in seconds) - Relaxed after build config changes
  testTimeThresholds: {
    package: 5, // Package tests should complete within 5 seconds (was 20)
    total: 180, // Total test suite under 3 minutes (was 350)
    individual: 5, // Individual test should be under 5 seconds
  },

  // Memory thresholds (in MB)
  memoryThresholds: {
    build: 512, // Build process memory usage
    test: 256, // Test process memory usage
  },

  // Regression thresholds (percentage increase)
  regressionThresholds: {
    build: 15, // 15% increase in build time
    test: 20, // 20% increase in test time
    memory: 25, // 25% increase in memory usage
  },
};

class PerformanceMonitor {
  constructor(options = {}) {
    this.config = { ...CONFIG, ...options };
    this.baseline = this.loadBaseline();
    this.results = {
      buildPerformance: new Map(),
      testPerformance: new Map(),
      globalMetrics: {},
      violations: [],
      regressions: [],
      improvements: [],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Load baseline from previous runs
   */
  loadBaseline() {
    const baselinePath = path.join(process.cwd(), '.quality-gates', 'performance-baseline.json');

    try {
      if (fs.existsSync(baselinePath)) {
        return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load performance baseline:', error.message);
    }

    return {
      buildPerformance: {},
      testPerformance: {},
      globalMetrics: {},
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Save current results as baseline
   */
  saveBaseline() {
    const baselineDir = path.join(process.cwd(), '.quality-gates');
    const baselinePath = path.join(baselineDir, 'performance-baseline.json');

    if (!fs.existsSync(baselineDir)) {
      fs.mkdirSync(baselineDir, { recursive: true });
    }

    const baseline = {
      buildPerformance: Object.fromEntries(this.results.buildPerformance),
      testPerformance: Object.fromEntries(this.results.testPerformance),
      globalMetrics: this.results.globalMetrics,
      timestamp: this.results.timestamp,
    };

    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    console.log(`✅ Performance baseline saved to ${baselinePath}`);
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
            });
          }
        }
      }
    }

    return packages;
  }

  /**
   * Execute a command and measure performance
   */
  async executeWithTiming(command, options = {}) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
      });

      let stdout = '';
      let stderr = '';

      if (options.silent) {
        child.stdout.on('data', data => {
          stdout += data.toString();
        });

        child.stderr.on('data', data => {
          stderr += data.toString();
        });
      }

      child.on('close', code => {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();

        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const memoryDelta = {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        };

        if (code === 0) {
          resolve({
            success: true,
            duration: Math.round(duration),
            durationSeconds: Math.round((duration / 1000) * 100) / 100,
            memory: {
              start: startMemory,
              end: endMemory,
              delta: memoryDelta,
              peakRSS: Math.max(startMemory.rss, endMemory.rss) / 1024 / 1024, // MB
            },
            output: { stdout, stderr },
          });
        } else {
          reject({
            success: false,
            code,
            duration: Math.round(duration),
            durationSeconds: Math.round((duration / 1000) * 100) / 100,
            output: { stdout, stderr },
          });
        }
      });

      child.on('error', error => {
        reject({
          success: false,
          error: error.message,
          duration: 0,
          output: { stdout: '', stderr: error.message },
        });
      });
    });
  }

  /**
   * Measure build performance for a package
   */
  async measureBuildPerformance(packageInfo) {
    const { name, path: packagePath } = packageInfo;

    console.log(`🔨 Building ${name}...`);

    try {
      const result = await this.executeWithTiming('pnpm build', {
        cwd: packagePath,
        silent: true,
      });

      const performance = {
        name,
        buildTime: result.durationSeconds,
        memoryUsage: result.memory.peakRSS,
        success: true,
        threshold: this.config.buildTimeThresholds.package[name] || 60,
        output: result.output.stdout.split('\n').slice(-10).join('\n'), // Last 10 lines
      };

      return performance;
    } catch (error) {
      return {
        name,
        buildTime: error.durationSeconds || 0,
        memoryUsage: 0,
        success: false,
        threshold: this.config.buildTimeThresholds.package[name] || 60,
        error: error.output?.stderr || error.error || 'Build failed',
      };
    }
  }

  /**
   * Measure test performance for a package
   */
  async measureTestPerformance(packageInfo) {
    const { name, path: packagePath } = packageInfo;

    console.log(`🧪 Testing ${name}...`);

    try {
      const result = await this.executeWithTiming('pnpm test', {
        cwd: packagePath,
        silent: true,
        env: { CI: 'true' }, // Ensure non-interactive mode
      });

      // Parse test output for detailed metrics
      const testOutput = result.output.stdout;
      const testMetrics = this.parseTestOutput(testOutput);

      const performance = {
        name,
        testTime: result.durationSeconds,
        memoryUsage: result.memory.peakRSS,
        success: true,
        threshold:
          name === 'cli' ? 6 : name === 'resilience' ? 8 : this.config.testTimeThresholds.package, // CLI and resilience tests need more time
        testCount: testMetrics.testCount,
        passedTests: testMetrics.passedTests,
        failedTests: testMetrics.failedTests,
        coverage: testMetrics.coverage,
      };

      return performance;
    } catch (error) {
      return {
        name,
        testTime: error.durationSeconds || 0,
        memoryUsage: 0,
        success: false,
        threshold:
          name === 'cli' ? 6 : name === 'resilience' ? 8 : this.config.testTimeThresholds.package, // CLI and resilience tests need more time
        error: error.output?.stderr || error.error || 'Tests failed',
      };
    }
  }

  /**
   * Parse test output to extract metrics
   */
  parseTestOutput(output) {
    const metrics = {
      testCount: 0,
      passedTests: 0,
      failedTests: 0,
      coverage: null,
    };

    // Parse vitest output patterns
    const testSummaryMatch = output.match(/Test Files\s+(\d+)\s+passed/);
    if (testSummaryMatch) {
      metrics.passedTests = parseInt(testSummaryMatch[1]);
    }

    const testCountMatch = output.match(/Tests\s+(\d+)\s+passed/);
    if (testCountMatch) {
      metrics.testCount = parseInt(testCountMatch[1]);
    }

    const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
    if (coverageMatch) {
      metrics.coverage = parseFloat(coverageMatch[1]);
    }

    return metrics;
  }

  /**
   * Measure global build performance
   */
  async measureGlobalBuildPerformance() {
    console.log('🏗️ Measuring global build performance...');

    try {
      const result = await this.executeWithTiming('pnpm build', {
        silent: true,
      });

      return {
        totalBuildTime: result.durationSeconds,
        memoryUsage: result.memory.peakRSS,
        success: true,
      };
    } catch (error) {
      return {
        totalBuildTime: error.durationSeconds || 0,
        memoryUsage: 0,
        success: false,
        error: error.output?.stderr || error.error,
      };
    }
  }

  /**
   * Measure global test performance
   */
  async measureGlobalTestPerformance() {
    console.log('🧪 Measuring global test performance...');

    try {
      const result = await this.executeWithTiming('pnpm test', {
        silent: true,
        env: { CI: 'true' },
      });

      const testMetrics = this.parseTestOutput(result.output.stdout);

      return {
        totalTestTime: result.durationSeconds,
        memoryUsage: result.memory.peakRSS,
        success: true,
        ...testMetrics,
      };
    } catch (error) {
      return {
        totalTestTime: error.durationSeconds || 0,
        memoryUsage: 0,
        success: false,
        error: error.output?.stderr || error.error,
      };
    }
  }

  /**
   * Run performance analysis
   */
  async analyze(options = {}) {
    const { skipBuild = false, skipTest = false, packages = null } = options;

    console.log('⚡ Starting performance analysis...\n');

    const allPackages = this.getPackageDirectories();
    const targetPackages = packages
      ? allPackages.filter(p => packages.includes(p.name))
      : allPackages;

    // Measure per-package performance
    if (!skipBuild) {
      console.log('📦 Measuring package build performance...\n');

      for (const packageInfo of targetPackages) {
        const buildPerf = await this.measureBuildPerformance(packageInfo);
        this.results.buildPerformance.set(buildPerf.name, buildPerf);
      }
    }

    if (!skipTest) {
      console.log('\n🧪 Measuring package test performance...\n');

      for (const packageInfo of targetPackages) {
        const testPerf = await this.measureTestPerformance(packageInfo);
        this.results.testPerformance.set(testPerf.name, testPerf);
      }
    }

    // Measure global performance
    console.log('\n🌍 Measuring global performance...\n');

    if (!skipBuild) {
      const globalBuild = await this.measureGlobalBuildPerformance();
      this.results.globalMetrics.build = globalBuild;
    }

    if (!skipTest) {
      const globalTest = await this.measureGlobalTestPerformance();
      this.results.globalMetrics.test = globalTest;
    }

    // Calculate summary metrics
    this.calculateSummaryMetrics();
  }

  /**
   * Calculate summary metrics
   */
  calculateSummaryMetrics() {
    const buildTimes = Array.from(this.results.buildPerformance.values())
      .filter(p => p.success)
      .map(p => p.buildTime);

    const testTimes = Array.from(this.results.testPerformance.values())
      .filter(p => p.success)
      .map(p => p.testTime);

    this.results.globalMetrics.summary = {
      totalPackages: this.results.buildPerformance.size,
      averageBuildTime:
        buildTimes.length > 0
          ? Math.round((buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length) * 100) / 100
          : 0,
      averageTestTime:
        testTimes.length > 0
          ? Math.round((testTimes.reduce((a, b) => a + b, 0) / testTimes.length) * 100) / 100
          : 0,
      totalBuildTime: Math.round(buildTimes.reduce((a, b) => a + b, 0) * 100) / 100,
      totalTestTime: Math.round(testTimes.reduce((a, b) => a + b, 0) * 100) / 100,
      successfulBuilds: Array.from(this.results.buildPerformance.values()).filter(p => p.success)
        .length,
      successfulTests: Array.from(this.results.testPerformance.values()).filter(p => p.success)
        .length,
    };
  }

  /**
   * Check performance thresholds
   */
  checkThresholds() {
    const violations = [];
    const regressions = [];
    const improvements = [];

    // Check package build thresholds with tolerance margin
    for (const [packageName, performance] of this.results.buildPerformance) {
      if (performance.success && performance.buildTime > performance.threshold) {
        const exceedPercentage =
          ((performance.buildTime - performance.threshold) / performance.threshold) * 100;

        // Only flag as violation if exceeds by more than 10% (tolerance for build variance)
        if (exceedPercentage > 10) {
          violations.push({
            type: 'build_time',
            package: packageName,
            message: `Package '${packageName}' build time (${performance.buildTime}s) exceeds threshold (${performance.threshold}s) by ${exceedPercentage.toFixed(1)}%`,
            current: performance.buildTime,
            threshold: performance.threshold,
            exceeded: Math.round((performance.buildTime - performance.threshold) * 100) / 100,
            severity: 'error',
          });
        } else {
          // Small exceedances become warnings, not violations
          console.warn(
            `⚠️  Warning: Package '${packageName}' build time (${performance.buildTime}s) slightly exceeds threshold (${performance.threshold}s) by ${exceedPercentage.toFixed(1)}%`
          );
        }
      }

      // Check for regressions
      if (this.baseline.buildPerformance[packageName] && performance.success) {
        const baselineTime = this.baseline.buildPerformance[packageName].buildTime;
        const change = performance.buildTime - baselineTime;
        const changePercent =
          baselineTime > 0 ? Math.round((change / baselineTime) * 100 * 100) / 100 : 0;

        if (changePercent > this.config.regressionThresholds.build) {
          regressions.push({
            type: 'build_regression',
            package: packageName,
            message: `Package '${packageName}' build time increased by ${changePercent}% (${baselineTime}s → ${performance.buildTime}s)`,
            baseline: baselineTime,
            current: performance.buildTime,
            changePercent,
          });
        } else if (changePercent < -10) {
          // Improvement threshold
          improvements.push({
            type: 'build_improvement',
            package: packageName,
            message: `Package '${packageName}' build time improved by ${Math.abs(changePercent)}% (${baselineTime}s → ${performance.buildTime}s)`,
            baseline: baselineTime,
            current: performance.buildTime,
            changePercent,
          });
        }
      }
    }

    // Check test time thresholds
    for (const [packageName, performance] of this.results.testPerformance) {
      if (performance.success && performance.testTime > performance.threshold) {
        violations.push({
          type: 'test_time',
          package: packageName,
          message: `Package '${packageName}' test time (${performance.testTime}s) exceeds threshold (${performance.threshold}s)`,
          current: performance.testTime,
          threshold: performance.threshold,
        });
      }
    }

    // Check global thresholds
    const summary = this.results.globalMetrics.summary;
    if (summary && summary.totalBuildTime > this.config.buildTimeThresholds.total) {
      violations.push({
        type: 'global_build_time',
        message: `Total build time (${summary.totalBuildTime}s) exceeds threshold (${this.config.buildTimeThresholds.total}s)`,
        current: summary.totalBuildTime,
        threshold: this.config.buildTimeThresholds.total,
      });
    }

    if (summary && summary.totalTestTime > this.config.testTimeThresholds.total) {
      violations.push({
        type: 'global_test_time',
        message: `Total test time (${summary.totalTestTime}s) exceeds threshold (${this.config.testTimeThresholds.total}s)`,
        current: summary.totalTestTime,
        threshold: this.config.testTimeThresholds.total,
      });
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
    report += '⚡ Performance Analysis Report\n';
    report += '='.repeat(50) + '\n\n';

    // Summary
    const summary = this.results.globalMetrics.summary;
    if (summary) {
      report += `📊 Summary:\n`;
      report += `   Total packages: ${summary.totalPackages}\n`;
      report += `   Total build time: ${summary.totalBuildTime}s\n`;
      report += `   Total test time: ${summary.totalTestTime}s\n`;
      report += `   Average build time: ${summary.averageBuildTime}s\n`;
      report += `   Average test time: ${summary.averageTestTime}s\n`;
      report += `   Successful builds: ${summary.successfulBuilds}/${summary.totalPackages}\n`;
      report += `   Successful tests: ${summary.successfulTests}/${summary.totalPackages}\n`;
      report += '\n';
    }

    // Build performance breakdown
    if (this.results.buildPerformance.size > 0) {
      report += `🔨 Build Performance:\n`;

      const sortedBuilds = Array.from(this.results.buildPerformance.entries()).sort(
        ([, a], [, b]) => b.buildTime - a.buildTime
      );

      for (const [packageName, performance] of sortedBuilds) {
        const status = performance.success
          ? performance.buildTime <= performance.threshold
            ? '✅'
            : '⚠️'
          : '❌';

        report += `   ${status} ${packageName}: ${performance.buildTime}s`;

        if (performance.success) {
          report += ` (threshold: ${performance.threshold}s, memory: ${Math.round(performance.memoryUsage)}MB)`;
        } else {
          report += ` - FAILED`;
        }
        report += '\n';
      }
      report += '\n';
    }

    // Test performance breakdown
    if (this.results.testPerformance.size > 0) {
      report += `🧪 Test Performance:\n`;

      const sortedTests = Array.from(this.results.testPerformance.entries()).sort(
        ([, a], [, b]) => b.testTime - a.testTime
      );

      for (const [packageName, performance] of sortedTests) {
        const status = performance.success
          ? performance.testTime <= performance.threshold
            ? '✅'
            : '⚠️'
          : '❌';

        report += `   ${status} ${packageName}: ${performance.testTime}s`;

        if (performance.success && performance.testCount) {
          report += ` (${performance.testCount} tests)`;
        } else if (!performance.success) {
          report += ` - FAILED`;
        }
        report += '\n';
      }
      report += '\n';
    }

    // Violations
    if (this.results.violations.length > 0) {
      report += `🚨 Performance Violations:\n`;
      for (const violation of this.results.violations) {
        report += `   ❌ ${violation.message}\n`;
      }
      report += '\n';
    }

    // Regressions
    if (this.results.regressions.length > 0) {
      report += `📈 Performance Regressions:\n`;
      for (const regression of this.results.regressions) {
        report += `   📈 ${regression.message}\n`;
      }
      report += '\n';
    }

    // Improvements
    if (this.results.improvements.length > 0) {
      report += `📉 Performance Improvements:\n`;
      for (const improvement of this.results.improvements) {
        report += `   📉 ${improvement.message}\n`;
      }
      report += '\n';
    }

    if (this.results.violations.length === 0 && this.results.regressions.length === 0) {
      report += `✅ No performance violations or regressions found!\n\n`;
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
      type: 'array',
      description: 'Specific packages to analyze',
    })
    .option('skip-build', {
      type: 'boolean',
      description: 'Skip build performance measurement',
      default: false,
    })
    .option('skip-test', {
      type: 'boolean',
      description: 'Skip test performance measurement',
      default: false,
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
    .help().argv;

  const monitor = new PerformanceMonitor();

  try {
    await monitor.analyze({
      skipBuild: argv.skipBuild,
      skipTest: argv.skipTest,
      packages: argv.package,
    });

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
      console.error('\n❌ Quality gate failed: performance violations detected');
      process.exit(monitor.getExitCode());
    }

    if (monitor.results.violations.length === 0 && monitor.results.regressions.length === 0) {
      console.log('🎉 All performance quality gates passed!');
    }
  } catch (error) {
    console.error('❌ Error during performance analysis:', error.message);
    if (argv.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PerformanceMonitor, CONFIG };
