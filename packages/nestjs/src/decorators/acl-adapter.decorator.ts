import 'reflect-metadata';
import { ACL_ADAPTER_METADATA } from '../constants';

/**
 * Metadata stored by @ACLAdapterFor decorator.
 */
export interface ACLAdapterMetadata {
  contextName: string;
  description?: string;
  version?: string;
}

/**
 * Marks a class as an ACL adapter for auto-discovery by VytchesExplorerService.
 * The adapter will be automatically registered with ACLRegistry on module init.
 *
 * @public
 * @stable
 * @since 0.24.0
 *
 * @param contextName - The bounded context this adapter bridges to
 * @param options - Optional description and version
 *
 * @example
 * ```typescript
 * @ACLAdapterFor('payments', { description: 'Stripe integration' })
 * @Injectable()
 * class PaymentACLAdapter extends BaseACLAdapter<Order, StripeCharge, ChargeResult> {
 *   // ...
 * }
 *
 * @Module({
 *   imports: [VytchesDDDModule.forRoot()],
 *   providers: [PaymentACLAdapter],
 * })
 * export class PaymentsModule {}
 * // PaymentACLAdapter auto-registered in ACLRegistry as 'payments'
 * ```
 */
export function ACLAdapterFor(
  contextName: string,
  options?: { description?: string; version?: string }
): ClassDecorator {
  return (target: object) => {
    const metadata: ACLAdapterMetadata = {
      contextName,
      description: options?.description,
      version: options?.version ?? '1.0.0',
    };
    Reflect.defineMetadata(ACL_ADAPTER_METADATA, metadata, target);
  };
}
