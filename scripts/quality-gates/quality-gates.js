#!/usr/bin/env node

/**
 * Quality Gates Orchestrator
 *
 * Main script that coordinates all quality gate checks for the VytchesDDD project.
 * Integrates TypeScript any monitoring, bundle size protection, and performance monitoring.
 *
 * Features:
 * - Centralized quality gate execution
 * - Parallel execution for performance
 * - Comprehensive reporting
 * - CI/CD integration
 * - Baseline management
 * - Quality trends tracking
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yargs = require('yargs');

// Import quality gate monitors
const { AnyTypeMonitor } = require('./any-type-monitor');
const { BundleSizeMonitor } = require('./bundle-size-monitor');
const { PerformanceMonitor } = require('./performance-monitor');

class QualityGateOrchestrator {
  constructor(options = {}) {
    this.options = options;
    this.results = {
      anyTypes: null,
      bundleSize: null,
      performance: null,
      summary: {
        totalViolations: 0,
        totalRegressions: 0,
        totalImprovements: 0,
        passedGates: 0,
        totalGates: 0,
        overallStatus: 'unknown',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run all quality gates
   */
  async runAll(config = {}) {
    const {
      skipAnyTypes = false,
      skipBundleSize = false,
      skipPerformance = false,
      parallel = true,
      saveBaselines = false,
    } = config;

    console.log('🚀 Running Quality Gates Analysis...\n');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${this.results.timestamp}`);
    console.log('='.repeat(60) + '\n');

    const tasks = [];

    // Prepare monitoring tasks
    if (!skipAnyTypes) {
      tasks.push({
        name: 'any-types',
        task: () => this.runAnyTypeMonitoring(saveBaselines),
      });
    }

    if (!skipBundleSize) {
      tasks.push({
        name: 'bundle-size',
        task: () => this.runBundleSizeMonitoring(saveBaselines),
      });
    }

    if (!skipPerformance) {
      tasks.push({
        name: 'performance',
        task: () => this.runPerformanceMonitoring(saveBaselines),
      });
    }

    // Execute tasks
    if (parallel && tasks.length > 1) {
      console.log('🔄 Running quality gates in parallel...\n');
      await this.runTasksInParallel(tasks);
    } else {
      console.log('🔄 Running quality gates sequentially...\n');
      await this.runTasksSequentially(tasks);
    }

    // Generate summary
    this.generateSummary();

    return this.results;
  }

  /**
   * Run tasks in parallel
   */
  async runTasksInParallel(tasks) {
    const promises = tasks.map(({ name, task }) =>
      task().catch(error => ({ error: error.message, name }))
    );

    const results = await Promise.all(promises);

    // Check for errors
    for (const result of results) {
      if (result && result.error) {
        console.error(`❌ Error in ${result.name}: ${result.error}`);
      }
    }
  }

  /**
   * Run tasks sequentially
   */
  async runTasksSequentially(tasks) {
    for (const { name, task } of tasks) {
      try {
        await task();
      } catch (error) {
        console.error(`❌ Error in ${name}: ${error.message}`);
      }
    }
  }

  /**
   * Run any type monitoring
   */
  async runAnyTypeMonitoring(saveBaseline = false) {
    console.log('🔍 Running TypeScript `any` Type Analysis...\n');

    const monitor = new AnyTypeMonitor();
    await monitor.analyze();
    monitor.checkThresholds();

    if (saveBaseline) {
      monitor.saveBaseline();
    }

    this.results.anyTypes = {
      totalAnyTypes: monitor.results.totalAnyTypes,
      justifiedAnyTypes: monitor.results.justifiedAnyTypes,
      unjustifiedAnyTypes: monitor.results.unjustifiedAnyTypes,
      violations: monitor.results.violations,
      packageResults: Object.fromEntries(monitor.results.packageResults),
      passed: monitor.results.violations.length === 0,
    };

    console.log(monitor.generateReport());
    console.log('-'.repeat(50) + '\n');
  }

  /**
   * Run bundle size monitoring
   */
  async runBundleSizeMonitoring(saveBaseline = false) {
    console.log('📦 Running Bundle Size Analysis...\n');

    const monitor = new BundleSizeMonitor();
    await monitor.analyze();
    monitor.checkThresholds();

    if (saveBaseline) {
      monitor.saveBaseline();
    }

    this.results.bundleSize = {
      totalSourceSize: monitor.results.totalSourceSize,
      totalBuiltSize: monitor.results.totalBuiltSize,
      violations: monitor.results.violations,
      regressions: monitor.results.regressions,
      improvements: monitor.results.improvements,
      packageResults: Object.fromEntries(monitor.results.packages),
      passed: monitor.results.violations.length === 0 && monitor.results.regressions.length === 0,
    };

    console.log(monitor.generateReport());
    console.log('-'.repeat(50) + '\n');
  }

  /**
   * Run performance monitoring
   */
  async runPerformanceMonitoring(saveBaseline = false) {
    console.log('⚡ Running Performance Analysis...\n');

    const monitor = new PerformanceMonitor();
    await monitor.analyze({
      skipBuild: this.options.skipBuild,
      skipTest: this.options.skipTest,
    });
    monitor.checkThresholds();

    if (saveBaseline) {
      monitor.saveBaseline();
    }

    this.results.performance = {
      buildPerformance: Object.fromEntries(monitor.results.buildPerformance),
      testPerformance: Object.fromEntries(monitor.results.testPerformance),
      globalMetrics: monitor.results.globalMetrics,
      violations: monitor.results.violations,
      regressions: monitor.results.regressions,
      improvements: monitor.results.improvements,
      passed: monitor.results.violations.length === 0 && monitor.results.regressions.length === 0,
    };

    console.log(monitor.generateReport());
    console.log('-'.repeat(50) + '\n');
  }

  /**
   * Generate overall summary
   */
  generateSummary() {
    const { anyTypes, bundleSize, performance } = this.results;

    let totalViolations = 0;
    let totalRegressions = 0;
    let totalImprovements = 0;
    let passedGates = 0;
    let totalGates = 0;

    // Count violations and regressions
    if (anyTypes) {
      totalGates++;
      totalViolations += anyTypes.violations.length;
      if (anyTypes.passed) passedGates++;
    }

    if (bundleSize) {
      totalGates++;
      totalViolations += bundleSize.violations.length;
      totalRegressions += bundleSize.regressions.length;
      totalImprovements += bundleSize.improvements.length;
      if (bundleSize.passed) passedGates++;
    }

    if (performance) {
      totalGates++;
      totalViolations += performance.violations.length;
      totalRegressions += performance.regressions.length;
      totalImprovements += performance.improvements.length;
      if (performance.passed) passedGates++;
    }

    const overallStatus = passedGates === totalGates ? 'passed' : 'failed';

    this.results.summary = {
      totalViolations,
      totalRegressions,
      totalImprovements,
      passedGates,
      totalGates,
      overallStatus,
    };
  }

  /**
   * Generate comprehensive report
   */
  generateReport(options = {}) {
    const { format = 'console', verbose = false } = options;

    if (format === 'json') {
      return JSON.stringify(this.results, null, 2);
    }

    let report = '';

    // Header
    report += '🏆 Quality Gates Summary Report\n';
    report += '='.repeat(60) + '\n\n';

    // Overall Status
    const { summary } = this.results;
    const statusIcon = summary.overallStatus === 'passed' ? '✅' : '❌';

    report += `${statusIcon} Overall Status: ${summary.overallStatus.toUpperCase()}\n`;
    report += `📊 Gates Passed: ${summary.passedGates}/${summary.totalGates}\n`;
    report += `🚨 Total Violations: ${summary.totalViolations}\n`;
    report += `📈 Total Regressions: ${summary.totalRegressions}\n`;
    report += `📉 Total Improvements: ${summary.totalImprovements}\n`;
    report += `🕐 Timestamp: ${this.results.timestamp}\n\n`;

    // Individual Gate Status
    report += '📋 Individual Gate Status:\n';

    if (this.results.anyTypes) {
      const status = this.results.anyTypes.passed ? '✅' : '❌';
      report += `   ${status} TypeScript any Types: ${this.results.anyTypes.totalAnyTypes} total (${this.results.anyTypes.unjustifiedAnyTypes} unjustified)\n`;
    }

    if (this.results.bundleSize) {
      const status = this.results.bundleSize.passed ? '✅' : '❌';
      report += `   ${status} Bundle Size: ${this.results.bundleSize.totalSourceSize}KB total\n`;
    }

    if (this.results.performance) {
      const status = this.results.performance.passed ? '✅' : '❌';
      const globalMetrics = this.results.performance.globalMetrics;
      const buildTime = globalMetrics.summary ? globalMetrics.summary.totalBuildTime : 'N/A';
      report += `   ${status} Performance: ${buildTime}s total build time\n`;
    }

    report += '\n';

    // Recommendations
    if (summary.totalViolations > 0 || summary.totalRegressions > 0) {
      report += '💡 Recommendations:\n';

      if (this.results.anyTypes && !this.results.anyTypes.passed) {
        report += '   • Review and reduce unjustified `any` type usage\n';
        report += '   • Consider using `unknown` or more specific types\n';
      }

      if (this.results.bundleSize && !this.results.bundleSize.passed) {
        report += '   • Review large packages and optimize bundle sizes\n';
        report += '   • Ensure effective tree-shaking is enabled\n';
      }

      if (this.results.performance && !this.results.performance.passed) {
        report += '   • Profile and optimize slow build or test operations\n';
        report += '   • Consider parallel execution strategies\n';
      }

      report += '\n';
    }

    // Next Steps
    if (summary.overallStatus === 'passed') {
      report += '🎉 All quality gates passed! Consider:\n';
      report += '   • Saving current state as baseline\n';
      report += '   • Reviewing improvements for further optimization\n';
      report += '   • Setting up automated monitoring\n\n';
    } else {
      report += '🔧 Action Required:\n';
      report += '   • Address violations before merging changes\n';
      report += '   • Review regressions and their causes\n';
      report += '   • Update baselines if intentional changes\n\n';
    }

    return report;
  }

  /**
   * Save results to file
   */
  saveResults(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(this.results, null, 2));
    console.log(`✅ Results saved to ${filePath}`);
  }

  /**
   * Get exit code for CI/CD
   */
  getExitCode() {
    return this.results.summary.overallStatus === 'passed' ? 0 : 1;
  }
}

// CLI interface
async function main() {
  const argv = yargs
    .option('skip-any', {
      type: 'boolean',
      description: 'Skip any type monitoring',
      default: false,
    })
    .option('skip-bundle', {
      type: 'boolean',
      description: 'Skip bundle size monitoring',
      default: false,
    })
    .option('skip-performance', {
      type: 'boolean',
      description: 'Skip performance monitoring',
      default: false,
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
    .option('parallel', {
      type: 'boolean',
      description: 'Run quality gates in parallel',
      default: true,
    })
    .option('verbose', {
      type: 'boolean',
      description: 'Show detailed output',
      default: false,
    })
    .option('format', {
      type: 'string',
      choices: ['console', 'json'],
      description: 'Output format',
      default: 'console',
    })
    .option('output', {
      type: 'string',
      description: 'Save results to file',
    })
    .option('ci', {
      type: 'boolean',
      description: 'CI mode - exit with error code on violations',
      default: false,
    })
    .help().argv;

  const orchestrator = new QualityGateOrchestrator({
    skipBuild: argv.skipBuild,
    skipTest: argv.skipTest,
  });

  try {
    await orchestrator.runAll({
      skipAnyTypes: argv.skipAny,
      skipBundleSize: argv.skipBundle,
      skipPerformance: argv.skipPerformance,
      parallel: argv.parallel,
      saveBaselines: argv.baseline,
    });

    const report = orchestrator.generateReport({
      verbose: argv.verbose,
      format: argv.format,
    });

    console.log(report);

    if (argv.output) {
      orchestrator.saveResults(argv.output);
    }

    if (argv.ci && orchestrator.getExitCode() !== 0) {
      console.error('\n❌ Quality gates failed! See details above.');
      process.exit(orchestrator.getExitCode());
    }

    if (orchestrator.results.summary.overallStatus === 'passed') {
      console.log('🎉 All quality gates passed successfully!');
    }
  } catch (error) {
    console.error('❌ Error running quality gates:', error.message);
    if (argv.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { QualityGateOrchestrator };
