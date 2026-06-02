# Momentum — Personal Discipline OS

> A cyberpunk-themed personal productivity app: track your daily non-negotiables,
> habits (with streaks & goals), tasks and objectives inside a living
> **command-center** interface that reacts to your progress.

**Vanilla HTML + CSS + JavaScript — no frameworks, no build step, no dependencies.**
It's a mobile-first single-page app and an installable **PWA** that works fully
**offline**. All data lives **on your own device** (browser `localStorage`); there is no
server, no account and no tracking.

![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-no_framework-f7df1e)
![No build](https://img.shields.io/badge/build-none-success)
![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8)
![Offline](https://img.shields.io/badge/works-offline-2ce59b)

---

## ✨ Features

- **🏠 Home — Command Center.** A "Momentum Score" (0–100) orb with an Operator-Status
  tier, quick metric tiles, data-driven **Intel** insights, a **Life Radar**, and a
  fully **navigable activity calendar** — page through any month and **tap a day** to see
  exactly what you completed that day.
- **🔁 Habits.** A **Daily Protocol** (your non-negotiables), a **Tomorrow Protocol**
  queue, and tracked **habits** with current/best **streaks**, weekly-frequency goals and
  a GitHub-style contribution heatmap. The three sections are **collapsible and
  reorderable** to your taste.
- **✅ Tasks.** Priority buckets (Urgent / This week / This month) plus Errands.
  **Swipe** right to complete, left to delete, **drag** to reorder, and a **Done log**
  grouped by date with completion times.
- **🎯 Goals.** Weekly, monthly and yearly objectives with animated progress bars,
  optionally **auto-tracked** from a habit.
- **📊 Status.** Personal records, achievements/badges, weekly consistency and a
  7/14/30-day completion chart.
- **🎨 Two full themes.** A neon **Night City** (dark) and a bright **Day City** (light),
  with five switchable accent colors. Respects `prefers-reduced-motion`.

## 🚀 Run it

**Locally:** just open `index.html` (double-click, or right-click → Open with your
browser). Everything works offline — all features, both themes, and data saving.

**On your phone / online:** host the folder on any static host (it's just files) and use
the browser's *Add to Home Screen* to install it as an app. Free options:

- **Netlify Drop** — drag the folder onto [app.netlify.com/drop](https://app.netlify.com/drop).
- **GitHub Pages** — push this repo, then *Settings → Pages → Source: main / root*.
- Vercel / Cloudflare Pages also work.

> Backup/restore your data anytime via **Settings (⚙️) → Export / Import** (a `.json` file).

## 🔒 Privacy

There is **no backend**. Every entry you make is stored only in your browser's
`localStorage` and never leaves your device. The public demo ships with example data, and
each visitor's changes stay private to their own browser — nothing is shared or uploaded.

## 🛠️ Tech & engineering highlights

- **Zero dependencies / zero build.** Plain classic `<script>`s attached to one global
  namespace (`window.MM`), which is what lets the app run straight from `file://`.
- **Reactive rendering** from a single state store with a swappable persistence
  `adapter` (localStorage today; a Supabase stub is ready for future cloud sync).
- **Hand-built UI** — bottom sheets, toasts, swipe-to-complete, drag-to-reorder,
  count-up numbers and confetti, all from scratch.
- **Performance-tuned** for low-end / multi-monitor setups: opaque panels instead of
  costly live `backdrop-filter` blur, ambient animations that **pause when the app isn't
  focused**, and a lightweight pure-CSS/SVG background scene (no images).
- **PWA**: offline app shell via a versioned service worker + web manifest.

## 📁 Project structure

```
index.html              app shell + background scene + ordered <script> tags
css/styles.css          design system, themes, components, animations
js/
  utils.js   icons.js   confetti.js                 helpers, icon set, celebration
  store.js               state, persistence, all logic + selectors   (MM.store)
  components.js  ui.js  interactions.js              fragments, sheets/toasts, gestures
  views/  home · habits · tasks · goals · stats      one file per screen  (MM.views.*)
  app.js                 init, theming, routing, settings, PWA
service-worker.js       offline caching   ·   manifest.webmanifest   PWA metadata
```

## 🧠 Data model (`localStorage` key `momentum.v1`)

```js
{
  settings: { theme, accent, name, sectionsOrder, … },
  daily:    [ { id, title, order } ],                 // non-negotiable templates
  dailyLog: { 'YYYY-MM-DD': { done:[itemId], total } },
  habits:   [ { id, name, emoji, type, weeklyTarget, area, log:{ 'YYYY-MM-DD':1 } } ],
  tasks:    [ { id, title, note, bucket, due, done, completedAt } ],
  pending:  [ { id, title, note, remind, done, completedAt } ],   // Errands
  goals:    [ { id, title, period:'week'|'month'|'year', target, current, linkHabit } ],
  tomorrow: [ { id, title, done } ],
}
```

---

Built as a personal project — designed, written and polished from scratch with vanilla web tech.
