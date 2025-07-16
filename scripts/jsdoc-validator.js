#!/usr/bin/env node

/**
 * JSDoc Validator for VytchesDDD
 * Validates JSDoc compliance across all packages
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class JSDocValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.stats = {
      totalFiles: 0,
      documentedFiles: 0,
      totalExports: 0,
      documentedExports: 0,
      missingLLMTags: 0,
      missingExamples: 0,
    };
  }

  /**
   * Main validation method
   */
  async validateProject() {
    console.log('🔍 Validating JSDoc compliance across VytchesDDD packages...\n');

    const packages = this.getPackages();

    for (const pkg of packages) {
      await this.validatePackage(pkg);
    }

    this.generateReport();
  }

  /**
   * Get all packages to validate
   */
  getPackages() {
    const packagesDir = path.join(process.cwd(), 'packages');
    return fs
      .readdirSync(packagesDir)
      .filter(dir => {
        const packagePath = path.join(packagesDir, dir);
        return (
          fs.statSync(packagePath).isDirectory() &&
          fs.existsSync(path.join(packagePath, 'package.json'))
        );
      })
      .map(dir => ({
        name: dir,
        path: path.join(packagesDir, dir),
        srcPath: path.join(packagesDir, dir, 'src'),
      }));
  }

  /**
   * Validate a single package
   */
  async validatePackage(pkg) {
    console.log(`📦 Validating ${pkg.name}...`);

    if (!fs.existsSync(pkg.srcPath)) {
      this.warnings.push(`Package ${pkg.name} has no src directory`);
      return;
    }

    const files = this.getTypeScriptFiles(pkg.srcPath);

    for (const file of files) {
      await this.validateFile(file, pkg.name);
    }

    console.log(`   ✓ ${pkg.name} validated`);
  }

  /**
   * Get all TypeScript files in a directory
   */
  getTypeScriptFiles(dir) {
    const files = [];

    function walk(currentDir) {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && item !== 'node_modules' && item !== 'tests') {
          walk(fullPath);
        } else if (stat.isFile() && item.endsWith('.ts') && !item.endsWith('.test.ts')) {
          files.push(fullPath);
        }
      }
    }

    walk(dir);
    return files;
  }

  /**
   * Validate a single TypeScript file
   */
  async validateFile(filePath, packageName) {
    this.stats.totalFiles++;

    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    // Check for exports
    const exports = this.extractExports(content);
    this.stats.totalExports += exports.length;

    // Check JSDoc coverage
    const jsdocBlocks = this.extractJSDocBlocks(content);
    const hasJSDoc = jsdocBlocks.length > 0;

    if (hasJSDoc) {
      this.stats.documentedFiles++;
    }

    // Validate each export
    for (const exp of exports) {
      this.validateExport(exp, jsdocBlocks, relativePath, packageName);
    }

    // Validate JSDoc blocks
    for (const block of jsdocBlocks) {
      this.validateJSDocBlock(block, relativePath, packageName);
    }
  }

  /**
   * Extract exports from TypeScript content
   */
  extractExports(content) {
    const exports = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Export declarations
      if (line.startsWith('export ')) {
        const exportMatch = line.match(
          /export\s+(class|interface|function|enum|type|const)\s+(\w+)/
        );
        if (exportMatch) {
          exports.push({
            type: exportMatch[1],
            name: exportMatch[2],
            line: i + 1,
            hasJSDoc: this.hasJSDocAbove(lines, i),
          });
        }
      }
    }

    return exports;
  }

  /**
   * Check if there's JSDoc above a line
   */
  hasJSDocAbove(lines, lineIndex) {
    for (let i = lineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '*/') {
        return true;
      }
      if (line && !line.startsWith('*') && !line.startsWith('//')) {
        return false;
      }
    }
    return false;
  }

  /**
   * Extract JSDoc blocks from content
   */
  extractJSDocBlocks(content) {
    const blocks = [];
    const jsdocRegex = /\/\*\*([\s\S]*?)\*\//g;
    let match;

    while ((match = jsdocRegex.exec(content)) !== null) {
      blocks.push({
        content: match[1],
        fullBlock: match[0],
        start: match.index,
      });
    }

    return blocks;
  }

  /**
   * Validate an export
   */
  validateExport(exp, jsdocBlocks, filePath, packageName) {
    this.stats.totalExports++;

    if (!exp.hasJSDoc) {
      this.errors.push({
        type: 'missing_jsdoc',
        file: filePath,
        package: packageName,
        export: exp.name,
        line: exp.line,
        message: `Export '${exp.name}' is missing JSDoc documentation`,
      });
    } else {
      this.stats.documentedExports++;
    }
  }

  /**
   * Validate a JSDoc block
   */
  validateJSDocBlock(block, filePath, packageName) {
    const content = block.content;

    // Check for LLM tags
    const hasLLMSummary = content.includes('@llm-summary');
    const hasLLMDomain = content.includes('@llm-domain');

    if (!hasLLMSummary) {
      this.stats.missingLLMTags++;
      this.warnings.push({
        type: 'missing_llm_tag',
        file: filePath,
        package: packageName,
        message: 'JSDoc block missing @llm-summary tag',
      });
    }

    if (!hasLLMDomain) {
      this.stats.missingLLMTags++;
      this.warnings.push({
        type: 'missing_llm_tag',
        file: filePath,
        package: packageName,
        message: 'JSDoc block missing @llm-domain tag',
      });
    }

    // Check for examples
    const hasExample = content.includes('@example');
    if (!hasExample) {
      this.stats.missingExamples++;
      this.warnings.push({
        type: 'missing_example',
        file: filePath,
        package: packageName,
        message: 'JSDoc block missing @example',
      });
    }
  }

  /**
   * Calculate quality score for JSDoc
   */
  calculateQualityScore(block) {
    let score = 0;
    const content = block.content;

    // Basic JSDoc presence (30 points)
    score += 30;

    // LLM tags (30 points)
    if (content.includes('@llm-summary')) score += 10;
    if (content.includes('@llm-domain')) score += 10;
    if (content.includes('@llm-complexity')) score += 10;

    // Examples (20 points)
    const exampleMatches = content.match(/@example/g);
    if (exampleMatches) {
      if (exampleMatches.length >= 2) {
        score += 20;
      } else {
        score += 10;
      }
    }

    // Description quality (10 points)
    if (content.includes('@description') && content.length > 200) {
      score += 10;
    } else if (content.includes('@description')) {
      score += 5;
    }

    // Parameter documentation (10 points)
    if (content.includes('@param')) score += 5;
    if (content.includes('@returns')) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Generate validation report with enhanced quality analysis
   */
  generateReport() {
    console.log('\\n📊 JSDoc Validation Report');
    console.log('='.repeat(50));

    // Enhanced statistics with quality scoring
    console.log('\\n📈 Statistics:');
    console.log(`Total files: ${this.stats.totalFiles}`);
    console.log(
      `Documented files: ${this.stats.documentedFiles} (${((this.stats.documentedFiles / this.stats.totalFiles) * 100).toFixed(1)}%)`
    );
    console.log(`Total exports: ${this.stats.totalExports}`);
    console.log(
      `Documented exports: ${this.stats.documentedExports} (${((this.stats.documentedExports / this.stats.totalExports) * 100).toFixed(1)}%)`
    );
    console.log(`Missing LLM tags: ${this.stats.missingLLMTags}`);
    console.log(`Missing examples: ${this.stats.missingExamples}`);

    // Quality scoring and progress estimation
    console.log('\\n🏆 Quality Analysis:');
    const coveragePercent = (this.stats.documentedExports / this.stats.totalExports) * 100;
    const targetCoverage = 95;
    const remaining = Math.max(0, this.stats.totalExports - this.stats.documentedExports);
    const estimatedGeneration = Math.floor(remaining * 0.8); // 80% automation
    const estimatedManual = remaining - estimatedGeneration;

    console.log(
      `📊 Current coverage: ${coveragePercent.toFixed(1)}% (${this.stats.documentedExports}/${this.stats.totalExports})`
    );
    console.log(
      `🎯 Target coverage: ${targetCoverage}% (${Math.ceil((this.stats.totalExports * targetCoverage) / 100)} exports)`
    );
    console.log(`📝 Remaining exports: ${remaining}`);
    console.log(`🤖 Estimated auto-generation: ${estimatedGeneration} exports (80%)`);
    console.log(`✋ Estimated manual work: ${estimatedManual} exports (20%)`);

    // Progress recommendations
    console.log('\\n💡 Next Steps:');
    if (coveragePercent < 50) {
      console.log(
        `🚀 Run generator on core packages: pnpm jsdoc:generate contracts domain-primitives value-objects`
      );
    } else if (coveragePercent < 80) {
      console.log(
        `📦 Continue with pattern packages: pnpm jsdoc:generate repositories aggregates events`
      );
    } else {
      console.log(`🔧 Focus on manual enhancement and quality improvement`);
    }

    // Errors
    if (this.errors.length > 0) {
      console.log('\\n❌ Errors:');
      this.errors.slice(0, 20).forEach(error => {
        console.log(`  ${error.file}:${error.line || '?'} - ${error.message}`);
      });

      if (this.errors.length > 20) {
        console.log(`  ... and ${this.errors.length - 20} more errors`);
      }
    }

    // Warnings (limited for readability)
    if (this.warnings.length > 0) {
      console.log('\\n⚠️  Warnings:');
      this.warnings.slice(0, 10).forEach(warning => {
        console.log(`  ${warning.file} - ${warning.message}`);
      });

      if (this.warnings.length > 10) {
        console.log(`  ... and ${this.warnings.length - 10} more warnings`);
      }
    }

    // Summary
    console.log('\\n🎯 Summary:');
    if (coveragePercent >= 95) {
      console.log(
        `✅ JSDoc coverage: ${coveragePercent.toFixed(1)}% - Excellent! Enterprise-ready 🏆`
      );
    } else if (coveragePercent >= 80) {
      console.log(
        `⚠️  JSDoc coverage: ${coveragePercent.toFixed(1)}% - Good progress, approaching enterprise standards`
      );
    } else if (coveragePercent >= 50) {
      console.log(
        `📈 JSDoc coverage: ${coveragePercent.toFixed(1)}% - Good foundation, continue generation`
      );
    } else {
      console.log(
        `🚀 JSDoc coverage: ${coveragePercent.toFixed(1)}% - Early stage, automation will help significantly`
      );
    }

    // Exit code
    if (this.errors.length > 0) {
      console.log('\\n💥 Validation failed due to errors');
      process.exit(1);
    } else {
      console.log('\\n✅ Validation completed successfully');
    }
  }
}

// Run validator
if (require.main === module) {
  const validator = new JSDocValidator();
  validator.validateProject().catch(console.error);
}

module.exports = JSDocValidator;
