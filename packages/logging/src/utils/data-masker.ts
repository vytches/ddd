export interface MaskingOptions {
  enabled: boolean;
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
      ...this.options.patterns.map(pattern => new RegExp(pattern, 'g')),
    ];
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
