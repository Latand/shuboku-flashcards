import { useState } from "react";
import { ArrowLeft, ArchiveRestore, Archive } from "lucide-react";
import type { Screen } from "../App";
import { DAY_MS, GRADES } from "../lib/sm2";
import { useApp } from "../store";

function fmtNext(timeToReview: number, now: number): string {
  if (timeToReview <= now) return "due now";
  const days = Math.ceil((timeToReview - now) / DAY_MS);
  return days === 1 ? "in 1 day" : `in ${days} days`;
}

export function Browser({ go }: { go: (s: Screen) => void }) {
  const { decks, collectedDecks, cardState, setRetired } = useApp();
  const [deckId, setDeckId] = useState<string>(collectedDecks[0]?.id ?? decks[0]?.id ?? "");
  const deck = decks.find((d) => d.id === deckId);
  const now = Date.now();

  return (
    <div className="sb-root">
      <div className="sb-wrap">
        <div className="sb-bar-top">
          <button className="sb-btn sb-icon" onClick={() => go({ name: "home" })} aria-label="Back">
            <ArrowLeft size={17} />
          </button>
          <span className="sb-meta">card browser</span>
        </div>

        <section className="sb-sec">
          <div className="sb-sec-head">
            <span className="sb-num">札</span>
            <span className="sb-sec-jp">札入れ</span>
            <span className="sb-sec-en">Cards & schedule</span>
          </div>

          <div className="sb-field">
            <label htmlFor="deck-pick">Deck</label>
            <select
              id="deck-pick"
              className="sb-select"
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.jp} — {d.name}
                </option>
              ))}
            </select>
          </div>

          {deck && (
            <div className="sb-rows">
              {deck.cards.map((card) => {
                const s = cardState(card.id);
                const gradeInfo =
                  s?.lastGrade != null ? GRADES.find((g) => g.grade === s.lastGrade) : null;
                const sub = s
                  ? `${gradeInfo ? gradeInfo.emoji + " " : ""}${
                      s.retired
                        ? "retired"
                        : `${s.interval}d interval · ${fmtNext(s.timeToReview, now)}`
                    } · ${s.totalRepetitions} reps · EF ${s.easinessFactor.toFixed(2)}`
                  : "never studied";
                return (
                  <div className="sb-row" key={card.id} data-retired={!!s?.retired}>
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
                        {sub}
                      </span>
                    </span>
                    <span className="sb-row-side">
                      {s && (
                        <button
                          className="sb-btn sb-pack-side"
                          onClick={() => setRetired(card.id, !s.retired)}
                          title={s.retired ? "Un-retire (due immediately)" : "Retire from rotation"}
                        >
                          {s.retired ? <ArchiveRestore size={12} /> : <Archive size={12} />}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
