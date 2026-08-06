# Shuboku scheduler 1.0

This document records the product intent, memory model and compatibility rules
behind the scheduler in `src/lib/scheduler.ts`.

## Reconstructed intent of 0.1

The original SuperLearningBot history leaves four strong signals:

1. Each `(learner, card)` pair had its own interval and ease. Knowledge was
   personal and card-specific.
2. The seven grades described the *quality of active recall*. Grades 0–2 were
   misses, grades 3–5 were increasingly effortless successes, and grade 6 gave
   the learner permanent control over rotation.
3. A successful late recall counted as stronger evidence. The bot compared the
   planned interval with elapsed calendar time.
4. The first review flow briefly used a cautious `1 → 3 → 6` day ramp
   ([commit 467e5ed](https://github.com/Latand/SuperLearningBot/commit/467e5edd38f443fe0725f181a3189b8ad159fa42)).
   That suggests an early proof phase followed by progressively longer trust.

The unifying idea is a changing level of trust in one learner's memory of one
card. Easy, repeated and delayed successes raise trust. Misses lower it. Strong
evidence should keep paying forward.

## Memory model

Version 1.0 expresses that trust with the FSRS-6 model:

- **Difficulty (D)** estimates the card's inherent difficulty for this learner,
  on a scale from 1 to 10.
- **Stability (S)** is the number of days required for predicted recall to fall
  from 100% to 90%.
- **Retrievability (R)** is the predicted probability of recall at a given
  moment, derived from elapsed time and stability.

At every review, the model updates difficulty and stability from the observed
grade and current retrievability. The next interval is the time at which the
forgetting curve reaches the learner's desired retention.

Shuboku uses the open-source
[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) implementation,
pinned to version 5.4.1 and its FSRS-6 parameter set. Fuzz and minute-scale
learning steps are disabled because Shuboku builds a fixed, day-scale session
queue.

## Grade semantics

| Shuboku | Memory outcome | FSRS input |
|---|---|---|
| 0–2 | recall missed; original label remains in history | Again |
| 3 | recalled with substantial effort | Hard |
| 4 | solid recall | Good |
| 5 | effortless recall | Easy |
| 6 | learner retires the card | no memory update |

The binary missed/recalled split protects the model from recognition being
recorded as recall. The three successful grades still control the size of the
stability gain.

With the default 90% target, a new card receives intervals of 1 day for grades
0–2, 2 days for grade 3, 3 days for grade 4 and 8 days for grade 5. Three
on-schedule grade-4 recalls progress through 3, 14 and 57 days.

## Grade suggestion from response time

The scale asks for something the learner cannot measure well: the effort a
recall took. The pause before revealing the answer measures it directly, so
`src/lib/suggest.ts` turns that pause into the grade the slider opens on. It
never grades anything — the position the learner releases at still decides.

Two quantities are read together, because neither means much alone.

**Pace** compares the pause with the pause this card should have needed. The
reference is the learner's own median over their last 40 successful recalls
(6 s until at least 5 have been measured), scaled by what the card's history
predicts: ×1.6 for a card that was hard last time, ×1.3 for a first meeting,
×0.8 for an easy one. Below 0.6 of that expectation the recall is *quick*, above
1.7 it took *effort*.

**Familiarity** reads the card's own record: `hard` when the last grade was 3 or
lower or difficulty reached 7, `easy` when the last grade was 5 or difficulty
stayed at 4 or below, `new` when the card has never been graded.

| familiarity | quick | usual pace | effort |
|---|---|---|---|
| easy, steady | 5 | 4 | 3 |
| new | 4 | 4 | 3 |
| hard | 4 | 3 | 3 |

Two pauses carry no information and always return the neutral grade 3:

- **over a minute** — the card was parked, not thought about. This is also what
  the 60-second auto-reveal produces, so an unattended session cannot inflate
  its grades.
- **under 600 ms** — the answer was revealed by reflex. Giving up instantly is
  indistinguishable from instant recognition, so the suggestion stays neutral
  rather than opening on a confident grade.

The ceiling is deliberate: a suggestion is never a failing grade and never
retires a card, and a card with a history of being hard never opens above 4
however fast the answer arrives. Only successful recalls between 600 ms and a
minute enter the personal baseline; a miss measures how long someone stared at
a blank, which is a different quantity.

The behavioral tests live in `src/lib/suggest.test.ts`.

## Scheduling policy

The default desired retention is 90%. Profiles can choose 85%, 95% or 97%.
Higher targets produce shorter intervals and a larger daily workload. A target
change applies after each card's next review, leaving the current queue stable.

A successful overdue review begins at lower retrievability and earns a larger
stability gain. FSRS makes this gain converge, preventing an extreme delay from
inflating every later interval linearly.

A miss resets the consecutive-success counter used by the existing progress UI.
FSRS retains a reduced post-lapse stability, preserving evidence accumulated
over months or years.

## Compatibility

The public scheduler interface remains small:

```ts
review(state, grade, now, desiredRetention?) => CardState
```

Existing Shuboku 0.1 states remain valid. Their next review derives an initial
FSRS stability from the stored interval and an initial difficulty from the old
ease factor. Review count, last grade, retirement state and current due date
survive unchanged until that review.

New fields carry `schedulerVersion: 1`, stability, difficulty, lapses and the
last review timestamp. The old ease field stays in exports as a compatibility
projection so older data and existing readers remain intelligible.

## Tested invariants

- new cards are due immediately;
- grades 0–2 always enter the failed-recall path;
- successful intervals grow with memory stability;
- a lapse reduces stability and preserves residual memory;
- a late success earns more stability than an on-time success;
- each graded review restarts the forgetting curve;
- a higher retention target shortens the next interval;
- grade 6 preserves memory state and removes the card from rotation;
- legacy 0.1 state upgrades lazily without losing progress.

The behavioral tests live in `src/lib/scheduler.test.ts`.
