import type { IExtendedDomainEvent } from '@vytches/ddd-contracts';

import type { IProjectionEngine } from './projection-interfaces';

/**
 * @llm-summary ProjectionEngineRegistry class for projection engine registry operations
 * @llm-domain Architecture
 * @llm-complexity Simple
 *
 * @description
 * ProjectionEngineRegistry class implementing architectural component for projection engine registry operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ProjectionEngineRegistry();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ProjectionEngineRegistry {
  private engines = new Map<string, IProjectionEngine<unknown>>();

  register<TReadModel>(engine: IProjectionEngine<TReadModel>): this {
    this.engines.set(engine.getProjectionName(), engine);
    return this;
  }

  unregister(projectionName: string): this {
    this.engines.delete(projectionName);
    return this;
  }

  get<TReadModel>(projectionName: string): IProjectionEngine<TReadModel> | undefined {
    return this.engines.get(projectionName) as IProjectionEngine<TReadModel>;
  }

  getAll(): IProjectionEngine<unknown>[] {
    return Array.from(this.engines.values());
  }

  getInterestedEngines(event: IExtendedDomainEvent): IProjectionEngine<unknown>[] {
    return this.getAll().filter(engine => engine.isInterestedIn(event));
  }

  size(): number {
    return this.engines.size;
  }

  clear(): void {
    this.engines.clear();
  }

  has(projectionName: string): boolean {
    return this.engines.has(projectionName);
  }

  getProjectionNames(): string[] {
    return Array.from(this.engines.keys());
  }
}
