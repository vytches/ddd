#!/usr/bin/env node

/**
 * VytchesDDD - Package Configuration Sync
 * Automatically updates all configuration files based on config/packages.json
 *
 * Usage: node scripts/sync-packages.js
 * Run this after modifying config/packages.json
 */

const fs = require('fs');
const path = require('path');

// Load package configuration
const packagesConfig = JSON.parse(fs.readFileSync('config/packages.json', 'utf8'));
const { packages, bundleStrategies } = packagesConfig;

console.log('🔄 Syncing package configurations...');

// 1. Update tsconfig.base.json
function updateTsConfig() {
  console.log('⚙️ Updating tsconfig.base.json...');

  const tsconfigPath = 'tsconfig.base.json';
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

  // Reset paths
  tsconfig.compilerOptions.paths = {};

  // Add paths for each package
  Object.keys(packages).forEach(packageName => {
    const fullName = `@vytches-ddd/${packageName}`;
    tsconfig.compilerOptions.paths[fullName] = [`packages/${packageName}/src/index.ts`];
  });

  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
}

// 2. Update vitest.config.ts
function updateVitestConfig() {
  console.log('🧪 Updating vitest.config.ts...');

  const vitestConfigPath = 'vitest.config.ts';
  let content = fs.readFileSync(vitestConfigPath, 'utf8');

  // Generate alias section
  const aliases = Object.keys(packages)
    .map(packageName => {
      const fullName = `@vytches-ddd/${packageName}`;
      return `      '${fullName}': new URL('./packages/${packageName}/src/index.ts', import.meta.url).pathname,`;
    })
    .join('\n');

  // Replace alias section
  const aliasPattern = /(alias: {\s*\n)([\s\S]*?)(\s*},)/;
  const newAliasSection = `$1${aliases}\n$3`;

  content = content.replace(aliasPattern, newAliasSection);

  fs.writeFileSync(vitestConfigPath, content);
}

// 3. Update commitlint.config.js
function updateCommitlintConfig() {
  console.log('📝 Updating commitlint.config.js...');

  const commitlintPath = 'commitlint.config.js';
  let content = fs.readFileSync(commitlintPath, 'utf8');

  // Generate scope enum
  const scopes = [...Object.keys(packages), 'examples', 'deps', 'release', 'ci', 'docs'];

  const scopeArray = scopes.map(scope => `        '${scope}',`).join('\n');

  // Replace scope-enum section
  const scopePattern =
    /('scope-enum': \[\s*\n\s*2,\s*\n\s*'always',\s*\n\s*\[)([\s\S]*?)(\s*\],\s*\n\s*\],)/;
  const newScopeSection = `$1\n${scopeArray}\n$3`;

  content = content.replace(scopePattern, newScopeSection);

  fs.writeFileSync(commitlintPath, content);
}

// 4. Update .eslintrc.json
function updateEslintConfig() {
  console.log('🔍 Updating .eslintrc.json...');

  const eslintPath = '.eslintrc.json';
  const eslintConfig = JSON.parse(fs.readFileSync(eslintPath, 'utf8'));

  // Find the enforce-module-boundaries rule
  const rule = eslintConfig.overrides[0].rules['@nx/enforce-module-boundaries'][1];

  // Reset depConstraints
  rule.depConstraints = [];

  // Generate constraints for each package
  Object.entries(packages).forEach(([packageName, config]) => {
    const allowedTags = config.dependencies.map(dep => `scope:${dep}`);
    allowedTags.push(`scope:${packageName}`); // Can depend on itself

    // Special cases
    if (packageName === 'testing') {
      allowedTags.push('*'); // Testing can depend on everything
    }
    if (packageName === 'enterprise') {
      allowedTags.push('*'); // Enterprise bundle includes everything
    }

    rule.depConstraints.push({
      sourceTag: `scope:${packageName}`,
      onlyDependOnLibsWithTags: allowedTags,
    });
  });

  // Add examples constraint
  rule.depConstraints.push({
    sourceTag: 'scope:examples',
    onlyDependOnLibsWithTags: ['*'],
  });

  fs.writeFileSync(eslintPath, JSON.stringify(eslintConfig, null, 2));
}

// 5. Update README.md
function updateReadme() {
  console.log('📚 Updating README.md...');

  const readmePath = 'README.md';
  let content = fs.readFileSync(readmePath, 'utf8');

  // Generate package table rows
  const tableRows = Object.entries(packages)
    .filter(([_, config]) => config.type === 'lib' || config.type === 'bundle')
    .map(([packageName, config]) => {
      const fullName = `@vytches-ddd/${packageName}`;
      return `| [${fullName}](./packages/${packageName}) | ![npm](https://img.shields.io/npm/v/${fullName}) | ${config.description} |`;
    })
    .join('\n');

  // Replace package table
  const tablePattern =
    /(\| Package \| Version \| Description \|\n\|---------|---------|-------------\|\n)([\s\S]*?)(\n\n## 🚀)/;
  const newTableSection = `$1${tableRows}$3`;

  content = content.replace(tablePattern, newTableSection);

  // Update project structure
  const packagesList = Object.keys(packages)
    .filter(name => packages[name].type === 'lib' || packages[name].type === 'bundle')
    .map(
      name =>
        `│   ├── ${name}/            # ${packages[name].description.split(' ')[0]} ${packages[name].description.split(' ')[1] || ''}`
    )
    .join('\n');

  const structurePattern = /(```\nvytches-ddd\/\n├── packages\/\n)([\s\S]*?)(├── examples\/)/;
  const newStructureSection = `$1${packagesList}\n$3`;

  content = content.replace(structurePattern, newStructureSection);

  fs.writeFileSync(readmePath, content);
}

// 6. Update enterprise bundle
function updateEnterpriseBundle() {
  console.log('🏢 Updating enterprise bundle...');

  const enterprisePackagePath = 'packages/enterprise/package.json';
  const enterpriseIndexPath = 'packages/enterprise/src/index.ts';

  // Update package.json dependencies
  if (fs.existsSync(enterprisePackagePath)) {
    const enterprisePackage = JSON.parse(fs.readFileSync(enterprisePackagePath, 'utf8'));

    // Reset dependencies
    enterprisePackage.dependencies = {};

    // Add dependencies for packages that should be included in enterprise
    Object.entries(packages).forEach(([packageName, config]) => {
      if (config.includeInEnterprise && packageName !== 'enterprise') {
        enterprisePackage.dependencies[`@vytches-ddd/${packageName}`] = 'workspace:*';
      }
    });

    fs.writeFileSync(enterprisePackagePath, JSON.stringify(enterprisePackage, null, 2));
  }

  // Update index.ts exports
  if (fs.existsSync(enterpriseIndexPath)) {
    const exports = Object.entries(packages)
      .filter(([packageName, config]) => config.includeInEnterprise && packageName !== 'enterprise')
      .map(([packageName]) => `export * from '@vytches-ddd/${packageName}';`)
      .join('\n');

    const indexContent = `// VytchesDDD Enterprise Bundle - All components in one package
// This file is auto-generated by scripts/sync-packages.js

${exports}

// Enterprise-specific utilities
export * from './enterprise-config';
export * from './monitoring';
export * from './health-checks';
`;

    fs.writeFileSync(enterpriseIndexPath, indexContent);
  }
}

// 7. Generate nx commands for setup script
function generateNxCommands() {
  console.log('🔧 Generating Nx commands...');

  const commands = Object.entries(packages)
    .filter(([_, config]) => config.type === 'lib')
    .map(([packageName, config]) => {
      const fullName = `@vytches-ddd/${packageName}`;
      const libType = config.type === 'tool' ? 'node' : 'js';
      return `npx nx g @nx/${libType}:lib ${packageName} --directory=packages/${packageName} --bundler=vite --unitTestRunner=vitest --publishable --importPath=${fullName}`;
    });

  // Update setup-automation.sh
  const setupPath = 'setup-automation.sh';
  if (fs.existsSync(setupPath)) {
    let content = fs.readFileSync(setupPath, 'utf8');

    const commandsSection = commands.join('\n');
    const commandsPattern =
      /(# 4\. Generate library packages\necho "🏗️ Generating library packages\.\.\."\n)([\s\S]*?)(# 5\. Generate example applications)/;
    const newCommandsSection = `$1${commandsSection}\n\n$3`;

    content = content.replace(commandsPattern, newCommandsSection);

    fs.writeFileSync(setupPath, content);
  }
}

// Run all updates
function main() {
  try {
    updateTsConfig();
    updateVitestConfig();
    updateCommitlintConfig();
    updateEslintConfig();
    updateReadme();
    updateEnterpriseBundle();
    generateNxCommands();

    console.log('');
    console.log('✅ All configurations synced successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Run "pnpm install" to update dependencies');
    console.log('2. Run "pnpm build" to verify everything works');
    console.log('3. Review generated configurations');
    console.log('');
  } catch (error) {
    console.error('❌ Error syncing configurations:', error.message);
    process.exit(1);
  }
}

// Add package helper
function addPackage(name, description, dependencies = [], options = {}) {
  console.log(`📦 Adding package: ${name}`);

  packages[name] = {
    description,
    dependencies,
    scope: name,
    type: options.type || 'lib',
    includeInEnterprise: options.includeInEnterprise !== false,
    category: options.category || 'custom',
    ...options,
  };

  // Save updated config
  fs.writeFileSync('config/packages.json', JSON.stringify(packagesConfig, null, 2));

  // Sync all configurations
  main();

  console.log(`✅ Package ${name} added and all configurations updated!`);
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'add' && args[1]) {
    const [, name, description, depsString] = args;
    const dependencies = depsString ? depsString.split(',').map(s => s.trim()) : [];
    addPackage(name, description, dependencies);
  } else {
    main();
  }
}

module.exports = { addPackage, main };
