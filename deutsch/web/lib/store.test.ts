import { describe, expect, test } from "bun:test";
import { newCardState, review } from "../../../src/lib/scheduler";
import { emptyProgress } from "../../shared/progress";
import { STORAGE_KEY, loadProgress, saveProgress, type KeyValueStore } from "./store";

function memory(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("local store", () => {
  test("starts empty", () => {
    expect(loadProgress(memory())).toEqual(emptyProgress());
    expect(loadProgress(null)).toEqual(emptyProgress());
  });

  test("saves and loads", () => {
    const s = memory();
    const p = emptyProgress();
    p.cards["sein:ich-bin"] = review(newCardState(1000), 4, 1000);
    saveProgress(p, s);
    expect(loadProgress(s)).toEqual(p);
  });

  test("corrupt data starts fresh instead of throwing", () => {
    expect(loadProgress(memory({ [STORAGE_KEY]: "{oops" }))).toEqual(emptyProgress());
    expect(loadProgress(memory({ [STORAGE_KEY]: '{"version":7}' }))).toEqual(emptyProgress());
  });

  test("a storage that throws on write is survivable", () => {
    const broken: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(() => saveProgress(emptyProgress(), broken)).not.toThrow();
  });
});
