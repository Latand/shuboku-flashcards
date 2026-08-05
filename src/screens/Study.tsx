import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, Shuffle, Volume2 } from "lucide-react";
import type { Card } from "../data/packs";
import { GRADES, type Grade } from "../lib/sm2";
import { useJapaneseVoice } from "../lib/speech";
import { useApp } from "../store";

export interface SessionResult {
  total: number;
  reviewed: number;
  again: number;
  retired: number;
}

function Front({ card, reverse, open }: { card: Card; reverse: boolean; open: boolean }) {
  if (reverse) {
    const text =
      card.type === "kanji" ? card.meaning : card.type === "custom" ? card.back : card.romaji;
    const latin = card.type !== "kana";
    return (
      <div className={latin ? "sb-prompt sb-prompt-en" : "sb-prompt"} key={"p" + card.id}>
        {text}
      </div>
    );
  }
  return (
    <span className="sb-glyphbox" data-open={open}>
      <span className="sb-glyph" data-small={open || card.char.length > 4} key={"g" + card.id}>
        <span className="sb-ghost" aria-hidden="true">
          {card.char}
        </span>
        {card.char}
      </span>
    </span>
  );
}

function Back({ card, reverse }: { card: Card; reverse: boolean }) {
  if (reverse) {
    return (
      <>
        <div className="sb-glyph" data-small="true">
          {card.char}
        </div>
        {card.type === "custom" && card.reading && (
          <div className="sb-read-row">
            <span className="sb-read-tag">読</span>
            <span className="sb-read">{card.reading}</span>
          </div>
        )}
      </>
    );
  }
  if (card.type === "kanji") {
    return (
      <>
        <div className="sb-read-row">
          <span className="sb-read-tag">音</span>
          <span className="sb-read">{card.on}</span>
        </div>
        <div className="sb-read-row">
          <span className="sb-read-tag">訓</span>
          <span className="sb-read">{card.kun}</span>
        </div>
        <div className="sb-mean">{card.meaning}</div>
      </>
    );
  }
  if (card.type === "custom") {
    return (
      <>
        <div className="sb-romaji" style={{ fontSize: "clamp(24px,7vw,44px)" }}>
          {card.back}
        </div>
        {card.reading && (
          <div className="sb-read-row">
            <span className="sb-read-tag">読</span>
            <span className="sb-read">{card.reading}</span>
          </div>
        )}
        {card.note && <div className="sb-mean">{card.note}</div>}
      </>
    );
  }
  return <div className="sb-romaji">{card.romaji}</div>;
}

export function Study({
  initialQueue,
  onExit,
  onDone,
}: {
  initialQueue: string[];
  onExit: () => void;
  onDone: (r: SessionResult) => void;
}) {
  const { cardsById, gradeCard, profile } = useApp();
  const { speak, hasVoice, checked } = useJapaneseVoice();
  const { reverse, autoSound } = profile.settings;

  const [queue, setQueue] = useState<string[]>(initialQueue);
  const [open, setOpen] = useState(false);
  const [tally, setTally] = useState({ reviewed: 0, again: 0, retired: 0 });
  const total = initialQueue.length;

  const current = queue.length ? cardsById[queue[0]] : null;
  const uniqueLeft = useMemo(() => new Set(queue).size, [queue]);
  const pct = total ? Math.round(((total - uniqueLeft) / total) * 100) : 0;

  const sayCurrent = useCallback(() => {
    if (current) speak(current.speak);
  }, [current, speak]);

  const flip = useCallback(() => {
    if (open || !current) return;
    setOpen(true);
    if (autoSound) setTimeout(() => speak(current.speak), 130);
  }, [open, current, autoSound, speak]);

  const answer = useCallback(
    (grade: Grade) => {
      if (!current) return;
      gradeCard(current.id, grade, Date.now());
      setTally((t) => ({
        reviewed: t.reviewed + 1,
        again: t.again + (grade < 3 ? 1 : 0),
        retired: t.retired + (grade === 6 ? 1 : 0),
      }));
      setQueue((q) => {
        const [head, ...rest] = q;
        // Failed cards come back a few positions later in the same session.
        if (grade < 3) {
          const at = Math.min(4, rest.length);
          return [...rest.slice(0, at), head, ...rest.slice(at)];
        }
        return rest;
      });
      setOpen(false);
    },
    [current, gradeCard]
  );

  useEffect(() => {
    if (total > 0 && queue.length === 0) {
      onDone({ total, ...tally });
    }
  }, [queue.length, total, tally, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      } else if (open && /^[0-6]$/.test(e.key)) {
        answer(Number(e.key) as Grade);
      } else if (e.key.toLowerCase() === "s") {
        sayCurrent();
      } else if (e.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, answer, flip, sayCurrent, onExit]);

  return (
    <div className="sb-root">
      <div className="sb-rail">
        <i style={{ width: pct + "%" }} />
      </div>

      <div className="sb-wrap">
        <div className="sb-bar-top">
          <button className="sb-btn sb-icon" onClick={onExit} aria-label="Back to decks">
            <ArrowLeft size={17} />
          </button>
          <button
            className="sb-btn sb-icon"
            onClick={() => setQueue((q) => [...q].sort(() => Math.random() - 0.5))}
            aria-label="Shuffle remaining"
          >
            <Shuffle size={15} />
          </button>
          <span className="sb-meta">
            <b>{tally.reviewed}</b> reviews · {uniqueLeft} left
          </span>
        </div>

        {current && (
          <div className="sb-stage">
            <button
              className="sb-tap"
              onClick={flip}
              aria-label={open ? "Answer shown" : "Reveal answer"}
            >
              <Front card={current} reverse={reverse} open={open} />
              <div className="sb-rule" key={"r" + current.id + open} />
              {!open ? (
                <div className="sb-hidden">tap to reveal</div>
              ) : (
                <div className="sb-answer" key={"a" + current.id}>
                  <Back card={current} reverse={reverse} />
                </div>
              )}
            </button>

            <button className="sb-btn sb-sound" onClick={sayCurrent} disabled={checked && !hasVoice}>
              <Volume2 size={14} />
              {checked && !hasVoice ? "no voice" : "hear it"}
            </button>

            {!open ? (
              <button className="sb-btn sb-reveal" onClick={flip}>
                <Eye size={14} /> Reveal
              </button>
            ) : (
              <div className="sb-grades">
                {GRADES.map(({ grade, emoji, label }) => (
                  <button
                    key={grade}
                    className="sb-btn sb-grade"
                    data-band={grade < 3 ? "fail" : grade < 6 ? "pass" : "retire"}
                    onClick={() => answer(grade)}
                    title={label}
                  >
                    <span className="sb-grade-emoji">{emoji}</span>
                    <span className="sb-grade-label">{label}</span>
                    <span className="sb-grade-num">{grade}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="sb-keys">space reveal · 0–6 grade · s sound · esc exit</div>
          </div>
        )}
      </div>
    </div>
  );
}
