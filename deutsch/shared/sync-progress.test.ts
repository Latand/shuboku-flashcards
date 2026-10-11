import { describe, expect, test } from "bun:test";
import { newCardState, review } from "../../src/lib/scheduler";
import { emptyProgress, type Progress } from "./progress";
import { syncProgress, type ProgressSnapshot, type ProgressStore } from "./sync-progress";

const T0 = Date.UTC(2026, 8, 1);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function card(id: string): Progress {
  const state = review(newCardState(T0), 4, T0 + 1_000);
  return { ...emptyProgress(), cards: { [id]: state } };
}

class RacingStore implements ProgressStore {
  row: ProgressSnapshot;
  private reads = 0;
  private releaseReads!: () => void;
  private readonly bothRead = new Promise<void>((resolve) => { this.releaseReads = resolve; });

  constructor(initial: Progress) {
    this.row = { data: clone(initial) };
  }

  async read(): Promise<ProgressSnapshot> {
    const snapshot = clone(this.row);
    if (this.reads++ < 2) {
      if (this.reads === 2) this.releaseReads();
      await this.bothRead;
      return snapshot;
    }
    return snapshot;
  }

  async insertIfAbsent(_userId: number, data: Progress): Promise<boolean> {
    if (this.row) return false;
    this.row = { data: clone(data) };
    return true;
  }

  async compareAndSet(_userId: number, expected: Progress, data: Progress): Promise<boolean> {
    if (JSON.stringify(this.row.data) !== JSON.stringify(expected)) return false;
    this.row = { data: clone(data) };
    return true;
  }
}

describe("syncProgress", () => {
  test("retries a stale write so concurrent card updates both survive", async () => {
    const baseline = emptyProgress();
    const store = new RacingStore(baseline);
    const [resultA, resultB] = await Promise.all([
      syncProgress(store, 17, card("pronomen:ich"), () => T0),
      syncProgress(store, 17, card("sein:ich-bin"), () => T0 + 1),
    ]);

    // One caller may respond with the snapshot it successfully wrote. A later
    // sync reads the canonical row and must include both racing changes.
    for (const id of ["pronomen:ich", "sein:ich-bin"]) {
      expect(resultA.cards[id] ?? resultB.cards[id]).toBeDefined();
    }
    const later = await syncProgress(store, 17, emptyProgress(), () => T0 + 2);
    expect(Object.keys(later.cards).sort()).toEqual(["pronomen:ich", "sein:ich-bin"]);
  });
});
