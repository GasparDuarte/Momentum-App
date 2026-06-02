// views/stats.js — Status report: records, achievements, trends.
(function (MM) {
const { stats, chartSeries, habitsList, streakInfo, achievements } = MM.store;
const { icon } = MM.icons;
const { emptyState, bar, playBars } = MM.components;
const { countUp, esc, prefersReducedMotion } = MM.utils;

let range = 14;

function render(el) {
  const s = stats();
  const habits = habitsList();
  const ach = achievements();

  el.innerHTML = `
    <div class="section-head"><h2>Status Report</h2></div>
    <div class="stat-grid">
      ${stat('zap', s.currentStreak, 'Current streak', s.currentStreak === 1 ? ' day' : ' days')}
      ${stat('trophy', s.bestStreak, 'Best streak', s.bestStreak === 1 ? ' day' : ' days')}
      ${stat('calendar', s.activeDays, 'Active days')}
      ${stat('trending', s.weekPct, 'This week', '%')}
    </div>

    <div class="card pad" style="margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
        <span style="font-weight:600;font-size:.88rem">Weekly consistency</span>
        <span style="font-family:var(--font-display);font-weight:700">${s.weekPct}%</span>
      </div>
      ${bar(s.weekPct)}
    </div>

    <div class="section-head"><h2>Personal Records</h2></div>
    <div class="stat-grid">
      ${ach.records.map(recordTile).join('')}
    </div>

    <div class="section-head"><h2>Achievements</h2><span class="muted">${ach.list.filter((a) => a.unlocked).length}/${ach.list.length}</span></div>
    <div class="ach-grid">${ach.list.map(achBadge).join('')}</div>

    <div class="section-head" style="margin-top:24px">
      <h2>Daily output</h2>
      <div class="seg" id="range-seg">
        ${[7, 14, 30].map((n) => `<button data-n="${n}" class="${n === range ? 'active' : ''}">${n}d</button>`).join('')}
      </div>
    </div>
    <div class="card pad"><div id="chart-host">${chartHTML(chartSeries(range))}</div></div>

    <div class="section-head" style="margin-top:24px"><h2>Habit streaks</h2></div>
    ${habits.length ? `<div class="card pad" style="display:flex;flex-direction:column;gap:2px">
      ${habits.map(streakRow).join('')}
    </div>` : emptyState('flame', 'No habits yet', 'Add habits to grow your streaks here.')}
    <div style="height:8px"></div>
  `;

  el.querySelectorAll('.num[data-to]').forEach((n) => countUp(n, Number(n.dataset.to), { suffix: n.dataset.suffix || '' }));
  playBars(el);
  playChart(el);
  wireSeg(el);
}

function stat(ic, value, label, suffix = '') {
  return `
    <div class="stat">
      <div class="ic">${icon(ic, 20)}</div>
      <div class="num" data-to="${value}" data-suffix="${suffix}">0${suffix}</div>
      <div class="lbl">${label}</div>
    </div>`;
}

function recordTile(r) {
  return `
    <div class="stat">
      <div class="ic">${icon(r.icon, 20)}</div>
      <div class="num" data-to="${r.value}" data-suffix="${r.unit || ''}">0${r.unit || ''}</div>
      <div class="lbl">${esc(r.label)}</div>
    </div>`;
}

function achBadge(a) {
  return `
    <div class="ach ${a.unlocked ? 'on' : ''}">
      <div class="ach__ic">${icon(a.unlocked ? a.icon : 'target', 20)}</div>
      <div class="ach__t">${esc(a.title)}</div>
      <div class="ach__d">${esc(a.desc)}</div>
    </div>`;
}

function streakRow(h) {
  const sk = streakInfo(h);
  return `
    <div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--hairline)">
      <span style="font-size:1.2rem">${esc(h.emoji || '✅')}</span>
      <span style="flex:1;font-weight:600;font-size:.92rem">${esc(h.name)}</span>
      <span class="habit__streak ${sk.current > 0 ? 'fire' : ''}" style="font-size:.82rem;font-weight:700">
        ${icon('flame', 14)} ${sk.current} ${sk.unit}${sk.current === 1 ? '' : 's'}
      </span>
    </div>`;
}

function chartHTML(series) {
  return `<div class="chart">${series.map((d, i) => {
    const showLabel = series.length <= 14 || i % 4 === 0 || d.isToday;
    return `
      <div class="chart__col">
        <div class="chart__bar-track">
          <div class="chart__bar ${d.pct === 0 ? 'low' : ''} ${d.isToday ? 'today' : ''}" data-h="${d.pct}" style="height:0"></div>
        </div>
        <div class="chart__lbl">${showLabel ? d.date.getDate() : ''}</div>
      </div>`;
  }).join('')}</div>`;
}

function playChart(root) {
  root.querySelectorAll('.chart__bar').forEach((b) => {
    const h = Math.max(Number(b.dataset.h), b.classList.contains('low') ? 0 : 4);
    if (prefersReducedMotion()) { b.style.height = h + '%'; return; }
    requestAnimationFrame(() => { b.style.height = h + '%'; });
  });
}

function wireSeg(el) {
  el.querySelectorAll('#range-seg button').forEach((b) => b.addEventListener('click', () => {
    range = Number(b.dataset.n);
    el.querySelectorAll('#range-seg button').forEach((x) => x.classList.toggle('active', x === b));
    const host = el.querySelector('#chart-host');
    host.innerHTML = chartHTML(chartSeries(range));
    playChart(host);
  }));
}

MM.views = MM.views || {};
MM.views.stats = { render };

})(window.MM = window.MM || {});
