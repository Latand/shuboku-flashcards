import { DAY_MS, type CardState } from "./sm2";
import { todayKey } from "./storage";

/* ---- daily streak ---- */

function addDay(key: string): string {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(
  reviewLog: Record<string, number>,
  now: number
): { current: number; best: number } {
  // Current run: today counts if reviewed; otherwise the streak is still
  // alive until midnight, so start counting from yesterday.
  let current = 0;
  let cursor = now;
  if (!(reviewLog[todayKey(now)] > 0)) cursor -= DAY_MS;
  while ((reviewLog[todayKey(cursor)] ?? 0) > 0) {
    current++;
    cursor -= DAY_MS;
  }

  // Best run over the whole log.
  const days = Object.keys(reviewLog)
    .filter((k) => reviewLog[k] > 0)
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of days) {
    run = prev !== null && addDay(prev) === day ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return { current, best: Math.max(best, current) };
}

/* ---- "next review in …" feedback (ported from the bot's next_time texts) ---- */

export function fmtNextReview(deltaMs: number): string {
  const days = Math.floor(deltaMs / DAY_MS);
  if (days > 7) {
    const weeks = Math.floor(days / 7);
    const rem = days % 7;
    return rem ? `in ${weeks}w ${rem}d` : `in ${weeks}w`;
  }
  if (days > 1) return `in ${days} days`;
  if (days === 1) return "tomorrow";
  const hours = Math.floor(deltaMs / 3_600_000);
  return hours >= 1 ? `in ${hours}h` : "very soon";
}

/* ---- profile aggregates (ported from the bot's /statistics) ---- */

export interface Aggregates {
  tracked: number;
  /** graded ≥3 at least twice in a row — the bot's "learned" definition */
  learned: number;
  /** fewer than 3 successful repetitions so far */
  learning: number;
  /** last grade was a failure */
  failed: number;
  retired: number;
  /** currently in rotation (collected, not paused, not retired) */
  active: number;
  inactive: number;
  totalReps: number;
}

export function aggregates(
  cards: Record<string, CardState>,
  activeCardIds: Set<string>
): Aggregates {
  const states = Object.entries(cards);
  let learned = 0;
  let learning = 0;
  let failed = 0;
  let retired = 0;
  let active = 0;
  let totalReps = 0;
  for (const [id, s] of states) {
    if (s.lastGrade !== null && s.lastGrade >= 3 && s.nRepetitions >= 2) learned++;
    if (s.nRepetitions < 3 && !s.retired) learning++;
    if (s.lastGrade !== null && s.lastGrade < 3) failed++;
    if (s.retired) retired++;
    if (activeCardIds.has(id) && !s.retired) active++;
    totalReps += s.totalRepetitions;
  }
  return {
    tracked: states.length,
    learned,
    learning,
    failed,
    retired,
    active,
    inactive: states.length - active,
    totalReps,
  };
}

/** 1-based rank of `value` among `all` (higher is better). */
export function rankAmong(value: number, all: number[]): number {
  return 1 + all.filter((v) => v > value).length;
}

/**
 * Weakest-first ordering: studied cards before new ones, retired last.
 * Among studied cards a worse last grade wins; on equal grades the card
 * you had to repeat more times is the one you truly know worse.
 */
export function compareWeakness(a: CardState | undefined, b: CardState | undefined): number {
  const band = (s?: CardState) => (s?.retired ? 2 : !s || s.lastGrade === null ? 1 : 0);
  if (band(a) !== band(b)) return band(a) - band(b);
  if (!a || !b || band(a) !== 0) return 0;
  if (a.lastGrade !== b.lastGrade) return a.lastGrade! - b.lastGrade!;
  if (a.totalRepetitions !== b.totalRepetitions) return b.totalRepetitions - a.totalRepetitions;
  if (a.easinessFactor !== b.easinessFactor) return a.easinessFactor - b.easinessFactor;
  return a.interval - b.interval;
}

/* ---- last-grade progress bar (ported from the bot's statistics handler) ---- */

export function gradeBar(grade: number): { filled: number; tone: "bad" | "middle" | "good" } {
  const filled = Math.max(0, Math.min(5, grade));
  return { filled, tone: grade < 3 ? "bad" : grade === 3 ? "middle" : "good" };
}
