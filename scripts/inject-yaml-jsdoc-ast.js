#!/usr/bin/env node

/**
 * Enhanced YAML JSDoc Injection using TypeScript AST
 * Uses TypeScript Compiler API for accurate parsing and modification
 */

const fs = require('fs').promises;
const path = require('path');
const { globSync } = require('glob');
const ts = require('typescript');
const yaml = require('js-yaml');

class ASTJSDocInjector {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.globalMetadata = null;
    this.packageMetadata = new Map();
    this.classMetadata = new Map();
    this.debug = process.env.JSDOC_DEBUG === 'true';
    this.dryRun = false;
    this.forceMode = false;
  }

  async loadYamlFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      // Direct YAML parsing without frontmatter
      return yaml.load(content, { schema: yaml.JSON_SCHEMA }) || {};
    } catch (error) {
      if (error.code !== 'ENOENT' && this.debug) {
        console.log(`  ⚠️  Error loading ${filePath}: ${error.message}`);
      }
      return null;
    }
  }

  async loadHierarchicalMetadata() {
    console.log('📂 Loading hierarchical metadata...');

    // Load global metadata
    this.globalMetadata = await this.loadYamlFile(
      path.join(this.rootDir, 'docs', 'global-settings.yaml')
    );
    if (this.globalMetadata) {
      console.log('✅ Global metadata loaded');
    }
  }

  async loadPackageMetadata(packageName) {
    const packageMeta = await this.loadYamlFile(
      path.join(this.rootDir, 'docs', 'examples', 'domain', packageName, '.md-settings.yaml')
    );
    if (packageMeta) {
      this.packageMetadata.set(packageName, packageMeta);
      console.log(`✅ Package metadata loaded for ${packageName}`);
    }
  }

  async loadClassMetadata(packageName, className, fileName = null) {
    const key = `${packageName}-${className.toLowerCase()}`;
    if (this.classMetadata.has(key)) {
      return;
    }

    // FIXED: Preserve directory structure when handling subdirectories
    let yamlFilePath;

    // Check if className contains a path separator (for subdirectory files)
    const hasPath = className.includes('/');
    // Check if className looks like an actual class name (starts with uppercase)
    const isClassName = !hasPath && /^[A-Z]/.test(className);

    if (hasPath) {
      // For subdirectory paths like 'utils/index', use directly
      yamlFilePath = className + '.yaml';
    } else if (fileName && !isClassName) {
      // For file-based lookups (interfaces, functions), use file path structure
      const packageDistPath = `packages/${packageName}/dist/`;
      const fileRelativePath = fileName.includes(packageDistPath)
        ? fileName.substring(fileName.indexOf(packageDistPath) + packageDistPath.length)
        : path.basename(fileName);

      // Remove .d.ts extension and replace with .yaml
      yamlFilePath = fileRelativePath
        .replace(/\.d\.ts$/, '.yaml')
        .replace('.interface', '.interface');
    } else {
      // For class names, use kebab-case conversion (e.g., AggregateRoot -> aggregate-root.yaml)
      yamlFilePath =
        className
          .replace(/([A-Z])/g, (match, letter, index) =>
            index === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`
          )
          .replace(/^-/, '') + '.yaml';
    }

    const fullYamlPath = path.join(
      this.rootDir,
      'docs',
      'examples',
      'domain',
      packageName,
      yamlFilePath
    );
    if (this.debug) {
      console.log(`🔍 DEBUG: Trying to load metadata for ${className} from: ${fullYamlPath}`);
    }

    const classMeta = await this.loadYamlFile(fullYamlPath);
    if (classMeta) {
      this.classMetadata.set(key, classMeta);
      if (this.debug) {
        console.log(`✅ Class metadata loaded for ${className} from ${yamlFilePath}`);
        console.log(`  📋 Loaded keys: ${Object.keys(classMeta).slice(0, 10).join(', ')}`);
      }
    }
  }

  /**
   * Parse TypeScript file using AST
   */
  parseTypeScriptFile(content) {
    const sourceFile = ts.createSourceFile('temp.d.ts', content, ts.ScriptTarget.Latest, true);
    return sourceFile;
  }

  /**
   * Merge metadata hierarchically based on strategy
   */
  mergeMetadata(base, overlay, strategy = 'merge') {
    if (!base) return overlay;
    if (!overlay) return base;

    switch (strategy) {
      case 'replace':
        // Complete replacement
        return overlay;

      case 'append':
        // Append strings, merge arrays and objects
        const result = { ...base };
        for (const key in overlay) {
          if (typeof overlay[key] === 'string' && result[key]) {
            result[key] = `${result[key]}\n${overlay[key]}`;
          } else if (Array.isArray(overlay[key])) {
            result[key] = [...(result[key] || []), ...overlay[key]];
          } else if (typeof overlay[key] === 'object' && overlay[key] !== null) {
            result[key] = { ...(result[key] || {}), ...overlay[key] };
          } else {
            result[key] = overlay[key];
          }
        }
        return result;

      case 'merge':
      default:
        // Deep merge
        const merged = { ...base };
        for (const key in overlay) {
          if (
            typeof overlay[key] === 'object' &&
            overlay[key] !== null &&
            !Array.isArray(overlay[key])
          ) {
            merged[key] = this.mergeMetadata(merged[key], overlay[key], 'merge');
          } else {
            merged[key] = overlay[key];
          }
        }
        return merged;
    }
  }

  /**
   * Resolve hierarchical metadata for a specific element
   */
  resolveHierarchicalMetadata(
    packageName,
    fileBaseName,
    interfaceOrClassName,
    methodName = null,
    format = 'jsdoc'
  ) {
    let resolved = {};

    // 1. Start with global metadata
    if (this.globalMetadata) {
      const globalStrategy = this.globalMetadata.hierarchy?.strategy || 'merge';
      resolved = this.mergeMetadata(resolved, this.globalMetadata, globalStrategy);
    }

    // 2. Apply package metadata
    const packageMeta = this.packageMetadata.get(packageName);
    if (packageMeta) {
      const packageStrategy = packageMeta.hierarchy?.strategy || 'merge';
      resolved = this.mergeMetadata(resolved, packageMeta, packageStrategy);
    }

    // 3. Apply file/class metadata
    // Try both file-based and class-based keys
    const fileKey = `${packageName}-${fileBaseName.toLowerCase()}`;
    const classKey = interfaceOrClassName
      ? `${packageName}-${interfaceOrClassName.toLowerCase()}`
      : null;

    // Debug for class-level resolution
    if (!methodName && interfaceOrClassName === 'AggregateRoot') {
      console.log(`      🔍 CLASS HIERARCHICAL DEBUG:`);
      console.log(`        FileKey: ${fileKey}`);
      console.log(`        ClassKey: ${classKey}`);
      console.log(`        Available keys: ${Array.from(this.classMetadata.keys()).join(', ')}`);
    }

    // Debug for commit
    if (methodName === 'commit' && interfaceOrClassName === 'AggregateRoot') {
      console.log(`      🔍 COMMIT DEBUG - FileKey: ${fileKey}`);
      console.log(`      🔍 COMMIT DEBUG - ClassKey: ${classKey}`);
      console.log(
        `      🔍 COMMIT DEBUG - Available keys: ${Array.from(this.classMetadata.keys()).join(', ')}`
      );
    }

    // Try class-specific key first, then file-based key
    const fileMeta =
      (classKey && this.classMetadata.get(classKey)) || this.classMetadata.get(fileKey);
    if (fileMeta) {
      const fileStrategy = fileMeta.hierarchy?.strategy || 'merge';

      // Get class or interface specific metadata
      let elementMeta =
        fileMeta.classes?.[interfaceOrClassName] ||
        fileMeta.interfaces?.[interfaceOrClassName] ||
        fileMeta;

      // Debug for class-level resolution
      if (!methodName && interfaceOrClassName === 'AggregateRoot') {
        console.log(`      🔍 CLASS HIERARCHICAL DEBUG - ElementMeta:`);
        console.log(`        FileMeta has classes? ${!!fileMeta.classes}`);
        console.log(
          `        FileMeta.classes keys: ${Object.keys(fileMeta.classes || {}).join(', ')}`
        );
        console.log(`        ElementMeta type: ${typeof elementMeta}`);
        console.log(`        ElementMeta keys: ${Object.keys(elementMeta).join(', ')}`);
        console.log(`        ElementMeta has class-doc? ${!!elementMeta['class-doc']}`);
        if (elementMeta['class-doc']) {
          console.log(`        Class-doc description: ${elementMeta['class-doc'].description}`);
          console.log(`        Class-doc has formats? ${!!elementMeta['class-doc'].formats}`);
        }
      }

      // Debug for class-level resolution
      if (!methodName && interfaceOrClassName === 'AggregateRoot') {
        console.log(`        ElementMeta === FileMeta? ${elementMeta === fileMeta}`);
        console.log(`        Will merge elementMeta? ${elementMeta && elementMeta !== fileMeta}`);
      }

      if (elementMeta && elementMeta !== fileMeta) {
        const elementStrategy =
          elementMeta.hierarchy?.strategy || elementMeta.strategy || fileStrategy;
        resolved = this.mergeMetadata(resolved, elementMeta, elementStrategy);

        // CRITICAL FIX: Handle class-doc formats specially
        // Class-doc formats need to be elevated to top-level formats for proper override priority
        if (elementMeta['class-doc']?.formats) {
          if (!resolved.formats) resolved.formats = {};

          // Merge class-doc formats with higher priority than existing formats
          for (const formatKey in elementMeta['class-doc'].formats) {
            if (!resolved.formats[formatKey]) resolved.formats[formatKey] = {};

            // Class-level formats should override package-level formats
            resolved.formats[formatKey] = {
              ...resolved.formats[formatKey],
              ...elementMeta['class-doc'].formats[formatKey],
            };
          }
        }

        // CRITICAL FIX 2: Also handle class-doc custom-tags
        // Custom tags from class-doc should be merged into resolved custom-tags
        if (elementMeta['class-doc']?.['custom-tags']) {
          if (!resolved['custom-tags']) resolved['custom-tags'] = {};

          // Handle direct custom tags (not format-specific)
          const classTags = elementMeta['class-doc']['custom-tags'];
          for (const tagKey in classTags) {
            // Skip formats sub-object as it's handled separately
            if (tagKey !== 'formats' && typeof classTags[tagKey] === 'string') {
              resolved['custom-tags'][tagKey] = classTags[tagKey];
            }
          }

          // Handle format-specific custom tags if they exist
          if (classTags.formats?.jsdoc) {
            // Merge jsdoc-specific custom tags
            Object.assign(resolved['custom-tags'], classTags.formats.jsdoc);
          }
        }

        if (!methodName && interfaceOrClassName === 'AggregateRoot') {
          console.log(`        Merged elementMeta with strategy: ${elementStrategy}`);
          console.log(
            `        ElementMeta has class-doc formats? ${!!elementMeta['class-doc']?.formats}`
          );
          if (elementMeta['class-doc']?.formats?.jsdoc) {
            console.log(
              `        ElementMeta class-doc.formats.jsdoc.description: ${elementMeta['class-doc'].formats.jsdoc.description}`
            );
          }
          console.log(
            `        Resolved after elementMeta merge has formats? ${!!resolved.formats}`
          );
          if (resolved.formats && resolved.formats.jsdoc) {
            console.log(
              `        Resolved.formats.jsdoc.description: ${resolved.formats.jsdoc.description}`
            );
          }
          console.log(`        🔧 FIXED: Applied class-doc formats with higher priority`);
          console.log(`        Resolved has custom-tags? ${!!resolved['custom-tags']}`);
          if (resolved['custom-tags']) {
            console.log(`        Custom tags: ${JSON.stringify(resolved['custom-tags'], null, 2)}`);
          }
        }
      }

      // 4. Apply method metadata if specified
      if (methodName) {
        // Debug: check what methods are available
        if (methodName === 'commit' && interfaceOrClassName === 'AggregateRoot') {
          console.log(`      🔍 COMMIT DEBUG - Looking for method metadata`);
          console.log(`        ElementMeta type: ${typeof elementMeta}`);
          console.log(`        Has methods? ${!!elementMeta?.methods}`);
          console.log(`        Method keys: ${Object.keys(elementMeta?.methods || {}).join(', ')}`);
          console.log(`        Has commit? ${!!elementMeta?.methods?.commit}`);
        }

        if (elementMeta?.methods?.[methodName]) {
          const methodMeta = elementMeta.methods[methodName];
          const methodStrategy = methodMeta.hierarchy?.strategy || methodMeta.strategy || 'merge';

          // DEBUG: Check what we're merging for commit
          if (methodName === 'commit') {
            console.log(`      🔍 COMMIT DEBUG - Class/Interface: ${interfaceOrClassName}`);
          }
          if (methodName === 'commit' && interfaceOrClassName === 'AggregateRoot') {
            console.log(`      🔍 COMMIT DEBUG - Before merge:`);
            console.log(`        Description: ${resolved.description?.substring(0, 60)}...`);
            console.log(
              `        Business-context: ${resolved['business-context']?.substring(0, 60)}...`
            );
            console.log(`      🔍 COMMIT DEBUG - Method metadata:`);
            console.log(`        Description: ${methodMeta.description}`);
            console.log(`        Business-context: ${methodMeta['business-context']}`);
            console.log(`        Strategy: ${methodStrategy}`);
          }

          resolved = this.mergeMetadata(resolved, methodMeta, methodStrategy);

          if (methodName === 'commit' && interfaceOrClassName === 'AggregateRoot') {
            console.log(`      🔍 COMMIT DEBUG - After merge:`);
            console.log(`        Description: ${resolved.description}`);
            console.log(`        Business-context: ${resolved['business-context']}`);
          }
        } else if (methodName) {
          if (methodName === 'commit') {
            console.log(
              `      ⚠️ COMMIT DEBUG - No method metadata found for ${interfaceOrClassName}!`
            );
            console.log(`      📋 ElementMeta keys: ${Object.keys(elementMeta || {}).join(', ')}`);
            console.log(
              `      📋 Available methods: ${Object.keys(elementMeta?.methods || {}).join(', ')}`
            );
          }
        }
      }
    }

    // 5. Apply format-specific overrides in hierarchical order
    // For classes, prioritize class-level formats over package/global formats
    if (!methodName) {
      // Collect format overrides from all levels in reverse hierarchy (most specific first)
      const formatOverrides = {};

      // Start with global format overrides (lowest priority)
      if (this.globalMetadata?.formats?.[format]) {
        for (const key in this.globalMetadata.formats[format]) {
          formatOverrides[key] = this.globalMetadata.formats[format][key];
        }
      }

      // Apply package format overrides (medium priority)
      const packageMeta = this.packageMetadata.get(packageName);
      if (packageMeta?.formats?.[format]) {
        for (const key in packageMeta.formats[format]) {
          formatOverrides[key] = packageMeta.formats[format][key];
        }
      }

      // Apply file/class format overrides (highest priority)
      if (resolved.formats && resolved.formats[format]) {
        for (const key in resolved.formats[format]) {
          formatOverrides[key] = resolved.formats[format][key];
        }
      }

      // Debug for class-level format overrides
      if (!methodName && interfaceOrClassName === 'AggregateRoot') {
        console.log(`      🔍 CLASS FORMAT DEBUG (NEW):`);
        console.log(`        Description before format override: ${resolved.description}`);
        console.log(`        Format override keys: ${Object.keys(formatOverrides).join(', ')}`);
        console.log(`        Format override description: ${formatOverrides.description}`);
      }

      // Apply format overrides (class-level has priority)
      for (const key in formatOverrides) {
        resolved[key] = formatOverrides[key];
      }

      // Debug for class-level format overrides
      if (!methodName && interfaceOrClassName === 'AggregateRoot') {
        console.log(`        Description after format override: ${resolved.description}`);
      }
    } else {
      // For methods, only apply method-level format overrides if they exist
      // Check if the method has format-specific overrides in the resolved metadata
      if (resolved.formats && resolved.formats[format]) {
        // These would be method-level format overrides that were merged earlier
        // We can remove them from the resolved object
        delete resolved.formats;
      }
    }

    // Clean up format-specific keys from result
    for (const key in resolved) {
      if (key.includes('.')) {
        delete resolved[key];
      }
    }

    return resolved;
  }

  /**
   * Generate JSDoc comment from metadata with hierarchy
   */
  generateJSDoc(
    metadata,
    indent = '',
    packageName = null,
    fileBaseName = null,
    interfaceOrClassName = null,
    methodName = null
  ) {
    // Debug for commit method
    if (methodName === 'commit' && interfaceOrClassName === 'AggregateRoot') {
      console.log(`      🔍 COMMIT DEBUG in generateJSDoc:`);
      console.log(`        packageName: ${packageName}`);
      console.log(`        fileBaseName: ${fileBaseName}`);
      console.log(`        interfaceOrClassName: ${interfaceOrClassName}`);
      console.log(`        methodName: ${methodName}`);
    }

    // If we have hierarchy info, resolve it
    if (packageName && fileBaseName) {
      metadata = this.resolveHierarchicalMetadata(
        packageName,
        fileBaseName,
        interfaceOrClassName,
        methodName,
        'jsdoc'
      );

      if (methodName === 'commit' && interfaceOrClassName === 'AggregateRoot') {
        console.log(`      🔍 COMMIT DEBUG - After resolution:`);
        console.log(`        Description: ${metadata.description}`);
        console.log(`        Business-context: ${metadata['business-context']}`);
      }
    }

    const lines = [];
    lines.push(`${indent}/**`);

    if (metadata.description) {
      lines.push(`${indent} * ${metadata.description}`);
    }

    if (metadata['business-context']) {
      lines.push(`${indent} * @businessContext ${metadata['business-context']}`);
    }

    if (metadata.parameters && metadata.parameters.length > 0) {
      metadata.parameters.forEach(param => {
        const optional = param.optional ? ' - Optional.' : '';
        lines.push(
          `${indent} * @param {${param.type}} ${param.name}${optional} ${param.description}`
        );
      });
    }

    if (metadata.returns) {
      lines.push(`${indent} * @returns {${metadata.returns.type}} ${metadata.returns.description}`);
    }

    if (metadata.throws && metadata.throws.length > 0) {
      metadata.throws.forEach(err => {
        lines.push(`${indent} * @throws {${err.type}} ${err.description}`);
      });
    }

    // Add examples - the key feature!
    if (metadata.examples && metadata.examples.length > 0) {
      metadata.examples.forEach(example => {
        lines.push(`${indent} * @example`);
        if (example.id) {
          lines.push(`${indent} * // ${example.id}`);
        }
        lines.push(`${indent} * \`\`\`typescript`);
        if (example.code) {
          example.code.split('\n').forEach(codeLine => {
            lines.push(`${indent} * ${codeLine}`);
          });
        }
        lines.push(`${indent} * \`\`\``);
      });
    }

    if (metadata['custom-tags']) {
      Object.entries(metadata['custom-tags']).forEach(([tag, value]) => {
        // Skip format-specific and hierarchy tags
        if (!tag.includes('.') && tag !== 'hierarchy' && tag !== 'strategy') {
          lines.push(`${indent} * @${tag} ${value}`);
        }
      });
    }

    lines.push(`${indent} */`);
    return lines.join('\n');
  }

  /**
   * Process TypeScript file using AST
   */
  async processFileWithAST(filePath, content) {
    const packageName = this.extractPackageFromPath(filePath);
    const sourceFile = this.parseTypeScriptFile(content);

    // Load metadata for all elements in the file
    await this.loadPackageMetadata(packageName);

    // Collect all modifications
    const modifications = [];

    // Visit all nodes in the AST
    const visit = async node => {
      // Process interfaces
      if (ts.isInterfaceDeclaration(node)) {
        const interfaceName = node.name.text;
        console.log(`  🔍 Found interface: ${interfaceName}`);

        // Load metadata for this interface
        const fileBaseName = path.basename(filePath, '.d.ts');

        // For subdirectory files, include the subdirectory in the key to avoid collisions
        const relativePath = path.relative(path.join('packages', packageName, 'dist'), filePath);
        const dirName = path.dirname(relativePath);
        const metadataKey =
          dirName && dirName !== '.'
            ? `${dirName}/${fileBaseName}`.replace(/\\/g, '/')
            : fileBaseName;

        await this.loadClassMetadata(packageName, metadataKey, filePath);
        const key = `${packageName}-${metadataKey.toLowerCase()}`;
        const metadata = this.classMetadata.get(key);

        if (this.debug) {
          console.log(`    📋 Metadata key: ${key}`);
          console.log(`    📋 Has metadata: ${!!metadata}`);
          if (metadata) {
            console.log(`    📋 Has interfaces: ${!!metadata.interfaces}`);
            console.log(
              `    📋 Interface names: ${metadata.interfaces ? Object.keys(metadata.interfaces).join(', ') : 'none'}`
            );
          }
        }

        if (metadata?.interfaces?.[interfaceName]) {
          const interfaceMetadata = metadata.interfaces[interfaceName];

          // Add JSDoc for interface itself if it doesn't already have one
          const leadingComments = ts.getLeadingCommentRanges(content, node.pos);
          const hasJSDoc =
            leadingComments &&
            leadingComments.some(comment =>
              content.substring(comment.pos, comment.end).includes('/**')
            );

          if (!hasJSDoc || this.forceMode) {
            const interfaceJSDoc = this.generateJSDoc(
              interfaceMetadata,
              '',
              packageName,
              fileBaseName,
              interfaceName
            );
            // Find the actual start of the interface declaration
            const interfaceStart = node.getStart(sourceFile);
            // Find the start of the line containing the interface
            const lineStart = content.lastIndexOf('\n', interfaceStart - 1) + 1;
            const indent = content.substring(lineStart, interfaceStart).match(/^\s*/)[0];

            // Insert JSDoc at the beginning of the line
            modifications.push({
              start: lineStart,
              end: lineStart,
              text: interfaceJSDoc + '\n',
            });
          }

          // Convert properties array to object format if needed
          let propertiesAsObject = {};
          if (interfaceMetadata.properties && Array.isArray(interfaceMetadata.properties)) {
            interfaceMetadata.properties.forEach(prop => {
              if (prop.name) {
                propertiesAsObject[prop.name] = {
                  description: prop.description || `${prop.name} property`,
                  type: prop.type,
                  required: prop.required,
                  default: prop.default,
                  'business-context': prop['business-context'],
                };
              }
            });
          } else if (
            interfaceMetadata.properties &&
            typeof interfaceMetadata.properties === 'object'
          ) {
            propertiesAsObject = interfaceMetadata.properties;
          }

          // Process interface members (both methods and properties)
          node.members.forEach(member => {
            const memberName = member.name?.getText(sourceFile);
            if (!memberName) return;

            let memberMetadata = null;
            let isProperty = false;

            // Check if it's a property signature
            if (ts.isPropertySignature(member) && propertiesAsObject[memberName]) {
              memberMetadata = propertiesAsObject[memberName];
              isProperty = true;
            }
            // Check if it's a method signature
            else if (
              ts.isMethodSignature(member) &&
              interfaceMetadata.methods &&
              interfaceMetadata.methods[memberName]
            ) {
              memberMetadata = interfaceMetadata.methods[memberName];
            }

            if (memberMetadata) {
              // Get the indent for the member
              const memberStart = member.getStart(sourceFile);
              const lineStart = content.lastIndexOf('\n', memberStart - 1) + 1;
              const memberIndent = content.substring(lineStart, memberStart).match(/^\s*/)[0];

              // Generate JSDoc
              let jsdocText;
              if (isProperty) {
                // Generate simpler JSDoc for properties
                const lines = [`${memberIndent}/**`];
                if (memberMetadata.description) {
                  lines.push(`${memberIndent} * ${memberMetadata.description}`);
                }
                if (memberMetadata['business-context']) {
                  lines.push(
                    `${memberIndent} * @businessContext ${memberMetadata['business-context']}`
                  );
                }
                if (memberMetadata.type) {
                  lines.push(`${memberIndent} * @type {${memberMetadata.type}}`);
                }
                if (memberMetadata.default !== undefined) {
                  lines.push(`${memberIndent} * @default ${memberMetadata.default}`);
                }
                if (memberMetadata.required) {
                  lines.push(`${memberIndent} * @required`);
                }
                lines.push(`${memberIndent} */`);
                jsdocText = lines.join('\n');
              } else {
                // Use existing method for methods
                jsdocText = this.generateJSDoc(
                  {}, // Empty object forces hierarchical resolution
                  memberIndent,
                  packageName,
                  fileBaseName,
                  interfaceName,
                  memberName
                );
              }

              // Find the position to insert JSDoc
              const leadingComments = ts.getLeadingCommentRanges(content, member.pos);
              if (leadingComments && leadingComments.length > 0) {
                // Replace existing JSDoc
                const commentStart = leadingComments[0].pos;
                const commentLineStart = content.lastIndexOf('\n', commentStart - 1) + 1;

                modifications.push({
                  start: commentLineStart,
                  end: leadingComments[leadingComments.length - 1].end,
                  text: jsdocText,
                });
              } else {
                // Add new JSDoc before the member
                modifications.push({
                  start: lineStart,
                  end: lineStart,
                  text: jsdocText + '\n',
                });
              }

              const memberType = isProperty ? 'property' : 'method';
              console.log(
                `    ✅ Enhanced JSDoc for ${interfaceName}.${memberName} (${memberType})`
              );
            }
          });
        }
      }

      // Process classes
      if (ts.isClassDeclaration(node)) {
        const className = node.name?.text;
        if (className) {
          console.log(`  🔍 Found class: ${className}`);

          // Load metadata for this class
          const fileBaseName = path.basename(filePath, '.d.ts');
          await this.loadClassMetadata(packageName, className, filePath);
          // Try both class-based and file-based keys since metadata could be stored under either
          const classKey = `${packageName}-${className.toLowerCase()}`;
          const fileKey = `${packageName}-${fileBaseName.toLowerCase()}`;
          const metadata = this.classMetadata.get(classKey) || this.classMetadata.get(fileKey);

          if (this.debug) {
            console.log(`    📋 Trying keys: classKey=${classKey}, fileKey=${fileKey}`);
            console.log(`    📋 Found metadata: ${!!metadata}`);
          }

          if (metadata?.classes?.[className]) {
            const classMetadata = metadata.classes[className];

            // Add/Replace JSDoc for class itself
            if (classMetadata['class-doc']) {
              const leadingComments = ts.getLeadingCommentRanges(content, node.pos);
              const hasJSDoc =
                leadingComments &&
                leadingComments.some(comment =>
                  content.substring(comment.pos, comment.end).includes('/**')
                );

              // Debug for AggregateRoot class
              if (className === 'AggregateRoot') {
                console.log(`      🔍 CLASS DEBUG - ${className}:`);
                console.log(`        Has existing JSDoc: ${hasJSDoc}`);
                console.log(
                  `        Class-doc metadata: ${JSON.stringify(classMetadata['class-doc'], null, 2)}`
                );
              }

              // Always generate JSDoc - replace if exists, add if not
              // Use empty object to force hierarchical resolution for classes too
              const classJSDoc = this.generateJSDoc(
                {}, // Empty object forces hierarchical resolution
                '',
                packageName,
                fileBaseName,
                className
                // No methodName for class-level JSDoc
              );

              // Debug for AggregateRoot class
              if (className === 'AggregateRoot') {
                console.log(`      🔍 CLASS DEBUG - Generated JSDoc:`);
                console.log(classJSDoc.split('\n').slice(0, 5).join('\n'));
              }

              if (hasJSDoc && leadingComments && leadingComments.length > 0) {
                // Replace existing JSDoc
                const commentStart = leadingComments[0].pos;
                const commentLineStart = content.lastIndexOf('\n', commentStart - 1) + 1;

                modifications.push({
                  start: commentLineStart,
                  end: leadingComments[leadingComments.length - 1].end,
                  text: classJSDoc,
                });
              } else {
                // Add new JSDoc
                const classStart = node.getStart(sourceFile);
                const lineStart = content.lastIndexOf('\n', classStart - 1) + 1;

                modifications.push({
                  start: lineStart,
                  end: lineStart,
                  text: classJSDoc + '\n',
                });
              }

              console.log(`    ✅ Enhanced JSDoc for ${className} class`);
            }

            // Process class methods
            if (classMetadata.methods) {
              node.members.forEach(member => {
                if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
                  const memberName = ts.isConstructorDeclaration(member)
                    ? 'constructor'
                    : member.name?.getText(sourceFile);

                  if (memberName && classMetadata.methods[memberName]) {
                    // Get the indent for the member
                    const memberStart = member.getStart(sourceFile);
                    const lineStart = content.lastIndexOf('\n', memberStart - 1) + 1;
                    const memberIndent = content.substring(lineStart, memberStart).match(/^\s*/)[0];

                    // Generate JSDoc with hierarchical resolution
                    // Pass empty object to force hierarchical resolution
                    const methodJSDoc = this.generateJSDoc(
                      {}, // Empty object forces hierarchical resolution
                      memberIndent,
                      packageName,
                      fileBaseName,
                      className,
                      memberName
                    );

                    // Debug for commit method
                    if (memberName === 'commit' && className === 'AggregateRoot') {
                      console.log(`      🔍 COMMIT DEBUG - Generated JSDoc:`);
                      console.log(methodJSDoc.split('\n').slice(0, 5).join('\n'));
                    }

                    // Find position to insert JSDoc
                    const leadingComments = ts.getLeadingCommentRanges(content, member.pos);
                    if (leadingComments && leadingComments.length > 0) {
                      // Debug: check what's already there for commit method
                      if (memberName === 'commit' && className === 'AggregateRoot') {
                        const existingJSDoc = content.substring(
                          leadingComments[0].pos,
                          leadingComments[leadingComments.length - 1].end
                        );
                        console.log(`      🔍 COMMIT DEBUG - Existing JSDoc:`);
                        console.log(existingJSDoc.split('\n').slice(0, 5).join('\n'));
                        console.log(
                          `      🔍 COMMIT DEBUG - Are they the same?`,
                          existingJSDoc.trim() === methodJSDoc.trim()
                        );
                      }

                      // Replace existing JSDoc with properly indented one
                      // We need to preserve any whitespace before the comment
                      const commentStart = leadingComments[0].pos;
                      const commentLineStart = content.lastIndexOf('\n', commentStart - 1) + 1;
                      const commentIndent = content
                        .substring(commentLineStart, commentStart)
                        .match(/^\s*/)[0];

                      modifications.push({
                        start: commentLineStart,
                        end: leadingComments[leadingComments.length - 1].end,
                        text: methodJSDoc,
                      });
                    } else {
                      // Add new JSDoc before the member on a new line
                      modifications.push({
                        start: lineStart,
                        end: lineStart,
                        text: methodJSDoc + '\n',
                      });
                    }

                    console.log(`    ✅ Enhanced JSDoc for ${className}.${memberName}`);
                  }
                }
              });
            }
          }
        }
      }

      // Process functions
      if (ts.isFunctionDeclaration(node)) {
        const functionName = node.name?.text;
        if (functionName) {
          console.log(`  🔍 Found function: ${functionName}`);

          // Load metadata for this file
          const fileBaseName = path.basename(filePath, '.d.ts');

          // For subdirectory files, include the subdirectory in the key to avoid collisions
          const relativePath = path.relative(path.join('packages', packageName, 'dist'), filePath);
          const dirName = path.dirname(relativePath);
          const metadataKey =
            dirName && dirName !== '.'
              ? `${dirName}/${fileBaseName}`.replace(/\\/g, '/')
              : fileBaseName;

          await this.loadClassMetadata(packageName, metadataKey, filePath);
          const key = `${packageName}-${metadataKey.toLowerCase()}`;
          const metadata = this.classMetadata.get(key);

          if (this.debug) {
            console.log(`    📋 Metadata key: ${key}`);
            console.log(`    📋 Has metadata: ${!!metadata}`);
            if (metadata) {
              console.log(`    📋 Metadata keys: ${Object.keys(metadata).join(', ')}`);
              console.log(`    📋 Has functions: ${!!metadata.functions}`);
              console.log(
                `    📋 Function names: ${metadata.functions ? Object.keys(metadata.functions).join(', ') : 'none'}`
              );
            }
          }

          if (metadata?.functions?.[functionName]) {
            const functionMetadata = metadata.functions[functionName];

            // Check if function already has JSDoc
            const leadingComments = ts.getLeadingCommentRanges(content, node.pos);
            const hasJSDoc =
              leadingComments &&
              leadingComments.some(comment =>
                content.substring(comment.pos, comment.end).includes('/**')
              );

            if (!hasJSDoc || this.forceMode) {
              // Pass function metadata directly, not resolved metadata
              const functionJSDoc = this.generateJSDoc(
                functionMetadata,
                '',
                null,
                null,
                null,
                null
              );
              // Find the actual start of the function declaration
              const functionStart = node.getStart(sourceFile);
              // Find the start of the line containing the function
              const lineStart = content.lastIndexOf('\n', functionStart - 1) + 1;
              const indent = content.substring(lineStart, functionStart).match(/^\s*/)[0];

              // Insert JSDoc at the beginning of the line
              modifications.push({
                start: lineStart,
                end: lineStart,
                text: functionJSDoc + '\n',
              });

              console.log(`    ✅ Enhanced JSDoc for function ${functionName}`);
            }
          }
        }
      }

      // Continue traversing the AST
      await Promise.all(node.getChildren(sourceFile).map(child => visit(child)));
    };

    // Start visiting from root
    await visit(sourceFile);

    // Apply modifications in reverse order to maintain positions
    modifications.sort((a, b) => b.start - a.start);

    let modifiedContent = content;
    for (const mod of modifications) {
      modifiedContent =
        modifiedContent.substring(0, mod.start) + mod.text + modifiedContent.substring(mod.end);
    }

    return modifiedContent;
  }

  extractPackageFromPath(filePath) {
    const match = filePath.match(/packages\/([^\/]+)\//);
    return match ? match[1] : 'unknown';
  }

  async processPackage(packageName) {
    console.log(`\n📦 Processing package: ${packageName}`);

    await this.loadPackageMetadata(packageName);

    const pattern = path.join(this.rootDir, 'packages', packageName, 'dist', '**', '*.d.ts');
    const files = globSync(pattern);

    console.log(`Found ${files.length} .d.ts files`);

    for (const file of files) {
      console.log(`\n🔧 Processing: ${path.relative(this.rootDir, file)}`);

      const content = await fs.readFile(file, 'utf-8');

      // First, load metadata for all potential elements in the file
      const baseName = path.basename(file, '.d.ts');
      await this.loadClassMetadata(packageName, baseName, file);

      // Process with AST
      const processedContent = await this.processFileWithAST(file, content);

      if (processedContent !== content) {
        if (this.dryRun) {
          console.log(`🔍 Dry run - would write to: ${file}`);
          // Debug: Show what would be different
          if (baseName === 'aggregate-root' && packageName === 'aggregates') {
            const commitIndex = processedContent.indexOf('commit():');
            if (commitIndex > -1) {
              console.log('  DEBUG: New commit JSDoc would be:');
              console.log(processedContent.substring(commitIndex - 200, commitIndex + 50));
            }
          }
        } else {
          await fs.writeFile(file, processedContent);
          console.log(`✅ File updated with JSDoc`);
        }
      } else {
        console.log(`ℹ️  No changes needed`);
        // Debug for aggregate-root
        if (baseName === 'aggregate-root' && packageName === 'aggregates') {
          console.log('  DEBUG: Content unchanged, checking commit JSDoc:');
          const commitIndex = content.indexOf('commit():');
          if (commitIndex > -1) {
            console.log(content.substring(commitIndex - 200, commitIndex + 50));
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
  const forceMode = args.includes('--force');

  let packageName = args.find(arg => arg.startsWith('--package='))?.split('=')[1];

  if (!packageName) {
    const filterArg = args.find(arg => arg.startsWith('--filter'));
    if (filterArg) {
      const filterValue = args[args.indexOf(filterArg) + 1];
      if (filterValue && filterValue.startsWith('@vytches/')) {
        packageName = filterValue.replace('@vytches/ddd-', '');
      }
    }
  }

  if (!packageName) {
    console.error('❌ Error: Package name is required.');
    console.error('Usage: node inject-yaml-jsdoc-ast.js --package=<package-name>');
    process.exit(1);
  }

  console.log('🚀 YAML JSDoc Injection with TypeScript AST');
  console.log('==========================================');
  console.log(`Package: ${packageName}`);
  console.log(`Dry run: ${dryRun}`);

  const injector = new ASTJSDocInjector(process.cwd());
  injector.dryRun = dryRun;
  injector.forceMode = forceMode;

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

if (require.main === module) {
  main();
}

module.exports = { ASTJSDocInjector };
