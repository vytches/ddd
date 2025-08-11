/**
 * Example validation engine with layer-specific rules
 */

import type {
  ExtractedExample,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ExampleValidationRules,
} from '../types';
import type { IExampleValidator } from '../interfaces';
import {
  DEFAULT_VALIDATION_RULES,
  COMPILATION_PATTERNS,
  BEST_PRACTICES,
  LINE_COUNTING_RULES,
} from './rules';

export class ExampleValidator implements IExampleValidator {
  private rules: ExampleValidationRules;

  constructor(customRules?: Partial<ExampleValidationRules>) {
    this.rules = {
      ...DEFAULT_VALIDATION_RULES,
      ...customRules,
    };
  }

  /**
   * Validate example against layer-specific rules
   */
  validateExample(example: ExtractedExample, rules?: ExampleValidationRules): ValidationResult {
    const validationRules = rules || this.rules;
    const layerRules = validationRules[example.layer];

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Line count validation
    const actualLineCount = this.countEffectiveLines(example.content);
    if (actualLineCount > layerRules.maxLines) {
      errors.push({
        type: 'max_lines_exceeded',
        message: `Example exceeds maximum ${layerRules.maxLines} lines (actual: ${actualLineCount})`,
        element: `${actualLineCount} lines`,
      });
    }

    // 2. Required elements validation
    const missingRequired = this.findMissingRequiredElements(example, layerRules.required);
    missingRequired.forEach(element => {
      errors.push({
        type: 'missing_required_element',
        message: `Missing required element: ${element}`,
        element,
      });
    });

    // 3. Forbidden elements validation
    const foundForbidden = this.findForbiddenElements(example, layerRules.forbidden);
    foundForbidden.forEach(({ element, line }) => {
      errors.push({
        type: 'forbidden_element_found',
        message: `Forbidden element found: ${element}`,
        element,
        line,
      });
    });

    // 4. Best practices validation
    const bestPracticeResults = this.validateBestPractices(example);
    warnings.push(...bestPracticeResults.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check TypeScript compilation (simplified check)
   */
  async validateCompilation(content: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Basic syntax checks
      const syntaxErrors = this.checkBasicSyntax(content);
      errors.push(...syntaxErrors);

      // Check for common TypeScript issues
      const typeErrors = this.checkTypeScriptPatterns(content);
      errors.push(...typeErrors);

      // Check forbidden patterns
      const forbiddenPatterns = this.checkForbiddenPatterns(content);
      warnings.push(...forbiddenPatterns);
    } catch (error) {
      errors.push({
        type: 'compilation_error',
        message: `Compilation check failed: ${error}`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate example follows DDD best practices
   */
  validateBestPractices(example: ExtractedExample): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const layerPractices = BEST_PRACTICES.dddPatterns[example.layer];

    if (layerPractices) {
      // Check for required patterns
      if (layerPractices.mustUse) {
        layerPractices.mustUse.forEach(pattern => {
          if (!example.content.includes(pattern)) {
            warnings.push({
              type: 'best_practice',
              message: `Consider using ${pattern} for ${example.layer} layer`,
            });
          }
        });
      }

      // Check for patterns to avoid
      if (layerPractices.shouldAvoid) {
        layerPractices.shouldAvoid.forEach(pattern => {
          if (example.content.includes(pattern)) {
            warnings.push({
              type: 'best_practice',
              message: `Consider avoiding ${pattern} in ${example.layer} layer`,
            });
          }
        });
      }
    }

    return {
      isValid: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Count effective lines (excluding comments, empty lines, etc.)
   */
  private countEffectiveLines(content: string): number {
    const lines = content.split('\n');
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip lines that don't count
      const shouldExclude = LINE_COUNTING_RULES.excludeFromCount.some(pattern =>
        pattern.test(trimmed)
      );

      if (!shouldExclude && trimmed.length > 0) {
        count++;
      }
    }

    return count;
  }

  /**
   * Find missing required elements
   */
  private findMissingRequiredElements(example: ExtractedExample, required: string[]): string[] {
    const missing: string[] = [];
    const content = example.content.toLowerCase();

    for (const element of required) {
      const elementCheck = element.toLowerCase();

      // Special checks for different element types
      switch (elementCheck) {
        case 'setup':
          if (!this.hasSetupPattern(example.content)) {
            missing.push(element);
          }
          break;
        case 'execution':
          if (!this.hasExecutionPattern(example.content)) {
            missing.push(element);
          }
          break;
        case 'return':
          if (!this.hasReturnPattern(example.content)) {
            missing.push(element);
          }
          break;
        case 'command/query':
          if (!content.includes('command') && !content.includes('query')) {
            missing.push(element);
          }
          break;
        case 'service_call':
          if (!this.hasServiceCallPattern(example.content)) {
            missing.push(element);
          }
          break;
        case 'result_handling':
          if (!this.hasResultHandlingPattern(example.content)) {
            missing.push(element);
          }
          break;
        case 'persistence':
          if (!this.hasPersistencePattern(example.content)) {
            missing.push(element);
          }
          break;
        case 'event_publishing':
          if (!this.hasEventPublishingPattern(example.content)) {
            missing.push(element);
          }
          break;
        default:
          if (!content.includes(elementCheck)) {
            missing.push(element);
          }
      }
    }

    return missing;
  }

  /**
   * Find forbidden elements in content
   */
  private findForbiddenElements(
    example: ExtractedExample,
    forbidden: string[]
  ): Array<{ element: string; line: number }> {
    const found: Array<{ element: string; line: number }> = [];
    const lines = example.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const lineLower = line.toLowerCase();

      for (const element of forbidden) {
        if (lineLower.includes(element.toLowerCase())) {
          found.push({
            element,
            line: i + 1,
          });
        }
      }
    }

    return found;
  }

  // Pattern detection helpers
  private hasSetupPattern(content: string): boolean {
    return /const\s+\w+\s*=|let\s+\w+\s*=|new\s+\w+/.test(content);
  }

  private hasExecutionPattern(content: string): boolean {
    return /\.\w+\(|\w+\(/.test(content);
  }

  private hasReturnPattern(content: string): boolean {
    return /return\s+|=>\s*\w+|Result</.test(content);
  }

  private hasServiceCallPattern(content: string): boolean {
    return /this\.\w+\.|await\s+\w+\.|\.execute\(|\.handle\(/.test(content);
  }

  private hasResultHandlingPattern(content: string): boolean {
    return /\.isSuccess\(\)|\.isFailure\(\)|if\s*\(|catch\s*\(|Result</.test(content);
  }

  private hasPersistencePattern(content: string): boolean {
    return /\.save\(|\.update\(|\.delete\(|Repository|\.persist\(/.test(content);
  }

  private hasEventPublishingPattern(content: string): boolean {
    return /\.publish\(|EventBus|addDomainEvent|emit\(/.test(content);
  }

  // Basic syntax validation
  private checkBasicSyntax(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for unmatched braces
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        type: 'compilation_error',
        message: 'Unmatched braces in code',
      });
    }

    // Check for unmatched parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push({
        type: 'compilation_error',
        message: 'Unmatched parentheses in code',
      });
    }

    return errors;
  }

  private checkTypeScriptPatterns(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for common TypeScript issues
    if (/:\s*any\b/.test(content)) {
      errors.push({
        type: 'compilation_error',
        message: 'Avoid using "any" type in examples',
      });
    }

    return errors;
  }

  private checkForbiddenPatterns(content: string): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    COMPILATION_PATTERNS.forbiddenPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        warnings.push({
          type: 'style_suggestion',
          message: `Consider avoiding pattern: ${pattern.source}`,
        });
      }
    });

    return warnings;
  }
}
