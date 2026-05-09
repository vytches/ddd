/**
 * Bare, infrastructure-free base class for domain services — operations
 * that conceptually belong to the domain but don't fit naturally on any
 * single Aggregate or Value Object.
 *
 * Per Eric Evans (Blue Book, ch. 5):
 * > A SERVICE is an operation offered as an interface that stands alone
 * > in the model, with no encapsulated state.
 *
 * `PlainDomainService` is the **minimal baseline** — only `serviceId`,
 * no logger, no event bus, no DI container. Use when you want a stateless
 * domain operation class without pulling the rest of the domain-services
 * machinery (`AsyncDomainService` lifecycle, `EventAwareDomainService`
 * event bus, `UnitOfWorkAwareDomainService` transactional coordination).
 *
 * VF-CANON-001 (2026-05-09): added to close the canonical gap flagged by
 * ddd-compliance-guardian. The library previously offered only the
 * infrastructure-aware variants (which embed a `Logger.forContext` in
 * their base class). For users who don't run a DI container or who want
 * a plain functional baseline, those impose unnecessary infrastructure.
 *
 * Named `PlainDomainService` because `DomainService` is already taken
 * by the auto-discovery decorator from `./domain-service.decorator`.
 *
 * @example
 * ```typescript
 * import { PlainDomainService } from '@vytches/ddd-domain-services';
 *
 * class TaxCalculator extends PlainDomainService {
 *   constructor() {
 *     super('TaxCalculator');
 *   }
 *
 *   calculate(subtotal: number, country: string): number {
 *     // Pure stateless operation — no Aggregate owns this rule because
 *     // it spans Order + Customer.country at minimum.
 *     return subtotal * this.rateFor(country);
 *   }
 *
 *   private rateFor(country: string): number {
 *     return country === 'PL' ? 0.23 : 0.20;
 *   }
 * }
 * ```
 *
 * For services that need lifecycle, events, or transactions, prefer the
 * specialized base classes from `./base-domain-service` (which all extend
 * `IBaseDomainService`). `PlainDomainService` is a deliberate sibling,
 * not a subclass — it omits the `Logger.forContext` baked into
 * `IBaseDomainService` to stay infrastructure-free.
 *
 * @public
 * @stable
 * @since 0.25.0
 */
export abstract class PlainDomainService {
  /**
   * Stable identifier for this service — useful for DI registration,
   * audit trails, and logging from outside the service.
   */
  public readonly serviceId: string;

  constructor(serviceId: string) {
    this.serviceId = serviceId;
  }
}
