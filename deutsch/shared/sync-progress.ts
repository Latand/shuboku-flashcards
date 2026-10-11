import { mergeProgress, type Progress } from "./progress";

export interface ProgressSnapshot {
  data: Progress;
}

/** Storage operations must make insertIfAbsent and compareAndSet atomic. */
export interface ProgressStore {
  read(userId: number): Promise<ProgressSnapshot | null>;
  insertIfAbsent(userId: number, data: Progress, updatedAt: number): Promise<boolean>;
  compareAndSet(userId: number, expected: Progress, data: Progress, updatedAt: number): Promise<boolean>;
}

/** Merge against the latest stored copy, retrying whenever another request wins the write race. */
export async function syncProgress(
  store: ProgressStore,
  userId: number,
  incoming: Progress,
  now: () => number = Date.now
): Promise<Progress> {
  for (;;) {
    const existing = await store.read(userId);
    const merged = mergeProgress(existing?.data ?? null, incoming);
    if (existing && JSON.stringify(existing.data) === JSON.stringify(merged)) return merged;

    const updatedAt = now();
    if (existing) {
      if (await store.compareAndSet(userId, existing.data, merged, updatedAt)) return merged;
    } else if (await store.insertIfAbsent(userId, merged, updatedAt)) {
      return merged;
    }
  }
}
