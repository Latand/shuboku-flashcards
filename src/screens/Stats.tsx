import { ArrowLeft, Flame } from "lucide-react";
import type { Screen } from "../App";
import { aggregates, compareWeakness, computeStreak, rankAmong } from "../lib/insights";
import { DAY_MS, isDue } from "../lib/sm2";
import { todayKey } from "../lib/storage";
import { useApp } from "../store";

export function Stats({ go }: { go: (s: Screen) => void }) {
  const { store, profile, activeDecks, cardsById } = useApp();
  const now = Date.now();

  const activeCardIds = new Set(activeDecks.flatMap((d) => d.cards.map((c) => c.id)));

  const states = Object.entries(profile.cards);
  const agg = aggregates(profile.cards, activeCardIds);
  const dueNow = states.filter(([id, s]) => activeCardIds.has(id) && isDue(s, now)).length;
  const streak = computeStreak(profile.reviewLog, now);

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
            <div className="sb-stat-n">{agg.totalReps}</div>
            <div className="sb-stat-l">total reviews</div>
          </div>
        </div>

        <div className="sb-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="sb-stat">
            <div className="sb-stat-n">{agg.learned}</div>
            <div className="sb-stat-l">👍 learned</div>
          </div>
          <div className="sb-stat">
            <div className="sb-stat-n">{agg.learning}</div>
            <div className="sb-stat-l">🟡 learning</div>
          </div>
          <div className="sb-stat">
            <div className="sb-stat-n">{agg.failed}</div>
            <div className="sb-stat-l">👎 struggling</div>
          </div>
          <div className="sb-stat">
            <div className="sb-stat-n">{agg.active}</div>
            <div className="sb-stat-l">🟢 in rotation</div>
          </div>
          <div className="sb-stat">
            <div className="sb-stat-n">{agg.inactive}</div>
            <div className="sb-stat-l">🔴 out of rotation</div>
          </div>
          <div className="sb-stat">
            <div className="sb-stat-n">{agg.retired}</div>
            <div className="sb-stat-l">😎 retired</div>
          </div>
        </div>

        {profiles.length > 1 && (
          <p className="sb-note">
            🏆 Among the {profiles.length} profiles on this device you are #{learnedRank} by
            learned cards and #{repsRank} by total reviews.
          </p>
        )}
        <p className="sb-note">
          A card counts as learned once you have remembered it twice in a row.
        </p>

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
