import { useEffect, useState } from "react";
import { ArrowLeft, Repeat } from "lucide-react";
import { haptics, setTelegramBack } from "./lib/telegram";
import { AppProvider } from "./store";
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
  useEffect(() => {
    haptics.notify("success");
  }, []);
  return (
    <div className="sb-root">
      <div className="sb-wrap">
        <div className="sb-stage">
          <div className="sb-seal" style={{ marginBottom: 26 }}>了</div>
          <h2 className="sb-title" style={{ fontSize: "clamp(30px,8vw,46px)" }}>完</h2>
          <p className="sb-latin" style={{ marginTop: 10 }}>Session complete</p>

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
            <button className="sb-btn sb-reveal" onClick={() => go({ name: "home" })}>
              <Repeat size={14} /> Back to the shelf
            </button>
            <button
              className="sb-btn sb-act"
              data-ghost="true"
              style={{ justifyContent: "center" }}
              onClick={() => go({ name: "stats" })}
            >
              <ArrowLeft size={13} /> See stats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Router() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });

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
