/** @type {import('prettier').Config} */
module.exports = {
  // Basic formatting
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  quoteProps: 'as-needed',
  tabWidth: 2,
  useTabs: false,
  // Line length and wrapping
  printWidth: 100,
  proseWrap: 'preserve',
  // Object and array formatting
  bracketSpacing: true,
  bracketSameLine: false,
  // Arrow functions
  arrowParens: 'avoid',
  // Endlines
  endOfLine: 'lf',
  // Embedded languages
  embeddedLanguageFormatting: 'auto',
  // HTML/JSX specific
  htmlWhitespaceSensitivity: 'css',
  insertPragma: false,
  requirePragma: false,
  // File patterns
  overrides: [
    {
      files: '*.json',
      options: {
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        proseWrap: 'always',
        printWidth: 80,
      },
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
  ],
};
