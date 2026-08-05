/*
 * SM-2 variant ported from SuperLearningBot (reference/supermemo.py).
 *
 * Grades 0–5 run the SuperMemo-2 update; grade 6 retires the card
 * (it leaves the rotation until the user un-retires it).
 */

export const DAY_MS = 86_400_000;

export type Grade = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface CardState {
  nRepetitions: number;
  easinessFactor: number;
  /** days */
  interval: number;
  /** epoch ms of the moment the current interval started counting */
  intervalStart: number;
  /** epoch ms when the card becomes due */
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
    nRepetitions: 0,
    easinessFactor: 2.5,
    interval: 0,
    intervalStart: now,
    timeToReview: now, // new cards are due immediately
    totalRepetitions: 0,
    lastGrade: null,
    retired: false,
  };
}

export function review(state: CardState, grade: Grade, now: number): CardState {
  if (grade === 6) {
    return {
      ...state,
      retired: true,
      lastGrade: 6,
      totalRepetitions: state.totalRepetitions + 1,
      intervalStart: now,
    };
  }

  // If the user came back later than scheduled and still remembered,
  // the longer real interval is the one that counts.
  const realIntervalDays = Math.floor((now - state.intervalStart) / DAY_MS);
  let interval = Math.max(state.interval, realIntervalDays);
  let n = state.nRepetitions;
  let ef = state.easinessFactor;

  if (grade >= 3) {
    if (n === 0) interval = 1;
    else if (n === 1) interval = 6;
    else interval = Math.round(interval * ef);
    n += 1;
  } else {
    // Failed: the card relearns from scratch.
    n = 0;
    interval = 1;
  }

  // Easiness update runs on every review, success or failure.
  ef = Math.max(1.3, ef + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));

  return {
    nRepetitions: n,
    easinessFactor: ef,
    interval,
    // Deviation from the bot: SuperLearningBot kept the old interval_start
    // on successful reviews, so real_interval kept growing forever and
    // inflated every later interval. We restart the clock on every review.
    intervalStart: now,
    timeToReview: now + interval * DAY_MS,
    totalRepetitions: state.totalRepetitions + 1,
    lastGrade: grade,
    retired: false,
  };
}

/** A card is due when its review time has arrived and it is not retired. */
export function isDue(state: CardState | undefined, now: number): boolean {
  return !!state && !state.retired && state.timeToReview <= now;
}
