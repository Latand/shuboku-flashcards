# 朱墨 Shuboku — Japanese flashcards

Spaced-repetition flashcards for Japanese kana and kanji, with a dark
vermilion-and-ink look. A static Vite + React app; all state lives in your
browser's `localStorage`.

**Live app: <https://latand.github.io/shuboku-flashcards/>**

## What it does

- **Pack catalog** — hiragana and katakana (seion, dakuten, yōon, gairaigo)
  plus beginner kanji sets with on/kun readings. Add packs to your collection;
  only collected packs feed the review queue.
- **Custom decks** — write your own cards (front / back, optional reading and
  note). They study exactly like the built-in packs.
- **Spaced repetition** — an SM-2 variant (ported from the SuperLearningBot
  Telegram bot) schedules every card per profile. Due-count badges show what
  needs review today.
- **Profiles** — several people can study on one device; each profile keeps
  its own collection, schedule and stats. Export/import moves everything
  between devices as JSON.
- **Review sessions** — flip the card, grade yourself 0–6, hear the reading
  via speech synthesis, kana↔romaji direction toggle, keyboard shortcuts.
- **Card browser & stats** — per-card intervals, next-review dates,
  retire/un-retire, reviews-per-day history and a due forecast for the week.

## The algorithm

Per (profile, card) the app stores `n_repetitions`, `easiness_factor`
(start 2.5), `interval` (days), `interval_start`, `time_to_review`,
`total_repetitions`, `last_grade`, `retired`. After flipping a card you grade
yourself:

| grade | meaning |
|---|---|
| 0 🤬 | Couldn't remember at all |
| 1 😡 | I had some ideas, but no |
| 2 👎 | Was very close |
| 3 👍 | Yes, but was difficult |
| 4 😊 | Hesitated a bit |
| 5 😄 | Remembered easily |
| 6 😎 | Know very well — retires the card |

On each review at time `now`:

1. `interval = max(stored_interval, floor(now - interval_start))` — coming
   back later than scheduled and still remembering counts in your favor.
2. Grade ≥ 3: interval goes 1 → 6 → `round(interval × EF)`; grade < 3 resets
   the card (`n_repetitions = 0`, `interval = 1`).
3. `EF += 0.1 − (5 − grade) × (0.08 + (5 − grade) × 0.02)`, clamped at 1.3,
   on every review.
4. `time_to_review = now + interval` days, and `interval_start = now` (a
   deliberate fix over the original bot, which never restarted the clock and
   let the "real interval" inflate forever).

Grade 6 removes the card from rotation; you can un-retire it from the card
browser. A card is due when `time_to_review ≤ now` and it is not retired. The
review queue pulls due cards from selected decks in random order, capped by
the session-length setting.

Progress from the original Leitner-box artifact (`shuboku:v1:progress`) is
migrated automatically on first load.

## Development

Uses [bun](https://bun.sh):

```sh
bun install
bun run dev      # local dev server
bun test         # algorithm + storage unit tests
bun run build    # typecheck + production build
```

Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to
`main` (bun build → `actions/deploy-pages`).
