#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

class JSDocFixer {
  constructor() {
    this.fixedCount = 0;
    this.fileCount = 0;
  }

  /**
   * Fix JSDoc blocks in a package
   */
  async fixPackage(packageName) {
    const packagePath = path.join(process.cwd(), 'packages', packageName);
    if (!fs.existsSync(packagePath)) {
      console.error(`Package ${packageName} not found`);
      return;
    }

    console.log(`\n📦 Fixing JSDoc in package: ${packageName}`);
    const srcPath = path.join(packagePath, 'src');
    await this.processDirectory(srcPath, packageName);
  }

  /**
   * Process all TypeScript files in a directory
   */
  async processDirectory(dirPath, packageName) {
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        await this.processDirectory(filePath, packageName);
      } else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.endsWith('.test.ts')) {
        await this.fixFile(filePath, packageName);
      }
    }
  }

  /**
   * Fix JSDoc blocks in a single file
   */
  async fixFile(filePath, packageName) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    let modifiedContent = content;
    let hasChanges = false;

    // Find all JSDoc blocks that need fixing
    const jsdocBlocks = this.findJSDocBlocks(content);

    for (let i = jsdocBlocks.length - 1; i >= 0; i--) {
      const block = jsdocBlocks[i];
      if (this.needsFixing(block.content)) {
        // Get context around the JSDoc block
        const contextStart = Math.max(0, block.start - 200);
        const contextEnd = Math.min(content.length, block.end + 500);
        const context = content.substring(contextStart, contextEnd);

        const fixedBlock = this.fixJSDocBlock(block.content, packageName, filePath, context);
        if (fixedBlock !== block.content) {
          modifiedContent =
            modifiedContent.substring(0, block.start) +
            fixedBlock +
            modifiedContent.substring(block.end);
          hasChanges = true;
          this.fixedCount++;
        }
      }
    }

    if (hasChanges) {
      fs.writeFileSync(filePath, modifiedContent);
      this.fileCount++;
      console.log(`   ✅ Fixed JSDoc in ${path.relative(process.cwd(), filePath)}`);
    }
  }

  /**
   * Find all JSDoc blocks in content
   */
  findJSDocBlocks(content) {
    const blocks = [];
    const regex = /\/\*\*[\s\S]*?\*\//g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        content: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return blocks;
  }

  /**
   * Check if a JSDoc block needs fixing
   */
  needsFixing(jsdocContent) {
    // Check if it's missing LLM tags
    return (
      !jsdocContent.includes('@llm-summary') ||
      !jsdocContent.includes('@llm-domain') ||
      !jsdocContent.includes('@example')
    );
  }

  /**
   * Fix a JSDoc block by adding missing LLM tags
   */
  fixJSDocBlock(jsdocContent, packageName, filePath, context = '') {
    const lines = jsdocContent.split('\n');
    const domain = this.getPackageDomain(packageName);

    // Check what's missing
    const hasSummary = jsdocContent.includes('@llm-summary');
    const hasDomain = jsdocContent.includes('@llm-domain');
    const hasExample = jsdocContent.includes('@example');
    const hasDescription = jsdocContent.includes('@description');

    // Extract the entity name from the JSDoc and context
    const fullContent = context || jsdocContent;
    const entityName = this.extractEntityName(fullContent, filePath);
    const entityType = this.extractEntityType(fullContent, filePath);

    let newLines = [];
    let insertedTags = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Insert LLM tags after the opening /**
      if (i === 0) {
        newLines.push(line);

        if (!hasSummary) {
          const summary = this.generateSummary(entityName, entityType, jsdocContent);
          newLines.push(` * @llm-summary ${summary}`);
        }

        if (!hasDomain) {
          newLines.push(` * @llm-domain ${domain}`);
        }

        // Add complexity for classes and complex interfaces
        if (
          (entityType === 'class' || entityType === 'interface') &&
          !jsdocContent.includes('@llm-complexity')
        ) {
          const complexity = this.determineComplexity(jsdocContent);
          newLines.push(` * @llm-complexity ${complexity}`);
        }

        // Add contract info for interfaces
        if (entityType === 'interface' && !jsdocContent.includes('@llm-contract')) {
          newLines.push(` * @llm-contract Required`);
        }

        // Add pure/sideeffects for functions
        if (entityType === 'function' && !jsdocContent.includes('@llm-pure')) {
          const isPure = this.determinePurity(jsdocContent);
          newLines.push(` * @llm-pure ${isPure}`);
        }

        insertedTags = true;
        continue;
      }

      // Skip existing LLM tags if we're adding new ones
      if (insertedTags && (line.includes('@llm-summary') || line.includes('@llm-domain'))) {
        continue;
      }

      newLines.push(line);

      // Add description if missing
      if (!hasDescription && line.includes('/**') && i === 0) {
        newLines.push(' * ');
        newLines.push(` * @description`);
        newLines.push(` * ${this.generateDescription(entityName, entityType, packageName)}`);
      }

      // Add examples before the closing */
      if (!hasExample && line.trim() === '*/') {
        newLines.pop(); // Remove the closing */
        newLines.push(' * ');
        newLines.push(' * @example');
        newLines.push(' * ```typescript');
        newLines.push(` * ${this.generateExample(entityName, entityType, 'basic', fullContent)}`);
        newLines.push(' * ```');
        newLines.push(' * ');
        newLines.push(' * @example');
        newLines.push(' * ```typescript');
        newLines.push(` * ${this.generateExample(entityName, entityType, 'error', fullContent)}`);
        newLines.push(' * ```');
        newLines.push(' * ');
        newLines.push(' * @since 1.0.0');
        newLines.push(' * @public');
        newLines.push(' */');
      }
    }

    return newLines.join('\n');
  }

  /**
   * Extract entity name from JSDoc or following code
   */
  extractEntityName(jsdocContent, filePath) {
    // Try to extract from the JSDoc content
    const classMatch = jsdocContent.match(/class\s+(\w+)/);
    if (classMatch) return classMatch[1];

    const interfaceMatch = jsdocContent.match(/interface\s+(\w+)/);
    if (interfaceMatch) return interfaceMatch[1];

    const functionMatch = jsdocContent.match(/function\s+(\w+)/);
    if (functionMatch) return functionMatch[1];

    // Default to filename
    return path.basename(filePath, '.ts');
  }

  /**
   * Extract entity type
   */
  extractEntityType(jsdocContent, filePath) {
    if (jsdocContent.includes('class')) return 'class';
    if (jsdocContent.includes('interface')) return 'interface';
    if (jsdocContent.includes('function')) return 'function';
    if (jsdocContent.includes('enum')) return 'enum';
    if (jsdocContent.includes('type')) return 'type';
    return 'unknown';
  }

  /**
   * Generate a summary based on entity name and type
   */
  generateSummary(entityName, entityType, jsdocContent) {
    // Check if it's a static method
    const staticMatch = jsdocContent.match(/static\s+(\w+)/);
    if (staticMatch) {
      const methodName = staticMatch[1];
      return `Static method for ${methodName} operations`;
    }

    // Check if it's an error factory method
    if (jsdocContent.includes('Error for') || jsdocContent.includes('error')) {
      return `Error factory method for specific error scenarios`;
    }

    // Default summaries
    switch (entityType) {
      case 'class':
        return `${entityName} class for ${this.camelToWords(entityName).toLowerCase()} operations`;
      case 'interface':
        return `Contract for ${this.camelToWords(entityName).toLowerCase()} functionality`;
      case 'function':
        return `${this.camelToWords(entityName)} function`;
      case 'enum':
        return `Enumeration of ${this.camelToWords(entityName).toLowerCase()} values`;
      case 'type':
        return `Type definition for ${this.camelToWords(entityName).toLowerCase()}`;
      default:
        return `${entityName} implementation`;
    }
  }

  /**
   * Generate a description
   */
  generateDescription(entityName, entityType, packageName) {
    const domain = this.getPackageDomain(packageName);
    const words = this.camelToWords(entityName).toLowerCase();

    switch (entityType) {
      case 'class':
        return `${entityName} class implementing ${domain.toLowerCase()} component for ${words} operations.`;
      case 'interface':
        return `${entityName} interface implementing ${domain.toLowerCase()} component for ${words} operations.`;
      case 'function':
        return `${entityName} function implementing ${domain.toLowerCase()} component for ${words} operations.`;
      default:
        return `${entityName} ${entityType} implementing ${domain.toLowerCase()} component for ${words} operations.`;
    }
  }

  /**
   * Generate example code
   */
  generateExample(entityName, entityType, exampleType, jsdocContent) {
    // Check if it's a static method
    const staticMatch = jsdocContent.match(/static\s+(\w+)\s*\(/);
    if (staticMatch) {
      const methodName = staticMatch[1];
      const className = this.extractClassName(jsdocContent);

      if (exampleType === 'basic') {
        // Analyze method signature for parameters
        if (methodName.includes('Error') || jsdocContent.includes('Error for')) {
          return `// Create specific error\nconst error = ${className}.${methodName}('Error message', { context: 'data' });`;
        } else {
          return `// Call static method\nconst result = ${className}.${methodName}(params);`;
        }
      } else {
        return `// Error handling example\ntry {\n *   const result = ${className}.${methodName}(params);\n * } catch (error) {\n *   console.error('Operation failed:', error);\n * }`;
      }
    }

    if (exampleType === 'basic') {
      switch (entityType) {
        case 'class':
          return `// Basic usage\nconst instance = new ${entityName}();`;
        case 'interface':
          return `// Implementation example\nclass Concrete${entityName} implements ${entityName} {\n *   // Implementation\n * }`;
        case 'function':
          return `// Basic usage\nconst result = ${entityName}();`;
        case 'enum':
          return `// Usage example\nconst value: ${entityName} = ${entityName}.VALUE;`;
        default:
          return `// Usage example\nconst value: ${entityName} = {};`;
      }
    } else {
      // Error handling example
      switch (entityType) {
        case 'class':
          return `// With error handling\nconst [error, instance] = safeRun(() => new ${entityName}());\n * if (error) {\n *   console.error('Creation failed:', error.message);\n * }`;
        case 'function':
          return `// With error handling\nconst [error, result] = safeRun(() => ${entityName}());`;
        default:
          return `// Advanced usage\n// Implement based on specific requirements`;
      }
    }
  }

  /**
   * Extract class name from content
   */
  extractClassName(content) {
    // Look for export class pattern first
    const exportMatch = content.match(/export\s+class\s+(\w+)/);
    if (exportMatch) return exportMatch[1];

    // Look for class definition in the surrounding context
    const classMatch = content.match(/class\s+(\w+)/);
    if (classMatch) return classMatch[1];

    // Try to find the class name from the file content
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('export class')) {
        const match = line.match(/export\s+class\s+(\w+)/);
        if (match) return match[1];
      }
    }

    return 'ClassName';
  }

  /**
   * Determine complexity
   */
  determineComplexity(jsdocContent) {
    const lines = jsdocContent.split('\n').length;
    if (lines > 50) return 'Complex';
    if (lines > 20) return 'Medium';
    return 'Simple';
  }

  /**
   * Determine if function is pure
   */
  determinePurity(jsdocContent) {
    if (
      jsdocContent.includes('async') ||
      jsdocContent.includes('Promise') ||
      jsdocContent.includes('void') ||
      jsdocContent.includes('console') ||
      jsdocContent.includes('throw')
    ) {
      return 'false';
    }
    return 'true';
  }

  /**
   * Get package domain classification
   */
  getPackageDomain(packageName) {
    const PACKAGE_DOMAINS = {
      contracts: 'Core',
      'domain-primitives': 'Core',
      'value-objects': 'Core',
      repositories: 'Pattern',
      aggregates: 'Pattern',
      validation: 'Pattern',
      policies: 'Pattern',
      'domain-services': 'Pattern',
      events: 'Architecture',
      cqrs: 'Architecture',
      projections: 'Architecture',
      acl: 'Integration',
      messaging: 'Integration',
      resilience: 'Infrastructure',
      'event-store': 'Infrastructure',
      logging: 'Infrastructure',
      di: 'Infrastructure',
      utils: 'Infrastructure',
      cli: 'Infrastructure',
      testing: 'Infrastructure',
      enterprise: 'Infrastructure',
      'event-scheduling': 'Infrastructure',
      core: 'Core',
    };

    return PACKAGE_DOMAINS[packageName] || 'Core';
  }

  /**
   * Convert camelCase to words
   */
  camelToWords(text) {
    return text.replace(/([A-Z])/g, ' $1').trim();
  }

  /**
   * Fix all packages
   */
  async fixAllPackages() {
    const packagesDir = path.join(process.cwd(), 'packages');
    const packages = fs
      .readdirSync(packagesDir)
      .filter(name => fs.statSync(path.join(packagesDir, name)).isDirectory());

    for (const pkg of packages) {
      await this.fixPackage(pkg);
    }

    console.log(`\n✅ Fixed ${this.fixedCount} JSDoc blocks in ${this.fileCount} files`);
  }
}

// CLI execution
const fixer = new JSDocFixer();
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('🔧 Fixing JSDoc blocks in all packages...');
  fixer.fixAllPackages();
} else {
  const packageName = args[0];
  fixer.fixPackage(packageName);
}
