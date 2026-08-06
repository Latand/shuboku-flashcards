import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  type Card as FsrsCard,
  type Grade as FsrsGrade,
} from "ts-fsrs";

export const DAY_MS = 86_400_000;
export const DEFAULT_DESIRED_RETENTION = 0.9;
export const MIN_DESIRED_RETENTION = 0.8;
export const MAX_DESIRED_RETENTION = 0.97;

export type Grade = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface CardState {
  /** Shuboku scheduler state format. Missing means legacy SM-2 state. */
  schedulerVersion?: 1;
  /** FSRS memory stability in days: the point where recall falls to 90%. */
  stability?: number;
  /** FSRS item difficulty, from 1 (easiest) to 10 (hardest). */
  difficulty?: number;
  /** Number of failed recalls after the card entered review. */
  lapses?: number;
  /** Epoch milliseconds of the latest graded review. */
  lastReview?: number | null;

  nRepetitions: number;
  /** Legacy SM-2 field retained so old exports remain readable. */
  easinessFactor: number;
  /** Scheduled interval in days. */
  interval: number;
  /** Epoch milliseconds of the moment the current interval started counting. */
  intervalStart: number;
  /** Epoch milliseconds when the card becomes due. */
  timeToReview: number;
  totalRepetitions: number;
  lastGrade: Grade | null;
  retired: boolean;
}

export const GRADES: { grade: Grade; emoji: string; label: string }[] = [
  { grade: 0, emoji: "🤬", label: "Couldn't remember at all" },
  { grade: 1, emoji: "😡", label: "I had some ideas, but no" },
  { grade: 2, emoji: "👎", label: "Was very close" },
  { grade: 3, emoji: "👍", label: "Yes, but was difficult" },
  { grade: 4, emoji: "😊", label: "Hesitated a bit" },
  { grade: 5, emoji: "😄", label: "Remembered easily" },
  { grade: 6, emoji: "😎", label: "Know very well. Don't remind me again" },
];

export function newCardState(now: number): CardState {
  return {
    schedulerVersion: 1,
    stability: 0,
    difficulty: 0,
    lapses: 0,
    lastReview: null,
    nRepetitions: 0,
    easinessFactor: 2.5,
    interval: 0,
    intervalStart: now,
    timeToReview: now,
    totalRepetitions: 0,
    lastGrade: null,
    retired: false,
  };
}

const schedulers = new Map<number, ReturnType<typeof fsrs>>();

function schedulerFor(desiredRetention: number) {
  const requested = Number.isFinite(desiredRetention)
    ? desiredRetention
    : DEFAULT_DESIRED_RETENTION;
  const retention = Math.min(
    MAX_DESIRED_RETENTION,
    Math.max(MIN_DESIRED_RETENTION, requested)
  );
  let scheduler = schedulers.get(retention);
  if (!scheduler) {
    scheduler = fsrs({
      request_retention: retention,
      maximum_interval: 36_500,
      enable_fuzz: false,
      // Shuboku sessions contain day-scale cards. Minute-scale learning steps
      // would become invisible as soon as the fixed session queue closes.
      enable_short_term: false,
    });
    schedulers.set(retention, scheduler);
  }
  return scheduler;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function ratingFor(grade: Exclude<Grade, 6>): FsrsGrade {
  // Recall is the important split. Grades 0–2 preserve how the miss felt for
  // history and UI, while FSRS receives the truthful binary outcome: Again.
  if (grade < 3) return Rating.Again;
  if (grade === 3) return Rating.Hard;
  if (grade === 4) return Rating.Good;
  return Rating.Easy;
}

/** Convert the old ease factor into a one-time FSRS difficulty estimate. */
function legacyDifficulty(easinessFactor: number): number {
  const ease = clamp(finiteOr(easinessFactor, 2.5), 1.3, 3.5);
  return clamp(6.4133 - (ease - 1.7) * 5.5, 1, 10);
}

/** Keep legacy exports intelligible while new behavior is driven by difficulty. */
function legacyEase(difficulty: number): number {
  return clamp(1.7 + (6.4133 - difficulty) / 5.5, 1.3, 3.5);
}

function asFsrsCard(state: CardState, now: number): FsrsCard {
  if (state.totalRepetitions <= 0) return createEmptyCard(now);

  const intervalStart = finiteOr(state.intervalStart, now);
  const lastReview =
    state.schedulerVersion === 1 ? finiteOr(state.lastReview, intervalStart) : intervalStart;
  const interval = Math.max(0, finiteOr(state.interval, 0));
  const stability = finiteOr(state.stability, 0);
  const difficulty = finiteOr(state.difficulty, 0);
  const hasV1Memory =
    state.schedulerVersion === 1 && stability > 0 && difficulty >= 1;

  return {
    due: new Date(finiteOr(state.timeToReview, now)),
    stability: hasV1Memory ? clamp(stability, 0.001, 36_500) : Math.max(0.1, interval),
    difficulty: hasV1Memory
      ? clamp(difficulty, 1, 10)
      : legacyDifficulty(state.easinessFactor),
    elapsed_days: Math.max(0, Math.floor((now - lastReview) / DAY_MS)),
    scheduled_days: Math.round(interval),
    learning_steps: 0,
    reps: Math.max(1, Math.round(finiteOr(state.totalRepetitions, 1))),
    lapses: Math.max(0, Math.round(finiteOr(state.lapses, 0))),
    state: State.Review,
    last_review: new Date(lastReview),
  };
}

export function review(
  state: CardState,
  grade: Grade,
  now: number,
  desiredRetention = DEFAULT_DESIRED_RETENTION
): CardState {
  if (!Number.isFinite(now)) throw new RangeError("review time must be a finite timestamp");
  const previousTotal = Math.max(0, Math.round(finiteOr(state.totalRepetitions, 0)));

  if (grade === 6) {
    return {
      ...state,
      retired: true,
      lastGrade: 6,
      totalRepetitions: previousTotal + 1,
      intervalStart: now,
    };
  }

  const previous = asFsrsCard(state, now);
  // A backwards device clock must not manufacture negative elapsed time.
  const reviewAt = Math.max(now, previous.last_review?.getTime() ?? now);
  const { card } = schedulerFor(desiredRetention).next(
    previous,
    reviewAt,
    ratingFor(grade)
  );
  const successfulRepetitions =
    grade >= 3 ? Math.max(0, Math.round(finiteOr(state.nRepetitions, 0))) + 1 : 0;

  return {
    schedulerVersion: 1,
    stability: card.stability,
    difficulty: card.difficulty,
    lapses: card.lapses,
    lastReview: reviewAt,
    nRepetitions: successfulRepetitions,
    easinessFactor: legacyEase(card.difficulty),
    interval: card.scheduled_days,
    intervalStart: reviewAt,
    timeToReview: card.due.getTime(),
    totalRepetitions: previousTotal + 1,
    lastGrade: grade,
    retired: false,
  };
}

/** Current modelled probability of recalling the card, from 0 to 1. */
export function recallProbability(state: CardState | undefined, now: number): number | null {
  if (!state || state.retired || state.totalRepetitions <= 0) return null;
  const card = asFsrsCard(state, now);
  const probability = schedulerFor(DEFAULT_DESIRED_RETENTION).get_retrievability(
    card,
    now,
    false
  );
  return clamp(probability, 0, 1);
}

export function isDue(state: CardState | undefined, now: number): boolean {
  return !!state && !state.retired && state.timeToReview <= now;
}
