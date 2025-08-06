#!/usr/bin/env node

/**
 * YAML Front Matter JSDoc Injection Script
 * Processes .d.ts files and injects JSDoc from YAML metadata
 */

const fs = require('fs').promises;
const path = require('path');
const { globSync } = require('glob');
const matter = require('gray-matter');

class YamlJSDocInjector {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.globalMetadata = null;
    this.packageMetadata = new Map();
    this.classMetadata = new Map();
    this.cache = new Map();
    this.debug = process.env.JSDOC_DEBUG === 'true';
  }

  /**
   * Extract package name from file path
   * e.g., "packages/aggregates/dist/core/aggregate-root.d.ts" -> "aggregates"
   */
  extractPackageFromPath(filePath) {
    const match = filePath.match(/packages\/([^\/]+)\//);
    return match ? match[1] : 'unknown';
  }

  // NEW: Get JSDoc placement configuration from hierarchical metadata
  getJSDocPlacementConfig(className, packageName) {
    const config = {
      placementStrategy: 'separate',
      classDocumentation: 'enabled',
      constructorDocumentation: 'enabled',
      contentStrategy: 'distinct'
    };

    // Apply global defaults
    if (this.globalMetadata?.jsdoc) {
      const global = this.globalMetadata.jsdoc;
      config.placementStrategy = global['placement-strategy'] || config.placementStrategy;
      config.classDocumentation = global['class-documentation'] || config.classDocumentation;
      config.constructorDocumentation = global['constructor-documentation'] || config.constructorDocumentation;
      config.contentStrategy = global['content-strategy'] || config.contentStrategy;
    }

    // Apply package-level overrides
    const packageMeta = this.packageMetadata.get(packageName);
    if (packageMeta?.jsdoc) {
      const pkg = packageMeta.jsdoc;
      config.placementStrategy = pkg['placement-strategy'] || config.placementStrategy;
      config.classDocumentation = pkg['class-documentation'] || config.classDocumentation;
      config.constructorDocumentation = pkg['constructor-documentation'] || config.constructorDocumentation;
      config.contentStrategy = pkg['content-strategy'] || config.contentStrategy;
    }

    // Apply class-level overrides
    const classMeta = this.classMetadata.get(className.toLowerCase());
    const classSpecificMeta = classMeta?.classes?.[className];
    if (classSpecificMeta?.jsdoc) {
      const cls = classSpecificMeta.jsdoc;
      config.placementStrategy = cls['placement-strategy'] || config.placementStrategy;
      config.classDocumentation = cls['class-documentation'] || config.classDocumentation;
      config.constructorDocumentation = cls['constructor-documentation'] || config.constructorDocumentation;
      config.contentStrategy = cls['content-strategy'] || config.contentStrategy;
    }

    if (this.debug) {
      console.log(`  🎯 JSDoc placement config for ${className}: ${JSON.stringify(config)}`);
    }
    return config;
  }

  // NEW: Determine documentation targets based on placement strategy
  getDocumentationTargets(className, fileContent, packageName) {
    const config = this.getJSDocPlacementConfig(className, packageName);
    const hasConstructor = this.classHasConstructor(className, fileContent);
    
    const targets = {
      documentClass: false,
      documentConstructor: false,
      strategy: config.placementStrategy
    };

    switch (config.placementStrategy) {
      case 'separate':
        targets.documentClass = config.classDocumentation === 'enabled';
        targets.documentConstructor = config.constructorDocumentation === 'enabled' && hasConstructor;
        if (this.debug) {
          console.log(`  📋 Strategy "separate": class=${targets.documentClass}, constructor=${targets.documentConstructor}`);
        }
        break;
        
      case 'constructor-only':
        targets.documentClass = false;
        targets.documentConstructor = hasConstructor;
        if (this.debug) {
          console.log(`  🏗️ Strategy "constructor-only": only constructor documentation`);
        }
        break;
        
      case 'class-only':
        targets.documentClass = true;
        targets.documentConstructor = false;
        if (this.debug) {
          console.log(`  📋 Strategy "class-only": only class documentation`);
        }
        break;
        
      case 'smart':
        // Smart strategy: prefer separate if both have content, fallback to single location
        const classMeta = this.classMetadata.get(className.toLowerCase());
        const classSpecificMeta = classMeta?.classes?.[className];
        const hasClassDoc = !!classSpecificMeta?.['class-doc'];
        const hasConstructorDoc = !!classSpecificMeta?.methods?.constructor;
        
        if (hasClassDoc && hasConstructorDoc && hasConstructor) {
          targets.documentClass = true;
          targets.documentConstructor = true;
          if (this.debug) {
            console.log(`  🧠 Strategy "smart": both class and constructor have content - using separate`);
          }
        } else if (hasConstructorDoc && hasConstructor) {
          targets.documentClass = false;
          targets.documentConstructor = true;
          if (this.debug) {
            console.log(`  🧠 Strategy "smart": only constructor has content - using constructor-only`);
          }
        } else {
          targets.documentClass = true;
          targets.documentConstructor = false;
          if (this.debug) {
            console.log(`  🧠 Strategy "smart": using class-only as fallback`);
          }
        }
        break;
        
      default:
        console.warn(`  ⚠️ Unknown placement strategy: ${config.placementStrategy}, falling back to separate`);
        targets.documentClass = true;
        targets.documentConstructor = hasConstructor;
    }

    return targets;
  }

  // LEGACY: Helper to determine where class documentation should go (backward compatibility)
  getClassDocumentationTarget(classMetadata, className = 'AggregateRoot', fileContent = '') {
    // This method is kept for backward compatibility
    // NEW CODE SHOULD USE getDocumentationTargets() instead
    
    const targets = this.getDocumentationTargets(className, fileContent);
    
    if (targets.documentClass && targets.documentConstructor) {
      return 'separate'; // New return value for separate strategy
    } else if (targets.documentConstructor) {
      return 'constructor';
    } else if (targets.documentClass) {
      return 'class';
    } else {
      return 'none';
    }
  }
  
  // Helper to check if class has a constructor in the TypeScript file
  classHasConstructor(className, fileContent) {
    // Look for constructor in the class
    const classRegex = new RegExp(
      `export\\s+(?:declare\\s+)?class\\s+${className}[^{]*\\{([\\s\\S]*?)\\}\\s*(?:export|$)`,
      'm'
    );
    
    const classMatch = classRegex.exec(fileContent);
    if (!classMatch) return false;
    
    const classBody = classMatch[1];
    // Check for constructor declaration
    return /constructor\s*\(/.test(classBody);
  }

  async loadYamlFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      // Handle pure YAML files
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

  // NEW: Load package-specific metadata dynamically
  async loadPackageMetadata(packageName) {
    if (this.packageMetadata.has(packageName)) {
      return; // Already loaded
    }

    // Try new location first
    let packageMeta = await this.loadYamlFile(
      path.join(this.rootDir, 'docs', 'examples', 'domain', packageName, '.md-settings.yaml')
    );
    
    // Fallback to old location for backward compatibility
    if (!packageMeta) {
      packageMeta = await this.loadYamlFile(
        path.join(this.rootDir, 'packages', packageName, '.md-settings.yaml')
      );
      if (packageMeta) {
        console.log(`⚠️  Using package metadata from legacy location for ${packageName} - consider moving to docs/examples/domain/${packageName}/`);
      }
    }
    
    if (packageMeta) {
      this.packageMetadata.set(packageName, packageMeta);
      console.log(`✅ Package metadata loaded for ${packageName}`);
    }
  }

  // NEW: Load class-specific metadata dynamically
  async loadClassMetadata(packageName, className) {
    const key = `${packageName}-${className.toLowerCase()}`;
    if (this.classMetadata.has(key)) {
      return; // Already loaded
    }

    // Try to load from kebab-case filename (e.g., AggregateRoot -> aggregate-root.yaml)
    const kebabFileName = className
      .replace(/([A-Z])/g, (match, letter, index) => index === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`)
      .replace(/^-/, ''); // Remove leading dash
      
    const classMeta = await this.loadYamlFile(
      path.join(this.rootDir, 'docs', 'examples', 'domain', packageName, `${kebabFileName}.yaml`)
    );
    if (classMeta) {
      this.classMetadata.set(key, classMeta);
      if (this.debug) {
        console.log(`✅ Class metadata loaded for ${className} in ${packageName} from ${kebabFileName}.yaml`);
      }
    }
  }

  async loadHierarchicalMetadata() {
    console.log('📂 Loading hierarchical metadata...');
    
    // 1. Global metadata
    this.globalMetadata = await this.loadYamlFile(
      path.join(this.rootDir, 'docs', 'global-settings.yaml')
    );
    if (this.globalMetadata) {
      console.log('✅ Global metadata loaded');
    }

    // 2. Package and class metadata will be loaded dynamically as needed
    // This improves performance and supports multiple packages
  }

  // NEW: Apply format-specific overrides to metadata (supports nested formats)
  applyFormatOverrides(metadata, format = 'jsdoc') {
    const result = { ...metadata };
    
    // Apply format overrides at each level
    this.applyFormatOverridesRecursive(result, format);
    
    if (this.debug) {
      console.log(`  🎨 Applied ${format} format overrides recursively`);
    }
    return result;
  }

  // NEW: Recursively apply format overrides to nested structures with fallback
  applyFormatOverridesRecursive(obj, format) {
    if (!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      if (key === 'formats' && value[format]) {
        // Apply format-specific overrides to parent object
        const formatOverrides = value[format];
        Object.keys(formatOverrides).forEach(overrideKey => {
          if (overrideKey !== 'formats') { // Prevent infinite recursion
            // CRITICAL: Override only if format-specific value exists
            // If no format-specific value, keep the general one as fallback
            if (formatOverrides[overrideKey] !== undefined && formatOverrides[overrideKey] !== null) {
              console.log(`    🎨 Overriding "${overrideKey}" with ${format}-specific value`);
              obj[overrideKey] = formatOverrides[overrideKey];
            } else {
              console.log(`    ⚪ Keeping general "${overrideKey}" - no ${format}-specific override`);
            }
          }
        });
        
        // Remove formats to avoid confusion
        delete obj.formats;
        console.log(`    ✅ Applied ${format} format overrides with fallback to general values`);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Recursively process nested objects
        this.applyFormatOverridesRecursive(value, format);
      } else if (Array.isArray(value)) {
        // Process arrays that might contain objects with formats
        value.forEach(item => {
          if (typeof item === 'object') {
            this.applyFormatOverridesRecursive(item, format);
          }
        });
      }
    });
  }

  resolveMetadata(className, methodName, packageName, format = 'jsdoc') {
    const resolved = {};
    
    // Apply hierarchical resolution with format overrides at each level
    if (this.globalMetadata) {
      let globalWithFormat = { ...this.globalMetadata };
      // Apply format overrides to global metadata only
      if (globalWithFormat.formats?.[format]) {
        Object.assign(globalWithFormat, globalWithFormat.formats[format]);
        delete globalWithFormat.formats;
      }
      this.mergeMetadata(resolved, globalWithFormat);
    }
    
    const packageMeta = this.packageMetadata.get(packageName);
    if (packageMeta) {
      let packageWithFormat = { ...packageMeta };
      // Apply format overrides to package metadata only
      if (packageWithFormat.formats?.[format]) {
        Object.assign(packageWithFormat, packageWithFormat.formats[format]);
        delete packageWithFormat.formats;
      }
      this.mergeMetadata(resolved, packageWithFormat);
    }
    
    const key = `${packageName}-${className.toLowerCase()}`;
    const classMeta = this.classMetadata.get(key);
    if (classMeta) {
      // Handle both old and new YAML structures
      // NEW: Universal structure with classes.ClassName.methods
      // OLD: Direct methods at root level
      
      let classSpecificMeta = null;
      let methodMetadata = null;
      let classStrategy = 'merge'; // Default strategy
      
      // Try new universal structure first: classes.ClassName
      if (classMeta.classes?.[className]) {
        classSpecificMeta = classMeta.classes[className];
        classStrategy = classSpecificMeta.hierarchy?.strategy || 'merge';
        if (this.debug) {
          console.log(`  📊 Found class metadata for ${className} in universal structure (strategy: ${classStrategy})`);
        }
        
        // CRITICAL: If class uses "replace" strategy, clear previous metadata first
        if (classStrategy === 'replace') {
          if (this.debug) {
            console.log(`  🔄 Applying "replace" strategy - clearing previous metadata`);
          }
          // Clear fields that exist in class metadata
          Object.keys(classSpecificMeta).forEach(key => {
            if (key !== 'hierarchy' && key !== 'methods' && key !== 'environment') {
              delete resolved[key];
            }
          });
        }
        
        // Apply class-level metadata with strategy-aware merging and format overrides
        // Skip class-doc section here - it's handled separately
        let classMetaForMerging = { ...classSpecificMeta };
        delete classMetaForMerging['class-doc'];
        
        // Apply format overrides to class metadata only
        if (classMetaForMerging.formats?.[format]) {
          Object.assign(classMetaForMerging, classMetaForMerging.formats[format]);
          delete classMetaForMerging.formats;
        }
        
        this.mergeMetadata(resolved, classMetaForMerging);
        
        // CRITICAL: Preserve the hierarchy strategy for buildJSDoc()
        if (classStrategy === 'replace') {
          resolved.hierarchy = { strategy: 'replace', scope: 'class' };
          console.log(`  ✅ Preserved "replace" strategy in resolved metadata for buildJSDoc()`);
        }
        if (this.debug) {
          console.log(`  🔍 DEBUG: After class metadata, resolved contains:`, Object.keys(resolved));
          console.log(`  🔍 DEBUG: description = "${resolved.description}"`);
          console.log(`  🔍 DEBUG: business-context = "${resolved['business-context']}"`);
          console.log(`  🔍 DEBUG: businessContext = "${resolved.businessContext}"`);
        }
        
        // CRITICAL FIX: Handle special __class-doc__ case for class documentation
        if (methodName === '__class-doc__' && classSpecificMeta['class-doc']) {
          methodMetadata = classSpecificMeta['class-doc'];
          console.log(`  📊 Found class-doc metadata for ${className} in universal structure`);
        }
        // Get method metadata from class structure
        else if (methodName && classSpecificMeta.methods?.[methodName]) {
          methodMetadata = classSpecificMeta.methods[methodName];
          console.log(`  📊 Found method metadata for ${className}.${methodName} in universal structure`);
        }
        
      }
      // Fall back to old structure: direct methods at root
      else if (classMeta.methods) {
        classStrategy = classMeta.hierarchy?.strategy || 'merge';
        console.log(`  📊 Using legacy structure for ${className} (strategy: ${classStrategy})`);
        
        // CRITICAL: If class uses "replace" strategy, clear previous metadata first
        if (classStrategy === 'replace') {
          if (this.debug) {
            console.log(`  🔄 Applying "replace" strategy - clearing previous metadata`);
          }
          Object.keys(classMeta).forEach(key => {
            if (key !== 'hierarchy' && key !== 'methods' && key !== 'environment') {
              delete resolved[key];
            }
          });
        }
        
        this.mergeMetadata(resolved, classMeta);
        
        // Get method metadata from root level
        if (methodName && classMeta.methods?.[methodName]) {
          methodMetadata = classMeta.methods[methodName];
          console.log(`  📊 Found method metadata for ${className}.${methodName} in legacy structure`);
        }
        
      }
      // Apply file-level metadata if no specific class structure found
      else {
        console.log(`  📊 Applying file-level metadata for ${className}`);
        this.mergeMetadata(resolved, classMeta);
      }
      
      // Apply method-specific metadata
      if (methodMetadata) {
        const methodStrategy = methodMetadata.hierarchy?.strategy || 'merge';
        console.log(`  📊 Applying method metadata with strategy: ${methodStrategy}`);
        
        // CRITICAL: For methods, remove global metadata pollution (author, license, etc.)
        // but keep class-specific metadata (description, business-context)
        // EXCEPTION: Don't remove global metadata for __class-doc__ as it represents the class itself
        if (methodName && methodName !== '__class-doc__') {
          const globalMetadataKeys = ['author', 'license', 'documentationUrl', 'displayName', 'domain', 'documentation-url', 'display-name'];
          globalMetadataKeys.forEach(key => {
            if (resolved[key]) {
              console.log(`  🧹 Removing global metadata "${key}" from method ${methodName}`);
              delete resolved[key];
            }
          });
        }
        
        // CRITICAL: If method uses "replace" strategy, clear previous metadata first
        if (methodStrategy === 'replace') {
          console.log(`  🔄 Applying method "replace" strategy - clearing previous metadata`);
          Object.keys(methodMetadata).forEach(key => {
            if (key !== 'hierarchy' && key !== 'methods' && key !== 'environment') {
              delete resolved[key];
            }
          });
        }
        
        // Apply format overrides to method metadata only
        let methodMetadataWithFormat = { ...methodMetadata };
        if (methodMetadataWithFormat.formats?.[format]) {
          Object.assign(methodMetadataWithFormat, methodMetadataWithFormat.formats[format]);
          delete methodMetadataWithFormat.formats;
        }
        
        this.mergeMetadata(resolved, methodMetadataWithFormat);
        console.log(`  ✅ Applied method metadata for ${methodName}`);
        if (this.debug) {
          console.log(`  🔍 DEBUG: Final resolved metadata contains:`, Object.keys(resolved));
          console.log(`  🔍 DEBUG: description = "${resolved.description}"`);
          console.log(`  🔍 DEBUG: business-context = "${resolved['business-context']}"`);
          console.log(`  🔍 DEBUG: businessContext = "${resolved.businessContext}"`);
        }
      } else if (methodName) {
        console.log(`  ⚠️  No method metadata found for ${className}.${methodName}`);
      }
    }

    // Apply environment-specific metadata
    if (process.env.VYTCHES_LOGGER === 'true') {
      if (this.globalMetadata?.environment?.VYTCHES_LOGGER) {
        this.mergeMetadata(resolved, this.globalMetadata.environment.VYTCHES_LOGGER);
      }
      if (classMeta?.environment?.VYTCHES_LOGGER?.methods?.[methodName]) {
        this.mergeMetadata(resolved, classMeta.environment.VYTCHES_LOGGER.methods[methodName]);
      }
    }

    // If no specific metadata found, use defaults for non-AggregateRoot classes
    if (Object.keys(resolved).length === 0 && className !== 'AggregateRoot') {
      return this.getDefaultMetadata(className, methodName);
    }

    return resolved;
  }

  getDefaultMetadata(className, methodName) {
    // Return default metadata for classes without specific YAML files
    const defaults = {
      description: `${className} functionality for domain modeling and event sourcing`,
      businessContext: `Enterprise-grade ${className.toLowerCase()} operations for domain-driven architecture`
    };

    // Method-specific defaults
    if (methodName) {
      defaults.description = `${className}.${methodName} method implementation`;
      defaults.businessContext = `Business operation: ${methodName} for ${className}`;
    }

    return defaults;
  }

  mergeMetadata(target, source) {
    const strategy = source.hierarchy?.strategy || 'merge';
    
    Object.keys(source).forEach(key => {
      // Skip metadata control keys and formats (formats should be processed earlier)
      if (key === 'hierarchy' || key === 'methods' || key === 'environment' || key === 'formats') return;
      
      if (key === 'custom-tags' && target['custom-tags']) {
        target['custom-tags'] = { ...target['custom-tags'], ...source['custom-tags'] };
      } else if (strategy === 'replace') {
        target[key] = source[key];
      } else if (strategy === 'merge' && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = { ...(target[key] || {}), ...source[key] };
      } else {
        target[key] = source[key];
      }
    });
  }

  // NEW: Generate class-level JSDoc from class-doc section
  generateClassJSDoc(className, packageName, format = 'jsdoc') {
    const key = `${packageName}-${className.toLowerCase()}`;
    const classMeta = this.classMetadata.get(key);
    if (!classMeta) return null;

    const classSpecificMeta = classMeta.classes?.[className];
    if (!classSpecificMeta?.['class-doc']) return null;

    // CRITICAL FIX: Use resolveMetadata to get hierarchical inheritance
    // This ensures global metadata (like author) is properly inherited
    const resolvedMetadata = this.resolveMetadata(className, '__class-doc__', packageName, format);
    
    if (this.debug) {
      console.log(`  📋 Generating class JSDoc for ${className} with ${format} format`);
      console.log(`  🔍 Resolved metadata includes author: ${resolvedMetadata.author || 'NOT FOUND'}`);
    }
    
    return this.buildJSDoc(resolvedMetadata, null, className);
  }

  buildJSDoc(metadata, methodName = null, className = null) {
    const lines = ['/**'];
    
    // CRITICAL: Check hierarchy strategy BEFORE applying format overrides
    const hierarchyStrategy = metadata.hierarchy?.strategy || 'merge';
    if (this.debug) {
      console.log(`  🔍 DEBUG buildJSDoc: Input hierarchy strategy = "${hierarchyStrategy}"`);
      console.log(`  🔍 DEBUG buildJSDoc: Input description = "${metadata.description}"`);
      console.log(`  🔍 DEBUG buildJSDoc: Input has formats.jsdoc = ${!!metadata.formats?.jsdoc}`);
    }
    
    let jsdocFormat = { ...metadata };
    
    // CRITICAL: DO NOT apply format overrides here as it causes hierarchy conflicts
    // Format overrides should have been applied at the appropriate hierarchy level in resolveMetadata
    // This prevents package-level formats from overriding method-level values
    if (this.debug) {
      console.log(`  🔍 DEBUG: Skipping format overrides in buildJSDoc to preserve hierarchy`);
      console.log(`  🔍 DEBUG buildJSDoc: Processing metadata for method: ${methodName || 'class'}`);
      console.log(`  🔍 DEBUG buildJSDoc: description = "${jsdocFormat.description}"`);
      console.log(`  🔍 DEBUG buildJSDoc: business-context = "${jsdocFormat['business-context']}"`);
    }

    // Dynamic property mapping - każda właściwość YAML staje się @tag
    const skipKeys = ['hierarchy', 'formats', 'examples', 'methods', 'environment', 'custom-tags', 
                     'class-name', 'package-name', 'title', 'version', 'complexity', 'parameters', 
                     'returns', 'throws', 'since', 'deprecated'];
    
    Object.entries(jsdocFormat).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim() && !skipKeys.includes(key)) {
        // Convert kebab-case to camelCase for JSDoc tags
        const tag = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        if (this.debug) {
          console.log(`  🔍 DEBUG buildJSDoc: Adding tag @${tag} = "${value}"`);
        }
        lines.push(` * @${tag} ${value}`);
      } else if (typeof value === 'object' && value !== null && !skipKeys.includes(key)) {
        // Log warning for non-string values that are being skipped
        if (this.debug) {
          console.log(`  ⚠️  WARNING: Skipping non-string value for key "${key}" (type: ${typeof value})`);
        }
        if (key === 'formats') {
          if (this.debug) {
            console.log(`  ⚠️  formats object should have been processed earlier in resolveMetadata`);
          }
        }
      }
    });

    // Add custom tags
    if (metadata['custom-tags']) {
      Object.entries(metadata['custom-tags']).forEach(([key, value]) => {
        lines.push(` * @${key} ${value}`);
      });
    }

    // Add parameters if defined
    if (metadata.parameters) {
      metadata.parameters.forEach(param => {
        lines.push(` * @param {${param.type || '*'}} ${param.name} - ${param.description}`);
      });
    }

    // Add returns if defined
    if (metadata.returns) {
      lines.push(` * @returns {${metadata.returns.type || '*'}} ${metadata.returns.description}`);
    }

    // Add throws if defined
    if (metadata.throws) {
      metadata.throws.forEach(throwItem => {
        lines.push(` * @throws {${throwItem.type || 'Error'}} ${throwItem.description}`);
      });
    }

    // Add examples
    if (metadata.examples && metadata.examples.length > 0) {
      lines.push(` * @example`);
      lines.push(` * \`\`\`typescript`);
      metadata.examples.forEach((example, index) => {
        if (index > 0) {
          lines.push(` * `);
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

  // NEW: Extract all TypeScript elements from file content
  extractFileElements(content) {
    const elements = {
      interfaces: [],
      types: [],
      enums: [],
      functions: [],
      classes: []
    };

    // Remove JSDoc comments from content to avoid false matches
    const contentWithoutJSDoc = content.replace(/\/\*\*[\s\S]*?\*\//g, '');

    // Extract interfaces (both export and non-export)
    const interfaceMatches = Array.from(contentWithoutJSDoc.matchAll(/(?:export\s+)?(?:declare\s+)?interface\s+(\w+)/g));
    interfaceMatches.forEach(match => {
      elements.interfaces.push(match[1]);
    });

    // Extract type aliases (both export and non-export)
    // More precise regex to match actual type declarations
    const typeMatches = Array.from(contentWithoutJSDoc.matchAll(/(?:export\s+)?(?:declare\s+)?type\s+(\w+)\s*=/g));
    typeMatches.forEach(match => {
      elements.types.push(match[1]);
    });

    // Extract enums (both export and non-export)
    const enumMatches = Array.from(contentWithoutJSDoc.matchAll(/(?:export\s+)?(?:declare\s+)?enum\s+(\w+)/g));
    enumMatches.forEach(match => {
      elements.enums.push(match[1]);
    });

    // Extract functions (both export and non-export)
    const functionMatches = Array.from(contentWithoutJSDoc.matchAll(/(?:export\s+)?(?:declare\s+)?function\s+(\w+)/g));
    functionMatches.forEach(match => {
      elements.functions.push(match[1]);
    });

    // Extract classes (both export and non-export, including abstract classes)
    const classMatches = Array.from(contentWithoutJSDoc.matchAll(/(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?class\s+(\w+)/g));
    classMatches.forEach(match => {
      elements.classes.push(match[1]);
    });

    if (this.debug) {
      console.log(`  🔍 Found elements: interfaces=${elements.interfaces.length}, types=${elements.types.length}, enums=${elements.enums.length}, functions=${elements.functions.length}, classes=${elements.classes.length}`);
    }
    
    return elements;
  }

  // NEW: Process file-level elements with YAML metadata
  async processFileElements(content, elements, packageName, className) {
    // Debug: Print all available metadata keys
    if (this.debug) {
      console.log(`  🔍 DEBUG: Available class metadata keys: ${Array.from(this.classMetadata.keys()).join(', ')}`);
    }
    
    // CRITICAL FIX: File-level elements are at the root level of YAML, not class-specific
    const key = `${packageName}-${className.toLowerCase()}`;
    const classMetadata = this.classMetadata.get(key);
    
    if (!classMetadata) {
      console.log(`  ℹ️  No file-level metadata found for key ${key}`);
      return content;
    }
    
    if (this.debug) {
      console.log(`  ✅ Found metadata for key ${key}`);
    }

    let updatedContent = content;
    
    // Process each element type - file-level elements are at root level of YAML
    for (const [elementType, elementNames] of Object.entries(elements)) {
      if (elementNames.length === 0 || !classMetadata[elementType]) continue;
      
      if (this.debug) {
        console.log(`  🔄 Processing ${elementType}: ${elementNames.join(', ')}`);
      }
      
      for (const elementName of elementNames) {
        const elementMetadata = classMetadata[elementType]?.[elementName];
        if (!elementMetadata) {
          console.log(`    ⚠️  No metadata found for ${elementType}.${elementName}`);
          continue;
        }
        
        // Generate JSDoc for this element
        const jsDoc = this.generateElementJSDoc(elementType, elementName, elementMetadata);
        if (jsDoc) {
          // Find and replace/add JSDoc for this element
          updatedContent = this.injectElementJSDoc(updatedContent, elementType, elementName, jsDoc);
          if (this.debug) {
            console.log(`    ✅ Generated JSDoc for ${elementType}.${elementName}`);
          }
        }
      }
    }
    
    return updatedContent;
  }

  // NEW: Generate JSDoc for file-level elements
  generateElementJSDoc(elementType, elementName, metadata) {
    const lines = [];
    lines.push('/**');
    
    // Add description
    if (metadata.description) {
      lines.push(` * ${metadata.description}`);
    }
    
    // Add business context
    if (metadata['business-context']) {
      lines.push(` * @businessContext ${metadata['business-context']}`);
    }
    
    // Add custom tags
    if (metadata['custom-tags']) {
      Object.entries(metadata['custom-tags']).forEach(([tag, value]) => {
        lines.push(` * @${tag} ${value}`);
      });
    }
    
    // Element-specific additions
    switch (elementType) {
      case 'interfaces':
        if (metadata.properties) {
          metadata.properties.forEach(prop => {
            lines.push(` * @property {${prop.type}} ${prop.name} - ${prop.description}`);
          });
        }
        break;
        
      case 'functions':
        if (metadata.parameters) {
          metadata.parameters.forEach(param => {
            const optional = param.optional ? ' - Optional. ' : ' - ';
            lines.push(` * @param {${param.type}} ${param.name}${optional}${param.description}`);
          });
        }
        if (metadata.returns) {
          lines.push(` * @returns {${metadata.returns.type}} ${metadata.returns.description}`);
        }
        break;
        
      case 'enums':
        if (metadata.values) {
          metadata.values.forEach(val => {
            lines.push(` * @value ${val.name} ${val.value} - ${val.description}`);
          });
        }
        break;
        
      case 'types':
        if (metadata['custom-tags']?.composition) {
          lines.push(` * @composition ${metadata['custom-tags'].composition}`);
        }
        break;
    }
    
    // Add examples
    if (metadata.examples) {
      lines.push(` * @example`);
      lines.push(` * \`\`\`typescript`);
      metadata.examples.forEach(example => {
        if (example.code) {
          example.code.split('\n').forEach(codeLine => {
            lines.push(` * ${codeLine}`);
          });
        }
      });
      lines.push(` * \`\`\``);
    }
    
    lines.push(' */');
    return lines.join('\n');
  }

  // NEW: Inject JSDoc for file-level elements
  injectElementJSDoc(content, elementType, elementName, jsDoc) {
    // Create regex patterns for different element types
    let elementRegex;
    
    switch (elementType) {
      case 'interfaces':
        // More precise regex to match interface declarations only
        // Look for "export interface" at word boundaries, NOT preceded by JSDoc
        elementRegex = new RegExp(
          `^((?:export\\s+)?(?:declare\\s+)?interface\\s+${elementName}\\b)`,
          'gm'
        );
        break;
      case 'types':
        // More precise regex to match type declarations only
        // Look for "export type" at word boundaries, NOT preceded by JSDoc
        elementRegex = new RegExp(
          `^((?:export\\s+)?(?:declare\\s+)?type\\s+${elementName}\\b)`,
          'gm'
        );
        break;
      case 'enums':
        // More precise regex to match enum declarations only
        // Look for "export enum" at word boundaries, NOT preceded by JSDoc
        elementRegex = new RegExp(
          `^((?:export\\s+)?(?:declare\\s+)?enum\\s+${elementName}\\b)`,
          'gm'
        );
        break;
      case 'functions':
        // More precise regex to match function declarations only
        // Look for "export declare function" at the start of a line, NOT preceded by JSDoc
        elementRegex = new RegExp(
          `^(export\\s+declare\\s+function\\s+${elementName}\\s*[<(])`,
          'gm'
        );
        break;
      default:
        return content; // Unknown element type
    }
    
    if (this.debug) {
      console.log(`    🔍 Looking for ${elementType} ${elementName} with regex: ${elementRegex.source}`);
    }
    
    const match = elementRegex.exec(content);
    if (match) {
      if (this.debug) {
        console.log(`    ✅ Found match at index ${match.index}`);
      }
      
      let existingJSDoc, declaration;
      if (elementType === 'functions' || elementType === 'interfaces' || elementType === 'types' || elementType === 'enums') {
        // These regex patterns only capture the declaration, not existing JSDoc
        existingJSDoc = '';
        declaration = match[1];
      } else {
        // Legacy: Other elements capture JSDoc + declaration (for backward compatibility)
        existingJSDoc = match[1] || '';
        declaration = match[2];
      }
      
      // Replace old JSDoc with new JSDoc
      const newContent = content.substring(0, match.index) + 
                        jsDoc + '\n' + declaration + 
                        content.substring(match.index + match[0].length);
      
      if (this.debug) {
        console.log(`    ✅ Injected JSDoc for ${elementType} ${elementName}`);
      }
      return newContent;
    }
    
    if (this.debug) {
      console.log(`    ⚠️  No match found for ${elementType} ${elementName}`);
    }
    return content;
  }

  // NEW: Inject JSDoc for method declarations
  injectMethodJSDoc(content, className, methodName, jsDoc) {
    // Create regex to find method declarations in the class
    // Handle both constructor and regular methods
    let methodRegex;
    
    if (methodName === 'constructor') {
      methodRegex = new RegExp(
        `(/\\*\\*[\\s\\S]*?\\*/\\s*)?(\\s*constructor\\s*\\()`,
        'i'  // Remove 'g' flag to avoid state issues
      );
    } else {
      // Handle various method patterns: protected/private/public methodName(
      methodRegex = new RegExp(
        `(/\\*\\*[\\s\\S]*?\\*/\\s*)?(\\s*(?:protected|private|public)?\\s*${methodName}\\s*[(<])`,
        'i'  // Remove 'g' flag to avoid state issues
      );
    }
    
    if (this.debug) {
      console.log(`    🔍 Looking for method ${methodName} with regex: ${methodRegex.source}`);
    }
    
    // Use match() instead of exec() to avoid regex state issues
    const match = content.match(methodRegex);
    if (match) {
      const matchIndex = content.indexOf(match[0]);
      if (this.debug) {
        console.log(`    ✅ Found method match at index ${matchIndex}`);
      }
      const existingJSDoc = match[1] || '';
      const methodDeclaration = match[2];
      
      // Replace old JSDoc with new JSDoc
      const newContent = content.substring(0, matchIndex) + 
                        jsDoc + '\n' + methodDeclaration + 
                        content.substring(matchIndex + match[0].length);
      
      if (this.debug) {
        console.log(`    ✅ Injected JSDoc for method ${className}.${methodName}`);
      }
      return newContent;
    }
    
    if (this.debug) {
      console.log(`    ⚠️  No match found for method ${className}.${methodName}`);
    }
    return content;
  }

  // NEW: Inject JSDoc for all methods in a single pass to avoid content corruption
  injectAllMethodJSDoc(content, className, methodInjections) {
    console.log(`  🔧 Injecting JSDoc for ${methodInjections.length} methods in ${className}`);
    
    // Create a map of method names to JSDoc for quick lookup
    const methodJSDocMap = new Map();
    for (const { methodName, methodJSDoc } of methodInjections) {
      methodJSDocMap.set(methodName, methodJSDoc);
    }
    
    // CRITICAL FIX: Find the class declaration first to ensure we only look at methods within the class
    // More flexible regex to handle JSDoc comments anywhere before the class declaration (including abstract classes)
    const classStartRegex = new RegExp(`(?:^|\\n)\\s*(?:\\/\\*\\*[\\s\\S]*?\\*\\/\\s*)?export\\s+(?:declare\\s+)?(?:abstract\\s+)?class\\s+${className}[^{]*\\{`, 'gm');
    const classStartMatch = classStartRegex.exec(content);
    
    if (!classStartMatch) {
      console.log(`  ⚠️  Could not find class ${className} declaration, skipping method injection`);
      return content;
    }
    
    // Simpler approach: Find the next export statement or end of file
    let classEndIndex = -1;
    let searchStartIndex = classStartMatch.index + classStartMatch[0].length;
    
    if (this.debug) {
      console.log(`  🔍 DEBUG: Searching for class end starting from index ${searchStartIndex}`);
      console.log(`  🔍 DEBUG: Class start match: "${classStartMatch[0].slice(-20)}"`);
    }
    
    // Look for the next export statement or end of file
    const nextExportRegex = /\n\s*export\s+/g;
    nextExportRegex.lastIndex = searchStartIndex;
    const nextExportMatch = nextExportRegex.exec(content);
    
    if (nextExportMatch) {
      // Find the closing brace before the next export
      let searchIndex = nextExportMatch.index - 1;
      while (searchIndex > searchStartIndex) {
        if (content[searchIndex] === '}') {
          classEndIndex = searchIndex;
          if (this.debug) {
            console.log(`  ✅ DEBUG: Found class end at index ${classEndIndex} (before next export)`);
          }
          break;
        }
        searchIndex--;
      }
    } else {
      // No next export, look for the last closing brace in the file
      for (let i = content.length - 1; i > searchStartIndex; i--) {
        if (content[i] === '}') {
          classEndIndex = i;
          if (this.debug) {
            console.log(`  ✅ DEBUG: Found class end at index ${classEndIndex} (end of file)`);
          }
          break;
        }
      }
    }
    
    if (classEndIndex === -1) {
      console.log(`  ⚠️  Could not find end of class ${className}, skipping method injection`);
      return content;
    }
    
    // Extract only the class body content for method searching
    const classBodyStartIndex = classStartMatch.index + classStartMatch[0].length - 1; // Position of opening brace
    const classBodyContent = content.substring(classBodyStartIndex, classEndIndex + 1);
    console.log(`  📋 Class body from index ${classBodyStartIndex} to ${classEndIndex} (${classBodyContent.length} chars)`);
    
    // Find all method declarations ONLY within the class body
    // FIXED: More precise regex that only matches method declarations at line beginnings
    // Capture full JSDoc block if it exists (including newlines between JSDoc and method)
    const allMethodsRegex = /(\/\*\*[\s\S]*?\*\/\s*)?(\n\s+(?:static\s+)?(?:protected|private|public)?\s*(?:constructor|[a-zA-Z_][a-zA-Z0-9_]*)\s*[(<])/g;
    const methodMatches = [];
    let match;
    
    while ((match = allMethodsRegex.exec(classBodyContent)) !== null) {
      const existingJSDoc = match[1] || '';
      const methodDeclarationFull = match[2];
      const relativeMethodIndex = match.index; // Index relative to class body
      const absoluteMethodIndex = classBodyStartIndex + relativeMethodIndex; // Absolute index in full content
      
      // Extract method name from the declaration
      let extractedMethodName;
      if (methodDeclarationFull.includes('constructor')) {
        extractedMethodName = 'constructor';
      } else {
        // Extract method name from declaration (handle newline + whitespace at start)
        const methodNameMatch = methodDeclarationFull.match(/\n\s+(?:static\s+)?(?:protected|private|public)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[(<]/);
        if (methodNameMatch) {
          extractedMethodName = methodNameMatch[1];
        }
      }
      
      // Check if we have JSDoc for this method
      if (extractedMethodName && methodJSDocMap.has(extractedMethodName)) {
        methodMatches.push({
          methodName: extractedMethodName,
          methodJSDoc: methodJSDocMap.get(extractedMethodName),
          match,
          index: absoluteMethodIndex, // Use absolute index for replacement
          existingJSDoc,
          methodDeclaration: methodDeclarationFull
        });
        if (this.debug) {
          console.log(`    ✅ Found method ${extractedMethodName} at absolute index ${absoluteMethodIndex}`);
        }
      }
    }
    
    // Sort matches by index in reverse order (highest index first)
    // This way we can modify the content from end to beginning without affecting earlier indices
    methodMatches.sort((a, b) => b.index - a.index);
    
    // Apply all injections from end to beginning
    let modifiedContent = content;
    for (const methodMatch of methodMatches) {
      const { methodName, methodJSDoc, match, index, methodDeclaration, existingJSDoc } = methodMatch;
      
      // CRITICAL FIX: Understand what the regex actually captures
      // match[0] = (existing JSDoc) + (method declaration part) 
      // match[1] = existing JSDoc (or null if none)
      // match[2] = method declaration part (starts with \n and spaces)
      
      if (existingJSDoc) {
        // Case 1: Method has existing JSDoc - check if it's already our JSDoc
        // Extract the first meaningful line from our new JSDoc (after /**, skipping empty lines)
        const newJSDocLines = methodJSDoc.split('\n').filter(line => line.trim() && !line.trim().startsWith('/**') && !line.trim().startsWith('*/'));
        const firstNewLine = newJSDocLines[0]?.trim().replace(/^\*\s*/, ''); // Remove leading * and spaces
        
        // Check if existing JSDoc already contains our content
        if (firstNewLine && existingJSDoc.includes(firstNewLine)) {
          console.log(`    ⏭️  Skipping ${className}.${methodName} - JSDoc already up to date`);
          continue; // Skip this method as it already has our JSDoc
        }
        
        // Replace the JSDoc part only
        const jsDocStart = index;
        const jsDocEnd = index + existingJSDoc.length;
        
        const beforeJSDoc = modifiedContent.substring(0, jsDocStart);
        const afterJSDoc = modifiedContent.substring(jsDocEnd);
        
        // Extract indentation from method declaration
        const indentMatch = methodDeclaration.match(/^(\n\s*)/);
        const indent = indentMatch ? indentMatch[1].substring(1) : '    '; // Remove \n and use spaces
        
        // Apply the same indentation to JSDoc
        const indentedJSDoc = methodJSDoc
          .split('\n')
          .map((line, i) => i === 0 ? indent + line : (line.trim() ? indent + line : line))
          .join('\n');
        
        modifiedContent = beforeJSDoc + indentedJSDoc + afterJSDoc;
        console.log(`    ✅ Replaced existing JSDoc for method ${className}.${methodName} with ${indent.length} spaces indentation`);
      } else {
        // Case 2: Method has no existing JSDoc - insert JSDoc before method declaration
        const methodStart = index; // This is where the method declaration part starts
        
        const beforeMethod = modifiedContent.substring(0, methodStart);
        const afterMethod = modifiedContent.substring(methodStart);
        
        // Extract indentation from method declaration
        const indentMatch = methodDeclaration.match(/^(\n\s*)/);
        const indent = indentMatch ? indentMatch[1].substring(1) : '    '; // Remove \n and use spaces
        
        // Apply the same indentation to JSDoc
        const indentedJSDoc = methodJSDoc
          .split('\n')
          .map((line, i) => i === 0 ? indent + line : (line.trim() ? indent + line : line))
          .join('\n');
        
        // Insert JSDoc before method declaration
        modifiedContent = beforeMethod + indentedJSDoc + '\n' + afterMethod;
        console.log(`    ✅ Inserted new JSDoc for method ${className}.${methodName} with ${indent.length} spaces indentation`);
      }
    }
    
    return modifiedContent;
  }

  async processFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return await this.processFileContent(filePath, content);
  }

  async processFileContent(filePath, content) {
    if (this.debug) {
      console.log(`\n🔧 Processing: ${path.relative(this.rootDir, filePath)}`);
    }
    
    // Extract package name from file path
    const packageName = this.extractPackageFromPath(filePath);
    if (this.debug) {
      console.log(`  📦 Package: ${packageName}`);
    }
    
    // Load package and class metadata dynamically
    await this.loadPackageMetadata(packageName);
    
    // Use provided content instead of reading from file
    // let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;
    let hasChanges = false;
    
    // CRITICAL FIX: Extract and preserve file-level elements before class declaration
    const classRegex = /export\s+(?:declare\s+)?(?:abstract\s+)?class\s+(\w+)/g;
    const classMatch = classRegex.exec(content);
    
    let fileLevelContent = '';
    let classAndAfterContent = content;
    let detectedClassName = null;
    
    if (classMatch) {
      // Split content at class declaration
      fileLevelContent = content.substring(0, classMatch.index);
      classAndAfterContent = content.substring(classMatch.index);
      detectedClassName = classMatch[1];
      if (this.debug) {
        console.log(`  📋 Preserved ${fileLevelContent.split('\n').length - 1} lines of file-level content for ${detectedClassName}`);
      }
    }
    
    // Extract all TypeScript elements from file
    const elements = this.extractFileElements(content);
    if (this.debug) {
      console.log(`  📊 Detected elements: ${Object.keys(elements).join(', ')}`);
    }
    
    // Extract ALL class names from file (including abstract classes)
    const classMatches = Array.from(content.matchAll(/export\s+(?:declare\s+)?(?:abstract\s+)?class\s+(\w+)/g));
    const classNames = classMatches.map(match => match[1]);
    
    // Load metadata for ALL classes if they exist
    if (classNames.length > 0) {
      if (this.debug) {
        console.log(`  📋 Detected ${classNames.length} classes: ${classNames.join(', ')}`);
      }
      for (const className of classNames) {
        await this.loadClassMetadata(packageName, className);
      }
    } else {
      // For files without classes, still try to load metadata using a generic approach
      // Try to guess the metadata file from the TypeScript filename
      const baseName = this.guessClassNameFromFile(filePath) || 'aggregate-root';
      await this.loadClassMetadata(packageName, baseName);
    }
    
    // Process file-level elements (interfaces, types, enums) first, but NOT functions yet
    // Functions will be processed after class to avoid injection conflicts
    const elementsWithoutFunctions = { ...elements, functions: [] };
    const elementClassName = classNames[0] || this.guessClassNameFromFile(filePath) || 'AggregateRoot';
    content = await this.processFileElements(content, elementsWithoutFunctions, packageName, elementClassName);
    
    if (classNames.length === 0) {
      console.log('⚠️  No class found in file, processed file-level elements only');
      return content;
    }

    // NEW YAML SYSTEM: Process ALL classes in the file
    for (const className of classNames) {
      if (this.debug) {
        console.log(`\n  🏗️ Processing class: ${className}`);
      }
      
      // First check if we should generate class-level JSDoc from YAML
      const classMetadata = this.getClassMetadata(className, packageName);
      if (classMetadata?.classes?.[className]?.['class-doc']) {
        if (this.debug) {
          console.log(`  🆕 NEW YAML SYSTEM: Found class-doc for ${className} - generating concrete JSDoc`);
        }
        const classJSDoc = this.generateClassJSDoc(className, packageName, 'jsdoc');
        
        if (classJSDoc) {
          // Find class declaration and replace any existing JSDoc (including abstract classes)
          const classRegex = new RegExp(`(/\\*\\*[\\s\\S]*?\\*/\\s*)?(export\\s+(?:declare\\s+)?(?:abstract\\s+)?class\\s+${className})`, 'g');
          const classMatch = classRegex.exec(content);
          
          if (classMatch) {
            const existingJSDoc = classMatch[1] || '';
            const classDeclaration = classMatch[2];
            
            // CRITICAL FIX: Calculate precise replacement boundaries
            // If there's existing JSDoc, replace from start of JSDoc
            // If no JSDoc, insert before class declaration
            const replaceStart = existingJSDoc ? classMatch.index : classMatch.index + classMatch[0].indexOf(classDeclaration);
            const replaceEnd = classMatch.index + classMatch[0].indexOf(classDeclaration);
            
            // Replace old JSDoc (including inject markers) with new concrete JSDoc
            const newContent = content.substring(0, replaceStart) + 
                             classJSDoc + '\n' + 
                             content.substring(replaceEnd);
            
            if (newContent !== content) {
              content = newContent;
              hasChanges = true;
              console.log(`  ✅ Generated concrete class JSDoc for ${className} from YAML`);
            }
          }
        }
      }

      // NEW YAML SYSTEM: Process method-level JSDoc from YAML metadata
      const classMetadataForMethods = this.getClassMetadata(className, packageName);
      if (classMetadataForMethods) {
        // Get methods from either universal or legacy structure
        const methods = classMetadataForMethods.classes?.[className]?.methods || classMetadataForMethods.methods;
        
        if (methods) {
          if (this.debug) {
            console.log(`  🔧 Processing ${Object.keys(methods).length} methods for ${className}`);
          }
        
        // Collect all method JSDoc injections to do them in one pass
        const methodInjections = [];
        
        for (const [methodName, methodMeta] of Object.entries(methods)) {
          // Skip if no metadata for this method
          if (!methodMeta || typeof methodMeta !== 'object') continue;
          
          // Resolve method metadata with hierarchical resolution
          const resolvedMetadata = this.resolveMetadata(className, methodName, packageName, 'jsdoc');
          
          if (Object.keys(resolvedMetadata).length > 0) {
            // Generate JSDoc for this method
            const methodJSDoc = this.buildJSDoc(resolvedMetadata, methodName, className);
            
            if (methodJSDoc) {
              methodInjections.push({ methodName, methodJSDoc });
              if (this.debug) {
                console.log(`    ✅ Generated JSDoc for ${className}.${methodName}`);
              }
            }
          }
          }
          
          // Now inject all method JSDoc in a single pass
          if (methodInjections.length > 0) {
            content = this.injectAllMethodJSDoc(content, className, methodInjections);
            hasChanges = true;
          }
        }
      }
    }

    // Now process functions AFTER class processing to ensure correct injection order
    if (elements.functions && elements.functions.length > 0) {
      const functionsOnly = { functions: elements.functions };
      content = await this.processFileElements(content, functionsOnly, packageName, elementClassName);
      if (content !== originalContent) {
        hasChanges = true;
      }
    }

    if (hasChanges) {
      if (this.debug) {
        console.log('✅ File processed with changes');
      }
    } else {
      if (this.debug) {
        console.log('ℹ️  No changes needed');
      }
    }

    // Return the processed content directly - no need for complex recombination
    // The content has already been processed with all JSDoc injections
    return content;
  }

  extractMethodName(content, position) {
    // Look for method name after the JSDoc block
    const afterPosition = content.substring(position);
    
    // Try to match method/function declarations
    const methodMatch = afterPosition.match(/^\s*\*\/\s*(?:protected\s+|private\s+|public\s+|export\s+declare\s+function\s+|static\s+)?(\w+)\s*(?:\(|<)/m);
    if (methodMatch) {
      return methodMatch[1];
    }

    // Check if this is a class-level comment (including abstract classes)
    const classMatch = afterPosition.match(/^\s*\*\/\s*export\s+(?:declare\s+)?(?:abstract\s+)?class\s+(\w+)/m);
    if (classMatch) {
      return null; // Class-level comment, return null to indicate this
    }

    return null;
  }

  guessClassNameFromFile(filePath) {
    // Guess class name from file name
    const fileName = path.basename(filePath, '.d.ts');
    
    // Convert kebab-case or snake_case to PascalCase
    const pascalCase = fileName
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    
    return pascalCase;
  }

  isClassLevelComment(content, position) {
    // Check if the JSDoc block is followed by a class declaration (including abstract classes)
    const afterPosition = content.substring(position);
    const nextJSDocEnd = afterPosition.indexOf('*/');
    if (nextJSDocEnd === -1) return false;
    
    const afterJSDoc = afterPosition.substring(nextJSDocEnd + 2);
    return /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?class\s+/m.test(afterJSDoc);
  }

  /**
   * Get metadata for a specific class, using hierarchical resolution
   */
  getClassMetadata(className, packageName) {
    // Check if we have loaded metadata for this class
    const classKey = `${packageName}-${className.toLowerCase()}`;
    
    if (this.classMetadata.has(classKey)) {
      const classMeta = this.classMetadata.get(classKey);
      
      // For universal structure, check if class has methods defined
      if (classMeta.classes?.[className]?.methods) {
        if (this.debug) {
          console.log(`  📊 Found methods for ${className} in universal structure`);
        }
        return classMeta;
      }
      // For legacy structure, check if methods exist at root
      else if (classMeta.methods) {
        if (this.debug) {
          console.log(`  📊 Found methods for ${className} in legacy structure`);
        }
        return classMeta;
      }
      // Still return metadata even if no methods (file-level metadata)
      else {
        console.log(`  📊 Found file-level metadata for ${className}`);
        return classMeta;
      }
    }
    
    // If not cached, metadata was not loaded for this package
    return null;
  }


  async processPackage(packageName) {
    if (this.debug) {
      console.log(`\n📦 Processing package: ${packageName}`);
    }
    
    // Load package metadata
    await this.loadPackageMetadata(packageName);
    
    const pattern = path.join(this.rootDir, 'packages', packageName, 'dist', '**', '*.d.ts');
    const files = globSync(pattern);
    
    console.log(`Found ${files.length} .d.ts files`);
    
    for (const file of files) {
      // Extract class name from actual export class declarations only
      const tempContent = await fs.readFile(file, 'utf-8');
      const classMatches = Array.from(tempContent.matchAll(/export\s+(?:declare\s+)?(?:abstract\s+)?class\s+(\w+)/g));
      
      // Process ALL classes in the file
      if (classMatches.length > 0) {
        if (this.debug) {
          console.log(`  📋 Found ${classMatches.length} classes in ${path.basename(file)}`);
        }
        
        // Load metadata for all classes in the file
        for (const match of classMatches) {
          const className = match[1];
          await this.loadClassMetadata(packageName, className);
          console.log(`    ✅ Loaded metadata for class: ${className}`);
        }
        
        // Process the entire file content once with all loaded metadata
        const processedContent = await this.processFileContent(file, tempContent);
        
        if (this.dryRun) {
          console.log(`🔍 Dry run - would write to: ${file}`);
        } else {
          await fs.writeFile(file, processedContent);
        }
      } else {
        // For files without export class, still process for file-level elements
        if (this.debug) {
          console.log(`\n🔧 Processing: ${path.relative(this.rootDir, file)}`);
          console.log(`  📋 No export class found - checking for file-level elements`);
        }
        
        // Process file for file-level elements (interfaces, types, enums, functions)
        const processedContent = await this.processFileContent(file, tempContent);
        
        // Check if content changed
        if (processedContent !== tempContent) {
          console.log(`  ✨ File-level elements processed`);
          if (this.dryRun) {
            console.log(`🔍 Dry run - would write to: ${file}`);
          } else {
            await fs.writeFile(file, processedContent);
          }
        } else {
          if (this.debug) {
            console.log(`ℹ️  No changes needed`);
          }
        }
      }
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  // Support both --package=name and --filter @scope/name formats
  let packageName = args.find(arg => arg.startsWith('--package='))?.split('=')[1];
  
  if (!packageName) {
    // Check for --filter format
    const filterArg = args.find(arg => arg.startsWith('--filter'));
    if (filterArg) {
      const filterValue = args[args.indexOf(filterArg) + 1];
      if (filterValue && filterValue.startsWith('@vytches/')) {
        // Extract package name from scoped name (e.g., @vytches/ddd-aggregates -> aggregates)
        packageName = filterValue.replace('@vytches/ddd-', '');
      }
    }
  }
  
  if (!packageName) {
    console.error('❌ Error: Package name is required.');
    console.error('Usage:');
    console.error('  node inject-yaml-jsdoc.js --package=<package-name>');
    console.error('  pnpm jsdoc:inject --package=aggregates');
    console.error('  pnpm jsdoc:inject --filter @vytches/aggregates');
    console.error('');
    console.error('Examples:');
    console.error('  node inject-yaml-jsdoc.js --package=aggregates');
    console.error('  pnpm jsdoc:inject --filter @vytches/aggregates');
    process.exit(1);
  }
  
  console.log('🚀 YAML Front Matter JSDoc Injection');
  console.log('====================================');
  console.log(`Package: ${packageName}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Environment: VYTCHES_LOGGER=${process.env.VYTCHES_LOGGER || 'false'}`);
  
  const injector = new YamlJSDocInjector(process.cwd());
  injector.dryRun = dryRun;
  
  try {
    await injector.loadHierarchicalMetadata();
    await injector.processPackage(packageName);
    
    console.log('\n✅ Injection completed successfully!');
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

module.exports = { YamlJSDocInjector };