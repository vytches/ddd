import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultLogger } from '../../src/logger';
import { LogCommands, LogQueries, LogCQRS } from '../../src/integration/cqrs-decorators';
import type { LogProvider, LogEvent } from '../../src/core/index';

function createMockProvider(): { provider: LogProvider; calls: LogEvent[] } {
  const calls: LogEvent[] = [];
  const provider: LogProvider = {
    name: 'test',
    write: (event: LogEvent) => { calls.push(event); },
  };
  return { provider, calls };
}

describe('CQRS decorators — PII masking (VS-001)', () => {
  let calls: LogEvent[];

  beforeEach(() => {
    const { provider, calls: c } = createMockProvider();
    calls = c;
    DefaultLogger.configure({ level: 'debug', provider, masking: { enabled: false } });
  });

  describe('@LogCommands — maskSensitiveData', () => {
    it('masks email VALUES by default regex when maskSensitiveData: true', async () => {
      @LogCommands({ includePayload: true, maskSensitiveData: true })
      class CreateUserHandler {
        async execute(cmd: unknown) { return cmd; }
      }

      const handler = new CreateUserHandler();
      await handler.execute({ email: 'jan@example.com', password: 'secret123', name: 'Jan' });

      const [firstCall] = calls;
      const payload = firstCall?.data?.['payload'] as Record<string, unknown>;
      // email VALUE matches default email regex → masked
      expect(payload?.['email']).toBe('[MASKED]');
      // password VALUE 'secret123' does not match any default pattern → use sensitiveFields for key masking
      expect(payload?.['password']).toBe('secret123');
      expect(payload?.['name']).toBe('Jan');
    });

    it('masks by key name when sensitiveFields provided', async () => {
      @LogCommands({ includePayload: true, maskSensitiveData: true, sensitiveFields: ['password', 'token'] })
      class SecureHandler {
        async execute(cmd: unknown) { return cmd; }
      }

      const handler = new SecureHandler();
      await handler.execute({ password: 'secret123', token: 'Bearer abc.def.ghi', name: 'Jan' });

      const [firstCall] = calls;
      const payload = firstCall?.data?.['payload'] as Record<string, unknown>;
      expect(payload?.['password']).toBe('[MASKED]');
      expect(payload?.['token']).toBe('[MASKED]');
      expect(payload?.['name']).toBe('Jan');
    });

    it('does not mask when maskSensitiveData: false', async () => {
      @LogCommands({ includePayload: true, maskSensitiveData: false })
      class GetUserHandler {
        async execute(cmd: unknown) { return cmd; }
      }

      const handler = new GetUserHandler();
      await handler.execute({ email: 'jan@example.com', password: 'secret123' });

      const [firstCall] = calls;
      const payload = firstCall?.data?.['payload'] as Record<string, unknown>;
      expect(payload?.['email']).toBe('jan@example.com');
      expect(payload?.['password']).toBe('secret123');
    });

    it('does not mask when maskSensitiveData is not set (backward-compat)', async () => {
      @LogCommands({ includePayload: true })
      class LegacyHandler {
        async execute(cmd: unknown) { return cmd; }
      }

      const handler = new LegacyHandler();
      await handler.execute({ email: 'jan@example.com', password: 'secret123' });

      const [firstCall] = calls;
      const payload = firstCall?.data?.['payload'] as Record<string, unknown>;
      expect(payload?.['email']).toBe('jan@example.com');
      expect(payload?.['password']).toBe('secret123');
    });

    it('masks sensitiveFields additive to default regex patterns', async () => {
      @LogCommands({ includePayload: true, maskSensitiveData: true, sensitiveFields: ['apiKey'] })
      class ApiHandler {
        async execute(cmd: unknown) { return cmd; }
      }

      const handler = new ApiHandler();
      // apiKey masked by sensitiveFields; email masked by default regex
      await handler.execute({ apiKey: 'key-abc', email: 'admin@example.com', name: 'service' });

      const [firstCall] = calls;
      const payload = firstCall?.data?.['payload'] as Record<string, unknown>;
      expect(payload?.['apiKey']).toBe('[MASKED]');
      expect(payload?.['email']).toBe('[MASKED]');
      expect(payload?.['name']).toBe('service');
    });

    it('applies same masked payload to both pre- and post-execution logs', async () => {
      @LogCommands({ includePayload: true, maskSensitiveData: true, sensitiveFields: ['password'] })
      class AuditHandler {
        async execute(cmd: unknown) { return cmd; }
      }

      const handler = new AuditHandler();
      await handler.execute({ password: 'topsecret', action: 'delete' });

      const payloads = calls
        .map(e => e.data?.['payload'])
        .filter(Boolean) as Record<string, unknown>[];

      expect(payloads.length).toBe(2);
      for (const payload of payloads) {
        expect(payload['password']).toBe('[MASKED]');
        expect(payload['action']).toBe('delete');
      }
    });

    it('masks nested PII — email by regex, password by sensitiveFields', async () => {
      @LogCommands({ includePayload: true, maskSensitiveData: true, sensitiveFields: ['password'] })
      class NestedHandler {
        async execute(cmd: unknown) { return cmd; }
      }

      const handler = new NestedHandler();
      await handler.execute({ user: { email: 'jan@example.com', credentials: { password: 'pass' } } });

      const [firstCall] = calls;
      const payload = firstCall?.data?.['payload'] as Record<string, unknown>;
      const user = payload?.['user'] as Record<string, unknown>;
      expect(user?.['email']).toBe('[MASKED]');
      const creds = user?.['credentials'] as Record<string, unknown>;
      expect(creds?.['password']).toBe('[MASKED]');
    });

    it('handles circular reference in payload without crashing', async () => {
      @LogCommands({ includePayload: true, maskSensitiveData: true })
      class CircularHandler {
        async execute(cmd: unknown) { return cmd; }
      }

      const handler = new CircularHandler();
      const cmd: Record<string, unknown> = { name: 'test', email: 'x@y.com' };
      cmd['self'] = cmd;

      await expect(handler.execute(cmd)).resolves.not.toThrow();

      const [firstCall] = calls;
      const payload = firstCall?.data?.['payload'] as Record<string, unknown>;
      expect(payload?.['self']).toBe('[Circular Reference]');
      expect(payload?.['email']).toBe('[MASKED]');
    });

    it('does not include payload when includePayload is not set', async () => {
      @LogCommands({ maskSensitiveData: true })
      class NoPayloadHandler {
        async execute(cmd: unknown) { return cmd; }
      }

      const handler = new NoPayloadHandler();
      await handler.execute({ password: 'secret' });

      for (const call of calls) {
        expect(call.data?.['payload']).toBeUndefined();
      }
    });
  });

  describe('@LogQueries — maskSensitiveData', () => {
    it('masks token key via sensitiveFields', async () => {
      @LogQueries({ includePayload: true, maskSensitiveData: true, sensitiveFields: ['token'] })
      class GetUserByTokenQuery {
        async execute(query: unknown) { return query; }
      }

      const handler = new GetUserByTokenQuery();
      await handler.execute({ token: 'Bearer abc.def.ghi', userId: '123' });

      const [firstCall] = calls;
      const payload = firstCall?.data?.['payload'] as Record<string, unknown>;
      expect(payload?.['token']).toBe('[MASKED]');
      expect(payload?.['userId']).toBe('123');
    });
  });

  describe('@LogCQRS — maskSensitiveData', () => {
    it('masks email value by default regex', async () => {
      @LogCQRS({ includePayload: true, maskSensitiveData: true })
      class MixedHandler {
        async execute(op: unknown) { return op; }
      }

      const handler = new MixedHandler();
      await handler.execute({ email: 'test@example.com', data: 'ok' });

      const [firstCall] = calls;
      const payload = firstCall?.data?.['payload'] as Record<string, unknown>;
      expect(payload?.['email']).toBe('[MASKED]');
      expect(payload?.['data']).toBe('ok');
    });
  });
});
