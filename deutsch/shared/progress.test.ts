import { describe, expect, test } from "bun:test";
import { newCardState, review, type CardState, type Grade } from "../../src/lib/scheduler";
import {
  cardChangedAt,
  emptyProgress,
  isPackOn,
  mergeProgress,
  parseProgress,
  type Progress,
} from "./progress";

const T0 = Date.UTC(2026, 9, 1);
const DAY = 86_400_000;

/** Small deterministic generator, so a failure is reproducible. */
function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

function randomProgress(rand: () => number): Progress {
  const p = emptyProgress();
  const ids = ["pronomen:ich", "pronomen:du", "sein:ich-bin", "haben:ich-habe", "essen:brot"];
  for (const id of ids) {
    if (rand() < 0.4) continue;
    let state: CardState = newCardState(T0);
    const reviews = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < reviews; i++) {
      const grade = ([1, 3, 4, 5, 6] as Grade[])[Math.floor(rand() * 5)]!;
      state = review(state, grade, T0 + Math.floor(rand() * 20) * DAY);
    }
    p.cards[id] = state;
  }
  for (const id of ["pronomen", "sein", "haben", "essen"]) {
    if (rand() < 0.5) p.packs[id] = { on: rand() < 0.5, at: Math.floor(rand() * 4) };
  }
  p.settings = { direction: rand() < 0.5 ? "de-uk" : "uk-de", at: Math.floor(rand() * 3) };
  return p;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe("mergeProgress", () => {
  test("is commutative, idempotent and associative", () => {
    const rand = lcg(7);
    for (let i = 0; i < 200; i++) {
      const [a, b, c] = [randomProgress(rand), randomProgress(rand), randomProgress(rand)];
      expect(clone(mergeProgress(a, b))).toEqual(clone(mergeProgress(b, a)));
      expect(clone(mergeProgress(a, a))).toEqual(clone(a));
      expect(clone(mergeProgress(mergeProgress(a, b), c))).toEqual(clone(mergeProgress(a, mergeProgress(b, c))));
    }
  });

  test("never loses a card, a pack flag or its progress", () => {
    const rand = lcg(11);
    for (let i = 0; i < 100; i++) {
      const [a, b] = [randomProgress(rand), randomProgress(rand)];
      const m = mergeProgress(a, b);
      for (const id of [...Object.keys(a.cards), ...Object.keys(b.cards)]) {
        expect(m.cards[id]).toBeDefined();
        const best = Math.max(a.cards[id]?.totalRepetitions ?? 0, b.cards[id]?.totalRepetitions ?? 0);
        expect(m.cards[id]!.totalRepetitions).toBeGreaterThanOrEqual(Math.min(best, 1));
      }
      for (const id of [...Object.keys(a.packs), ...Object.keys(b.packs)]) expect(m.packs[id]).toBeDefined();
    }
  });

  test("an empty device cannot erase saved progress", () => {
    const rand = lcg(3);
    for (let i = 0; i < 50; i++) {
      const full = randomProgress(rand);
      expect(clone(mergeProgress(full, emptyProgress()))).toEqual(clone(mergeProgress(emptyProgress(), full)));
      const m = mergeProgress(emptyProgress(), full);
      expect(Object.keys(m.cards).sort()).toEqual(Object.keys(full.cards).sort());
      expect(m.cards).toEqual(full.cards);
    }
  });

  test("a null side returns the other", () => {
    const p = randomProgress(lcg(1));
    expect(mergeProgress(null, p)).toBe(p);
  });

  test("the more recently graded state wins, even for grade 6", () => {
    const base = review(newCardState(T0), 4, T0);
    const older = review(base, 4, T0 + 3 * DAY);
    const newer = review(older, 6, T0 + 9 * DAY); // retiring keeps lastReview old but extends history
    expect(newer.lastReview).toBe(older.lastReview);
    expect(cardChangedAt(newer)).toBe(T0 + 9 * DAY);
    const a = emptyProgress();
    const b = emptyProgress();
    a.cards["sein:ich-bin"] = older;
    b.cards["sein:ich-bin"] = newer;
    expect(mergeProgress(a, b).cards["sein:ich-bin"]).toEqual(newer);
    expect(mergeProgress(b, a).cards["sein:ich-bin"]).toEqual(newer);
  });

  test("states equal in time fall back to the one with more repetitions", () => {
    const x = { ...review(newCardState(T0), 4, T0), totalRepetitions: 3 };
    const y = { ...x, totalRepetitions: 2 };
    const a = emptyProgress();
    const b = emptyProgress();
    a.cards["haben:ich-habe"] = y;
    b.cards["haben:ich-habe"] = x;
    expect(mergeProgress(a, b).cards["haben:ich-habe"]!.totalRepetitions).toBe(3);
  });

  test("pack flags: newer wins, a tie keeps the pack on", () => {
    const a = emptyProgress();
    const b = emptyProgress();
    a.packs.essen = { on: true, at: 5 };
    b.packs.essen = { on: false, at: 9 };
    expect(mergeProgress(a, b).packs.essen).toEqual({ on: false, at: 9 });
    b.packs.essen = { on: false, at: 5 };
    expect(mergeProgress(a, b).packs.essen!.on).toBe(true);
    expect(mergeProgress(b, a).packs.essen!.on).toBe(true);
  });

  test("settings: newer wins", () => {
    const a = emptyProgress();
    const b = emptyProgress();
    a.settings = { direction: "uk-de", at: 2 };
    b.settings = { direction: "de-uk", at: 1 };
    expect(mergeProgress(a, b).settings.direction).toBe("uk-de");
    expect(mergeProgress(b, a).settings.direction).toBe("uk-de");
  });
});

describe("isPackOn", () => {
  test("untouched packs follow the defaults", () => {
    const p: Progress = { ...emptyProgress(), packs: {} };
    expect(isPackOn(p, "pronomen")).toBe(true);
    expect(isPackOn(p, "sein")).toBe(true);
    expect(isPackOn(p, "essen")).toBe(false);
  });

  test("an explicit flag beats the default", () => {
    const p = emptyProgress();
    p.packs.sein = { on: false, at: 3 };
    expect(isPackOn(p, "sein")).toBe(false);
  });
});

describe("parseProgress", () => {
  test("round-trips a valid progress object", () => {
    const rand = lcg(5);
    for (let i = 0; i < 30; i++) {
      const p = randomProgress(rand);
      expect(parseProgress(clone(p))).toEqual(clone(p));
    }
  });

  test("rejects non-objects and other versions", () => {
    for (const x of [null, undefined, 5, "x", [], { version: 2 }, {}]) expect(parseProgress(x)).toBeNull();
  });

  test("drops broken entries and keeps the rest", () => {
    const good = review(newCardState(T0), 4, T0);
    const parsed = parseProgress({
      version: 1,
      packs: { essen: { on: true, at: 1 }, "BAD KEY": { on: true, at: 1 }, dinge: { on: "yes", at: 1 } },
      cards: {
        "sein:ich-bin": good,
        "sein:du-bist": { interval: "soon" },
        "not a card id": good,
        "sein:wir-sind": null,
      },
      settings: { direction: "sideways", at: 4 },
    })!;
    expect(Object.keys(parsed.packs)).toEqual(["essen"]);
    expect(Object.keys(parsed.cards)).toEqual(["sein:ich-bin"]);
    expect(parsed.settings).toEqual({ direction: "de-uk", at: 0 });
  });

  test("caps valid history and rejects a card with malformed history", () => {
    const base = review(newCardState(T0), 4, T0);
    const history = Array.from({ length: 70 }, (_, i) => ({ at: T0 + i, grade: 4 }));
    const parsed = parseProgress({ version: 1, cards: { "sein:ich-bin": { ...base, history } } })!;
    expect(parsed.cards["sein:ich-bin"]!.history).toHaveLength(50);
    const malformed = parseProgress({ version: 1, cards: { "sein:ich-bin": { ...base, history: [...history, { at: "x", grade: 4 }] } } })!;
    expect(malformed.cards).toEqual({});
  });

  test("rejects impossible counters, intervals and distant review timestamps", () => {
    const valid = review(newCardState(T0), 4, T0);
    const invalidStates = [
      { ...valid, interval: -50 },
      { ...valid, nRepetitions: -1 },
      { ...valid, totalRepetitions: -1 },
      { ...valid, lastReview: 9_007_199_254_740_000, history: [{ at: 9_007_199_254_740_000, grade: 4 }] },
    ];
    for (const state of invalidStates) {
      const parsed = parseProgress({ version: 1, cards: { "sein:ich-bin": state } })!;
      expect(parsed.cards["sein:ich-bin"]).toBeUndefined();
      expect(mergeProgress({ ...emptyProgress(), cards: { "sein:ich-bin": valid } }, parsed).cards["sein:ich-bin"]).toEqual(valid);
    }
  });

  test("does not copy unknown fields", () => {
    const base = review(newCardState(T0), 4, T0);
    const parsed = parseProgress({ version: 1, cards: { "sein:ich-bin": { ...base, junk: "x".repeat(1000) } } })!;
    expect("junk" in parsed.cards["sein:ich-bin"]!).toBe(false);
  });
});
