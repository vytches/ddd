#!/usr/bin/env node

/**
 * TypeScript `any` Type Monitor
 *
 * Monitors and tracks TypeScript `any` types in the codebase with configurable thresholds.
 * Designed to prevent regression while allowing justified infrastructure patterns.
 *
 * Features:
 * - Scans TypeScript files for `any` type usage
 * - Configurable thresholds per package and globally
 * - Separate thresholds for production vs test files
 * - Infrastructure pattern exceptions (decorators, event constructors)
 * - CI/CD integration with exit codes
 * - Detailed reporting with file locations
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');

// Configuration for any type monitoring
const CONFIG = {
  // Global thresholds
  globalThreshold: 1400, // Adjusted for comprehensive enterprise packages with some flexibility

  // Per-package thresholds (can be customized per package)
  packageThresholds: {
    core: 0, // Meta-package should have no any types
    'domain-primitives': 5, // Foundation packages should be strict
    'value-objects': 5,
    repositories: 5,
    aggregates: 10,
    events: 18,
    cqrs: 22, // Reduced after fixing type annotations
    validation: 20,
    policies: 40,
    projections: 25,
    acl: 20,
    messaging: 25,
    resilience: 8,
    enterprise: 5,
    cli: 100, // CLI tools can have more flexibility
    testing: 110, // Testing utilities with comprehensive seeder framework
    logging: 35,
    utils: 15,
    contracts: 50, // Higher limit for contracts due to interfaces
    'domain-services': 14,
    'event-scheduling': 25,
    'process-managers': 60, // Process managers with complex workflow patterns
    nestjs: 105, // NestJS integration requires some flexibility for framework interop
    'event-store': 15,
  },

  // Higher thresholds specifically for test files
  testFileThresholds: {
    core: 5,
    'domain-primitives': 15,
    'value-objects': 15,
    repositories: 15,
    aggregates: 40,
    events: 80,
    cqrs: 40,
    validation: 25,
    policies: 45,
    projections: 75,
    acl: 60,
    messaging: 120,
    resilience: 25,
    enterprise: 15,
    cli: 320,
    testing: 60, // Keep test threshold same as production for testing package
    logging: 25,
    utils: 20,
    contracts: 50,
    'domain-services': 25,
    'event-scheduling': 20,
    'process-managers': 90, // Process managers test files with mocks and complex scenarios
    nestjs: 100, // NestJS integration tests
    'event-store': 25,
  },

  // Patterns that are justified for using `any`
  justifiedPatterns: [
    // Decorator patterns
    /target:\s*any/,
    /propertyKey:\s*any/,
    /descriptor:\s*any/,
    /@.*\(\s*target:\s*any/,

    // Event/Constructor patterns
    /constructor\(\.\.\.\s*args:\s*any\[\]/,
    /new\s*\(\.\.\.\s*args:\s*any\[\]/,

    // Type utilities
    /Record<.*,\s*any>/,
    /\[\s*key:\s*string\s*\]:\s*any/,

    // Infrastructure interfaces
    /interface.*\{[\s\S]*\[.*\]:\s*any/,

    // Generic constraints
    /<.*extends.*any.*>/,
  ],

  // Files to exclude from scanning
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
};

class AnyTypeMonitor {
  constructor(options = {}) {
    this.config = { ...CONFIG, ...options };
    this.results = {
      totalAnyTypes: 0,
      totalProductionAnyTypes: 0,
      totalTestAnyTypes: 0,
      packageResults: new Map(),
      violations: [],
      justifiedAnyTypes: 0,
      unjustifiedAnyTypes: 0,
      fileResults: new Map(),
    };
  }

  /**
   * Get all TypeScript files in the packages directory
   */
  getTypeScriptFiles() {
    const packagesDir = path.join(process.cwd(), 'packages');
    const files = [];

    const walkDir = dir => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip excluded directories
          if (this.shouldExclude(fullPath)) continue;
          walkDir(fullPath);
        } else if (entry.name.endsWith('.ts') && !this.shouldExclude(fullPath)) {
          files.push(fullPath);
        }
      }
    };

    if (fs.existsSync(packagesDir)) {
      walkDir(packagesDir);
    }

    return files;
  }

  /**
   * Check if file should be excluded
   */
  shouldExclude(filePath) {
    return this.config.excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filePath);
    });
  }

  /**
   * Extract package name from file path
   */
  getPackageName(filePath) {
    const match = filePath.match(/packages\/([^\/]+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Check if file is a test file
   */
  isTestFile(filePath) {
    return /\.(test|spec)\.ts$/.test(filePath) || /[\/\\](test|tests)[\/\\]/.test(filePath);
  }

  /**
   * Scan a file for `any` type usage
   */
  scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const anyTypes = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Look for `any` type usage
      const anyMatches = this.findAnyTypes(line);

      for (const match of anyMatches) {
        const isJustified = this.isJustifiedAny(line, content, lineNumber);

        anyTypes.push({
          line: lineNumber,
          content: line.trim(),
          position: match.index,
          match: match.match,
          justified: isJustified,
        });
      }
    }

    return anyTypes;
  }

  /**
   * Find `any` type occurrences in a line
   */
  findAnyTypes(line) {
    const anyRegex = /\bany\b/g;
    const matches = [];
    let match;

    while ((match = anyRegex.exec(line)) !== null) {
      // Skip comments
      const beforeMatch = line.substring(0, match.index);
      if (beforeMatch.includes('//') || beforeMatch.includes('/*')) {
        continue;
      }

      matches.push({
        index: match.index,
        match: match[0],
      });
    }

    return matches;
  }

  /**
   * Check if an `any` usage is justified based on patterns
   */
  isJustifiedAny(line, content, lineNumber) {
    // Check against justified patterns
    for (const pattern of this.config.justifiedPatterns) {
      if (pattern.test(line)) {
        return true;
      }
    }

    // Check surrounding context for decorator patterns
    const lines = content.split('\n');
    const contextStart = Math.max(0, lineNumber - 3);
    const contextEnd = Math.min(lines.length, lineNumber + 2);
    const context = lines.slice(contextStart, contextEnd).join('\n');

    // Check for decorator context
    if (/@\w+/.test(context) && /target.*any|descriptor.*any|propertyKey.*any/.test(line)) {
      return true;
    }

    return false;
  }

  /**
   * Run the analysis
   */
  async analyze() {
    console.log('🔍 Analyzing TypeScript `any` types...\n');

    const files = this.getTypeScriptFiles();
    console.log(`Found ${files.length} TypeScript files to analyze\n`);

    for (const filePath of files) {
      const packageName = this.getPackageName(filePath);
      const isTest = this.isTestFile(filePath);
      const anyTypes = this.scanFile(filePath);

      if (anyTypes.length > 0) {
        this.results.fileResults.set(filePath, anyTypes);

        // Update package results
        if (!this.results.packageResults.has(packageName)) {
          this.results.packageResults.set(packageName, {
            totalAnyTypes: 0,
            productionAnyTypes: 0,
            testAnyTypes: 0,
            justifiedAnyTypes: 0,
            unjustifiedAnyTypes: 0,
            files: [],
            testFiles: [],
          });
        }

        const packageResult = this.results.packageResults.get(packageName);
        packageResult.totalAnyTypes += anyTypes.length;
        packageResult.justifiedAnyTypes += anyTypes.filter(a => a.justified).length;
        packageResult.unjustifiedAnyTypes += anyTypes.filter(a => !a.justified).length;

        if (isTest) {
          packageResult.testAnyTypes += anyTypes.length;
          packageResult.testFiles.push({
            path: filePath,
            anyTypes: anyTypes.length,
            unjustified: anyTypes.filter(a => !a.justified).length,
          });
        } else {
          packageResult.productionAnyTypes += anyTypes.length;
          packageResult.files.push({
            path: filePath,
            anyTypes: anyTypes.length,
            unjustified: anyTypes.filter(a => !a.justified).length,
          });
        }
      }
    }

    // Calculate totals
    for (const [packageName, result] of this.results.packageResults) {
      this.results.totalAnyTypes += result.totalAnyTypes;
      this.results.totalProductionAnyTypes += result.productionAnyTypes;
      this.results.totalTestAnyTypes += result.testAnyTypes;
      this.results.justifiedAnyTypes += result.justifiedAnyTypes;
      this.results.unjustifiedAnyTypes += result.unjustifiedAnyTypes;
    }
  }

  /**
   * Check thresholds and generate violations
   */
  checkThresholds() {
    const violations = [];

    // Check global threshold
    if (this.results.totalAnyTypes > this.config.globalThreshold) {
      violations.push({
        type: 'global',
        message: `Total any types (${this.results.totalAnyTypes}) exceeds global threshold (${this.config.globalThreshold})`,
        current: this.results.totalAnyTypes,
        threshold: this.config.globalThreshold,
        exceeded: this.results.totalAnyTypes - this.config.globalThreshold,
      });
    }

    // Check package thresholds - separate for production and test files
    for (const [packageName, result] of this.results.packageResults) {
      const productionThreshold = this.config.packageThresholds[packageName] || 20;
      const testThreshold = this.config.testFileThresholds[packageName] || productionThreshold * 3;

      // Check production files threshold
      if (result.productionAnyTypes > productionThreshold) {
        violations.push({
          type: 'package-production',
          package: packageName,
          message: `Package '${packageName}' production any types (${result.productionAnyTypes}) exceeds threshold (${productionThreshold})`,
          current: result.productionAnyTypes,
          threshold: productionThreshold,
          exceeded: result.productionAnyTypes - productionThreshold,
        });
      }

      // Check test files threshold (separate)
      if (result.testAnyTypes > testThreshold) {
        violations.push({
          type: 'package-test',
          package: packageName,
          message: `Package '${packageName}' test any types (${result.testAnyTypes}) exceeds threshold (${testThreshold})`,
          current: result.testAnyTypes,
          threshold: testThreshold,
          exceeded: result.testAnyTypes - testThreshold,
        });
      }
    }

    this.results.violations = violations;
    return violations;
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
    report += '📊 TypeScript `any` Type Analysis Report\n';
    report += '='.repeat(50) + '\n\n';

    // Summary
    report += `📈 Summary:\n`;
    report += `   Total any types: ${this.results.totalAnyTypes}\n`;
    report += `   Production files: ${this.results.totalProductionAnyTypes}\n`;
    report += `   Test files: ${this.results.totalTestAnyTypes}\n`;
    report += `   Justified: ${this.results.justifiedAnyTypes}\n`;
    report += `   Unjustified: ${this.results.unjustifiedAnyTypes}\n`;
    report += `   Global threshold: ${this.config.globalThreshold}\n`;

    report += '\n';

    // Package breakdown
    if (this.results.packageResults.size > 0) {
      report += `📦 Package Breakdown:\n`;
      for (const [packageName, result] of this.results.packageResults) {
        const productionThreshold = this.config.packageThresholds[packageName] || 20;
        const testThreshold =
          this.config.testFileThresholds[packageName] || productionThreshold * 3;

        const productionStatus = result.productionAnyTypes <= productionThreshold ? '✅' : '❌';
        const testStatus = result.testAnyTypes <= testThreshold ? '✅' : '❌';

        report += `   ${packageName}:\n`;
        report += `     ${productionStatus} Production: ${result.productionAnyTypes} (threshold: ${productionThreshold})\n`;
        report += `     ${testStatus} Tests: ${result.testAnyTypes} (threshold: ${testThreshold})\n`;

        if (verbose && result.totalAnyTypes > 0) {
          report += `      - Justified: ${result.justifiedAnyTypes}\n`;
          report += `      - Unjustified: ${result.unjustifiedAnyTypes}\n`;
          report += `      - Production files: ${result.files.length}\n`;
          report += `      - Test files: ${result.testFiles.length}\n`;
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
    } else {
      report += `✅ No threshold violations found!\n\n`;
    }

    // Detailed file results (if verbose)
    if (verbose && this.results.fileResults.size > 0) {
      report += `📁 Detailed File Results:\n`;
      for (const [filePath, anyTypes] of this.results.fileResults) {
        const unjustified = anyTypes.filter(a => !a.justified);
        if (unjustified.length > 0) {
          report += `   📄 ${filePath}\n`;
          for (const anyType of unjustified) {
            report += `      Line ${anyType.line}: ${anyType.content}\n`;
          }
          report += '\n';
        }
      }
    }

    return report;
  }

  /**
   * Get exit code based on results
   */
  getExitCode() {
    return this.results.violations.length > 0 ? 1 : 0;
  }
}

// CLI interface
async function main() {
  const argv = yargs
    .option('threshold', {
      type: 'number',
      description: 'Global threshold for any types',
      default: CONFIG.globalThreshold,
    })
    .option('package', {
      type: 'string',
      description: 'Specific package to analyze',
    })
    .option('verbose', {
      type: 'boolean',
      description: 'Show detailed file-by-file results',
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

  const monitor = new AnyTypeMonitor({
    globalThreshold: argv.threshold,
  });

  try {
    await monitor.analyze();
    monitor.checkThresholds();

    const report = monitor.generateReport({
      verbose: argv.verbose,
      format: argv.format,
    });

    console.log(report);

    if (argv.ci && monitor.getExitCode() !== 0) {
      console.error('\n❌ Quality gate failed: any type violations detected');
      process.exit(monitor.getExitCode());
    }

    if (monitor.results.violations.length === 0) {
      console.log('🎉 All quality gates passed!');
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

module.exports = { AnyTypeMonitor, CONFIG };
