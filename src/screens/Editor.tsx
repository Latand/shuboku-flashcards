import { useState, type FormEvent } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import type { Screen } from "../App";
import { useApp } from "../store";

const EMPTY = { front: "", back: "", reading: "", note: "" };

export function Editor({
  go,
  initialDeckId,
}: {
  go: (s: Screen) => void;
  initialDeckId?: string;
}) {
  const {
    profile,
    createCustomDeck,
    renameCustomDeck,
    deleteCustomDeck,
    addCustomCard,
    updateCustomCard,
    deleteCustomCard,
    addToCollection,
  } = useApp();

  const [deckId, setDeckId] = useState<string | null>(initialDeckId ?? null);
  const [newDeckName, setNewDeckName] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const deck = deckId ? profile.customDecks[deckId] : null;

  const createDeck = (e: FormEvent) => {
    e.preventDefault();
    const name = newDeckName.trim();
    if (!name) return;
    const id = createCustomDeck(name);
    addToCollection(id);
    setNewDeckName("");
    setDeckId(id);
  };

  const submitCard = (e: FormEvent) => {
    e.preventDefault();
    if (!deckId || !form.front.trim() || !form.back.trim()) return;
    const card = {
      front: form.front.trim(),
      back: form.back.trim(),
      reading: form.reading.trim(),
      note: form.note.trim(),
    };
    if (editingId) {
      updateCustomCard(editingId, card);
      setEditingId(null);
    } else {
      addCustomCard(deckId, card);
    }
    setForm(EMPTY);
  };

  return (
    <div className="sb-root">
      <div className="sb-wrap">
        <div className="sb-bar-top">
          <button
            className="sb-btn sb-icon"
            onClick={() => (deck ? setDeckId(null) : go({ name: "home" }))}
            aria-label="Back"
          >
            <ArrowLeft size={17} />
          </button>
          <span className="sb-meta">custom decks</span>
        </div>

        {!deck ? (
          <section className="sb-sec">
            <div className="sb-sec-head">
              <span className="sb-num">筆</span>
              <span className="sb-sec-jp">自作の札</span>
              <span className="sb-sec-en">Your decks</span>
            </div>
            <p className="sb-blurb">
              Write your own cards — vocabulary, phrases, anything. New decks join your
              collection automatically.
            </p>

            <div className="sb-packs">
              {Object.values(profile.customDecks).map((d) => (
                <button
                  key={d.id}
                  className="sb-btn sb-pack"
                  onClick={() => setDeckId(d.id)}
                >
                  <span className="sb-pack-jp">{d.name}</span>
                  <span className="sb-count">
                    <span className="sb-count-n">{d.cardIds.length}</span>
                    <Pencil size={12} color="#7d7469" />
                  </span>
                </button>
              ))}
            </div>

            <form onSubmit={createDeck}>
              <div className="sb-field">
                <label htmlFor="new-deck">New deck name</label>
                <input
                  id="new-deck"
                  className="sb-input"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="e.g. N5 vocabulary"
                />
              </div>
              <div className="sb-actions">
                <button className="sb-btn sb-act" type="submit" disabled={!newDeckName.trim()}>
                  <Plus size={12} /> Create deck
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="sb-sec">
            <div className="sb-sec-head">
              <span className="sb-num">筆</span>
              <span className="sb-sec-jp">{deck.name}</span>
              <span className="sb-sec-en">{deck.cardIds.length} cards</span>
            </div>

            <div className="sb-field">
              <label htmlFor="deck-name">Deck name</label>
              <input
                id="deck-name"
                className="sb-input"
                value={deck.name}
                onChange={(e) => renameCustomDeck(deck.id, e.target.value)}
              />
            </div>

            <form onSubmit={submitCard}>
              <div className="sb-field">
                <label htmlFor="card-front">Front *</label>
                <input
                  id="card-front"
                  className="sb-input"
                  value={form.front}
                  onChange={(e) => setForm({ ...form, front: e.target.value })}
                  placeholder="猫"
                />
              </div>
              <div className="sb-field">
                <label htmlFor="card-back">Back *</label>
                <input
                  id="card-back"
                  className="sb-input"
                  value={form.back}
                  onChange={(e) => setForm({ ...form, back: e.target.value })}
                  placeholder="cat"
                />
              </div>
              <div className="sb-field">
                <label htmlFor="card-reading">Reading (optional, used for audio)</label>
                <input
                  id="card-reading"
                  className="sb-input"
                  value={form.reading}
                  onChange={(e) => setForm({ ...form, reading: e.target.value })}
                  placeholder="ねこ"
                />
              </div>
              <div className="sb-field">
                <label htmlFor="card-note">Note (optional)</label>
                <input
                  id="card-note"
                  className="sb-input"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="mnemonic, example sentence…"
                />
              </div>
              <div className="sb-actions">
                <button
                  className="sb-btn sb-act"
                  type="submit"
                  disabled={!form.front.trim() || !form.back.trim()}
                >
                  <Plus size={12} /> {editingId ? "Save card" : "Add card"}
                </button>
                {editingId && (
                  <button
                    className="sb-btn sb-act"
                    data-ghost="true"
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setForm(EMPTY);
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            <div className="sb-rows">
              {deck.cardIds.map((id) => {
                const card = profile.customCards[id];
                if (!card) return null;
                return (
                  <div className="sb-row" key={id}>
                    <span className="sb-row-char">{card.char}</span>
                    <span className="sb-row-main">
                      <span>{card.back}</span>
                      {(card.reading || card.note) && (
                        <span className="sb-row-sub" style={{ display: "block" }}>
                          {[card.reading, card.note].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="sb-row-side">
                      <button
                        className="sb-btn sb-pack-side"
                        onClick={() => {
                          setEditingId(id);
                          setForm({
                            front: card.char,
                            back: card.back ?? "",
                            reading: card.reading ?? "",
                            note: card.note ?? "",
                          });
                        }}
                        aria-label="Edit card"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="sb-btn sb-pack-side"
                        onClick={() => deleteCustomCard(deck.id, id)}
                        aria-label="Delete card"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="sb-foot">
              <button
                className="sb-btn sb-reset"
                onClick={() => {
                  if (window.confirm(`Delete deck "${deck.name}" and its cards?`)) {
                    deleteCustomDeck(deck.id);
                    setDeckId(null);
                  }
                }}
              >
                <Trash2 size={11} /> Delete this deck
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
