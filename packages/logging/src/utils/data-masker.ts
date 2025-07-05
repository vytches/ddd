export interface MaskingOptions {
  enabled: boolean;
  patterns: string[];
  replacement: string;
  sensitiveKeys: string[];
}

export class DataMasker {
  private static readonly DEFAULT_SENSITIVE_KEYS: string[] = [];

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
    };

    // Use default patterns only when no explicit patterns AND no sensitive keys provided
    const shouldUseDefaultPatterns =
      this.options.patterns.length === 0 && this.options.sensitiveKeys.length === 0;
    const defaultPatterns = shouldUseDefaultPatterns ? DataMasker.DEFAULT_PATTERNS : [];

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
    return this.maskRecursive(data, visitedObjects);
  }

  private maskRecursive(value: unknown, visitedObjects: WeakSet<object>): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.maskString(value);
    }

    if (Array.isArray(value)) {
      // Check for circular reference
      if (visitedObjects.has(value)) {
        return '[Circular Reference]';
      }
      visitedObjects.add(value);

      const result = value.map(item => this.maskRecursive(item, visitedObjects));
      visitedObjects.delete(value);
      return result;
    }

    if (typeof value === 'object' && value !== null) {
      // Check for circular reference
      if (visitedObjects.has(value)) {
        return '[Circular Reference]';
      }
      visitedObjects.add(value);

      const result: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(value)) {
        if (this.isSensitiveKey(key)) {
          result[key] = this.options.replacement;
        } else {
          result[key] = this.maskRecursive(val, visitedObjects);
        }
      }

      visitedObjects.delete(value);
      return result;
    }

    return value;
  }

  private maskString(str: string): string {
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
    return this.options.sensitiveKeys.some(sensitiveKey => {
      const lowerSensitiveKey = sensitiveKey.toLowerCase();
      // Contains the sensitive key but exclude plural forms
      // e.g. "token" matches "apiToken" and "userToken" but not "tokens"
      return lowerKey.includes(lowerSensitiveKey) && !lowerKey.endsWith(lowerSensitiveKey + 's');
    });
  }
}
