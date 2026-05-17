import type { IAsyncSpecification, ISpecification } from '@vytches/ddd-contracts';
import { safeRun } from '@vytches/ddd-utils';
import { describe, expect, it } from 'vitest';

import type { BaseCompositePolicy } from '../../../src/core/base/base-business-policy';
import {
  AsyncSpecificationPolicy,
  BaseBusinessPolicy,
  SpecificationPolicy,
} from '../../../src/core/base/base-business-policy';
import type {
  IBusinessPolicy,
  PolicyRequest,
} from '../../../src/core/interfaces/business-policy.interface';
import { PolicyViolation } from '../../../src/core/models/policy-violation';
import type { PolicyContext } from '../../../src/core/shared/policy-types';

const ctx = (): PolicyContext => ({
  userId: 'u-1',
  timestamp: new Date(),
  environment: 'test',
  features: {},
  metadata: {},
});

interface Order {
  amount: number;
}

const buildRequest = (entity: Order): PolicyRequest<Order> => ({
  entity,
  context: ctx(),
});

class AlwaysPassPolicy extends BaseBusinessPolicy<Order> {
  constructor() {
    super('p-pass', 'orders', 'Always pass');
  }
  public async check(request: PolicyRequest<Order>) {
    return this.success(request.entity);
  }
}

class AlwaysFailPolicy extends BaseBusinessPolicy<Order> {
  constructor(private readonly code = 'FAILED') {
    super('p-fail', 'orders', 'Always fail');
  }
  public async check(_request: PolicyRequest<Order>) {
    return this.failure(this.createViolation(this.code, 'always fails'));
  }
}

describe('BaseBusinessPolicy — identity and helpers', () => {
  it('exposes id, domain, name', () => {
    const policy = new AlwaysPassPolicy();
    expect(policy.id).toBe('p-pass');
    expect(policy.domain).toBe('orders');
    expect(policy.name).toBe('Always pass');
  });

  it('success() returns Result.ok with the entity', async () => {
    const policy = new AlwaysPassPolicy();
    const result = await policy.check(buildRequest({ amount: 5 }));
    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ amount: 5 });
  });

  it('failure() returns Result.fail with PolicyViolation', async () => {
    const policy = new AlwaysFailPolicy('CODE_X');
    const result = await policy.check(buildRequest({ amount: 5 }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(PolicyViolation);
    expect(result.error.code).toBe('CODE_X');
    expect(result.error.policyId).toBe('p-fail');
    expect(result.error.domain).toBe('orders');
  });

  it('createViolation includes optional field/details/context when provided', async () => {
    class WithExtras extends BaseBusinessPolicy<Order> {
      constructor() {
        super('p', 'd', 'n');
      }
      async check(_r: PolicyRequest<Order>) {
        return this.failure(
          this.createViolation('CODE', 'msg', 'WARNING', {
            field: 'amount',
            details: { reason: 'low' },
            context: ctx() as never,
          })
        );
      }
    }
    const result = await new WithExtras().check(buildRequest({ amount: 0 }));
    expect(result.isFailure).toBe(true);
    expect(result.error.severity).toBe('WARNING');
    expect(result.error.field).toBe('amount');
    expect(result.error.details).toEqual({ reason: 'low' });
  });
});

describe('BaseBusinessPolicy — and() composer', () => {
  it('passes when both children pass', async () => {
    const composed = new AlwaysPassPolicy().and(new AlwaysPassPolicy());
    const result = await composed.check(buildRequest({ amount: 1 }));
    expect(result.isSuccess).toBe(true);
  });

  it('fails on first child that fails (short-circuit)', async () => {
    const composed = new AlwaysFailPolicy('LEFT').and(new AlwaysFailPolicy('RIGHT'));
    const result = await composed.check(buildRequest({ amount: 1 }));
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('LEFT');
  });

  it('returns child policies via getChildPolicies', () => {
    const left = new AlwaysPassPolicy();
    const right = new AlwaysFailPolicy();
    const composed = left.and(right) as unknown as BaseCompositePolicy<Order>;
    const children = composed.getChildPolicies();
    expect(children).toHaveLength(2);
    expect(children[0]).toBe(left);
    expect(children[1]).toBe(right);
  });

  it('group() throws — feature not implemented', () => {
    const composed = new AlwaysPassPolicy().and(new AlwaysPassPolicy());
    const [error] = safeRun(() => composed.group());
    expect(error).toBeInstanceOf(Error);
  });
});

describe('BaseBusinessPolicy — or() composer', () => {
  it('passes when at least one child passes', async () => {
    const composed = new AlwaysFailPolicy().or(new AlwaysPassPolicy());
    const result = await composed.check(buildRequest({ amount: 1 }));
    expect(result.isSuccess).toBe(true);
  });

  it('aggregates violations when all children fail', async () => {
    const composed = new AlwaysFailPolicy('A').or(new AlwaysFailPolicy('B'));
    const result = await composed.check(buildRequest({ amount: 1 }));
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('OR_POLICY_ALL_FAILED');
    expect(result.error.details).toMatchObject({ violationCount: 2 });
  });

  it('group() throws — feature not implemented', () => {
    const composed = new AlwaysPassPolicy().or(new AlwaysFailPolicy());
    const [error] = safeRun(() => composed.group());
    expect(error).toBeInstanceOf(Error);
  });
});

describe('BaseBusinessPolicy — not() composer', () => {
  it('inverts a passing policy into a failure', async () => {
    const composed = new AlwaysPassPolicy().not();
    const result = await composed.check(buildRequest({ amount: 1 }));
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('NEGATED_POLICY_PASSED');
  });

  it('inverts a failing policy into a success', async () => {
    const composed = new AlwaysFailPolicy().not();
    const result = await composed.check(buildRequest({ amount: 1 }));
    expect(result.isSuccess).toBe(true);
  });

  it('id includes NOT_ prefix', () => {
    const composed = new AlwaysPassPolicy().not() as IBusinessPolicy<Order>;
    expect(composed.id).toBe('NOT_p-pass');
  });
});

describe('BaseBusinessPolicy — when() conditional builder', () => {
  it('then() throws — guidance to use PolicyBuilder', () => {
    const composed = new AlwaysPassPolicy().when(() => true);
    const [error] = safeRun(() => composed.then(new AlwaysFailPolicy()));
    expect(error).toBeInstanceOf(Error);
  });

  it('thenMust() throws — guidance to use PolicyBuilder', () => {
    const composed = new AlwaysPassPolicy().when(() => true);
    const [error] = safeRun(() => composed.thenMust({} as never));
    expect(error).toBeInstanceOf(Error);
  });
});

describe('SpecificationPolicy', () => {
  const passingSpec: ISpecification<Order> = {
    isSatisfiedBy: () => true,
  } as unknown as ISpecification<Order>;
  const failingSpec: ISpecification<Order> = {
    isSatisfiedBy: () => false,
  } as unknown as ISpecification<Order>;
  const explainSpec: ISpecification<Order> = {
    isSatisfiedBy: () => false,
    explainFailure: () => 'amount too low',
  } as unknown as ISpecification<Order>;
  const throwingSpec: ISpecification<Order> = {
    isSatisfiedBy: () => {
      throw new Error('boom');
    },
  } as unknown as ISpecification<Order>;

  it('returns success when specification is satisfied', async () => {
    const policy = SpecificationPolicy.fromSpecification('sp-1', 'orders', 'Test', passingSpec);
    const result = await policy.check(buildRequest({ amount: 10 }));
    expect(result.isSuccess).toBe(true);
  });

  it('returns violation with default message when specification fails (no explainFailure)', async () => {
    const policy = SpecificationPolicy.fromSpecification(
      'sp-2',
      'orders',
      'Test',
      failingSpec,
      'CUSTOM_CODE',
      'custom message'
    );
    const result = await policy.check(buildRequest({ amount: 0 }));
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('CUSTOM_CODE');
    expect(result.error.message).toBe('custom message');
  });

  it('uses explainFailure() output as violation message when present', async () => {
    const policy = SpecificationPolicy.fromSpecification('sp-3', 'orders', 'Test', explainSpec);
    const result = await policy.check(buildRequest({ amount: 0 }));
    expect(result.isFailure).toBe(true);
    expect(result.error.message).toBe('amount too low');
  });

  it('catches thrown exceptions and returns SPECIFICATION_ERROR violation', async () => {
    const policy = SpecificationPolicy.fromSpecification('sp-4', 'orders', 'Test', throwingSpec);
    const result = await policy.check(buildRequest({ amount: 0 }));
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('SPECIFICATION_ERROR');
    expect(result.error.message).toContain('boom');
  });
});

describe('AsyncSpecificationPolicy', () => {
  const passingAsync: IAsyncSpecification<Order> = {
    isSatisfiedByAsync: async () => true,
  } as unknown as IAsyncSpecification<Order>;
  const failingAsync: IAsyncSpecification<Order> = {
    isSatisfiedByAsync: async () => false,
  } as unknown as IAsyncSpecification<Order>;
  const explainAsync: IAsyncSpecification<Order> = {
    isSatisfiedByAsync: async () => false,
    explainFailureAsync: async () => 'async reason',
  } as unknown as IAsyncSpecification<Order>;
  const throwingAsync: IAsyncSpecification<Order> = {
    isSatisfiedByAsync: async () => {
      throw new Error('async boom');
    },
  } as unknown as IAsyncSpecification<Order>;

  it('returns success when async spec resolves true', async () => {
    const policy = AsyncSpecificationPolicy.fromAsyncSpecification(
      'asp-1',
      'orders',
      'Test',
      passingAsync
    );
    const result = await policy.check(buildRequest({ amount: 5 }));
    expect(result.isSuccess).toBe(true);
  });

  it('returns violation with default message when async spec resolves false', async () => {
    const policy = AsyncSpecificationPolicy.fromAsyncSpecification(
      'asp-2',
      'orders',
      'Test',
      failingAsync,
      'ASYNC_CODE',
      'async msg'
    );
    const result = await policy.check(buildRequest({ amount: 5 }));
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('ASYNC_CODE');
    expect(result.error.message).toBe('async msg');
  });

  it('uses explainFailureAsync() output when present', async () => {
    const policy = AsyncSpecificationPolicy.fromAsyncSpecification(
      'asp-3',
      'orders',
      'Test',
      explainAsync
    );
    const result = await policy.check(buildRequest({ amount: 5 }));
    expect(result.isFailure).toBe(true);
    expect(result.error.message).toBe('async reason');
  });

  it('catches thrown exceptions and returns ASYNC_SPECIFICATION_ERROR violation', async () => {
    const policy = AsyncSpecificationPolicy.fromAsyncSpecification(
      'asp-4',
      'orders',
      'Test',
      throwingAsync
    );
    const result = await policy.check(buildRequest({ amount: 5 }));
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('ASYNC_SPECIFICATION_ERROR');
    expect(result.error.message).toContain('async boom');
  });
});
