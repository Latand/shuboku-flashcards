import { useEffect, useState } from "react";
import { AlertTriangle, Check, LifeBuoy, RefreshCw } from "lucide-react";
import { useApp } from "../store";
import { BUILTIN_DECKS } from "../data/packs";
import { cloudInspect, type CloudDump } from "../lib/telegram";
import {
  assembleTail,
  decksForCards,
  salvageCards,
  salvageReviewLog,
  summarizeSalvage,
  type SalvageSummary,
} from "../lib/salvage";
import { computeStreak } from "../lib/insights";
import type { Screen } from "../App";

/*
 * Reading a lost collection back out of Telegram's cloud.
 *
 * Nothing on this screen writes to the cloud. It looks at what is actually
 * stored, works out how much of an older, larger store is still there, and
 * only puts anything back when the button is pressed.
 */

type Stage =
  | { name: "reading" }
  | { name: "failed"; error: string }
  | { name: "read"; dump: CloudDump; salvage: SalvageSummary | null; decks: string[] }
  | { name: "restored"; cards: number; studyDays: number };

function fmt(at: number | null): string {
  return at == null ? "—" : new Date(at).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function Rescue({ go }: { go: (s: Screen) => void }) {
  const app = useApp();
  const [stage, setStage] = useState<Stage>({ name: "reading" });

  const read = () => {
    setStage({ name: "reading" });
    void (async () => {
      const dump = await cloudInspect();
      if (dump.error) return setStage({ name: "failed", error: dump.error });
      const tail = assembleTail(dump.parts, dump.declared);
      if (!tail) return setStage({ name: "read", dump, salvage: null, decks: [] });
      const cards = salvageCards(tail.text);
      setStage({
        name: "read",
        dump,
        salvage: summarizeSalvage(cards, salvageReviewLog(tail.text)),
        decks: decksForCards(cards, BUILTIN_DECKS),
      });
    })();
  };

  useEffect(read, []);

  /** Put the salvaged cards back, keeping anything this device already has. */
  const restore = (salvage: SalvageSummary, decks: string[]) => {
    const store = app.store;
    const profile = store.profiles[store.activeProfileId];

    // Days this device studied since the loss are real too, so keep whichever
    // count is higher per day rather than letting one side win the whole log.
    const reviewLog = { ...profile.reviewLog };
    for (const [day, count] of Object.entries(salvage.reviewLog))
      reviewLog[day] = Math.max(reviewLog[day] ?? 0, count);

    const restored = {
      ...store,
      savedAt: Date.now(),
      profiles: {
        ...store.profiles,
        [profile.id]: {
          ...profile,
          collection: Array.from(new Set([...profile.collection, ...decks])),
          cards: { ...profile.cards, ...salvage.cards },
          reviewLog,
        },
      },
    };
    app.importJson(JSON.stringify(restored));
    setStage({
      name: "restored",
      cards: Object.keys(salvage.cards).length,
      studyDays: salvage.studyDays,
    });
  };

  return (
    <div className="sb-root">
      <div className="sb-wrap">
        <div className="sb-bar-top">
          <span className="sb-meta">cloud rescue</span>
        </div>

        <section className="sb-sec" style={{ marginTop: 24 }}>
          <div className="sb-sec-head">
            <span className="sb-num">救</span>
            <span className="sb-sec-jp">救出</span>
            <span className="sb-sec-en">Cloud rescue</span>
          </div>

          {stage.name === "reading" && (
            <p className="sb-note">Reading what Telegram's cloud holds. Nothing is written.</p>
          )}

          {stage.name === "failed" && (
            <p className="sb-note">
              <AlertTriangle size={13} /> Could not read the cloud: {stage.error}
            </p>
          )}

          {stage.name === "read" && (
            <>
              <div className="sb-stats" style={{ marginTop: 16 }}>
                <div className="sb-stat">
                  <div className="sb-stat-n">{stage.dump.present.length}</div>
                  <div className="sb-stat-l">chunks in the cloud</div>
                </div>
                <div className="sb-stat">
                  <div className="sb-stat-n">{stage.dump.declared ?? "—"}</div>
                  <div className="sb-stat-l">the app was told to read</div>
                </div>
                <div className="sb-stat">
                  <div className="sb-stat-n">{stage.salvage ? stage.salvage.studied : 0}</div>
                  <div className="sb-stat-l">cards recovered</div>
                </div>
              </div>

              {stage.salvage && stage.salvage.studied > 0 ? (
                <>
                  <p className="sb-note">
                    An older, larger store is still up there. Recovered{" "}
                    <b>{Object.keys(stage.salvage.cards).length} cards</b>,{" "}
                    {stage.salvage.studied} of them with reviews behind them —{" "}
                    {stage.salvage.reviews} reviews in total, from {fmt(stage.salvage.firstReview)}{" "}
                    to {fmt(stage.salvage.lastReview)}. They belong to{" "}
                    {stage.decks.length} pack{stage.decks.length === 1 ? "" : "s"}, which will be
                    collected again.
                    {stage.salvage.studyDays > 0 && (
                      <>
                        {" "}
                        The review log survived too: {stage.salvage.studyDays} study days, a best
                        streak of {computeStreak(stage.salvage.reviewLog, Date.now()).best} days.
                      </>
                    )}
                    {stage.dump.gaps.length > 0 && (
                      <>
                        {" "}
                        {stage.dump.gaps.length} chunk
                        {stage.dump.gaps.length === 1 ? " is" : "s are"} missing, so the very start
                        of the old store is gone — cards written there could not be read.
                      </>
                    )}
                  </p>
                  <div className="sb-foot" style={{ marginTop: 18, borderTop: "none" }}>
                    <button
                      className="sb-btn sb-act"
                      onClick={() => restore(stage.salvage!, stage.decks)}
                    >
                      <LifeBuoy size={13} /> Restore {Object.keys(stage.salvage.cards).length} cards
                    </button>
                    <button className="sb-btn sb-act" data-ghost="true" onClick={read}>
                      <RefreshCw size={13} /> Read again
                    </button>
                  </div>
                </>
              ) : (
                <p className="sb-note">
                  Nothing recoverable above what the app already reads. The cloud holds{" "}
                  {stage.dump.present.length} chunk
                  {stage.dump.present.length === 1 ? "" : "s"} and the app is told to read{" "}
                  {stage.dump.declared ?? 0}, so there is no stranded older store.
                </p>
              )}
            </>
          )}

          {stage.name === "restored" && (
            <p className="sb-note">
              <Check size={13} /> {stage.cards} cards are back, with their intervals and grade
              history
              {stage.studyDays > 0 && <>, and {stage.studyDays} study days with them</>}. They will
              go up to the cloud with the next sync.
            </p>
          )}

          <div className="sb-foot" style={{ marginTop: 24 }}>
            <button className="sb-btn sb-act" data-ghost="true" onClick={() => go({ name: "home" })}>
              Back to the app
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
