import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PolicyContextBuilder, PolicyRequestBuilder } from './policy-context';
import type { PolicyContext } from './business-policy-interface';

describe('PolicyContextBuilder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('required fields validation', () => {
    it('should require userId', () => {
      const builder = PolicyContextBuilder.create().withEnvironment('test');

      expect(() => builder.build()).toThrow('PolicyContext requires userId. Use .withUserId()');
    });

    it('should require environment', () => {
      const builder = PolicyContextBuilder.create().withUserId('user-123');

      expect(() => builder.build()).toThrow('PolicyContext requires environment. Use .withEnvironment()');
    });

    it('should build successfully with required fields', () => {
      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .build();

      expect(context.userId).toBe('user-123');
      expect(context.environment).toBe('test');
    });
  });

  describe('fluent API', () => {
    it('should build context with all fields', () => {
      const fixedDate = new Date('2023-01-01T00:00:00Z');
      vi.setSystemTime(fixedDate);

      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('production')
        .withSessionId('session-abc')
        .withTenantId('tenant-xyz')
        .withTimestamp(fixedDate)
        .withFeatures({ featureA: true, featureB: false })
        .withMetadata({ source: 'api', version: '1.0.0' })
        .build();

      expect(context).toEqual({
        userId: 'user-123',
        environment: 'production',
        sessionId: 'session-abc',
        tenantId: 'tenant-xyz',
        timestamp: fixedDate,
        features: { featureA: true, featureB: false },
        metadata: { source: 'api', version: '1.0.0' },
      });
    });

    it('should use current time as default timestamp', () => {
      const fixedDate = new Date('2023-01-01T12:00:00Z');
      vi.setSystemTime(fixedDate);

      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .build();

      expect(context.timestamp).toEqual(fixedDate);
    });

    it('should use explicit timestamp when provided', () => {
      const customDate = new Date('2022-12-25T00:00:00Z');

      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .withTimestamp(customDate)
        .build();

      expect(context.timestamp).toEqual(customDate);
    });
  });

  describe('feature management', () => {
    it('should add single feature flag', () => {
      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .withFeature('newFeature', true)
        .build();

      expect(context.features).toEqual({ newFeature: true });
    });

    it('should merge multiple feature flags', () => {
      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .withFeature('featureA', true)
        .withFeature('featureB', false)
        .withFeatures({ featureC: true, featureD: false })
        .build();

      expect(context.features).toEqual({
        featureA: true,
        featureB: false,
        featureC: true,
        featureD: false,
      });
    });

    it('should override existing features', () => {
      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .withFeature('feature', true)
        .withFeatures({ feature: false })
        .build();

      expect(context.features).toEqual({ feature: false });
    });
  });

  describe('metadata management', () => {
    it('should add single metadata entry', () => {
      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .withMetadataEntry('source', 'mobile-app')
        .build();

      expect(context.metadata).toEqual({ source: 'mobile-app' });
    });

    it('should merge multiple metadata entries', () => {
      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .withMetadataEntry('source', 'mobile-app')
        .withMetadataEntry('version', '2.1.0')
        .withMetadata({ platform: 'ios', deviceId: 'device-123' })
        .build();

      expect(context.metadata).toEqual({
        source: 'mobile-app',
        version: '2.1.0',
        platform: 'ios',
        deviceId: 'device-123',
      });
    });

    it('should handle complex metadata values', () => {
      const complexValue = { nested: { data: 'value' }, array: [1, 2, 3] };

      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .withMetadataEntry('complex', complexValue)
        .build();

      expect(context.metadata.complex).toEqual(complexValue);
    });
  });

  describe('optional fields handling', () => {
    it('should not include optional fields when not set', () => {
      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .build();

      expect(context).not.toHaveProperty('tenantId');
      expect(context).not.toHaveProperty('sessionId');
      expect(context.features).toEqual({});
      expect(context.metadata).toEqual({});
    });

    it('should include optional fields when set', () => {
      const context = PolicyContextBuilder.create()
        .withUserId('user-123')
        .withEnvironment('test')
        .withTenantId('tenant-123')
        .withSessionId('session-456')
        .build();

      expect(context.tenantId).toBe('tenant-123');
      expect(context.sessionId).toBe('session-456');
    });
  });

  describe('static factory methods', () => {
    beforeEach(() => {
      delete process.env.NODE_ENV;
    });

    describe('create', () => {
      it('should create new builder instance', () => {
        const builder = PolicyContextBuilder.create();

        expect(builder).toBeInstanceOf(PolicyContextBuilder);
      });
    });

    describe('createDefault', () => {
      it('should create context with default environment', () => {
        const context = PolicyContextBuilder.createDefault('user-123');

        expect(context.userId).toBe('user-123');
        expect(context.environment).toBe('development');
        expect(context.timestamp).toBeDefined();
      });

      it('should use custom environment', () => {
        const context = PolicyContextBuilder.createDefault('user-123', 'staging');

        expect(context.environment).toBe('staging');
      });
    });

    describe('forUser', () => {
      it('should create context for user with auto-detected environment', () => {
        process.env.NODE_ENV = 'production';

        const context = PolicyContextBuilder.forUser('user-123');

        expect(context.userId).toBe('user-123');
        expect(context.environment).toBe('production');
      });

      it('should use custom environment over auto-detection', () => {
        process.env.NODE_ENV = 'production';

        const context = PolicyContextBuilder.forUser('user-123', 'staging');

        expect(context.environment).toBe('staging');
      });

      it('should default to development when NODE_ENV is not set', () => {
        const context = PolicyContextBuilder.forUser('user-123');

        expect(context.environment).toBe('development');
      });
    });

    describe('forTenantUser', () => {
      it('should create context for tenant and user', () => {
        const context = PolicyContextBuilder.forTenantUser('tenant-123', 'user-456');

        expect(context.tenantId).toBe('tenant-123');
        expect(context.userId).toBe('user-456');
        expect(context.environment).toBe('development');
      });

      it('should use custom environment', () => {
        const context = PolicyContextBuilder.forTenantUser('tenant-123', 'user-456', 'production');

        expect(context.environment).toBe('production');
      });
    });

    describe('forProduction', () => {
      it('should create production context with required fields', () => {
        const context = PolicyContextBuilder.forProduction('user-123', 'session-abc');

        expect(context.userId).toBe('user-123');
        expect(context.sessionId).toBe('session-abc');
        expect(context.environment).toBe('production');
        expect(context.tenantId).toBeUndefined();
      });

      it('should include tenant when provided', () => {
        const context = PolicyContextBuilder.forProduction('user-123', 'session-abc', 'tenant-xyz');

        expect(context.tenantId).toBe('tenant-xyz');
      });
    });
  });

  describe('method chaining', () => {
    it('should return builder instance for all methods', () => {
      const builder = PolicyContextBuilder.create();

      expect(builder.withUserId('user')).toBe(builder);
      expect(builder.withEnvironment('test')).toBe(builder);
      expect(builder.withSessionId('session')).toBe(builder);
      expect(builder.withTenantId('tenant')).toBe(builder);
      expect(builder.withTimestamp(new Date())).toBe(builder);
      expect(builder.withFeature('feature', true)).toBe(builder);
      expect(builder.withFeatures({})).toBe(builder);
      expect(builder.withMetadata({})).toBe(builder);
      expect(builder.withMetadataEntry('key', 'value')).toBe(builder);
    });
  });
});

describe('PolicyRequestBuilder', () => {
  interface TestEntity {
    id: string;
    value: number;
  }

  let testEntity: TestEntity;
  let testContext: PolicyContext;

  beforeEach(() => {
    testEntity = { id: 'test-1', value: 42 };
    testContext = PolicyContextBuilder.forUser('user-123', 'test');
  });

  describe('required fields validation', () => {
    it('should require entity', () => {
      const builder = PolicyRequestBuilder.create<TestEntity>().withContext(testContext);

      expect(() => builder.build()).toThrow('PolicyRequest requires entity. Use .withEntity()');
    });

    it('should require context', () => {
      const builder = PolicyRequestBuilder.create<TestEntity>().withEntity(testEntity);

      expect(() => builder.build()).toThrow(
        'PolicyRequest requires context. Use .withContext() or .withContextBuilder()'
      );
    });

    it('should build successfully with required fields', () => {
      const request = PolicyRequestBuilder.create<TestEntity>()
        .withEntity(testEntity)
        .withContext(testContext)
        .build();

      expect(request.entity).toBe(testEntity);
      expect(request.context).toBe(testContext);
      expect(request.metadata).toBeUndefined();
    });
  });

  describe('fluent API', () => {
    it('should build request with all fields', () => {
      const metadata = {
        source: 'api',
        correlationId: 'corr-123',
        custom: { requestId: 'req-456' },
      };

      const request = PolicyRequestBuilder.create<TestEntity>()
        .withEntity(testEntity)
        .withContext(testContext)
        .withMetadata(metadata)
        .build();

      expect(request).toEqual({
        entity: testEntity,
        context: testContext,
        metadata,
      });
    });

    it('should handle undefined metadata', () => {
      const request = PolicyRequestBuilder.create<TestEntity>()
        .withEntity(testEntity)
        .withContext(testContext)
        .build();

      expect(request.metadata).toBeUndefined();
    });
  });

  describe('context builder integration', () => {
    it('should build context fluently', () => {
      const request = PolicyRequestBuilder.create<TestEntity>()
        .withEntity(testEntity)
        .withContextBuilder(builder =>
          builder
            .withUserId('user-456')
            .withEnvironment('staging')
            .withFeature('testFeature', true)
        )
        .build();

      expect(request.context.userId).toBe('user-456');
      expect(request.context.environment).toBe('staging');
      expect(request.context.features.testFeature).toBe(true);
    });
  });

  describe('metadata helpers', () => {
    it('should add source information', () => {
      const request = PolicyRequestBuilder.create<TestEntity>()
        .withEntity(testEntity)
        .withContext(testContext)
        .withSource('mobile-app')
        .build();

      expect(request.metadata?.source).toBe('mobile-app');
    });

    it('should add correlation ID', () => {
      const request = PolicyRequestBuilder.create<TestEntity>()
        .withEntity(testEntity)
        .withContext(testContext)
        .withCorrelationId('corr-123')
        .build();

      expect(request.metadata?.correlationId).toBe('corr-123');
    });

    it('should combine metadata helpers', () => {
      const request = PolicyRequestBuilder.create<TestEntity>()
        .withEntity(testEntity)
        .withContext(testContext)
        .withSource('web-app')
        .withCorrelationId('corr-456')
        .build();

      expect(request.metadata).toEqual({
        source: 'web-app',
        correlationId: 'corr-456',
      });
    });

    it('should merge with existing metadata', () => {
      const request = PolicyRequestBuilder.create<TestEntity>()
        .withEntity(testEntity)
        .withContext(testContext)
        .withMetadata({ custom: { data: 'value' } })
        .withSource('api')
        .build();

      expect(request.metadata).toEqual({
        custom: { data: 'value' },
        source: 'api',
      });
    });
  });

  describe('static factory methods', () => {
    describe('create', () => {
      it('should create new builder instance', () => {
        const builder = PolicyRequestBuilder.create<TestEntity>();

        expect(builder).toBeInstanceOf(PolicyRequestBuilder);
      });
    });

    describe('simple', () => {
      it('should create simple request with minimal context', () => {
        const request = PolicyRequestBuilder.simple(testEntity, 'user-789');

        expect(request.entity).toBe(testEntity);
        expect(request.context.userId).toBe('user-789');
        expect(request.context.environment).toBe('development');
        expect(request.metadata).toBeUndefined();
      });

      it('should use custom environment', () => {
        const request = PolicyRequestBuilder.simple(testEntity, 'user-789', 'production');

        expect(request.context.environment).toBe('production');
      });
    });

    describe('production', () => {
      it('should create production request with full context', () => {
        const request = PolicyRequestBuilder.production(
          testEntity,
          'user-123',
          'session-abc',
          'tenant-xyz'
        );

        expect(request.entity).toBe(testEntity);
        expect(request.context.userId).toBe('user-123');
        expect(request.context.sessionId).toBe('session-abc');
        expect(request.context.tenantId).toBe('tenant-xyz');
        expect(request.context.environment).toBe('production');
      });

      it('should create production request without tenant', () => {
        const request = PolicyRequestBuilder.production(testEntity, 'user-123', 'session-abc');

        expect(request.context.tenantId).toBeUndefined();
      });
    });
  });

  describe('method chaining', () => {
    it('should return builder instance for all methods', () => {
      const builder = PolicyRequestBuilder.create<TestEntity>();

      expect(builder.withEntity(testEntity)).toBe(builder);
      expect(builder.withContext(testContext)).toBe(builder);
      expect(builder.withMetadata({})).toBe(builder);
      expect(builder.withSource('test')).toBe(builder);
      expect(builder.withCorrelationId('test')).toBe(builder);
    });
  });

  describe('type safety', () => {
    it('should maintain entity type throughout the chain', () => {
      interface CustomEntity {
        customField: string;
      }

      const customEntity: CustomEntity = { customField: 'test' };

      const request = PolicyRequestBuilder.create<CustomEntity>()
        .withEntity(customEntity)
        .withContext(testContext)
        .build();

      // TypeScript should enforce that request.entity has CustomEntity type
      expect(request.entity.customField).toBe('test');
    });
  });
});
