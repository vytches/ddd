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

    let yamlFileName;
    if (fileName) {
      yamlFileName = path.basename(fileName, '.d.ts').replace('.interface', '.interface');
    } else {
      yamlFileName = className
        .replace(/([A-Z])/g, (match, letter, index) => index === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`)
        .replace(/^-/, '');
    }
      
    const classMeta = await this.loadYamlFile(
      path.join(this.rootDir, 'docs', 'examples', 'domain', packageName, `${yamlFileName}.yaml`)
    );
    if (classMeta) {
      this.classMetadata.set(key, classMeta);
      if (this.debug) {
        console.log(`✅ Class metadata loaded for ${className} from ${yamlFileName}.yaml`);
      }
    }
  }

  /**
   * Parse TypeScript file using AST
   */
  parseTypeScriptFile(content) {
    const sourceFile = ts.createSourceFile(
      'temp.d.ts',
      content,
      ts.ScriptTarget.Latest,
      true
    );
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
          if (typeof overlay[key] === 'object' && overlay[key] !== null && !Array.isArray(overlay[key])) {
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
  resolveHierarchicalMetadata(packageName, fileBaseName, interfaceOrClassName, methodName = null, format = 'jsdoc') {
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
    const fileKey = `${packageName}-${fileBaseName.toLowerCase()}`;
    const fileMeta = this.classMetadata.get(fileKey);
    if (fileMeta) {
      const fileStrategy = fileMeta.hierarchy?.strategy || 'merge';
      
      // Get class or interface specific metadata
      let elementMeta = fileMeta.classes?.[interfaceOrClassName] || 
                        fileMeta.interfaces?.[interfaceOrClassName] ||
                        fileMeta;
      
      if (elementMeta && elementMeta !== fileMeta) {
        const elementStrategy = elementMeta.hierarchy?.strategy || elementMeta.strategy || fileStrategy;
        resolved = this.mergeMetadata(resolved, elementMeta, elementStrategy);
      }
      
      // 4. Apply method metadata if specified
      if (methodName && elementMeta?.methods?.[methodName]) {
        const methodMeta = elementMeta.methods[methodName];
        const methodStrategy = methodMeta.hierarchy?.strategy || methodMeta.strategy || 'merge';
        resolved = this.mergeMetadata(resolved, methodMeta, methodStrategy);
      }
    }
    
    // 5. Apply format-specific overrides
    const formatSpecific = {};
    for (const key in resolved) {
      // Check for format-specific keys like 'description.jsdoc'
      if (key.includes('.')) {
        const [baseKey, formatKey] = key.split('.');
        if (formatKey === format) {
          formatSpecific[baseKey] = resolved[key];
        }
      }
    }
    
    // Override with format-specific values
    Object.assign(resolved, formatSpecific);
    
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
  generateJSDoc(metadata, indent = '', packageName = null, fileBaseName = null, interfaceOrClassName = null, methodName = null) {
    // If we have hierarchy info, resolve it
    if (packageName && fileBaseName) {
      metadata = this.resolveHierarchicalMetadata(packageName, fileBaseName, interfaceOrClassName, methodName, 'jsdoc');
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
        lines.push(`${indent} * @param {${param.type}} ${param.name}${optional} ${param.description}`);
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
      metadata.examples.forEach((example) => {
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
    const visit = async (node) => {
      // Process interfaces
      if (ts.isInterfaceDeclaration(node)) {
        const interfaceName = node.name.text;
        console.log(`  🔍 Found interface: ${interfaceName}`);
        
        // Load metadata for this interface
        const fileBaseName = path.basename(filePath, '.d.ts');
        await this.loadClassMetadata(packageName, fileBaseName, filePath);
        const key = `${packageName}-${fileBaseName.toLowerCase()}`;
        const metadata = this.classMetadata.get(key);
        
        if (this.debug) {
          console.log(`    📋 Metadata key: ${key}`);
          console.log(`    📋 Has metadata: ${!!metadata}`);
          if (metadata) {
            console.log(`    📋 Has interfaces: ${!!metadata.interfaces}`);
            console.log(`    📋 Interface names: ${metadata.interfaces ? Object.keys(metadata.interfaces).join(', ') : 'none'}`);
          }
        }
        
        if (metadata?.interfaces?.[interfaceName]) {
          const interfaceMetadata = metadata.interfaces[interfaceName];
          
          // Add JSDoc for interface itself if it doesn't already have one
          const leadingComments = ts.getLeadingCommentRanges(content, node.pos);
          const hasJSDoc = leadingComments && leadingComments.some(comment => 
            content.substring(comment.pos, comment.end).includes('/**')
          );
          
          if (!hasJSDoc) {
            const interfaceJSDoc = this.generateJSDoc(interfaceMetadata, '', packageName, fileBaseName, interfaceName);
            // Find the actual start of the interface declaration
            const interfaceStart = node.getStart(sourceFile);
            // Find the start of the line containing the interface
            const lineStart = content.lastIndexOf('\n', interfaceStart - 1) + 1;
            const indent = content.substring(lineStart, interfaceStart).match(/^\s*/)[0];
            
            // Insert JSDoc at the beginning of the line
            modifications.push({
              start: lineStart,
              end: lineStart,
              text: interfaceJSDoc + '\n'
            });
          }
          
          // Process interface methods
          if (interfaceMetadata.methods) {
            node.members.forEach(member => {
              if (ts.isMethodSignature(member) || ts.isPropertySignature(member)) {
                const memberName = member.name?.getText(sourceFile);
                if (memberName && interfaceMetadata.methods[memberName]) {
                  const methodMetadata = interfaceMetadata.methods[memberName];
                  
                  // Get the indent for the member
                  const memberStart = member.getStart(sourceFile);
                  const lineStart = content.lastIndexOf('\n', memberStart - 1) + 1;
                  const memberIndent = content.substring(lineStart, memberStart).match(/^\s*/)[0];
                  
                  // Generate JSDoc with the same indent as the member
                  const methodJSDoc = this.generateJSDoc(methodMetadata, memberIndent, packageName, fileBaseName, interfaceName, memberName);
                  
                  // Find the position to insert JSDoc
                  const leadingComments = ts.getLeadingCommentRanges(content, member.pos);
                  if (leadingComments && leadingComments.length > 0) {
                    // Replace existing JSDoc with properly indented one
                    // We need to preserve any whitespace before the comment
                    const commentStart = leadingComments[0].pos;
                    const commentLineStart = content.lastIndexOf('\n', commentStart - 1) + 1;
                    const commentIndent = content.substring(commentLineStart, commentStart).match(/^\s*/)[0];
                    
                    modifications.push({
                      start: commentLineStart,
                      end: leadingComments[leadingComments.length - 1].end,
                      text: methodJSDoc
                    });
                  } else {
                    // Add new JSDoc before the member on a new line
                    modifications.push({
                      start: lineStart,
                      end: lineStart,
                      text: methodJSDoc + '\n'
                    });
                  }
                  
                  console.log(`    ✅ Enhanced JSDoc for ${interfaceName}.${memberName}`);
                }
              }
            });
          }
        }
      }
      
      // Process classes
      if (ts.isClassDeclaration(node)) {
        const className = node.name?.text;
        if (className) {
          console.log(`  🔍 Found class: ${className}`);
          
          // Load metadata for this class
          const fileBaseName = path.basename(filePath, '.d.ts');
          await this.loadClassMetadata(packageName, fileBaseName, filePath);
          const key = `${packageName}-${fileBaseName.toLowerCase()}`;
          const metadata = this.classMetadata.get(key);
          
          if (metadata?.classes?.[className]) {
            const classMetadata = metadata.classes[className];
            
            // Add JSDoc for class itself if it doesn't already have one
            if (classMetadata['class-doc']) {
              const leadingComments = ts.getLeadingCommentRanges(content, node.pos);
              const hasJSDoc = leadingComments && leadingComments.some(comment => 
                content.substring(comment.pos, comment.end).includes('/**')
              );
              
              if (!hasJSDoc) {
                const classJSDoc = this.generateJSDoc(classMetadata['class-doc'], '', packageName, fileBaseName, className);
                // Find the actual start of the class declaration
                const classStart = node.getStart(sourceFile);
                // Find the start of the line containing the class
                const lineStart = content.lastIndexOf('\n', classStart - 1) + 1;
                const indent = content.substring(lineStart, classStart).match(/^\s*/)[0];
                
                // Insert JSDoc at the beginning of the line
                modifications.push({
                  start: lineStart,
                  end: lineStart,
                  text: classJSDoc + '\n'
                });
              }
            }
            
            // Process class methods
            if (classMetadata.methods) {
              node.members.forEach(member => {
                if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
                  const memberName = ts.isConstructorDeclaration(member) ? 
                    'constructor' : member.name?.getText(sourceFile);
                  
                  if (memberName && classMetadata.methods[memberName]) {
                    const methodMetadata = classMetadata.methods[memberName];
                    
                    // Get the indent for the member
                    const memberStart = member.getStart(sourceFile);
                    const lineStart = content.lastIndexOf('\n', memberStart - 1) + 1;
                    const memberIndent = content.substring(lineStart, memberStart).match(/^\s*/)[0];
                    
                    // Generate JSDoc with the same indent as the member
                    const methodJSDoc = this.generateJSDoc(methodMetadata, memberIndent, packageName, fileBaseName, className, memberName);
                    
                    // Find position to insert JSDoc
                    const leadingComments = ts.getLeadingCommentRanges(content, member.pos);
                    if (leadingComments && leadingComments.length > 0) {
                      // Replace existing JSDoc with properly indented one
                      // We need to preserve any whitespace before the comment
                      const commentStart = leadingComments[0].pos;
                      const commentLineStart = content.lastIndexOf('\n', commentStart - 1) + 1;
                      const commentIndent = content.substring(commentLineStart, commentStart).match(/^\s*/)[0];
                      
                      modifications.push({
                        start: commentLineStart,
                        end: leadingComments[leadingComments.length - 1].end,
                        text: methodJSDoc
                      });
                    } else {
                      // Add new JSDoc before the member on a new line
                      modifications.push({
                        start: lineStart,
                        end: lineStart,
                        text: methodJSDoc + '\n'
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
      
      // Continue traversing the AST
      await Promise.all(
        node.getChildren(sourceFile).map(child => visit(child))
      );
    };
    
    // Start visiting from root
    await visit(sourceFile);
    
    // Apply modifications in reverse order to maintain positions
    modifications.sort((a, b) => b.start - a.start);
    
    let modifiedContent = content;
    for (const mod of modifications) {
      modifiedContent = 
        modifiedContent.substring(0, mod.start) + 
        mod.text + 
        modifiedContent.substring(mod.end);
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
        } else {
          await fs.writeFile(file, processedContent);
          console.log(`✅ File updated with JSDoc`);
        }
      } else {
        console.log(`ℹ️  No changes needed`);
      }
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
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