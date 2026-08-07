import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Flame,
  HelpCircle,
  Pause,
  Pencil,
  Play,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import type { Screen } from "../App";
import { SCRIPTS } from "../data/packs";
import { computeStreak } from "../lib/insights";
import { isDue } from "../lib/scheduler";
import { haptics } from "../lib/telegram";
import { useApp } from "../store";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Home({ go }: { go: (s: Screen) => void }) {
  const app = useApp();
  const {
    profile,
    decks,
    collectedDecks,
    activeDecks,
    addToCollection,
    removeFromCollection,
    togglePaused,
    setSettings,
    collectAndBuildQueue,
    buildPracticeQueue,
    practisableCount,
    nextDeckToLearn,
    dueTomorrow,
  } = app;
  const settings = profile.settings;
  const now = Date.now();
  const streak = computeStreak(profile.reviewLog, now);

  // Session deck picker: every active deck is on unless deselected.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const sessionDecks = activeDecks.filter((d) => !deselected.has(d.id));

  // The deck list is management UI — folded away by default.
  const [collectionOpen, setCollectionOpen] = useState(false);

  const toggleSession = (deckId: string) => {
    haptics.selection();
    setDeselected((prev) => {
      const n = new Set(prev);
      n.has(deckId) ? n.delete(deckId) : n.add(deckId);
      return n;
    });
  };

  const toggleCollected = (deckId: string, inCollection: boolean) => {
    if (inCollection) {
      haptics.impact("rigid");
      removeFromCollection(deckId);
    } else {
      haptics.impact("soft");
      addToCollection(deckId);
    }
  };

  const dueByDeck = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of collectedDecks) m[d.id] = app.dueCount(d.id, now);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectedDecks, profile.cards, now]);

  const totalDue = activeDecks.reduce((a, d) => a + (dueByDeck[d.id] ?? 0), 0);
  const sessionDue = sessionDecks.reduce((a, d) => a + (dueByDeck[d.id] ?? 0), 0);

  const begin = () => {
    const seen = new Set<string>();
    const due: string[] = [];
    for (const deck of sessionDecks) {
      for (const card of deck.cards) {
        if (!seen.has(card.id) && isDue(profile.cards[card.id], now)) {
          seen.add(card.id);
          due.push(card.id);
        }
      }
    }
    // The bot pulled due cards in random order; the session cap comes on top.
    const queue = shuffle(due).slice(0, settings.limit === 0 ? due.length : settings.limit);
    if (queue.length) {
      haptics.impact("medium");
      go({ name: "study", queue });
    }
  };

  const customDecks = decks.filter((d) => !d.builtin);
  const collected = new Set(profile.collection);
  const trackedCount = Object.keys(profile.cards).length;

  const nextDeck = nextDeckToLearn();
  const tomorrow = dueTomorrow();
  const firstRun = collectedDecks.length === 0;

  const practisable = practisableCount();
  const practiseSize = Math.min(practisable, settings.limit === 0 ? 20 : settings.limit);
  const practise = () => {
    const queue = buildPracticeQueue();
    if (!queue.length) return;
    haptics.impact("medium");
    go({ name: "study", queue });
  };

  const learnDeck = (deckId: string) => {
    haptics.impact("medium");
    const queue = collectAndBuildQueue(deckId);
    if (queue.length) go({ name: "study", queue });
  };

  return (
    <div className="sb-root">
      <div className="sb-wrap">
        <header className="sb-mast">
          <div className="sb-seal">朱</div>
          <h1 className="sb-title">朱墨</h1>
          <p className="sb-latin">Shuboku</p>
          <p className="sb-tag">Vermilion and ink. Read the character, then turn the page.</p>
          <div className="sb-chip">
            <b>{profile.name}</b>
            <span>·</span>
            <span className={totalDue ? "sb-due-dot" : ""}>
              {totalDue ? `${totalDue} due today` : "nothing due"}
            </span>
            {streak.current > 0 && (
              <>
                <span>·</span>
                <span className="sb-flame">
                  <Flame size={11} style={{ verticalAlign: "-2px" }} /> {streak.current}d streak
                </span>
              </>
            )}
          </div>
          <nav className="sb-nav">
            <button className="sb-btn" onClick={() => go({ name: "browser" })}>
              <BookOpen size={11} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              Cards
            </button>
            <button className="sb-btn" onClick={() => go({ name: "stats" })}>
              <BarChart3 size={11} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              Stats
            </button>
            <button className="sb-btn" onClick={() => go({ name: "settings" })}>
              <Settings2 size={11} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              Settings
            </button>
            <button className="sb-btn" onClick={() => go({ name: "guide" })}>
              <HelpCircle size={11} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              Guide
            </button>
          </nav>
        </header>

        {/* ---- first run: one obvious way in ---- */}
        {firstRun && nextDeck && (
          <section className="sb-sec" style={{ textAlign: "center" }}>
            <p className="sb-blurb" style={{ fontSize: 14 }}>
              Five minutes a day is enough. Start with the first hiragana pack — the app
              schedules every card for you and tells you when to come back.
            </p>
            <button className="sb-btn sb-start" onClick={() => learnDeck(nextDeck.id)}>
              <Play size={14} strokeWidth={2} />
              Start · {nextDeck.jp} · {nextDeck.cards.length} cards
            </button>
            <div className="sb-actions" style={{ justifyContent: "center" }}>
              <button
                className="sb-btn sb-act"
                data-ghost="true"
                onClick={() => go({ name: "guide" })}
              >
                How it works
              </button>
            </div>
          </section>
        )}

        {/* ---- my collection (folded summary by default) ---- */}
        {!firstRun && (
        <section className="sb-sec">
          <button
            className="sb-btn sb-sec-head"
            style={{ width: "100%" }}
            onClick={() => {
              haptics.selection();
              setCollectionOpen((v) => !v);
            }}
            aria-expanded={collectionOpen}
          >
            <span className="sb-num">蔵</span>
            <span className="sb-sec-jp">蔵書</span>
            <span className="sb-sec-en">
              {collectionOpen ? (
                <ChevronDown size={11} style={{ verticalAlign: "-1px", marginRight: 6 }} />
              ) : (
                <ChevronRight size={11} style={{ verticalAlign: "-1px", marginRight: 6 }} />
              )}
              {collectedDecks.length
                ? `${collectedDecks.length} decks · ${collectedDecks.reduce(
                    (a, d) => a + d.cards.length,
                    0
                  )} cards · ${totalDue} due`
                : "My collection"}
            </span>
          </button>
          {!collectionOpen ? (
            collectedDecks.length === 0 && (
              <div className="sb-empty">Nothing collected yet — add packs from the catalog below.</div>
            )
          ) : collectedDecks.length === 0 ? (
            <div className="sb-empty">
              Nothing collected yet — add packs from the catalog below.
            </div>
          ) : (
            <div className="sb-packs">
              {collectedDecks.map((d) => {
                const paused = profile.paused.includes(d.id);
                const on = !paused && !deselected.has(d.id);
                const due = dueByDeck[d.id] ?? 0;
                return (
                  <div key={d.id} style={{ display: "flex", gap: 8 }}>
                    <button
                      className="sb-btn sb-pack"
                      data-on={on}
                      data-paused={paused}
                      onClick={() => !paused && toggleSession(d.id)}
                      aria-pressed={on}
                      style={{ flex: 1 }}
                    >
                      <span className="sb-mark">
                        {on && <Check size={11} strokeWidth={3} color="#e9e4da" />}
                      </span>
                      <span>
                        <span className="sb-pack-jp">{d.jp}</span>
                        <span className="sb-pack-en" style={{ display: "block" }}>
                          {paused ? "paused" : `${d.name} · ${d.cards.length} cards`}
                        </span>
                      </span>
                      <span className="sb-count">
                        <span className="sb-due-badge" data-zero={paused || due === 0}>
                          {paused ? "⏸" : due}
                        </span>
                      </span>
                    </button>
                    {!d.builtin && (
                      <button
                        className="sb-btn sb-pack-side"
                        onClick={() => go({ name: "editor", deckId: d.id })}
                        aria-label={`Edit ${d.jp}`}
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    <button
                      className="sb-btn sb-pack-side"
                      onClick={() => {
                        haptics.selection();
                        togglePaused(d.id);
                      }}
                      aria-label={paused ? `Resume ${d.name}` : `Pause ${d.name}`}
                      title={paused ? "Resume learning this deck" : "Pause learning (deck stays, reviews stop)"}
                    >
                      {paused ? <Play size={12} /> : <Pause size={12} />}
                    </button>
                    <button
                      className="sb-btn sb-pack-side"
                      onClick={() => {
                        haptics.impact("rigid");
                        removeFromCollection(d.id);
                      }}
                      aria-label={`Remove ${d.name} from collection`}
                      title="Remove from collection (history is kept)"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {/* ---- catalog (only decks not yet collected — the rest live above) ---- */}
        {SCRIPTS.map((s) => {
          const packs = decks.filter(
            (p) => p.builtin && p.script === s.id && !collected.has(p.id)
          );
          if (packs.length === 0) return null;
          return (
            <section className="sb-sec" key={s.id}>
              <div className="sb-sec-head">
                <span className="sb-num">{s.numeral}</span>
                <span className="sb-sec-jp">{s.jp}</span>
                <span className="sb-sec-en">{s.name}</span>
              </div>
              <p className="sb-blurb">{s.blurb}</p>
              <div className="sb-packs">
                {packs.map((p) => {
                  const inCollection = collected.has(p.id);
                  return (
                    <button
                      key={p.id}
                      className="sb-btn sb-pack"
                      data-on={inCollection}
                      onClick={() => toggleCollected(p.id, inCollection)}
                      aria-pressed={inCollection}
                    >
                      <span className="sb-mark">
                        {inCollection && <Check size={11} strokeWidth={3} color="#e9e4da" />}
                      </span>
                      <span>
                        <span className="sb-pack-jp">{p.jp}</span>
                        <span className="sb-pack-en" style={{ display: "block" }}>
                          {p.name}
                        </span>
                      </span>
                      <span className="sb-count">
                        <span className="sb-count-n">{p.cards.length}</span>
                        <span className="sb-pack-side" data-added={inCollection}>
                          {inCollection ? "added" : "add"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* ---- custom decks ---- */}
        <section className="sb-sec">
          <div className="sb-sec-head">
            <span className="sb-num">四</span>
            <span className="sb-sec-jp">自作</span>
            <span className="sb-sec-en">Your own decks</span>
          </div>
          <p className="sb-blurb">Cards you wrote yourself. They study exactly like the packs.</p>
          <div className="sb-packs">
            {customDecks
              .filter((d) => !collected.has(d.id))
              .map((d) => {
              const inCollection = collected.has(d.id);
              return (
                <div key={d.id} style={{ display: "flex", gap: 8 }}>
                  <button
                    className="sb-btn sb-pack"
                    data-on={inCollection}
                    onClick={() => toggleCollected(d.id, inCollection)}
                    aria-pressed={inCollection}
                    style={{ flex: 1 }}
                  >
                    <span className="sb-mark">
                      {inCollection && <Check size={11} strokeWidth={3} color="#e9e4da" />}
                    </span>
                    <span>
                      <span className="sb-pack-jp">{d.jp}</span>
                      <span className="sb-pack-en" style={{ display: "block" }}>
                        {d.cards.length} cards
                      </span>
                    </span>
                    <span className="sb-count">
                      <span className="sb-pack-side" data-added={inCollection}>
                        {inCollection ? "added" : "add"}
                      </span>
                    </span>
                  </button>
                  <button
                    className="sb-btn sb-pack-side"
                    onClick={() => go({ name: "editor", deckId: d.id })}
                    aria-label={`Edit ${d.jp}`}
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              );
            })}
            <button className="sb-btn sb-pack" onClick={() => go({ name: "editor" })}>
              <span className="sb-mark">
                <Plus size={11} strokeWidth={3} />
              </span>
              <span className="sb-pack-en">New custom deck…</span>
            </button>
          </div>
        </section>

        {/* ---- options ---- */}
        <div className="sb-opts">
          <div className="sb-opt">
            <span>
              <span className="sb-opt-label">Session length</span>
              <span className="sb-opt-hint" style={{ display: "block" }}>
                Cap on cards per session.
              </span>
            </span>
            <span className="sb-seg">
              {[20, 50, 0].map((n) => (
                <button
                  key={n}
                  className="sb-btn"
                  data-on={settings.limit === n}
                  onClick={() => setSettings({ limit: n })}
                >
                  {n === 0 ? "ALL" : n}
                </button>
              ))}
            </span>
          </div>

          <div className="sb-opt">
            <span>
              <span className="sb-opt-label">Direction</span>
              <span className="sb-opt-hint" style={{ display: "block" }}>
                {settings.reverse
                  ? "Reading first, character second."
                  : "Character first, reading second."}
              </span>
            </span>
            <span className="sb-seg">
              <button
                className="sb-btn"
                data-on={!settings.reverse}
                onClick={() => setSettings({ reverse: false })}
              >
                字→音
              </button>
              <button
                className="sb-btn"
                data-on={settings.reverse}
                onClick={() => setSettings({ reverse: true })}
              >
                音→字
              </button>
            </span>
          </div>

          <div className="sb-opt">
            <span>
              <span className="sb-opt-label">Auto-reveal</span>
              <span className="sb-opt-hint" style={{ display: "block" }}>
                Flip the card by itself after 60 seconds.
              </span>
            </span>
            <span className="sb-seg">
              <button
                className="sb-btn"
                data-on={settings.autoFlip}
                onClick={() => setSettings({ autoFlip: true })}
              >
                ON
              </button>
              <button
                className="sb-btn"
                data-on={!settings.autoFlip}
                onClick={() => setSettings({ autoFlip: false })}
              >
                OFF
              </button>
            </span>
          </div>

          <div className="sb-opt">
            <span>
              <span className="sb-opt-label">Speak on reveal</span>
              <span className="sb-opt-hint" style={{ display: "block" }}>
                Plays the reading automatically.
              </span>
            </span>
            <span className="sb-seg">
              <button
                className="sb-btn"
                data-on={settings.autoSound}
                onClick={() => setSettings({ autoSound: true })}
              >
                ON
              </button>
              <button
                className="sb-btn"
                data-on={!settings.autoSound}
                onClick={() => setSettings({ autoSound: false })}
              >
                OFF
              </button>
            </span>
          </div>
        </div>

        {!firstRun && (
          <div className="sb-start-row">
            {sessionDue > 0 ? (
              <button className="sb-btn sb-start" onClick={begin}>
                <Play size={14} strokeWidth={2} />
                Review ·{" "}
                {settings.limit === 0 || settings.limit > sessionDue ? sessionDue : settings.limit}{" "}
                cards
              </button>
            ) : practisable > 0 ? (
              /*
               * Nothing due. The thing actually worth doing is practice, so it
               * takes the main button; collecting a new pack is a decision for
               * another day and steps back to a quiet one.
               */
              <button className="sb-btn sb-start" onClick={practise}>
                <Dumbbell size={14} strokeWidth={2} />
                Training · {practiseSize} cards
              </button>
            ) : nextDeck ? (
              <button className="sb-btn sb-start" onClick={() => learnDeck(nextDeck.id)}>
                <Plus size={14} strokeWidth={2} />
                Learn next · {nextDeck.jp} · {nextDeck.cards.length} cards
              </button>
            ) : (
              <button className="sb-btn sb-start" disabled>
                All caught up
              </button>
            )}
            {sessionDue > 0 && practisable > 0 && (
              <button className="sb-btn sb-act" data-ghost="true" onClick={practise}>
                <Dumbbell size={13} /> Training · {practiseSize} at random
              </button>
            )}
            {sessionDue === 0 && practisable > 0 && nextDeck && (
              <button
                className="sb-btn sb-act"
                data-ghost="true"
                onClick={() => learnDeck(nextDeck.id)}
              >
                <Plus size={13} /> Learn next · {nextDeck.jp} · +{nextDeck.cards.length}
              </button>
            )}
            {sessionDue === 0 && tomorrow > 0 && (
              <p className="sb-next-hint">next reviews tomorrow · {tomorrow} cards</p>
            )}
          </div>
        )}

        <div className="sb-foot">
          <span className="sb-count-n" style={{ color: "#554d52" }}>
            {trackedCount} characters tracked
          </span>
        </div>
      </div>
    </div>
  );
}
