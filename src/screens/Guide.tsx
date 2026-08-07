import { ArrowLeft } from "lucide-react";
import type { Screen } from "../App";

const SECTIONS: { jp: string; en: string; body: string[] }[] = [
  {
    jp: "忘却曲線",
    en: "The forgetting curve",
    body: [
      "Ebbinghaus showed in the 1880s how fast new information fades: most of it is gone within days unless you meet it again. Every well-timed repetition flattens the curve, so each review buys you a longer stretch of remembering.",
      "Spaced repetition brings a memory back near the edge of forgetting. Successful recall there strengthens it efficiently.",
    ],
  },
  {
    jp: "仕組み",
    en: "How Shuboku schedules cards",
    body: [
      "Every card carries two estimates: its inherent difficulty and the stability of your memory. Shuboku combines them with elapsed time to predict your current chance of recall.",
      "Grades 0–2 record a missed recall. Grades 3, 4 and 5 record a hard, solid or easy success. A miss lowers stability while preserving evidence from older successful reviews.",
      "The recall target sets when the card returns. The 90% default balances daily work and reliable recall; higher targets create shorter intervals.",
      "Grade 6 retires a card completely — use it for characters you truly know. You can bring retired cards back from the card browser.",
      "A late successful recall carries extra evidence. The model sees the lower probability at that moment and awards a larger, bounded gain in stability.",
    ],
  },
  {
    jp: "評価のコツ",
    en: "How to grade honestly",
    body: [
      "Grade the effort required for recall. Hesitated a while? That's a 4, maybe a 3. Peeked at the answer and thought “of course” — that recognition feeling is exactly what grade 2 is for: recognizing is much easier than recalling.",
      "Give a card about 30 seconds. When nothing surfaces, flip it and grade low. That honest signal improves the next schedule. The settings include an auto-reveal option.",
      "Under the slider is the card's own record: every grade you have given it, oldest on the left, with the dotted line marking the border between a miss and a recall. A card that starts low and climbs is one you are learning; the full version, with dates, opens from the card browser.",
      "The slider already opens somewhere: the pause before you revealed the answer, measured against your own usual pace and this card's history, picks a starting grade and says why underneath. Quick recall on a familiar card opens confident, a long pause on a card that keeps fighting back opens at 3. Past a minute the clock says nothing and the middle grade returns. It is only a starting point — where you release still decides.",
    ],
  },
  {
    jp: "習慣",
    en: "Make it a habit",
    body: [
      "The schedule only works if you show up: a few minutes daily beats an hour once a week. The due badge tells you exactly what today costs; the streak counter keeps you honest.",
      "Nothing due and still in the mood? Training pulls a random handful from the cards you struggle with most, and with an empty queue it is the main button on the home screen \u2014 collecting a new pack waits below it. These are ordinary reviews: recall one early and it earns a longer interval, miss it and it comes back soon, exactly as it would on schedule.",
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
          Shuboku 1.0 uses the FSRS-6 memory model. Its 0–6 grading language and manual
          retirement come from the author&rsquo;s SuperLearningBot. Reading:{" "}
          <a
            href="https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm"
            style={{ color: "#e2242f" }}
          >
            the FSRS algorithm
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
