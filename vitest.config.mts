/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // F-C3 (VB-002): loads the reflect-metadata polyfill once for every test
    // file — see vitest.setup.ts for the full rationale.
    setupFiles: ['./vitest.setup.ts'],
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
    logLevel: process.env.CI ? 'error' : 'info',
    // Usuń vitest-sonar-reporter jeśli powoduje problemy
    // outputFile: {
    //   'vitest-sonar-reporter': 'test-report.xml',
    // },
    pool: 'threads',
    // F-H15 (VB-002): `test.poolOptions.threads.{singleThread,isolate}` was
    // removed in Vitest 4.1 — pool sub-options are now top-level. Both
    // values here were already Vitest's defaults (isolate: true, threads
    // run in parallel), so this block is dropped rather than migrated
    // 1:1 — `isolate` below is kept explicit for clarity, not because the
    // default changed.
    isolate: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    // Zakończ testy nawet jeśli niektóre pakiety nie mają testów
    bail: 0,
    deps: {
      moduleDirectories: ['node_modules', 'packages'],
    },
    server: {
      deps: {
        // Avoid problematic root package.json directory resolution
        external: ['/package.json'],
      },
    },
    // Suppress module resolution warnings in CI
    onConsoleLog(log, type) {
      if (process.env.CI && type === 'stderr' && log.includes('EISDIR')) {
        return false; // Don't print EISDIR errors in CI
      }
    },
    // VF-024 (AC4): array form (not object) — rollup/alias's string `find`
    // does *prefix* matching (matches `X` or `X/...`), so the array is
    // checked in order and first match wins. The `/internal` subpath
    // aliases MUST be listed before their base-package alias, otherwise the
    // base-package entry (e.g. `@vytches/ddd-contracts`) prefix-matches
    // `@vytches/ddd-contracts/internal` first, aliases it to the wrong
    // target, and resolution falls through to real node_modules lookup —
    // which fails under vite-node's SSR external import (ERR_MODULE_NOT_FOUND)
    // because the workspace root's node_modules/@vytches only contains
    // ddd-testing.
    alias: [
      {
        find: '@vytches/ddd-contracts/internal',
        replacement: new URL('./packages/contracts/src/internal.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-events/internal',
        replacement: new URL('./packages/events/src/internal.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-core',
        replacement: new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-domain-primitives',
        replacement: new URL('./packages/domain-primitives/src/index.ts', import.meta.url)
          .pathname,
      },
      {
        find: '@vytches/ddd-value-objects',
        replacement: new URL('./packages/value-objects/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-repositories',
        replacement: new URL('./packages/repositories/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-aggregates',
        replacement: new URL('./packages/aggregates/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-utils',
        replacement: new URL('./packages/utils/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-validation',
        replacement: new URL('./packages/validation/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-policies',
        replacement: new URL('./packages/policies/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-events',
        replacement: new URL('./packages/events/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-cqrs',
        replacement: new URL('./packages/cqrs/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-acl',
        replacement: new URL('./packages/acl/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-projections',
        replacement: new URL('./packages/projections/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-messaging',
        replacement: new URL('./packages/messaging/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-resilience',
        replacement: new URL('./packages/resilience/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-testing',
        replacement: new URL('./packages/testing/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-enterprise',
        replacement: new URL('./packages/enterprise/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-cli',
        replacement: new URL('./packages/cli/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-contracts',
        replacement: new URL('./packages/contracts/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-domain-services',
        replacement: new URL('./packages/domain-services/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-logging',
        replacement: new URL('./packages/logging/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-di',
        replacement: new URL('./packages/di/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-event-store',
        replacement: new URL('./packages/event-store/src/index.ts', import.meta.url).pathname,
      },
      {
        find: '@vytches/ddd-process-managers',
        replacement: new URL('./packages/process-managers/src/index.ts', import.meta.url)
          .pathname,
      },
    ],
  },
});
