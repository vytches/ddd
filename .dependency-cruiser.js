/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are not allowed',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-core-to-repositories',
      severity: 'error',
      comment: 'Core package cannot depend on repositories',
      from: {
        path: '^packages/core',
      },
      to: {
        path: '^packages/repositories',
      },
    },
    {
      name: 'no-core-to-process-managers',
      severity: 'error',
      comment: 'Core package cannot depend on process-managers',
      from: {
        path: '^packages/core',
      },
      to: {
        path: '^packages/process-managers',
      },
    },
    {
      name: 'no-testing-to-core',
      severity: 'error',
      comment: 'Testing package cannot depend on core meta-package',
      from: {
        path: '^packages/testing',
      },
      to: {
        path: '^packages/core',
      },
    },
    {
      name: 'no-testing-to-repositories',
      severity: 'error',
      comment: 'Testing package cannot depend on repositories',
      from: {
        path: '^packages/testing',
      },
      to: {
        path: '^packages/repositories',
      },
    },
    {
      name: 'no-testing-to-aggregates',
      severity: 'error',
      comment: 'Testing package cannot depend on aggregates',
      from: {
        path: '^packages/testing',
      },
      to: {
        path: '^packages/aggregates',
      },
    },
    {
      name: 'no-testing-to-events',
      severity: 'error',
      comment: 'Testing package cannot depend on events',
      from: {
        path: '^packages/testing',
      },
      to: {
        path: '^packages/events',
      },
    },
    {
      name: 'no-logging-to-testing',
      severity: 'error',
      comment: 'Logging package cannot depend on testing',
      from: {
        path: '^packages/logging',
      },
      to: {
        path: '^packages/testing',
      },
    },
    {
      name: 'no-contracts-upward',
      severity: 'error',
      comment: 'Contracts package can only depend on utils',
      from: {
        path: '^packages/contracts',
      },
      to: {
        path: '^packages/(?!utils|contracts)',
        dependencyTypes: ['local'],
      },
    },
    {
      name: 'no-domain-primitives-upward',
      severity: 'error',
      comment: 'Domain primitives can only depend on utils',
      from: {
        path: '^packages/domain-primitives',
      },
      to: {
        path: '^packages/(?!utils|domain-primitives)',
        dependencyTypes: ['local'],
      },
    },
    {
      name: 'no-utils-dependencies',
      severity: 'error',
      comment: 'Utils package should have no internal dependencies except contracts',
      from: {
        path: '^packages/utils',
      },
      to: {
        path: '^packages/(?!utils|contracts)',
        dependencyTypes: ['local'],
      },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'All files should be reachable from the index',
      from: {
        orphan: true,
        pathNot: [
          '\\.(test|spec)\\.[jt]sx?$',
          '\\.d\\.ts$',
          'tests?/',
          '__tests__/',
          '__mocks__/',
          'scripts/',
          'templates/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: [
        'node_modules',
        '\\.test\\.[jt]sx?$',
        '\\.spec\\.[jt]sx?$',
        '__tests__',
        '__mocks__',
        'dist',
        'coverage',
        '\\.d\\.ts$',
      ],
    },
    includeOnly: ['^packages/'],
    exclude: ['node_modules', 'dist', 'coverage', '\\.test\\.[jt]sx?$', '\\.spec\\.[jt]sx?$'],
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.base.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)',
        theme: {
          graph: {
            splines: 'ortho',
          },
          modules: [
            {
              criteria: { source: '^packages/contracts' },
              attributes: { fillcolor: '#ffcccc' },
            },
            {
              criteria: { source: '^packages/domain-primitives' },
              attributes: { fillcolor: '#ccffcc' },
            },
            {
              criteria: { source: '^packages/core' },
              attributes: { fillcolor: '#ccccff' },
            },
            {
              criteria: { source: '^packages/testing' },
              attributes: { fillcolor: '#ffffcc' },
            },
          ],
          dependencies: [
            {
              criteria: { resolved: '^packages/contracts' },
              attributes: { color: '#ff0000' },
            },
            {
              criteria: { resolved: '^packages/domain-primitives' },
              attributes: { color: '#00ff00' },
            },
            {
              criteria: { resolved: '^packages/core' },
              attributes: { color: '#0000ff' },
            },
          ],
        },
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
