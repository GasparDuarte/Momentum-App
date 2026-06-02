// store.js — single source of truth: state, persistence, actions, selectors.
//
// Persistence is isolated behind `adapter` so you can later swap localStorage
// for Supabase (or any backend) without touching the rest of the app:
//   - implement load() -> stateObject|null  and  save(stateObject)
//   - they may be async; commit() already awaits save().
// A ready-to-fill SupabaseAdapter stub lives at the bottom of this file.
(function (MM) {
const {
  uid, todayKey, dateKey, parseKey, addDays, startOfWeek, weekKeys,
  daysBetween, monthLabel,
} = MM.utils;

const STORAGE_KEY = 'momentum.v1';

const LocalAdapter = {
  load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch { return null; }
  },
  save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn('Save failed', e); }
  },
};

let adapter = LocalAdapter;
function setAdapter(a) { adapter = a; }

/* ---------- default / seed state ---------- */
function seed() {
  const now = new Date().toISOString();
  const mk = (title, i) => ({ id: uid(), title, order: i, createdAt: now });
  return {
    version: 1,
    settings: {
      theme: 'dark',
      accent: 'violet',
      name: '',
      createdAt: now,
      lastCelebrated: null,
      sectionsOrder: ['daily', 'tomorrow', 'habits'], // Habits page section order
    },
    daily: [
      mk('Make the bed', 0),
      mk('Move for 20 minutes', 1),
      mk('Drink 2L of water', 2),
    ],
    dailyLog: {}, // 'YYYY-MM-DD' -> { done: [itemId], total: n }
    habits: [
      { id: uid(), name: 'Gym', emoji: '🏋️', type: 'weekly', weeklyTarget: 4, area: 'Fitness', order: 0, createdAt: now, log: {} },
      { id: uid(), name: 'Meditate', emoji: '🧘', type: 'daily', weeklyTarget: 7, area: 'Health', order: 1, createdAt: now, log: {} },
      { id: uid(), name: 'Read', emoji: '📖', type: 'daily', weeklyTarget: 7, area: 'Learning', order: 2, createdAt: now, log: {} },
    ],
    tasks: [
      { id: uid(), title: 'Reply to that important email', note: '', bucket: 'urgent', due: '', done: false, order: 0, createdAt: now, completedAt: null },
      { id: uid(), title: 'Plan the week', note: '', bucket: 'week', due: '', done: false, order: 0, createdAt: now, completedAt: null },
    ],
    pending: [
      { id: uid(), title: 'Book dentist appointment', note: '', remind: '', done: false, order: 0, createdAt: now, completedAt: null },
    ],
    goals: [
      { id: uid(), title: 'Gym 16 times this month', period: 'month', target: 16, current: 0, linkHabit: null, createdAt: now },
    ],
    tomorrow: [], // queued objectives for the next cycle
  };
}

/* ---------- runtime ---------- */
let state = seed();
const subs = new Set();
let lastSnapshot = null; // single-step undo

function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit() { subs.forEach((fn) => fn(state)); }

async function init() {
  const loaded = adapter.load();
  if (loaded && loaded.version) state = migrate(loaded);
  return state;
}

const AREA_GUESS = [
  [/gym|run|lift|workout|fitness|train|walk|steps|yoga|sport|ride|swim/i, 'Fitness'],
  [/sleep|bed|rest|wake/i, 'Sleep'],
  [/read|study|learn|course|lang|book|skill|practice|write/i, 'Learning'],
  [/work|career|job|client|email|deep work|build|ship/i, 'Career'],
  [/call|family|friend|partner|social|date|text|reach out/i, 'Relationships'],
  [/medit|water|health|diet|eat|stretch|vitamin|journal|breath/i, 'Health'],
];
function guessArea(name = '') {
  for (const [re, area] of AREA_GUESS) if (re.test(name)) return area;
  return null;
}

function migrate(s) {
  // Defensive defaults so older / partial saves never crash the UI.
  s.settings = Object.assign(seed().settings, s.settings || {});
  s.daily ||= []; s.dailyLog ||= {}; s.habits ||= [];
  s.tasks ||= []; s.pending ||= []; s.goals ||= []; s.tomorrow ||= [];
  // `area === undefined` means legacy data: infer once from the name, then leave it.
  s.habits.forEach((h) => { h.log ||= {}; if (!h.type) h.type = 'daily'; if (h.area === undefined) h.area = guessArea(h.name); });
  return s;
}

async function commit(mutator, { undoable = false } = {}) {
  if (undoable) lastSnapshot = JSON.stringify(state);
  mutator(state);
  await adapter.save(state);
  emit();
}

async function undoLast() {
  if (!lastSnapshot) return;
  state = JSON.parse(lastSnapshot);
  lastSnapshot = null;
  await adapter.save(state);
  emit();
}

const getState = () => state;

/* ============================================================ DAILY ======= */
const dailyList = () => [...state.daily].sort((a, b) => a.order - b.order);

function dailyDone(id, key = todayKey()) {
  return !!state.dailyLog[key]?.done.includes(id);
}

function addDaily(title) {
  title = title.trim(); if (!title) return;
  return commit((s) => {
    const order = s.daily.length ? Math.max(...s.daily.map((d) => d.order)) + 1 : 0;
    s.daily.push({ id: uid(), title, order, createdAt: new Date().toISOString() });
  });
}
function removeDaily(id) {
  return commit((s) => {
    s.daily = s.daily.filter((d) => d.id !== id);
    Object.values(s.dailyLog).forEach((day) => { day.done = day.done.filter((x) => x !== id); });
  }, { undoable: true });
}
function reorderDaily(orderedIds) {
  return commit((s) => orderedIds.forEach((id, i) => {
    const d = s.daily.find((x) => x.id === id); if (d) d.order = i;
  }));
}
function toggleDaily(id, key = todayKey()) {
  return commit((s) => {
    const total = s.daily.length;
    let day = s.dailyLog[key];
    if (!day) day = s.dailyLog[key] = { done: [], total };
    day.total = total;
    const i = day.done.indexOf(id);
    if (i >= 0) day.done.splice(i, 1); else day.done.push(id);
    if (day.done.length === 0) delete s.dailyLog[key];
  });
}

function dailyProgress(key = todayKey()) {
  const total = key === todayKey() ? state.daily.length : (state.dailyLog[key]?.total ?? state.daily.length);
  const done = state.dailyLog[key]?.done.length || 0;
  const pct = total ? Math.round((Math.min(done, total) / total) * 100) : 0;
  return { done, total, pct, allDone: total > 0 && done >= total };
}

/** % completion of the daily checklist for a given day (for charts). */
function dayPct(key) {
  const entry = state.dailyLog[key];
  if (key === todayKey()) return dailyProgress(key).pct;
  if (!entry || !entry.done.length) return 0;
  const total = entry.total || entry.done.length;
  return Math.round((Math.min(entry.done.length, total) / total) * 100);
}

/* ============================================================ HABITS ====== */
const habitsList = () => [...state.habits].sort((a, b) => a.order - b.order);
const getHabit = (id) => state.habits.find((h) => h.id === id);

function addHabit({ name, emoji = '✅', type = 'daily', weeklyTarget = 4, area = null }) {
  name = (name || '').trim(); if (!name) return;
  return commit((s) => {
    const order = s.habits.length ? Math.max(...s.habits.map((h) => h.order)) + 1 : 0;
    s.habits.push({
      id: uid(), name, emoji, type,
      weeklyTarget: type === 'weekly' ? Math.max(1, Math.min(7, weeklyTarget)) : 7,
      area, order, createdAt: new Date().toISOString(), log: {},
    });
  });
}
function updateHabit(id, patch) {
  return commit((s) => { const h = s.habits.find((x) => x.id === id); if (h) Object.assign(h, patch); });
}
function removeHabit(id) {
  return commit((s) => {
    s.habits = s.habits.filter((h) => h.id !== id);
    s.goals.forEach((g) => { if (g.linkHabit === id) g.linkHabit = null; });
  }, { undoable: true });
}
function toggleHabit(id, key = todayKey()) {
  return commit((s) => {
    const h = s.habits.find((x) => x.id === id); if (!h) return;
    if (h.log[key]) delete h.log[key]; else h.log[key] = 1;
  });
}
const habitDone = (h, key = todayKey()) => !!h.log[key];

/* completions inside the week that contains `ref` */
function weekCount(h, ref = new Date()) {
  const keys = weekKeys(ref);
  return keys.reduce((n, k) => n + (h.log[k] ? 1 : 0), 0);
}

/** Weekly-goal nudge for the current week. */
function weeklyInfo(h) {
  const done = weekCount(h);
  const target = h.weeklyTarget || 4;
  const shift = (new Date().getDay() + 6) % 7;   // 0 = Monday
  const daysLeft = 7 - shift;                     // today counts as an opportunity
  const met = done >= target;
  const remaining = Math.max(0, target - done);
  const behind = !met && remaining > 0;
  return { done, target, daysLeft, met, remaining, behind, atRisk: behind && remaining > daysLeft };
}

function sortedLogKeys(h) { return Object.keys(h.log).sort(); }

/** Day-based streaks for a daily habit (with a one-day grace for today). */
function dayStreaks(h) {
  const set = new Set(Object.keys(h.log));
  let cur = 0;
  let cursor = todayKey();
  if (!set.has(cursor)) cursor = dateKey(addDays(new Date(), -1));
  while (set.has(cursor)) { cur++; cursor = dateKey(addDays(parseKey(cursor), -1)); }
  const keys = sortedLogKeys(h);
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    if (prev && daysBetween(prev, k) === 1) run++; else run = 1;
    best = Math.max(best, run); prev = k;
  }
  return { current: cur, best, unit: 'day' };
}

/** Week-based streaks for a weekly-frequency habit. */
function weekStreaks(h) {
  const target = h.weeklyTarget || 4;
  const firstKey = sortedLogKeys(h)[0];
  const firstMon = firstKey ? startOfWeek(parseKey(firstKey)) : startOfWeek(new Date());
  const thisMon = startOfWeek(new Date());
  let cur = 0;
  let cursor = new Date(thisMon);
  if (weekCount(h, cursor) < target) cursor = addDays(cursor, -7); // grace for current week
  while (cursor >= firstMon && weekCount(h, cursor) >= target) { cur++; cursor = addDays(cursor, -7); }
  let best = 0, run = 0, w = new Date(firstMon);
  while (w <= thisMon) {
    if (weekCount(h, w) >= target) { run++; best = Math.max(best, run); } else run = 0;
    w = addDays(w, 7);
  }
  return { current: cur, best, unit: 'week' };
}

function streakInfo(h) {
  return h.type === 'weekly' ? weekStreaks(h) : dayStreaks(h);
}

/** Build heatmap columns (weeks) Mon..Sun ending this week. */
function heatmap(h, weeks = 18) {
  const today = todayKey();
  const start = addDays(startOfWeek(new Date()), -(weeks - 1) * 7);
  const cols = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const colStart = addDays(start, w * 7);
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(colStart, d);
      const key = dateKey(date);
      const future = key > today;
      cells.push({ key, done: !!h.log[key], future, today: key === today });
    }
    const m = colStart.getMonth();
    let label = '';
    if (m !== lastMonth) { label = monthLabel(m); lastMonth = m; }
    cols.push({ cells, month: label });
  }
  return cols;
}

/* ============================================================ TASKS ======= */
const BUCKETS = [
  { id: 'urgent', label: 'Urgent', cls: 'r' },
  { id: 'week', label: 'This week', cls: 'a' },
  { id: 'month', label: 'This month', cls: 'g' },
];

function tasksByBucket(bucket) {
  return state.tasks
    .filter((t) => t.bucket === bucket)
    .sort((a, b) => (a.done - b.done) || (a.order - b.order));
}
function bucketCount(bucket) {
  const list = state.tasks.filter((t) => t.bucket === bucket);
  return { total: list.length, open: list.filter((t) => !t.done).length };
}

function addTask({ title, bucket = 'week', note = '', due = '' }) {
  title = (title || '').trim(); if (!title) return;
  return commit((s) => {
    const order = s.tasks.filter((t) => t.bucket === bucket).length;
    s.tasks.push({ id: uid(), title, note, bucket, due, done: false, order, createdAt: new Date().toISOString(), completedAt: null });
  });
}
function updateTask(id, patch) {
  return commit((s) => { const t = s.tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); });
}
function toggleTask(id) {
  return commit((s) => {
    const t = s.tasks.find((x) => x.id === id); if (!t) return;
    t.done = !t.done; t.completedAt = t.done ? new Date().toISOString() : null;
  });
}
function removeTask(id) {
  return commit((s) => { s.tasks = s.tasks.filter((t) => t.id !== id); }, { undoable: true });
}
function reorderTasks(bucket, orderedIds) {
  return commit((s) => orderedIds.forEach((id, i) => {
    const t = s.tasks.find((x) => x.id === id); if (t) t.order = i;
  }));
}

/* ============================================================ PENDING ===== */
function pendingList() {
  return [...state.pending].sort((a, b) => {
    if (a.done !== b.done) return a.done - b.done;
    if (a.remind && b.remind) return a.remind.localeCompare(b.remind);
    if (a.remind) return -1; if (b.remind) return 1;
    return a.order - b.order;
  });
}
function addPending({ title, note = '', remind = '' }) {
  title = (title || '').trim(); if (!title) return;
  return commit((s) => {
    s.pending.push({ id: uid(), title, note, remind, done: false, order: s.pending.length, createdAt: new Date().toISOString(), completedAt: null });
  });
}
function updatePending(id, patch) {
  return commit((s) => { const p = s.pending.find((x) => x.id === id); if (p) Object.assign(p, patch); });
}
function togglePending(id) {
  return commit((s) => {
    const p = s.pending.find((x) => x.id === id); if (!p) return;
    p.done = !p.done; p.completedAt = p.done ? new Date().toISOString() : null;
  });
}
function removePending(id) {
  return commit((s) => { s.pending = s.pending.filter((p) => p.id !== id); }, { undoable: true });
}

/* ============================================================ GOALS ======= */
const goalsList = () => [...state.goals];
function addGoal({ title, period = 'week', target = 1, linkHabit = null }) {
  title = (title || '').trim(); if (!title) return;
  return commit((s) => {
    s.goals.push({ id: uid(), title, period, target: Math.max(1, target), current: 0, linkHabit, createdAt: new Date().toISOString() });
  });
}
function updateGoal(id, patch) {
  return commit((s) => { const g = s.goals.find((x) => x.id === id); if (g) Object.assign(g, patch); });
}
function incGoal(id, delta) {
  return commit((s) => {
    const g = s.goals.find((x) => x.id === id); if (!g) return;
    g.current = Math.max(0, Math.min(g.target, (g.current || 0) + delta));
  });
}
function removeGoal(id) {
  return commit((s) => { s.goals = s.goals.filter((g) => g.id !== id); }, { undoable: true });
}

/** Resolve current progress; habit-linked goals compute from the habit log. */
function goalProgress(g) {
  let current = g.current || 0;
  if (g.linkHabit) {
    const h = getHabit(g.linkHabit);
    if (h) {
      if (g.period === 'week') current = weekCount(h);
      else {
        const now = new Date(), y = now.getFullYear(), m = now.getMonth();
        current = Object.keys(h.log).filter((k) => {
          const d = parseKey(k);
          return g.period === 'year' ? d.getFullYear() === y : (d.getFullYear() === y && d.getMonth() === m);
        }).length;
      }
    }
  }
  const pct = g.target ? Math.min(100, Math.round((current / g.target) * 100)) : 0;
  return { current, target: g.target, pct, done: current >= g.target };
}

/* ============================================================ TOMORROW ==== */
const tomorrowList = () => [...state.tomorrow];
function addTomorrow(title) {
  title = (title || '').trim(); if (!title) return;
  return commit((s) => { s.tomorrow.push({ id: uid(), title, done: false, createdAt: new Date().toISOString() }); });
}
function toggleTomorrow(id) {
  return commit((s) => { const t = s.tomorrow.find((x) => x.id === id); if (t) t.done = !t.done; });
}
function removeTomorrow(id) {
  return commit((s) => { s.tomorrow = s.tomorrow.filter((t) => t.id !== id); }, { undoable: true });
}
/** Move a queued item into today's Daily Protocol. */
function importTomorrow(id) {
  return commit((s) => {
    const t = s.tomorrow.find((x) => x.id === id); if (!t) return;
    const order = s.daily.length ? Math.max(...s.daily.map((d) => d.order)) + 1 : 0;
    s.daily.push({ id: uid(), title: t.title, order, createdAt: new Date().toISOString() });
    s.tomorrow = s.tomorrow.filter((x) => x.id !== id);
  });
}

/* ============================================================ STATS ======= */
function activeDaySet() {
  const set = new Set();
  Object.entries(state.dailyLog).forEach(([k, v]) => { if (v.done.length) set.add(k); });
  state.habits.forEach((h) => Object.keys(h.log).forEach((k) => set.add(k)));
  return set;
}

function stats() {
  const set = activeDaySet();
  let current = 0, cursor = todayKey();
  if (!set.has(cursor)) cursor = dateKey(addDays(new Date(), -1));
  while (set.has(cursor)) { current++; cursor = dateKey(addDays(parseKey(cursor), -1)); }
  const keys = [...set].sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) { if (prev && daysBetween(prev, k) === 1) run++; else run = 1; best = Math.max(best, run); prev = k; }

  const wk = weekKeys();
  const today = todayKey();
  const elapsed = wk.filter((k) => k <= today);
  const weekPct = elapsed.length
    ? Math.round(elapsed.reduce((sum, k) => sum + dayPct(k), 0) / elapsed.length)
    : 0;

  return { activeDays: set.size, currentStreak: current, bestStreak: best, weekPct };
}

/** Activity level for a day 0..3 (for the calendar): non-negotiables % + habits. */
function dayLevel(key) {
  const pct = dayPct(key);
  let lvl = pct >= 100 ? 3 : pct >= 50 ? 2 : pct > 0 ? 1 : 0;
  if (lvl === 0 && state.habits.some((h) => h.log[key])) lvl = 1;
  return lvl;
}

/** What was logged on a given day — for the calendar's day detail. */
function dayDetail(key) {
  const log = state.dailyLog[key];
  const doneIds = log ? log.done : [];
  const daily = state.daily.filter((d) => doneIds.includes(d.id)).map((d) => d.title);
  const habits = state.habits.filter((h) => h.log[key]).map((h) => ({ emoji: h.emoji || '✅', name: h.name }));
  const total = log ? (log.total || state.daily.length) : state.daily.length;
  return { key, daily, dailyTotal: total, habits, level: dayLevel(key) };
}

/** Daily completion series for the last `n` days (oldest -> newest). */
function chartSeries(n = 14) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const key = dateKey(d);
    out.push({ key, pct: dayPct(key), date: d, isToday: key === todayKey() });
  }
  return out;
}

/* ============================================================ DISCIPLINE OS = */
const LIFE_AREAS = ['Fitness', 'Career', 'Learning', 'Sleep', 'Health', 'Relationships'];

/** A habit's 0–100 performance this week. */
function habitWeekScore(h) {
  const c = weekCount(h);
  return h.type === 'weekly'
    ? Math.min(100, Math.round((c / (h.weeklyTarget || 4)) * 100))
    : Math.round((c / 7) * 100);
}

/** Momentum Score — the headline 0–100 discipline metric. */
function momentum() {
  const prog = dailyProgress();
  const habits = habitsList();
  const habitsDone = habits.filter((h) => habitDone(h)).length;
  const tUnits = prog.total + habits.length;
  const tDone = prog.done + habitsDone;
  const today = tUnits ? (tDone / tUnits) * 100 : 0;
  const st = stats();
  const streakF = Math.min(st.currentStreak / 14, 1) * 100;
  const score = Math.round(today * 0.30 + st.weekPct * 0.45 + streakF * 0.25);
  const tier = score >= 90 ? 'peak' : score >= 70 ? 'charged' : score >= 45 ? 'steady' : 'standby';
  return {
    score, tier, today: Math.round(today), week: st.weekPct, streak: st.currentStreak,
    habits: habitsDone, habitTotal: habits.length, protocol: prog.done, protocolTotal: prog.total,
  };
}

/** Per-area scores (0–100) for the Life Radar, from habits tagged to each area. */
function lifeAreas() {
  return LIFE_AREAS.map((area) => {
    const hs = state.habits.filter((h) => h.area === area);
    const score = hs.length ? Math.round(hs.reduce((n, h) => n + habitWeekScore(h), 0) / hs.length) : 0;
    return { area, score, count: hs.length };
  });
}

function monthActiveCounts() {
  const m = {};
  activeDaySet().forEach((k) => { const mk = k.slice(0, 7); m[mk] = (m[mk] || 0) + 1; });
  return m;
}

/** Dynamic, data-driven insight lines (top 3). */
function insights() {
  const out = [];
  const habits = habitsList();
  const st = stats();

  let topH = null, topS = 0;
  habits.forEach((h) => {
    const sk = streakInfo(h);
    if (h.type === 'daily' && sk.current > topS) { topS = sk.current; topH = h; }
  });
  if (topH && topS >= 3) out.push({ icon: 'flame', text: `You haven't missed ${topH.name} in ${topS} days.` });
  habits.forEach((h) => {
    if (h.type === 'weekly') { const sk = streakInfo(h); if (sk.current >= 2) out.push({ icon: 'flame', text: `${h.name}: ${sk.current}-week streak holding.` }); }
  });

  const tw = habits.reduce((n, h) => n + weekCount(h), 0);
  const lw = habits.reduce((n, h) => n + weekCount(h, addDays(new Date(), -7)), 0);
  if (lw > 0) {
    const ch = Math.round(((tw - lw) / lw) * 100);
    if (ch >= 10) out.push({ icon: 'trending', text: `Consistency is up ${ch}% from last week.` });
    else if (ch <= -15) out.push({ icon: 'trending', text: `Output dipped ${Math.abs(ch)}% — re-engage.` });
  }

  const months = monthActiveCounts();
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const cur = months[curKey] || 0;
  const others = Object.entries(months).filter(([k]) => k !== curKey).map(([, v]) => v);
  if (cur > 0 && (!others.length || cur >= Math.max(...others))) {
    out.push({ icon: 'trophy', text: `Strongest month yet — ${cur} active day${cur === 1 ? '' : 's'}.` });
  }

  if ([7, 14, 21, 30, 50, 100].includes(st.currentStreak)) out.push({ icon: 'zap', text: `${st.currentStreak}-day streak. Locked in.` });

  if (!out.length) {
    out.push(st.activeDays > 0
      ? { icon: 'sparkles', text: `${st.activeDays} active day${st.activeDays === 1 ? '' : 's'} logged. Keep building.` }
      : { icon: 'sparkles', text: 'Finish today’s protocol to start your streak.' });
  }
  return out.slice(0, 3);
}

/** Global activity heatmap: brighter = better performance that day. */
function globalHeatmap(weeks = 18) {
  const today = todayKey();
  const start = addDays(startOfWeek(new Date()), -(weeks - 1) * 7);
  const cols = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const colStart = addDays(start, w * 7);
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const key = dateKey(addDays(colStart, d));
      const future = key > today;
      cells.push({ key, level: future ? 0 : dayLevel(key), future, today: key === today });
    }
    const m = colStart.getMonth();
    let label = '';
    if (m !== lastMonth) { label = monthLabel(m); lastMonth = m; }
    cols.push({ cells, month: label });
  }
  return cols;
}

/** A single calendar month for the Activity view: rows of Mon..Sun day cells. */
function monthGrid(year, month) {
  const today = todayKey();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startShift = (first.getDay() + 6) % 7;          // Monday-based offset
  const rows = Math.ceil((startShift + daysInMonth) / 7);
  const gridStart = addDays(first, -startShift);
  const weeks = [];
  for (let w = 0; w < rows; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(gridStart, w * 7 + d);
      const key = dateKey(date);
      const inMonth = date.getMonth() === month && date.getFullYear() === year;
      const future = key > today;
      row.push({
        key, day: date.getDate(), inMonth, future, today: key === today,
        level: (!inMonth || future) ? 0 : dayLevel(key),
      });
    }
    weeks.push(row);
  }
  return { year, month, weeks };
}

/** Milestones + personal records. */
function achievements() {
  const st = stats();
  const bestHabit = state.habits.reduce((m, h) => Math.max(m, streakInfo(h).best), 0);
  const cleared = state.tasks.filter((t) => t.done).length + state.pending.filter((p) => p.done).length;
  const list = [
    { icon: 'zap', title: 'First Move', desc: '1 active day', unlocked: st.activeDays >= 1 },
    { icon: 'flame', title: 'Locked In', desc: '7-day streak', unlocked: st.bestStreak >= 7 },
    { icon: 'trophy', title: 'Unstoppable', desc: '30-day streak', unlocked: st.bestStreak >= 30 },
    { icon: 'repeat', title: 'Habit Forged', desc: '21-day habit', unlocked: bestHabit >= 21 },
    { icon: 'checkCircle', title: 'Operator', desc: 'Clear 50 ops', unlocked: cleared >= 50 },
    { icon: 'calendar', title: 'Centurion', desc: '100 active days', unlocked: st.activeDays >= 100 },
  ];
  const records = [
    { icon: 'flame', label: 'Longest streak', value: `${st.bestStreak}`, unit: 'd' },
    { icon: 'calendar', label: 'Active days', value: `${st.activeDays}`, unit: '' },
    { icon: 'repeat', label: 'Best habit streak', value: `${bestHabit}`, unit: 'd' },
    { icon: 'checkCircle', label: 'Ops cleared', value: `${cleared}`, unit: '' },
  ];
  return { list, records };
}

/** Completed tasks + errands, newest first — the History view. */
function historyItems() {
  const out = [];
  state.tasks.forEach((t) => { if (t.done) out.push({ kind: 'task', id: t.id, title: t.title, completedAt: t.completedAt, bucket: t.bucket }); });
  state.pending.forEach((p) => { if (p.done) out.push({ kind: 'pending', id: p.id, title: p.title, completedAt: p.completedAt }); });
  out.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  return out;
}

/* ============================================================ NUDGES ====== */
function todayNudges() {
  const today = todayKey();
  const incompleteDaily = dailyList().filter((d) => !dailyDone(d.id)).map((d) => d.title);
  const behindHabits = habitsList()
    .filter((h) => h.type === 'weekly')
    .map((h) => ({ h, info: weeklyInfo(h) }))
    .filter((x) => x.info.behind);
  const dueTasks = state.tasks.filter((t) => !t.done && t.due && t.due <= today);
  const duePending = state.pending.filter((p) => !p.done && p.remind && p.remind <= today);
  return { incompleteDaily, behindHabits, dueTasks, duePending };
}

/* ====================================================== HABITS SECTIONS === */
const SECTIONS = ['daily', 'tomorrow', 'habits'];
/** The order the three Habits-page sections render in (validated/repaired). */
function sectionsOrder() {
  const saved = Array.isArray(state.settings.sectionsOrder)
    ? state.settings.sectionsOrder.filter((x) => SECTIONS.includes(x)) : [];
  SECTIONS.forEach((x) => { if (!saved.includes(x)) saved.push(x); });
  return saved.slice(0, SECTIONS.length);
}
/** Move a section one slot up (dir -1) or down (dir +1). */
function moveSection(id, dir) {
  return commit((s) => {
    const o = sectionsOrder();
    const i = o.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    s.settings.sectionsOrder = o;
  });
}
/** Persist a full section order (from drag-to-reorder), validated/repaired. */
function setSectionsOrder(order) {
  return commit((s) => {
    const valid = Array.isArray(order) ? order.filter((x) => SECTIONS.includes(x)) : [];
    SECTIONS.forEach((x) => { if (!valid.includes(x)) valid.push(x); });
    s.settings.sectionsOrder = valid.slice(0, SECTIONS.length);
  });
}

/* ============================================================ SETTINGS ==== */
function setTheme(theme) { return commit((s) => { s.settings.theme = theme; }); }
function setAccent(accent) { return commit((s) => { s.settings.accent = accent; }); }
function setName(name) { return commit((s) => { s.settings.name = name.trim(); }); }
function markCelebrated() { return commit((s) => { s.settings.lastCelebrated = todayKey(); }); }
const celebratedToday = () => state.settings.lastCelebrated === todayKey();

function exportData() {
  return JSON.stringify(state, null, 2);
}
async function importData(json) {
  let obj;
  try { obj = typeof json === 'string' ? JSON.parse(json) : json; }
  catch { throw new Error('That file is not valid JSON.'); }
  if (!obj || typeof obj !== 'object' || !('daily' in obj || 'habits' in obj || 'version' in obj))
    throw new Error('That doesn’t look like a Momentum backup.');
  await commit((s) => { Object.assign(s, migrate(obj)); });
}
async function wipeAll() {
  await commit((s) => { Object.assign(s, seed()); s.daily = []; s.habits = []; s.tasks = []; s.pending = []; s.goals = []; s.dailyLog = {}; });
}

MM.store = {
  setAdapter, subscribe, init, undoLast, getState,
  dailyList, dailyDone, addDaily, removeDaily, reorderDaily, toggleDaily, dailyProgress, dayPct,
  habitsList, getHabit, addHabit, updateHabit, removeHabit, toggleHabit, habitDone,
  weekCount, weeklyInfo, streakInfo, heatmap,
  BUCKETS, tasksByBucket, bucketCount, addTask, updateTask, toggleTask, removeTask, reorderTasks,
  pendingList, addPending, updatePending, togglePending, removePending,
  goalsList, addGoal, updateGoal, incGoal, removeGoal, goalProgress,
  tomorrowList, addTomorrow, toggleTomorrow, removeTomorrow, importTomorrow,
  sectionsOrder, moveSection, setSectionsOrder,
  stats, chartSeries, dayLevel, monthGrid, dayDetail, todayNudges, historyItems,
  LIFE_AREAS, momentum, lifeAreas, insights, globalHeatmap, achievements,
  setTheme, setAccent, setName, markCelebrated, celebratedToday,
  exportData, importData, wipeAll,
};

/* ============================================================
   Supabase adapter stub (for later cloud sync) — not used in V1.
   const SupabaseAdapter = {
     async load() { ... return state|null },
     async save(state) { ... },
   };
   then: MM.store.setAdapter(SupabaseAdapter)
   ============================================================ */

})(window.MM = window.MM || {});
