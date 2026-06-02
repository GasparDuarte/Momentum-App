// views/habits.js — Non-negotiables checklist + habits (streaks, weekly goals, heatmap).
(function (MM) {
const {
  dailyList, dailyDone, dailyProgress, toggleDaily, addDaily, removeDaily, reorderDaily,
  celebratedToday, markCelebrated, LIFE_AREAS,
  habitsList, getHabit, addHabit, updateHabit, removeHabit, toggleHabit,
  habitDone, weeklyInfo, streakInfo, heatmap, undoLast,
  tomorrowList, addTomorrow, toggleTomorrow, removeTomorrow, importTomorrow,
  sectionsOrder, setSectionsOrder,
} = MM.store;
const { icon, checkPath } = MM.icons;
const { emptyState, bar, playBars } = MM.components;
const { esc, haptic, weekKeys, todayKey } = MM.utils;
const { openSheet, closeSheet, toast, confirmSheet, celebrate, pulse } = MM.ui;
const { attachSwipe, attachDragReorder } = MM.interactions;

const EMOJIS = ['💪','🏋️','🏃','🚶','🧘','📖','✍️','📵','💧','🥗','😴','🧠','🎯','☀️','🌙','🙏','🎸','🧹','💊','🪥','💸','🎨','⏰','🚭'];
const SECTION_TITLES = { daily: 'Daily Protocol', tomorrow: 'Tomorrow Protocol', habits: 'Habits' };

const expanded = new Set();   // habit ids whose heatmap is open
const open = { daily: false, tomorrow: false, habits: false }; // section collapsibles — all closed on open
let keepFocus = false;        // refocus the non-negotiable add input
let tmrwFocus = false;        // refocus the tomorrow add input

function render(el, { animateIn } = {}) {
  const items = dailyList();
  const prog = dailyProgress();
  const habits = habitsList();
  const order = sectionsOrder();

  const count = {
    daily: prog.total ? `${prog.done}/${prog.total} today` : '',
    tomorrow: tomorrowList().length || '',
    habits: habits.length || '',
  };
  const body = {
    daily: dailyBody(items, prog, animateIn),
    tomorrow: tomorrowBody(),
    habits: habitsBody(habits, animateIn),
  };

  el.innerHTML = `<div id="sections">` + order.map((id) => `
    <div class="hsection" data-section="${id}">
      ${secHead(id, SECTION_TITLES[id], count[id], open[id])}
      <div class="collapsible ${open[id] ? 'open' : ''}" id="${id}-collapse"><div class="inner">
        ${body[id]}
      </div></div>
    </div>
  `).join('') + `</div><div style="height:8px"></div>`;

  playBars(el);
  wire(el);

  if (prog.allDone && !celebratedToday()) {
    setTimeout(() => {
      if (dailyProgress().allDone && !celebratedToday()) {
        celebrate('Daily Protocol Complete', 'Operator status: clear.');
        markCelebrated();
      }
    }, 80);
  }
}

/* ---------- section header: tap to collapse, drag the grip to reorder ---------- */
function secHead(id, title, count, isOpen) {
  return `
    <div class="section-head sec-head" data-toggle="${id}" style="cursor:pointer">
      <button class="ghostbtn sec-drag-handle" aria-label="Drag to reorder ${title}">${icon('grip', 16)}</button>
      <h2>${title}</h2>
      <span class="muted">${count} ${icon('chevronDown', 16, 'chev' + (isOpen ? ' open' : ''))}</span>
    </div>`;
}

/* ---------- non-negotiables ---------- */
function dailyBody(items, prog, animateIn) {
  return `
    ${prog.total ? `<div style="margin:6px 2px 12px">${bar(prog.pct)}</div>` : ''}
    ${items.length
      ? `<div class="list ${animateIn ? 'stagger' : ''}" id="daily-list">${items.map(dailyRow).join('')}</div>`
      : emptyState('sunrise', 'Set your daily protocol', 'The non-negotiables you execute every single day. Add your first below.')}
    <form class="inline-add" id="daily-add" style="margin-top:12px">
      <input class="input" id="daily-add-input" placeholder="Add a non-negotiable…" maxlength="80" autocomplete="off" />
      <button class="btn btn--primary" type="submit" aria-label="Add">${icon('plus', 18)}</button>
    </form>`;
}

function dailyRow(it) {
  const done = dailyDone(it.id);
  return `
    <div class="swipe" data-id="${it.id}">
      <div class="swipe__bg">
        <span class="done-side">${icon('check', 18)} Done</span>
        <span class="del-side">Remove ${icon('trash', 16)}</span>
      </div>
      <div class="swipe__fg">
        <div class="row ${done ? 'done' : ''}">
          <div class="check" role="button" tabindex="0" aria-label="Toggle ${esc(it.title)}">${checkPath}</div>
          <div class="row__main"><div class="row__title"><span class="strike">${esc(it.title)}</span></div></div>
          <div class="row__trail"><button class="ghostbtn drag-handle" aria-label="Reorder">${icon('grip', 17)}</button></div>
        </div>
      </div>
    </div>`;
}

/* ---------- tomorrow protocol ---------- */
function tomorrowBody() {
  const items = tomorrowList();
  return `
    <p class="center-muted" style="text-align:left; padding:0 2px 10px">Queue what you'll execute next cycle.</p>
    ${items.length ? `<div class="list" id="tmrw-list">${items.map(tmrwRow).join('')}</div>` : ''}
    <form class="inline-add" id="tmrw-add" style="margin-top:10px">
      <input class="input" id="tmrw-input" placeholder="Queue an objective for tomorrow…" maxlength="100" autocomplete="off" />
      <button class="btn btn--soft" type="submit" aria-label="Add">${icon('plus', 18)}</button>
    </form>`;
}
function tmrwRow(t) {
  return `
    <div class="row ${t.done ? 'done' : ''}" data-id="${t.id}">
      <div class="check tmrw-check" role="button" tabindex="0" aria-label="Toggle">${checkPath}</div>
      <div class="row__main"><div class="row__title"><span class="strike">${esc(t.title)}</span></div></div>
      <div class="row__trail">
        <button class="ghostbtn tmrw-import" title="Move to today's protocol">${icon('arrowRight', 17)}</button>
        <button class="ghostbtn danger tmrw-del" aria-label="Delete">${icon('trash', 17)}</button>
      </div>
    </div>`;
}

/* ---------- habits ---------- */
function habitsBody(habits, animateIn) {
  return `
    ${habits.length
      ? `<div class="list ${animateIn ? 'stagger' : ''}">${habits.map(cardHTML).join('')}</div>`
      : emptyState('repeat', 'Build a habit that sticks', 'Track things you do regularly. Streaks and a weekly goal keep you honest.')}
    <button class="add-row" id="add-habit" style="margin-top:12px">${icon('plus', 18)} Add a habit</button>`;
}

function cardHTML(h) {
  const done = habitDone(h);
  const sk = streakInfo(h);
  const heatOpen = expanded.has(h.id);
  const streakTxt = sk.current > 0 ? `${sk.current} ${sk.unit}${sk.current === 1 ? '' : 's'}` : 'No streak yet';
  return `
    <div class="card pad habit" data-id="${h.id}">
      <div class="habit__top">
        <div class="habit__emoji">${esc(h.emoji || '✅')}</div>
        <div style="flex:1; min-width:0">
          <div class="habit__name">${esc(h.name)}</div>
          <div class="habit__meta">
            <span class="habit__streak ${sk.current > 0 ? 'fire' : ''}">${icon('flame', 14)} ${streakTxt}</span>
            <span>Best ${sk.best} ${sk.unit}${sk.best === 1 ? '' : 's'}</span>
          </div>
        </div>
        <button class="ghostbtn toggle-heat" aria-label="Show history">${icon('chevronDown', 18, 'chev' + (heatOpen ? ' open' : ''))}</button>
        <button class="check check--lg habit-check ${done ? 'is-done' : ''}" aria-label="Mark done today">${checkPath}</button>
      </div>
      ${h.type === 'weekly' ? weeklyHTML(h) : ''}
      <div class="collapsible ${heatOpen ? 'open' : ''}" data-heat>
        <div class="inner">
          ${heatmapHTML(h)}
          <button class="btn btn--ghost edit-habit" style="margin-top:14px;width:100%">${icon('pencil', 17)} Edit habit</button>
        </div>
      </div>
    </div>`;
}

function weeklyHTML(h) {
  const info = weeklyInfo(h);
  const keys = weekKeys();
  const today = todayKey();
  const dots = keys.map((k) => `<i class="${h.log[k] ? 'on' : ''} ${k === today ? 'today-mark' : ''}"></i>`).join('');
  const right = info.met
    ? `<span class="met">Goal met 🎉</span>`
    : `<span class="${info.behind ? 'behind' : ''}">${info.daysLeft} day${info.daysLeft === 1 ? '' : 's'} left</span>`;
  return `
    <div class="wk">
      <div class="wk__top"><span class="label"><b>${info.done}</b> / ${info.target} this week</span>${right}</div>
      <div class="wk__dots">${dots}</div>
    </div>`;
}

function heatmapHTML(h) {
  const cols = heatmap(h, 18);
  const months = cols.map((c) => `<span style="width:13px">${c.month}</span>`).join('');
  const grid = cols.map((c) =>
    `<div class="heat__col">${c.cells.map((cell) =>
      `<div class="heat__cell ${cell.future ? 'future' : cell.done ? 'lv3' : ''} ${cell.today ? 'today' : ''}"></div>`
    ).join('')}</div>`).join('');
  return `
    <div class="heat-wrap" style="margin-top:14px">
      <div class="heat__months">${months}</div>
      <div class="heat">${grid}</div>
    </div>
    <div class="heat-legend">Less
      <span class="heat__cell"></span><span class="heat__cell lv1"></span>
      <span class="heat__cell lv2"></span><span class="heat__cell lv3"></span>
    More</div>`;
}

/* ---------- wiring ---------- */
function wire(el) {
  // section headers: tap to collapse/expand; drag the grip to reorder sections
  el.querySelectorAll('.sec-head').forEach((head) => {
    head.addEventListener('click', (e) => {
      if (e.target.closest('.sec-drag-handle')) return;
      const id = head.dataset.toggle;
      open[id] = !open[id]; haptic(8);
      el.querySelector('#' + id + '-collapse')?.classList.toggle('open', open[id]);
      head.querySelector('.chev')?.classList.toggle('open', open[id]);
    });
  });
  const sectionsEl = el.querySelector('#sections');
  if (sectionsEl) attachDragReorder(sectionsEl, {
    onReorder: (ids) => setSectionsOrder(ids),
    handle: '.sec-drag-handle', itemSel: '[data-section]', idAttr: 'section',
  });

  // non-negotiable add
  const input = el.querySelector('#daily-add-input');
  if (keepFocus && input) { input.focus(); keepFocus = false; }
  el.querySelector('#daily-add')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim(); if (!v) return;
    keepFocus = true; haptic(10); addDaily(v);
  });

  // non-negotiable rows
  el.querySelectorAll('#daily-list .swipe').forEach((sw) => {
    const id = sw.dataset.id;
    const check = sw.querySelector('.check');
    const toggle = () => { if (!dailyDone(id)) pulse(check); haptic(12); toggleDaily(id); };
    check.addEventListener('click', toggle);
    attachSwipe(sw, {
      onTap: toggle,
      onComplete: () => { if (!dailyDone(id)) toggle(); },
      onDelete: () => { removeDaily(id); toast('Removed', { actionLabel: 'Undo', icon: 'trash', onAction: undoLast }); },
    });
  });
  const dlist = el.querySelector('#daily-list');
  if (dlist) attachDragReorder(dlist, { onReorder: (ids) => reorderDaily(ids) });

  // tomorrow protocol
  const tinput = el.querySelector('#tmrw-input');
  if (tmrwFocus && tinput) { tinput.focus(); tmrwFocus = false; }
  el.querySelector('#tmrw-add')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = tinput.value.trim(); if (!v) return;
    tmrwFocus = true; open.tomorrow = true; haptic(10); addTomorrow(v);
  });
  el.querySelectorAll('#tmrw-list .row').forEach((rowEl) => {
    const id = rowEl.dataset.id;
    rowEl.querySelector('.tmrw-check').addEventListener('click', () => { haptic(12); toggleTomorrow(id); });
    rowEl.querySelector('.tmrw-import').addEventListener('click', () => { haptic(12); importTomorrow(id); toast('Moved to today’s protocol', { icon: 'check' }); });
    rowEl.querySelector('.tmrw-del').addEventListener('click', () => { removeTomorrow(id); toast('Removed', { actionLabel: 'Undo', icon: 'trash', onAction: undoLast }); });
  });

  // habits
  el.querySelector('#add-habit')?.addEventListener('click', () => openHabitSheet());
  el.querySelectorAll('.habit').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.habit-check').addEventListener('click', () => {
      const check = card.querySelector('.habit-check');
      if (!habitDone(getHabit(id))) pulse(check);
      haptic(12); toggleHabit(id);
    });
    card.querySelector('.edit-habit').addEventListener('click', () => openHabitSheet(id));
    card.querySelector('.toggle-heat').addEventListener('click', () => {
      const col = card.querySelector('[data-heat]');
      const chev = card.querySelector('.chev');
      const isOpen = col.classList.toggle('open');
      chev.classList.toggle('open', isOpen);
      if (isOpen) expanded.add(id); else expanded.delete(id);
      haptic(8);
    });
  });
}

/* ---------- add / edit sheet ---------- */
function openHabitSheet(id = null) {
  const editing = id ? getHabit(id) : null;
  const draft = {
    name: editing?.name || '', emoji: editing?.emoji || '🎯',
    type: editing?.type || 'daily', weeklyTarget: editing?.weeklyTarget || 4,
    area: editing?.area || '',
  };

  const sheet = openSheet(`
    <h3>${editing ? 'Edit habit' : 'New habit'}</h3>
    <p class="sub">What do you want to do consistently?</p>
    <div class="field"><label>Name</label>
      <input class="input" id="h-name" placeholder="e.g. Gym, Read, Meditate" maxlength="40" value="${esc(draft.name)}" /></div>
    <div class="field"><label>Icon</label>
      <div class="emoji-grid" id="h-emoji">
        ${EMOJIS.map((e) => `<button type="button" data-e="${e}" class="${e === draft.emoji ? 'active' : ''}">${e}</button>`).join('')}
      </div>
    </div>
    <div class="field"><label>How often?</label>
      <div class="choice-grid" id="h-type">
        <button type="button" class="choice ${draft.type === 'daily' ? 'active' : ''}" data-t="daily">Every day</button>
        <button type="button" class="choice ${draft.type === 'weekly' ? 'active' : ''}" data-t="weekly">Times per week</button>
      </div>
    </div>
    <div class="field ${draft.type === 'weekly' ? '' : 'hide'}" id="h-target-field"><label>Weekly goal</label>
      <div class="choice-grid" id="h-target">
        ${[1,2,3,4,5,6,7].map((n) => `<button type="button" class="choice ${n === draft.weeklyTarget ? 'active' : ''}" data-n="${n}">${n}×</button>`).join('')}
      </div>
    </div>
    <div class="field"><label>Life area (feeds your radar)</label>
      <div class="choice-grid" id="h-area">
        <button type="button" class="choice ${!draft.area ? 'active' : ''}" data-a="">None</button>
        ${LIFE_AREAS.map((a) => `<button type="button" class="choice ${draft.area === a ? 'active' : ''}" data-a="${a}">${a}</button>`).join('')}
      </div>
    </div>
    <div class="sheet-actions">
      ${editing ? `<button class="btn btn--ghost" id="h-delete" style="color:var(--red)">${icon('trash', 18)}</button>` : ''}
      <button class="btn btn--primary btn--block" id="h-save">${editing ? 'Save' : 'Add habit'}</button>
    </div>
  `);

  sheet.querySelectorAll('#h-emoji button').forEach((b) => b.addEventListener('click', () => {
    sheet.querySelectorAll('#h-emoji button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); draft.emoji = b.dataset.e;
  }));
  sheet.querySelectorAll('#h-type button').forEach((b) => b.addEventListener('click', () => {
    sheet.querySelectorAll('#h-type button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); draft.type = b.dataset.t;
    sheet.querySelector('#h-target-field').classList.toggle('hide', draft.type !== 'weekly');
  }));
  sheet.querySelectorAll('#h-target button').forEach((b) => b.addEventListener('click', () => {
    sheet.querySelectorAll('#h-target button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); draft.weeklyTarget = Number(b.dataset.n);
  }));
  sheet.querySelectorAll('#h-area button').forEach((b) => b.addEventListener('click', () => {
    sheet.querySelectorAll('#h-area button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); draft.area = b.dataset.a || null;
  }));

  sheet.querySelector('#h-save').addEventListener('click', () => {
    const name = sheet.querySelector('#h-name').value.trim();
    if (!name) { sheet.querySelector('#h-name').focus(); return; }
    haptic(12);
    const patch = { name, emoji: draft.emoji, type: draft.type, weeklyTarget: draft.weeklyTarget, area: draft.area || null };
    if (editing) updateHabit(id, patch); else addHabit(patch);
    closeSheet();
  });

  sheet.querySelector('#h-delete')?.addEventListener('click', async () => {
    closeSheet();
    if (await confirmSheet({ title: 'Delete habit?', message: `“${editing.name}” and its history will be removed.` })) {
      removeHabit(id);
      toast('Habit deleted', { actionLabel: 'Undo', icon: 'trash', onAction: undoLast });
    }
  });
}

MM.views = MM.views || {};
MM.views.habits = { render };

})(window.MM = window.MM || {});
