import { ArrowLeft } from "lucide-react";
import type { Screen } from "../App";
import { DAY_MS, isDue } from "../lib/sm2";
import { todayKey } from "../lib/storage";
import { useApp } from "../store";

export function Stats({ go }: { go: (s: Screen) => void }) {
  const { profile, collectedDecks } = useApp();
  const now = Date.now();

  const collectedCardIds = new Set(
    collectedDecks.flatMap((d) => d.cards.map((c) => c.id))
  );

  const states = Object.entries(profile.cards);
  const tracked = states.length;
  const retired = states.filter(([, s]) => s.retired).length;
  const dueNow = states.filter(
    ([id, s]) => collectedCardIds.has(id) && isDue(s, now)
  ).length;

  // Reviews per day, last 14 days.
  const days: { label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
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
        collectedCardIds.has(id) &&
        !s.retired &&
        s.timeToReview > start &&
        s.timeToReview <= end
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
            <div className="sb-stat-n">{tracked}</div>
            <div className="sb-stat-l">tracked</div>
          </div>
          <div className="sb-stat">
            <div className="sb-stat-n">{retired}</div>
            <div className="sb-stat-l">retired</div>
          </div>
        </div>

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
      </div>
    </div>
  );
}
