import { useMemo } from "react";
import { ArrowLeft, ArchiveRestore, Archive } from "lucide-react";
import type { Screen } from "../App";
import type { Card, Deck } from "../data/packs";
import { gradeBar } from "../lib/insights";
import { DAY_MS, type CardState } from "../lib/sm2";
import { haptics } from "../lib/telegram";
import { useApp } from "../store";

function fmtNext(timeToReview: number, now: number): string {
  if (timeToReview <= now) return "due now";
  const days = Math.ceil((timeToReview - now) / DAY_MS);
  return days === 1 ? "in 1 day" : `in ${days} days`;
}

/** The bot's colored-squares last-grade bar. */
function GradeBar({ grade }: { grade: number }) {
  const { filled, tone } = gradeBar(grade);
  return (
    <span className="sb-gradebar" data-tone={tone} title={`last grade ${grade}/6`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} data-on={i < filled} />
      ))}
    </span>
  );
}

/** Lower = worse remembered. Failed cards float to the top, retired sink. */
function weakness(s: CardState | undefined): number {
  if (s?.retired) return 1_000_000;
  if (!s || s.lastGrade === null) return 70_000; // not studied yet
  return s.lastGrade * 10_000 + s.interval * 10 + s.easinessFactor;
}

export function Browser({ go }: { go: (s: Screen) => void }) {
  const { profile, collectedDecks, setRetired } = useApp();
  const now = Date.now();

  const rows = useMemo(() => {
    const list: { card: Card; deck: Deck; s: CardState | undefined }[] = [];
    const seen = new Set<string>();
    for (const deck of collectedDecks) {
      for (const card of deck.cards) {
        if (seen.has(card.id)) continue;
        seen.add(card.id);
        list.push({ card, deck, s: profile.cards[card.id] });
      }
    }
    return list.sort((a, b) => weakness(a.s) - weakness(b.s));
  }, [collectedDecks, profile.cards]);

  return (
    <div className="sb-root">
      <div className="sb-wrap">
        <div className="sb-bar-top">
          <button className="sb-btn sb-icon" onClick={() => go({ name: "home" })} aria-label="Back">
            <ArrowLeft size={17} />
          </button>
          <span className="sb-meta">card browser · {rows.length} cards</span>
        </div>

        <section className="sb-sec">
          <div className="sb-sec-head">
            <span className="sb-num">札</span>
            <span className="sb-sec-jp">札入れ</span>
            <span className="sb-sec-en">Weakest first</span>
          </div>
          <p className="sb-blurb">
            Every card from your collection in one list — the ones you remember worst come
            first, retired cards sink to the bottom.
          </p>

          {rows.length === 0 ? (
            <div className="sb-empty">Nothing collected yet — add packs from the catalog.</div>
          ) : (
            <div className="sb-rows">
              {rows.map(({ card, deck, s }) => {
                const sub = s
                  ? `${
                      s.retired
                        ? "retired"
                        : s.lastGrade === null
                          ? "new"
                          : `${s.interval}d interval · ${fmtNext(s.timeToReview, now)}`
                    } · ${s.totalRepetitions} reps · EF ${s.easinessFactor.toFixed(2)} · ${deck.jp}`
                  : `never studied · ${deck.jp}`;
                return (
                  <div className="sb-row" key={card.id} data-retired={!!s?.retired}>
                    <span className="sb-row-char">{card.char}</span>
                    <span className="sb-row-main">
                      <span>
                        {card.type === "kana"
                          ? card.romaji
                          : card.type === "kanji"
                            ? card.meaning
                            : card.back}{" "}
                        {s?.lastGrade != null && <GradeBar grade={s.lastGrade} />}
                      </span>
                      <span className="sb-row-sub" style={{ display: "block" }}>
                        {sub}
                      </span>
                    </span>
                    <span className="sb-row-side">
                      {s && (
                        <button
                          className="sb-btn sb-pack-side"
                          onClick={() => {
                            haptics.selection();
                            setRetired(card.id, !s.retired);
                          }}
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
