import { isDue } from "../../../src/lib/scheduler";
import { isPackOn, type Progress } from "../../shared/progress";
import type { Pack } from "../data/words";

export const SESSION_LIMIT = 20;

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Ids of cards in the packs the learner has switched on. */
function enabledIds(progress: Progress, packs: Pack[]): string[] {
  return packs.filter((p) => isPackOn(progress, p.id)).flatMap((p) => p.words.map((x) => x.id));
}

export interface Counts {
  due: number;
  fresh: number;
}

export function countCards(progress: Progress, packs: Pack[], now: number): Counts {
  let due = 0;
  let fresh = 0;
  for (const id of enabledIds(progress, packs)) {
    const state = progress.cards[id];
    if (!state) fresh++;
    else if (isDue(state, now)) due++;
  }
  return { due, fresh };
}

/** Due cards first (shuffled), then unseen cards in pack order, at most `limit`. */
export function buildQueue(
  progress: Progress,
  packs: Pack[],
  now: number,
  limit = SESSION_LIMIT,
  random: () => number = Math.random
): string[] {
  const ids = enabledIds(progress, packs);
  const due = shuffled(
    ids.filter((id) => isDue(progress.cards[id], now)),
    random
  );
  const fresh = ids.filter((id) => !progress.cards[id]);
  return [...due, ...fresh].slice(0, limit);
}

/**
 * After a miss ("Не згадав") the card comes back once more at the end of the
 * session. `retried` holds the ids that already used their second chance.
 */
export function requeueOnMiss(
  queue: string[],
  index: number,
  missed: boolean,
  retried: Set<string>
): string[] {
  const id = queue[index];
  if (!missed || id === undefined || retried.has(id)) return queue;
  retried.add(id);
  return [...queue, id];
}

/** Days until the soonest scheduled review among enabled cards; null when nothing is scheduled. */
export function nextReviewInDays(progress: Progress, packs: Pack[], now: number): number | null {
  let soonest: number | null = null;
  for (const id of enabledIds(progress, packs)) {
    const state = progress.cards[id];
    if (!state || state.retired || state.timeToReview <= now) continue;
    if (soonest === null || state.timeToReview < soonest) soonest = state.timeToReview;
  }
  return soonest === null ? null : (soonest - now) / 86_400_000;
}
