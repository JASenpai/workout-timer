# workout-timer

Offline-capable PWA workout timer. `index.html` loads a block-based workout
definition from `workouts.json` and drives a rest timer through it.

## Workout data model

Each workout key (`"A"`, `"B"`) is a list of **blocks**. A block is one of:

```jsonc
// superset: alternate member exercises for N rounds
{
  "type": "superset",
  "name": "Pair A1",
  "rounds": 4,
  "instructions": "Alternate one set of Goblet Squat and One-Arm Dumbbell Row for 4 rounds.",
  "rest_between_exercises": 30,   // rest after each non-final exercise in a round
  "rest_after_round": 60,         // rest after the last exercise of a round
  "exercises": [ { "name": "...", "muscle": "...", "sets": 4, "reps": "10–15 reps",
                   "load": "10 kg", "rest": 60, "notes": "...", "image": "https://..." } ]
}

// single: one exercise repeated for `sets`
{ "type": "single", "name": "Cardio Finisher", "rounds": 5, "instructions": "...",
  "rest_after_round": 30, "exercises": [ { "...": "..." } ] }
```

`rounds` drives the sequence length. If `rounds` is missing it falls back to the
max `sets` across the block's exercises. A per-exercise `rest` is only used when
the block-level `rest_between_exercises` / `rest_after_round` are absent.

The app flattens blocks into a linear list of *sets* (`buildSequence`), each
carrying the rest that follows it, so the Next button and the countdown share one
code path.

## Developing

`index.html` reads `workouts.json` with `cache: 'no-store'`; the service worker
serves the shell and data network-first, so edits show up on the next load
(bump the `workouts.json` content or reload twice after a service worker change).

## Tests

`tests/sequence.test.js` loads the real `index.html` in jsdom, stubs `fetch` /
`AudioContext` / `wakeLock`, then drives the timer and asserts on rendered DOM:

```sh
npm install jsdom      # or: npm i -g jsdom
node tests/sequence.test.js
```

Covers: nested block flattening for both workout A and B, `rest_between_exercises`
vs `rest_after_round`, round advancement, single-block extra sets, inline sets/reps
editing, jump-to-block from the routine list, and the summary screen.
