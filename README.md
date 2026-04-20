# AlphaFocus

An Electron desktop app that gamifies focus sessions. Dump your tasks, organize them effortlessly, and grind XP and gold by actually doing the work.

## Features

- **Three-lane task board** — `Inbox` (dump zone) · `Today` (active) · `Later` (backlog). Drag and drop between lanes, reorder within.
- **Quick-add with natural-language parsing** — one line, fully organized:
  - `Study math #school !high 30m 100xp >today`
  - `#tag` tags · `!high|!med|!low` priority · `30m` / `1h` estimate · `50xp` reward · `>inbox|>today|>later` lane
- **Stopwatch and Timer modes** — switch per quest. Timer fires a pleasant chime at zero, then lets you Complete, extend by 5/10 min, or switch to Stopwatch overtime.
- **Floating active-quest bar** — always visible across tabs (Focus / Habits / Shop / History / Achievements).
- **Filtering** — by priority, by tag, and full-text search.
- **Habits** with streaks, weekly dots, and milestone rewards.
- **Gold shop** — create your own rewards and spend gold to redeem them.
- **History** filterable by date, duration, and mode.
- **Levels & ranks** from Neural Novice to ULTRABRAIN OMEGA.

## Run

```bash
npm install
npm start
```

## Build (macOS)

```bash
npm run build
```

## Data

Stored locally in `localStorage`. Reset via Settings (secret code: `grindfor2030`).
