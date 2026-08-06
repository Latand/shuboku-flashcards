import { useLayoutEffect, useRef, useState } from "react";
import { GRADES, type GradeEntry } from "../lib/scheduler";

/*
 * How a card has gone, review by review.
 *
 * The scale is the grading scale itself, 0 at the floor and 6 at the ceiling,
 * with the pass line drawn at 3 — so a card that used to be a struggle and now
 * sits high reads as a climb without anyone having to explain it.
 *
 * The drawing is measured in real pixels rather than stretched from a fixed
 * viewBox, because stretching turns every dot into an ellipse and the amount
 * of distortion depends on the screen.
 */

const BAND = (grade: number) =>
  grade < 3 ? "fail" : grade === 3 ? "mid" : grade < 6 ? "pass" : "retire";

function fmtDay(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The rendered width, so one SVG unit is one pixel. */
function useWidth(): [React.RefObject<HTMLElement>, number] {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export function GradeHistory({
  history,
  compact = false,
}: {
  history: GradeEntry[];
  /** The in-session version: shorter, and captioned in one line. */
  compact?: boolean;
}) {
  const [ref, width] = useWidth();
  if (history.length < 2) return <figure className="sb-history" ref={ref as never} hidden />;

  const height = compact ? 64 : 104;
  const padX = 6;
  const padY = 7;
  const span = history.length - 1;
  const x = (i: number) => padX + (i / span) * (Math.max(width, 2 * padX + 10) - padX * 2);
  const y = (grade: number) => padY + (1 - grade / 6) * (height - padY * 2);

  const line = history.map((entry, i) => `${i ? "L" : "M"}${x(i)},${y(entry.grade)}`).join(" ");
  const area = `${line} L${x(span)},${height} L${x(0)},${height} Z`;
  const last = history[history.length - 1];

  return (
    <figure className="sb-history" data-compact={compact} ref={ref as never}>
      <svg
        width={width || undefined}
        height={height}
        viewBox={`0 0 ${Math.max(width, 1)} ${height}`}
        role="img"
        aria-label={`${history.length} reviews, latest grade ${last.grade}: ${GRADES[last.grade].label}`}
      >
        {/* the line between a miss and a recall */}
        <line className="sb-history-rule" x1={0} x2={width} y1={y(3)} y2={y(3)} />
        <path className="sb-history-area" d={area} />
        <path className="sb-history-line" d={line} />
        {history.map((entry, i) => (
          <circle
            key={`${entry.at}-${i}`}
            className="sb-history-dot"
            data-band={BAND(entry.grade)}
            cx={x(i)}
            cy={y(entry.grade)}
            r={compact ? 2.6 : 3.4}
          />
        ))}
      </svg>
      {compact ? (
        <figcaption>
          your last {history.length} grades for this card · above the line means you recalled it
        </figcaption>
      ) : (
        <figcaption>
          <span>{fmtDay(history[0].at)}</span>
          <span>
            {history.length} reviews · latest {last.grade}/6
          </span>
          <span>{fmtDay(last.at)}</span>
        </figcaption>
      )}
    </figure>
  );
}
