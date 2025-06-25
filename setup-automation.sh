#!/bin/bash

# VytchesDDD - Complete Project Setup Automation
# This script creates all necessary configuration files and structure

set -e

PROJECT_NAME="vytches-ddd"
GITHUB_USERNAME="PawelGozdz"

echo "🚀 Setting up VytchesDDD project structure..."

# Create all directories first
create_directories() {
  echo "📁 Creating directory structure..."

  mkdir -p .github/workflows
  mkdir -p .husky
  mkdir -p .vscode
  mkdir -p config
  mkdir -p scripts
  mkdir -p packages/{core,utils,validation,policies,events,cqrs,acl,projections,messaging,resilience,testing,enterprise,cli}
  mkdir -p examples/{simple,playground,ecommerce,banking}
  mkdir -p tools/{nx-plugins,build-scripts,release-scripts}
  mkdir -p docs/{api,guides,examples}

  # Create src directories for packages
  for pkg in core utils validation policies events cqrs acl projections messaging resilience testing enterprise cli; do
    mkdir -p "packages/$pkg/src"
    mkdir -p "packages/$pkg/src/__tests__"
  done

  # Create src directories for examples
  for example in simple playground ecommerce banking; do
    mkdir -p "examples/$example/src"
  done
}

# Create config files
create_config_files() {
  echo "⚙️ Creating config files..."

  # Create packages.json config
  cat > config/packages.json << 'EOF'
{
  "$schema": "./packages-schema.json",
  "packages": {
    "core": {
      "description": "Core DDD building blocks (Value Objects, Entities, Aggregates)",
      "dependencies": [],
      "scope": "core",
      "type": "lib",
      "includeInEnterprise": true,
      "category": "foundation"
    },
    "utils": {
      "description": "Common utilities and helpers",
      "dependencies": [],
      "scope": "utils",
      "type": "lib",
      "includeInEnterprise": true,
      "category": "foundation"
    },
    "validation": {
      "description": "Business rules, specifications, and validation patterns",
      "dependencies": ["core", "utils"],
      "scope": "validation",
      "type": "lib",
      "includeInEnterprise": true,
      "category": "patterns"
    },
    "policies": {
      "description": "Business policies and domain policies",
      "dependencies": ["core", "validation", "utils"],
      "scope": "policies",
      "type": "lib",
      "includeInEnterprise": true,
      "category": "patterns"
    },
    "events": {
      "description": "Event-driven architecture components",
      "dependencies": ["core", "utils"],
      "scope": "events",
      "type": "lib",
      "includeInEnterprise": true,
      "category": "architecture"
    },
    "cqrs": {
      "description": "Command Query Responsibility Segregation",
      "dependencies": ["core", "events", "validation", "utils"],
      "scope": "cqrs",
      "type": "lib",
      "includeInEnterprise": true,
      "category": "architecture"
    },
    "acl": {
      "description": "Anti-Corruption Layer for external systems",
      "dependencies": ["core", "events", "utils"],
      "scope": "acl",
      "type": "lib",
      "includeInEnterprise": true,
      "category": "integration"
    },
    "projections": {
      "description": "Event projections and read models",
      "dependencies": ["core", "events", "utils"],
      "scope": "projections",
      "type": "lib",
      "includeInEnterprise": true,
      "category": "architecture"
    },
    "messaging": {
      "description": "Outbox pattern, sagas, and messaging patterns",
      "dependencies": ["core", "events", "policies", "utils"],
      "scope": "messaging",
      "type": "lib",
      "includeInEnterprise": true,
      "category": "integration"
    },
    "resilience": {
      "description": "Circuit breakers, retry patterns, timeouts",
      "dependencies": ["core", "utils"],
      "scope": "resilience",
      "type": "lib",
      "includeInEnterprise": true,
      "category": "infrastructure"
    },
    "testing": {
      "description": "Test utilities for DDD patterns",
      "dependencies": ["core", "events", "cqrs", "validation", "utils"],
      "scope": "testing",
      "type": "lib",
      "includeInEnterprise": false,
      "category": "tooling",
      "peerDependencies": {
        "vitest": "^1.0.0"
      }
    },
    "enterprise": {
      "description": "All-in-one enterprise bundle",
      "dependencies": ["*"],
      "scope": "enterprise",
      "type": "bundle",
      "includeInEnterprise": false,
      "category": "bundle"
    },
    "cli": {
      "description": "Code generation and development tools",
      "dependencies": ["core", "utils"],
      "scope": "cli",
      "type": "tool",
      "includeInEnterprise": false,
      "category": "tooling"
    }
  },
  "bundleStrategies": {
    "core-bundle": ["core", "utils", "validation"],
    "advanced-bundle": ["core-bundle", "events", "cqrs", "projections"],
    "enterprise-bundle": ["advanced-bundle", "acl", "policies", "messaging", "resilience"]
  }
}
EOF

  # Create packages-schema.json
  cat > config/packages-schema.json << 'EOF'
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "VytchesDDD Package Configuration",
  "type": "object",
  "properties": {
    "packages": {
      "type": "object",
      "patternProperties": {
        "^[a-z-]+$": {
          "type": "object",
          "properties": {
            "description": { "type": "string" },
            "dependencies": { "type": "array", "items": { "type": "string" } },
            "scope": { "type": "string" },
            "type": { "enum": ["lib", "bundle", "tool"] },
            "includeInEnterprise": { "type": "boolean" },
            "category": { "enum": ["foundation", "patterns", "architecture", "integration", "infrastructure", "tooling", "bundle"] }
          },
          "required": ["description", "dependencies", "scope", "type"]
        }
      }
    }
  }
}
EOF
}

# Create package.json files for each package
create_package_configs() {
  echo "📦 Creating package configurations..."

  # Core package
  cat > packages/core/package.json << 'EOF'
{
  "name": "@vytches-ddd/core",
  "version": "0.1.0",
  "description": "Core DDD building blocks (Value Objects, Entities, Aggregates)",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "src", "README.md"],
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "type-check": "tsc --noEmit"
  },
  "nx": {
    "tags": ["scope:core", "type:lib"]
  }
}
EOF

  # Utils package
  cat > packages/utils/package.json << 'EOF'
{
  "name": "@vytches-ddd/utils",
  "version": "0.1.0",
  "description": "Common utilities and helpers",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "src", "README.md"],
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "type-check": "tsc --noEmit"
  },
  "nx": {
    "tags": ["scope:utils", "type:lib"]
  }
}
EOF

  # Create remaining packages with dependency configuration
  local packages=(
    "validation:core,utils"
    "policies:core,validation,utils"
    "events:core,utils"
    "cqrs:core,events,validation,utils"
    "acl:core,events,utils"
    "projections:core,events,utils"
    "messaging:core,events,policies,utils"
    "resilience:core,utils"
    "testing:core,events,cqrs,validation,utils"
    "enterprise:*"
    "cli:core,utils"
  )

  for package_info in "${packages[@]}"; do
    IFS=':' read -r package_name deps <<< "$package_info"

    # Convert dependencies to JSON format
    if [ "$deps" = "*" ]; then
      dependencies_json='}'
    else
      IFS=',' read -ra dep_array <<< "$deps"
      dependencies_json=""
      for dep in "${dep_array[@]}"; do
        dependencies_json="$dependencies_json    \"@vytches-ddd/$dep\": \"workspace:*\",\n"
      done
      dependencies_json="  \"dependencies\": {\n$dependencies_json  },"
    fi

    # Get description from config
    description=$(grep -A5 "\"$package_name\":" config/packages.json | grep description | cut -d'"' -f4)

    cat > "packages/$package_name/package.json" << EOF
{
  "name": "@vytches-ddd/$package_name",
  "version": "0.1.0",
  "description": "$description",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "src", "README.md"],
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "type-check": "tsc --noEmit"
  },
$(echo -e "$dependencies_json")
  "nx": {
    "tags": ["scope:$package_name", "type:lib"]
  }
}
EOF
  done
}

# Create basic TypeScript configurations for packages
create_package_tsconfigs() {
  echo "⚙️ Creating TypeScript configurations..."

  for pkg in core utils validation policies events cqrs acl projections messaging resilience testing enterprise cli; do
    cat > "packages/$pkg/tsconfig.json" << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"]
}
EOF
  done
}

# Create Vite configs for packages
create_vite_configs() {
  echo "⚡ Creating Vite configurations..."

  # Standard library packages
  for pkg in core utils validation policies events cqrs acl projections messaging resilience testing; do
    cat > "packages/$pkg/vite.config.ts" << 'EOF'
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VytchesDDD',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : format}`,
    },
    rollupOptions: {
      external: (id) => {
        return id.startsWith('@vytches-ddd/') && !id.includes('src/');
      },
      output: {
        globals: (id) => {
          if (id.startsWith('@vytches-ddd/')) {
            return id.replace('@vytches-ddd/', 'VytchesDDD').replace(/[^a-zA-Z0-9]/g, '');
          }
          return id;
        },
      },
    },
    sourcemap: true,
    target: 'ES2020',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ],
    },
  },
});
EOF
  done

  # Enterprise package (bundle config)
  cat > packages/enterprise/vite.config.ts << 'EOF'
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VytchesDDDEnterprise',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : format}`,
    },
    rollupOptions: {
      external: (id) => {
        return id.startsWith('@vytches-ddd/') && !id.includes('src/');
      },
      output: {
        globals: (id) => {
          if (id.startsWith('@vytches-ddd/')) {
            return id.replace('@vytches-ddd/', 'VytchesDDD').replace(/[^a-zA-Z0-9]/g, '');
          }
          return id;
        },
      },
    },
    sourcemap: true,
    target: 'ES2020',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ],
    },
  },
});
EOF

  # CLI package (tool config for executable)
  cat > packages/cli/vite.config.ts << 'EOF'
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        cli: resolve(__dirname, 'src/cli.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : format}`,
    },
    rollupOptions: {
      external: (id) => {
        return id.startsWith('@vytches-ddd/') && !id.includes('src/');
      },
      output: {
        banner: (chunk) => {
          if (chunk.name === 'cli') {
            return '#!/usr/bin/env node';
          }
          return '';
        },
      },
    },
    sourcemap: true,
    target: 'ES2020',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ],
    },
  },
});
EOF
}

# Create basic index files for packages
create_package_indexes() {
  echo "📄 Creating package entry points..."

  # Core package index (foundation)
  cat > packages/core/src/index.ts << 'EOF'
// Core Domain-Driven Design building blocks
export * from './value-objects';
export * from './entities';
export * from './aggregates';
export * from './repositories';
export * from './domain-services';
export * from './result';

// Placeholder exports - replace with actual implementations
export const coreVersion = '0.1.0';
EOF

  # Utils package index (foundation)
  cat > packages/utils/src/index.ts << 'EOF'
// Common utilities and helpers
export * from './common';
export * from './types';
export * from './decorators';
export * from './helpers';

// Placeholder exports - replace with actual implementations
export const utilsVersion = '0.1.0';
EOF

  # Create remaining package indexes
  local packages=(
    "validation:Business rules, specifications, and validation patterns"
    "policies:Business policies and domain policies"
    "events:Event-driven architecture components"
    "cqrs:Command Query Responsibility Segregation"
    "acl:Anti-Corruption Layer patterns"
    "projections:Event projections and read models"
    "messaging:Outbox pattern, sagas, and messaging patterns"
    "resilience:Circuit breakers, retry patterns, timeouts"
    "testing:Test utilities for DDD patterns"
    "cli:Code generation and development tools"
  )

  for package_info in "${packages[@]}"; do
    IFS=':' read -r package_name description <<< "$package_info"

    cat > "packages/$package_name/src/index.ts" << EOF
// $description

// Export your main components here
export * from './lib/$package_name';

// Placeholder export - replace with actual implementation
export const ${package_name}Version = '0.1.0';
EOF
  done

  # Enterprise package index (bundle)
  cat > packages/enterprise/src/index.ts << 'EOF'
// VytchesDDD Enterprise Bundle - All components in one package

// Foundation exports
export * from '@vytches-ddd/core';
export * from '@vytches-ddd/utils';

// Pattern exports
export * from '@vytches-ddd/validation';
export * from '@vytches-ddd/policies';

// Architecture exports
export * from '@vytches-ddd/events';
export * from '@vytches-ddd/cqrs';
export * from '@vytches-ddd/projections';

// Integration exports
export * from '@vytches-ddd/acl';
export * from '@vytches-ddd/messaging';

// Infrastructure exports
export * from '@vytches-ddd/resilience';

// Additional enterprise-specific utilities
export * from './enterprise-config';
export * from './monitoring';
export * from './health-checks';
EOF

  # CLI executable entry point
  cat > packages/cli/src/cli.ts << 'EOF'
#!/usr/bin/env node

// CLI entry point
import { CLI } from './cli-runner';

const cli = new CLI();
cli.run(process.argv).catch((error) => {
  console.error('CLI Error:', error);
  process.exit(1);
});
EOF
}

# Create sample test files
create_sample_tests() {
  echo "🧪 Creating sample test files..."

  for pkg in core utils validation policies events cqrs acl projections messaging resilience testing cli; do
    cat > "packages/$pkg/src/__tests__/$pkg.test.ts" << EOF
import { describe, it, expect } from 'vitest';

// Sample test - replace with actual $pkg implementation
describe('$pkg', () => {
  it('should work', () => {
    // TODO: Implement $pkg tests
    expect(true).toBe(true);
  });
});
EOF
  done

  # Enterprise bundle test
  cat > packages/enterprise/src/__tests__/enterprise.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';

// Sample test - replace with actual Enterprise configuration
describe('Enterprise Bundle', () => {
  it('should export all packages', () => {
    // TODO: Test that all packages are properly exported
    expect(true).toBe(true);
  });
});
EOF
}

# Create placeholder files for packages
create_placeholder_files() {
  echo "📄 Creating placeholder files..."

  for pkg in core utils validation policies events cqrs acl projections messaging resilience testing cli; do
    mkdir -p "packages/$pkg/src/lib"
    cat > "packages/$pkg/src/lib/$pkg.ts" << EOF
// $pkg implementation placeholder

export class ${pkg^}Service {
  static create(): ${pkg^}Service {
    return new ${pkg^}Service();
  }
}
EOF
  done

  # Enterprise specific files
  mkdir -p packages/enterprise/src
  cat > packages/enterprise/src/enterprise-config.ts << 'EOF'
// Enterprise configuration
export interface EnterpriseConfig {
  version: string;
  features: string[];
}

export const defaultEnterpriseConfig: EnterpriseConfig = {
  version: '0.1.0',
  features: ['all'],
};
EOF

  cat > packages/enterprise/src/monitoring.ts << 'EOF'
// Enterprise monitoring utilities
export interface MonitoringConfig {
  enabled: boolean;
  metrics: string[];
}

export class EnterpriseMonitoring {
  static create(config: MonitoringConfig): EnterpriseMonitoring {
    return new EnterpriseMonitoring();
  }
}
EOF

  cat > packages/enterprise/src/health-checks.ts << 'EOF'
// Enterprise health check utilities
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks: Record<string, boolean>;
}

export class EnterpriseHealthCheck {
  static async run(): Promise<HealthCheckResult> {
    return { status: 'healthy', checks: {} };
  }
}
EOF

  # CLI specific files
  mkdir -p packages/cli/src
  cat > packages/cli/src/cli-runner.ts << 'EOF'
// CLI runner implementation
export class CLI {
  async run(args: string[]): Promise<void> {
    console.log('VytchesDDD CLI');
    console.log('Args:', args.slice(2));
  }
}
EOF

  cat > packages/cli/src/generators.ts << 'EOF'
// Code generators
export class CodeGenerator {
  static generateValueObject(name: string): string {
    return `// Generated Value Object: ${name}`;
  }
}
EOF

  cat > packages/cli/src/templates.ts << 'EOF'
// Code templates
export const templates = {
  valueObject: `// Value Object Template`,
  entity: `// Entity Template`,
  aggregate: `// Aggregate Template`,
};
EOF

  cat > packages/cli/src/config.ts << 'EOF'
// CLI configuration
export interface CLIConfig {
  outputDir: string;
  templates: string[];
}

export const defaultCLIConfig: CLIConfig = {
  outputDir: './src',
  templates: [],
};
EOF
}

# Create example applications
create_examples() {
  echo "📱 Creating example applications..."

  # Simple example
  cat > examples/simple/package.json << 'EOF'
{
  "name": "@vytches-ddd/example-simple",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest"
  },
  "dependencies": {
    "@vytches-ddd/core": "workspace:*",
    "@vytches-ddd/utils": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.0.4",
    "typescript": "^5.2.2"
  }
}
EOF

  cat > examples/simple/src/index.ts << 'EOF'
/**
 * Simple VytchesDDD Example
 */

import { coreVersion } from '@vytches-ddd/core';
import { utilsVersion } from '@vytches-ddd/utils';

console.log('🎯 Simple VytchesDDD Example');
console.log('Core version:', coreVersion);
console.log('Utils version:', utilsVersion);
EOF

  cat > examples/simple/vite.config.ts << 'EOF'
/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
EOF

  cat > examples/simple/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "target": "ES2020",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

  # Playground example
  cat > examples/playground/package.json << 'EOF'
{
  "name": "@vytches-ddd/playground",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "test:watch": "vitest --watch"
  },
  "dependencies": {
    "@vytches-ddd/core": "workspace:*",
    "@vytches-ddd/events": "workspace:*",
    "@vytches-ddd/utils": "workspace:*",
    "@vytches-ddd/validation": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.0.4",
    "typescript": "^5.2.2"
  }
}
EOF

  cat > examples/playground/src/index.ts << 'EOF'
/**
 * VytchesDDD Playground
 *
 * Test your features here!
 */

import { coreVersion } from '@vytches-ddd/core';

console.log('🎮 VytchesDDD Playground Active!');
console.log('Core version:', coreVersion);

// Add your test code here
export const playground = {
  version: '0.1.0',
  active: true,
};
EOF

  cat > examples/playground/src/playground.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { playground } from './index';

describe('Playground Tests', () => {
  it('should be active', () => {
    expect(playground.active).toBe(true);
  });
});
EOF

  cat > examples/playground/vite.config.ts << 'EOF'
/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3001,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
EOF

  cat > examples/playground/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "target": "ES2020",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
}

# Copy provided scripts
copy_scripts() {
  echo "📋 Copying development scripts..."

  # The dev-workflow.js, sync-packages.js scripts should already exist
  # Make sure they're executable
  chmod +x scripts/dev-workflow.js
  chmod +x scripts/sync-packages.js
  chmod +x scripts/add-package.sh
  chmod +x scripts/create-playground.sh
  chmod +x scripts/dev-package.sh
}

# Main execution
main() {
  echo "🎯 Starting VytchesDDD project setup..."

  create_directories
  create_config_files
  create_package_configs
  create_package_tsconfigs
  create_vite_configs
  create_package_indexes
  create_sample_tests
  create_placeholder_files
  create_examples
  copy_scripts

  echo ""
  echo "✅ VytchesDDD project setup completed successfully!"
  echo ""
  echo "📋 Next steps:"
  echo "1. Run: pnpm install"
  echo "2. Run: node scripts/sync-packages.js"
  echo "3. Run: pnpm build"
  echo "4. Run: pnpm test"
  echo "5. Run: pnpm playground"
  echo ""
  echo "🔧 Development workflows:"
  echo "  pnpm dev                    # Smart development mode"
  echo "  pnpm dev:core               # Develop core package"
  echo "  pnpm playground             # Interactive playground"
  echo ""
  echo "Happy coding! 🚀"
}

# Run the setup if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
