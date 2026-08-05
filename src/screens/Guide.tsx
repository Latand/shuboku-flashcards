import { ArrowLeft } from "lucide-react";
import type { Screen } from "../App";

const SECTIONS: { jp: string; en: string; body: string[] }[] = [
  {
    jp: "忘却曲線",
    en: "The forgetting curve",
    body: [
      "Ebbinghaus showed in the 1880s how fast new information fades: most of it is gone within days unless you meet it again. Every well-timed repetition flattens the curve, so each review buys you a longer stretch of remembering.",
      "That is all spaced repetition is — reviewing right before you would forget, instead of cramming.",
    ],
  },
  {
    jp: "仕組み",
    en: "How Shuboku schedules cards",
    body: [
      "Every card carries its own schedule. After you flip it, you grade yourself from 0 to 6. Good grades stretch the next interval (1 day → 6 days → weeks → months); failed grades shrink it back to a day and the card relearns from scratch.",
      "Grade 6 retires a card completely — use it for characters you truly know. You can bring retired cards back from the card browser.",
      "Coming back late is fine: if you still remember a card after a longer gap than planned, the longer gap is what counts.",
    ],
  },
  {
    jp: "評価のコツ",
    en: "How to grade honestly",
    body: [
      "Grade how hard the recall felt, not whether you eventually got there. Hesitated a while? That's a 4, maybe a 3. Peeked at the answer and thought “of course” — that recognition feeling is exactly what grade 2 is for: recognizing is much easier than recalling.",
      "Don't sit on one card. If nothing surfaces within ~30 seconds, flip it and grade low — that's useful signal, not failure. There's an auto-reveal option in the settings for this.",
    ],
  },
  {
    jp: "習慣",
    en: "Make it a habit",
    body: [
      "The schedule only works if you show up: a few minutes daily beats an hour once a week. The due badge tells you exactly what today costs; the streak counter keeps you honest.",
      "Add packs gradually. A fresh pack lands as a pile of due cards — clear it before collecting the next one.",
      "For your own cards, write hints that connect to something personally familiar — associations are what make recall stick.",
    ],
  },
];

export function Guide({ go }: { go: (s: Screen) => void }) {
  return (
    <div className="sb-root">
      <div className="sb-wrap">
        <div className="sb-bar-top">
          <button className="sb-btn sb-icon" onClick={() => go({ name: "home" })} aria-label="Back">
            <ArrowLeft size={17} />
          </button>
          <span className="sb-meta">guide</span>
        </div>

        {SECTIONS.map((s, i) => (
          <section className="sb-sec" key={s.en}>
            <div className="sb-sec-head">
              <span className="sb-num">{["一", "二", "三", "四"][i]}</span>
              <span className="sb-sec-jp">{s.jp}</span>
              <span className="sb-sec-en">{s.en}</span>
            </div>
            {s.body.map((p) => (
              <p className="sb-blurb" key={p.slice(0, 24)} style={{ fontSize: 14 }}>
                {p}
              </p>
            ))}
          </section>
        ))}

        <p className="sb-note" style={{ marginTop: 32 }}>
          The scheduling algorithm is the SuperMemo-2 variant from the author's SuperLearningBot,
          with the 0–6 grading scale kept intact. Reading:{" "}
          <a href="https://super-memory.com/english/ol/sm2.htm" style={{ color: "#e2242f" }}>
            the SM-2 algorithm
          </a>{" "}
          ·{" "}
          <a
            href="https://www.supermemo.com/en/blog/twenty-rules-of-formulating-knowledge"
            style={{ color: "#e2242f" }}
          >
            20 rules of formulating knowledge
          </a>
          .
        </p>
      </div>
    </div>
  );
}
