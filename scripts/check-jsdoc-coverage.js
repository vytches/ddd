#!/usr/bin/env node

/**
 * Check JSDoc coverage across all packages
 * Analyzes .d.ts files for JSDoc documentation completeness
 */

const fs = require('fs');
const path = require('path');

// Native console colors (no external dependencies)
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

// Simple color functions
function red(text) {
  return `${colors.red}${text}${colors.reset}`;
}

function green(text) {
  return `${colors.green}${text}${colors.reset}`;
}

function yellow(text) {
  return `${colors.yellow}${text}${colors.reset}`;
}

function bold(text) {
  return `${colors.bold}${text}${colors.reset}`;
}

function redBold(text) {
  return `${colors.red}${colors.bold}${text}${colors.reset}`;
}

function greenBold(text) {
  return `${colors.green}${colors.bold}${text}${colors.reset}`;
}

function yellowBold(text) {
  return `${colors.yellow}${colors.bold}${text}${colors.reset}`;
}

const chalk = { red, green, yellow, bold };

// Configuration
const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const MIN_COVERAGE_THRESHOLD = 70;
const TARGET_COVERAGE_THRESHOLD = 80;

/**
 * Count JSDoc and declaration items in a TypeScript declaration file
 */
function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Count various declaration types
    const stats = {
      classes: 0,
      interfaces: 0,
      methods: 0,
      properties: 0,
      functions: 0,
      types: 0,
      enums: 0,
      jsdocBlocks: 0,
    };

    // Count JSDoc blocks
    const jsdocMatches = content.match(/\/\*\*[\s\S]*?\*\//g);
    stats.jsdocBlocks = jsdocMatches ? jsdocMatches.length : 0;

    // Count classes
    const classMatches = content.match(/^export\s+(?:declare\s+)?(?:abstract\s+)?class\s+\w+/gm);
    stats.classes = classMatches ? classMatches.length : 0;

    // Count interfaces
    const interfaceMatches = content.match(/^export\s+(?:declare\s+)?interface\s+\w+/gm);
    stats.interfaces = interfaceMatches ? interfaceMatches.length : 0;

    // Count methods (approximate - looks for method signatures)
    const methodMatches = content.match(
      /^\s{2,}(?:abstract\s+)?(?:static\s+)?(?:async\s+)?(?:protected\s+)?(?:private\s+)?(?:public\s+)?(?:readonly\s+)?(?:get\s+|set\s+)?(?:\[?\w+(?:\[[^\]]+\])?\]?)(?:<[^>]+>)?\s*\([^)]*\)\s*(?::\s*[^;{]+)?[;{]/gm
    );
    stats.methods = methodMatches ? methodMatches.length : 0;

    // Count properties
    const propertyMatches = content.match(
      /^\s{2,}(?:readonly\s+)?(?:static\s+)?(?:private\s+|protected\s+|public\s+)?(?:\[?\w+\]?|\w+)(?:\?)?\s*:\s*[^;(]+;/gm
    );
    stats.properties = propertyMatches ? propertyMatches.length : 0;

    // Count standalone functions
    const functionMatches = content.match(/^export\s+(?:declare\s+)?function\s+\w+/gm);
    stats.functions = functionMatches ? functionMatches.length : 0;

    // Count type aliases
    const typeMatches = content.match(/^export\s+type\s+\w+\s*=/gm);
    stats.types = typeMatches ? typeMatches.length : 0;

    // Count enums
    const enumMatches = content.match(/^export\s+(?:declare\s+)?enum\s+\w+/gm);
    stats.enums = enumMatches ? enumMatches.length : 0;

    // Calculate total items that should have JSDoc
    stats.totalItems =
      stats.classes +
      stats.interfaces +
      stats.methods +
      stats.properties +
      stats.functions +
      stats.types +
      stats.enums;

    return stats;
  } catch (error) {
    console.error(`Error analyzing file ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Recursively find all .d.ts files in a directory
 */
function findDeclarationFiles(dir) {
  const files = [];

  function walk(currentPath) {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  walk(dir);
  return files;
}

/**
 * Analyze a package for JSDoc coverage
 */
function analyzePackage(packagePath) {
  const packageName = path.basename(packagePath);
  const distPath = path.join(packagePath, 'dist');

  if (!fs.existsSync(distPath)) {
    return null;
  }

  const files = findDeclarationFiles(distPath);

  if (files.length === 0) {
    return null;
  }

  const packageStats = {
    name: packageName,
    files: files.length,
    totalItems: 0,
    jsdocBlocks: 0,
    classes: 0,
    interfaces: 0,
    methods: 0,
    properties: 0,
    functions: 0,
    types: 0,
    enums: 0,
  };

  for (const file of files) {
    const fileStats = analyzeFile(file);
    if (fileStats) {
      packageStats.totalItems += fileStats.totalItems;
      packageStats.jsdocBlocks += fileStats.jsdocBlocks;
      packageStats.classes += fileStats.classes;
      packageStats.interfaces += fileStats.interfaces;
      packageStats.methods += fileStats.methods;
      packageStats.properties += fileStats.properties;
      packageStats.functions += fileStats.functions;
      packageStats.types += fileStats.types;
      packageStats.enums += fileStats.enums;
    }
  }

  packageStats.coverage =
    packageStats.totalItems > 0 ? (packageStats.jsdocBlocks / packageStats.totalItems) * 100 : 100;

  packageStats.missingDocs = packageStats.totalItems - packageStats.jsdocBlocks;

  return packageStats;
}

/**
 * Format coverage percentage with color
 */
function formatCoverage(coverage) {
  const rounded = coverage.toFixed(1);

  if (coverage >= TARGET_COVERAGE_THRESHOLD) {
    return chalk.green(`${rounded}%`);
  } else if (coverage >= MIN_COVERAGE_THRESHOLD) {
    return chalk.yellow(`${rounded}%`);
  } else {
    return chalk.red(`${rounded}%`);
  }
}

/**
 * Format status icon based on coverage
 */
function getStatusIcon(coverage) {
  if (coverage >= TARGET_COVERAGE_THRESHOLD) {
    return chalk.green('✅');
  } else if (coverage >= MIN_COVERAGE_THRESHOLD) {
    return chalk.yellow('⚠️');
  } else {
    return chalk.red('❌');
  }
}

/**
 * Main execution
 */
function main() {
  console.log(chalk.bold('\n📊 JSDoc Coverage Analysis\n'));
  console.log('='.repeat(80));

  // Get all packages
  const packages = fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => path.join(PACKAGES_DIR, dirent.name));

  const results = [];
  let totalItems = 0;
  let totalJsdoc = 0;

  // Analyze each package
  for (const packagePath of packages) {
    const stats = analyzePackage(packagePath);
    if (stats) {
      results.push(stats);
      totalItems += stats.totalItems;
      totalJsdoc += stats.jsdocBlocks;
    }
  }

  // Sort by coverage (ascending to show worst first)
  results.sort((a, b) => a.coverage - b.coverage);

  // Print detailed results
  console.log(chalk.bold('Package Coverage:\n'));

  for (const result of results) {
    const icon = getStatusIcon(result.coverage);
    const coverage = formatCoverage(result.coverage);
    const ratio = `${result.jsdocBlocks}/${result.totalItems}`;

    console.log(`${icon} ${result.name.padEnd(20)} ${ratio.padStart(12)} (${coverage})`);
  }

  // Calculate overall coverage
  const overallCoverage = totalItems > 0 ? (totalJsdoc / totalItems) * 100 : 0;

  console.log('\n' + '='.repeat(80));
  console.log(chalk.bold('\nOverall Summary:\n'));
  console.log(`Total packages:      ${results.length}`);
  console.log(`Total items:         ${totalItems}`);
  console.log(`Documented items:    ${totalJsdoc}`);
  console.log(`Missing docs:        ${chalk.red(totalItems - totalJsdoc)}`);
  console.log(`Overall coverage:    ${formatCoverage(overallCoverage)}`);

  // Status message
  console.log('\n' + '='.repeat(80));
  if (overallCoverage >= TARGET_COVERAGE_THRESHOLD) {
    console.log(
      greenBold(`\n✅ SUCCESS - Target coverage of ${TARGET_COVERAGE_THRESHOLD}% achieved!\n`)
    );
  } else if (overallCoverage >= MIN_COVERAGE_THRESHOLD) {
    console.log(
      yellowBold(
        `\n⚠️ WARNING - Coverage is ${overallCoverage.toFixed(1)}%, target is ${TARGET_COVERAGE_THRESHOLD}%\n`
      )
    );
  } else {
    console.log(redBold(`\n❌ CRITICAL - Coverage is only ${overallCoverage.toFixed(1)}%\n`));
  }

  // Show packages needing attention
  const needsWork = results.filter(r => r.coverage < MIN_COVERAGE_THRESHOLD);
  if (needsWork.length > 0) {
    console.log(chalk.bold('\nPackages needing attention:\n'));
    for (const pkg of needsWork) {
      console.log(
        `  ${chalk.red('❌')} ${pkg.name}: ${pkg.missingDocs} items missing JSDoc (${pkg.coverage.toFixed(1)}%)`
      );
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Exit with error code if coverage is below threshold
  if (overallCoverage < MIN_COVERAGE_THRESHOLD) {
    process.exit(1);
  }
}

// Run the analysis
main();
