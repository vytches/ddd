import { describe, it, expect } from 'vitest';

import { parseManifest } from '../src/manifest.js';

describe('parseManifest', () => {
  it('parses a well-formed manifest with sorted packages', () => {
    const parsed = {
      combinations: [
        {
          name: 'aggregate-plus-specification',
          level: 'quick-start',
          packages: ['@vytches/ddd-validation', '@vytches/ddd-aggregates'],
          file: 'examples/quickstart/src/domain/order.aggregate.ts',
          description: 'desc',
        },
      ],
    };

    const result = parseManifest(parsed, 'test.yaml');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'aggregate-plus-specification',
      level: 'quick-start',
      packages: ['@vytches/ddd-aggregates', '@vytches/ddd-validation'],
      file: 'examples/quickstart/src/domain/order.aggregate.ts',
      description: 'desc',
    });
  });

  it('allows file: null and omitted description', () => {
    const parsed = {
      combinations: [
        {
          name: 'missing-combo',
          level: 'advanced',
          packages: ['@vytches/ddd-cqrs'],
          file: null,
        },
      ],
    };

    const result = parseManifest(parsed, 'test.yaml');

    expect(result[0].file).toBeNull();
    expect(result[0].description).toBeUndefined();
  });

  it('throws when top-level "combinations" key is missing', () => {
    expect(() => parseManifest({}, 'test.yaml')).toThrow(
      /expected a top-level "combinations" list/
    );
  });

  it('throws when "combinations" is not an array', () => {
    expect(() => parseManifest({ combinations: 'nope' }, 'test.yaml')).toThrow(
      /"combinations" must be a list/
    );
  });

  it('throws on a missing or empty "name"', () => {
    const parsed = {
      combinations: [{ level: 'quick-start', packages: ['@vytches/ddd-cqrs'], file: null }],
    };
    expect(() => parseManifest(parsed, 'test.yaml')).toThrow(/"name" must be a non-empty string/);
  });

  it('throws on an invalid "level"', () => {
    const parsed = {
      combinations: [{ name: 'x', level: 'expert', packages: ['@vytches/ddd-cqrs'], file: null }],
    };
    expect(() => parseManifest(parsed, 'test.yaml')).toThrow(/"level" must be one of/);
  });

  it('throws on an empty "packages" list', () => {
    const parsed = {
      combinations: [{ name: 'x', level: 'quick-start', packages: [], file: null }],
    };
    expect(() => parseManifest(parsed, 'test.yaml')).toThrow(
      /"packages" must be a non-empty string list/
    );
  });

  it('throws when "file" is neither a string nor null', () => {
    const parsed = {
      combinations: [
        { name: 'x', level: 'quick-start', packages: ['@vytches/ddd-cqrs'], file: 42 },
      ],
    };
    expect(() => parseManifest(parsed, 'test.yaml')).toThrow(/"file" must be a string or null/);
  });

  it('throws when "description" is present but not a string', () => {
    const parsed = {
      combinations: [
        {
          name: 'x',
          level: 'quick-start',
          packages: ['@vytches/ddd-cqrs'],
          file: null,
          description: 123,
        },
      ],
    };
    expect(() => parseManifest(parsed, 'test.yaml')).toThrow(
      /"description" must be a string if present/
    );
  });
});
