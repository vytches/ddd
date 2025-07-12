/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],
    // Konfiguracja dla przypadku gdy nie ma testów
    passWithNoTests: true,
    // Ignoruj puste pliki testowe
    silent: false,
    // Nie kończy się błędem gdy nie ma testów
    // run: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Ignoruj pliki bez testów
      skipFull: true,
      exclude: [
        'coverage/**',
        'dist/**',
        'packages/*/dist/**',
        'examples/**', // Dodane: ignoruj examples w coverage
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}',
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Wyłącz thresholds dla pakietów bez testów
        perFile: false,
      },
    },
    reporters: process.env.CI ? ['default'] : ['verbose'],
    // Usuń vitest-sonar-reporter jeśli powoduje problemy
    // outputFile: {
    //   'vitest-sonar-reporter': 'test-report.xml',
    // },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    // Zakończ testy nawet jeśli niektóre pakiety nie mają testów
    bail: 0,
    deps: {
      moduleDirectories: ['node_modules', 'packages'],
      // Avoid problematic root package.json directory resolution
      external: [/^\/package\.json/],
    },
    alias: {
      '@vytches-ddd/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/domain-primitives': new URL(
        './packages/domain-primitives/src/index.ts',
        import.meta.url
      ).pathname,
      '@vytches-ddd/value-objects': new URL(
        './packages/value-objects/src/index.ts',
        import.meta.url
      ).pathname,
      '@vytches-ddd/repositories': new URL('./packages/repositories/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/aggregates': new URL('./packages/aggregates/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/utils': new URL('./packages/utils/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/validation': new URL('./packages/validation/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/policies': new URL('./packages/policies/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/events': new URL('./packages/events/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/cqrs': new URL('./packages/cqrs/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/acl': new URL('./packages/acl/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/projections': new URL('./packages/projections/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/messaging': new URL('./packages/messaging/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/resilience': new URL('./packages/resilience/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/testing': new URL('./packages/testing/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/enterprise': new URL('./packages/enterprise/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/cli': new URL('./packages/cli/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/contracts': new URL('./packages/contracts/src/index.ts', import.meta.url)
        .pathname,
      '@vytches-ddd/domain-services': new URL(
        './packages/domain-services/src/index.ts',
        import.meta.url
      ).pathname,
      '@vytches-ddd/logging': new URL('./packages/logging/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/di': new URL('./packages/di/src/index.ts', import.meta.url).pathname,
      '@vytches-ddd/event-store': new URL('./packages/event-store/src/index.ts', import.meta.url)
        .pathname,
    },
  },
});
