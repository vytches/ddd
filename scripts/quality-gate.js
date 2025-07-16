#!/usr/bin/env node

/**
 * Quality Gate Automation for JSDoc
 * Automated quality assurance system for VytchesDDD documentation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class QualityGate {
  constructor() {
    this.projectRoot = process.cwd();
    this.reportPath = path.join(this.projectRoot, 'docs', 'quality-report.json');
    this.thresholds = {
      coverage: 50.0, // Minimum JSDoc coverage percentage
      maxErrors: 200, // Maximum allowed linting errors
      maxWarnings: 300, // Maximum allowed linting warnings
      requiredFiles: 250, // Minimum documented files
    };
  }

  /**
   * Main quality gate execution
   */
  async execute() {
    console.log('🚪 VytchesDDD Quality Gate - JSDoc Documentation');
    console.log('==================================================\n');

    try {
      // Step 1: Run JSDoc validation
      console.log('1️⃣ Running JSDoc validation...');
      const validationResult = await this.runJSDocValidation();

      // Step 2: Run JSDoc linting
      console.log('2️⃣ Running JSDoc linting...');
      const lintingResult = await this.runJSDocLinting();

      // Step 3: Check documentation publication
      console.log('3️⃣ Checking documentation publication...');
      const publicationResult = await this.checkDocumentationPublication();

      // Step 4: Generate quality report
      console.log('4️⃣ Generating quality report...');
      const qualityReport = await this.generateQualityReport({
        validation: validationResult,
        linting: lintingResult,
        publication: publicationResult,
      });

      // Step 5: Apply quality gates
      console.log('5️⃣ Applying quality gates...');
      const gateResult = await this.applyQualityGates(qualityReport);

      // Step 6: Output results
      this.outputResults(gateResult);

      // Exit with appropriate code
      process.exit(gateResult.passed ? 0 : 1);
    } catch (error) {
      console.error('❌ Quality gate execution failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run JSDoc validation
   */
  async runJSDocValidation() {
    try {
      const output = execSync('pnpm jsdoc:validate', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      // Parse validation output
      const coverageMatch = output.match(/Documented exports: (\d+) \((\d+\.\d+)%\)/);
      const filesMatch = output.match(/Documented files: (\d+) \((\d+\.\d+)%\)/);
      const totalExportsMatch = output.match(/Total exports: (\d+)/);
      const totalFilesMatch = output.match(/Total files: (\d+)/);

      return {
        success: true,
        coverage: coverageMatch ? parseFloat(coverageMatch[2]) : 0,
        documentedExports: coverageMatch ? parseInt(coverageMatch[1]) : 0,
        totalExports: totalExportsMatch ? parseInt(totalExportsMatch[1]) : 0,
        documentedFiles: filesMatch ? parseInt(filesMatch[1]) : 0,
        totalFiles: totalFilesMatch ? parseInt(totalFilesMatch[1]) : 0,
        output: output,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        coverage: 0,
        documentedExports: 0,
        totalExports: 0,
        documentedFiles: 0,
        totalFiles: 0,
      };
    }
  }

  /**
   * Run JSDoc linting
   */
  async runJSDocLinting() {
    try {
      const output = execSync('pnpm jsdoc:lint', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      return {
        success: true,
        errors: 0,
        warnings: 0,
        output: output,
      };
    } catch (error) {
      // Parse ESLint output for error/warning counts
      const errorMatch = error.stdout?.match(/(\d+) problems \((\d+) errors, (\d+) warnings\)/);

      return {
        success: false,
        errors: errorMatch ? parseInt(errorMatch[2]) : 0,
        warnings: errorMatch ? parseInt(errorMatch[3]) : 0,
        problems: errorMatch ? parseInt(errorMatch[1]) : 0,
        output: error.stdout || error.message,
      };
    }
  }

  /**
   * Check documentation publication
   */
  async checkDocumentationPublication() {
    try {
      const docsPath = path.join(this.projectRoot, 'docs', 'api');
      const indexPath = path.join(docsPath, 'index.html');

      if (!fs.existsSync(indexPath)) {
        return {
          success: false,
          error: 'Documentation index.html not found',
        };
      }

      // Count package documentation files
      const packageDirs = fs
        .readdirSync(docsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      const packageDocs = packageDirs.map(pkg => {
        const pkgIndexPath = path.join(docsPath, pkg, 'index.html');
        return {
          package: pkg,
          exists: fs.existsSync(pkgIndexPath),
          size: fs.existsSync(pkgIndexPath) ? fs.statSync(pkgIndexPath).size : 0,
        };
      });

      return {
        success: true,
        packagesDocumented: packageDocs.filter(pkg => pkg.exists).length,
        totalPackages: packageDocs.length,
        packageDocs: packageDocs,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate comprehensive quality report
   */
  async generateQualityReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      validation: results.validation,
      linting: results.linting,
      publication: results.publication,
      summary: {
        overallScore: 0,
        coverageScore: 0,
        qualityScore: 0,
        publicationScore: 0,
      },
    };

    // Calculate scores
    report.summary.coverageScore = Math.min(
      100,
      (results.validation.coverage / this.thresholds.coverage) * 100
    );
    report.summary.qualityScore = Math.max(
      0,
      100 - (results.linting.errors / this.thresholds.maxErrors) * 100
    );
    report.summary.publicationScore = results.publication.success ? 100 : 0;

    report.summary.overallScore =
      report.summary.coverageScore * 0.5 +
      report.summary.qualityScore * 0.3 +
      report.summary.publicationScore * 0.2;

    // Save report
    fs.mkdirSync(path.dirname(this.reportPath), { recursive: true });
    fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Apply quality gates
   */
  async applyQualityGates(report) {
    const results = {
      passed: true,
      failures: [],
      warnings: [],
    };

    // Gate 1: Coverage threshold
    if (report.validation.coverage < this.thresholds.coverage) {
      results.failures.push({
        gate: 'Coverage',
        message: `JSDoc coverage ${report.validation.coverage}% is below threshold ${this.thresholds.coverage}%`,
        severity: 'error',
      });
      results.passed = false;
    }

    // Gate 2: Linting errors
    if (report.linting.errors > this.thresholds.maxErrors) {
      results.failures.push({
        gate: 'Linting',
        message: `${report.linting.errors} linting errors exceed threshold ${this.thresholds.maxErrors}`,
        severity: 'error',
      });
      results.passed = false;
    }

    // Gate 3: Documentation publication
    if (!report.publication.success) {
      results.failures.push({
        gate: 'Publication',
        message: `Documentation publication failed: ${report.publication.error}`,
        severity: 'error',
      });
      results.passed = false;
    }

    // Gate 4: Minimum documented files
    if (report.validation.documentedFiles < this.thresholds.requiredFiles) {
      results.failures.push({
        gate: 'Files',
        message: `${report.validation.documentedFiles} documented files below threshold ${this.thresholds.requiredFiles}`,
        severity: 'error',
      });
      results.passed = false;
    }

    // Warnings
    if (report.linting.warnings > this.thresholds.maxWarnings) {
      results.warnings.push({
        gate: 'Warnings',
        message: `${report.linting.warnings} linting warnings exceed threshold ${this.thresholds.maxWarnings}`,
        severity: 'warning',
      });
    }

    return results;
  }

  /**
   * Output results
   */
  outputResults(results) {
    console.log('\n🎯 Quality Gate Results');
    console.log('=======================\n');

    if (results.passed) {
      console.log('✅ ALL QUALITY GATES PASSED');
      console.log('📊 Documentation quality meets enterprise standards');
    } else {
      console.log('❌ QUALITY GATES FAILED');
      console.log('📊 Documentation quality needs improvement');
    }

    // Show failures
    if (results.failures.length > 0) {
      console.log('\n🚨 Gate Failures:');
      results.failures.forEach(failure => {
        console.log(`   ❌ ${failure.gate}: ${failure.message}`);
      });
    }

    // Show warnings
    if (results.warnings.length > 0) {
      console.log('\n⚠️  Gate Warnings:');
      results.warnings.forEach(warning => {
        console.log(`   ⚠️  ${warning.gate}: ${warning.message}`);
      });
    }

    console.log(`\n📋 Full report: ${this.reportPath}`);
    console.log('🔧 Run: pnpm jsdoc:validate to see detailed status');
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Quality Gate Automation for JSDoc

Usage:
  node scripts/quality-gate.js [options]

Options:
  --help, -h     Show this help message

Examples:
  node scripts/quality-gate.js
  pnpm quality:gate
    `);
    process.exit(0);
  }

  const gate = new QualityGate();
  gate.execute();
}

module.exports = QualityGate;
