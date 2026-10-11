import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { newCardState, review, type Grade } from "../../src/lib/scheduler";
import { isPackOn, parseProgress, type Direction, type Progress } from "../shared/progress";
import { PACKS } from "./data/words";
import { loadProgress, saveProgress } from "./lib/store";
import { createSync, type SyncTransport } from "./lib/sync";
import { callEndpoint } from "./lib/tgcloud";
import { buildQueue } from "./lib/queue";
import { haptics } from "./lib/tg";
import { Home } from "./screens/Home";
import { Study } from "./screens/Study";

/*
 * The transport only activates when Telegram exposes authenticated Serverless
 * calls. Outside Telegram, studying remains local and makes no network request.
 */
const telegramTransport: SyncTransport = {
  available: () =>
    typeof window !== "undefined" &&
    Boolean((window as Window & { Telegram?: { WebApp?: { initData?: string; Serverless?: unknown } } }).Telegram?.WebApp?.initData) &&
    Boolean((window as Window & { Telegram?: { WebApp?: { Serverless?: unknown } } }).Telegram?.WebApp?.Serverless),
  async sync(local) {
    const response = await callEndpoint<{ progress?: unknown }>("sync", { progress: local });
    const remote = parseProgress(response?.progress);
    if (!remote) throw new Error("invalid-sync-response");
    return remote;
  },
};
const transport = telegramTransport;

export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const ref = useRef(progress);
  const [session, setSession] = useState<string[] | null>(null);

  const syncRef = useRef<ReturnType<typeof createSync> | null>(null);
  if (!syncRef.current) {
    syncRef.current = createSync({
      transport,
      load: () => ref.current,
      save: (p) => {
        ref.current = p;
        saveProgress(p);
      },
      onMerged: setProgress,
    });
  }
  const sync = syncRef.current;
  const status = useSyncExternalStore(sync.subscribe, sync.status);

  const commit = useCallback(
    (next: Progress) => {
      ref.current = next;
      setProgress(next);
      saveProgress(next);
      sync.changed();
    },
    [sync]
  );

  useEffect(() => {
    void sync.start();
    const onHide = () => {
      if (document.visibilityState === "hidden") void sync.flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [sync]);

  const setPack = (packId: string, on: boolean) => {
    const cur = ref.current;
    if (isPackOn(cur, packId) === on) return;
    haptics.impact(on ? "soft" : "rigid");
    commit({ ...cur, packs: { ...cur.packs, [packId]: { on, at: Date.now() } } });
  };

  const setDirection = (direction: Direction) => {
    const cur = ref.current;
    if (cur.settings.direction === direction) return;
    haptics.selection();
    commit({ ...cur, settings: { direction, at: Date.now() } });
  };

  const grade = (cardId: string, g: Grade) => {
    const cur = ref.current;
    const now = Date.now();
    const next = review(cur.cards[cardId] ?? newCardState(now), g, now);
    commit({ ...cur, cards: { ...cur.cards, [cardId]: next } });
  };

  const start = () => {
    const queue = buildQueue(ref.current, PACKS, Date.now());
    if (queue.length === 0) return;
    haptics.impact("medium");
    setSession(queue);
  };

  if (session) {
    return <Study queue={session} progress={progress} onGrade={grade} onExit={() => setSession(null)} />;
  }
  return (
    <Home
      progress={progress}
      status={status}
      onStart={start}
      onPack={setPack}
      onDirection={setDirection}
    />
  );
}
