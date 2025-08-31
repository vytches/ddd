#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

/**
 * Comprehensive JSDoc coverage verifier for TypeScript declaration files
 */
class JSDocCoverageVerifier {
  constructor() {
    this.results = {
      total: 0,
      documented: 0,
      missing: [],
      byFile: {},
    };
  }

  /**
   * Parse a TypeScript declaration file and check JSDoc coverage
   */
  analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    const fileName = path.relative(process.cwd(), filePath);
    this.results.byFile[fileName] = {
      total: 0,
      documented: 0,
      missing: [],
    };

    this.visitNode(sourceFile, sourceFile, fileName);
  }

  /**
   * Visit TypeScript AST nodes recursively
   */
  visitNode(node, sourceFile, fileName) {
    // Check if this node should have JSDoc
    if (this.shouldHaveJSDoc(node)) {
      const nodeName = this.getNodeName(node);
      const nodeType = this.getNodeType(node);
      const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;

      this.results.total++;
      this.results.byFile[fileName].total++;

      if (this.hasJSDoc(node)) {
        this.results.documented++;
        this.results.byFile[fileName].documented++;
      } else {
        const missingInfo = `${nodeType} ${nodeName} at line ${lineNumber}`;
        this.results.missing.push(`${fileName}: ${missingInfo}`);
        this.results.byFile[fileName].missing.push(missingInfo);
      }
    }

    // Recursively visit children
    ts.forEachChild(node, child => this.visitNode(child, sourceFile, fileName));
  }

  /**
   * Check if a node should have JSDoc
   */
  shouldHaveJSDoc(node) {
    // Check if it's exported
    const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

    // Check if it's a declaration we care about
    const isRelevantKind = [
      ts.SyntaxKind.ClassDeclaration,
      ts.SyntaxKind.InterfaceDeclaration,
      ts.SyntaxKind.EnumDeclaration,
      ts.SyntaxKind.TypeAliasDeclaration,
      ts.SyntaxKind.FunctionDeclaration,
      ts.SyntaxKind.MethodDeclaration,
      ts.SyntaxKind.MethodSignature,
      ts.SyntaxKind.PropertyDeclaration,
      ts.SyntaxKind.PropertySignature,
      ts.SyntaxKind.Constructor,
      ts.SyntaxKind.GetAccessor,
      ts.SyntaxKind.SetAccessor,
      ts.SyntaxKind.VariableStatement,
    ].includes(node.kind);

    // For methods and properties, check if they're public
    if (
      node.kind === ts.SyntaxKind.MethodDeclaration ||
      node.kind === ts.SyntaxKind.PropertyDeclaration ||
      node.kind === ts.SyntaxKind.GetAccessor ||
      node.kind === ts.SyntaxKind.SetAccessor
    ) {
      const hasPrivateModifier = node.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword);
      if (hasPrivateModifier) return false;
    }

    // Special handling for variable statements
    if (node.kind === ts.SyntaxKind.VariableStatement) {
      return isExported;
    }

    // For other nodes, check if they're exported or are class/interface members
    const isClassMember =
      node.parent &&
      (node.parent.kind === ts.SyntaxKind.ClassDeclaration ||
        node.parent.kind === ts.SyntaxKind.InterfaceDeclaration);

    return isRelevantKind && (isExported || isClassMember);
  }

  /**
   * Check if a node has JSDoc
   */
  hasJSDoc(node) {
    const jsDocNodes = ts.getJSDocCommentsAndTags(node);
    return jsDocNodes && jsDocNodes.length > 0;
  }

  /**
   * Get the name of a node
   */
  getNodeName(node) {
    if (node.name) {
      return node.name.text || node.name.escapedText || 'anonymous';
    }

    // For variable statements, get the first declaration name
    if (node.kind === ts.SyntaxKind.VariableStatement) {
      const declaration = node.declarationList?.declarations?.[0];
      if (declaration?.name) {
        return declaration.name.text || declaration.name.escapedText || 'anonymous';
      }
    }

    if (node.kind === ts.SyntaxKind.Constructor) {
      return 'constructor';
    }

    return 'anonymous';
  }

  /**
   * Get the type of a node
   */
  getNodeType(node) {
    switch (node.kind) {
      case ts.SyntaxKind.ClassDeclaration:
        return 'class';
      case ts.SyntaxKind.InterfaceDeclaration:
        return 'interface';
      case ts.SyntaxKind.EnumDeclaration:
        return 'enum';
      case ts.SyntaxKind.TypeAliasDeclaration:
        return 'type';
      case ts.SyntaxKind.FunctionDeclaration:
        return 'function';
      case ts.SyntaxKind.MethodDeclaration:
        return 'method';
      case ts.SyntaxKind.MethodSignature:
        return 'method';
      case ts.SyntaxKind.PropertyDeclaration:
        return 'property';
      case ts.SyntaxKind.PropertySignature:
        return 'property';
      case ts.SyntaxKind.Constructor:
        return 'constructor';
      case ts.SyntaxKind.GetAccessor:
        return 'getter';
      case ts.SyntaxKind.SetAccessor:
        return 'setter';
      case ts.SyntaxKind.VariableStatement:
        return 'const';
      default:
        return 'unknown';
    }
  }

  /**
   * Analyze all .d.ts files in a directory
   */
  analyzeDirectory(dir) {
    const files = this.findDeclarationFiles(dir);
    files.forEach(file => this.analyzeFile(file));
  }

  /**
   * Find all .d.ts files recursively
   */
  findDeclarationFiles(dir, files = []) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.findDeclarationFiles(fullPath, files);
      } else if (item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Generate detailed report
   */
  generateReport() {
    const totalCoverage =
      this.results.total > 0
        ? ((this.results.documented / this.results.total) * 100).toFixed(1)
        : 0;

    console.log('\n' + '='.repeat(80));
    console.log('📊 JSDoc Coverage Report');
    console.log('='.repeat(80));
    console.log(
      `\n📈 Overall Coverage: ${this.results.documented}/${this.results.total} (${totalCoverage}%)\n`
    );

    // File-by-file breakdown
    console.log('📁 File Breakdown:');
    console.log('-'.repeat(80));

    for (const [file, data] of Object.entries(this.results.byFile)) {
      if (data.total === 0) continue;

      const coverage = ((data.documented / data.total) * 100).toFixed(1);
      const status = coverage === '100.0' ? '✅' : '⚠️';

      console.log(`\n${status} ${file}`);
      console.log(`   Coverage: ${data.documented}/${data.total} (${coverage}%)`);

      if (data.missing.length > 0) {
        console.log('   Missing JSDoc:');
        data.missing.forEach(item => {
          console.log(`     ❌ ${item}`);
        });
      }
    }

    // Summary of all missing items
    if (this.results.missing.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('❌ All Missing JSDoc Items:');
      console.log('-'.repeat(80));
      this.results.missing.forEach(item => {
        console.log(`  ${item}`);
      });
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('✅ Perfect Coverage! All items have JSDoc documentation.');
    }

    console.log('\n' + '='.repeat(80));

    // Return exit code based on coverage
    return totalCoverage === '100.0' ? 0 : 1;
  }

  /**
   * Compare with YAML file to find missing documentation
   */
  async compareWithYAML(dtsFile, yamlFile) {
    if (!fs.existsSync(yamlFile)) {
      console.log(`⚠️  No YAML file found: ${yamlFile}`);
      return;
    }

    const yaml = require('js-yaml');
    const yamlContent = fs.readFileSync(yamlFile, 'utf8');
    const yamlData = yaml.load(yamlContent);

    console.log(`\n📝 Comparing ${dtsFile} with YAML...`);

    // Extract all documented items from YAML
    const yamlItems = new Set();

    // Classes and their methods
    if (yamlData.classes) {
      for (const [className, classData] of Object.entries(yamlData.classes)) {
        yamlItems.add(`class:${className}`);
        if (classData.methods) {
          for (const methodName of Object.keys(classData.methods)) {
            yamlItems.add(`method:${className}.${methodName}`);
          }
        }
      }
    }

    // Interfaces
    if (yamlData.interfaces) {
      for (const interfaceName of Object.keys(yamlData.interfaces)) {
        yamlItems.add(`interface:${interfaceName}`);
      }
    }

    // Types
    if (yamlData.types) {
      for (const typeName of Object.keys(yamlData.types)) {
        yamlItems.add(`type:${typeName}`);
      }
    }

    // Enums
    if (yamlData.enums) {
      for (const enumName of Object.keys(yamlData.enums)) {
        yamlItems.add(`enum:${enumName}`);
      }
    }

    console.log(`Found ${yamlItems.size} items documented in YAML`);

    // Now analyze the .d.ts file
    this.results = { total: 0, documented: 0, missing: [], byFile: {} };
    this.analyzeFile(dtsFile);

    // Check which items in .d.ts are not in YAML
    const dtsItems = new Set();
    const fileName = path.basename(dtsFile);
    if (this.results.byFile[fileName]) {
      // This would need more sophisticated parsing to match YAML structure
      console.log(`Found ${this.results.byFile[fileName].total} items in .d.ts file`);
      if (this.results.byFile[fileName].missing.length > 0) {
        console.log('Items in .d.ts but missing JSDoc (need YAML documentation):');
        this.results.byFile[fileName].missing.forEach(item => {
          console.log(`  ⚠️  ${item}`);
        });
      }
    }
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node verify-jsdoc-coverage.js <directory|file> [--yaml <yaml-file>]');
    console.log('Examples:');
    console.log('  node verify-jsdoc-coverage.js packages/resilience/dist');
    console.log(
      '  node verify-jsdoc-coverage.js packages/resilience/dist/observability/metric-registry.d.ts'
    );
    console.log(
      '  node verify-jsdoc-coverage.js packages/resilience/dist/observability/metric-registry.d.ts --yaml docs/examples/domain/resilience/observability/metric-registry.yaml'
    );
    process.exit(1);
  }

  const target = args[0];
  const yamlIndex = args.indexOf('--yaml');
  const yamlFile = yamlIndex !== -1 ? args[yamlIndex + 1] : null;

  const verifier = new JSDocCoverageVerifier();

  try {
    const stat = fs.statSync(target);

    if (stat.isDirectory()) {
      verifier.analyzeDirectory(target);
    } else if (target.endsWith('.d.ts')) {
      if (yamlFile) {
        verifier.compareWithYAML(target, yamlFile);
      } else {
        verifier.analyzeFile(target);
      }
    } else {
      console.error('Target must be a directory or a .d.ts file');
      process.exit(1);
    }

    const exitCode = verifier.generateReport();
    process.exit(exitCode);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = JSDocCoverageVerifier;
