#!/usr/bin/env node

/**
 * Comprehensive JSDoc Coverage Report and Verification System
 * 
 * This script:
 * 1. Verifies JSDoc coverage for all .d.ts files
 * 2. Generates detailed reports before and after injection
 * 3. Identifies specific missing elements
 * 4. Provides actionable insights for improvement
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const glob = require('glob');

class ComprehensiveJSDocReporter {
  constructor() {
    this.results = {
      packages: {},
      summary: {
        totalElements: 0,
        documentedElements: 0,
        coverage: 0,
        byType: {}
      }
    };
  }

  /**
   * Analyze a package for JSDoc coverage
   */
  analyzePackage(packagePath) {
    const packageName = path.basename(packagePath);
    console.log(`\n📦 Analyzing package: ${packageName}`);
    console.log('='.repeat(80));

    const distPath = path.join(packagePath, 'dist');
    if (!fs.existsSync(distPath)) {
      console.log(`  ⚠️ No dist folder found for ${packageName}`);
      return;
    }

    const files = glob.sync(`${distPath}/**/*.d.ts`);
    const packageResult = {
      name: packageName,
      files: {},
      totalElements: 0,
      documentedElements: 0,
      coverage: 0,
      byType: {},
      missingByType: {}
    };

    files.forEach(file => {
      const fileResult = this.analyzeFile(file);
      packageResult.files[path.relative(distPath, file)] = fileResult;
      packageResult.totalElements += fileResult.totalElements;
      packageResult.documentedElements += fileResult.documentedElements;
      
      // Aggregate by type
      Object.entries(fileResult.byType).forEach(([type, count]) => {
        packageResult.byType[type] = (packageResult.byType[type] || 0) + count;
      });
      
      // Track missing by type
      fileResult.missingItems.forEach(item => {
        const type = this.getElementType(item);
        if (!packageResult.missingByType[type]) {
          packageResult.missingByType[type] = [];
        }
        packageResult.missingByType[type].push({
          file: path.relative(distPath, file),
          ...item
        });
      });
    });

    packageResult.coverage = packageResult.totalElements > 0 
      ? Math.round((packageResult.documentedElements / packageResult.totalElements) * 1000) / 10 
      : 0;

    this.results.packages[packageName] = packageResult;
    this.results.summary.totalElements += packageResult.totalElements;
    this.results.summary.documentedElements += packageResult.documentedElements;

    return packageResult;
  }

  /**
   * Analyze a single file
   */
  analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const result = {
      totalElements: 0,
      documentedElements: 0,
      coverage: 0,
      byType: {},
      missingItems: []
    };

    const visit = (node) => {
      if (this.shouldHaveJSDoc(node)) {
        const elementType = this.getNodeKindName(node.kind);
        result.totalElements++;
        result.byType[elementType] = (result.byType[elementType] || 0) + 1;

        if (this.hasJSDoc(node)) {
          result.documentedElements++;
        } else {
          const name = this.getNodeName(node);
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          result.missingItems.push({
            type: elementType,
            name: name,
            line: line
          });
        }
      }
      
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    result.coverage = result.totalElements > 0 
      ? Math.round((result.documentedElements / result.totalElements) * 1000) / 10 
      : 0;

    return result;
  }

  /**
   * Check if node should have JSDoc
   */
  shouldHaveJSDoc(node) {
    // Skip non-exported items
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
      ts.SyntaxKind.TypeAliasDeclaration
    ];

    return relevantKinds.includes(node.kind);
  }

  /**
   * Check if node has JSDoc
   */
  hasJSDoc(node) {
    // Try multiple methods to detect JSDoc
    
    // Method 1: getJSDocCommentsAndTags
    const jsDocNodes = ts.getJSDocCommentsAndTags(node);
    if (jsDocNodes && jsDocNodes.length > 0) {
      return true;
    }
    
    // Method 2: Check node.jsDoc directly
    if (node.jsDoc && node.jsDoc.length > 0) {
      return true;
    }
    
    // Method 3: Check leading comment ranges
    const sourceFile = node.getSourceFile();
    if (sourceFile) {
      const leadingComments = ts.getLeadingCommentRanges(sourceFile.text, node.pos);
      if (leadingComments) {
        return leadingComments.some(comment => {
          const commentText = sourceFile.text.substring(comment.pos, comment.end);
          return commentText.startsWith('/**');
        });
      }
    }
    
    return false;
  }

  /**
   * Check if node is exported
   */
  isExported(node) {
    if (!node.modifiers) return false;
    return node.modifiers.some(m => 
      m.kind === ts.SyntaxKind.ExportKeyword ||
      m.kind === ts.SyntaxKind.DeclareKeyword
    );
  }

  /**
   * Get node name
   */
  getNodeName(node) {
    if (node.name) {
      return node.name.text || node.name.escapedText || 'anonymous';
    }
    if (node.kind === ts.SyntaxKind.Constructor) {
      return 'constructor';
    }
    return 'unnamed';
  }

  /**
   * Get element type from missing item
   */
  getElementType(item) {
    return item.type;
  }

  /**
   * Get node kind name
   */
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
      [ts.SyntaxKind.TypeAliasDeclaration]: 'type'
    };
    return kindMap[kind] || 'unknown';
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    console.log('\n');
    console.log('='.repeat(80));
    console.log('📊 COMPREHENSIVE JSDOC COVERAGE REPORT');
    console.log('='.repeat(80));
    
    // Overall summary
    this.results.summary.coverage = this.results.summary.totalElements > 0
      ? Math.round((this.results.summary.documentedElements / this.results.summary.totalElements) * 1000) / 10
      : 0;
    
    console.log('\n📈 OVERALL SUMMARY');
    console.log('-'.repeat(40));
    console.log(`Total Elements: ${this.results.summary.totalElements}`);
    console.log(`Documented: ${this.results.summary.documentedElements}`);
    console.log(`Coverage: ${this.results.summary.coverage}%`);
    
    // Coverage by type
    const typeStats = {};
    Object.values(this.results.packages).forEach(pkg => {
      Object.entries(pkg.missingByType).forEach(([type, items]) => {
        if (!typeStats[type]) {
          typeStats[type] = { missing: 0, total: 0 };
        }
        typeStats[type].missing += items.length;
      });
      Object.entries(pkg.byType).forEach(([type, count]) => {
        if (!typeStats[type]) {
          typeStats[type] = { missing: 0, total: 0 };
        }
        typeStats[type].total += count;
      });
    });
    
    console.log('\n📊 COVERAGE BY TYPE');
    console.log('-'.repeat(40));
    Object.entries(typeStats).forEach(([type, stats]) => {
      const coverage = stats.total > 0 
        ? Math.round(((stats.total - stats.missing) / stats.total) * 100)
        : 0;
      console.log(`${type.padEnd(15)} ${coverage}% (${stats.total - stats.missing}/${stats.total})`);
    });
    
    // Package details
    console.log('\n📦 PACKAGE DETAILS');
    console.log('-'.repeat(40));
    Object.values(this.results.packages)
      .sort((a, b) => b.coverage - a.coverage)
      .forEach(pkg => {
        const status = pkg.coverage >= 80 ? '🟢' : pkg.coverage >= 50 ? '🟡' : '🔴';
        console.log(`${status} ${pkg.name.padEnd(30)} ${pkg.coverage}% (${pkg.documentedElements}/${pkg.totalElements})`);
      });
    
    // Critical missing items (interface properties)
    console.log('\n⚠️ CRITICAL ISSUES');
    console.log('-'.repeat(40));
    console.log('Interface properties are not receiving JSDoc from YAML injection!');
    
    let propertyCount = 0;
    Object.values(this.results.packages).forEach(pkg => {
      if (pkg.missingByType.property) {
        propertyCount += pkg.missingByType.property.length;
      }
    });
    console.log(`Total missing interface properties: ${propertyCount}`);
    
    // Top missing items by package
    console.log('\n🎯 TOP MISSING ITEMS BY PACKAGE');
    console.log('-'.repeat(40));
    Object.values(this.results.packages)
      .filter(pkg => pkg.coverage < 80)
      .sort((a, b) => a.coverage - b.coverage)
      .slice(0, 5)
      .forEach(pkg => {
        console.log(`\n${pkg.name}:`);
        const topMissing = {};
        Object.values(pkg.files).forEach(file => {
          file.missingItems.forEach(item => {
            const key = item.type;
            topMissing[key] = (topMissing[key] || 0) + 1;
          });
        });
        Object.entries(topMissing)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .forEach(([type, count]) => {
            console.log(`  - ${count} missing ${type}s`);
          });
      });
    
    return this.results;
  }

  /**
   * Save report to file
   */
  saveReport(outputPath) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      packages: Object.values(this.results.packages).map(pkg => ({
        name: pkg.name,
        coverage: pkg.coverage,
        totalElements: pkg.totalElements,
        documentedElements: pkg.documentedElements,
        byType: pkg.byType,
        missingByTypeCount: Object.entries(pkg.missingByType || {}).reduce((acc, [type, items]) => {
          acc[type] = items.length;
          return acc;
        }, {})
      }))
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved to: ${outputPath}`);
  }
}

// Main execution
function main() {
  const reporter = new ComprehensiveJSDocReporter();
  const packagesPath = path.join(__dirname, '..', 'packages');
  
  // Get all packages
  const packages = fs.readdirSync(packagesPath)
    .filter(dir => fs.statSync(path.join(packagesPath, dir)).isDirectory());
  
  // Analyze each package
  packages.forEach(packageName => {
    reporter.analyzePackage(path.join(packagesPath, packageName));
  });
  
  // Generate report
  reporter.generateReport();
  
  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportPath = path.join(__dirname, '..', `jsdoc-coverage-report-${timestamp}.json`);
  reporter.saveReport(reportPath);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { ComprehensiveJSDocReporter };