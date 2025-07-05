/**
 * ESLint Plugin: Quality Gates
 *
 * Custom ESLint rules for enforcing quality gates and preventing regressions.
 * Specifically designed for the VytchesDDD project.
 */

const fs = require('fs');
const path = require('path');

// Load baseline for any type tracking
function loadAnyTypeBaseline() {
  const baselinePath = path.join(process.cwd(), '.quality-gates', 'any-types-baseline.json');

  try {
    if (fs.existsSync(baselinePath)) {
      return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    }
  } catch (error) {
    // Silently fail - baseline may not exist yet
  }

  return null;
}

// Patterns that justify `any` usage
const JUSTIFIED_ANY_PATTERNS = [
  // Decorator patterns
  /target:\s*any/,
  /propertyKey:\s*any/,
  /descriptor:\s*any/,
  /@.*\(\s*target:\s*any/,

  // Event/Constructor patterns
  /constructor\(\.\.\.\s*args:\s*any\[\]/,
  /new\s*\(\.\.\.\s*args:\s*any\[\]/,

  // Type utilities
  /Record<.*,\s*any>/,
  /\[\s*key:\s*string\s*\]:\s*any/,

  // Infrastructure interfaces
  /interface.*\{[\s\S]*\[.*\]:\s*any/,

  // Generic constraints
  /<.*extends.*any.*>/,
];

// Check if any usage is justified
function isJustifiedAnyUsage(context, node) {
  const sourceCode = context.getSourceCode();
  const line = sourceCode.getText(node);

  // Check against justified patterns
  for (const pattern of JUSTIFIED_ANY_PATTERNS) {
    if (pattern.test(line)) {
      return true;
    }
  }

  // Check file path for infrastructure patterns
  const filename = context.getFilename();
  const infrastructurePatterns = [
    /decorators/,
    /infrastructure/,
    /adapters/,
    /types/,
    /interfaces/,
  ];

  for (const pattern of infrastructurePatterns) {
    if (pattern.test(filename)) {
      return true;
    }
  }

  return false;
}

const rules = {
  'no-any-regression': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Prevent regression in `any` type usage based on baseline',
        category: 'Quality Gates',
        recommended: true,
      },
      fixable: null,
      schema: [
        {
          type: 'object',
          properties: {
            allowInfrastructure: {
              type: 'boolean',
              default: true,
            },
            baselinePath: {
              type: 'string',
              default: '.quality-gates/any-types-baseline.json',
            },
            maxIncrease: {
              type: 'number',
              default: 0,
            },
          },
          additionalProperties: false,
        },
      ],
      messages: {
        anyRegression:
          'New `any` type usage detected. This violates the quality gate for preventing any type regression.',
        unjustifiedAny:
          'Unjustified `any` type usage. Consider using a more specific type or add to infrastructure patterns if this is a valid use case.',
        documentJustification:
          'If this `any` usage is justified (decorators, event constructors, etc.), please document why in a comment.',
      },
    },

    create(context) {
      const options = context.options[0] || {};
      const allowInfrastructure = options.allowInfrastructure !== false;
      const maxIncrease = options.maxIncrease || 0;

      // Track any types found in current file
      let currentFileAnyCount = 0;

      return {
        TSAnyKeyword(node) {
          currentFileAnyCount++;

          // Check if this any usage is justified
          if (allowInfrastructure && isJustifiedAnyUsage(context, node)) {
            return; // Allow justified any usage
          }

          // Get package name from file path
          const filename = context.getFilename();
          const packageMatch = filename.match(/packages\/([^\/]+)/);
          const packageName = packageMatch ? packageMatch[1] : 'unknown';

          // Load baseline and check regression
          const baseline = loadAnyTypeBaseline();
          if (baseline && baseline.packages && baseline.packages[packageName]) {
            const baselineCount = baseline.packages[packageName].totalAnyTypes || 0;

            // For now, report any unjustified usage
            context.report({
              node,
              messageId: 'unjustifiedAny',
              data: {
                packageName,
                baselineCount,
              },
            });
          } else {
            // No baseline exists, but still warn about unjustified usage
            context.report({
              node,
              messageId: 'documentJustification',
            });
          }
        },

        'Program:exit'(node) {
          // Could implement file-level checks here if needed
          // For example, checking total any count vs baseline
        },
      };
    },
  },

  'prefer-unknown-over-any': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Prefer `unknown` over `any` for better type safety',
        category: 'Quality Gates',
        recommended: true,
      },
      fixable: 'code',
      schema: [
        {
          type: 'object',
          properties: {
            ignoreInfrastructure: {
              type: 'boolean',
              default: true,
            },
          },
          additionalProperties: false,
        },
      ],
      messages: {
        preferUnknown:
          'Prefer `unknown` over `any` for better type safety. Use `any` only when absolutely necessary.',
      },
    },

    create(context) {
      const options = context.options[0] || {};
      const ignoreInfrastructure = options.ignoreInfrastructure !== false;

      return {
        TSAnyKeyword(node) {
          // Skip if this is justified infrastructure usage
          if (ignoreInfrastructure && isJustifiedAnyUsage(context, node)) {
            return;
          }

          // Check if this could be `unknown` instead
          const parent = node.parent;
          const sourceCode = context.getSourceCode();

          // Don't suggest unknown for certain patterns
          const text = sourceCode.getText(parent);
          if (
            text.includes('Record<') ||
            text.includes('extends any') ||
            text.includes('...args: any[]')
          ) {
            return;
          }

          context.report({
            node,
            messageId: 'preferUnknown',
            fix(fixer) {
              // Only auto-fix simple cases
              if (parent.type === 'TSTypeAnnotation' || parent.type === 'TSTypeReference') {
                return fixer.replaceText(node, 'unknown');
              }
              return null;
            },
          });
        },
      };
    },
  },

  'require-explicit-return-types': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Require explicit return types for better type safety',
        category: 'Quality Gates',
        recommended: true,
      },
      fixable: null,
      schema: [
        {
          type: 'object',
          properties: {
            allowExpressions: {
              type: 'boolean',
              default: false,
            },
            allowTypedFunctionExpressions: {
              type: 'boolean',
              default: true,
            },
          },
          additionalProperties: false,
        },
      ],
      messages: {
        missingReturnType: 'Function is missing explicit return type annotation.',
      },
    },

    create(context) {
      const options = context.options[0] || {};

      function checkFunction(node) {
        if (node.returnType) {
          return; // Already has return type
        }

        // Skip certain cases
        if (node.type === 'ArrowFunctionExpression' && options.allowExpressions) {
          return;
        }

        // Skip typed function expressions if allowed
        if (
          options.allowTypedFunctionExpressions &&
          node.parent &&
          node.parent.type === 'VariableDeclarator' &&
          node.parent.id &&
          node.parent.id.typeAnnotation
        ) {
          return;
        }

        context.report({
          node,
          messageId: 'missingReturnType',
        });
      }

      return {
        FunctionDeclaration: checkFunction,
        FunctionExpression: checkFunction,
        ArrowFunctionExpression: checkFunction,
        MethodDefinition: checkFunction,
      };
    },
  },
};

module.exports = {
  rules,
  configs: {
    recommended: {
      plugins: ['quality-gates'],
      rules: {
        'quality-gates/no-any-regression': 'error',
        'quality-gates/prefer-unknown-over-any': 'warn',
        'quality-gates/require-explicit-return-types': 'warn',
      },
    },
    strict: {
      plugins: ['quality-gates'],
      rules: {
        'quality-gates/no-any-regression': 'error',
        'quality-gates/prefer-unknown-over-any': 'error',
        'quality-gates/require-explicit-return-types': 'error',
      },
    },
  },
};
