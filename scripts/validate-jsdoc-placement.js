#!/usr/bin/env node

/**
 * JSDoc Placement Validation Script
 * Validates JSDoc placement configuration and provides migration recommendations
 */

const fs = require('fs').promises;
const path = require('path');
const { globSync } = require('glob');
const matter = require('gray-matter');

class JSDocPlacementValidator {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.errors = [];
    this.warnings = [];
    this.recommendations = [];
  }

  /**
   * Validate placement configuration
   */
  validatePlacementConfig(config, context = 'unknown') {
    const validStrategies = ['separate', 'constructor-only', 'class-only', 'smart'];
    const validContentStrategies = ['distinct', 'shared', 'primary-secondary'];
    const validStates = ['enabled', 'disabled', 'auto'];

    // Validate placement-strategy
    if (config['placement-strategy'] && !validStrategies.includes(config['placement-strategy'])) {
      this.errors.push({
        context,
        type: 'invalid-placement-strategy',
        message: `Invalid placement-strategy: ${config['placement-strategy']}`,
        fix: `Use one of: ${validStrategies.join(', ')}`,
      });
    }

    // Validate content-strategy
    if (
      config['content-strategy'] &&
      !validContentStrategies.includes(config['content-strategy'])
    ) {
      this.errors.push({
        context,
        type: 'invalid-content-strategy',
        message: `Invalid content-strategy: ${config['content-strategy']}`,
        fix: `Use one of: ${validContentStrategies.join(', ')}`,
      });
    }

    // Validate documentation states
    ['class-documentation', 'constructor-documentation'].forEach(key => {
      if (config[key] && !validStates.includes(config[key])) {
        this.errors.push({
          context,
          type: 'invalid-documentation-state',
          message: `Invalid ${key}: ${config[key]}`,
          fix: `Use one of: ${validStates.join(', ')}`,
        });
      }
    });

    // Validate strategy conflicts
    if (
      config['placement-strategy'] === 'class-only' &&
      config['constructor-documentation'] === 'enabled'
    ) {
      this.errors.push({
        context,
        type: 'strategy-conflict',
        message: 'class-only strategy conflicts with enabled constructor-documentation',
        fix: 'Set constructor-documentation to "disabled" or change placement-strategy',
      });
    }

    if (
      config['placement-strategy'] === 'constructor-only' &&
      config['class-documentation'] === 'enabled'
    ) {
      this.warnings.push({
        context,
        type: 'potential-conflict',
        message: 'constructor-only strategy with enabled class-documentation may cause issues',
        recommendation:
          'Consider using "separate" strategy for both class and constructor documentation',
      });
    }
  }

  /**
   * Analyze class metadata for placement optimization
   */
  analyzeClassMetadata(className, metadata) {
    const analysis = {
      hasClassDoc: !!metadata.classes?.[className]?.['class-doc'],
      hasConstructorMethod:
        !!metadata.classes?.[className]?.methods?.constructor || !!metadata.methods?.constructor,
      hasMethodSpecificTags: false,
      hasClassSpecificTags: false,
      contentAnalysis: 'neutral',
    };

    // Check for method-specific tags in class metadata
    const classData = metadata.classes?.[className] || metadata;
    const methodTags = [
      'parameters',
      'returns',
      'throws',
      'param-',
      'visibility',
      'internal-api',
      'fluent',
    ];

    analysis.hasMethodSpecificTags = Object.keys(classData).some(key =>
      methodTags.some(tag => key.startsWith(tag))
    );

    // Check for class-specific tags
    const classTags = ['capability', 'event-sourcing', 'performance', 'domain-pattern'];
    analysis.hasClassSpecificTags = Object.keys(classData).some(key => classTags.includes(key));

    // Analyze description content
    const description = classData.description || '';
    if (this.isConstructorLikeDescription(description)) {
      analysis.contentAnalysis = 'constructor-like';
    } else if (this.isClassLikeDescription(description)) {
      analysis.contentAnalysis = 'class-like';
    }

    return analysis;
  }

  /**
   * Check if description is constructor-like
   */
  isConstructorLikeDescription(description) {
    const lowerDesc = description.toLowerCase();
    return (
      /creates?\s+.*(?:aggregate|instance|object)/.test(lowerDesc) ||
      /initializes?\s+.*(?:aggregate|instance)/.test(lowerDesc) ||
      /constructs?\s+.*(?:aggregate|instance)/.test(lowerDesc) ||
      /constructor/.test(lowerDesc)
    );
  }

  /**
   * Check if description is class-like
   */
  isClassLikeDescription(description) {
    const lowerDesc = description.toLowerCase();
    return (
      /provides?/.test(lowerDesc) ||
      /implements?/.test(lowerDesc) ||
      /represents?/.test(lowerDesc) ||
      /manages?/.test(lowerDesc) ||
      /pattern|capability|feature/.test(lowerDesc)
    );
  }

  /**
   * Generate placement recommendations
   */
  generateRecommendations(className, analysis, currentConfig = {}) {
    const recommendations = [];

    // Recommend separate strategy for complex classes
    if (
      analysis.hasClassDoc &&
      analysis.hasConstructorMethod &&
      currentConfig['placement-strategy'] !== 'separate'
    ) {
      recommendations.push({
        type: 'strategy-upgrade',
        priority: 'high',
        message: `Consider "separate" strategy for ${className} - has both class and constructor documentation`,
        implementation: {
          'placement-strategy': 'separate',
          'content-strategy': 'distinct',
        },
      });
    }

    // Recommend class-doc section for constructor-only classes with class-like content
    if (
      currentConfig['placement-strategy'] === 'constructor-only' &&
      analysis.contentAnalysis === 'class-like'
    ) {
      recommendations.push({
        type: 'content-separation',
        priority: 'medium',
        message: `Class-like content detected in ${className} - consider adding class-doc section`,
        implementation: {
          'placement-strategy': 'separate',
          'add-class-doc': true,
        },
      });
    }

    // Recommend smart strategy for auto-optimization
    if (analysis.contentAnalysis !== 'neutral' && !currentConfig['placement-strategy']) {
      recommendations.push({
        type: 'auto-optimization',
        priority: 'low',
        message: `Consider "smart" strategy for ${className} - system can auto-optimize placement`,
        implementation: {
          'placement-strategy': 'smart',
        },
      });
    }

    return recommendations;
  }

  /**
   * Validate all YAML configuration files
   */
  async validateAllConfigurations() {
    console.log('🔍 Validating JSDoc placement configurations...\n');

    // Validate global configuration
    const globalConfig = await this.loadYamlFile(
      path.join(this.rootDir, 'docs', 'global-settings.yaml')
    );
    if (globalConfig?.jsdoc) {
      this.validatePlacementConfig(globalConfig.jsdoc, 'global-settings.yaml');
    }

    // Validate package configurations
    const packages = ['aggregates', 'domain-services', 'policies']; // Add more as needed
    for (const pkg of packages) {
      const packageConfig = await this.loadYamlFile(
        path.join(this.rootDir, 'packages', pkg, '.md-settings.yaml')
      );
      if (packageConfig?.jsdoc) {
        this.validatePlacementConfig(packageConfig.jsdoc, `packages/${pkg}/.md-settings.yaml`);
      }
    }

    // Validate class configurations
    const classFiles = globSync(
      path.join(this.rootDir, 'docs', 'examples', 'domain', '**', '*.yaml')
    );
    for (const file of classFiles) {
      const classConfig = await this.loadYamlFile(file);
      if (classConfig?.classes) {
        Object.keys(classConfig.classes).forEach(className => {
          const classData = classConfig.classes[className];
          if (classData.jsdoc) {
            this.validatePlacementConfig(classData.jsdoc, `${file}:${className}`);
          }

          // Analyze class metadata and generate recommendations
          const analysis = this.analyzeClassMetadata(className, classConfig);
          const recommendations = this.generateRecommendations(
            className,
            analysis,
            classData.jsdoc
          );
          this.recommendations.push(...recommendations);
        });
      }
    }
  }

  /**
   * Load YAML file
   */
  async loadYamlFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content.startsWith('---')) {
        const yamlContent = `---\n${content}\n---\n`;
        return matter(yamlContent).data;
      }
      return matter(content).data;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.warnings.push({
          context: filePath,
          type: 'file-error',
          message: `Could not load file: ${error.message}`,
        });
      }
      return null;
    }
  }

  /**
   * Generate migration plan
   */
  generateMigrationPlan() {
    const plan = {
      immediate: [],
      recommended: [],
      optional: [],
    };

    this.errors.forEach(error => {
      plan.immediate.push({
        action: 'fix-error',
        priority: 'critical',
        issue: error.message,
        fix: error.fix,
        context: error.context,
      });
    });

    this.recommendations.forEach(rec => {
      if (rec.priority === 'high') {
        plan.recommended.push({
          action: 'implement-recommendation',
          priority: rec.priority,
          change: rec.message,
          implementation: rec.implementation,
        });
      } else {
        plan.optional.push({
          action: 'consider-improvement',
          priority: rec.priority,
          change: rec.message,
          implementation: rec.implementation,
        });
      }
    });

    return plan;
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const report = {
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        recommendations: this.recommendations.length,
      },
      details: {
        errors: this.errors,
        warnings: this.warnings,
        recommendations: this.recommendations,
      },
      migrationPlan: this.generateMigrationPlan(),
    };

    return report;
  }

  /**
   * Print formatted report
   */
  printReport() {
    const report = this.generateReport();

    console.log('📊 JSDoc Placement Validation Report');
    console.log('=====================================\n');

    // Summary
    console.log('📋 Summary:');
    console.log(`   Errors: ${report.summary.errors}`);
    console.log(`   Warnings: ${report.summary.warnings}`);
    console.log(`   Recommendations: ${report.summary.recommendations}\n`);

    // Errors
    if (report.details.errors.length > 0) {
      console.log('❌ Errors (Must Fix):');
      report.details.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.message}`);
        console.log(`      Context: ${error.context}`);
        console.log(`      Fix: ${error.fix}\n`);
      });
    }

    // Warnings
    if (report.details.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      report.details.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning.message}`);
        console.log(`      Context: ${warning.context}\n`);
      });
    }

    // Recommendations
    if (report.details.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      report.details.recommendations.forEach((rec, index) => {
        const priority = rec.priority === 'high' ? '🔥' : rec.priority === 'medium' ? '📈' : '💭';
        console.log(`   ${priority} ${index + 1}. ${rec.message}`);
        if (rec.implementation) {
          console.log(`      Implementation: ${JSON.stringify(rec.implementation, null, 2)}\n`);
        }
      });
    }

    // Migration Plan
    const plan = report.migrationPlan;
    if (plan.immediate.length > 0 || plan.recommended.length > 0) {
      console.log('🚀 Migration Plan:');

      if (plan.immediate.length > 0) {
        console.log('\n   🔥 Immediate Actions (Critical):');
        plan.immediate.forEach((action, index) => {
          console.log(`      ${index + 1}. ${action.issue}`);
          console.log(`         Fix: ${action.fix}`);
          console.log(`         Context: ${action.context}\n`);
        });
      }

      if (plan.recommended.length > 0) {
        console.log('   📈 Recommended Changes:');
        plan.recommended.forEach((action, index) => {
          console.log(`      ${index + 1}. ${action.change}`);
          console.log(
            `         Implementation: ${JSON.stringify(action.implementation, null, 2)}\n`
          );
        });
      }

      if (plan.optional.length > 0) {
        console.log('   💭 Optional Improvements:');
        plan.optional.forEach((action, index) => {
          console.log(`      ${index + 1}. ${action.change}\n`);
        });
      }
    }

    // Success message
    if (report.summary.errors === 0) {
      console.log('✅ No critical errors found! JSDoc placement configuration is valid.\n');
    } else {
      console.log(`❌ Found ${report.summary.errors} critical errors that must be fixed.\n`);
    }

    return report.summary.errors === 0;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];
  const fixErrors = args.includes('--fix');

  console.log('🔍 JSDoc Placement Configuration Validator');
  console.log('==========================================\n');

  const validator = new JSDocPlacementValidator(process.cwd());

  try {
    await validator.validateAllConfigurations();
    const isValid = validator.printReport();

    // Save report to file if requested
    if (outputFile) {
      const report = validator.generateReport();
      await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
      console.log(`📄 Report saved to: ${outputFile}`);
    }

    // Exit with error code if validation failed
    process.exit(isValid ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { JSDocPlacementValidator };
