/*
 * Client-side seam for syncing progress with a server.
 *
 * The engine knows nothing about any backend. It talks to a `SyncTransport`:
 * hand it the local progress, get back the server's merged copy. The default
 * `localOnlyTransport` reports itself unavailable, so the app studies and
 * saves on this device only and never makes a request. A backend integration
 * adds a transport and passes it to `createSync`; nothing else changes.
 *
 * Merging is always `mergeProgress`, so a failed, late or repeated sync can
 * only add information, never remove it.
 */

import { mergeProgress, type Progress } from "../../shared/progress";

export type SyncStatus = "local" | "syncing" | "synced" | "offline";

export interface SyncTransport {
  /** False when no backend can be reached from here (outside Telegram, or not built yet). */
  available(): boolean;
  /** Send the full local progress; resolve with the server's merged copy, reject on any failure. */
  sync(local: Progress): Promise<Progress>;
}

export const localOnlyTransport: SyncTransport = {
  available: () => false,
  sync: () => Promise.reject(new Error("local-only: no backend configured")),
};

export interface SyncOptions {
  transport: SyncTransport;
  load(): Progress;
  /** Persist the merged result. */
  save(progress: Progress): void;
  /** Called after a sync changed local progress, so the UI can redraw. */
  onMerged?(progress: Progress): void;
  now?(): number;
  /** Minimum gap between two syncs started by `changed()`. */
  minGapMs?: number;
  timeoutMs?: number;
  setTimer?(fn: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
}

export interface Sync {
  status(): SyncStatus;
  subscribe(listener: (status: SyncStatus) => void): () => void;
  /** Sync once at startup. */
  start(): Promise<void>;
  /** Local progress changed: sync soon, at most once per `minGapMs`. */
  changed(): void;
  /** Sync now (tab hidden, page closing). */
  flush(): Promise<void>;
}

export const SYNC_GAP_MS = 15_000;
export const SYNC_TIMEOUT_MS = 15_000;

export function createSync(options: SyncOptions): Sync {
  const {
    transport,
    load,
    save,
    onMerged,
    now = Date.now,
    minGapMs = SYNC_GAP_MS,
    timeoutMs = SYNC_TIMEOUT_MS,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  } = options;

  let status: SyncStatus = "local";
  let running: Promise<void> | null = null;
  let again = false;
  let lastStart = -Infinity;
  let timer: unknown = null;
  const listeners = new Set<(s: SyncStatus) => void>();

  const set = (next: SyncStatus) => {
    if (next === status) return;
    status = next;
    for (const l of listeners) l(status);
  };

  function withTimeout<T>(p: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimer(() => reject(new Error("sync timed out")), timeoutMs);
      p.then(
        (v) => (clearTimer(t), resolve(v)),
        (e) => (clearTimer(t), reject(e))
      );
    });
  }

  async function runOnce(): Promise<void> {
    if (!transport.available()) {
      set("local");
      return;
    }
    lastStart = now();
    set("syncing");
    try {
      const remote = await withTimeout(transport.sync(load()));
      // Read local again: the learner may have graded cards while the request was in flight.
      const merged = mergeProgress(remote, load());
      save(merged);
      onMerged?.(merged);
      set("synced");
    } catch {
      set("offline");
    }
  }

  function flush(): Promise<void> {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await runOnce();
        } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    status: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    start: flush,
    changed() {
      if (!transport.available()) {
        set("local");
        return;
      }
      if (timer !== null) return;
      const wait = Math.max(0, lastStart + minGapMs - now());
      timer = setTimer(() => {
        timer = null;
        void flush();
      }, wait);
    },
    flush,
  };
}
