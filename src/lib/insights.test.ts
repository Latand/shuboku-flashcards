import { describe, expect, test } from "bun:test";
import { DAY_MS } from "./sm2";
import { todayKey } from "./storage";
import { aggregates, computeStreak, fmtNextReview, gradeBar, rankAmong } from "./insights";
import { newCardState, review } from "./sm2";

const NOW = new Date(2026, 7, 5, 12).getTime(); // local noon

function log(daysAgo: number[]): Record<string, number> {
  const l: Record<string, number> = {};
  for (const d of daysAgo) l[todayKey(NOW - d * DAY_MS)] = 1 + d;
  return l;
}

describe("streak", () => {
  test("counts consecutive days including today", () => {
    expect(computeStreak(log([0, 1, 2]), NOW)).toEqual({ current: 3, best: 3 });
  });
  test("stays alive if today has no reviews yet", () => {
    expect(computeStreak(log([1, 2, 3]), NOW).current).toBe(3);
  });
  test("breaks on a gap and remembers the best run", () => {
    // reviewed 5,4,3 days ago (run of 3), then a gap, then yesterday
    const s = computeStreak(log([1, 3, 4, 5]), NOW);
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });
  test("empty log", () => {
    expect(computeStreak({}, NOW)).toEqual({ current: 0, best: 0 });
  });
});

describe("next review text", () => {
  test("buckets match the bot's next_time texts", () => {
    expect(fmtNextReview(1 * DAY_MS)).toBe("tomorrow");
    expect(fmtNextReview(3 * DAY_MS)).toBe("in 3 days");
    expect(fmtNextReview(16 * DAY_MS)).toBe("in 2w 2d");
    expect(fmtNextReview(14 * DAY_MS)).toBe("in 2w");
    expect(fmtNextReview(5 * 3_600_000)).toBe("in 5h");
    expect(fmtNextReview(60_000)).toBe("very soon");
  });
});

describe("aggregates", () => {
  test("learned/learning/failed/active follow the bot's definitions", () => {
    const t = NOW;
    let a = newCardState(t); // learned: two successes in a row
    a = review(a, 5, t);
    a = review(a, 5, a.timeToReview);
    const b = review(newCardState(t), 1, t); // failed + learning
    const c = newCardState(t); // never reviewed: learning
    const d = review(newCardState(t), 6, t); // retired

    const cards = { a, b, c, d };
    const agg = aggregates(cards, new Set(["a", "b"]));
    expect(agg.tracked).toBe(4);
    expect(agg.learned).toBe(1);
    expect(agg.learning).toBe(3); // a (2 reps < 3), b and c; d is retired
    expect(agg.failed).toBe(1);
    expect(agg.retired).toBe(1);
    expect(agg.active).toBe(2);
    expect(agg.inactive).toBe(2);
    expect(agg.totalReps).toBe(4);
  });
});

describe("ranks and grade bar", () => {
  test("rankAmong is 1-based, ties share rank", () => {
    expect(rankAmong(10, [10, 5, 2])).toBe(1);
    expect(rankAmong(5, [10, 5, 2])).toBe(2);
    expect(rankAmong(2, [10, 5, 2])).toBe(3);
  });
  test("gradeBar tones", () => {
    expect(gradeBar(2)).toEqual({ filled: 2, tone: "bad" });
    expect(gradeBar(3)).toEqual({ filled: 3, tone: "middle" });
    expect(gradeBar(5)).toEqual({ filled: 5, tone: "good" });
  });
});
