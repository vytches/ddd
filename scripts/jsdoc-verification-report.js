#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'examples', 'domain');
const DIST_PATTERN = /\/dist\//;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
};

// Package metadata
const packageInfo = {
  'domain-primitives': { priority: 'HIGH', complexity: 'LOW', status: 'IN_PROGRESS' },
  'value-objects': { priority: 'HIGH', complexity: 'LOW', status: 'DONE' },
  'repositories': { priority: 'HIGH', complexity: 'MEDIUM', status: 'DONE' },
  'aggregates': { priority: 'HIGH', complexity: 'HIGH', status: 'DONE' },
  'contracts': { priority: 'HIGH', complexity: 'LOW', status: 'DONE' },
  'events': { priority: 'HIGH', complexity: 'MEDIUM', status: 'DONE' },
  'cqrs': { priority: 'HIGH', complexity: 'MEDIUM', status: 'DONE' },
  'logging': { priority: 'MEDIUM', complexity: 'LOW', status: 'DONE' },
  'di': { priority: 'MEDIUM', complexity: 'HIGH', status: 'DONE' },
  'validation': { priority: 'MEDIUM', complexity: 'MEDIUM', status: 'TODO' },
  'policies': { priority: 'MEDIUM', complexity: 'HIGH', status: 'TODO' },
  'domain-services': { priority: 'MEDIUM', complexity: 'MEDIUM', status: 'TODO' },
  'acl': { priority: 'LOW', complexity: 'HIGH', status: 'TODO' },
  'messaging': { priority: 'LOW', complexity: 'HIGH', status: 'TODO' },
  'resilience': { priority: 'LOW', complexity: 'HIGH', status: 'TODO' },
  'projections': { priority: 'LOW', complexity: 'HIGH', status: 'TODO' },
  'event-store': { priority: 'MEDIUM', complexity: 'HIGH', status: 'IN_PROGRESS' },
  'event-scheduling': { priority: 'LOW', complexity: 'MEDIUM', status: 'TODO' },
  'testing': { priority: 'LOW', complexity: 'LOW', status: 'TODO' },
  'nestjs': { priority: 'MEDIUM', complexity: 'HIGH', status: 'IN_PROGRESS' },
  'process-managers': { priority: 'LOW', complexity: 'HIGH', status: 'TODO' },
  'utils': { priority: 'LOW', complexity: 'LOW', status: 'TODO' },
};

// Helper functions
function getPackages() {
  return fs.readdirSync(PACKAGES_DIR)
    .filter(dir => {
      const packagePath = path.join(PACKAGES_DIR, dir);
      return fs.statSync(packagePath).isDirectory() && 
             fs.existsSync(path.join(packagePath, 'package.json'));
    })
    .filter(pkg => pkg !== 'cli' && pkg !== 'enterprise' && pkg !== 'core'); // Skip meta packages
}

function countJSDocComments(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
    const matches = content.match(jsdocRegex) || [];
    
    // Count meaningful JSDoc (not just empty /** */)
    const meaningfulDocs = matches.filter(doc => {
      const lines = doc.split('\n');
      return lines.length > 2 || doc.includes('@');
    });
    
    return {
      total: matches.length,
      meaningful: meaningfulDocs.length,
      hasExamples: matches.some(doc => doc.includes('@example')),
      hasBusinessContext: matches.some(doc => doc.includes('@businessContext')),
      hasSince: matches.some(doc => doc.includes('@since')),
    };
  } catch (error) {
    return { total: 0, meaningful: 0, hasExamples: false, hasBusinessContext: false, hasSince: false };
  }
}

function analyzeDistFiles(packagePath) {
  const distPath = path.join(packagePath, 'dist');
  if (!fs.existsSync(distPath)) {
    return { files: 0, withJSDoc: 0, coverage: 0, details: [] };
  }

  const files = [];
  function walkDir(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(distPath);
  
  const details = files.map(file => {
    const relativePath = path.relative(distPath, file);
    const stats = countJSDocComments(file);
    return {
      file: relativePath,
      hasJSDoc: stats.meaningful > 0,
      jsdocCount: stats.meaningful,
      hasExamples: stats.hasExamples,
      hasBusinessContext: stats.hasBusinessContext,
    };
  });

  const withJSDoc = details.filter(d => d.hasJSDoc).length;
  const coverage = files.length > 0 ? ((withJSDoc / files.length) * 100).toFixed(1) : 0;

  return {
    files: files.length,
    withJSDoc,
    coverage: parseFloat(coverage),
    details,
  };
}

function checkYAMLMetadata(packageName) {
  const yamlPath = path.join(DOCS_DIR, packageName);
  if (!fs.existsSync(yamlPath)) {
    return { exists: false, files: 0 };
  }

  const yamlFiles = [];
  function walkDir(dir) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (item.endsWith('.yaml')) {
          yamlFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
  }
  
  walkDir(yamlPath);
  
  return {
    exists: true,
    files: yamlFiles.length,
    yamlFiles: yamlFiles.map(f => path.relative(yamlPath, f)),
  };
}

function getLastBuildTime(packagePath) {
  const distPath = path.join(packagePath, 'dist');
  if (!fs.existsSync(distPath)) {
    return null;
  }
  
  try {
    const stat = fs.statSync(distPath);
    return stat.mtime;
  } catch {
    return null;
  }
}

function analyzeBuildSystem() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  const scripts = packageJson.scripts || {};
  
  return {
    hasJSDocInject: scripts.build && scripts.build.includes('jsdoc:inject'),
    hasCleanBuild: !!scripts['build:clean'],
    buildCommand: scripts.build,
    injectCommand: scripts['jsdoc:inject:all'],
  };
}

// Main analysis
function generateReport() {
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}        VytchesDDD JSDoc Verification Report${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  // Analyze build system
  const buildInfo = analyzeBuildSystem();
  console.log(`${colors.bold}📦 Build System Analysis:${colors.reset}`);
  console.log(`  JSDoc auto-injection: ${buildInfo.hasJSDocInject ? colors.green + '✓' : colors.red + '✗'} ${colors.reset}`);
  console.log(`  Clean build available: ${buildInfo.hasCleanBuild ? colors.green + '✓' : colors.red + '✗'} ${colors.reset}`);
  console.log(`  Build command: ${colors.cyan}${buildInfo.buildCommand?.substring(0, 80)}...${colors.reset}\n`);

  // Package analysis
  const packages = getPackages();
  const results = [];
  let totalFiles = 0;
  let totalWithJSDoc = 0;
  let totalYAMLFiles = 0;

  console.log(`${colors.bold}📊 Package Analysis:${colors.reset}\n`);

  for (const packageName of packages) {
    const packagePath = path.join(PACKAGES_DIR, packageName);
    const distAnalysis = analyzeDistFiles(packagePath);
    const yamlAnalysis = checkYAMLMetadata(packageName);
    const lastBuild = getLastBuildTime(packagePath);
    const metadata = packageInfo[packageName] || { priority: 'UNKNOWN', complexity: 'UNKNOWN', status: 'UNKNOWN' };

    totalFiles += distAnalysis.files;
    totalWithJSDoc += distAnalysis.withJSDoc;
    totalYAMLFiles += yamlAnalysis.files;

    results.push({
      name: packageName,
      ...metadata,
      dist: distAnalysis,
      yaml: yamlAnalysis,
      lastBuild,
    });
  }

  // Sort by priority and status
  results.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 3 };
    const statusOrder = { IN_PROGRESS: 0, TODO: 1, DONE: 2, UNKNOWN: 3 };
    
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Display results
  console.log(`${colors.bold}Package${' '.repeat(18)}Priority  Complex  Status       JSDoc   YAML  Last Build${colors.reset}`);
  console.log(`${'─'.repeat(85)}`);

  for (const result of results) {
    const statusColor = 
      result.status === 'DONE' ? colors.green :
      result.status === 'IN_PROGRESS' ? colors.yellow :
      result.status === 'TODO' ? colors.red :
      colors.white;

    const priorityColor = 
      result.priority === 'HIGH' ? colors.red :
      result.priority === 'MEDIUM' ? colors.yellow :
      colors.cyan;

    const coverageColor = 
      result.dist.coverage >= 80 ? colors.green :
      result.dist.coverage >= 50 ? colors.yellow :
      colors.red;

    const yamlColor = 
      result.yaml.files > 0 ? colors.green :
      colors.red;

    const lastBuildStr = result.lastBuild ? 
      new Date(result.lastBuild).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) :
      'Never built';

    console.log(
      `${result.name.padEnd(25)} ` +
      `${priorityColor}${result.priority.padEnd(9)}${colors.reset} ` +
      `${result.complexity.padEnd(8)} ` +
      `${statusColor}${result.status.padEnd(12)}${colors.reset} ` +
      `${coverageColor}${result.dist.coverage.toString().padStart(5)}%${colors.reset}  ` +
      `${yamlColor}${result.yaml.files.toString().padStart(4)}${colors.reset}  ` +
      `${colors.cyan}${lastBuildStr}${colors.reset}`
    );
  }

  console.log(`${'─'.repeat(85)}`);

  // Summary statistics
  const overallCoverage = totalFiles > 0 ? ((totalWithJSDoc / totalFiles) * 100).toFixed(1) : 0;
  const packagesWithYAML = results.filter(r => r.yaml.files > 0).length;
  const packagesDone = results.filter(r => r.status === 'DONE').length;
  const packagesInProgress = results.filter(r => r.status === 'IN_PROGRESS').length;
  const packagesTodo = results.filter(r => r.status === 'TODO').length;

  console.log(`\n${colors.bold}📈 Summary Statistics:${colors.reset}`);
  console.log(`  Total packages: ${packages.length}`);
  console.log(`  Overall JSDoc coverage: ${overallCoverage}% (${totalWithJSDoc}/${totalFiles} files)`);
  console.log(`  Packages with YAML metadata: ${packagesWithYAML}/${packages.length}`);
  console.log(`  Total YAML files: ${totalYAMLFiles}`);
  console.log(`  Status: ${colors.green}${packagesDone} Done${colors.reset}, ${colors.yellow}${packagesInProgress} In Progress${colors.reset}, ${colors.red}${packagesTodo} TODO${colors.reset}\n`);

  // Recommendations
  console.log(`${colors.bold}🎯 Recommended Next Packages (High Priority TODOs):${colors.reset}`);
  const nextPackages = results
    .filter(r => r.status === 'TODO' && r.priority === 'HIGH')
    .slice(0, 3);

  if (nextPackages.length === 0) {
    const mediumPriority = results
      .filter(r => r.status === 'TODO' && r.priority === 'MEDIUM')
      .slice(0, 3);
    
    for (const pkg of mediumPriority) {
      console.log(`  • ${colors.yellow}${pkg.name}${colors.reset} (${pkg.complexity} complexity)`);
    }
  } else {
    for (const pkg of nextPackages) {
      console.log(`  • ${colors.red}${pkg.name}${colors.reset} (${pkg.complexity} complexity)`);
    }
  }

  // In-progress packages
  const inProgress = results.filter(r => r.status === 'IN_PROGRESS');
  if (inProgress.length > 0) {
    console.log(`\n${colors.bold}⚠️  Packages Currently In Progress:${colors.reset}`);
    for (const pkg of inProgress) {
      console.log(`  • ${colors.yellow}${pkg.name}${colors.reset} - Coverage: ${pkg.dist.coverage}%, YAML files: ${pkg.yaml.files}`);
    }
  }

  // Action items
  console.log(`\n${colors.bold}📋 Action Items:${colors.reset}`);
  
  // Check for packages with low coverage
  const lowCoverage = results.filter(r => r.dist.files > 0 && r.dist.coverage < 50 && r.status !== 'TODO');
  if (lowCoverage.length > 0) {
    console.log(`  ${colors.red}1. Fix low JSDoc coverage in:${colors.reset}`);
    for (const pkg of lowCoverage) {
      console.log(`     • ${pkg.name} (${pkg.dist.coverage}%)`);
    }
  }

  // Check for packages missing YAML
  const missingYAML = results.filter(r => r.yaml.files === 0 && r.status === 'DONE');
  if (missingYAML.length > 0) {
    console.log(`  ${colors.yellow}2. Add YAML metadata for completed packages:${colors.reset}`);
    for (const pkg of missingYAML) {
      console.log(`     • ${pkg.name}`);
    }
  }

  // Packages ready to start
  const readyToStart = results
    .filter(r => r.status === 'TODO')
    .sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const complexityOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return complexityOrder[a.complexity] - complexityOrder[b.complexity];
    })
    .slice(0, 3);

  console.log(`  ${colors.green}3. Ready to start documentation:${colors.reset}`);
  for (const pkg of readyToStart) {
    console.log(`     • ${pkg.name} (Priority: ${pkg.priority}, Complexity: ${pkg.complexity})`);
  }

  // Generate detailed report file
  const reportPath = path.join(__dirname, '..', 'JSDOC-VERIFICATION-REPORT.md');
  generateDetailedReport(results, reportPath);
  
  console.log(`\n${colors.bold}${colors.green}✓ Detailed report saved to: ${reportPath}${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function generateDetailedReport(results, outputPath) {
  let report = '# JSDoc Verification Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  report += '## Summary\n\n';
  report += '| Package | Priority | Complexity | Status | JSDoc Coverage | YAML Files |\n';
  report += '|---------|----------|------------|--------|---------------|------------|\n';
  
  for (const result of results) {
    const statusEmoji = 
      result.status === 'DONE' ? '✅' :
      result.status === 'IN_PROGRESS' ? '🔄' :
      '❌';
    
    report += `| ${result.name} | ${result.priority} | ${result.complexity} | ${statusEmoji} ${result.status} | ${result.dist.coverage}% | ${result.yaml.files} |\n`;
  }
  
  report += '\n## Detailed Analysis\n\n';
  
  for (const result of results) {
    report += `### ${result.name}\n\n`;
    report += `- **Status**: ${result.status}\n`;
    report += `- **Priority**: ${result.priority}\n`;
    report += `- **Complexity**: ${result.complexity}\n`;
    report += `- **JSDoc Coverage**: ${result.dist.coverage}% (${result.dist.withJSDoc}/${result.dist.files} files)\n`;
    report += `- **YAML Metadata**: ${result.yaml.files} files\n`;
    
    if (result.lastBuild) {
      report += `- **Last Build**: ${new Date(result.lastBuild).toISOString()}\n`;
    }
    
    // Show files needing JSDoc
    const filesNeedingJSDoc = result.dist.details.filter(d => !d.hasJSDoc);
    if (filesNeedingJSDoc.length > 0 && filesNeedingJSDoc.length <= 10) {
      report += '\n**Files needing JSDoc:**\n';
      for (const file of filesNeedingJSDoc) {
        report += `- ${file.file}\n`;
      }
    } else if (filesNeedingJSDoc.length > 10) {
      report += `\n**${filesNeedingJSDoc.length} files need JSDoc**\n`;
    }
    
    report += '\n---\n\n';
  }
  
  fs.writeFileSync(outputPath, report);
}

// Run the analysis
generateReport();