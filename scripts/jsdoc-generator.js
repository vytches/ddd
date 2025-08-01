#!/usr/bin/env node

/**
 * TypeScript AST JSDoc Generator for VytchesDDD
 * Generates JSDoc documentation from TypeScript source files using AST parsing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Package domain classification
const PACKAGE_DOMAINS = {
  contracts: 'Core',
  'domain-primitives': 'Core',
  'value-objects': 'Core',
  repositories: 'Pattern',
  aggregates: 'Pattern',
  events: 'Architecture',
  cqrs: 'Architecture',
  validation: 'Pattern',
  policies: 'Pattern',
  'domain-services': 'Pattern',
  acl: 'Integration',
  messaging: 'Integration',
  projections: 'Architecture',
  'event-store': 'Infrastructure',
  resilience: 'Infrastructure',
  utils: 'Infrastructure',
  logging: 'Infrastructure',
  testing: 'Infrastructure',
  cli: 'Infrastructure',
  enterprise: 'Infrastructure',
  core: 'Core',
  di: 'Infrastructure',
};

// Complexity classification based on patterns
const COMPLEXITY_PATTERNS = {
  Simple: ['get', 'set', 'is', 'has', 'can', 'toString', 'valueOf'],
  Medium: ['create', 'build', 'parse', 'validate', 'convert', 'transform'],
  Complex: ['execute', 'process', 'handle', 'orchestrate', 'aggregate'],
  Expert: ['saga', 'projection', 'circuit', 'bulkhead', 'resilience'],
};

class JSDocGenerator {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      verbose: false,
      overwrite: false,
      ...options,
    };
    this.stats = {
      filesProcessed: 0,
      jsdocGenerated: 0,
      jsdocSkipped: 0,
      errors: [],
    };
  }

  /**
   * Main generation method
   */
  async generateForProject() {
    console.log('🚀 Starting TypeScript AST JSDoc generation...\n');

    const packages = this.getPackages();

    for (const pkg of packages) {
      console.log(`📦 Processing package: ${pkg.name}`);
      await this.generateForPackage(pkg.name);
    }

    this.generateReport();
  }

  /**
   * Generate JSDoc for a specific package
   */
  async generateForPackage(packageName) {
    const pkg = this.getPackageInfo(packageName);
    if (!pkg) {
      console.error(`❌ Package ${packageName} not found`);
      return;
    }

    console.log(`📦 Processing package: ${pkg.name}`);

    if (!fs.existsSync(pkg.srcPath)) {
      console.log(`⚠️  Package ${pkg.name} has no src directory`);
      return;
    }

    const files = this.getTypeScriptFiles(pkg.srcPath);

    for (const file of files) {
      await this.generateForFile(file, pkg);
    }
  }

  /**
   * Get package information
   */
  getPackageInfo(packageName) {
    const packagesDir = path.join(process.cwd(), 'packages');
    const packagePath = path.join(packagesDir, packageName);

    if (!fs.existsSync(packagePath)) {
      return null;
    }

    return {
      name: packageName,
      path: packagePath,
      srcPath: path.join(packagePath, 'src'),
      domain: PACKAGE_DOMAINS[packageName] || 'Core',
    };
  }

  /**
   * Get all packages to process
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
        domain: PACKAGE_DOMAINS[dir] || 'Core',
      }));
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
   * Generate JSDoc for a single TypeScript file
   */
  async generateForFile(filePath, pkg) {
    this.stats.filesProcessed++;

    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    if (this.options.verbose) {
      console.log(`   📄 Processing: ${relativePath}`);
    }

    try {
      // Parse TypeScript content
      const exports = this.parseTypeScriptExports(content);

      if (exports.length === 0) {
        if (this.options.verbose) {
          console.log(`   ⚠️  No exports found in ${relativePath}`);
        }
        return;
      }

      // Process exports in reverse order to maintain line numbers
      let updatedContent = content;
      let hasChanges = false;
      const sortedExports = exports.sort((a, b) => b.line - a.line);

      for (const exp of sortedExports) {
        if (!exp.hasJSDoc || this.options.overwrite) {
          const jsdoc = this.generateJSDocForExport(exp, pkg);

          // Skip if validation failed
          if (jsdoc === null) {
            this.stats.jsdocSkipped++;
            continue;
          }

          updatedContent = this.insertJSDoc(updatedContent, exp, jsdoc);
          hasChanges = true;
          this.stats.jsdocGenerated++;
        } else {
          this.stats.jsdocSkipped++;
        }
      }

      // Write updated content
      if (hasChanges && !this.options.dryRun) {
        fs.writeFileSync(filePath, updatedContent);
        console.log(`   ✅ Generated JSDoc for ${exports.length} exports in ${relativePath}`);
      } else if (hasChanges && this.options.dryRun) {
        console.log(
          `   🔍 [DRY RUN] Would generate JSDoc for ${exports.length} exports in ${relativePath}`
        );
      }
    } catch (error) {
      this.stats.errors.push({
        file: relativePath,
        error: error.message,
      });
      console.error(`   ❌ Error processing ${relativePath}: ${error.message}`);
    }
  }

  /**
   * Parse TypeScript exports using simple regex patterns
   */
  parseTypeScriptExports(content) {
    const exports = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Only process lines that start with 'export ' to avoid interface properties
      if (!line.startsWith('export ')) {
        continue;
      }

      // Export class
      const classMatch = line.match(/^export\s+(?:abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        exports.push({
          type: 'class',
          name: classMatch[1],
          line: i,
          hasJSDoc: this.hasJSDocAbove(lines, i),
          signature: this.extractClassSignature(lines, i),
        });
        continue;
      }

      // Export interface
      const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
      if (interfaceMatch) {
        exports.push({
          type: 'interface',
          name: interfaceMatch[1],
          line: i,
          hasJSDoc: this.hasJSDocAbove(lines, i),
          signature: this.extractInterfaceSignature(lines, i),
        });
        continue;
      }

      // Export function
      const functionMatch = line.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
      if (functionMatch) {
        exports.push({
          type: 'function',
          name: functionMatch[1],
          line: i,
          hasJSDoc: this.hasJSDocAbove(lines, i),
          signature: this.extractFunctionSignature(lines, i),
        });
        continue;
      }

      // Export type/enum
      const typeMatch = line.match(/^export\s+(type|enum)\s+(\w+)/);
      if (typeMatch) {
        exports.push({
          type: typeMatch[1],
          name: typeMatch[2],
          line: i,
          hasJSDoc: this.hasJSDocAbove(lines, i),
          signature: line,
        });
        continue;
      }

      // Export const
      const constMatch = line.match(/^export\s+const\s+(\w+)/);
      if (constMatch) {
        exports.push({
          type: 'const',
          name: constMatch[1],
          line: i,
          hasJSDoc: this.hasJSDocAbove(lines, i),
          signature: line,
        });
        continue;
      }
    }

    return exports;
  }

  /**
   * Extract class signature including constructor
   */
  extractClassSignature(lines, startLine) {
    const signature = { class: lines[startLine], constructor: null, methods: [] };

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === '}') break;

      // Constructor
      if (line.startsWith('constructor(')) {
        signature.constructor = line;
      }

      // Methods
      const methodMatch = line.match(/^(?:public|private|protected)?\s*(\w+)\s*\(/);
      if (methodMatch && !line.includes('constructor')) {
        signature.methods.push({
          name: methodMatch[1],
          signature: line,
          line: i,
        });
      }
    }

    return signature;
  }

  /**
   * Extract interface signature
   */
  extractInterfaceSignature(lines, startLine) {
    const signature = { interface: lines[startLine], methods: [] };

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === '}') break;

      // Methods
      const methodMatch = line.match(/^(\w+)\s*\(/);
      if (methodMatch) {
        signature.methods.push({
          name: methodMatch[1],
          signature: line,
          line: i,
        });
      }
    }

    return signature;
  }

  /**
   * Extract function signature
   */
  extractFunctionSignature(lines, startLine) {
    let signature = lines[startLine];

    // Handle multi-line function signatures
    if (!signature.includes('{') && !signature.includes(';')) {
      for (let i = startLine + 1; i < lines.length; i++) {
        signature += ' ' + lines[i].trim();
        if (lines[i].includes('{') || lines[i].includes(';')) {
          break;
        }
      }
    }

    return signature;
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
   * Generate JSDoc for an export
   */
  generateJSDocForExport(exp, pkg) {
    const domain = pkg.domain;
    const complexity = this.classifyComplexity(exp.name);

    let jsdoc;
    switch (exp.type) {
      case 'class':
        jsdoc = this.generateClassJSDoc(exp, domain, complexity);
        break;
      case 'interface':
        jsdoc = this.generateInterfaceJSDoc(exp, domain, complexity);
        break;
      case 'function':
        jsdoc = this.generateFunctionJSDoc(exp, domain, complexity);
        break;
      case 'type':
      case 'enum':
        jsdoc = this.generateTypeJSDoc(exp, domain, complexity);
        break;
      case 'const':
        jsdoc = this.generateConstJSDoc(exp, domain, complexity);
        break;
      default:
        jsdoc = this.generateBasicJSDoc(exp, domain, complexity);
    }

    // Validate generated JSDoc
    if (!this.validateJSDoc(jsdoc, exp)) {
      console.warn(`   ⚠️  Invalid JSDoc generated for ${exp.name}, skipping...`);
      return null;
    }

    return jsdoc;
  }

  /**
   * Validate generated JSDoc block
   */
  validateJSDoc(jsdoc, exp) {
    if (!jsdoc || typeof jsdoc !== 'string') {
      return false;
    }

    // Must start with /** and end with */
    if (!jsdoc.trim().startsWith('/**') || !jsdoc.trim().endsWith('*/')) {
      return false;
    }

    // Must contain required LLM tags
    const requiredTags = ['@llm-summary', '@llm-domain'];
    for (const tag of requiredTags) {
      if (!jsdoc.includes(tag)) {
        return false;
      }
    }

    // Must not contain placeholder text
    const placeholders = ['TODO', 'FIXME', 'undefined', 'null'];
    for (const placeholder of placeholders) {
      if (jsdoc.includes(placeholder)) {
        return false;
      }
    }

    // Must contain at least one example
    if (!jsdoc.includes('@example')) {
      return false;
    }

    return true;
  }

  /**
   * Classify complexity based on naming patterns
   */
  classifyComplexity(name) {
    for (const [complexity, patterns] of Object.entries(COMPLEXITY_PATTERNS)) {
      if (patterns.some(pattern => name.toLowerCase().includes(pattern))) {
        return complexity;
      }
    }
    return 'Medium';
  }

  /**
   * Generate JSDoc for class
   */
  generateClassJSDoc(exp, domain, complexity) {
    const summary = this.generateSummary(exp.name, exp.type);

    return `/**
 *
 * @description
 * ${this.generateDescription(exp.name, exp.type, domain)}.
 */`;
  }

  /**
   * Generate JSDoc for interface
   */
  generateInterfaceJSDoc(exp, domain, complexity) {
    const summary = this.generateSummary(exp.name, exp.type);

    return `/**
 * @description
 * ${this.generateDescription(exp.name, exp.type, domain)}.
 */`;
  }

  /**
   * Generate JSDoc for function
   */
  generateFunctionJSDoc(exp, domain, complexity) {
    const summary = this.generateSummary(exp.name, exp.type);
    const params = this.extractParameters(exp.signature);
    const returnType = this.extractReturnType(exp.signature);

    let jsdoc = `/**
 * @description
 * ${this.generateDescription(exp.name, exp.type, domain)}.
 *`;

    // Add parameters
    if (params.length > 0) {
      jsdoc += '\n *';
      for (const param of params) {
        jsdoc += `\n * @param {${param.type}} ${param.name} - ${this.generateParamDescription(param.name)}`;
      }
    }

    // Add return type
    if (returnType && returnType !== 'void') {
      jsdoc += `\n * @returns {${returnType}} ${this.generateReturnDescription(returnType)}`;
    }

    // Add throws
    jsdoc += `\n * @throws {Error} When validation fails`;

    // Add examples
    jsdoc += `\n *
 */`;

    return jsdoc;
  }

  /**
   * Generate JSDoc for type/enum
   */
  generateTypeJSDoc(exp, domain, complexity) {
    const summary = this.generateSummary(exp.name, exp.type);

    return `/**
 * @description
 * ${this.generateDescription(exp.name, exp.type, domain)}.
 */`;
  }

  /**
   * Generate JSDoc for const
   */
  generateConstJSDoc(exp, domain, complexity) {
    const summary = this.generateSummary(exp.name, 'constant');

    return `/**
 * @description
 * ${this.generateDescription(exp.name, 'constant', domain)}.
 */`;
  }

  /**
   * Generate basic JSDoc
   */
  generateBasicJSDoc(exp, domain, complexity) {
    const summary = this.generateSummary(exp.name, exp.type);

    return `/**
 * @description
 * ${this.generateDescription(exp.name, exp.type, domain)}.
 */`;
  }

  /**
   * Generate summary from name and type
   */
  generateSummary(name, type) {
    const cleanName = name.replace(/^I([A-Z])/, '$1'); // Remove interface prefix
    const words = cleanName.split(/(?=[A-Z])/).map(w => w.toLowerCase());

    switch (type) {
      case 'class':
        return `${cleanName} class for ${words.join(' ')} operations`;
      case 'interface':
        return `Contract for ${words.join(' ')} functionality`;
      case 'function':
        return `${words.join(' ')} function`;
      case 'type':
        return `Type definition for ${words.join(' ')}`;
      case 'enum':
        return `Enumeration of ${words.join(' ')} values`;
      case 'const':
        return `Constant value for ${words.join(' ')}`;
      default:
        return `${cleanName} ${type}`;
    }
  }

  /**
   * Generate description from name, type, and domain
   */
  generateDescription(name, type, domain) {
    const cleanName = name.replace(/^I([A-Z])/, '$1');
    const words = cleanName.split(/(?=[A-Z])/).map(w => w.toLowerCase());

    const domainContext = {
      Core: 'core domain functionality',
      Pattern: 'domain pattern implementation',
      Architecture: 'architectural component',
      Integration: 'integration layer component',
      Infrastructure: 'infrastructure service',
    };

    return `${cleanName} ${type} implementing ${domainContext[domain]} for ${words.join(' ')} operations`;
  }

  /**
   * Extract parameters from function signature
   */
  extractParameters(signature) {
    const params = [];
    const paramMatch = signature.match(/\((.*?)\)/);

    if (paramMatch && paramMatch[1].trim()) {
      const paramStr = paramMatch[1];
      const paramParts = paramStr.split(',');

      for (const part of paramParts) {
        const trimmed = part.trim();
        const colonIndex = trimmed.indexOf(':');

        if (colonIndex > 0) {
          const name = trimmed.substring(0, colonIndex).trim();
          const type = trimmed.substring(colonIndex + 1).trim();
          params.push({ name, type });
        }
      }
    }

    return params;
  }

  /**
   * Extract return type from function signature
   */
  extractReturnType(signature) {
    const returnMatch = signature.match(/\):\s*([^{;]+)/);
    return returnMatch ? returnMatch[1].trim() : 'void';
  }

  /**
   * Generate parameter description
   */
  generateParamDescription(paramName) {
    return `${paramName} parameter`;
  }

  /**
   * Generate return description
   */
  generateReturnDescription(returnType) {
    return `Returns ${returnType}`;
  }

  /**
   * Check if function is pure
   */
  isPureFunction(name) {
    const pureFunctions = ['get', 'is', 'has', 'can', 'calculate', 'compute', 'format', 'parse'];
    return pureFunctions.some(prefix => name.toLowerCase().startsWith(prefix));
  }

  /**
   * Insert JSDoc before export
   */
  insertJSDoc(content, exp, jsdoc) {
    const lines = content.split('\n');

    // Find the actual export line
    let insertLine = exp.line;

    // Skip any existing JSDoc
    if (exp.hasJSDoc) {
      // Find the start of existing JSDoc by looking backwards
      let startLine = insertLine - 1;
      while (startLine >= 0) {
        const line = lines[startLine].trim();
        if (line === '/**') {
          break;
        }
        if (line && !line.startsWith('*') && !line.startsWith('//')) {
          startLine = -1; // No JSDoc found
          break;
        }
        startLine--;
      }

      if (startLine >= 0) {
        // Find the end of existing JSDoc
        let endLine = startLine + 1;
        while (endLine < lines.length) {
          const line = lines[endLine].trim();
          if (line.endsWith('*/')) {
            endLine++;
            break;
          }
          endLine++;
        }

        if (endLine <= lines.length) {
          // Replace existing JSDoc
          lines.splice(startLine, endLine - startLine);
          insertLine = startLine;
        }
      }
    }

    // Insert new JSDoc with proper spacing
    const jsdocLines = jsdoc.split('\n');

    // Ensure proper spacing before JSDoc
    if (insertLine > 0 && lines[insertLine - 1].trim() !== '') {
      jsdocLines.unshift('');
    }

    lines.splice(insertLine, 0, ...jsdocLines);

    return lines.join('\n');
  }

  /**
   * Generate final report
   */
  generateReport() {
    console.log('\n📊 JSDoc Generation Report');
    console.log('='.repeat(50));

    console.log(`\n📈 Statistics:`);
    console.log(`Files processed: ${this.stats.filesProcessed}`);
    console.log(`JSDoc generated: ${this.stats.jsdocGenerated}`);
    console.log(`JSDoc skipped: ${this.stats.jsdocSkipped}`);

    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length}):`);
      this.stats.errors.forEach(error => {
        console.log(`  ${error.file}: ${error.error}`);
      });
    }

    console.log(`\n🎯 Summary:`);
    if (this.stats.jsdocGenerated > 0) {
      console.log(`✅ Successfully generated ${this.stats.jsdocGenerated} JSDoc blocks`);
    } else {
      console.log(`⚠️  No JSDoc blocks generated`);
    }

    if (this.options.dryRun) {
      console.log(`\n🔍 This was a dry run - no files were modified`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  let packageName = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--overwrite') {
      options.overwrite = true;
    } else if (arg === '--package') {
      packageName = args[++i];
    } else if (!arg.startsWith('--')) {
      packageName = arg;
    }
  }

  const generator = new JSDocGenerator(options);

  if (packageName) {
    generator.generateForPackage(packageName).catch(console.error);
  } else {
    generator.generateForProject().catch(console.error);
  }
}

module.exports = JSDocGenerator;
