import { describe, expect, test } from "bun:test";
import { newCardState, review, type CardState, type Grade } from "./scheduler";
import {
  BASELINE_WINDOW,
  DEFAULT_BASELINE_MS,
  MIN_BASELINE_SAMPLES,
  STALE_THINK_MS,
  baselineThinkMs,
  familiarity,
  rememberThinkTime,
  suggestGrade,
} from "./suggest";

const T0 = Date.UTC(2026, 0, 1);

/** A card carried through a sequence of grades, each review on schedule. */
function afterGrades(grades: Grade[]): CardState {
  let state = newCardState(T0);
  let now = T0;
  for (const g of grades) {
    now = Math.max(now, state.timeToReview);
    state = review(state, g, now);
  }
  return state;
}

describe("the personal baseline", () => {
  test("falls back to the default until enough recalls are measured", () => {
    expect(baselineThinkMs(undefined)).toBe(DEFAULT_BASELINE_MS);
    expect(baselineThinkMs([3000, 3000, 3000, 3000])).toBe(DEFAULT_BASELINE_MS);
    expect(baselineThinkMs(new Array(MIN_BASELINE_SAMPLES).fill(3000))).toBe(3000);
  });

  test("takes the median, so one distracted card cannot move it", () => {
    expect(baselineThinkMs([2000, 2500, 3000, 3500, 40_000])).toBe(3000);
  });

  test("records successful recalls only, within the usable window", () => {
    expect(rememberThinkTime([], 4200, 4)).toEqual([4200]);
    expect(rememberThinkTime([], 4200, 2)).toEqual([]); // a miss times a blank stare
    expect(rememberThinkTime([], 4200, 6)).toEqual([]); // retiring is not recall
    expect(rememberThinkTime([], 120, 5)).toEqual([]); // reflex, not recall
    expect(rememberThinkTime([], STALE_THINK_MS, 5)).toEqual([]); // parked card
  });

  test("keeps a moving window instead of a lifetime average", () => {
    let samples: number[] = [];
    for (let i = 0; i < BASELINE_WINDOW + 10; i++) samples = rememberThinkTime(samples, 1000 + i, 4);
    expect(samples.length).toBe(BASELINE_WINDOW);
    expect(samples[samples.length - 1]).toBe(1000 + BASELINE_WINDOW + 9);
  });
});

describe("what the card's history says", () => {
  test("a card never graded before has no track record", () => {
    expect(familiarity(undefined)).toBe("new");
    expect(familiarity(newCardState(T0))).toBe("new");
  });

  test("a struggle or a high difficulty marks the card hard", () => {
    expect(familiarity(afterGrades([3]))).toBe("hard");
    expect(familiarity(afterGrades([0, 0, 4]))).toBe("hard");
  });

  test("repeated easy recall marks the card easy", () => {
    expect(familiarity(afterGrades([5, 5]))).toBe("easy");
  });
});

describe("suggesting a grade from the pause", () => {
  const baselineMs = 6000;

  test("over a minute carries no signal and keeps the middle grade", () => {
    const s = suggestGrade({ thinkMs: 61_000, state: afterGrades([5, 5]), baselineMs });
    expect(s.grade).toBe(3);
    expect(s.pace).toBe("stalled");
    expect(s.hint).toBe("over a minute · middle grade");
  });

  test("an easy card answered fast opens on a confident grade", () => {
    const s = suggestGrade({ thinkMs: 2000, state: afterGrades([5, 5]), baselineMs });
    expect(s.grade).toBe(5);
    expect(s.pace).toBe("quick");
    expect(s.hint).toContain("2.0s");
  });

  test("a hard card answered fast reads as progress, not mastery", () => {
    const s = suggestGrade({ thinkMs: 2000, state: afterGrades([3]), baselineMs });
    expect(s.familiarity).toBe("hard");
    expect(s.grade).toBe(4);
    expect(s.hint).toContain("faster than this card used to be");
  });

  test("a long pause under a minute hints that it was hard", () => {
    const s = suggestGrade({ thinkMs: 30_000, state: afterGrades([3]), baselineMs });
    expect(s.grade).toBe(3);
    expect(s.pace).toBe("effort");
    expect(s.hint).toContain("still a hard one");
  });

  test("a hard card at its usual pace stays at the middle grade", () => {
    // 9.6 s is exactly the pace a hard card is expected to need.
    const s = suggestGrade({ thinkMs: 9600, state: afterGrades([3]), baselineMs });
    expect(s.pace).toBe("steady");
    expect(s.grade).toBe(3);
  });

  test("a first meeting is never confident, however fast the answer came", () => {
    const s = suggestGrade({ thinkMs: 700, state: undefined, baselineMs });
    expect(s.grade).toBe(4);
  });

  test("an instant reveal is treated as no answer at all", () => {
    const s = suggestGrade({ thinkMs: 120, state: afterGrades([5, 5]), baselineMs });
    expect(s.pace).toBe("reflex");
    expect(s.grade).toBe(3);
  });

  test("never suggests a failing grade or a retire", () => {
    const states = [undefined, newCardState(T0), afterGrades([3]), afterGrades([5, 5])];
    const times = [0, 500, 1000, 5000, 20_000, 59_000, 120_000];
    for (const state of states) {
      for (const thinkMs of times) {
        const { grade } = suggestGrade({ thinkMs, state, baselineMs });
        expect(grade).toBeGreaterThanOrEqual(3);
        expect(grade).toBeLessThanOrEqual(5);
      }
    }
  });

  test("scales with the person, not with a fixed number of seconds", () => {
    const state = afterGrades([5, 5]);
    // The same 8 s pause is quick for a slow grader and effortful for a fast one.
    expect(suggestGrade({ thinkMs: 8000, state, baselineMs: 20_000 }).pace).toBe("quick");
    expect(suggestGrade({ thinkMs: 8000, state, baselineMs: 2000 }).pace).toBe("effort");
  });
});
