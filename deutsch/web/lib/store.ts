import { emptyProgress, parseProgress, type Progress } from "../../shared/progress";

export const STORAGE_KEY = "wortschatz:v1";

/** Minimal slice of `Storage`, so tests can pass a plain object. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // storage blocked (private mode, sandboxed frame)
  }
}

export function loadProgress(storage: KeyValueStore | null = browserStorage()): Progress {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) return parseProgress(JSON.parse(raw)) ?? emptyProgress();
  } catch {
    /* unreadable data starts fresh */
  }
  return emptyProgress();
}

export function saveProgress(progress: Progress, storage: KeyValueStore | null = browserStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* quota or blocked storage: the session still works in memory */
  }
}
