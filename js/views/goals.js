// views/goals.js — weekly & monthly goals with animated progress.
(function (MM) {
const {
  goalsList, addGoal, updateGoal, incGoal, removeGoal, goalProgress,
  habitsList, getHabit, undoLast,
} = MM.store;
const { icon } = MM.icons;
const { bar, playBars, emptyState } = MM.components;
const { esc, haptic } = MM.utils;
const { openSheet, closeSheet, toast, confirmSheet } = MM.ui;

function render(el, { animateIn } = {}) {
  const goals = goalsList();
  const weekly = goals.filter((g) => g.period === 'week');
  const monthly = goals.filter((g) => g.period === 'month');
  const yearly = goals.filter((g) => g.period === 'year');

  el.innerHTML = `
    <div class="section-head"><h2>Goals</h2></div>
    ${goals.length === 0 ? emptyState('target', 'Set your objectives',
      'Define a weekly, monthly or yearly target and watch the bar fill. Link it to a habit to track it automatically.') : ''}
    ${section('This week', weekly, animateIn)}
    ${section('This month', monthly, animateIn)}
    ${section('This year', yearly, animateIn)}
    <button class="add-row" id="add-goal" style="margin-top:14px">${icon('plus', 18)} Add a goal</button>
  `;
  playBars(el);
  wire(el);
}

function section(label, goals, animateIn) {
  if (!goals.length) return '';
  return `
    <div class="section-head" style="margin-top:18px"><h2 style="font-size:.92rem;color:var(--text-2)">${label}</h2></div>
    <div class="list ${animateIn ? 'stagger' : ''}">${goals.map(cardHTML).join('')}</div>`;
}

function cardHTML(g) {
  const p = goalProgress(g);
  const linked = g.linkHabit ? getHabit(g.linkHabit) : null;
  return `
    <div class="card pad" data-id="${g.id}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:650;font-size:.98rem">${esc(g.title)} ${p.done ? '🎉' : ''}</div>
          <div style="font-size:.78rem;color:var(--text-3);margin-top:2px">
            ${linked ? `${icon('repeat', 12)} Auto from ${esc(linked.emoji)} ${esc(linked.name)}` : 'Manual goal'}
          </div>
        </div>
        <button class="ghostbtn edit-goal" aria-label="Edit">${icon('pencil', 17)}</button>
      </div>
      <div style="margin-top:14px">${bar(p.pct, p.done ? 'green' : '')}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
        <span style="font-size:.85rem;font-weight:650">${p.current} <span style="color:var(--text-3);font-weight:500">/ ${p.target}</span></span>
        ${linked ? `<span class="chip accent">${p.pct}%</span>` : `
          <div class="row__trail">
            <button class="ghostbtn g-dec" aria-label="Decrease">${icon('chevronDown', 18)}</button>
            <button class="ghostbtn g-inc" aria-label="Increase">${icon('chevronUp', 18)}</button>
          </div>`}
      </div>
    </div>`;
}

function wire(el) {
  el.querySelector('#add-goal')?.addEventListener('click', () => openGoalSheet());
  el.querySelectorAll('.card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.edit-goal')?.addEventListener('click', () => openGoalSheet(id));
    card.querySelector('.g-inc')?.addEventListener('click', () => { haptic(10); incGoal(id, 1); });
    card.querySelector('.g-dec')?.addEventListener('click', () => { haptic(10); incGoal(id, -1); });
  });
}

function openGoalSheet(id = null) {
  const editing = id ? goalsList().find((g) => g.id === id) : null;
  let period = editing?.period || 'week';
  let linkHabit = editing?.linkHabit || '';
  const habits = habitsList();

  const sheet = openSheet(`
    <h3>${editing ? 'Edit goal' : 'New goal'}</h3>
    <div class="field">
      <label>Goal</label>
      <input class="input" id="g-title" placeholder="e.g. Run 20km, Read 4 books" maxlength="60" value="${esc(editing?.title || '')}" />
    </div>
    <div class="field">
      <label>Period</label>
      <div class="choice-grid" id="g-period">
        <button type="button" class="choice ${period === 'week' ? 'active' : ''}" data-p="week">Weekly</button>
        <button type="button" class="choice ${period === 'month' ? 'active' : ''}" data-p="month">Monthly</button>
        <button type="button" class="choice ${period === 'year' ? 'active' : ''}" data-p="year">Yearly</button>
      </div>
    </div>
    <div class="field">
      <label>Target (a number)</label>
      <input class="input" id="g-target" type="number" min="1" max="999" value="${editing?.target || 5}" />
    </div>
    <div class="field">
      <label>Track automatically from a habit (optional)</label>
      <select class="input" id="g-link">
        <option value="">— Manual —</option>
        ${habits.map((h) => `<option value="${h.id}" ${h.id === linkHabit ? 'selected' : ''}>${esc(h.emoji)} ${esc(h.name)}</option>`).join('')}
      </select>
    </div>
    <div class="sheet-actions">
      ${editing ? `<button class="btn btn--ghost" id="g-delete" style="color:var(--red)">${icon('trash', 18)}</button>` : ''}
      <button class="btn btn--primary btn--block" id="g-save">${editing ? 'Save' : 'Add goal'}</button>
    </div>
  `);

  sheet.querySelectorAll('#g-period button').forEach((b) => b.addEventListener('click', () => {
    sheet.querySelectorAll('#g-period button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); period = b.dataset.p;
  }));

  sheet.querySelector('#g-save').addEventListener('click', () => {
    const title = sheet.querySelector('#g-title').value.trim();
    const target = Math.max(1, Number(sheet.querySelector('#g-target').value) || 1);
    linkHabit = sheet.querySelector('#g-link').value || null;
    if (!title) { sheet.querySelector('#g-title').focus(); return; }
    haptic(12);
    if (editing) updateGoal(id, { title, period, target, linkHabit });
    else addGoal({ title, period, target, linkHabit });
    closeSheet();
  });

  sheet.querySelector('#g-delete')?.addEventListener('click', async () => {
    closeSheet();
    if (await confirmSheet({ title: 'Delete goal?', message: `“${editing.title}” will be removed.` })) {
      removeGoal(id);
      toast('Goal deleted', { actionLabel: 'Undo', icon: 'trash', onAction: undoLast });
    }
  });
}

MM.views = MM.views || {};
MM.views.goals = { render };

})(window.MM = window.MM || {});
