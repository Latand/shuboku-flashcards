import { ArrowLeft, Flame } from "lucide-react";
import type { Screen } from "../App";
import { aggregates, compareWeakness, computeStreak, rankAmong } from "../lib/insights";
import { DAY_MS, isDue } from "../lib/sm2";
import { todayKey } from "../lib/storage";
import { useApp } from "../store";

const STATUS_COLORS = {
  mastered: "#e7cf7a",
  learned: "#6fae7f",
  learning: "#8d8478",
  struggling: "#e2242f",
  fresh: "#241d21",
} as const;

const SCRIPT_LABELS: Record<string, string> = {
  hiragana: "ひらがな",
  katakana: "カタカナ",
  kanji: "漢字",
  custom: "自作",
};

type Status = keyof typeof STATUS_COLORS;

function statusOf(s: { retired: boolean; lastGrade: number | null; nRepetitions: number } | undefined): Status {
  if (!s || s.lastGrade === null) return "fresh";
  if (s.retired) return "mastered";
  if (s.lastGrade >= 3 && s.nRepetitions >= 2) return "learned";
  if (s.lastGrade < 3) return "struggling";
  return "learning";
}

export function Stats({ go }: { go: (s: Screen) => void }) {
  const { store, profile, activeDecks, collectedDecks, cardsById } = useApp();
  const now = Date.now();

  const activeCardIds = new Set(activeDecks.flatMap((d) => d.cards.map((c) => c.id)));

  const states = Object.entries(profile.cards);
  const agg = aggregates(profile.cards, activeCardIds);
  const dueNow = states.filter(([id, s]) => activeCardIds.has(id) && isDue(s, now)).length;
  const streak = computeStreak(profile.reviewLog, now);
  const reviewsToday = profile.reviewLog[todayKey(now)] ?? 0;

  // How the whole collection breaks down, overall and per script.
  const comp: Record<Status, number> = { mastered: 0, learned: 0, learning: 0, struggling: 0, fresh: 0 };
  const byScript: Record<string, { total: number; known: number }> = {};
  {
    const seen = new Set<string>();
    for (const deck of collectedDecks) {
      const g = (byScript[deck.script] ??= { total: 0, known: 0 });
      for (const card of deck.cards) {
        if (seen.has(card.id)) continue;
        seen.add(card.id);
        const st = statusOf(profile.cards[card.id]);
        comp[st]++;
        g.total++;
        if (st === "mastered" || st === "learned") g.known++;
      }
    }
  }
  const compTotal = Object.values(comp).reduce((a, b) => a + b, 0);
  const known = comp.mastered + comp.learned;
  const knownPct = compTotal ? Math.round((known / compTotal) * 100) : 0;

  // Leaderboard among the profiles on this device (the bot ranked users).
  const profiles = Object.values(store.profiles);
  const learnedByProfile = profiles.map(
    (p) => aggregates(p.cards, new Set<string>()).learned
  );
  const repsByProfile = profiles.map(
    (p) => aggregates(p.cards, new Set<string>()).totalReps
  );
  const learnedRank = rankAmong(agg.learned, learnedByProfile.filter((_, i) => profiles[i].id !== profile.id));
  const repsRank = rankAmong(agg.totalReps, repsByProfile.filter((_, i) => profiles[i].id !== profile.id));

  // The cards that resist you the most right now.
  const hardest = Object.entries(profile.cards)
    .filter(([id, s]) => activeCardIds.has(id) && !s.retired && s.lastGrade !== null)
    .sort(([, a], [, b]) => compareWeakness(a, b))
    .slice(0, 5)
    .map(([id, s]) => ({ card: cardsById[id], s }))
    .filter((x) => !!x.card);

  // Reviews per day, last 7 days.
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const t = now - i * DAY_MS;
    const key = todayKey(t);
    days.push({ label: key.slice(5), count: profile.reviewLog[key] ?? 0 });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  // Due forecast for the next week. "today" includes everything overdue.
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const forecast: { label: string; count: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const end = endOfToday.getTime() + i * DAY_MS;
    const start = i === 0 ? -Infinity : end - DAY_MS;
    const count = states.filter(
      ([id, s]) =>
        activeCardIds.has(id) && !s.retired && s.timeToReview > start && s.timeToReview <= end
    ).length;
    forecast.push({ label: i === 0 ? "today" : `+${i}d`, count });
  }
  const maxForecast = Math.max(1, ...forecast.map((d) => d.count));

  return (
    <div className="sb-root">
      <div className="sb-wrap">
        <div className="sb-bar-top">
          <button className="sb-btn sb-icon" onClick={() => go({ name: "home" })} aria-label="Back">
            <ArrowLeft size={17} />
          </button>
          <span className="sb-meta">stats · {profile.name}</span>
        </div>

        <div className="sb-stats">
          <div className="sb-stat">
            <div className="sb-stat-n">{dueNow}</div>
            <div className="sb-stat-l">due now</div>
          </div>
          <div className="sb-stat">
            <div className="sb-stat-n">
              <Flame size={18} className="sb-flame" style={{ verticalAlign: "-2px" }} />{" "}
              {streak.current}
            </div>
            <div className="sb-stat-l">day streak · best {streak.best}</div>
          </div>
          <div className="sb-stat">
            <div className="sb-stat-n">{reviewsToday}</div>
            <div className="sb-stat-l">reviews today</div>
          </div>
        </div>

        {compTotal > 0 && (
          <section className="sb-sec" style={{ marginTop: 28 }}>
            <div className="sb-sec-head">
              <span className="sb-num">知</span>
              <span className="sb-sec-jp">知識</span>
              <span className="sb-sec-en">Your knowledge</span>
            </div>

            <div className="sb-comp-head">
              <span className="sb-comp-pct">{knownPct}%</span>
              <span className="sb-comp-sub">
                {known} of {compTotal} cards known · {agg.totalReps} reviews all time
              </span>
            </div>
            <div className="sb-compbar" role="img" aria-label={`${knownPct}% of collection known`}>
              {(Object.keys(comp) as Status[]).map(
                (k) =>
                  comp[k] > 0 && (
                    <i
                      key={k}
                      style={{
                        width: `${(comp[k] / compTotal) * 100}%`,
                        background: STATUS_COLORS[k],
                      }}
                    />
                  )
              )}
            </div>
            <div className="sb-legend">
              <span><i className="sb-dot" style={{ background: STATUS_COLORS.mastered }} />mastered {comp.mastered}</span>
              <span><i className="sb-dot" style={{ background: STATUS_COLORS.learned }} />learned {comp.learned}</span>
              <span><i className="sb-dot" style={{ background: STATUS_COLORS.learning }} />learning {comp.learning}</span>
              <span><i className="sb-dot" style={{ background: STATUS_COLORS.struggling }} />struggling {comp.struggling}</span>
              <span><i className="sb-dot" style={{ background: STATUS_COLORS.fresh, border: "1px solid #3a3236" }} />new {comp.fresh}</span>
            </div>

            <div style={{ marginTop: 18 }}>
              {Object.entries(byScript).map(([script, g]) => (
                <div className="sb-barrow" key={script}>
                  <span className="sb-barrow-l">{SCRIPT_LABELS[script] ?? script}</span>
                  <span className="sb-barrow-track">
                    <i
                      style={{
                        width: Math.round((g.known / Math.max(1, g.total)) * 100) + "%",
                        background: STATUS_COLORS.learned,
                      }}
                    />
                  </span>
                  <span className="sb-barrow-n">
                    {Math.round((g.known / Math.max(1, g.total)) * 100)}%
                  </span>
                </div>
              ))}
            </div>

            <p className="sb-blurb" style={{ marginTop: 12 }}>
              A card counts as known after two successful recalls in a row — or once you retire
              it.
              {profiles.length > 1 &&
                ` Among ${profiles.length} profiles here you are #${learnedRank} by learned cards and #${repsRank} by reviews.`}
            </p>
          </section>
        )}

        {hardest.length > 0 && (
          <section className="sb-sec">
            <div className="sb-sec-head">
              <span className="sb-num">難</span>
              <span className="sb-sec-jp">難物</span>
              <span className="sb-sec-en">Hardest cards</span>
            </div>
            <div className="sb-rows">
              {hardest.map(({ card, s }) => (
                <div className="sb-row" key={card.id}>
                  <span className="sb-row-char">{card.char}</span>
                  <span className="sb-row-main">
                    <span>
                      {card.type === "kana"
                        ? card.romaji
                        : card.type === "kanji"
                          ? card.meaning
                          : card.back}
                    </span>
                    <span className="sb-row-sub" style={{ display: "block" }}>
                      {s.totalRepetitions} reps · last grade {s.lastGrade} · EF{" "}
                      {s.easinessFactor.toFixed(2)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="sb-sec">
          <div className="sb-sec-head">
            <span className="sb-num">先</span>
            <span className="sb-sec-jp">これから</span>
            <span className="sb-sec-en">Due forecast</span>
          </div>
          <p className="sb-blurb">Cards from your collection coming due over the next week.</p>
          <div>
            {forecast.map((d) => (
              <div className="sb-barrow" key={d.label}>
                <span className="sb-barrow-l">{d.label}</span>
                <span className="sb-barrow-track">
                  <i style={{ width: Math.round((d.count / maxForecast) * 100) + "%" }} />
                </span>
                <span className="sb-barrow-n">{d.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="sb-sec">
          <div className="sb-sec-head">
            <span className="sb-num">日</span>
            <span className="sb-sec-jp">日々の復習</span>
            <span className="sb-sec-en">Reviews per day</span>
          </div>
          <div style={{ marginTop: 14 }}>
            {days.map((d) => (
              <div className="sb-barrow" key={d.label}>
                <span className="sb-barrow-l">{d.label}</span>
                <span className="sb-barrow-track">
                  <i style={{ width: Math.round((d.count / maxDay) * 100) + "%" }} />
                </span>
                <span className="sb-barrow-n">{d.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
