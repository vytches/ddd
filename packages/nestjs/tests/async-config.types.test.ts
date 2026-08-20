/**
 * VF-032a AC5b — type-level guard on the async-config contract.
 *
 * This pins decision D2: `forRootAsync()`'s factory must resolve to the very
 * same options object `forRoot()` accepts. The ghost `types/index.ts` deleted
 * by this task got this wrong — its factory returned a `VytchesDDDOptions`
 * sharing no fields with the live `VytchesDDDModuleOptions`, so a
 * `forRootAsync()` built on it would have produced a value `forRoot()` could
 * not consume.
 *
 * Type-level only, and deliberately so: Vitest runs through esbuild, which
 * strips types without checking them, so a runtime test cannot catch this
 * class of regression. `expectTypeOf` assertions are verified by
 * `nx run @vytches/ddd-nestjs:type-check` (tsc). Keep both gates.
 */
import { describe, expectTypeOf, it } from 'vitest';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
import type {
  VytchesDDDModuleAsyncOptions,
  VytchesDDDModuleOptions,
  VytchesDDDOptionsFactory,
} from '../src/types';

type ForRootParam = Parameters<typeof VytchesDDDModule.forRoot>[0];
type FactoryReturn = ReturnType<VytchesDDDOptionsFactory['createVytchesDDDOptions']>;

describe('VF-032a AC5b — forRootAsync factory return type', () => {
  it('the options factory resolves to what forRoot() accepts', () => {
    expectTypeOf<Awaited<FactoryReturn>>().toEqualTypeOf<VytchesDDDModuleOptions>();
    expectTypeOf<Awaited<FactoryReturn>>().toMatchTypeOf<NonNullable<ForRootParam>>();
  });

  it('useFactory resolves to the same type, sync or async', () => {
    type UseFactory = NonNullable<VytchesDDDModuleAsyncOptions['useFactory']>;
    expectTypeOf<Awaited<ReturnType<UseFactory>>>().toEqualTypeOf<VytchesDDDModuleOptions>();
  });

  it('useClass and useExisting both demand the factory contract', () => {
    expectTypeOf<VytchesDDDModuleAsyncOptions['useClass']>().toEqualTypeOf<
      VytchesDDDModuleAsyncOptions['useExisting']
    >();
  });

  it('forFeature() options stay optional — the no-options call must keep compiling', () => {
    expectTypeOf(VytchesDDDModule.forFeature).toBeCallableWith('orders');
  });
});
