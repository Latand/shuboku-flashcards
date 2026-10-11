import { describe, expect, test } from "bun:test";
import { newCardState, review } from "../../../src/lib/scheduler";
import { emptyProgress, type Progress } from "../../shared/progress";
import { createSync, localOnlyTransport, type SyncStatus, type SyncTransport } from "./sync";

const graded = (id: string, at: number): Progress => {
  const p = emptyProgress();
  p.cards[id] = review(newCardState(at), 4, at);
  return p;
};

function harness(transport: SyncTransport, initial: Progress = emptyProgress()) {
  let local = initial;
  let clock = 1_000_000;
  const timers: { fn: () => void; ms: number; live: boolean }[] = [];
  const statuses: SyncStatus[] = [];
  const merged: Progress[] = [];
  const sync = createSync({
    transport,
    load: () => local,
    save: (p) => void (local = p),
    onMerged: (p) => merged.push(p),
    now: () => clock,
    minGapMs: 15_000,
    timeoutMs: 50,
    setTimer: (fn, ms) => {
      const t = { fn, ms, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => void ((h as { live: boolean }).live = false),
  });
  sync.subscribe((s) => statuses.push(s));
  return {
    sync,
    statuses,
    merged,
    timers,
    get local() {
      return local;
    },
    set local(p: Progress) {
      local = p;
    },
    advance(ms: number) {
      clock += ms;
    },
    fire() {
      const t = timers.filter((x) => x.live).pop();
      if (t) {
        t.live = false;
        t.fn();
      }
    },
  };
}

describe("local-only transport", () => {
  test("never calls out and stays local", async () => {
    let calls = 0;
    const spy: SyncTransport = { ...localOnlyTransport, sync: () => (calls++, Promise.reject(new Error("x"))) };
    const h = harness(spy);
    await h.sync.start();
    h.sync.changed();
    await h.sync.flush();
    expect(calls).toBe(0);
    expect(h.sync.status()).toBe("local");
    expect(h.timers).toHaveLength(0);
    expect(h.local).toEqual(emptyProgress());
  });
});

describe("with a backend", () => {
  test("merges the server copy into local progress", async () => {
    const serverCopy = graded("sein:du-bist", 5000);
    const h = harness({ available: () => true, sync: async () => serverCopy }, graded("sein:ich-bin", 4000));
    await h.sync.start();
    expect(h.sync.status()).toBe("synced");
    expect(Object.keys(h.local.cards).sort()).toEqual(["sein:du-bist", "sein:ich-bin"]);
    expect(h.merged).toHaveLength(1);
    expect(h.statuses).toEqual(["syncing", "synced"]);
  });

  test("a failure goes offline and leaves local progress intact", async () => {
    const mine = graded("sein:ich-bin", 4000);
    const h = harness({ available: () => true, sync: () => Promise.reject(new Error("503")) }, mine);
    await h.sync.start();
    expect(h.sync.status()).toBe("offline");
    expect(h.local).toBe(mine);
    expect(h.merged).toHaveLength(0);
  });

  test("a request that never answers times out", async () => {
    const real = createSync({
      transport: { available: () => true, sync: () => new Promise<Progress>(() => {}) },
      load: emptyProgress,
      save: () => {},
      timeoutMs: 10,
    });
    await real.start();
    expect(real.status()).toBe("offline");
  });

  test("grades made while the request is in flight survive the reply", async () => {
    let release!: (p: Progress) => void;
    const h = harness({
      available: () => true,
      sync: () => new Promise<Progress>((res) => (release = res)),
    });
    const done = h.sync.start();
    h.local = graded("haben:ich-habe", 9000); // graded during the request
    release(graded("sein:ich-bin", 8000));
    await done;
    expect(Object.keys(h.local.cards).sort()).toEqual(["haben:ich-habe", "sein:ich-bin"]);
  });

  test("changes are throttled to one sync per gap", async () => {
    let calls = 0;
    const h = harness({ available: () => true, sync: async (p) => (calls++, p) });
    await h.sync.start();
    expect(calls).toBe(1);
    h.advance(1000);
    h.sync.changed();
    h.sync.changed(); // coalesced
    expect(h.timers.filter((t) => t.live)).toHaveLength(1);
    expect(h.timers.filter((t) => t.live)[0]!.ms).toBe(14_000);
    h.fire();
    await Promise.resolve();
    await h.sync.flush();
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  test("flush cancels the pending timer and syncs now", async () => {
    let calls = 0;
    const h = harness({ available: () => true, sync: async (p) => (calls++, p) });
    h.sync.changed();
    expect(h.timers.some((t) => t.live)).toBe(true);
    await h.sync.flush();
    expect(h.timers.some((t) => t.live)).toBe(false);
    expect(calls).toBe(1);
  });

  test("a flush during a running sync schedules one more run", async () => {
    let calls = 0;
    let release!: () => void;
    const h = harness({
      available: () => true,
      sync: (p) => new Promise<Progress>((res) => {
        calls++;
        release = () => res(p);
      }),
    });
    const first = h.sync.start();
    const second = h.sync.flush();
    release();
    await new Promise((r) => setTimeout(r, 0)); // let the second round start
    release();
    await Promise.all([first, second]);
    expect(calls).toBe(2);
  });
});
