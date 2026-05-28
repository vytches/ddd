export interface MaskingOptions {
  enabled: boolean;
  /**
   * User-supplied regex patterns compiled via `new RegExp(pattern, 'g')` at construction time.
   *
   * **Replace-vs-merge semantics:**
   * - Empty array (default) — the four built-in PII patterns (email, SSN, credit card, phone)
   *   are active. No user patterns are added.
   * - Non-empty array — the built-in patterns are **replaced entirely** by the patterns you
   *   supply. To extend rather than replace, copy the defaults and append your own patterns.
   *
   * @remarks
   * **ReDoS warning.** Patterns are compiled as-is without heuristic analysis. Avoid patterns
   * with catastrophic backtracking potential, such as:
   * - `(a+)+` — nested quantifiers
   * - `(.*)*` — nested star
   * - `(a|aa)+` — overlapping alternation
   *
   * These patterns cause exponential backtracking on adversarial input. Because `DataMasker`
   * sits on the hot path of every log event, a single hanging pattern blocks the Node.js
   * event loop and makes the entire process unresponsive.
   *
   * For patterns sourced dynamically (env vars, remote config, user input) validate them
   * externally with `safe-regex` or compile via the `re2` engine before passing them here.
   *
   * Patterns exceeding 2000 characters are rejected with `RangeError` at construction time.
   *
   * @see {@link https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS OWASP ReDoS}
   */
  patterns: string[];
  replacement: string;
  sensitiveKeys: string[];
  /** Maximum recursion depth when traversing nested objects. Default: 10. */
  maxDepth: number;
  /** Strings longer than this are replaced with '[TRUNCATED:string]'. Default: 1000. */
  maxStringLength: number;
}

export class DataMasker {
  private static readonly DEFAULT_SENSITIVE_KEYS: string[] = [];
  private static readonly DEFAULT_MAX_DEPTH = 10;
  private static readonly DEFAULT_MAX_STRING_LENGTH = 1000;
  private static readonly MAX_PATTERN_LENGTH = 2000;

  private static readonly DEFAULT_PATTERNS = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // Email
    /\b\d{3}-?\d{2}-?\d{4}\b/g, // SSN
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
    /\b\d{3}-?\d{3}-?\d{4}\b/g, // Phone number
  ];

  private readonly options: MaskingOptions;
  private readonly compiledPatterns: RegExp[];

  constructor(options: Partial<MaskingOptions> = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      patterns: options.patterns ?? [],
      replacement: options.replacement ?? '[MASKED]',
      sensitiveKeys: options.sensitiveKeys ?? DataMasker.DEFAULT_SENSITIVE_KEYS,
      maxDepth: options.maxDepth ?? DataMasker.DEFAULT_MAX_DEPTH,
      maxStringLength: options.maxStringLength ?? DataMasker.DEFAULT_MAX_STRING_LENGTH,
    };

    // Default regex patterns always apply unless caller provides explicit pattern overrides.
    // sensitiveKeys are additive — they extend, not replace, default patterns.
    const defaultPatterns =
      this.options.patterns.length === 0 ? DataMasker.DEFAULT_PATTERNS : [];

    this.compiledPatterns = [
      ...defaultPatterns,
      ...this.options.patterns.map((pattern, index) => DataMasker.compilePattern(pattern, index)),
    ];
  }

  private static compilePattern(pattern: string, index: number): RegExp {
    if (pattern.length > DataMasker.MAX_PATTERN_LENGTH) {
      throw new RangeError(
        `DataMasker: pattern at index ${index} exceeds max length of ${DataMasker.MAX_PATTERN_LENGTH} characters (actual length: ${pattern.length})`,
      );
    }

    try {
      return new RegExp(pattern, 'g');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const excerpt = pattern.length > 100 ? `${pattern.slice(0, 100)}...` : pattern;
      throw new RangeError(
        `DataMasker: invalid regex pattern at index ${index}: "${excerpt}" (${reason})`,
      );
    }
  }

  maskData(data: unknown): unknown {
    if (!this.options.enabled) {
      return data;
    }

    const visitedObjects = new WeakSet();
    return this.maskRecursive(data, visitedObjects, 0);
  }

  private maskRecursive(value: unknown, visitedObjects: WeakSet<object>, depth: number): unknown {
    if (depth > this.options.maxDepth) {
      return '[TRUNCATED]';
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.maskString(value);
    }

    if (Array.isArray(value)) {
      if (visitedObjects.has(value)) {
        return '[Circular Reference]';
      }
      visitedObjects.add(value);

      const result = value.map(item => this.maskRecursive(item, visitedObjects, depth + 1));
      visitedObjects.delete(value);
      return result;
    }

    if (typeof value === 'object' && value !== null) {
      if (visitedObjects.has(value)) {
        return '[Circular Reference]';
      }
      visitedObjects.add(value);

      const result: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(value)) {
        if (this.isSensitiveKey(key)) {
          result[key] = this.options.replacement;
        } else {
          result[key] = this.maskRecursive(val, visitedObjects, depth + 1);
        }
      }

      visitedObjects.delete(value);
      return result;
    }

    return value;
  }

  private maskString(str: string): string {
    if (str.length > this.options.maxStringLength) {
      return '[TRUNCATED:string]';
    }

    let masked = str;

    for (const pattern of this.compiledPatterns) {
      // Reset regex lastIndex to avoid issues with global flag
      pattern.lastIndex = 0;
      masked = masked.replace(pattern, this.options.replacement);
    }

    return masked;
  }

  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return this.options.sensitiveKeys.some(sensitiveKey =>
      lowerKey.includes(sensitiveKey.toLowerCase()),
    );
  }
}
