// components.js — reusable view fragments (rings, bars, chips, empty states).
(function (MM) {
const { icon } = MM.icons;
const { esc, relativeDate, dueState, prefersReducedMotion } = MM.utils;

/* Progress bar; renders at 0, playBars() animates to target width. */
function bar(pct, cls = '') {
  return `<div class="bar ${cls}" data-target="${Math.min(100, Math.max(0, pct))}"><i></i></div>`;
}
function playBars(root) {
  root.querySelectorAll('.bar').forEach((el) => {
    const i = el.querySelector('i');
    const target = el.dataset.target + '%';
    if (prefersReducedMotion()) { i.style.width = target; return; }
    requestAnimationFrame(() => { i.style.width = target; });
  });
}

/* Due / reminder chip with smart relative label + colour. */
function dueChip(key, { icon: ic = 'calendar' } = {}) {
  if (!key) return '';
  const st = dueState(key);
  const cls = st === 'overdue' ? 'overdue' : st === 'soon' ? 'due-soon' : '';
  return `<span class="chip ${cls}">${icon(ic, 12)}${esc(relativeDate(key))}</span>`;
}

function emptyState(iconName, title, msg, actionHTML = '') {
  return `
    <div class="empty">
      <div class="empty__ic">${icon(iconName, 30)}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(msg)}</p>
      ${actionHTML}
    </div>`;
}

/* Discipline core — a glowing orb that reflects momentum (size/brightness/colour). */
function orb(score, tier) {
  const s = Math.max(0, Math.min(100, score));
  return `
    <div class="core core--${tier}" style="--p:${(s / 100).toFixed(3)}">
      <div class="core__halo"></div>
      <div class="core__ball"><span class="core__shine"></span></div>
      <div class="core__num"><span class="core__score" data-to="${s}">0</span><span class="core__lbl">Momentum</span></div>
    </div>`;
}

/* Life Radar — 6-axis spider chart. areas = [{area, score}]. */
const RADAR_SHORT = { Relationships: 'Social' };
function radar(areas) {
  const n = areas.length, cx = 124, cy = 106, R = 78, LR = 96;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  const poly = (r) => areas.map((_, i) => pt(i, r).map((v) => v.toFixed(1)).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${poly(R * f)}" class="radar__grid"/>`).join('');
  const axes = areas.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="radar__axis"/>`; }).join('');
  const dataPts = areas.map((a, i) => pt(i, R * Math.max(0.05, a.score / 100)).map((v) => v.toFixed(1)).join(',')).join(' ');
  const dots = areas.map((a, i) => { const [x, y] = pt(i, R * Math.max(0.05, a.score / 100)); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8" class="radar__dot"/>`; }).join('');
  const labels = areas.map((a, i) => {
    const [x, y] = pt(i, LR);
    const anchor = x < cx - 6 ? 'end' : x > cx + 6 ? 'start' : 'middle';
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="radar__label" text-anchor="${anchor}" dominant-baseline="middle">${esc(RADAR_SHORT[a.area] || a.area)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 248 212" class="radar" preserveAspectRatio="xMidYMid meet">${rings}${axes}<polygon points="${dataPts}" class="radar__area"/>${dots}${labels}</svg>`;
}

/* Heatmap grid from columns of cells {level 0..3, future, today}. */
function heatGrid(cols) {
  const months = cols.map((c) => `<span style="width:13px">${c.month}</span>`).join('');
  const grid = cols.map((c) =>
    `<div class="heat__col">${c.cells.map((cell) =>
      `<div class="heat__cell ${cell.future ? 'future' : cell.level ? 'lv' + cell.level : ''} ${cell.today ? 'today' : ''}"></div>`
    ).join('')}</div>`).join('');
  return `
    <div class="heat-wrap"><div class="heat__months">${months}</div><div class="heat">${grid}</div></div>
    <div class="heat-legend">Less
      <span class="heat__cell"></span><span class="heat__cell lv1"></span>
      <span class="heat__cell lv2"></span><span class="heat__cell lv3"></span>
    More</div>`;
}

/* Activity calendar — a real, navigable month grid (Mon..Sun) coloured by
   activity level (same neon scale as the heatmap). `grid` comes from
   store.monthGrid(year, month); the view wires the prev/next/today buttons. */
const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DOW = ['M','T','W','T','F','S','S'];
function calendar({ year, month, weeks }, { isCurrent = true } = {}) {
  const activeDays = weeks.reduce((n, row) => n + row.filter((c) => c.inMonth && c.level > 0).length, 0);
  const dow = CAL_DOW.map((d) => `<span>${d}</span>`).join('');
  const cells = weeks.map((row) => row.map((c) => {
    if (!c.inMonth) return `<div class="cal__cell out"></div>`;
    const lvl = c.future ? 'future' : c.level ? 'lv' + c.level : '';
    const tap = c.future ? '' : ` data-key="${c.key}" role="button" tabindex="0"`;
    return `<div class="cal__cell ${lvl} ${c.today ? 'today' : ''}"${tap}>${c.day}</div>`;
  }).join('')).join('');
  return `
    <div class="cal">
      <div class="cal__head">
        <button class="cal__nav" data-cal="prev" aria-label="Previous month">${icon('chevronLeft', 18)}</button>
        <div class="cal__title">${CAL_MONTHS[month]} ${year}${isCurrent ? '' : `<button class="cal__today" data-cal="today">Today</button>`}</div>
        <button class="cal__nav" data-cal="next" aria-label="Next month">${icon('chevronRight', 18)}</button>
      </div>
      <div class="cal__dow">${dow}</div>
      <div class="cal__grid">${cells}</div>
      <div class="cal__foot">
        <span>${activeDays} active day${activeDays === 1 ? '' : 's'}</span>
        <span class="cal__legend">Less
          <span class="heat__cell"></span><span class="heat__cell lv1"></span>
          <span class="heat__cell lv2"></span><span class="heat__cell lv3"></span>
        More</span>
      </div>
    </div>`;
}

MM.components = { bar, playBars, dueChip, emptyState, orb, radar, heatGrid, calendar };

})(window.MM = window.MM || {});
