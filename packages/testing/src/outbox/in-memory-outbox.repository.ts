import {
  IOutboxRepository,
  MessagePriority,
  MessageStatus,
  type IOutboxMessage,
} from '@vytches/ddd-messaging';

const DEFAULT_PRIORITY_ORDER: MessagePriority[] = [
  MessagePriority.CRITICAL,
  MessagePriority.HIGH,
  MessagePriority.NORMAL,
  MessagePriority.LOW,
];

export interface InMemoryOutboxRepositoryOptions {
  /**
   * Time source (epoch ms). Inject a controllable clock to make
   * `processAfter` and `resetStaleProcessing` age checks deterministic without
   * global fake timers. Defaults to `Date.now`.
   */
  clock?: () => number;
}

/**
 * In-memory {@link IOutboxRepository} for tests. Implements every abstract
 * method plus `scheduleRetry` and `resetStaleProcessing`, so it can drive a
 * real `OutboxProcessor` end-to-end without a database.
 *
 * Returned messages are shallow copies — mutating them does not corrupt the
 * repository's internal state. Use {@link clear} between tests for isolation.
 */
export class InMemoryOutboxRepository extends IOutboxRepository {
  private readonly messages = new Map<string, IOutboxMessage>();
  /** When each message last entered PROCESSING — drives stale detection. */
  private readonly processingSince = new Map<string, number>();
  private readonly clock: () => number;
  private sequence = 0;

  constructor(options: InMemoryOutboxRepositoryOptions = {}) {
    super();
    this.clock = options.clock ?? Date.now;
  }

  // --- Test helpers -------------------------------------------------------

  /** Snapshot of every stored message (copies). */
  getAll(): IOutboxMessage[] {
    return Array.from(this.messages.values()).map(m => ({ ...m }));
  }

  /** Number of messages currently stored. */
  size(): number {
    return this.messages.size;
  }

  /** Removes all messages — call between tests for isolation. */
  clear(): void {
    this.messages.clear();
    this.processingSince.clear();
    this.sequence = 0;
  }

  // --- IOutboxRepository --------------------------------------------------

  async saveMessage<T = unknown>(message: IOutboxMessage<T>): Promise<string> {
    const id = message.id && message.id.length > 0 ? message.id : `outbox-${++this.sequence}`;
    this.messages.set(id, { ...message, id } as IOutboxMessage);
    return id;
  }

  async saveBatch<T = unknown>(messages: IOutboxMessage<T>[]): Promise<string[]> {
    return Promise.all(messages.map(m => this.saveMessage(m)));
  }

  async getUnprocessedMessages(
    limit = 100,
    priorityOrder: MessagePriority[] = DEFAULT_PRIORITY_ORDER,
    messageTypes?: string[]
  ): Promise<IOutboxMessage[]> {
    const now = this.clock();

    const ready = Array.from(this.messages.values()).filter(
      m =>
        m.status === MessageStatus.PENDING &&
        (m.processAfter === undefined || m.processAfter.getTime() <= now) &&
        (messageTypes === undefined || messageTypes.includes(m.messageType))
    );

    const sorted = ready.sort((a, b) => {
      const aPrio = priorityOrder.indexOf(a.priority ?? MessagePriority.NORMAL);
      const bPrio = priorityOrder.indexOf(b.priority ?? MessagePriority.NORMAL);
      if (aPrio !== bPrio) return aPrio - bPrio;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return sorted.slice(0, limit).map(m => ({ ...m }));
  }

  async getById(id: string): Promise<IOutboxMessage | null> {
    const m = this.messages.get(id);
    return m ? { ...m } : null;
  }

  async updateStatus(id: string, status: MessageStatus, error?: Error): Promise<void> {
    const m = this.messages.get(id);
    if (!m) return;

    this.messages.set(id, {
      ...m,
      status,
      ...(error ? { lastError: error.message } : {}),
    });

    if (status === MessageStatus.PROCESSING) {
      this.processingSince.set(id, this.clock());
    } else {
      this.processingSince.delete(id);
    }
  }

  async updateStatusBatch(ids: string[], status: MessageStatus): Promise<void> {
    for (const id of ids) {
      await this.updateStatus(id, status);
    }
  }

  async incrementAttempt(id: string): Promise<number> {
    const m = this.messages.get(id);
    if (!m) return 0;
    const attempts = m.attempts + 1;
    this.messages.set(id, { ...m, attempts });
    return attempts;
  }

  async deleteByStatusAndAge(olderThan: Date, status: MessageStatus): Promise<number> {
    let deleted = 0;
    for (const [id, m] of this.messages) {
      if (m.status === status && m.createdAt.getTime() < olderThan.getTime()) {
        this.messages.delete(id);
        this.processingSince.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  async scheduleMessage<T = unknown>(
    message: IOutboxMessage<T>,
    processAfter: Date
  ): Promise<string> {
    const id = message.id && message.id.length > 0 ? message.id : `outbox-${++this.sequence}`;
    this.messages.set(id, { ...message, id, processAfter } as IOutboxMessage);
    return id;
  }

  override async scheduleRetry(id: string, processAfter: Date): Promise<void> {
    const m = this.messages.get(id);
    if (!m) return;
    this.messages.set(id, { ...m, status: MessageStatus.PENDING, processAfter });
    this.processingSince.delete(id);
  }

  override async resetStaleProcessing(olderThan: Date): Promise<number> {
    const threshold = olderThan.getTime();
    let reset = 0;

    for (const [id, m] of this.messages) {
      if (m.status !== MessageStatus.PROCESSING) continue;
      const since = this.processingSince.get(id);
      if (since !== undefined && since < threshold) {
        this.messages.set(id, { ...m, status: MessageStatus.PENDING });
        this.processingSince.delete(id);
        reset++;
      }
    }

    return reset;
  }
}
