import { useState } from "react";
import { ArrowLeft, Check, Download, Plus, Trash2, Upload, UserRound } from "lucide-react";
import type { Screen } from "../App";
import { haptics } from "../lib/telegram";
import { useApp } from "../store";

export function Settings({ go }: { go: (s: Screen) => void }) {
  const app = useApp();
  const { store, profile } = app;
  const [newName, setNewName] = useState("");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const download = () => {
    const blob = new Blob([app.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shuboku-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    if (!importText.trim()) return;
    if (!window.confirm("Importing replaces ALL current data (every profile). Continue?")) return;
    try {
      app.importJson(importText);
      setImportText("");
      setImportMsg("Imported.");
    } catch (e) {
      setImportMsg("Import failed: " + (e instanceof Error ? e.message : "invalid JSON"));
    }
  };

  const profiles = Object.values(store.profiles);

  return (
    <div className="sb-root">
      <div className="sb-wrap">
        <div className="sb-bar-top">
          <button className="sb-btn sb-icon" onClick={() => go({ name: "home" })} aria-label="Back">
            <ArrowLeft size={17} />
          </button>
          <span className="sb-meta">settings</span>
        </div>

        <section className="sb-sec">
          <div className="sb-sec-head">
            <span className="sb-num">人</span>
            <span className="sb-sec-jp">学ぶ人</span>
            <span className="sb-sec-en">Profiles</span>
          </div>
          <p className="sb-blurb">
            Each profile keeps its own collection, custom decks and review schedule.
          </p>

          <div className="sb-packs">
            {profiles.map((p) => {
              const active = p.id === store.activeProfileId;
              return (
                <div key={p.id} style={{ display: "flex", gap: 8 }}>
                  <button
                    className="sb-btn sb-pack"
                    data-on={active}
                    onClick={() => {
                      haptics.selection();
                      app.switchProfile(p.id);
                    }}
                    style={{ flex: 1 }}
                  >
                    <span className="sb-mark">
                      {active && <Check size={11} strokeWidth={3} color="#e9e4da" />}
                    </span>
                    <UserRound size={14} color="#7d7469" />
                    <span>
                      <span className="sb-pack-jp">{p.name}</span>
                      <span className="sb-pack-en" style={{ display: "block" }}>
                        {Object.keys(p.cards).length} cards tracked
                      </span>
                    </span>
                  </button>
                  <button
                    className="sb-btn sb-pack-side"
                    onClick={() => {
                      const name = window.prompt("Rename profile", p.name);
                      if (name?.trim()) app.renameProfile(p.id, name.trim());
                    }}
                    aria-label={`Rename ${p.name}`}
                  >
                    rename
                  </button>
                  {profiles.length > 1 && (
                    <button
                      className="sb-btn sb-pack-side"
                      onClick={() => {
                        if (window.confirm(`Delete profile "${p.name}" and all its progress?`))
                          app.deleteProfile(p.id);
                      }}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) {
                app.createProfile(newName.trim());
                setNewName("");
              }
            }}
          >
            <div className="sb-field">
              <label htmlFor="new-profile">New profile name</label>
              <input
                id="new-profile"
                className="sb-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Yuki"
              />
            </div>
            <div className="sb-actions">
              <button className="sb-btn sb-act" type="submit" disabled={!newName.trim()}>
                <Plus size={12} /> Create & switch
              </button>
            </div>
          </form>
        </section>

        <section className="sb-sec">
          <div className="sb-sec-head">
            <span className="sb-num">箱</span>
            <span className="sb-sec-jp">持ち出し</span>
            <span className="sb-sec-en">Export / import</span>
          </div>
          <p className="sb-blurb">
            Move your progress between devices as a JSON file. The export contains every profile.
          </p>
          <div className="sb-actions">
            <button className="sb-btn sb-act" onClick={download}>
              <Download size={12} /> Download export
            </button>
          </div>
          <div className="sb-field">
            <label htmlFor="import-json">Paste an export to import</label>
            <textarea
              id="import-json"
              className="sb-textarea"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"version":2,...}'
            />
          </div>
          <div className="sb-actions">
            <button className="sb-btn sb-act" onClick={doImport} disabled={!importText.trim()}>
              <Upload size={12} /> Import (replaces everything)
            </button>
          </div>
          {importMsg && <p className="sb-note">{importMsg}</p>}
        </section>

        <div className="sb-foot">
          <button
            className="sb-btn sb-reset"
            onClick={() => {
              if (
                window.confirm(
                  `Erase all repetition history for "${profile.name}"? The collection and custom decks stay.`
                )
              )
                app.resetProfileProgress();
            }}
          >
            <Trash2 size={11} /> Reset progress for this profile
          </button>
        </div>
      </div>
    </div>
  );
}
