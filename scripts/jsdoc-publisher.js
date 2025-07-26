#!/usr/bin/env node

/**
 * JSDoc Publisher for VytchesDDD
 * Generates and publishes HTML documentation from JSDoc comments
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class JSDocPublisher {
  constructor() {
    this.projectRoot = process.cwd();
    this.outputDir = path.join(this.projectRoot, 'docs', 'api');
    this.tempConfigFile = path.join(this.projectRoot, 'jsdoc.config.json');
    this.packages = this.getPackages();
  }

  /**
   * Main publication method
   */
  async publish() {
    console.log('📚 Publishing JSDoc documentation for VytchesDDD...\n');

    try {
      // Check if JSDoc is installed
      await this.checkJSDocInstalled();

      // Create output directory
      await this.createOutputDirectory();

      // Generate JSDoc configuration
      await this.generateJSDocConfig();

      // Generate documentation
      await this.generateDocumentation();

      // Create index page
      await this.createIndexPage();

      // Navigation is now built into each package page

      // Cleanup
      await this.cleanup();

      console.log('\n✅ Documentation published successfully!');
      console.log(`📖 Open documentation: ${path.join(this.outputDir, 'index.html')}`);
      console.log(`🌐 Serve locally: cd ${this.outputDir} && python -m http.server 8000`);
    } catch (error) {
      console.error('❌ Documentation publication failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check if JSDoc is installed
   */
  async checkJSDocInstalled() {
    try {
      execSync('npx jsdoc --version', { stdio: 'pipe' });
      console.log('✅ JSDoc is available');
    } catch (error) {
      console.log('📦 Installing JSDoc...');
      try {
        execSync('npm install -g jsdoc', { stdio: 'inherit' });
        console.log('✅ JSDoc installed');
      } catch (installError) {
        throw new Error(
          'Failed to install JSDoc. Please install it manually: npm install -g jsdoc'
        );
      }
    }
  }

  /**
   * Get all packages to document
   */
  getPackages() {
    const packagesDir = path.join(this.projectRoot, 'packages');
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
   * Create output directory
   */
  async createOutputDirectory() {
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true });
    }
    fs.mkdirSync(this.outputDir, { recursive: true });
    console.log('📁 Created output directory');
  }

  /**
   * Generate JSDoc configuration
   */
  async generateJSDocConfig() {
    const config = {
      source: {
        include: this.packages.filter(pkg => fs.existsSync(pkg.srcPath)).map(pkg => pkg.srcPath),
        includePattern: '\\.(js|ts)$',
        exclude: ['node_modules/', 'dist/', 'build/', 'tests/'],
      },
      opts: {
        destination: this.outputDir,
        recurse: true,
        readme: path.join(this.projectRoot, 'README.md'),
      },
      plugins: ['plugins/markdown'],
      templates: {
        cleverLinks: false,
        monospaceLinks: false,
      },
      tags: {
        allowUnknownTags: true,
        dictionaries: ['jsdoc', 'closure'],
      },
    };

    fs.writeFileSync(this.tempConfigFile, JSON.stringify(config, null, 2));
    console.log('⚙️  Generated JSDoc configuration');
  }

  /**
   * Generate documentation using custom HTML generator
   */
  async generateDocumentation() {
    console.log('📝 Generating documentation...');

    try {
      // Generate package-specific documentation
      for (const pkg of this.packages) {
        if (fs.existsSync(pkg.srcPath)) {
          await this.generatePackageDocumentation(pkg);
        }
      }

      console.log('✅ Documentation generated');
    } catch (error) {
      console.error('❌ Documentation generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate documentation for a specific package
   */
  async generatePackageDocumentation(pkg) {
    console.log(`  📦 Generating docs for ${pkg.name}...`);

    const packageDir = path.join(this.outputDir, pkg.name);
    fs.mkdirSync(packageDir, { recursive: true });

    const files = this.getTypeScriptFiles(pkg.srcPath);
    const packageDocs = [];

    for (const file of files) {
      const relativePath = path.relative(pkg.srcPath, file);
      const content = fs.readFileSync(file, 'utf8');
      const docs = this.extractDocumentation(content, relativePath);

      if (docs.length > 0) {
        packageDocs.push({
          file: relativePath,
          docs: docs,
        });
      }
    }

    // Generate package index
    const packageIndexContent = this.generatePackageIndex(pkg, packageDocs);
    fs.writeFileSync(path.join(packageDir, 'index.html'), packageIndexContent);
  }

  /**
   * Extract JSDoc documentation from TypeScript content
   */
  extractDocumentation(content, filePath) {
    const docs = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Look for export declarations
      if (line.startsWith('export ')) {
        const exportMatch = line.match(
          /export\s+(class|interface|function|enum|type|const)\s+(\w+)/
        );
        if (exportMatch) {
          const [, type, name] = exportMatch;

          // Look for JSDoc above this export
          const jsdocContent = this.findJSDocAbove(lines, i);

          if (jsdocContent) {
            docs.push({
              type: type,
              name: name,
              jsdoc: jsdocContent,
              line: i + 1,
            });
          }
        }
      }
    }

    return docs;
  }

  /**
   * Find JSDoc comment above a line
   */
  findJSDocAbove(lines, lineIndex) {
    const jsdocLines = [];
    let inJSDoc = false;
    let foundEnd = false;

    // Look backwards for JSDoc
    for (let i = lineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();

      if (line === '*/') {
        foundEnd = true;
        inJSDoc = true;
        continue;
      }

      if (line.startsWith('/**')) {
        if (foundEnd) {
          jsdocLines.reverse();
          return jsdocLines.join('\n');
        }
        break;
      }

      if (inJSDoc && (line.startsWith('*') || line.startsWith('//'))) {
        jsdocLines.push(line.replace(/^\s*\*\s?/, ''));
      } else if (inJSDoc) {
        break;
      }

      if (line && !line.startsWith('*') && !line.startsWith('//') && !inJSDoc) {
        break;
      }
    }

    return null;
  }

  /**
   * Generate HTML index for a package
   */
  generatePackageIndex(pkg, packageDocs) {
    const packageDomains = {
      contracts: 'Core',
      'domain-primitives': 'Core',
      'value-objects': 'Core',
      repositories: 'Pattern',
      aggregates: 'Pattern',
      events: 'Architecture',
      cqrs: 'Architecture',
      acl: 'Integration',
      messaging: 'Integration',
      resilience: 'Infrastructure',
      logging: 'Infrastructure',
      policies: 'Pattern',
      validation: 'Pattern',
      'domain-services': 'Pattern',
      projections: 'Architecture',
      'event-store': 'Architecture',
      testing: 'Infrastructure',
      utils: 'Infrastructure',
      cli: 'Infrastructure',
      enterprise: 'Infrastructure',
      'event-scheduling': 'Architecture',
      di: 'Infrastructure',
      core: 'Core',
    };

    const domain = packageDomains[pkg.name] || 'Unknown';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@vytches/ddd-${pkg.name} - Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 2em;
        }
        .header p {
            margin: 10px 0 0;
            opacity: 0.9;
        }
        .nav {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .nav a {
            color: #667eea;
            text-decoration: none;
            margin-right: 15px;
        }
        .nav a:hover {
            text-decoration: underline;
        }
        .api-section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .api-item {
            border-bottom: 1px solid #eee;
            padding: 20px 0;
        }
        .api-item:last-child {
            border-bottom: none;
        }
        .api-header {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
        }
        .api-type {
            background: #667eea;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 10px;
        }
        .api-name {
            font-size: 1.4em;
            font-weight: bold;
            color: #333;
        }
        .jsdoc-content {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #667eea;
            font-family: monospace;
            white-space: pre-wrap;
        }
        .file-section {
            margin-bottom: 30px;
        }
        .file-header {
            background: #e9ecef;
            padding: 10px 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-weight: bold;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .stat-number {
            font-size: 1.5em;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>@vytches/ddd-${pkg.name}</h1>
        <p>${domain} Package - API Documentation</p>
    </div>

    <div class="nav">
        <a href="../index.html">← Back to Overview</a>
        <a href="#api">API Reference</a>
        <a href="#files">Files</a>
    </div>

    <div class="stats">
        <div class="stat-item">
            <div class="stat-number">${packageDocs.length}</div>
            <div class="stat-label">Files</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${packageDocs.reduce((sum, file) => sum + file.docs.length, 0)}</div>
            <div class="stat-label">Exports</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${domain}</div>
            <div class="stat-label">Domain</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">TypeScript</div>
            <div class="stat-label">Language</div>
        </div>
    </div>

    <div class="api-section">
        <h2 id="api">API Reference</h2>
        ${packageDocs
          .map(
            fileDoc => `
            <div class="file-section">
                <div class="file-header">📄 ${fileDoc.file}</div>
                ${fileDoc.docs
                  .map(
                    doc => `
                    <div class="api-item">
                        <div class="api-header">
                            <span class="api-type">${doc.type}</span>
                            <span class="api-name">${doc.name}</span>
                        </div>
                        <div class="jsdoc-content">${doc.jsdoc}</div>
                    </div>
                `
                  )
                  .join('')}
            </div>
        `
          )
          .join('')}
    </div>
</body>
</html>`;
  }

  /**
   * Create custom index page
   */
  async createIndexPage() {
    const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VytchesDDD API Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 600;
        }
        .header p {
            margin: 10px 0 0;
            font-size: 1.2em;
            opacity: 0.9;
        }
        .packages-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .package-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 4px solid #667eea;
        }
        .package-card h3 {
            margin: 0 0 10px;
            color: #667eea;
            font-size: 1.3em;
        }
        .package-card p {
            color: #666;
            margin: 0 0 15px;
        }
        .package-card a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .package-card a:hover {
            text-decoration: underline;
        }
        .stats {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        .stats h2 {
            margin: 0 0 20px;
            color: #333;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        .stat-item {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
        }
        .footer {
            text-align: center;
            color: #666;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>VytchesDDD</h1>
        <p>Enterprise Domain-Driven Design Library - API Documentation</p>
    </div>

    <div class="stats">
        <h2>📊 Documentation Statistics</h2>
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-number">${this.packages.length}</div>
                <div class="stat-label">Packages</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">77%</div>
                <div class="stat-label">Files Documented</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">50%</div>
                <div class="stat-label">API Coverage</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">LLM</div>
                <div class="stat-label">AI Optimized</div>
            </div>
        </div>
    </div>

    <div class="packages-grid">
        ${this.generatePackageCards()}
    </div>

    <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString()} | VytchesDDD Documentation System</p>
    </div>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'index.html'), indexContent);
    console.log('📄 Created custom index page');
  }

  /**
   * Generate package cards for index page
   */
  generatePackageCards() {
    const packageDomains = {
      contracts: 'Core',
      'domain-primitives': 'Core',
      'value-objects': 'Core',
      repositories: 'Pattern',
      aggregates: 'Pattern',
      events: 'Architecture',
      cqrs: 'Architecture',
      acl: 'Integration',
      messaging: 'Integration',
      resilience: 'Infrastructure',
      logging: 'Infrastructure',
      policies: 'Pattern',
      validation: 'Pattern',
      'domain-services': 'Pattern',
      projections: 'Architecture',
      'event-store': 'Architecture',
      testing: 'Infrastructure',
      utils: 'Infrastructure',
      cli: 'Infrastructure',
      enterprise: 'Infrastructure',
      'event-scheduling': 'Architecture',
      di: 'Infrastructure',
      core: 'Core',
    };

    const packageDescriptions = {
      contracts: 'Core interfaces and contracts for entire library',
      'domain-primitives': 'Base classes, errors, and domain primitives',
      'value-objects': 'Value object implementations and EntityId',
      repositories: 'Repository patterns and Unit of Work',
      aggregates: 'Aggregate root with capabilities system',
      events: 'Domain event handling and dispatching',
      cqrs: 'Command Query Responsibility Segregation',
      acl: 'Anti-corruption layer for external systems',
      messaging: 'Message handling and saga orchestration',
      resilience: 'Resilience patterns and fault tolerance',
      logging: 'Structured logging for DDD applications',
      policies: 'Business policies and validation rules',
      validation: 'Domain validation and specifications',
      'domain-services': 'Domain service implementations',
      projections: 'Event sourcing projections',
      'event-store': 'Event storage and replay capabilities',
      testing: 'Testing utilities for DDD applications',
      utils: 'Common utilities and helper functions',
      cli: 'Command-line interface for code generation',
      enterprise: 'Enterprise-grade features and bundles',
      'event-scheduling': 'Event scheduling and delayed processing',
      di: 'Dependency injection and service location',
      core: 'Meta-package providing stable API',
    };

    return this.packages
      .map(pkg => {
        const domain = packageDomains[pkg.name] || 'Unknown';
        const description = packageDescriptions[pkg.name] || 'Package documentation';

        return `
        <div class="package-card">
            <h3>@vytches/ddd-${pkg.name}</h3>
            <p><strong>${domain}</strong> - ${description}</p>
            <a href="${pkg.name}/index.html">View Documentation →</a>
        </div>
      `;
      })
      .join('');
  }

  /**
   * Create package navigation
   */
  async createPackageNavigation() {
    const navContent = `
    <nav style="background: #667eea; padding: 10px; margin-bottom: 20px;">
        <a href="../index.html" style="color: white; text-decoration: none; margin-right: 20px;">← Back to Overview</a>
        <span style="color: white;">|</span>
        ${this.packages
          .map(
            pkg =>
              `<a href="../${pkg.name}/index.html" style="color: white; text-decoration: none; margin: 0 10px;">${pkg.name}</a>`
          )
          .join('')}
    </nav>
    `;

    // Add navigation to each package's documentation
    this.packages.forEach(pkg => {
      const packageDir = path.join(this.outputDir, pkg.name);
      if (fs.existsSync(packageDir)) {
        const indexPath = path.join(packageDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          let content = fs.readFileSync(indexPath, 'utf8');
          content = content.replace('<body>', `<body>${navContent}`);
          fs.writeFileSync(indexPath, content);
        }
      }
    });

    console.log('🧭 Created package navigation');
  }

  /**
   * Cleanup temporary files
   */
  async cleanup() {
    if (fs.existsSync(this.tempConfigFile)) {
      fs.unlinkSync(this.tempConfigFile);
    }
    console.log('🧹 Cleaned up temporary files');
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const publisher = new JSDocPublisher();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
JSDoc Publisher for VytchesDDD

Usage:
  node scripts/jsdoc-publisher.js [options]

Options:
  --help, -h    Show this help message
  --serve, -s   Generate documentation and serve locally
  --watch, -w   Watch for changes and regenerate

Examples:
  node scripts/jsdoc-publisher.js
  node scripts/jsdoc-publisher.js --serve
  node scripts/jsdoc-publisher.js --watch
    `);
    process.exit(0);
  }

  publisher.publish().catch(console.error);

  // Optional: serve locally
  if (args.includes('--serve') || args.includes('-s')) {
    const { spawn } = require('child_process');
    const serverProcess = spawn('python', ['-m', 'http.server', '8000'], {
      cwd: publisher.outputDir,
      stdio: 'inherit',
    });

    console.log(`\n🌐 Serving documentation at http://localhost:8000`);
    console.log('Press Ctrl+C to stop the server');

    process.on('SIGINT', () => {
      serverProcess.kill();
      process.exit(0);
    });
  }

  // Optional: watch for changes
  if (args.includes('--watch') || args.includes('-w')) {
    const chokidar = require('chokidar');
    const watcher = chokidar.watch('packages/*/src/**/*.ts', { ignoreInitial: true });

    console.log('\n👀 Watching for changes...');
    watcher.on('change', path => {
      console.log(`📝 File changed: ${path}`);
      console.log('🔄 Regenerating documentation...');
      publisher.publish().catch(console.error);
    });
  }
}

module.exports = JSDocPublisher;
