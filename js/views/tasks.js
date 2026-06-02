// views/tasks.js — Tasks (Urgent/Week/Month) + Errands, with a To-do / Done(history) switch.
(function (MM) {
const {
  BUCKETS, tasksByBucket, bucketCount, addTask, updateTask, toggleTask, removeTask, reorderTasks,
  pendingList, addPending, updatePending, togglePending, removePending,
  historyItems, undoLast, getState,
} = MM.store;
const { icon, checkPath } = MM.icons;
const { dueChip, emptyState } = MM.components;
const { esc, haptic, dateKey, daysBetween, todayKey, monthLabel } = MM.utils;
const { openSheet, closeSheet, toast, confirmSheet, pulse } = MM.ui;
const { attachSwipe, attachDragReorder } = MM.interactions;

let mode = 'todo';        // 'todo' | 'done'
let keepFocus = null;     // which inline-add to refocus: 'urgent'|'week'|'month'|'errand'

const bucketLabel = (id) => (BUCKETS.find((b) => b.id === id)?.label) || 'Task';
const bucketCls = (id) => (BUCKETS.find((b) => b.id === id)?.cls) || 'c';

function render(el, { animateIn } = {}) {
  const doneCount = historyItems().length;
  el.innerHTML = `
    <div class="section-head"><h2>Tasks</h2></div>
    <div class="seg block" id="t-mode" style="margin-bottom:6px">
      <button data-m="todo" class="${mode === 'todo' ? 'active' : ''}">To do</button>
      <button data-m="done" class="${mode === 'done' ? 'active' : ''}">Done${doneCount ? ` · ${doneCount}` : ''}</button>
    </div>
    ${mode === 'todo' ? todoHTML(animateIn) : doneHTML(animateIn)}
  `;
  wire(el);
}

/* ---------------- To-do ---------------- */
function todoHTML(animateIn) {
  const empty = getState().tasks.every((t) => t.done) && getState().pending.every((p) => p.done);
  return `
    ${empty ? emptyState('listChecks', 'Operations clear',
      'No active tasks. Capture what matters and prioritise it. Swipe right to complete, left to delete.') : ''}
    ${BUCKETS.map((b) => bucketSection(b, animateIn)).join('')}
    ${errandSection(animateIn)}
  `;
}

function bucketSection(b, animateIn) {
  const tasks = tasksByBucket(b.id).filter((t) => !t.done);
  const { open } = bucketCount(b.id);
  return `
    <div class="bucket-head"><span class="dot ${b.cls}"></span><h3>${b.label}</h3><span class="count">${open || ''}</span></div>
    <div class="list ${animateIn ? 'stagger' : ''}" data-bucket="${b.id}">
      ${tasks.map((t) => taskRow(t, b.cls)).join('')}
    </div>
    ${tasks.length ? '' : '<div class="bucket-empty">Nothing here yet.</div>'}
    <form class="inline-add" data-add="${b.id}" style="margin-top:10px">
      <input class="input" placeholder="Add to ${b.label.toLowerCase()}…" maxlength="120" autocomplete="off" />
      <button class="btn btn--soft" type="submit" aria-label="Add">${icon('plus', 18)}</button>
    </form>`;
}

function errandSection(animateIn) {
  const items = pendingList().filter((p) => !p.done);
  return `
    <div class="bucket-head"><span class="dot c"></span><h3>Errands</h3><span class="count">${items.length || ''}</span></div>
    <div class="list ${animateIn ? 'stagger' : ''}" data-errands>
      ${items.map(errandRow).join('')}
    </div>
    ${items.length ? '' : '<div class="bucket-empty">Nothing here yet.</div>'}
    <form class="inline-add" data-add="errand" style="margin-top:10px">
      <input class="input" placeholder="Add an errand…" maxlength="100" autocomplete="off" />
      <button class="btn btn--soft" type="submit" aria-label="Add">${icon('plus', 18)}</button>
    </form>`;
}

function taskRow(t, cls) {
  const sub = [];
  if (t.note) sub.push(`<span>${icon('note', 12)} ${esc(t.note.slice(0, 38))}${t.note.length > 38 ? '…' : ''}</span>`);
  const due = t.due ? dueChip(t.due) : '';
  return swipeRow(t.id, 'task', cls, t.title, sub.join('') + (due ? ' ' + due : ''), true);
}

function errandRow(p) {
  const chip = p.remind ? dueChip(p.remind, { icon: 'bell' }) : '';
  const note = p.note ? `<span>${icon('note', 12)} ${esc(p.note.slice(0, 38))}</span>` : '';
  return swipeRow(p.id, 'errand', 'c', p.title, note + (chip ? ' ' + chip : ''), false);
}

function swipeRow(id, kind, cls, title, subHTML, handle) {
  return `
    <div class="swipe" data-id="${id}" data-kind="${kind}">
      <div class="swipe__bg">
        <span class="done-side">${icon('check', 18)} Done</span>
        <span class="del-side">Delete ${icon('trash', 16)}</span>
      </div>
      <div class="swipe__fg">
        <div class="row">
          <div class="check ${cls}" role="button" tabindex="0" aria-label="Complete">${checkPath}</div>
          <div class="row__main">
            <div class="row__title"><span class="strike">${esc(title)}</span></div>
            ${subHTML.trim() ? `<div class="row__sub">${subHTML}</div>` : ''}
          </div>
          ${handle ? `<div class="row__trail"><button class="ghostbtn drag-handle" aria-label="Reorder">${icon('grip', 17)}</button></div>` : ''}
        </div>
      </div>
    </div>`;
}

/* ---------------- Done / history ---------------- */
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* Group header: an explicit date for each day you cleared things. */
function dayLabel(iso) {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  const diff = daysBetween(todayKey(), dateKey(d));
  const md = `${monthLabel(d.getMonth())} ${d.getDate()}`;
  const yr = d.getFullYear() !== new Date().getFullYear() ? `, ${d.getFullYear()}` : '';
  if (diff === 0) return `Today · ${md}`;
  if (diff === -1) return `Yesterday · ${md}`;
  return `${WD[d.getDay()]}, ${md}${yr}`;
}

/* Per-item completion time, so the log reads "cleared at …". */
function timeChip(iso) {
  if (!iso) return '';
  const time = new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `<span class="chip">${icon('clock', 12)} ${esc(time)}</span>`;
}

function doneHTML(animateIn) {
  const items = historyItems();
  if (!items.length) {
    return emptyState('checkCircle', 'Mission log empty',
      'Everything you complete is logged here — proof of execution.');
  }
  const groups = [];
  let cur = null;
  items.forEach((it) => {
    const label = dayLabel(it.completedAt);
    if (!cur || cur.label !== label) { cur = { label, items: [] }; groups.push(cur); }
    cur.items.push(it);
  });
  return groups.map((g) => `
    <div class="hist-day">${g.label}</div>
    <div class="list ${animateIn ? 'stagger' : ''}">
      ${g.items.map(historyRow).join('')}
    </div>`).join('');
}

function historyRow(it) {
  const tag = it.kind === 'pending'
    ? `<span class="chip"><span class="dot c" style="width:7px;height:7px;box-shadow:none"></span> Errand</span>`
    : `<span class="chip"><span class="dot ${bucketCls(it.bucket)}" style="width:7px;height:7px;box-shadow:none"></span> ${esc(bucketLabel(it.bucket))}</span>`;
  return `
    <div class="swipe" data-id="${it.id}" data-kind="${it.kind}">
      <div class="swipe__bg"><span class="del-side" style="margin-left:auto">Delete ${icon('trash', 16)}</span></div>
      <div class="swipe__fg">
        <div class="row done">
          <div class="check is-done" role="button" tabindex="0" aria-label="Restore">${checkPath}</div>
          <div class="row__main">
            <div class="row__title"><span class="strike">${esc(it.title)}</span></div>
            <div class="row__sub">${tag} ${timeChip(it.completedAt)}</div>
          </div>
          <div class="row__trail"><button class="ghostbtn danger del-btn" aria-label="Delete">${icon('trash', 17)}</button></div>
        </div>
      </div>
    </div>`;
}

/* ---------------- wiring ---------------- */
function wire(el) {
  el.querySelectorAll('#t-mode button').forEach((b) => b.addEventListener('click', () => {
    if (mode === b.dataset.m) return;
    mode = b.dataset.m; haptic(8); render(el, { animateIn: true });
  }));

  if (mode === 'todo') wireTodo(el); else wireDone(el);
}

function wireTodo(el) {
  el.querySelectorAll('.inline-add').forEach((form) => {
    const key = form.dataset.add;
    const input = form.querySelector('input');
    if (keepFocus === key) { input.focus(); keepFocus = null; }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim(); if (!v) return;
      keepFocus = key; haptic(10);
      if (key === 'errand') addPending({ title: v }); else addTask({ title: v, bucket: key });
    });
  });

  el.querySelectorAll('.swipe').forEach((sw) => {
    const id = sw.dataset.id, kind = sw.dataset.kind;
    const toggle = () => { haptic(12); kind === 'errand' ? togglePending(id) : toggleTask(id); };
    const isDone = () => { const arr = kind === 'errand' ? getState().pending : getState().tasks; return arr.find((x) => x.id === id)?.done; };
    sw.querySelector('.check').addEventListener('click', (e) => { e.stopPropagation(); if (!isDone()) pulse(sw.querySelector('.check')); toggle(); });
    attachSwipe(sw, {
      onTap: () => kind === 'errand' ? openErrandSheet(id) : openTaskSheet(id),
      onComplete: () => { if (!isDone()) toggle(); },
      onDelete: () => {
        kind === 'errand' ? removePending(id) : removeTask(id);
        toast('Deleted', { actionLabel: 'Undo', icon: 'trash', onAction: undoLast });
      },
    });
  });

  el.querySelectorAll('.list[data-bucket]').forEach((list) => {
    attachDragReorder(list, { onReorder: (ids) => reorderTasks(list.dataset.bucket, ids) });
  });
}

function wireDone(el) {
  el.querySelectorAll('.swipe').forEach((sw) => {
    const id = sw.dataset.id, kind = sw.dataset.kind;
    const restore = () => { haptic(12); kind === 'pending' ? togglePending(id) : toggleTask(id); toast('Restored', { icon: 'check' }); };
    const del = () => { kind === 'pending' ? removePending(id) : removeTask(id); toast('Deleted', { actionLabel: 'Undo', icon: 'trash', onAction: undoLast }); };
    sw.querySelector('.check').addEventListener('click', (e) => { e.stopPropagation(); restore(); });
    sw.querySelector('.del-btn').addEventListener('click', (e) => { e.stopPropagation(); del(); });
    attachSwipe(sw, { onTap: restore, onDelete: del });
  });
}

/* ---------------- sheets ---------------- */
function openTaskSheet(id) {
  const t = getState().tasks.find((x) => x.id === id);
  if (!t) return;
  let bucket = t.bucket;
  const sheet = openSheet(`
    <h3>Edit task</h3>
    <div class="field"><label>Task</label><input class="input" id="t-title" value="${esc(t.title)}" maxlength="120" /></div>
    <div class="field"><label>Note (optional)</label><textarea class="textarea" id="t-note" placeholder="Any detail you want to remember…">${esc(t.note || '')}</textarea></div>
    <div class="field"><label>Due date (optional)</label><input class="input" id="t-due" type="date" value="${esc(t.due || '')}" /></div>
    <div class="field"><label>Priority</label>
      <div class="choice-grid" id="t-bucket">
        ${BUCKETS.map((b) => `<button type="button" class="choice ${b.id === bucket ? 'active' : ''}" data-b="${b.id}">${b.label}</button>`).join('')}
      </div>
    </div>
    <div class="sheet-actions">
      <button class="btn btn--ghost" id="t-delete" style="color:var(--red)">${icon('trash', 18)}</button>
      <button class="btn btn--primary btn--block" id="t-save">Save</button>
    </div>
  `);
  sheet.querySelectorAll('#t-bucket button').forEach((b) => b.addEventListener('click', () => {
    sheet.querySelectorAll('#t-bucket button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); bucket = b.dataset.b;
  }));
  sheet.querySelector('#t-save').addEventListener('click', () => {
    const title = sheet.querySelector('#t-title').value.trim();
    if (!title) { sheet.querySelector('#t-title').focus(); return; }
    haptic(12);
    updateTask(id, { title, note: sheet.querySelector('#t-note').value.trim(), due: sheet.querySelector('#t-due').value, bucket });
    closeSheet();
  });
  sheet.querySelector('#t-delete').addEventListener('click', async () => {
    closeSheet();
    if (await confirmSheet({ title: 'Delete task?', message: `“${t.title}” will be removed.` })) {
      removeTask(id); toast('Task deleted', { actionLabel: 'Undo', icon: 'trash', onAction: undoLast });
    }
  });
}

function openErrandSheet(id) {
  const p = getState().pending.find((x) => x.id === id);
  if (!p) return;
  const sheet = openSheet(`
    <h3>Edit errand</h3>
    <div class="field"><label>Errand</label><input class="input" id="p-title" value="${esc(p.title)}" maxlength="100" /></div>
    <div class="field"><label>Note (optional)</label><textarea class="textarea" id="p-note" placeholder="Phone number, address, detail…">${esc(p.note || '')}</textarea></div>
    <div class="field"><label>Remind me on (optional)</label><input class="input" id="p-remind" type="date" value="${esc(p.remind || '')}" /></div>
    <div class="sheet-actions">
      <button class="btn btn--ghost" id="p-delete" style="color:var(--red)">${icon('trash', 18)}</button>
      <button class="btn btn--primary btn--block" id="p-save">Save</button>
    </div>
  `);
  sheet.querySelector('#p-save').addEventListener('click', () => {
    const title = sheet.querySelector('#p-title').value.trim();
    if (!title) { sheet.querySelector('#p-title').focus(); return; }
    haptic(12);
    updatePending(id, { title, note: sheet.querySelector('#p-note').value.trim(), remind: sheet.querySelector('#p-remind').value });
    closeSheet();
  });
  sheet.querySelector('#p-delete').addEventListener('click', async () => {
    closeSheet();
    if (await confirmSheet({ title: 'Delete errand?', message: `“${p.title}” will be removed.` })) {
      removePending(id); toast('Deleted', { actionLabel: 'Undo', icon: 'trash', onAction: undoLast });
    }
  });
}

MM.views = MM.views || {};
MM.views.tasks = { render };

})(window.MM = window.MM || {});
