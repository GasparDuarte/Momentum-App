// views/home.js — Command Center: momentum core, metrics, intel, activity, life radar.
(function (MM) {
const { momentum, lifeAreas, insights, monthGrid, dayDetail, todayNudges } = MM.store;
const { icon } = MM.icons;
const { orb, radar, calendar, bar, playBars } = MM.components;
const { esc, haptic, countUp, parseKey, prettyToday } = MM.utils;
const { openSheet } = MM.ui;

const TIER = { standby: 'Standby', steady: 'Steady', charged: 'Charged', peak: 'Peak' };

// Activity calendar — which month is on screen (persists across re-renders).
let calY = null, calM = null;
function ensureCal() { if (calY === null) { const d = new Date(); calY = d.getFullYear(); calM = d.getMonth(); } }
function calStep(delta) { calM += delta; if (calM < 0) { calM = 11; calY--; } else if (calM > 11) { calM = 0; calY++; } }
function calToToday() { const d = new Date(); calY = d.getFullYear(); calM = d.getMonth(); }
function isCurrentMonth() { const d = new Date(); return calY === d.getFullYear() && calM === d.getMonth(); }
function calendarInner() { ensureCal(); return calendar(monthGrid(calY, calM), { isCurrent: isCurrentMonth() }); }

function render(el, { animateIn } = {}) {
  const m = momentum();
  const areas = lifeAreas();
  const intel = insights();
  const n = todayNudges();

  el.innerHTML = `
    <div class="command card">
      <div class="command__bar">
        <span class="command__id">CORE://OPERATOR</span>
        <span class="command__live">LIVE</span>
      </div>
      ${orb(m.score, m.tier)}
      <div class="command__head">
        <span class="command__eyebrow">Operator Status</span>
        <span class="command__tier tier-${m.tier}">${TIER[m.tier]}</span>
      </div>
      <div class="command__metrics">
        ${metric('flame', m.streak, 'Day streak', null, 'stats')}
        ${metric('repeat', `${m.habits}/${m.habitTotal}`, 'Habits', m.habitTotal ? m.habits / m.habitTotal : 0, 'habits')}
        ${metric('listChecks', `${m.protocol}/${m.protocolTotal}`, 'Protocol', m.protocolTotal ? m.protocol / m.protocolTotal : 0, 'habits')}
      </div>
    </div>

    ${priorityHTML(n)}

    <div class="section-head"><h2>Intel</h2></div>
    <div class="list ${animateIn ? 'stagger' : ''}">
      ${intel.map((i) => `<div class="insight"><span class="insight__ic">${icon(i.icon, 18)}</span><span>${esc(i.text)}</span></div>`).join('')}
    </div>

    <div class="section-head"><h2>Activity</h2><span class="muted">brighter = stronger</span></div>
    <div class="card pad hud-cyan" id="activity-card">${calendarInner()}</div>

    <div class="section-head"><h2>Life Radar</h2></div>
    <div class="card pad radar-card hud-cyan">
      ${radar(areas)}
      <div class="radar-legend">
        ${areas.map((a) => `
          <div class="rl">
            <span class="rl__name">${esc(a.area)}</span>
            <span class="rl__bar">${bar(a.score)}</span>
            <span class="rl__val">${a.score}</span>
          </div>`).join('')}
      </div>
    </div>
    <div style="height:8px"></div>
  `;

  // counters
  const scoreEl = el.querySelector('.core__score');
  if (scoreEl) countUp(scoreEl, Number(scoreEl.dataset.to));
  el.querySelectorAll('.mtile__val[data-count]').forEach((nEl) => countUp(nEl, Number(nEl.dataset.count)));
  playBars(el);
  wire(el);
}

function metric(ic, value, label, fill, go) {
  const isNum = typeof value === 'number';
  return `
    <button class="mtile" data-go="${go}">
      <div class="mtile__ic">${icon(ic, 16)}</div>
      <div class="mtile__val" ${isNum ? `data-count="${value}"` : ''}>${isNum ? 0 : value}</div>
      <div class="mtile__lbl">${label}</div>
      ${fill != null ? bar(Math.round(fill * 100)) : ''}
    </button>`;
}

function priorityHTML(n) {
  const blocks = [];
  if (n.behindHabits.length) {
    const lines = n.behindHabits.map(({ h, info }) =>
      `<div class="row">${esc(h.name)} — <b>${info.done}/${info.target}</b> this week, <b>${info.daysLeft} day${info.daysLeft === 1 ? '' : 's'} left</b>.</div>`
    ).join('');
    blocks.push(`<div class="nudge warn"><span class="ic">${icon('flame', 20)}</span><div class="body"><b>Behind protocol:</b>${lines}</div></div>`);
  }
  const due = [...n.dueTasks.map((t) => t.title), ...n.duePending.map((p) => p.title)];
  if (due.length) {
    blocks.push(`<div class="nudge warn"><span class="ic">${icon('bell', 20)}</span><div class="body"><b>Due today:</b><div class="row">${due.slice(0, 4).map(esc).join(' · ')}${due.length > 4 ? ` · +${due.length - 4}` : ''}</div></div></div>`);
  }
  return blocks.join('');
}

function wire(el) {
  el.querySelectorAll('.mtile').forEach((b) => b.addEventListener('click', () => { haptic(8); location.hash = b.dataset.go; }));
  wireCalendar(el);
}

/* Activity calendar: prev / next month + jump-to-today. Re-renders just the
   calendar card so the orb and radar above it stay put (no re-animation). */
function wireCalendar(el) {
  const card = el.querySelector('#activity-card');
  if (!card) return;
  card.querySelectorAll('[data-cal]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.cal;
    if (a === 'prev') calStep(-1); else if (a === 'next') calStep(1); else calToToday();
    haptic(8);
    card.innerHTML = calendarInner();
    wireCalendar(el);
  }));
  // tap a day to see what you logged that day
  card.querySelectorAll('.cal__cell[data-key]').forEach((cell) =>
    cell.addEventListener('click', () => { haptic(6); openDayDetail(cell.dataset.key); }));
}

/* Day detail — the record for a single day (completed protocol + habits). */
function openDayDetail(key) {
  const d = dayDetail(key);
  const title = prettyToday(parseKey(key));
  const list = (items, empty) => items.length
    ? items.map((t) => `<div class="day-log__item">${t}</div>`).join('')
    : `<div class="day-log__empty">${empty}</div>`;
  const protocol = list(
    d.daily.map((t) => `${icon('check', 14)} <span>${esc(t)}</span>`),
    'No non-negotiables logged this day.');
  const habits = list(
    d.habits.map((h) => `<span class="day-log__emoji">${esc(h.emoji)}</span> <span>${esc(h.name)}</span>`),
    'No habits logged this day.');
  openSheet(`
    <h3>${esc(title)}</h3>
    <p class="sub">Your record for this day.</p>
    <div class="section-head" style="margin:4px 0 6px"><h2 style="font-size:.86rem">Daily Protocol</h2>
      <span class="muted">${d.daily.length}/${d.dailyTotal}</span></div>
    <div class="day-log">${protocol}</div>
    <div class="section-head" style="margin:18px 0 6px"><h2 style="font-size:.86rem">Habits</h2>
      <span class="muted">${d.habits.length || ''}</span></div>
    <div class="day-log">${habits}</div>
  `);
}

MM.views = MM.views || {};
MM.views.home = { render };

})(window.MM = window.MM || {});
