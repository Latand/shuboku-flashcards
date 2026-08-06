import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, Shuffle, Volume2 } from "lucide-react";
import type { Card } from "../data/packs";
import { fmtNextReview } from "../lib/insights";
import { GRADES, type Grade } from "../lib/scheduler";
import { baselineThinkMs, suggestGrade } from "../lib/suggest";
import { useJapaneseVoice } from "../lib/speech";
import { haptics, setClosingConfirmation } from "../lib/telegram";
import { useApp } from "../store";
import { GradeSlider } from "./GradeSlider";

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
  const { cardsById, gradeCard, undoGrade, profile } = useApp();
  const { speak, canSpeak } = useJapaneseVoice();
  const { reverse, autoSound, autoFlip } = profile.settings;

  const [queue, setQueue] = useState<string[]>(initialQueue);
  const [open, setOpen] = useState(false);
  const [tally, setTally] = useState({ reviewed: 0, again: 0, retired: 0 });
  // The pause between seeing the card and asking for the answer: the evidence
  // behind the grade the slider opens on.
  const shownAt = useRef(Date.now());
  const [thinkMs, setThinkMs] = useState<number | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    key: number;
    undo?: () => void;
    leaving?: boolean;
  } | null>(null);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const total = initialQueue.length;

  const clearToast = useCallback(() => {
    toastTimers.current.forEach(clearTimeout);
    toastTimers.current = [];
    setToast(null);
  }, []);

  const showToast = useCallback(
    (text: string, undo?: () => void) => {
      clearToast();
      setToast({ text, key: Date.now(), undo });
      toastTimers.current = [
        setTimeout(() => setToast((t) => (t ? { ...t, leaving: true } : t)), 4300),
        setTimeout(() => setToast(null), 5000),
      ];
    },
    [clearToast]
  );

  useEffect(() => () => toastTimers.current.forEach(clearTimeout), []);

  const current = queue.length ? cardsById[queue[0]] : null;
  const uniqueLeft = useMemo(() => new Set(queue).size, [queue]);
  const pct = total ? Math.round(((total - uniqueLeft) / total) * 100) : 0;

  const sayCurrent = useCallback(() => {
    if (current) speak(current.speak);
  }, [current, speak]);

  const flip = useCallback(() => {
    if (open || !current) return;
    haptics.impact("light");
    setThinkMs(Date.now() - shownAt.current);
    setOpen(true);
    if (autoSound) setTimeout(() => speak(current.speak), 130);
  }, [open, current, autoSound, speak]);

  // The clock restarts on every card face-up moment — including a failed card
  // coming back around later in the same session.
  useEffect(() => {
    if (open) return;
    shownAt.current = Date.now();
    setThinkMs(null);
  }, [open, current?.id]);

  const suggestion = useMemo(() => {
    if (!open || thinkMs === null || !current) return null;
    return suggestGrade({
      thinkMs,
      state: profile.cards[current.id],
      baselineMs: baselineThinkMs(profile.recallTimes),
    });
    // The suggestion is fixed at the moment of the flip; grading it must not
    // move it, so the card's own state is read once and not tracked here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, thinkMs, current?.id]);

  // Inside Telegram, guard an in-progress session against accidental closing.
  useEffect(() => {
    setClosingConfirmation(true);
    return () => setClosingConfirmation(false);
  }, []);

  // The bot's instruction: don't sit on one card — flip it automatically.
  useEffect(() => {
    if (!autoFlip || open || !current) return;
    const t = setTimeout(flip, 60_000);
    return () => clearTimeout(t);
  }, [autoFlip, open, current, flip]);

  const answer = useCallback(
    (grade: Grade) => {
      if (!current) return;
      if (grade === 6) haptics.impact("heavy");
      else haptics.notify(grade < 3 ? "error" : "success");
      const cardId = current.id;
      const now = Date.now();
      const prev = profile.cards[cardId];
      const prevRecallTimes = profile.recallTimes;
      const next = gradeCard(cardId, grade, now, thinkMs);
      const undo = () => {
        haptics.impact("rigid");
        undoGrade(cardId, prev, now, prevRecallTimes);
        setTally((t) => ({
          reviewed: t.reviewed - 1,
          again: t.again - (grade < 3 ? 1 : 0),
          retired: t.retired - (grade === 6 ? 1 : 0),
        }));
        // The card comes straight back, answer side up, for a fresh grade.
        setQueue((q) => [cardId, ...q.filter((id) => id !== cardId)]);
        setOpen(true);
        clearToast();
      };
      const text =
        grade === 6
          ? "😎 Retired — it won't come back"
          : grade < 3
            ? "🔁 Again in a few cards"
            : `${GRADES[grade].emoji} Next review ${fmtNextReview(next.timeToReview - now)}`;
      showToast(text, undo);
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
    [current, gradeCard, undoGrade, profile, showToast, clearToast, thinkMs]
  );

  // The session ends when the queue empties — but while the undo toast is
  // still up, the summary waits so an accidental last grade can be reverted.
  useEffect(() => {
    if (total === 0 || queue.length > 0) return;
    const delay = toast?.undo ? (toast.leaving ? 700 : 5200) : 600;
    const t = setTimeout(() => onDone({ total, ...tally }), delay);
    return () => clearTimeout(t);
  }, [queue.length, total, tally, onDone, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      } else if (open && /^[0-6]$/.test(e.key)) {
        answer(Number(e.key) as Grade);
      } else if (e.key.toLowerCase() === "s") {
        sayCurrent();
      } else if (e.key.toLowerCase() === "z" && toast?.undo) {
        toast.undo();
      } else if (e.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, answer, flip, sayCurrent, onExit, toast]);

  return (
    <div className="sb-root">
      <div className="sb-rail">
        <i style={{ width: pct + "%" }} />
      </div>

      <div className="sb-wrap">
        <div className="sb-bar-top">
          <button className="sb-btn sb-icon" onClick={onExit} aria-label="End session">
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
            <b>{total - uniqueLeft}</b> / {total} · {tally.reviewed} reps
          </span>
        </div>

        {current && (
          <div className="sb-study">
            <button
              className="sb-btn sb-cardpanel"
              data-open={open}
              onClick={flip}
              aria-label={open ? "Answer shown" : "Reveal answer"}
            >
              <span className="sb-corner">
                {current.type === "kanji" ? "漢字 · kanji" : current.type === "custom" ? "自作 · custom" : "かな · kana"}
              </span>
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

            {!open ? (
              <>
                <button className="sb-btn sb-reveal" onClick={flip}>
                  <Eye size={14} /> Reveal
                </button>
                <div>
                  <button
                    className="sb-btn sb-sound"
                    onClick={sayCurrent}
                    disabled={!canSpeak(current.speak)}
                  >
                    <Volume2 size={14} />
                    {canSpeak(current.speak) ? "hear it" : "no voice"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <GradeSlider key={current.id} suggestion={suggestion} onCommit={answer} />
                <div>
                  <button
                    className="sb-btn sb-sound"
                    onClick={sayCurrent}
                    disabled={!canSpeak(current.speak)}
                  >
                    <Volume2 size={14} />
                    {canSpeak(current.speak) ? "hear it" : "no voice"}
                  </button>
                </div>
              </>
            )}

            <div className="sb-keys">space reveal · drag &amp; release to grade · 0–6 quick keys · z undo · esc exit</div>
          </div>
        )}

        {!current && total > 0 && (
          <div className="sb-study">
            <p className="sb-hidden" style={{ marginTop: 60 }}>
              了 · session complete
            </p>
          </div>
        )}
      </div>

      {toast && (
        <div className="sb-toast" key={toast.key} data-leaving={!!toast.leaving} role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button className="sb-btn sb-toast-undo" onClick={toast.undo}>
              Undo
            </button>
          )}
          <i className="sb-toast-timer" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
