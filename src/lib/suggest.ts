import type { CardState, Grade } from "./scheduler";

/**
 * Time-aware grade suggestion.
 *
 * How long you sat with a card before asking for the answer is evidence the
 * grading scale never used. This module turns that pause into the grade the
 * slider opens on. It stays a hint: the position you release at still decides.
 *
 * Two things are read together, because neither means much alone:
 *   - the pause, measured against how fast *you* usually recall;
 *   - how the card behaved for you before, so a quick answer on a card that
 *     used to be a struggle reads as progress, not mastery.
 */

/** Below this the answer was revealed by reflex, not recalled. */
export const REFLEX_MS = 600;
/** Past a minute the card was parked, not thought about — the clock says nothing. */
export const STALE_THINK_MS = 60_000;
/** Typical recall pause before a profile has measured enough of its own. */
export const DEFAULT_BASELINE_MS = 6_000;
/** Recent successful recalls kept for the personal baseline. */
export const BASELINE_WINDOW = 40;
/** Under this many samples a personal median is still noise. */
export const MIN_BASELINE_SAMPLES = 5;

/** Fractions of the expected pause that count as fast and as effortful. */
const QUICK_RATIO = 0.6;
const EFFORT_RATIO = 1.7;

/** What the card's own history says to expect. */
export type Familiarity = "new" | "hard" | "steady" | "easy";

/** How the pause compared with the pause this card should have taken. */
export type Pace = "reflex" | "quick" | "steady" | "effort" | "stalled";

export interface Suggestion {
  /** Where the grading slider opens. Never a failing grade, never a retire. */
  grade: Grade;
  pace: Pace;
  familiarity: Familiarity;
  /** One short line explaining the suggestion, ready to render. */
  hint: string;
}

/** The grade the slider has always opened on: an honest "yes, but it was hard". */
export const NEUTRAL_GRADE: Grade = 3;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function usable(thinkMs: number): boolean {
  return Number.isFinite(thinkMs) && thinkMs >= REFLEX_MS && thinkMs < STALE_THINK_MS;
}

/**
 * The profile's own typical recall pause. Recorded successes only: a miss
 * measures how long someone stared at a blank, which is a different quantity.
 */
export function rememberThinkTime(
  samples: number[] | undefined,
  thinkMs: number,
  grade: Grade
): number[] {
  if (grade < 3 || grade === 6 || !usable(thinkMs)) return samples ?? [];
  return [...(samples ?? []), Math.round(thinkMs)].slice(-BASELINE_WINDOW);
}

export function baselineThinkMs(samples: number[] | undefined): number {
  const clean = (samples ?? []).filter(usable);
  if (clean.length < MIN_BASELINE_SAMPLES) return DEFAULT_BASELINE_MS;
  return median(clean);
}

export function familiarity(state: CardState | undefined): Familiarity {
  if (!state || state.totalRepetitions <= 0 || state.lastGrade === null) return "new";
  const difficulty = state.difficulty ?? 0;
  if (state.lastGrade <= 3 || difficulty >= 7) return "hard";
  if (state.lastGrade >= 5 || (difficulty > 0 && difficulty <= 4)) return "easy";
  return "steady";
}

/** A card that fought back last time has earned a longer pause. */
const EXPECTED_SCALE: Record<Familiarity, number> = {
  hard: 1.6,
  new: 1.3,
  steady: 1,
  easy: 0.8,
};

function paceOf(thinkMs: number, expectedMs: number): Pace {
  if (!Number.isFinite(thinkMs) || thinkMs < 0) return "stalled";
  if (thinkMs >= STALE_THINK_MS) return "stalled";
  if (thinkMs < REFLEX_MS) return "reflex";
  const ratio = thinkMs / expectedMs;
  if (ratio <= QUICK_RATIO) return "quick";
  if (ratio >= EFFORT_RATIO) return "effort";
  return "steady";
}

/**
 * Confidence is capped by history. A card that was hard last time never opens
 * above 4 however fast the answer came, and a card seen for the first time has
 * no track record to be confident about.
 */
const SUGGESTED: Record<Familiarity, Record<Pace, Grade>> = {
  easy: { reflex: 3, quick: 5, steady: 4, effort: 3, stalled: 3 },
  steady: { reflex: 3, quick: 5, steady: 4, effort: 3, stalled: 3 },
  new: { reflex: 3, quick: 4, steady: 4, effort: 3, stalled: 3 },
  hard: { reflex: 3, quick: 4, steady: 3, effort: 3, stalled: 3 },
};

function seconds(thinkMs: number): string {
  const s = thinkMs / 1000;
  return (s < 10 ? s.toFixed(1) : String(Math.round(s))) + "s";
}

function phrase(pace: Pace, kind: Familiarity): string {
  switch (pace) {
    case "stalled":
      return "over a minute · middle grade";
    case "reflex":
      return "revealed instantly · grade it yourself";
    case "quick":
      return kind === "hard"
        ? "faster than this card used to be"
        : kind === "new"
          ? "quick for a first meeting"
          : "quick, the way it usually goes";
    case "effort":
      return kind === "hard" ? "slow again, still a hard one" : "a long pause before the answer";
    case "steady":
      return kind === "hard" ? "still takes real effort" : "your usual recall pace";
  }
}

export function suggestGrade(input: {
  /** Milliseconds between the card appearing and the answer being revealed. */
  thinkMs: number;
  state: CardState | undefined;
  baselineMs?: number;
}): Suggestion {
  const kind = familiarity(input.state);
  const baseline = Number.isFinite(input.baselineMs ?? NaN)
    ? (input.baselineMs as number)
    : DEFAULT_BASELINE_MS;
  const pace = paceOf(input.thinkMs, Math.max(1, baseline * EXPECTED_SCALE[kind]));
  const label = phrase(pace, kind);
  return {
    grade: SUGGESTED[kind][pace],
    pace,
    familiarity: kind,
    hint: pace === "stalled" ? label : `${seconds(input.thinkMs)} · ${label}`,
  };
}
