import type {
  ConfigLevel,
  FormatRules,
  GlobalSettings,
  ParsedMetadata,
  ResolvedMetadata,
} from '../types/enhanced-metadata.types';

/**
 * Default format transformation rules
 */
const DEFAULT_FORMAT_RULES: FormatRules = {
  jsdoc: {
    description: content => content.trim(),
    'business-context': content => `@business ${content.trim()}`,
    author: content => `@author ${content.trim()}`,
    since: content => `@since ${content.trim()}`,
    warning: content => `@warning ${content.trim()}`,
  },
  cli: {
    description: content => `## Description\n\n${content.trim()}`,
    'business-context': content => `## Business Context\n\n${content.trim()}`,
    author: content => `**Author**: ${content.trim()}`,
    since: content => `**Since**: ${content.trim()}`,
    warning: content => `> **Warning**: ${content.trim()}`,
  },
};

export class EnhancedMetadataParser {
  constructor(private formatRules: FormatRules = DEFAULT_FORMAT_RULES) {}

  /**
   * Parse metadata with dot notation support
   */
  parseMetadata(content: string): ParsedMetadata {
    const metadata: ParsedMetadata = {};

    // Match metadata tags with optional dot notation
    // @key: value or @key.format: value
    const metadataRegex =
      /@([\w-]+(?:\.[\w-]+)?):\s*(.+?)(?=\n@[\w-]|@extract-end|@global-settings-end|\n```|$)/gs;

    for (const match of content.matchAll(metadataRegex)) {
      const [, fullKey, value] = match;
      if (!fullKey || !value) continue;

      const [baseKey, format = 'default'] = fullKey.split('.');
      if (!baseKey) continue;

      if (!metadata[baseKey]) {
        metadata[baseKey] = {};
      }

      // Handle multi-line values - preserve escape sequences as-is during parsing
      const cleanValue = value.trim();
      metadata[baseKey][format] = cleanValue;
    }

    return metadata;
  }

  /**
   * Parse global settings block
   */
  parseGlobalSettings(content: string): GlobalSettings[] {
    const settings: GlobalSettings[] = [];

    // Match global settings blocks with optional scope
    const globalRegex = /@global-settings(?::(\w+))?\n(.*?)@global-settings-end/gs;

    for (const match of content.matchAll(globalRegex)) {
      const [, scope, settingsContent] = match;
      if (!settingsContent) continue;

      // Extract strategy if specified
      const strategyMatch = settingsContent.match(/@strategy:\s*(merge|replace)/);
      const strategy = (strategyMatch?.[1] as 'merge' | 'replace') || 'merge';

      // Parse metadata within settings block (exclude strategy from metadata)
      const cleanedContent = settingsContent.replace(/@strategy:\s*(merge|replace)/, '');
      const metadata = this.parseMetadata(cleanedContent);

      settings.push({
        strategy,
        metadata,
        scope: scope || undefined,
      });
    }

    return settings;
  }

  /**
   * Resolve metadata for specific format with hierarchy
   */
  resolveMetadata(
    configs: ConfigLevel[],
    localMetadata: ParsedMetadata,
    format: 'jsdoc' | 'cli',
    scope?: string
  ): ResolvedMetadata {
    let accumulated: ParsedMetadata = {};

    // Apply configs in order (library -> package -> file)
    for (const config of configs) {
      // Skip if scope doesn't match
      if (config.scope && config.scope !== scope) {
        continue;
      }

      if (config.strategy === 'replace') {
        // Replace strategy: start fresh
        accumulated = { ...config.metadata };
      } else {
        // Merge strategy: combine with existing
        accumulated = this.mergeMetadata(accumulated, config.metadata);
      }
    }

    // Always merge local metadata (highest priority)
    const finalMetadata = this.mergeMetadata(accumulated, localMetadata);

    // Resolve for specific format
    return this.resolveForFormat(finalMetadata, format);
  }

  /**
   * Merge two metadata objects
   */
  private mergeMetadata(base: ParsedMetadata, override: ParsedMetadata): ParsedMetadata {
    const merged: ParsedMetadata = { ...base };

    for (const [key, value] of Object.entries(override)) {
      merged[key] = { ...merged[key], ...value };
    }

    return merged;
  }

  /**
   * Resolve metadata for specific format
   */
  private resolveForFormat(metadata: ParsedMetadata, format: 'jsdoc' | 'cli'): ResolvedMetadata {
    const resolved: ResolvedMetadata = {};

    for (const [key, value] of Object.entries(metadata)) {
      // 1. Check for format-specific override
      if (value[format]) {
        // For format-specific values, check if they look like they contain format markers
        const rawValue = value[format].replace(/\\n/g, '\n');

        // If value already contains format markers (like ##, @, >), use as-is
        // Otherwise, apply format transformation rules
        const formatRule = this.formatRules[format]?.[key];
        if (formatRule && !this.isAlreadyFormatted(rawValue, format)) {
          resolved[key] = formatRule(rawValue);
        } else {
          resolved[key] = rawValue;
        }
      }
      // 2. Use default and apply transformation rules
      else if (value.default) {
        const formatRule = this.formatRules[format]?.[key];
        resolved[key] = formatRule ? formatRule(value.default) : value.default;
      }
    }

    return resolved;
  }

  /**
   * Check if value is already formatted for the target format
   */
  private isAlreadyFormatted(value: string, format: 'jsdoc' | 'cli'): boolean {
    if (format === 'cli') {
      return value.startsWith('## ') || value.startsWith('**') || value.startsWith('> **');
    } else if (format === 'jsdoc') {
      return value.startsWith('@');
    }
    return false;
  }

  /**
   * Apply format rules to content
   */
  applyFormatRule(key: string, content: string, format: 'jsdoc' | 'cli'): string {
    const rule = this.formatRules[format]?.[key];
    return rule ? rule(content) : content;
  }
}
