/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

import type { IProjectionEngine } from './projection-interfaces';

export class ProjectionEngineRegistry {
  private engines = new Map<string, IProjectionEngine<any>>();

  register<TReadModel>(engine: IProjectionEngine<TReadModel>): this {
    this.engines.set(engine.getProjectionName(), engine);
    return this;
  }

  unregister(projectionName: string): this {
    this.engines.delete(projectionName);
    return this;
  }

  get<TReadModel>(
    projectionName: string,
  ): IProjectionEngine<TReadModel> | undefined {
    return this.engines.get(projectionName) as IProjectionEngine<TReadModel>;
  }

  getAll(): IProjectionEngine<any>[] {
    return Array.from(this.engines.values());
  }

  getInterestedEngines(event: IExtendedDomainEvent): IProjectionEngine<any>[] {
    return this.getAll().filter((engine) => engine.isInterestedIn(event));
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
