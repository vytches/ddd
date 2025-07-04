#!/usr/bin/env node

/**
 * Pre-commit Quality Gates Hook
 * 
 * Lightweight quality validation that runs before commits.
 * Focuses on fast checks to prevent obvious quality regressions.
 * 
 * Features:
 * - Fast any type detection in changed files
 * - Bundle size estimation for modified packages
 * - Basic type checking on staged files
 * - Configurable rules with bypass options
 * - Integration with git hooks
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PreCommitQualityGates {
  constructor(options = {}) {
    this.options = {
      skipAnyCheck: false,
      skipTypeCheck: false,
      skipBundleCheck: false,
      allowBypass: true,
      verbose: false,
      ...options
    };
    
    this.changedFiles = this.getStagedFiles();
    this.results = {
      anyTypeViolations: [],
      typeErrors: [],
      bundleWarnings: [],
      passed: true
    };
  }

  /**
   * Get staged files from git
   */
  getStagedFiles() {
    try {
      const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
      return output.trim().split('\n').filter(file => file.length > 0);
    } catch (error) {
      if (this.options.verbose) {
        console.warn('Could not get staged files:', error.message);
      }
      return [];
    }
  }

  /**
   * Check for bypass flags in commit message
   */
  checkBypass() {
    if (!this.options.allowBypass) {
      return false;
    }

    try {
      // Check if there's a commit message file (git hook context)
      const commitMsgFile = process.env.GIT_PARAMS || '.git/COMMIT_EDITMSG';
      
      if (fs.existsSync(commitMsgFile)) {
        const commitMsg = fs.readFileSync(commitMsgFile, 'utf8');
        
        // Look for bypass flags
        const bypassFlags = [
          '--skip-quality',
          '--no-quality',
          '[skip quality]',
          '[quality skip]'
        ];
        
        return bypassFlags.some(flag => commitMsg.includes(flag));
      }
    } catch (error) {
      // Silently fail
    }
    
    return false;
  }

  /**
   * Check for new any types in staged files
   */
  checkAnyTypes() {
    if (this.options.skipAnyCheck) {
      return;
    }

    const tsFiles = this.changedFiles.filter(file => 
      file.endsWith('.ts') && 
      !file.includes('.test.') && 
      !file.includes('.spec.') &&
      !file.includes('.d.ts')
    );

    for (const file of tsFiles) {
      if (!fs.existsSync(file)) {
        continue; // File might be deleted
      }

      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNumber = i + 1;
          
          // Look for any type usage (simple regex)
          const anyMatches = line.match(/\bany\b/g);
          
          if (anyMatches && !this.isLineCommented(line)) {
            // Check if this might be justified
            if (!this.isJustifiedAnyUsage(line, file)) {
              this.results.anyTypeViolations.push({
                file,
                line: lineNumber,
                content: line.trim(),
                message: 'New `any` type usage detected'
              });
            }
          }
        }
      } catch (error) {
        if (this.options.verbose) {
          console.warn(`Could not check ${file}:`, error.message);
        }
      }
    }
  }

  /**
   * Check if line is commented
   */
  isLineCommented(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.includes('*');
  }

  /**
   * Check if any usage might be justified
   */
  isJustifiedAnyUsage(line, file) {
    // Check for decorator patterns
    if (/target:\s*any|propertyKey:\s*any|descriptor:\s*any/.test(line)) {
      return true;
    }

    // Check for constructor patterns
    if (/constructor\(.*args:\s*any\[\]/.test(line)) {
      return true;
    }

    // Check for type utilities
    if (/Record<.*,\s*any>|\[.*\]:\s*any/.test(line)) {
      return true;
    }

    // Check file patterns
    if (/decorators|infrastructure|adapters/.test(file)) {
      return true;
    }

    return false;
  }

  /**
   * Run basic type checking on changed TypeScript files
   */
  checkTypes() {
    if (this.options.skipTypeCheck) {
      return;
    }

    const tsFiles = this.changedFiles.filter(file => 
      file.endsWith('.ts') && 
      !file.includes('.test.') && 
      !file.includes('.spec.')
    );

    if (tsFiles.length === 0) {
      return;
    }

    try {
      // Run tsc on specific files for quick check
      const filesArg = tsFiles.join(' ');
      execSync(`npx tsc --noEmit --skipLibCheck ${filesArg}`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (error) {
      // Parse TypeScript errors
      const output = error.stdout || error.stderr || '';
      const errorLines = output.split('\n').filter(line => line.includes('error TS'));
      
      for (const errorLine of errorLines) {
        this.results.typeErrors.push({
          message: errorLine.trim(),
          type: 'typescript'
        });
      }
    }
  }

  /**
   * Check bundle size impact of changes
   */
  checkBundleImpact() {
    if (this.options.skipBundleCheck) {
      return;
    }

    // Get modified packages
    const modifiedPackages = new Set();
    
    for (const file of this.changedFiles) {
      const packageMatch = file.match(/^packages\/([^\/]+)/);
      if (packageMatch) {
        modifiedPackages.add(packageMatch[1]);
      }
    }

    // Check if any files are suspiciously large
    for (const file of this.changedFiles) {
      if (!file.endsWith('.ts') || file.includes('.test.') || file.includes('.spec.')) {
        continue;
      }

      try {
        const stats = fs.statSync(file);
        const sizeKB = Math.round(stats.size / 1024);
        
        if (sizeKB > 50) { // Files larger than 50KB
          this.results.bundleWarnings.push({
            file,
            size: sizeKB,
            message: `Large file detected (${sizeKB}KB) - consider splitting`
          });
        }
      } catch (error) {
        // File might be deleted, ignore
      }
    }

    // Warn about core package modifications
    if (modifiedPackages.has('core')) {
      this.results.bundleWarnings.push({
        package: 'core',
        message: 'Core package modified - ensure meta-package pattern is maintained'
      });
    }
  }

  /**
   * Run all quality checks
   */
  async run() {
    if (this.changedFiles.length === 0) {
      if (this.options.verbose) {
        console.log('✅ No staged files to check');
      }
      return true;
    }

    // Check for bypass
    if (this.checkBypass()) {
      console.log('⚠️  Quality gates bypassed via commit message');
      return true;
    }

    if (this.options.verbose) {
      console.log(`🔍 Checking ${this.changedFiles.length} staged files...`);
    }

    // Run checks
    this.checkAnyTypes();
    this.checkTypes();
    this.checkBundleImpact();

    // Determine overall result
    this.results.passed = 
      this.results.anyTypeViolations.length === 0 &&
      this.results.typeErrors.length === 0;

    return this.results.passed;
  }

  /**
   * Generate report
   */
  generateReport() {
    let report = '';

    if (this.results.passed) {
      report += '✅ Pre-commit quality gates passed\n';
    } else {
      report += '❌ Pre-commit quality gates failed\n\n';
    }

    // Any type violations
    if (this.results.anyTypeViolations.length > 0) {
      report += '🚨 New `any` type usage detected:\n';
      for (const violation of this.results.anyTypeViolations) {
        report += `   ${violation.file}:${violation.line} - ${violation.message}\n`;
        report += `     ${violation.content}\n`;
      }
      report += '\n';
    }

    // Type errors
    if (this.results.typeErrors.length > 0) {
      report += '🚨 TypeScript errors:\n';
      for (const error of this.results.typeErrors.slice(0, 5)) { // Limit to first 5
        report += `   ${error.message}\n`;
      }
      if (this.results.typeErrors.length > 5) {
        report += `   ... and ${this.results.typeErrors.length - 5} more errors\n`;
      }
      report += '\n';
    }

    // Bundle warnings
    if (this.results.bundleWarnings.length > 0) {
      report += '⚠️  Bundle warnings:\n';
      for (const warning of this.results.bundleWarnings) {
        if (warning.file) {
          report += `   ${warning.file} (${warning.size}KB) - ${warning.message}\n`;
        } else {
          report += `   ${warning.package || 'Package'} - ${warning.message}\n`;
        }
      }
      report += '\n';
    }

    // Help message
    if (!this.results.passed) {
      report += '💡 To bypass these checks, include --skip-quality in your commit message\n';
      report += '🔧 To fix any types, consider using more specific types or unknown\n';
      report += '📝 For type errors, run: pnpm type-check\n';
    }

    return report;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const skipAny = args.includes('--skip-any');
  const skipType = args.includes('--skip-type');
  const skipBundle = args.includes('--skip-bundle');

  const qualityGates = new PreCommitQualityGates({
    verbose,
    skipAnyCheck: skipAny,
    skipTypeCheck: skipType,
    skipBundleCheck: skipBundle
  });

  try {
    const passed = await qualityGates.run();
    const report = qualityGates.generateReport();
    
    console.log(report);
    
    if (!passed) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error in pre-commit quality gates:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PreCommitQualityGates };