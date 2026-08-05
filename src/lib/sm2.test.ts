import { describe, expect, test } from "bun:test";
import { DAY_MS, newCardState, review, isDue, type CardState } from "./sm2";

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
  test("start due immediately with EF 2.5, interval 0", () => {
    const s = newCardState(T0);
    expect(s.easinessFactor).toBe(2.5);
    expect(s.interval).toBe(0);
    expect(s.nRepetitions).toBe(0);
    expect(isDue(s, T0)).toBe(true);
  });
});

describe("successful repetitions (grade 5 on schedule)", () => {
  test("interval sequence 1, 6, then interval × EF", () => {
    // EF grows 2.5 → 2.6 → 2.7 across the first two reviews, so the third
    // interval is round(6 × 2.7) = 16. (The textbook SM-2 example quotes
    // 1, 6, 15 — that assumes a constant EF of 2.5; this port applies the
    // EF update on every review, exactly like reference/supermemo.py.)
    const { intervals, state } = run([5, 5, 5]);
    expect(intervals).toEqual([1, 6, 16]);
    expect(state.nRepetitions).toBe(3);
    expect(state.easinessFactor).toBeCloseTo(2.8, 10);
  });

  test("time_to_review lands interval days ahead and interval_start resets", () => {
    const { state, now } = run([5, 5]);
    expect(state.intervalStart).toBe(now);
    expect(state.timeToReview).toBe(now + 6 * DAY_MS);
  });
});

describe("failure (grade < 3)", () => {
  test("resets repetitions and interval to 1, but keeps total count", () => {
    const { state } = run([5, 5, 5, 1]);
    expect(state.nRepetitions).toBe(0);
    expect(state.interval).toBe(1);
    expect(state.totalRepetitions).toBe(4);
    expect(state.lastGrade).toBe(1);
  });

  test("EF is punished on failure too", () => {
    const before = newCardState(T0);
    const after = review(before, 0, T0);
    // 2.5 + 0.1 - 5 * (0.08 + 5*0.02) = 2.5 - 0.8
    expect(after.easinessFactor).toBeCloseTo(1.7, 10);
  });

  test("EF clamps at 1.3", () => {
    const { state } = run([0, 0, 0, 0, 0, 0]);
    expect(state.easinessFactor).toBe(1.3);
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
  test("uses max(real interval, stored interval) when the user is late", () => {
    // Two on-schedule successes: interval 6, EF 2.7, n = 2.
    const { state, now } = run([5, 5]);
    // The user disappears for 20 days instead of 6 and still remembers.
    const late = now + 20 * DAY_MS;
    const next = review(state, 5, late);
    // round(max(6, 20) × 2.7) = 54
    expect(next.interval).toBe(54);
    expect(next.timeToReview).toBe(late + 54 * DAY_MS);
  });

  test("interval_start resets on every review, so lateness is not double-counted", () => {
    const { state, now } = run([5, 5]);
    const late = now + 20 * DAY_MS;
    const next = review(state, 5, late);
    expect(next.intervalStart).toBe(late);
    // Reviewing on time afterwards sees a real interval equal to the stored one.
    const onTime = review(next, 5, next.timeToReview);
    expect(onTime.interval).toBe(Math.round(54 * next.easinessFactor));
  });

  test("an early review does not shrink the stored interval", () => {
    const { state, now } = run([5, 5]); // interval 6
    const early = now + 1 * DAY_MS;
    const next = review(state, 5, early);
    // max(stored 6, real 1) = 6 → round(6 × 2.7) = 16
    expect(next.interval).toBe(16);
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
