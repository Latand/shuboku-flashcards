import { useEffect, useMemo, useRef, useState } from "react";
import { newCardState, review, type Grade } from "../../../src/lib/scheduler";
import type { Progress } from "../../shared/progress";
import { PACKS, WORD_BY_ID, type Article, type Word } from "../data/words";
import { cardsLabel, formatInterval } from "../lib/format";
import { nextReviewInDays, requeueOnMiss } from "../lib/queue";
import { haptics, setClosingConfirmation, setTelegramBack } from "../lib/tg";

type Choice = 1 | 3 | 4 | 5;

const CHOICES: { grade: Choice; label: string; tone: string }[] = [
  { grade: 1, label: "Не згадав", tone: "miss" },
  { grade: 3, label: "Важко", tone: "hard" },
  { grade: 4, label: "Добре", tone: "good" },
  { grade: 5, label: "Легко", tone: "easy" },
];

const GENDER: Record<Article, string> = { der: "чоловічий", die: "жіночий", das: "середній" };

interface StudyProps {
  queue: string[];
  progress: Progress;
  onGrade(cardId: string, grade: Grade): void;
  onExit(): void;
}

export function Study({ queue: initial, progress, onGrade, onExit }: StudyProps) {
  const [queue, setQueue] = useState(initial);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const retried = useRef(new Set<string>());
  const seen = useRef(new Set<string>());
  const direction = progress.settings.direction;

  const id = queue[index];
  const word = id ? WORD_BY_ID.get(id) : undefined;
  const finished = index >= queue.length;

  // Native Back leaves the session; closing the app asks first.
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  useEffect(() => {
    setTelegramBack(true, () => exitRef.current());
    return () => setTelegramBack(false, () => {});
  }, []);
  useEffect(() => {
    setClosingConfirmation(!finished);
    return () => setClosingConfirmation(false);
  }, [finished]);

  // What each button would schedule, computed once per card and never saved.
  const forecast = useMemo(() => {
    if (!id) return null;
    const now = Date.now();
    const base = progress.cards[id] ?? newCardState(now);
    return Object.fromEntries(CHOICES.map((c) => [c.grade, review(base, c.grade, now).interval])) as Record<
      Choice,
      number
    >;
    // The state only changes when this card is graded, which moves to the next position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, index]);

  const answer = (grade: Choice) => {
    if (!id || !revealed) return;
    haptics.notify(grade === 1 ? "warning" : "success");
    seen.current.add(id);
    onGrade(id, grade);
    setQueue(requeueOnMiss(queue, index, grade === 1, retried.current));
    setIndex(index + 1);
    setRevealed(false);
  };

  const reveal = () => {
    if (finished || revealed) return;
    haptics.impact("light");
    setRevealed(true);
  };

  const handlers = useRef({ answer, reveal });
  handlers.current = { answer, reveal };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const choice = CHOICES[Number(e.key) - 1];
      if (choice) {
        handlers.current.answer(choice.grade);
        return;
      }
      if ((e.key === " " || e.key === "Enter") && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        handlers.current.reveal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (finished || !word) {
    return <Done count={seen.current.size} progress={progress} onExit={onExit} />;
  }

  return (
    <main className="page study">
      <header className="study-top">
        <button type="button" className="btn btn-small btn-quiet" onClick={onExit}>
          ← Назад
        </button>
        <p className="progress-count" aria-live="polite">
          {index + 1} / {queue.length}
        </p>
      </header>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>

      <Card word={word} direction={direction} revealed={revealed} onReveal={reveal} />

      {revealed ? (
        <div className="grades" role="group" aria-label="Як добре ти згадав?">
          {CHOICES.map((c, i) => (
            <button
              key={c.grade}
              type="button"
              className={`grade grade-${c.tone}`}
              onClick={() => answer(c.grade)}
              aria-keyshortcuts={String(i + 1)}
            >
              <span className="grade-label">{c.label}</span>
              <span className="grade-next">{formatInterval(forecast?.[c.grade] ?? 0)}</span>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="btn btn-primary reveal" onClick={reveal}>
          Показати відповідь
        </button>
      )}
    </main>
  );
}

function Art({ article }: { article: Article }) {
  return <span className={`art art-${article}`}>{article}</span>;
}

/** The German word as written on the card: coloured article, then the word. */
function German({ word }: { word: Word }) {
  return (
    <span className="de">
      {word.article && (
        <>
          <Art article={word.article} />{" "}
        </>
      )}
      {word.de}
    </span>
  );
}

/** "wir sind" with the verb form picked out against its pronoun. */
function Form({ word }: { word: Word }) {
  const lead = word.cloze!.split(" … ")[0]!;
  return (
    <span className="de">
      {lead} <mark className="verb-form">{word.de.slice(lead.length).trim()}</mark>
    </span>
  );
}

function Card({
  word,
  direction,
  revealed,
  onReveal,
}: {
  word: Word;
  direction: Progress["settings"]["direction"];
  revealed: boolean;
  onReveal(): void;
}) {
  const toGerman = direction === "uk-de";
  const isForm = word.pos === "form";
  // On a German front the article is part of what is shown; on a Ukrainian front it is what to guess.
  const genderShown = word.article && (!toGerman || revealed);
  const germanBack = isForm ? <Form word={word} /> : <German word={word} />;

  return (
    <section
      className="card"
      data-gender={genderShown ? word.article : undefined}
      onClick={revealed ? undefined : onReveal}
    >
      {genderShown && word.article && (
        <p className="gender">
          {word.article} · {GENDER[word.article]}
        </p>
      )}

      {toGerman ? (
        <>
          <p className="front uk-front">{word.uk}</p>
          {word.ukHint && <p className="clue">{word.ukHint}</p>}
          {word.article && !revealed && <p className="clue">der / die / das?</p>}
        </>
      ) : (
        <>
          <p className="front">{isForm ? <span className="de">{word.cloze}</span> : <German word={word} />}</p>
          {word.deHint && <p className="clue de-clue">{word.deHint}</p>}
        </>
      )}

      {revealed && (
        <div className="answer">
          {toGerman ? (
            <p className="back">{germanBack}</p>
          ) : (
            <>
              <p className="back">{isForm ? germanBack : <span className="uk-back">{word.uk}</span>}</p>
              {isForm && <p className="uk-back">{word.uk}</p>}
            </>
          )}
          {word.pos === "noun" &&
            (word.plural ? (
              <p className="plural">
                мн.: <span className="art art-plural">die</span> {word.plural}
              </p>
            ) : (
              <p className="plural">зазвичай без множини</p>
            ))}
          {word.note && <p className="note">{word.note}</p>}
        </div>
      )}
    </section>
  );
}

function Done({ count, progress, onExit }: { count: number; progress: Progress; onExit(): void }) {
  const next = nextReviewInDays(progress, PACKS, Date.now());
  return (
    <main className="page done">
      <section className="panel done-card">
        <h1 className="title">Готово!</h1>
        <p className="done-count">Готово: {cardsLabel(count)}</p>
        <p className="muted">
          {next === null ? "Наступних повторень поки немає." : `Наступне повторення: ${formatInterval(next)}.`}
        </p>
        <button type="button" className="btn btn-primary" onClick={onExit}>
          На головну
        </button>
      </section>
    </main>
  );
}
