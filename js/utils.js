// utils.js — small helpers shared across the app.
(function (MM) {

/* ---------- DOM ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Escape user-provided text before inserting into innerHTML templates. */
function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ---------- Dates (always local time) ---------- */
function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const todayKey = () => dateKey(new Date());

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday as the first day of the week. */
function startOfWeek(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const shift = (x.getDay() + 6) % 7; // days since Monday
  return addDays(x, -shift);
}

/** Array of 7 date keys for the week (Mon..Sun) containing `d`. */
function weekKeys(d = new Date()) {
  const mon = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => dateKey(addDays(mon, i)));
}

/** Whole days from a -> b (b - a), ignoring time of day. */
function daysBetween(aKey, bKey) {
  const a = parseKey(aKey), b = parseKey(bKey);
  return Math.round((b - a) / 86400000);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function prettyToday(d = new Date()) {
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Friendly relative label for a due / reminder date key. */
function relativeDate(key) {
  if (!key) return '';
  const diff = daysBetween(todayKey(), key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return `In ${diff}d`;
  const d = parseKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Classification for due chips: 'overdue' | 'soon' (<=2d) | 'normal'. */
function dueState(key) {
  if (!key) return 'normal';
  const diff = daysBetween(todayKey(), key);
  if (diff < 0) return 'overdue';
  if (diff <= 2) return 'soon';
  return 'normal';
}

const monthLabel = (i) => MONTHS[i];

/* ---------- Feedback ---------- */
function haptic(ms = 12) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
}

const reduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Count a number up smoothly. opts: {decimals, suffix, prefix, duration, from} */
function countUp(node, to, opts = {}) {
  const { decimals = 0, suffix = '', prefix = '', duration = 900, from = 0 } = opts;
  const fmt = (v) => prefix + v.toFixed(decimals) + suffix;
  if (reduced()) { node.textContent = fmt(to); return; }
  const start = performance.now();
  function frame(now) {
    const t = clamp((now - start) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    node.textContent = fmt(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(frame);
    else node.textContent = fmt(to);
  }
  requestAnimationFrame(frame);
}

MM.utils = {
  $, $$, esc, uid, clamp,
  dateKey, todayKey, parseKey, addDays, startOfWeek, weekKeys, daysBetween,
  prettyToday, relativeDate, dueState, monthLabel,
  haptic, countUp, prefersReducedMotion: reduced,
};

})(window.MM = window.MM || {});
