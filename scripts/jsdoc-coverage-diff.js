#!/usr/bin/env node

/**
 * JSDoc Coverage Diff Tool - Compare coverage reports and track changes
 *
 * Features:
 * - Compare two reports or snapshots
 * - Track coverage improvements/regressions
 * - Identify which files changed
 * - Generate actionable insights
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

class JSDocCoverageDiff {
  constructor() {
    this.historyDir = path.join(__dirname, '..', '.jsdoc-coverage-history');
  }

  /**
   * Compare two reports
   */
  compareReports(report1Path, report2Path, options = {}) {
    const { showFiles = false, showUnchanged = false } = options;

    // Load reports
    const report1 = this.loadReport(report1Path);
    const report2 = this.loadReport(report2Path);

    if (!report1 || !report2) {
      console.error('❌ Could not load one or both reports');
      return;
    }

    console.log('\n📊 JSDOC COVERAGE COMPARISON');
    console.log('='.repeat(80));
    console.log(`📅 Report 1: ${report1.timestamp}`);
    console.log(`📅 Report 2: ${report2.timestamp}`);
    console.log('='.repeat(80));

    // Overall comparison
    this.compareOverall(report1, report2);

    // Package-by-package comparison
    this.comparePackages(report1, report2, { showFiles, showUnchanged });

    // Generate insights
    this.generateInsights(report1, report2);
  }

  /**
   * Compare overall metrics
   */
  compareOverall(report1, report2) {
    console.log('\n📈 OVERALL METRICS COMPARISON');
    console.log('-'.repeat(40));

    const metrics = [
      {
        name: 'Total Elements',
        value1: report1.summary.totalElements,
        value2: report2.summary.totalElements,
      },
      {
        name: 'Documented Elements',
        value1: report1.summary.documentedElements,
        value2: report2.summary.documentedElements,
      },
      {
        name: 'Coverage',
        value1: report1.summary.coverage,
        value2: report2.summary.coverage,
        suffix: '%',
      },
    ];

    metrics.forEach(metric => {
      const diff = metric.value2 - metric.value1;
      const trend = diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️';
      const suffix = metric.suffix || '';

      console.log(
        `${metric.name.padEnd(20)} ` +
          `${metric.value1}${suffix} → ${metric.value2}${suffix} ` +
          `${trend} (${diff >= 0 ? '+' : ''}${diff}${suffix})`
      );
    });
  }

  /**
   * Compare packages
   */
  comparePackages(report1, report2, options) {
    const { showFiles, showUnchanged } = options;

    console.log('\n📦 PACKAGE-BY-PACKAGE COMPARISON');
    console.log('-'.repeat(40));

    const allPackages = new Set([
      ...Object.keys(report1.packages || {}),
      ...Object.keys(report2.packages || {}),
    ]);

    const improvements = [];
    const regressions = [];
    const unchanged = [];
    const newPackages = [];
    const removedPackages = [];

    for (const packageName of allPackages) {
      const pkg1 = report1.packages?.[packageName];
      const pkg2 = report2.packages?.[packageName];

      if (!pkg1 && pkg2) {
        newPackages.push({ name: packageName, coverage: pkg2.coverage });
      } else if (pkg1 && !pkg2) {
        removedPackages.push({ name: packageName, coverage: pkg1.coverage });
      } else if (pkg1 && pkg2) {
        const diff = pkg2.coverage - pkg1.coverage;

        const packageInfo = {
          name: packageName,
          coverage1: pkg1.coverage,
          coverage2: pkg2.coverage,
          diff: diff,
          elements1: pkg1.totalElements,
          elements2: pkg2.totalElements,
          documented1: pkg1.documentedElements,
          documented2: pkg2.documentedElements,
        };

        if (Math.abs(diff) < 0.1) {
          unchanged.push(packageInfo);
        } else if (diff > 0) {
          improvements.push(packageInfo);
        } else {
          regressions.push(packageInfo);
        }
      }
    }

    // Show improvements
    if (improvements.length > 0) {
      console.log('\n✅ IMPROVEMENTS');
      improvements
        .sort((a, b) => b.diff - a.diff)
        .forEach(pkg => {
          const elemChange = pkg.elements2 - pkg.elements1;
          const docChange = pkg.documented2 - pkg.documented1;

          console.log(
            `  ${pkg.name.padEnd(25)} ` +
              `${pkg.coverage1.toFixed(1)}% → ${pkg.coverage2.toFixed(1)}% ` +
              `(+${pkg.diff.toFixed(1)}%) ` +
              `[+${docChange} documented, ${elemChange >= 0 ? '+' : ''}${elemChange} total]`
          );
        });
    }

    // Show regressions
    if (regressions.length > 0) {
      console.log('\n❌ REGRESSIONS');
      regressions
        .sort((a, b) => a.diff - b.diff)
        .forEach(pkg => {
          const elemChange = pkg.elements2 - pkg.elements1;
          const docChange = pkg.documented2 - pkg.documented1;

          console.log(
            `  ${pkg.name.padEnd(25)} ` +
              `${pkg.coverage1.toFixed(1)}% → ${pkg.coverage2.toFixed(1)}% ` +
              `(${pkg.diff.toFixed(1)}%) ` +
              `[${docChange >= 0 ? '+' : ''}${docChange} documented, ${elemChange >= 0 ? '+' : ''}${elemChange} total]`
          );
        });
    }

    // Show unchanged (if requested)
    if (showUnchanged && unchanged.length > 0) {
      console.log('\n➡️ UNCHANGED');
      unchanged.forEach(pkg => {
        console.log(`  ${pkg.name.padEnd(25)} ${pkg.coverage1.toFixed(1)}%`);
      });
    }

    // Show new/removed packages
    if (newPackages.length > 0) {
      console.log('\n🆕 NEW PACKAGES');
      newPackages.forEach(pkg => {
        console.log(`  ${pkg.name.padEnd(25)} ${pkg.coverage.toFixed(1)}%`);
      });
    }

    if (removedPackages.length > 0) {
      console.log('\n🗑️ REMOVED PACKAGES');
      removedPackages.forEach(pkg => {
        console.log(`  ${pkg.name.padEnd(25)} ${pkg.coverage.toFixed(1)}%`);
      });
    }

    // Show file-level changes if requested
    if (showFiles) {
      this.showFileChanges(report1, report2, [...improvements, ...regressions]);
    }
  }

  /**
   * Show file-level changes
   */
  showFileChanges(report1, report2, changedPackages) {
    console.log('\n📄 FILE-LEVEL CHANGES');
    console.log('-'.repeat(40));

    changedPackages.slice(0, 5).forEach(pkg => {
      const pkg1 = report1.packages[pkg.name];
      const pkg2 = report2.packages[pkg.name];

      if (!pkg1.files || !pkg2.files) return;

      const fileChanges = [];

      // Check each file
      for (const [filePath, file2] of Object.entries(pkg2.files)) {
        const file1 = pkg1.files[filePath];

        if (file1 && file2) {
          const diff = file2.coverage - file1.coverage;
          if (Math.abs(diff) > 0.1) {
            fileChanges.push({
              path: filePath,
              coverage1: file1.coverage,
              coverage2: file2.coverage,
              diff: diff,
              documented1: file1.documentedElements,
              documented2: file2.documentedElements,
              total1: file1.totalElements,
              total2: file2.totalElements,
            });
          }
        }
      }

      if (fileChanges.length > 0) {
        console.log(`\n${pkg.name}:`);
        fileChanges
          .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
          .slice(0, 3)
          .forEach(file => {
            const trend = file.diff > 0 ? '📈' : '📉';
            console.log(
              `  ${trend} ${file.path}: ` +
                `${file.coverage1.toFixed(0)}% → ${file.coverage2.toFixed(0)}% ` +
                `(${file.documented1}/${file.total1} → ${file.documented2}/${file.total2})`
            );
          });
      }
    });
  }

  /**
   * Generate insights
   */
  generateInsights(report1, report2) {
    console.log('\n💡 INSIGHTS & RECOMMENDATIONS');
    console.log('-'.repeat(40));

    // Calculate trends
    const coverageDiff = report2.summary.coverage - report1.summary.coverage;
    const elementsDiff = report2.summary.totalElements - report1.summary.totalElements;
    const documentedDiff = report2.summary.documentedElements - report1.summary.documentedElements;

    // Overall trend
    if (coverageDiff > 1) {
      console.log(`✅ Great progress! Coverage improved by ${coverageDiff.toFixed(1)}%`);
    } else if (coverageDiff < -1) {
      console.log(`⚠️ Coverage decreased by ${Math.abs(coverageDiff).toFixed(1)}%`);
    } else {
      console.log('➡️ Coverage remained stable');
    }

    // Documentation effort
    if (documentedDiff > 0) {
      console.log(`📝 ${documentedDiff} new elements documented`);
    }

    // Codebase growth
    if (elementsDiff > 10) {
      console.log(`📈 Codebase grew by ${elementsDiff} elements`);
      if (documentedDiff < elementsDiff * 0.5) {
        console.log('   ⚠️ Documentation is not keeping pace with code growth');
      }
    }

    // Find packages needing attention
    const needsAttention = [];

    for (const [name, pkg] of Object.entries(report2.packages || {})) {
      if (pkg.coverage < 50 && pkg.totalElements > 10) {
        needsAttention.push({ name, coverage: pkg.coverage, elements: pkg.totalElements });
      }
    }

    if (needsAttention.length > 0) {
      console.log('\n🎯 PACKAGES NEEDING ATTENTION:');
      needsAttention
        .sort((a, b) => a.coverage - b.coverage)
        .slice(0, 5)
        .forEach(pkg => {
          console.log(
            `   ${pkg.name}: ${pkg.coverage.toFixed(1)}% coverage (${pkg.elements} elements)`
          );
        });
    }

    // Check for outdated documentation
    let totalOutdated = 0;
    for (const pkg of Object.values(report2.packages || {})) {
      if (pkg.outdatedFiles) {
        totalOutdated += pkg.outdatedFiles.length;
      }
    }

    if (totalOutdated > 0) {
      console.log(`\n⚠️ ${totalOutdated} YAML files are outdated and need updating`);
    }
  }

  /**
   * Load a report
   */
  loadReport(reportPath) {
    // Handle special keywords
    if (reportPath === 'current') {
      reportPath = path.join(this.historyDir, 'current.json');
    } else if (reportPath === 'previous') {
      reportPath = path.join(this.historyDir, 'previous.json');
    } else if (reportPath === 'latest') {
      // Find the latest timestamped report
      const reports = glob.sync(path.join(this.historyDir, 'report-*.json'));
      if (reports.length > 0) {
        reportPath = reports.sort().pop();
      }
    }

    // Resolve relative paths
    if (!path.isAbsolute(reportPath)) {
      reportPath = path.join(process.cwd(), reportPath);
    }

    try {
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (e) {
      console.error(`❌ Could not load report from: ${reportPath}`);
      console.error(e.message);
      return null;
    }
  }

  /**
   * List available reports
   */
  listReports() {
    console.log('\n📋 AVAILABLE REPORTS');
    console.log('-'.repeat(40));

    const reports = glob.sync(path.join(this.historyDir, '*.json'));

    if (reports.length === 0) {
      console.log('No reports found. Run jsdoc-coverage-monitor.js first.');
      return;
    }

    reports.forEach(reportPath => {
      const filename = path.basename(reportPath);
      const stats = fs.statSync(reportPath);

      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        console.log(
          `  ${filename.padEnd(40)} ` +
            `Coverage: ${report.summary?.coverage?.toFixed(1) || 'N/A'}% ` +
            `Date: ${report.timestamp || stats.mtime.toISOString()}`
        );
      } catch (e) {
        console.log(`  ${filename.padEnd(40)} (invalid)`);
      }
    });

    console.log('\nUsage: node jsdoc-coverage-diff.js <report1> <report2>');
    console.log('  Use "current", "previous", or "latest" for special reports');
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const diff = new JSDocCoverageDiff();

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
JSDoc Coverage Diff Tool - Compare coverage reports

Usage: 
  node jsdoc-coverage-diff.js <report1> <report2> [options]
  node jsdoc-coverage-diff.js --list

Arguments:
  report1, report2    Path to report files or special keywords:
                      - "current"  : Use the current report
                      - "previous" : Use the previous report
                      - "latest"   : Use the latest timestamped report

Options:
  --files            Show file-level changes
  --unchanged        Show unchanged packages
  --list             List available reports
  --help             Show this help message

Examples:
  node jsdoc-coverage-diff.js current previous
  node jsdoc-coverage-diff.js previous current --files
  node jsdoc-coverage-diff.js report-2025-08-28.json current
`);
    return;
  }

  if (args.includes('--list')) {
    diff.listReports();
    return;
  }

  const report1Path = args[0];
  const report2Path = args[1];

  if (!report1Path || !report2Path) {
    console.error('❌ Please provide two report paths');
    console.log('Use --help for usage information');
    return;
  }

  const options = {
    showFiles: args.includes('--files'),
    showUnchanged: args.includes('--unchanged'),
  };

  diff.compareReports(report1Path, report2Path, options);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { JSDocCoverageDiff };
