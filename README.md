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
- **Spaced repetition** — a Shuboku 1.0 scheduler built on the FSRS-6 memory
  model schedules every card per profile. Due-count badges show what needs
  review today.
- **Profiles** — several people can study on one device; each profile keeps
  its own collection, schedule and stats. Export/import moves everything
  between devices as JSON.
- **Review sessions** — a focused card panel, 0–6 grading with color-coded
  bands, a grade suggested from how long the recall took, "next review in …"
  feedback after every grade, speech synthesis, kana↔romaji direction toggle,
  optional 60-second auto-reveal, keyboard shortcuts.
- **Streak** — consecutive review days (current and best) tracked per profile.
- **Deck pausing** — pause a deck without losing its schedule, resume any time
  (the bot's "pause block learning").
- **Card browser & stats** — per-card intervals, next-review dates, the bot's
  colored last-grade bar, retire/un-retire, learned/learning/struggling
  breakdowns, per-device profile leaderboard, reviews-per-day history and a
  due forecast for the week.
- **Due reminder** — the tab title shows the live due count, so a pinned tab
  works like the bot's review ping. A built-in guide explains the method.

## The algorithm

Shuboku 1.0 models every (profile, card) memory with **difficulty**,
**stability** and **retrievability**:

- difficulty estimates how inherently hard the card is for this learner;
- stability is the number of days until predicted recall falls to 90%;
- retrievability is the predicted chance of recalling the card right now.

After flipping a card you grade yourself:

| grade | meaning |
|---|---|
| 0 🤬 | Couldn't remember at all |
| 1 😡 | I had some ideas, but no |
| 2 👎 | Was very close |
| 3 👍 | Yes, but was difficult |
| 4 😊 | Hesitated a bit |
| 5 😄 | Remembered easily |
| 6 😎 | Know very well — retires the card |

Grades 0–2 are failed recalls. Grades 3, 4 and 5 map to FSRS Hard, Good and
Easy. This keeps the bot's expressive 0–6 history while giving the memory
model a truthful recalled/forgotten signal.

The slider opens on a suggested grade instead of always at 3. The pause before
you reveal the answer is compared with your own median recall time and with the
card's history: quick recall on a familiar card opens at 5, the same speed on a
card that used to be hard opens at 4, a long pause opens at 3. Past a minute
the clock carries no information and the middle grade returns. The suggestion
is a starting point — the position you release at is the grade recorded.

After each review, FSRS-6 updates difficulty and stability from the grade and
the retrievability at that exact moment. A late successful recall earns a
larger bounded stability gain. A failed recall lowers stability and preserves
residual long-term memory, so one lapse no longer erases years of evidence.

The next interval targets a configurable recall probability: 90% by default,
with 85%, 95% and 97% options. Changing the target leaves existing due dates
in place and applies when each card is reviewed again.

Grade 6 removes the card from rotation; you can un-retire it from the card
browser. A card is due when `time_to_review ≤ now` and it is not retired. The
review queue pulls due cards from selected decks in random order, capped by
the session-length setting.

Progress from the original Leitner-box artifact (`shuboku:v1:progress`) is
migrated automatically on first load. Shuboku 0.1 SM-2 card states upgrade
lazily on their next review, preserving their interval and review count.

The scheduler uses the open-source
[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) implementation of
[FSRS-6](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm).
The rationale and compatibility invariants are recorded in
[ALGORITHM.md](ALGORITHM.md).

## Telegram Mini App

The app is Telegram-aware. Opened inside Telegram (attach the URL to a bot via
BotFather → Bot Settings → Menu Button or `/newapp`), it additionally gets:

- **Cloud sync** — the whole store is mirrored to Telegram CloudStorage
  (chunked under the 4 KB per-key limit), so progress follows your Telegram
  account across devices; the newer copy wins.
- **Haptics everywhere** — a tick as the grading slider crosses each stop,
  soft/rigid taps for collecting and removing decks, success/error buzzes for
  grades, a heavy thump for retiring a card. Regular Android browsers get a
  `navigator.vibrate` fallback.
- **Native chrome** — matching header/background colors, the system Back
  button on sub-screens, expand-on-open, vertical-swipe close disabled so it
  doesn't fight the slider, and a closing confirmation while a review session
  is in progress.
- The default profile is named after your Telegram account on first run.

In a plain browser all of this silently switches off and `localStorage` is
the single source of truth.

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
