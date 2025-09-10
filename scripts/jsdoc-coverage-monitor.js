#!/usr/bin/env node

/**
 * JSDoc Coverage Monitor - Track changes and detect outdated documentation
 *
 * Features:
 * - Generate current coverage reports
 * - Compare with previous reports
 * - Detect outdated documentation
 * - Track coverage trends
 * - Identify regression
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const glob = require('glob');
const crypto = require('crypto');

class JSDocCoverageMonitor {
  constructor() {
    this.historyDir = path.join(__dirname, '..', '.jsdoc-coverage-history');
    this.currentReportPath = path.join(this.historyDir, 'current.json');
    this.previousReportPath = path.join(this.historyDir, 'previous.json');

    // Ensure history directory exists
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }

    this.currentReport = {
      timestamp: new Date().toISOString(),
      packages: {},
      summary: {
        totalPackages: 0,
        totalElements: 0,
        documentedElements: 0,
        coverage: 0,
        trends: {
          improved: [],
          regressed: [],
          unchanged: [],
          new: [],
        },
      },
    };
  }

  /**
   * Main entry point - analyze and report
   */
  async analyze(options = {}) {
    const {
      showDetails = true,
      saveCurrent = true,
      compareWithPrevious = true,
      checkOutdated = true,
    } = options;

    console.log('\n📊 JSDOC COVERAGE MONITOR');
    console.log('='.repeat(80));
    console.log(`🕐 Timestamp: ${this.currentReport.timestamp}`);
    console.log('='.repeat(80));

    // Load previous report if exists
    const previousReport = this.loadPreviousReport();

    // Analyze all packages
    await this.analyzeAllPackages();

    // Check for outdated documentation
    if (checkOutdated) {
      await this.checkOutdatedDocumentation();
    }

    // Compare with previous if exists
    if (compareWithPrevious && previousReport) {
      this.compareReports(previousReport);
    }

    // Generate report
    this.generateReport(showDetails);

    // Save current report
    if (saveCurrent) {
      this.saveCurrentReport();
    }

    return this.currentReport;
  }

  /**
   * Analyze all packages
   */
  async analyzeAllPackages() {
    const packagesPath = path.join(__dirname, '..', 'packages');
    const packages = fs
      .readdirSync(packagesPath)
      .filter(dir => fs.statSync(path.join(packagesPath, dir)).isDirectory());

    for (const packageName of packages) {
      await this.analyzePackage(path.join(packagesPath, packageName));
    }

    // Calculate summary
    this.currentReport.summary.totalPackages = Object.keys(this.currentReport.packages).length;
    this.currentReport.summary.coverage =
      this.currentReport.summary.totalElements > 0
        ? Math.round(
            (this.currentReport.summary.documentedElements /
              this.currentReport.summary.totalElements) *
              1000
          ) / 10
        : 0;
  }

  /**
   * Analyze a single package
   */
  async analyzePackage(packagePath) {
    const packageName = path.basename(packagePath);
    const distPath = path.join(packagePath, 'dist');

    if (!fs.existsSync(distPath)) {
      return;
    }

    const files = glob.sync(`${distPath}/**/*.d.ts`);
    const packageReport = {
      name: packageName,
      totalElements: 0,
      documentedElements: 0,
      coverage: 0,
      files: {},
      yamlFiles: 0,
      hasYamlSettings: false,
      fileHashes: {},
      outdatedFiles: [],
    };

    // Check for YAML files
    const yamlPath = path.join(__dirname, '..', 'docs', 'examples', 'domain', packageName);
    if (fs.existsSync(yamlPath)) {
      packageReport.yamlFiles = glob.sync(`${yamlPath}/**/*.yaml`).length;
      packageReport.hasYamlSettings = fs.existsSync(path.join(yamlPath, '.md-settings.yaml'));
    }

    // Analyze each .d.ts file
    for (const file of files) {
      const fileReport = await this.analyzeFile(file);
      const relativePath = path.relative(distPath, file);

      packageReport.files[relativePath] = fileReport;
      packageReport.totalElements += fileReport.totalElements;
      packageReport.documentedElements += fileReport.documentedElements;

      // Calculate file hash for change detection
      const fileContent = fs.readFileSync(file, 'utf8');
      packageReport.fileHashes[relativePath] = this.calculateHash(fileContent);
    }

    packageReport.coverage =
      packageReport.totalElements > 0
        ? Math.round((packageReport.documentedElements / packageReport.totalElements) * 1000) / 10
        : 0;

    this.currentReport.packages[packageName] = packageReport;
    this.currentReport.summary.totalElements += packageReport.totalElements;
    this.currentReport.summary.documentedElements += packageReport.documentedElements;
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    const report = {
      totalElements: 0,
      documentedElements: 0,
      coverage: 0,
      elements: [],
      lastModified: fs.statSync(filePath).mtime,
    };

    const visit = node => {
      if (this.shouldHaveJSDoc(node)) {
        const element = {
          type: this.getNodeKindName(node.kind),
          name: this.getNodeName(node),
          hasJSDoc: this.hasJSDoc(node),
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        };

        report.elements.push(element);
        report.totalElements++;

        if (element.hasJSDoc) {
          report.documentedElements++;
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    report.coverage =
      report.totalElements > 0
        ? Math.round((report.documentedElements / report.totalElements) * 1000) / 10
        : 0;

    return report;
  }

  /**
   * Check for outdated documentation
   */
  async checkOutdatedDocumentation() {
    console.log('\n🔍 Checking for outdated documentation...');

    for (const [packageName, packageReport] of Object.entries(this.currentReport.packages)) {
      // Check YAML vs TypeScript timestamps
      const yamlPath = path.join(__dirname, '..', 'docs', 'examples', 'domain', packageName);

      for (const [filePath, fileReport] of Object.entries(packageReport.files)) {
        const tsFile = path.join(__dirname, '..', 'packages', packageName, 'dist', filePath);
        const yamlFile = path.join(yamlPath, filePath.replace('.d.ts', '.yaml'));

        if (fs.existsSync(yamlFile)) {
          const tsStats = fs.statSync(tsFile);
          const yamlStats = fs.statSync(yamlFile);

          if (tsStats.mtime > yamlStats.mtime) {
            packageReport.outdatedFiles.push({
              file: filePath,
              tsModified: tsStats.mtime,
              yamlModified: yamlStats.mtime,
              daysBehind: Math.round((tsStats.mtime - yamlStats.mtime) / (1000 * 60 * 60 * 24)),
            });
          }
        }
      }
    }
  }

  /**
   * Compare with previous report
   */
  compareReports(previousReport) {
    console.log('\n📈 Comparing with previous report...');

    for (const [packageName, currentPackage] of Object.entries(this.currentReport.packages)) {
      const previousPackage = previousReport.packages[packageName];

      if (!previousPackage) {
        this.currentReport.summary.trends.new.push({
          package: packageName,
          coverage: currentPackage.coverage,
        });
      } else {
        const diff = currentPackage.coverage - previousPackage.coverage;

        if (diff > 0.1) {
          this.currentReport.summary.trends.improved.push({
            package: packageName,
            previousCoverage: previousPackage.coverage,
            currentCoverage: currentPackage.coverage,
            improvement: diff,
          });
        } else if (diff < -0.1) {
          this.currentReport.summary.trends.regressed.push({
            package: packageName,
            previousCoverage: previousPackage.coverage,
            currentCoverage: currentPackage.coverage,
            regression: Math.abs(diff),
          });
        } else {
          this.currentReport.summary.trends.unchanged.push(packageName);
        }

        // Check for file changes
        currentPackage.filesChanged = [];
        for (const [filePath, hash] of Object.entries(currentPackage.fileHashes)) {
          if (previousPackage.fileHashes && previousPackage.fileHashes[filePath] !== hash) {
            currentPackage.filesChanged.push(filePath);
          }
        }
      }
    }
  }

  /**
   * Generate detailed report
   */
  generateReport(showDetails = true) {
    console.log('\n');
    console.log('='.repeat(80));
    console.log('📊 COVERAGE REPORT');
    console.log('='.repeat(80));

    // Overall summary
    console.log('\n📈 OVERALL METRICS');
    console.log('-'.repeat(40));
    console.log(`Total Packages: ${this.currentReport.summary.totalPackages}`);
    console.log(`Total Elements: ${this.currentReport.summary.totalElements}`);
    console.log(`Documented: ${this.currentReport.summary.documentedElements}`);
    console.log(`Overall Coverage: ${this.currentReport.summary.coverage}%`);

    // Package rankings
    console.log('\n🏆 PACKAGE COVERAGE RANKING');
    console.log('-'.repeat(40));

    const sortedPackages = Object.values(this.currentReport.packages).sort(
      (a, b) => b.coverage - a.coverage
    );

    sortedPackages.forEach((pkg, index) => {
      const status = pkg.coverage >= 80 ? '🟢' : pkg.coverage >= 50 ? '🟡' : '🔴';
      const yamlStatus = pkg.yamlFiles > 0 ? '✅' : '❌';
      const rank = String(index + 1).padStart(2, ' ');

      console.log(
        `${rank}. ${status} ${pkg.name.padEnd(25)} ${pkg.coverage.toFixed(1).padStart(5)}% ` +
          `(${pkg.documentedElements}/${pkg.totalElements}) ` +
          `YAML:${yamlStatus}(${pkg.yamlFiles})`
      );

      // Show files changed
      if (pkg.filesChanged && pkg.filesChanged.length > 0) {
        console.log(`    📝 Files changed: ${pkg.filesChanged.length}`);
      }

      // Show outdated files
      if (pkg.outdatedFiles && pkg.outdatedFiles.length > 0) {
        console.log(`    ⚠️ Outdated YAML: ${pkg.outdatedFiles.length} files`);
        if (showDetails) {
          pkg.outdatedFiles.slice(0, 3).forEach(f => {
            console.log(`       - ${f.file} (${f.daysBehind} days behind)`);
          });
        }
      }
    });

    // Coverage trends
    if (
      this.currentReport.summary.trends.improved.length > 0 ||
      this.currentReport.summary.trends.regressed.length > 0
    ) {
      console.log('\n📊 COVERAGE TRENDS');
      console.log('-'.repeat(40));

      if (this.currentReport.summary.trends.improved.length > 0) {
        console.log('✅ Improved:');
        this.currentReport.summary.trends.improved.forEach(item => {
          console.log(
            `   ${item.package}: ${item.previousCoverage}% → ${item.currentCoverage}% (+${item.improvement.toFixed(1)}%)`
          );
        });
      }

      if (this.currentReport.summary.trends.regressed.length > 0) {
        console.log('⚠️ Regressed:');
        this.currentReport.summary.trends.regressed.forEach(item => {
          console.log(
            `   ${item.package}: ${item.previousCoverage}% → ${item.currentCoverage}% (-${item.regression.toFixed(1)}%)`
          );
        });
      }
    }

    // Coverage by status
    console.log('\n📋 COVERAGE BREAKDOWN');
    console.log('-'.repeat(40));

    const complete = sortedPackages.filter(p => p.coverage >= 80);
    const partial = sortedPackages.filter(p => p.coverage >= 50 && p.coverage < 80);
    const incomplete = sortedPackages.filter(p => p.coverage < 50);

    console.log(`🟢 Complete (≥80%): ${complete.length} packages`);
    if (showDetails && complete.length > 0) {
      console.log(`   ${complete.map(p => p.name).join(', ')}`);
    }

    console.log(`🟡 Partial (50-79%): ${partial.length} packages`);
    if (showDetails && partial.length > 0) {
      console.log(`   ${partial.map(p => p.name).join(', ')}`);
    }

    console.log(`🔴 Incomplete (<50%): ${incomplete.length} packages`);
    if (showDetails && incomplete.length > 0) {
      console.log(`   ${incomplete.map(p => p.name).join(', ')}`);
    }

    // YAML coverage
    console.log('\n📝 YAML DOCUMENTATION STATUS');
    console.log('-'.repeat(40));

    const withYaml = sortedPackages.filter(p => p.yamlFiles > 0);
    const withSettings = sortedPackages.filter(p => p.hasYamlSettings);

    console.log(
      `Packages with YAML: ${withYaml.length}/${this.currentReport.summary.totalPackages}`
    );
    console.log(
      `Packages with .md-settings: ${withSettings.length}/${this.currentReport.summary.totalPackages}`
    );

    const missingYaml = sortedPackages.filter(p => p.yamlFiles === 0 && p.totalElements > 0);
    if (missingYaml.length > 0) {
      console.log(`\n⚠️ Packages missing YAML documentation:`);
      missingYaml.forEach(p => {
        console.log(`   - ${p.name} (${p.totalElements} elements)`);
      });
    }

    // Outdated documentation summary
    const packagesWithOutdated = sortedPackages.filter(
      p => p.outdatedFiles && p.outdatedFiles.length > 0
    );
    if (packagesWithOutdated.length > 0) {
      console.log('\n⚠️ OUTDATED DOCUMENTATION');
      console.log('-'.repeat(40));
      console.log(`${packagesWithOutdated.length} packages have outdated YAML files:`);

      packagesWithOutdated.forEach(pkg => {
        const totalOutdated = pkg.outdatedFiles.length;
        const avgDays = Math.round(
          pkg.outdatedFiles.reduce((sum, f) => sum + f.daysBehind, 0) / totalOutdated
        );
        console.log(`   ${pkg.name}: ${totalOutdated} files (avg ${avgDays} days behind)`);
      });
    }
  }

  /**
   * Calculate hash of content
   */
  calculateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Load previous report
   */
  loadPreviousReport() {
    if (fs.existsSync(this.currentReportPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.currentReportPath, 'utf8'));
      } catch (e) {
        console.log('⚠️ Could not load previous report');
      }
    }
    return null;
  }

  /**
   * Save current report
   */
  saveCurrentReport() {
    // Move current to previous
    if (fs.existsSync(this.currentReportPath)) {
      fs.copyFileSync(this.currentReportPath, this.previousReportPath);
    }

    // Save new current
    fs.writeFileSync(this.currentReportPath, JSON.stringify(this.currentReport, null, 2));

    // Also save timestamped version
    const timestamp = this.currentReport.timestamp.replace(/[:.]/g, '-').slice(0, -5);
    const timestampPath = path.join(this.historyDir, `report-${timestamp}.json`);
    fs.writeFileSync(timestampPath, JSON.stringify(this.currentReport, null, 2));

    console.log(`\n💾 Report saved to:`);
    console.log(`   Current: ${this.currentReportPath}`);
    console.log(`   Archive: ${timestampPath}`);
  }

  /**
   * Helper methods from previous implementation
   */
  shouldHaveJSDoc(node) {
    if (!this.isExported(node)) {
      return false;
    }

    const relevantKinds = [
      ts.SyntaxKind.ClassDeclaration,
      ts.SyntaxKind.InterfaceDeclaration,
      ts.SyntaxKind.EnumDeclaration,
      ts.SyntaxKind.FunctionDeclaration,
      ts.SyntaxKind.MethodDeclaration,
      ts.SyntaxKind.MethodSignature,
      ts.SyntaxKind.Constructor,
      ts.SyntaxKind.PropertyDeclaration,
      ts.SyntaxKind.PropertySignature,
      ts.SyntaxKind.GetAccessor,
      ts.SyntaxKind.SetAccessor,
      ts.SyntaxKind.TypeAliasDeclaration,
    ];

    return relevantKinds.includes(node.kind);
  }

  hasJSDoc(node) {
    const jsDocNodes = ts.getJSDocCommentsAndTags(node);
    return jsDocNodes && jsDocNodes.length > 0;
  }

  isExported(node) {
    if (!node.modifiers) return false;
    return node.modifiers.some(
      m => m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DeclareKeyword
    );
  }

  getNodeName(node) {
    if (node.name) {
      return node.name.text || node.name.escapedText || 'anonymous';
    }
    if (node.kind === ts.SyntaxKind.Constructor) {
      return 'constructor';
    }
    return 'unnamed';
  }

  getNodeKindName(kind) {
    const kindMap = {
      [ts.SyntaxKind.ClassDeclaration]: 'class',
      [ts.SyntaxKind.InterfaceDeclaration]: 'interface',
      [ts.SyntaxKind.EnumDeclaration]: 'enum',
      [ts.SyntaxKind.FunctionDeclaration]: 'function',
      [ts.SyntaxKind.MethodDeclaration]: 'method',
      [ts.SyntaxKind.MethodSignature]: 'method',
      [ts.SyntaxKind.Constructor]: 'constructor',
      [ts.SyntaxKind.PropertyDeclaration]: 'property',
      [ts.SyntaxKind.PropertySignature]: 'property',
      [ts.SyntaxKind.GetAccessor]: 'getter',
      [ts.SyntaxKind.SetAccessor]: 'setter',
      [ts.SyntaxKind.TypeAliasDeclaration]: 'type',
    };
    return kindMap[kind] || 'unknown';
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    showDetails: !args.includes('--summary'),
    saveCurrent: !args.includes('--no-save'),
    compareWithPrevious: !args.includes('--no-compare'),
    checkOutdated: !args.includes('--no-outdated'),
  };

  // Handle specific commands
  if (args.includes('--help')) {
    console.log(`
JSDoc Coverage Monitor - Track documentation coverage and changes

Usage: node jsdoc-coverage-monitor.js [options]

Options:
  --summary         Show summary only, no details
  --no-save        Don't save the current report
  --no-compare     Don't compare with previous report
  --no-outdated    Don't check for outdated documentation
  --help           Show this help message

Examples:
  node jsdoc-coverage-monitor.js                    # Full report with all features
  node jsdoc-coverage-monitor.js --summary          # Summary report only
  node jsdoc-coverage-monitor.js --no-compare       # Current state only
`);
    process.exit(0);
  }

  const monitor = new JSDocCoverageMonitor();
  await monitor.analyze(options);
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { JSDocCoverageMonitor };
