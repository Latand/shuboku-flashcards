# Shuboku Flashcards — build brief

## Goal

Turn the Claude artifact `reference/shuboku-artifact.jsx` (a single-file React flashcards app for Japanese kana + kanji, codename "Shuboku") into a real, polished Vite + React app and publish it on GitHub Pages at `https://latand.github.io/shuboku-flashcards/`.

The core change: replace the artifact's simple Leitner-box progress with the owner's proven spaced-repetition algorithm from his Telegram bot **SuperLearningBot** (SM-2 variant, spec below, original source in `reference/supermemo.py`). The app must track, per card, who studied it, when, with what result, and schedule what to show next — well-known cards appear less and less often.

## Tooling rules

- Use **bun** for everything (`bun install`, `bun run`, `bunx`). Never npm/npx.
- Vite + React (JavaScript or TypeScript — your choice, TS preferred).
- No backend. This is a static site; all state lives in `localStorage`.
- Repo: create **`Latand/shuboku-flashcards`** (public) with `gh repo create`, push `main`, deploy Pages via a GitHub Actions workflow (`actions/deploy-pages`, build with bun). Set Vite `base: '/shuboku-flashcards/'`.

## The algorithm (port faithfully, then improve where noted)

Source of truth: `reference/supermemo.py` plus the bot's review flow. Spec:

### Grading

After the user flips a card, they grade themselves on a 0–6 scale (keep the emoji + short label UI):

| grade | label |
|---|---|
| 0 | 🤬 Couldn't remember at all |
| 1 | 😡 I had some ideas, but no |
| 2 | 👎 Was very close |
| 3 | 👍 Yes, but was difficult |
| 4 | 😊 Hesitated a bit |
| 5 | 😄 Remembered easily |
| 6 | 😎 Know very well. Don't remind me again |

Grade **6** retires the card: it leaves the review rotation entirely (keep it in storage with a `retired` flag so the user can un-retire it from a card-browser screen).

### SM-2 update (grades 0–5)

State per (user, card): `n_repetitions`, `easiness_factor` (start 2.5), `interval` (days, start 0), `interval_start` (timestamp), `time_to_review` (timestamp), `total_repetitions`, `last_grade`.

On review at time `now`:

1. `real_interval_days = floor((now - interval_start) / 1 day)`; `interval = max(stored_interval, real_interval_days)` — if the user came back later than scheduled and still remembered, the longer real interval counts.
2. If `grade >= 3`:
   - `n_repetitions == 0` → `interval = 1`
   - `n_repetitions == 1` → `interval = 6`
   - else → `interval = round(interval * easiness_factor)`
   - `n_repetitions += 1`
3. If `grade < 3`: `n_repetitions = 0`, `interval = 1` (card relearns from scratch).
4. `easiness_factor += 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)`, clamp to `>= 1.3`. (Applied on every review, success or failure.)
5. `time_to_review = now + interval days`; `total_repetitions += 1`; `last_grade = grade`.
6. **Improvement over the bot** (the bot kept the old `interval_start` on success, which inflates `real_interval` forever — treat that as a bug): set `interval_start = now` on **every** review. Add a code comment explaining this deviation.

New cards added to the collection: `easiness_factor = 2.5`, `interval = 0`, `n_repetitions = 0`, `time_to_review = now` (due immediately).

### Review queue

- A card is **due** when `time_to_review <= now` and it is not retired.
- A review session pulls due cards from the decks the user selected, in random order (the bot used `ORDER BY random()`); optionally cap per-session count (the artifact has a `limit` setting — keep it).
- Show due-count badges per deck and a total, so opening the app answers "what do I need to review today".
- Cards never seen before are due immediately; interleave them with due reviews.

## Collection model

Mirror the bot's Block/UserBlock idea in local terms:

- Built-in **packs** already exist in the artifact (hiragana/katakana seion, dakuten, yōon, gairaigo, kanji sets). These are the "published blocks" catalog.
- The user **adds packs to their collection** — only collected packs feed the review queue. Adding a pack initializes repetition state for its cards (due immediately).
- The user can also **create custom cards** (front / back, optional reading + note) and group them into their own custom decks. Custom decks behave exactly like built-in packs.
- Removing a pack from the collection removes its cards from rotation (keep the repetition history in storage; restore it if re-added).

## Storage

- `localStorage`, versioned key (e.g. `shuboku:v2`), with a schema-version field and a migration from the artifact's old `shuboku:v1:progress` Leitner data if present (map box number to a rough interval so early users lose nothing).
- Support **profiles** ("who studied"): a simple named-profile switcher (default profile auto-created). All repetition state is per profile. Include an export/import (JSON download / paste) so state can move between devices.

## Keep from the artifact

- The look & feel, TTS (speechSynthesis) with auto-sound toggle, reverse mode, kana↔romaji direction, kanji packs with on/kun readings, session tally, and the general deck-selection UX. Improve visuals where cheap, keep it mobile-friendly (this will be used from a phone).
- Screens to end with: deck catalog + my collection, review session, card browser (per deck, with per-card stats: last grade, interval, next review, total reps, retire/un-retire), custom-card editor, simple stats screen (reviews per day, due forecast for the next week), settings.

## Definition of done

1. `bun run build` passes clean.
2. Repo `Latand/shuboku-flashcards` pushed, Actions workflow green, **page live** at `https://latand.github.io/shuboku-flashcards/` — verify with an actual HTTP fetch of the deployed URL and check the app shell renders (script tags point at hashed assets that return 200).
3. Algorithm unit-tested: a small test file covering the SM-2 table above (grade sequences 5,5,5 → intervals 1,6,15; a failure resets; EF clamp at 1.3; grade 6 retires; late-review `max(real, stored)` behavior). Run tests with `bun test` or vitest.
4. README with a short description, the algorithm summary, and the live URL.

Commit in sensible increments. When done, reply with the live URL and a summary of what was built.
