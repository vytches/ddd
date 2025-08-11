#!/usr/bin/env node

/**
 * Enhanced YAML JSDoc Injection Script with Flexible Placement Strategy
 * Supports configurable JSDoc placement for classes with and without constructors
 */

const fs = require('fs').promises;
const path = require('path');
const { globSync } = require('glob');
const matter = require('gray-matter');

class EnhancedJSDocPlacer {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.globalMetadata = null;
    this.packageMetadata = new Map();
    this.classMetadata = new Map();
  }

  /**
   * Get JSDoc placement configuration from metadata hierarchy
   */
  getPlacementConfig(className, packageName = 'aggregates') {
    const defaults = {
      'placement-strategy': 'separate',
      'class-documentation': 'enabled',
      'constructor-documentation': 'enabled',
      'content-strategy': 'distinct',
    };

    let config = { ...defaults };

    // Apply global JSDoc configuration
    if (this.globalMetadata?.jsdoc) {
      Object.assign(config, this.globalMetadata.jsdoc);
    }

    // Apply package JSDoc configuration
    const packageMeta = this.packageMetadata.get(packageName);
    if (packageMeta?.jsdoc) {
      Object.assign(config, packageMeta.jsdoc);
    }

    // Apply class-specific JSDoc configuration
    const classMeta = this.classMetadata.get(className.toLowerCase());
    if (classMeta?.classes?.[className]?.jsdoc) {
      Object.assign(config, classMeta.classes[className].jsdoc);
    }

    return config;
  }

  /**
   * Determine documentation targets based on placement strategy
   */
  getDocumentationTargets(className, fileContent, config) {
    const hasConstructor = this.classHasConstructor(className, fileContent);
    const strategy = config['placement-strategy'];

    const targets = {
      class: false,
      constructor: false,
      metadata: {
        hasConstructor,
        strategy,
        classDocEnabled: config['class-documentation'] === 'enabled',
        constructorDocEnabled: config['constructor-documentation'] === 'enabled',
      },
    };

    switch (strategy) {
      case 'separate':
        // Both class and constructor get documentation (if they exist)
        targets.class = config['class-documentation'] === 'enabled';
        targets.constructor = hasConstructor && config['constructor-documentation'] === 'enabled';
        break;

      case 'constructor-only':
        // Legacy behavior: constructor if exists, otherwise class
        if (hasConstructor) {
          targets.constructor = config['constructor-documentation'] === 'enabled';
        } else {
          targets.class = config['class-documentation'] === 'enabled';
        }
        break;

      case 'class-only':
        // Only class gets documentation
        targets.class = config['class-documentation'] === 'enabled';
        break;

      case 'smart':
        // Analyze content to determine best placement
        targets = this.getSmartPlacement(className, fileContent, config);
        break;

      default:
        console.warn(`⚠️  Unknown placement strategy: ${strategy}, falling back to 'separate'`);
        targets.class = true;
        targets.constructor = hasConstructor;
    }

    console.log(`  📋 Documentation targets for ${className}:`, {
      class: targets.class,
      constructor: targets.constructor,
      strategy: strategy,
      hasConstructor: hasConstructor,
    });

    return targets;
  }

  /**
   * Smart placement based on content analysis
   */
  getSmartPlacement(className, fileContent, config) {
    const hasConstructor = this.classHasConstructor(className, fileContent);
    const classMeta = this.getClassMetadata(className);

    // Analyze description content to determine if it's constructor-like
    const description = classMeta?.description || '';
    const isConstructorDescription = this.isConstructorLikeDescription(description);

    const targets = {
      class: true,
      constructor: hasConstructor,
      metadata: {
        hasConstructor,
        isConstructorDescription,
        contentAnalysis: 'smart',
      },
    };

    // If description is constructor-like and constructor exists, prefer constructor
    if (isConstructorDescription && hasConstructor) {
      targets.class = false;
      targets.constructor = true;
      console.log(`  🧠 Smart placement: Constructor-like content detected, using constructor`);
    } else if (!isConstructorDescription) {
      targets.class = true;
      targets.constructor = hasConstructor;
      console.log(
        `  🧠 Smart placement: Class-like content detected, using separate documentation`
      );
    }

    return targets;
  }

  /**
   * Check if description content is constructor-like
   */
  isConstructorLikeDescription(description) {
    const lowerDesc = description.toLowerCase();
    const constructorIndicators = [
      /creates?\s+.*(?:aggregate|instance|object)/,
      /initializes?\s+.*(?:aggregate|instance)/,
      /constructs?\s+.*(?:aggregate|instance)/,
      /constructor/,
      /@param/,
    ];

    return constructorIndicators.some(pattern => pattern.test(lowerDesc));
  }

  /**
   * Get class-specific metadata for documentation target
   */
  getTargetMetadata(className, target, config) {
    const classMeta = this.getClassMetadata(className);
    if (!classMeta) return null;

    let metadata = {};

    if (target === 'class') {
      // Use class-doc section if available, otherwise use resolved metadata
      const classSpecificMeta = classMeta.classes?.[className];
      if (classSpecificMeta?.['class-doc']) {
        console.log(`  📋 Using class-doc section for class documentation`);
        metadata = { ...classSpecificMeta['class-doc'] };
      } else {
        // Use regular metadata resolution for class
        metadata = this.resolveMetadata(className, null);
        // Remove method-specific tags that shouldn't be on class
        this.cleanClassMetadata(metadata);
      }
    } else if (target === 'constructor') {
      // Use constructor method metadata
      const constructorMeta =
        classMeta.classes?.[className]?.methods?.constructor || classMeta.methods?.constructor;
      if (constructorMeta) {
        metadata = this.resolveMetadata(className, 'constructor');
      } else {
        // Fallback to class metadata for constructor if no specific constructor metadata
        metadata = this.resolveMetadata(className, null);
        console.log(`  ⚠️  No constructor metadata found, using class metadata`);
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  /**
   * Remove method-specific metadata from class documentation
   */
  cleanClassMetadata(metadata) {
    const methodSpecificKeys = [
      'parameters',
      'returns',
      'throws',
      'param-',
      'visibility',
      'internal-api',
      'fluent',
    ];

    Object.keys(metadata).forEach(key => {
      if (methodSpecificKeys.some(prefix => key.startsWith(prefix))) {
        delete metadata[key];
      }
    });
  }

  /**
   * Process content distribution based on strategy
   */
  distributeContent(classMetadata, constructorMetadata, config) {
    const strategy = config['content-strategy'];

    switch (strategy) {
      case 'distinct':
        // Keep content separate - already handled in getTargetMetadata
        return { classMetadata, constructorMetadata };

      case 'shared':
        // Both get the same content (prefer class metadata)
        const sharedContent = classMetadata || constructorMetadata;
        return {
          classMetadata: sharedContent,
          constructorMetadata: sharedContent,
        };

      case 'primary-secondary':
        // Primary gets full content, secondary gets abbreviated
        if (classMetadata && constructorMetadata) {
          const abbreviated = this.createAbbreviatedMetadata(constructorMetadata);
          return { classMetadata, constructorMetadata: abbreviated };
        }
        return { classMetadata, constructorMetadata };

      default:
        return { classMetadata, constructorMetadata };
    }
  }

  /**
   * Create abbreviated metadata for secondary documentation target
   */
  createAbbreviatedMetadata(metadata) {
    return {
      description: `See class documentation for details.`,
      ...metadata, // Keep parameters, returns, etc.
    };
  }

  /**
   * Enhanced file processing with flexible placement
   */
  async processFileWithPlacement(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(`\n🔧 Processing: ${path.relative(this.rootDir, filePath)}`);

    let modifiedContent = content;
    let hasChanges = false;

    // Extract class name from file
    const classMatches = Array.from(content.matchAll(/export\s+(?:declare\s+)?class\s+(\w+)/g));
    const className =
      classMatches.length > 0 ? classMatches[0][1] : this.guessClassNameFromFile(filePath);

    if (!className) {
      console.log('⚠️  No class found in file');
      return content;
    }

    console.log(`  📋 Detected class: ${className}`);

    // Get placement configuration
    const config = this.getPlacementConfig(className);
    console.log(`  ⚙️  Placement config:`, config);

    // Determine documentation targets
    const targets = this.getDocumentationTargets(className, content, config);

    // Process class documentation
    if (targets.class) {
      const classMetadata = this.getTargetMetadata(className, 'class', config);
      if (classMetadata) {
        const result = this.injectClassDocumentation(modifiedContent, className, classMetadata);
        modifiedContent = result.content;
        hasChanges = hasChanges || result.hasChanges;
      }
    }

    // Process constructor documentation
    if (targets.constructor) {
      const constructorMetadata = this.getTargetMetadata(className, 'constructor', config);
      if (constructorMetadata) {
        const result = this.injectConstructorDocumentation(
          modifiedContent,
          className,
          constructorMetadata
        );
        modifiedContent = result.content;
        hasChanges = hasChanges || result.hasChanges;
      }
    }

    if (hasChanges) {
      console.log('✅ File processed with enhanced placement strategy');
    } else {
      console.log('ℹ️  No changes needed');
    }

    return modifiedContent;
  }

  /**
   * Inject JSDoc documentation for class declaration
   */
  injectClassDocumentation(content, className, metadata) {
    // Find class declaration
    const classRegex = new RegExp(
      `(\/\\*\\*[\\s\\S]*?\\*\/\\s*)?export\\s+(?:declare\\s+)?class\\s+${className}`,
      'g'
    );

    const match = classRegex.exec(content);
    if (!match) {
      console.log(`  ⚠️  Could not find class declaration for ${className}`);
      return { content, hasChanges: false };
    }

    const newJSDoc = this.buildJSDoc(metadata, null, className);
    let newContent;

    if (match[1]) {
      // Replace existing JSDoc
      const existingJSDoc = match[1];
      newContent = content.replace(existingJSDoc, newJSDoc + '\n');
    } else {
      // Add new JSDoc before class declaration
      const classStart = match.index;
      newContent =
        content.substring(0, classStart) + newJSDoc + '\n' + content.substring(classStart);
    }

    console.log(`  ✅ Injected class documentation for ${className}`);
    return { content: newContent, hasChanges: true };
  }

  /**
   * Inject JSDoc documentation for constructor
   */
  injectConstructorDocumentation(content, className, metadata) {
    // Find constructor declaration
    const constructorRegex = new RegExp(
      `(\\s*)(\/\\*\\*[\\s\\S]*?\\*\/\\s*)?constructor\\s*\\([^)]*\\)\\s*;`,
      'g'
    );

    const match = constructorRegex.exec(content);
    if (!match) {
      console.log(`  ⚠️  Could not find constructor declaration for ${className}`);
      return { content, hasChanges: false };
    }

    const leadingWhitespace = match[1];
    const newJSDoc = this.buildJSDoc(metadata, 'constructor', className);

    // Format JSDoc with proper indentation
    const formattedJSDoc = newJSDoc
      .split('\n')
      .map(line => leadingWhitespace + line)
      .join('\n');

    let newContent;

    if (match[2]) {
      // Replace existing JSDoc
      const existingJSDoc = match[2];
      newContent = content.replace(
        match[0],
        leadingWhitespace +
          formattedJSDoc +
          '\n' +
          leadingWhitespace +
          'constructor' +
          match[0].substring(match[0].lastIndexOf('constructor') + 11)
      );
    } else {
      // Add new JSDoc before constructor
      newContent = content.replace(match[0], formattedJSDoc + '\n' + match[0]);
    }

    console.log(`  ✅ Injected constructor documentation for ${className}`);
    return { content: newContent, hasChanges: true };
  }

  // Include all the existing utility methods from the original script
  classHasConstructor(className, fileContent) {
    const classRegex = new RegExp(
      `export\\s+(?:declare\\s+)?class\\s+${className}[^{]*\\{([\\s\\S]*?)\\}\\s*(?:export|$)`,
      'm'
    );

    const classMatch = classRegex.exec(fileContent);
    if (!classMatch) return false;

    const classBody = classMatch[1];
    return /constructor\s*\(/.test(classBody);
  }

  getClassMetadata(className) {
    const classKey = className.toLowerCase();
    return this.classMetadata.get(classKey) || null;
  }

  guessClassNameFromFile(filePath) {
    const fileName = path.basename(filePath, '.d.ts');
    return fileName
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  // Include existing metadata loading and resolution methods
  async loadHierarchicalMetadata() {
    console.log('📂 Loading enhanced hierarchical metadata...');

    // Load global metadata
    this.globalMetadata = await this.loadYamlFile(
      path.join(this.rootDir, 'docs', 'global-settings.yaml')
    );
    if (this.globalMetadata) {
      console.log('✅ Global metadata loaded');
    }

    // Load package metadata
    const packageMeta = await this.loadYamlFile(
      path.join(this.rootDir, 'packages', 'aggregates', '.md-settings.yaml')
    );
    if (packageMeta) {
      this.packageMetadata.set('aggregates', packageMeta);
      console.log('✅ Package metadata loaded for aggregates');
    }

    // Load class metadata
    const classMeta = await this.loadYamlFile(
      path.join(this.rootDir, 'docs', 'examples', 'domain', 'aggregates', 'aggregate-root.yaml')
    );
    if (classMeta) {
      this.classMetadata.set('aggregateroot', classMeta);
      console.log('✅ Class metadata loaded for AggregateRoot');
    }
  }

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
        console.warn(`⚠️  Error loading ${filePath}: ${error.message}`);
      }
      return null;
    }
  }

  resolveMetadata(className, methodName, packageName = 'aggregates') {
    // Simplified version - include full implementation from original script
    const resolved = {};

    if (this.globalMetadata) {
      Object.assign(resolved, this.globalMetadata);
    }

    const packageMeta = this.packageMetadata.get(packageName);
    if (packageMeta) {
      Object.assign(resolved, packageMeta);
    }

    const classMeta = this.classMetadata.get(className.toLowerCase());
    if (classMeta) {
      if (methodName && classMeta.classes?.[className]?.methods?.[methodName]) {
        Object.assign(resolved, classMeta.classes[className].methods[methodName]);
      } else if (methodName && classMeta.methods?.[methodName]) {
        Object.assign(resolved, classMeta.methods[methodName]);
      } else {
        Object.assign(resolved, classMeta);
      }
    }

    return resolved;
  }

  buildJSDoc(metadata, methodName = null, className = null) {
    const lines = ['/**'];

    // Build JSDoc from metadata (simplified version)
    if (metadata.description) {
      lines.push(` * ${metadata.description}`);
    }

    if (metadata['business-context']) {
      lines.push(` * @businessContext ${metadata['business-context']}`);
    }

    // Add parameters
    if (metadata.parameters) {
      metadata.parameters.forEach(param => {
        lines.push(` * @param {${param.type || '*'}} ${param.name} - ${param.description}`);
      });
    }

    // Add returns
    if (metadata.returns) {
      lines.push(` * @returns {${metadata.returns.type || '*'}} ${metadata.returns.description}`);
    }

    // Add examples
    if (metadata.examples && metadata.examples.length > 0) {
      lines.push(` * @example`);
      lines.push(` * \`\`\`typescript`);
      metadata.examples.forEach((example, index) => {
        if (index > 0) {
          lines.push(` * `);
        }
        example.code.split('\n').forEach(codeLine => {
          lines.push(` * ${codeLine}`);
        });
      });
      lines.push(` * \`\`\``);
    }

    lines.push(' */');
    return lines.join('\n');
  }
}

// Export for testing
module.exports = { EnhancedJSDocPlacer };

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const packageName = args.find(arg => arg.startsWith('--package='))?.split('=')[1] || 'aggregates';

  console.log('🚀 Enhanced YAML JSDoc Injection with Flexible Placement');
  console.log('========================================================');
  console.log(`Package: ${packageName}`);
  console.log(`Dry run: ${dryRun}`);

  const placer = new EnhancedJSDocPlacer(process.cwd());

  try {
    await placer.loadHierarchicalMetadata();

    // Process files with enhanced placement strategy
    const pattern = path.join(process.cwd(), 'packages', packageName, 'dist', '**', '*.d.ts');
    const files = globSync(pattern);

    console.log(`Found ${files.length} .d.ts files`);

    for (const file of files) {
      const processedContent = await placer.processFileWithPlacement(file);

      if (!dryRun) {
        await fs.writeFile(file, processedContent);
      } else {
        console.log(`🔍 Dry run - would write to: ${file}`);
      }
    }

    console.log('\n✅ Enhanced injection completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
