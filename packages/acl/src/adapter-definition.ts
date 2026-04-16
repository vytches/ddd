import type { IACLAdapter } from './acl.interfaces';

/**
 * Declarative adapter definition for auto-discovery registration.
 * Use with ACLRegistry.fromDefinitions() for zero-boilerplate setup.
 *
 * @public
 * @stable
 * @since 0.24.0
 *
 * @example
 * ```typescript
 * const paymentAdapter = defineACLAdapter({
 *   context: 'payments',
 *   adapter: new PaymentACLAdapter(translator, api),
 *   description: 'Stripe payment gateway integration',
 * });
 *
 * const registry = ACLRegistry.fromDefinitions([
 *   paymentAdapter,
 *   shippingAdapter,
 *   notificationAdapter,
 * ]);
 * ```
 */
export interface AdapterDefinition<TDomain = unknown, TExternal = unknown> {
  readonly context: string;
  readonly adapter: IACLAdapter<TDomain, TExternal>;
  readonly description?: string;
  readonly version?: string;
}

/**
 * Define an ACL adapter for declarative registration.
 *
 * @public
 * @stable
 * @since 0.24.0
 */
export function defineACLAdapter<TDomain = unknown, TExternal = unknown>(
  definition: AdapterDefinition<TDomain, TExternal>
): AdapterDefinition<TDomain, TExternal> {
  return Object.freeze({ ...definition });
}
