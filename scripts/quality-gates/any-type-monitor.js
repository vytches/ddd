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
 * - Baseline support for tracking improvements
 * - Infrastructure pattern exceptions (decorators, event constructors)
 * - CI/CD integration with exit codes
 * - Detailed reporting with file locations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yargs = require('yargs');

// Configuration for any type monitoring
const CONFIG = {
  // Global thresholds
  globalThreshold: 70, // Current: 67 any types (as per IMPROVE.md)
  
  // Per-package thresholds (can be customized per package)
  packageThresholds: {
    'core': 0,           // Meta-package should have no any types
    'domain-primitives': 5,  // Foundation packages should be strict
    'value-objects': 5,
    'repositories': 5,
    'aggregates': 10,
    'events': 15,
    'cqrs': 10,
    'validation': 8,
    'policies': 8,
    'projections': 10,
    'acl': 12,
    'messaging': 10,
    'resilience': 8,
    'enterprise': 5,
    'cli': 15,           // CLI tools can have more flexibility
    'testing': 20,       // Testing utilities have more flexibility
    'logging': 8,
    'utils': 5,
    'contracts': 10,
    'domain-services': 8
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
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/test/**',
    '**/tests/**',
    '**/*.d.ts'
  ]
};

class AnyTypeMonitor {
  constructor(options = {}) {
    this.config = { ...CONFIG, ...options };
    this.baseline = this.loadBaseline();
    this.results = {
      totalAnyTypes: 0,
      packageResults: new Map(),
      violations: [],
      justifiedAnyTypes: 0,
      unjustifiedAnyTypes: 0,
      fileResults: new Map()
    };
  }

  /**
   * Load baseline from previous runs
   */
  loadBaseline() {
    const baselinePath = path.join(process.cwd(), '.quality-gates', 'any-types-baseline.json');
    
    try {
      if (fs.existsSync(baselinePath)) {
        return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load baseline:', error.message);
    }
    
    return {
      totalAnyTypes: this.config.globalThreshold,
      timestamp: new Date().toISOString(),
      packages: {}
    };
  }

  /**
   * Save current results as baseline
   */
  saveBaseline() {
    const baselineDir = path.join(process.cwd(), '.quality-gates');
    const baselinePath = path.join(baselineDir, 'any-types-baseline.json');
    
    if (!fs.existsSync(baselineDir)) {
      fs.mkdirSync(baselineDir, { recursive: true });
    }
    
    const baseline = {
      totalAnyTypes: this.results.totalAnyTypes,
      timestamp: new Date().toISOString(),
      packages: Object.fromEntries(this.results.packageResults)
    };
    
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    console.log(`✅ Baseline saved to ${baselinePath}`);
  }

  /**
   * Get all TypeScript files in the packages directory
   */
  getTypeScriptFiles() {
    const packagesDir = path.join(process.cwd(), 'packages');
    const files = [];

    const walkDir = (dir) => {
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
          justified: isJustified
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
        match: match[0]
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
      const anyTypes = this.scanFile(filePath);

      if (anyTypes.length > 0) {
        this.results.fileResults.set(filePath, anyTypes);
        
        // Update package results
        if (!this.results.packageResults.has(packageName)) {
          this.results.packageResults.set(packageName, {
            totalAnyTypes: 0,
            justifiedAnyTypes: 0,
            unjustifiedAnyTypes: 0,
            files: []
          });
        }

        const packageResult = this.results.packageResults.get(packageName);
        packageResult.totalAnyTypes += anyTypes.length;
        packageResult.justifiedAnyTypes += anyTypes.filter(a => a.justified).length;
        packageResult.unjustifiedAnyTypes += anyTypes.filter(a => !a.justified).length;
        packageResult.files.push({
          path: filePath,
          anyTypes: anyTypes.length,
          unjustified: anyTypes.filter(a => !a.justified).length
        });
      }
    }

    // Calculate totals
    for (const [packageName, result] of this.results.packageResults) {
      this.results.totalAnyTypes += result.totalAnyTypes;
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
        exceeded: this.results.totalAnyTypes - this.config.globalThreshold
      });
    }

    // Check package thresholds
    for (const [packageName, result] of this.results.packageResults) {
      const threshold = this.config.packageThresholds[packageName] || 20; // Default threshold
      
      if (result.totalAnyTypes > threshold) {
        violations.push({
          type: 'package',
          package: packageName,
          message: `Package '${packageName}' any types (${result.totalAnyTypes}) exceeds threshold (${threshold})`,
          current: result.totalAnyTypes,
          threshold: threshold,
          exceeded: result.totalAnyTypes - threshold
        });
      }
    }

    // Check baseline regression
    if (this.baseline && this.results.totalAnyTypes > this.baseline.totalAnyTypes) {
      violations.push({
        type: 'regression',
        message: `Total any types increased from baseline (${this.baseline.totalAnyTypes} → ${this.results.totalAnyTypes})`,
        baseline: this.baseline.totalAnyTypes,
        current: this.results.totalAnyTypes,
        regression: this.results.totalAnyTypes - this.baseline.totalAnyTypes
      });
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
    report += `   Justified: ${this.results.justifiedAnyTypes}\n`;
    report += `   Unjustified: ${this.results.unjustifiedAnyTypes}\n`;
    report += `   Global threshold: ${this.config.globalThreshold}\n`;
    
    if (this.baseline) {
      const change = this.results.totalAnyTypes - this.baseline.totalAnyTypes;
      const changeIcon = change > 0 ? '📈' : change < 0 ? '📉' : '📊';
      report += `   Change from baseline: ${changeIcon} ${change > 0 ? '+' : ''}${change}\n`;
    }
    report += '\n';

    // Package breakdown
    if (this.results.packageResults.size > 0) {
      report += `📦 Package Breakdown:\n`;
      for (const [packageName, result] of this.results.packageResults) {
        const threshold = this.config.packageThresholds[packageName] || 20;
        const status = result.totalAnyTypes <= threshold ? '✅' : '❌';
        
        report += `   ${status} ${packageName}: ${result.totalAnyTypes} (threshold: ${threshold})\n`;
        
        if (verbose && result.totalAnyTypes > 0) {
          report += `      - Justified: ${result.justifiedAnyTypes}\n`;
          report += `      - Unjustified: ${result.unjustifiedAnyTypes}\n`;
          report += `      - Files: ${result.files.length}\n`;
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
      default: CONFIG.globalThreshold
    })
    .option('package', {
      type: 'string',
      description: 'Specific package to analyze'
    })
    .option('baseline', {
      type: 'boolean',
      description: 'Save current results as baseline',
      default: false
    })
    .option('verbose', {
      type: 'boolean',
      description: 'Show detailed file-by-file results',
      default: false
    })
    .option('format', {
      type: 'string',
      choices: ['console', 'json'],
      description: 'Output format',
      default: 'console'
    })
    .option('ci', {
      type: 'boolean',
      description: 'CI mode - exit with error code on violations',
      default: false
    })
    .help()
    .argv;

  const monitor = new AnyTypeMonitor({
    globalThreshold: argv.threshold
  });

  try {
    await monitor.analyze();
    monitor.checkThresholds();

    const report = monitor.generateReport({
      verbose: argv.verbose,
      format: argv.format
    });

    console.log(report);

    if (argv.baseline) {
      monitor.saveBaseline();
    }

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