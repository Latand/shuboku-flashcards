import { describe, expect, test } from "bun:test";
import {
  DAY_MS,
  HISTORY_LIMIT,
  newCardState,
  review,
  recallProbability,
  isDue,
  type CardState,
} from "./scheduler";

const T0 = Date.UTC(2026, 0, 1);

/** Run a sequence of grades, each review happening exactly on schedule. */
function run(grades: number[], start = T0) {
  let state = newCardState(start);
  let now = start;
  const intervals: number[] = [];
  for (const g of grades) {
    now = Math.max(now, state.timeToReview);
    state = review(state, g as 0 | 1 | 2 | 3 | 4 | 5 | 6, now);
    intervals.push(state.interval);
  }
  return { state, intervals, now };
}

describe("new cards", () => {
  test("start due immediately with an empty memory model", () => {
    const s = newCardState(T0);
    expect(s.schedulerVersion).toBe(1);
    expect(s.stability).toBe(0);
    expect(s.difficulty).toBe(0);
    expect(s.interval).toBe(0);
    expect(s.nRepetitions).toBe(0);
    expect(isDue(s, T0)).toBe(true);
  });
});

describe("the seven-grade interface", () => {
  test("maps failed recall to Again and successful effort to Hard, Good, or Easy", () => {
    const intervals = [0, 1, 2, 3, 4, 5].map(
      (grade) => review(newCardState(T0), grade as 0 | 1 | 2 | 3 | 4 | 5, T0).interval
    );
    expect(intervals).toEqual([1, 1, 1, 2, 3, 8]);
  });

  test("starts every new interval at the review moment", () => {
    const { state, now } = run([5, 5]);
    expect(state.intervalStart).toBe(now);
    expect(state.lastReview).toBe(now);
    expect(state.timeToReview).toBe(now + state.interval * DAY_MS);
  });

  test("grows a solid memory from days to weeks", () => {
    const { intervals, state } = run([4, 4, 4]);
    expect(intervals).toEqual([3, 14, 57]);
    expect(state.difficulty).toBeGreaterThanOrEqual(1);
    expect(state.difficulty).toBeLessThanOrEqual(10);
    expect(state.stability).toBeCloseTo(56.95670978, 8);
  });
});

describe("failure (grade < 3)", () => {
  test("starts a new success streak while preserving residual long-term memory", () => {
    const { state: learned } = run([5, 5, 5]);
    const state = review(learned, 1, learned.timeToReview);
    expect(state.nRepetitions).toBe(0);
    expect(state.stability).toBeGreaterThan(0);
    expect(state.stability).toBeLessThan(learned.stability!);
    expect(state.lapses).toBe(1);
    expect(state.totalRepetitions).toBe(4);
    expect(state.lastGrade).toBe(1);
  });

  test("treats grades 0–2 as honest failed recalls without losing the label", () => {
    const misses = [0, 1, 2].map((grade) =>
      review(newCardState(T0), grade as 0 | 1 | 2, T0)
    );
    expect(misses.map((s) => s.interval)).toEqual([1, 1, 1]);
    expect(misses.map((s) => s.stability)).toEqual([
      misses[0].stability,
      misses[0].stability,
      misses[0].stability,
    ]);
    expect(misses.map((s) => s.lastGrade)).toEqual([0, 1, 2]);
  });
});

describe("retention target", () => {
  test("lets a higher target shorten future intervals", () => {
    const balanced = review(newCardState(T0), 5, T0, 0.9);
    const cautious = review(newCardState(T0), 5, T0, 0.95);
    expect(balanced.interval).toBe(8);
    expect(cautious.interval).toBe(4);
  });

  test("falls back safely when a direct caller supplies an invalid target", () => {
    expect(review(newCardState(T0), 5, T0, Number.NaN).interval).toBe(8);
  });
});

describe("grade 6 retires the card", () => {
  test("card leaves rotation, state is preserved", () => {
    const { state: learned } = run([5, 5]);
    const retired = review(learned, 6, T0 + 30 * DAY_MS);
    expect(retired.retired).toBe(true);
    expect(retired.lastGrade).toBe(6);
    expect(retired.interval).toBe(learned.interval);
    expect(retired.nRepetitions).toBe(learned.nRepetitions);
    expect(retired.totalRepetitions).toBe(learned.totalRepetitions + 1);
    expect(isDue(retired, T0 + 400 * DAY_MS)).toBe(false);
  });
});

describe("late reviews", () => {
  test("rewards a difficult late success through lower retrievability", () => {
    const { state } = run([4, 4]);
    const onTime = review(state, 4, state.timeToReview);
    const lateAt = state.timeToReview + 30 * DAY_MS;
    const late = review(state, 4, lateAt);

    expect(recallProbability(state, lateAt)).toBeLessThan(
      recallProbability(state, state.timeToReview)!
    );
    expect(late.stability).toBeGreaterThan(onTime.stability!);
    expect(late.interval).toBeGreaterThan(onTime.interval);
    expect(late.timeToReview).toBe(lateAt + late.interval * DAY_MS);
  });

  test("restarts the forgetting curve after every review", () => {
    const { state } = run([4, 4]);
    const lateAt = state.timeToReview + 20 * DAY_MS;
    const next = review(state, 4, lateAt);

    expect(next.intervalStart).toBe(lateAt);
    expect(next.lastReview).toBe(lateAt);
    expect(recallProbability(next, lateAt)).toBe(1);
    expect(recallProbability(next, next.timeToReview)).toBeCloseTo(0.9, 2);
  });

  test("an early review does not shrink the stored interval", () => {
    const { state, now } = run([4, 4]);
    const early = now + 1 * DAY_MS;
    const next = review(state, 5, early);
    expect(next.stability).toBeGreaterThanOrEqual(state.stability!);
    expect(next.interval).toBeGreaterThanOrEqual(state.interval);
  });
});

describe("the record of past grades", () => {
  test("keeps every grade in the order they were given", () => {
    const { state } = run([1, 3, 4, 5]);
    expect(state.history?.map((h) => h.grade)).toEqual([1, 3, 4, 5]);
  });

  test("stamps each grade with the moment of that review", () => {
    const { state } = run([4, 4]);
    const times = state.history!.map((h) => h.at);
    expect(times[1]).toBeGreaterThan(times[0]);
    expect(times[1]).toBe(state.lastReview!);
  });

  test("records retiring the card, since that is a judgement too", () => {
    const { state } = run([4, 6]);
    expect(state.history?.map((h) => h.grade)).toEqual([4, 6]);
    expect(state.retired).toBe(true);
  });

  test("remembers a bounded number of reviews, keeping the recent ones", () => {
    const { state } = run(new Array(HISTORY_LIMIT + 6).fill(4));
    expect(state.history).toHaveLength(HISTORY_LIMIT);
    expect(state.totalRepetitions).toBe(HISTORY_LIMIT + 6);
  });
});

describe("migration from Shuboku 0.1", () => {
  test("upgrades legacy SM-2 state on its next review without discarding progress", () => {
    const legacy: CardState = {
      nRepetitions: 4,
      easinessFactor: 2.4,
      interval: 30,
      intervalStart: T0,
      timeToReview: T0 + 30 * DAY_MS,
      totalRepetitions: 7,
      lastGrade: 4,
      retired: false,
    };

    const next = review(legacy, 4, legacy.timeToReview);
    expect(next.schedulerVersion).toBe(1);
    expect(next.totalRepetitions).toBe(8);
    expect(next.stability).toBeGreaterThan(legacy.interval);
    expect(next.interval).toBeGreaterThan(legacy.interval);
  });
});

describe("due detection", () => {
  test("due exactly at time_to_review, not before", () => {
    const s: CardState = { ...newCardState(T0), timeToReview: T0 + DAY_MS };
    expect(isDue(s, T0)).toBe(false);
    expect(isDue(s, T0 + DAY_MS)).toBe(true);
    expect(isDue(undefined, T0)).toBe(false);
  });
});
