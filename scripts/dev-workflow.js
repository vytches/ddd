#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const packagesConfig = JSON.parse(fs.readFileSync('config/packages.json', 'utf8'));
const allPackages = Object.keys(packagesConfig.packages).filter(p => p !== 'enterprise');

const argv = yargs(hideBin(process.argv))
  .usage('Enterprise Library Development')
  .option('mode', {
    alias: 'm',
    choices: ['api', 'integration', 'consumer'],
    default: 'api',
    description: 'Development phase',
  })
  .option('analyze', {
    type: 'boolean',
    description: 'Analyze bundle sizes',
  })
  .option('docs', {
    type: 'boolean',
    description: 'Include documentation generation',
  })
  .example('pnpm dev', 'API development phase (TSC watch)')
  .example('pnpm dev --mode=integration', 'Integration testing (Vite build)')
  .example('pnpm dev --mode=consumer', 'Consumer testing (playground)')
  .example('pnpm dev core --analyze', 'Develop core with bundle analysis')
  .help().argv;

function getPackagesToWatch() {
  const positionalPackages = argv._.filter(arg => allPackages.includes(arg));
  return positionalPackages.length > 0 ? positionalPackages : allPackages;
}

// API Development Phase - focus on types and rapid iteration
function startApiDevelopment(packages) {
  console.log('🎯 API Development Phase');
  console.log('📦 Packages:', packages.join(', '));
  console.log('⚡ TSC watch for rapid iteration');
  console.log('');

  const processes = [];

  // Main TypeScript watch
  processes.push(
    spawn('tsc', ['--build', '--watch'], {
      stdio: 'inherit',
      shell: true,
    })
  );

  // Type checking for examples (consumer perspective)
  if (fs.existsSync('examples/playground')) {
    console.log('👀 Watching playground for consumer API testing');
    processes.push(
      spawn('tsc', ['--watch', '--noEmit'], {
        cwd: 'examples/playground',
        stdio: 'pipe', // Less verbose
        shell: true,
      })
    );
  }

  return processes;
}

// Integration Phase - focus on builds and bundle analysis
function startIntegrationDevelopment(packages) {
  console.log('🔗 Integration Development Phase');
  console.log('📦 Packages:', packages.join(', '));
  console.log('📊 Vite build with analysis');
  console.log('');

  const processes = [];

  // Vite build watch with analysis
  const viteArgs = [
    'run-many',
    '--target=build',
    `--projects=${packages.join(',')}`,
    '--watch',
    '--parallel',
  ];

  if (argv.analyze) {
    console.log('📈 Bundle analysis enabled');
    process.env.ANALYZE = 'true';
  }

  processes.push(
    spawn('nx', viteArgs, {
      stdio: 'inherit',
      shell: true,
    })
  );

  return processes;
}

// Consumer Phase - focus on real usage patterns
function startConsumerDevelopment(packages) {
  console.log('👥 Consumer Development Phase');
  console.log('📦 Packages:', packages.join(', '));
  console.log('🎮 Playground + examples + documentation');
  console.log('');

  const processes = [];

  // Library build watch
  processes.push(
    spawn('tsc', ['--build', '--watch'], {
      stdio: 'pipe',
      shell: true,
    })
  );

  // Playground dev server
  if (fs.existsSync('examples/playground')) {
    processes.push(
      spawn('pnpm', ['dev'], {
        cwd: 'examples/playground',
        stdio: 'inherit',
        shell: true,
      })
    );
  }

  // Documentation if requested
  if (argv.docs) {
    console.log('📚 Documentation watch enabled');
    // Add docs generation here
  }

  return processes;
}

// Bundle analysis helper
function analyzeBundles(packages) {
  console.log('📊 Analyzing bundle sizes...');

  packages.forEach(pkg => {
    const distPath = `packages/${pkg}/dist`;
    if (fs.existsSync(distPath)) {
      try {
        const stats = execSync(`du -sh ${distPath}`, { encoding: 'utf8' });
        console.log(`📦 ${pkg}: ${stats.trim().split('\t')[0]}`);
      } catch (error) {
        // Ignore errors
      }
    }
  });
}

// Check enterprise bundle dependencies
function checkEnterpriseDependencies() {
  const enterprisePath = 'packages/enterprise/package.json';
  if (fs.existsSync(enterprisePath)) {
    const enterprisePkg = JSON.parse(fs.readFileSync(enterprisePath, 'utf8'));
    const deps = Object.keys(enterprisePkg.dependencies || {});

    console.log('🏢 Enterprise bundle includes:');
    deps.forEach(dep => {
      if (dep.startsWith('@vytches-ddd/')) {
        console.log(`  ✅ ${dep}`);
      }
    });
  }
}

function main() {
  const packages = getPackagesToWatch();

  console.log('🏢 VytchesDDD Enterprise Library Development');
  console.log('');

  // Show enterprise context
  checkEnterpriseDependencies();
  console.log('');

  let processes = [];

  switch (argv.mode) {
    case 'api':
      processes = startApiDevelopment(packages);
      break;
    case 'integration':
      processes = startIntegrationDevelopment(packages);
      break;
    case 'consumer':
      processes = startConsumerDevelopment(packages);
      break;
  }

  // Bundle analysis
  if (argv.analyze) {
    // Initial analysis
    analyzeBundles(packages);

    // Re-analyze on changes (simplified)
    setInterval(() => {
      analyzeBundles(packages);
    }, 10000);
  }

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping development...');
    processes.forEach(proc => {
      try {
        proc.kill('SIGTERM');
      } catch (error) {
        // Process might already be dead
      }
    });
    setTimeout(() => process.exit(0), 1000);
  });

  console.log('\n💡 Enterprise Development Tips:');
  console.log('  🎯 API phase: Focus on types and DX');
  console.log('  🔗 Integration phase: Test builds and bundles');
  console.log('  👥 Consumer phase: Real usage patterns');
  console.log('\n💡 Press Ctrl+C to stop');
}

main();
