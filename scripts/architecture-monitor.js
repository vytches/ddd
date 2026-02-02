#!/usr/bin/env node

/**
 * Architecture Monitoring Script
 * Validates architectural constraints and generates reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

class ArchitectureMonitor {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      circularDependencies: { status: 'pending', details: [] },
      moduleBoundaries: { status: 'pending', violations: [] },
      bundleSizes: { status: 'pending', packages: {} },
      layerCompliance: { status: 'pending', violations: [] },
      overallStatus: 'pending',
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  header(title) {
    console.log('');
    this.log(`${'='.repeat(60)}`, 'cyan');
    this.log(`  ${title}`, 'bold');
    this.log(`${'='.repeat(60)}`, 'cyan');
    console.log('');
  }

  /**
   * Check for circular dependencies between packages
   */
  checkCircularDependencies() {
    this.header('Checking Circular Dependencies');

    const criticalPackages = [
      'enterprise',
      'repositories',
      'testing',
      'contracts',
      'events',
      'domain-primitives',
      'value-objects',
      'aggregates',
    ];

    let hasCircular = false;
    const circularDetails = [];

    for (const pkg of criticalPackages) {
      const pkgPath = path.join('packages', pkg, 'src', 'index.ts');

      if (fs.existsSync(pkgPath)) {
        try {
          const output = execSync(`npx madge --circular "${pkgPath}" 2>&1`, {
            encoding: 'utf8',
            stdio: 'pipe',
          });

          if (output.includes('Found') && output.includes('circular')) {
            hasCircular = true;
            this.log(`  ❌ @vytches/ddd-${pkg}: Circular dependencies found!`, 'red');
            circularDetails.push({
              package: `@vytches/ddd-${pkg}`,
              status: 'failed',
              message: output.trim(),
            });
          } else {
            this.log(`  ✅ @vytches/ddd-${pkg}: No circular dependencies`, 'green');
            circularDetails.push({
              package: `@vytches/ddd-${pkg}`,
              status: 'passed',
            });
          }
        } catch (error) {
          this.log(`  ⚠️  @vytches/ddd-${pkg}: Check failed`, 'yellow');
          circularDetails.push({
            package: `@vytches/ddd-${pkg}`,
            status: 'error',
            error: error.message,
          });
        }
      }
    }

    this.results.circularDependencies = {
      status: hasCircular ? 'failed' : 'passed',
      details: circularDetails,
    };
  }

  /**
   * Validate module boundaries using dependency-cruiser
   */
  checkModuleBoundaries() {
    this.header('Validating Module Boundaries');

    if (!fs.existsSync('.dependency-cruiser.js')) {
      this.log('  ⚠️  Dependency cruiser configuration not found', 'yellow');
      this.results.moduleBoundaries = {
        status: 'skipped',
        message: 'Configuration file missing',
      };
      return;
    }

    try {
      const output = execSync(
        'npx dependency-cruiser packages/*/src --config .dependency-cruiser.js --output-type err 2>&1',
        { encoding: 'utf8', stdio: 'pipe' }
      );

      if (output.includes('error')) {
        this.log('  ❌ Module boundary violations detected!', 'red');
        const violations = output
          .split('\n')
          .filter(line => line.includes('error'))
          .map(line => line.trim());

        this.results.moduleBoundaries = {
          status: 'failed',
          violations,
        };
      } else {
        this.log('  ✅ All module boundaries are correctly enforced', 'green');
        this.results.moduleBoundaries = {
          status: 'passed',
          violations: [],
        };
      }
    } catch (error) {
      // dependency-cruiser exits with non-zero on violations
      const output = error.stdout || error.message;
      if (output.includes('error')) {
        this.log('  ❌ Module boundary violations detected!', 'red');
        const violations = output
          .split('\n')
          .filter(line => line.includes('error'))
          .slice(0, 10) // Limit to first 10 violations
          .map(line => line.trim());

        this.results.moduleBoundaries = {
          status: 'failed',
          violations,
        };
      }
    }
  }

  /**
   * Check bundle sizes
   */
  checkBundleSizes() {
    this.header('Checking Bundle Sizes');

    const criticalPackages = {
      '@vytches/ddd-enterprise': { maxSize: 5, currentSize: 0 },
      '@vytches/ddd-utils': { maxSize: 10, currentSize: 0 },
      '@vytches/ddd-contracts': { maxSize: 60, currentSize: 0 },
      '@vytches/ddd-domain-primitives': { maxSize: 50, currentSize: 0 },
    };

    try {
      // Run bundle size monitor
      const output = execSync('node scripts/quality-gates/bundle-size-monitor.js 2>&1', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      // Parse bundle sizes from output
      for (const [pkg, limits] of Object.entries(criticalPackages)) {
        const regex = new RegExp(`${pkg.replace('/', '\\/')}.*?(\\d+\\.\\d+)KB`, 'i');
        const match = output.match(regex);

        if (match) {
          limits.currentSize = parseFloat(match[1]);

          if (limits.currentSize > limits.maxSize) {
            this.log(
              `  ❌ ${pkg}: ${limits.currentSize}KB > ${limits.maxSize}KB (threshold exceeded)`,
              'red'
            );
          } else {
            this.log(`  ✅ ${pkg}: ${limits.currentSize}KB < ${limits.maxSize}KB`, 'green');
          }
        }
      }

      // Special check for enterprise package (meta-package)
      const enterpriseSize = criticalPackages['@vytches/ddd-enterprise']?.currentSize || 0;
      if (enterpriseSize > 5) {
        this.log('', 'reset');
        this.log(
          '  ⚠️  WARNING: Enterprise package size indicates potential circular dependencies!',
          'yellow'
        );
      }

      const allWithinLimits = Object.entries(criticalPackages).every(
        ([_, limits]) => limits.currentSize <= limits.maxSize
      );

      this.results.bundleSizes = {
        status: allWithinLimits ? 'passed' : 'failed',
        packages: criticalPackages,
      };
    } catch (error) {
      this.log('  ⚠️  Bundle size check failed', 'yellow');
      this.results.bundleSizes = {
        status: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Validate layer compliance
   */
  checkLayerCompliance() {
    this.header('Validating Layer Architecture');

    const layers = {
      foundation: ['contracts', 'utils', 'domain-primitives'],
      core: ['value-objects', 'testing', 'logging', 'validation'],
      domain: ['aggregates', 'repositories', 'events', 'domain-services'],
      application: ['cqrs', 'policies', 'messaging', 'projections'],
    };

    const violations = [];

    // Check foundation layer (should have minimal dependencies)
    this.log('  Checking Foundation Layer...', 'cyan');
    for (const pkg of layers.foundation) {
      const pkgJsonPath = path.join('packages', pkg, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const deps = Object.keys(pkgJson.dependencies || {}).filter(dep =>
          dep.startsWith('@vytches/ddd-')
        );

        // Special cases for foundation layer
        if (pkg === 'contracts' && deps.length === 1 && deps[0] === '@vytches/ddd-utils') {
          this.log(`    ✅ ${pkg}: Allowed dependency on utils`, 'green');
        } else if (pkg === 'utils' && deps.length === 1 && deps[0] === '@vytches/ddd-contracts') {
          this.log(`    ✅ ${pkg}: Allowed dependency on contracts`, 'green');
        } else if (
          pkg === 'domain-primitives' &&
          deps.every(d => ['@vytches/ddd-contracts', '@vytches/ddd-utils'].includes(d))
        ) {
          this.log(`    ✅ ${pkg}: Allowed foundation dependencies`, 'green');
        } else if (deps.length > 0 && !['utils', 'contracts', 'domain-primitives'].includes(pkg)) {
          this.log(`    ❌ ${pkg}: Unexpected dependencies: ${deps.join(', ')}`, 'red');
          violations.push(`${pkg} has unexpected dependencies: ${deps.join(', ')}`);
        } else if (deps.length === 0) {
          this.log(`    ✅ ${pkg}: No internal dependencies`, 'green');
        } else {
          this.log(`    ✅ ${pkg}: Clean`, 'green');
        }
      }
    }

    // Check core layer (should only depend on foundation)
    this.log('  Checking Core Layer...', 'cyan');
    const allowedForCore = [...layers.foundation];
    for (const pkg of layers.core) {
      const pkgJsonPath = path.join('packages', pkg, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const deps = Object.keys(pkgJson.dependencies || {})
          .filter(dep => dep.startsWith('@vytches/ddd-'))
          .map(dep => dep.replace('@vytches/ddd-', ''));

        const invalidDeps = deps.filter(dep => !allowedForCore.includes(dep));
        if (invalidDeps.length > 0) {
          this.log(`    ❌ ${pkg}: Depends on higher layers: ${invalidDeps.join(', ')}`, 'red');
          violations.push(`${pkg} depends on higher layers: ${invalidDeps.join(', ')}`);
        } else {
          this.log(`    ✅ ${pkg}: Correct dependencies`, 'green');
        }
      }
    }

    this.results.layerCompliance = {
      status: violations.length === 0 ? 'passed' : 'failed',
      violations,
    };
  }

  /**
   * Generate summary report
   */
  generateSummary() {
    this.header('Architecture Validation Summary');

    const statuses = [
      this.results.circularDependencies.status,
      this.results.moduleBoundaries.status,
      this.results.bundleSizes.status,
      this.results.layerCompliance.status,
    ];

    const hasFailure = statuses.includes('failed');
    const hasError = statuses.includes('error');

    this.results.overallStatus = hasFailure ? 'failed' : hasError ? 'warning' : 'passed';

    // Display results
    const statusIcon = status => {
      switch (status) {
        case 'passed':
          return '✅';
        case 'failed':
          return '❌';
        case 'warning':
        case 'error':
          return '⚠️';
        case 'skipped':
          return '⏭️';
        default:
          return '❓';
      }
    };

    console.log('');
    this.log(
      `  Circular Dependencies:  ${statusIcon(this.results.circularDependencies.status)} ${this.results.circularDependencies.status.toUpperCase()}`,
      this.results.circularDependencies.status === 'passed' ? 'green' : 'red'
    );
    this.log(
      `  Module Boundaries:      ${statusIcon(this.results.moduleBoundaries.status)} ${this.results.moduleBoundaries.status.toUpperCase()}`,
      this.results.moduleBoundaries.status === 'passed' ? 'green' : 'red'
    );
    this.log(
      `  Bundle Sizes:           ${statusIcon(this.results.bundleSizes.status)} ${this.results.bundleSizes.status.toUpperCase()}`,
      this.results.bundleSizes.status === 'passed' ? 'green' : 'red'
    );
    this.log(
      `  Layer Compliance:       ${statusIcon(this.results.layerCompliance.status)} ${this.results.layerCompliance.status.toUpperCase()}`,
      this.results.layerCompliance.status === 'passed' ? 'green' : 'red'
    );

    console.log('');
    this.log(
      `  Overall Status:         ${statusIcon(this.results.overallStatus)} ${this.results.overallStatus.toUpperCase()}`,
      this.results.overallStatus === 'passed'
        ? 'green'
        : this.results.overallStatus === 'warning'
          ? 'yellow'
          : 'red'
    );

    // Save report to file
    const reportPath = path.join('architecture-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    console.log('');
    this.log(`  📄 Full report saved to: ${reportPath}`, 'cyan');

    // Exit with appropriate code
    if (this.results.overallStatus === 'failed') {
      console.log('');
      this.log('  ❌ Architecture validation failed! See report for details.', 'red');
      this.log('  📖 Refer to ADR-0021 for architectural guidelines.', 'yellow');
      process.exit(1);
    } else if (this.results.overallStatus === 'warning') {
      console.log('');
      this.log('  ⚠️  Architecture validation completed with warnings.', 'yellow');
    } else {
      console.log('');
      this.log('  ✅ Architecture validation passed!', 'green');
    }
  }

  /**
   * Run all checks
   */
  async run() {
    this.log('🏗️  VytchesDDD Architecture Monitor', 'bold');
    this.log(`📅 ${new Date().toLocaleString()}`, 'cyan');

    this.checkCircularDependencies();
    this.checkModuleBoundaries();
    this.checkBundleSizes();
    this.checkLayerCompliance();
    this.generateSummary();
  }
}

// Run if called directly
if (require.main === module) {
  const monitor = new ArchitectureMonitor();
  monitor.run().catch(error => {
    console.error('Architecture monitoring failed:', error);
    process.exit(1);
  });
}

module.exports = ArchitectureMonitor;
