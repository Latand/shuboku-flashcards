import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { GRADES, type Grade } from "../lib/sm2";

const THUMB = 44; // px, also the track padding for the thumb travel

const SHORT_LABELS: Record<Grade, string> = {
  0: "no recall",
  1: "barely",
  2: "very close",
  3: "knew it, barely",
  4: "hesitated",
  5: "easy",
  6: "know it — retire card",
};

const band = (g: Grade) => (g < 3 ? "fail" : g === 3 ? "mid" : g < 6 ? "pass" : "retire");

/**
 * The grading control: drag the thumb and release — the grade where you
 * let go is the one that counts. Starts at 3 ("yes, but it was hard").
 */
export function GradeSlider({ onCommit }: { onCommit: (g: Grade) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);
  const [pos, setPos] = useState(0.5); // 0..1 → grade 3 by default
  const [dragging, setDragging] = useState(false);
  const grade = Math.round(pos * 6) as Grade;

  const posFromX = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const x = (clientX - r.left - THUMB / 2) / (r.width - THUMB);
    return Math.min(1, Math.max(0, x));
  };

  const commit = (g: Grade) => {
    if (committedRef.current) return;
    committedRef.current = true;
    setPos(g / 6);
    // let the thumb settle on the stop before the card flips away
    setTimeout(() => onCommit(g), 160);
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (committedRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setPos(posFromX(e.clientX));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging && !committedRef.current) setPos(posFromX(e.clientX));
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    commit(Math.round(posFromX(e.clientX) * 6) as Grade);
  };
  const cancel = () => {
    if (committedRef.current) return;
    setDragging(false);
    setPos(0.5);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setPos(Math.max(0, grade - 1) / 6);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setPos(Math.min(6, grade + 1) / 6);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(grade);
    }
  };

  const travel = `(100% - ${THUMB}px)`;
  const b = band(grade);

  return (
    <div className="sb-slider-wrap">
      <div className="sb-slider-label" data-band={b} aria-live="polite">
        <b>{grade}</b>
        <span>{SHORT_LABELS[grade]}</span>
      </div>
      <div
        ref={trackRef}
        className="sb-slider"
        data-band={b}
        data-dragging={dragging}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={6}
        aria-valuenow={grade}
        aria-valuetext={GRADES[grade].label}
        aria-label="Grade how well you remembered, release to confirm"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onKeyDown={onKey}
      >
        <div
          className="sb-slider-fill"
          style={{ width: `calc(${pos} * ${travel} + ${THUMB}px)` }}
        />
        <div className="sb-slider-ticks" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <i key={i} style={{ left: `calc(${i / 6} * ${travel} + ${THUMB / 2}px)` }} />
          ))}
        </div>
        <div
          className="sb-slider-thumb"
          style={{ left: `calc(${pos} * ${travel})` }}
          aria-hidden="true"
        />
      </div>
      <div className="sb-slider-ends" aria-hidden="true">
        <span>0 · blank</span>
        <span>release to grade</span>
        <span>know it · 6</span>
      </div>
    </div>
  );
}
