/**
 * Single reader for the `di:*` handler metadata written by the CQRS decorators.
 *
 * VF-032b AC2. Before this, `VytchesExplorerService` and
 * `FeatureHandlerRegistrar` each open-coded the same
 * `Reflect.getMetadata('di:handler-type', …)` sequence, so a change to the
 * metadata shape had to be applied twice and stayed correct only by luck.
 *
 * **Why `CQRSDiscoveryPlugin` is deliberately NOT collapsed into this.** It
 * looks like a third copy but scans a different thing: it walks
 * `Object.entries(moduleNamespace)` over an ES-module's exports and requires
 * `di:registration-pending`, whereas both NestJS scanners walk NestJS's own DI
 * graph (`DiscoveryService.getProviders()` / `Module.providers`) where that
 * flag never applies. The traversal, the input type and the filtering rules all
 * differ; only the per-class metadata read is shared, and that is exactly what
 * this module extracts. Merging the traversals would mean teaching the CQRS
 * package about NestJS internals — a package-boundary violation for a
 * framework-agnostic core package.
 */

// Class constructor reference — intentional Function usage, matching the
// ledger's ClassRef convention.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type ClassRef = Function;

/** Handler kinds the CQRS decorators emit. */
export type DiHandlerKind = 'command' | 'query' | 'event' | 'domain-service';

/** Normalized result of reading the `di:*` metadata off a handler class. */
export interface DiHandlerMetadata {
  readonly kind: DiHandlerKind;
  readonly messageType: ClassRef;
  /**
   * `'global'` handlers deliberately bypass per-context registration and stay
   * on the root buses; anything else is context-scoped.
   */
  readonly scope: string;
}

const DI_HANDLER_TYPE = 'di:handler-type';
const DI_HANDLER_METADATA = 'di:handler-metadata';
const DI_HANDLER_SCOPE = 'di:handler-scope';

const KINDS: readonly string[] = ['command', 'query', 'event', 'domain-service'];

/**
 * Reads the `di:*` metadata off a candidate class.
 *
 * Returns `null` when the class carries no usable handler metadata — callers
 * treat that as "not a handler" rather than as an error, since both scanners
 * run over every provider in reach.
 */
export function readDiHandlerMetadata(target: unknown): DiHandlerMetadata | null {
  if (typeof target !== 'function') return null;

  const kind = Reflect.getMetadata(DI_HANDLER_TYPE, target) as string | undefined;
  if (!kind || !KINDS.includes(kind)) return null;

  const metadata = Reflect.getMetadata(DI_HANDLER_METADATA, target) as
    | { messageType?: ClassRef }
    | undefined;
  if (!metadata?.messageType) return null;

  const scope = (Reflect.getMetadata(DI_HANDLER_SCOPE, target) as string | undefined) ?? 'context';

  return { kind: kind as DiHandlerKind, messageType: metadata.messageType, scope };
}
