import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Flame, Play, Plus } from "lucide-react";
import { computeStreak } from "./lib/insights";
import { haptics, setTelegramBack } from "./lib/telegram";
import { AppProvider, useApp } from "./store";
import { Home } from "./screens/Home";
import { Study, type SessionResult } from "./screens/Study";
import { Browser } from "./screens/Browser";
import { Editor } from "./screens/Editor";
import { Stats } from "./screens/Stats";
import { Settings } from "./screens/Settings";
import { Guide } from "./screens/Guide";

export type Screen =
  | { name: "home" }
  | { name: "study"; queue: string[] }
  | { name: "done"; result: SessionResult }
  | { name: "browser" }
  | { name: "editor"; deckId?: string }
  | { name: "stats" }
  | { name: "settings" }
  | { name: "guide" };

function Done({ result, go }: { result: SessionResult; go: (s: Screen) => void }) {
  const app = useApp();
  useEffect(() => {
    haptics.notify("success");
  }, []);

  const dueLeft = app.dueNow();
  const tomorrow = app.dueTomorrow();
  const nextDeck = app.nextDeckToLearn();
  const streak = computeStreak(app.profile.reviewLog, Date.now());

  const continueReview = () => {
    haptics.impact("medium");
    const queue = app.buildSessionQueue();
    if (queue.length) go({ name: "study", queue });
  };
  const learnNext = () => {
    if (!nextDeck) return;
    haptics.impact("medium");
    const queue = app.collectAndBuildQueue(nextDeck.id);
    if (queue.length) go({ name: "study", queue });
  };

  return (
    <div className="sb-root">
      <div className="sb-wrap">
        <div className="sb-stage">
          <div className="sb-seal" style={{ marginBottom: 26 }}>了</div>
          <h2 className="sb-title" style={{ fontSize: "clamp(30px,8vw,46px)" }}>完</h2>
          <p className="sb-latin" style={{ marginTop: 10 }}>Session complete</p>
          {streak.current > 0 && (
            <p className="sb-next-hint" style={{ marginTop: 0 }}>
              <Flame size={11} className="sb-flame" style={{ verticalAlign: "-1px" }} />{" "}
              {streak.current}-day streak
              {streak.current >= streak.best && streak.best > 1 ? " · personal best" : ""}
            </p>
          )}

          <div className="sb-stats" style={{ width: "100%", maxWidth: 460 }}>
            <div className="sb-stat">
              <div className="sb-stat-n">{result.total}</div>
              <div className="sb-stat-l">cards</div>
            </div>
            <div className="sb-stat">
              <div className="sb-stat-n">{result.again}</div>
              <div className="sb-stat-l">relearned</div>
            </div>
            <div className="sb-stat">
              <div className="sb-stat-n">{result.retired}</div>
              <div className="sb-stat-l">retired</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 460 }}>
            {dueLeft > 0 ? (
              <button className="sb-btn sb-reveal" onClick={continueReview}>
                <Play size={14} /> Continue · {dueLeft} still due
              </button>
            ) : nextDeck ? (
              <button className="sb-btn sb-reveal" onClick={learnNext}>
                <Plus size={14} /> Learn next · {nextDeck.jp}
              </button>
            ) : null}
            {dueLeft === 0 && tomorrow > 0 && (
              <p className="sb-next-hint" style={{ margin: 0 }}>
                next reviews tomorrow · {tomorrow} cards
              </p>
            )}
            <button
              className="sb-btn sb-act"
              data-ghost="true"
              style={{ justifyContent: "center" }}
              onClick={() => go({ name: "home" })}
            >
              <ArrowLeft size={13} /> Back to the shelf
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Router() {
  const app = useApp();
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const booted = useRef(false);

  // Opening the app lands straight in a review when cards are waiting —
  // the menu is for browsing, not the default.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const queue = app.buildSessionQueue();
    if (queue.length) setScreen({ name: "study", queue });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Telegram's native back button leads home from any sub-screen.
  useEffect(() => {
    setTelegramBack(screen.name !== "home", () => setScreen({ name: "home" }));
  }, [screen.name]);

  switch (screen.name) {
    case "home":
      return <Home go={setScreen} />;
    case "study":
      return (
        <Study
          initialQueue={screen.queue}
          onExit={() => setScreen({ name: "home" })}
          onDone={(result) => setScreen({ name: "done", result })}
        />
      );
    case "done":
      return <Done result={screen.result} go={setScreen} />;
    case "browser":
      return <Browser go={setScreen} />;
    case "editor":
      return <Editor go={setScreen} initialDeckId={screen.deckId} />;
    case "stats":
      return <Stats go={setScreen} />;
    case "settings":
      return <Settings go={setScreen} />;
    case "guide":
      return <Guide go={setScreen} />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
