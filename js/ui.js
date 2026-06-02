// ui.js — bottom sheets, toasts, celebration, and small shared UI helpers.
(function (MM) {
const { $, haptic, prefersReducedMotion } = MM.utils;
const { icon } = MM.icons;
const { confettiBurst } = MM.confetti;

/* Green completion flash anchored at an element (survives re-render). */
function pulse(el) {
  if (!el || prefersReducedMotion()) return;
  const r = el.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'cpulse';
  p.style.left = (r.left + r.width / 2) + 'px';
  p.style.top = (r.top + r.height / 2) + 'px';
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 600);
}

/* ---------- Celebration (subtle) ---------- */
function celebrate(title = 'Mission Complete', sub = 'Operator status: clear.') {
  haptic([18, 40, 18]);
  confettiBurst();
  const card = $('#celebrate');
  if (!card) return;
  card.innerHTML = `<div class="big-emoji">🎉</div><div class="t">${title}</div><div class="s">${sub}</div>`;
  card.classList.remove('show');
  void card.offsetWidth; // restart animation
  card.classList.add('show');
  setTimeout(() => card.classList.remove('show'), 2700);
}

/* ---------- Bottom sheet ---------- */
let activeSheet = null;

function openSheet(innerHTML, { onMount } = {}) {
  closeSheet(true);
  const root = $('#sheet-root');

  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `<div class="sheet__grip"></div>${innerHTML}`;

  root.append(scrim, sheet);
  requestAnimationFrame(() => { scrim.classList.add('show'); sheet.classList.add('show'); });

  const close = () => closeSheet();
  scrim.addEventListener('click', close);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  activeSheet = { scrim, sheet, onKey };
  onMount?.(sheet);
  setTimeout(() => sheet.querySelector('input,textarea,select')?.focus(), 80);
  return sheet;
}

function closeSheet(immediate = false) {
  if (!activeSheet) return;
  const { scrim, sheet, onKey } = activeSheet;
  activeSheet = null;
  document.removeEventListener('keydown', onKey);
  if (immediate) { scrim.remove(); sheet.remove(); return; }
  scrim.classList.remove('show');
  sheet.classList.remove('show');
  setTimeout(() => { scrim.remove(); sheet.remove(); }, 360);
}

/* ---------- Toast ---------- */
function toast(message, { actionLabel, onAction, icon: ic = 'check', duration = 2800 } = {}) {
  const root = $('#toast-root');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${icon(ic, 16)}<span>${message}</span>` +
    (actionLabel ? `<span class="undo" role="button">${actionLabel}</span>` : '');
  root.appendChild(t);

  let done = false;
  const dismiss = () => {
    if (done) return; done = true;
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  };
  if (actionLabel) {
    t.querySelector('.undo').addEventListener('click', () => {
      haptic(10); onAction?.(); dismiss();
    });
  }
  const timer = setTimeout(dismiss, duration);
  t.addEventListener('click', (e) => { if (!e.target.closest('.undo')) { clearTimeout(timer); dismiss(); } });
  return dismiss;
}

/* ---------- Confirm (returns a Promise<boolean>) ---------- */
function confirmSheet({ title, message, confirmLabel = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const sheet = openSheet(`
      <h3>${title}</h3>
      <p class="sub">${message}</p>
      <div class="sheet-actions">
        <button class="btn btn--ghost btn--block" data-act="cancel">Cancel</button>
        <button class="btn btn--block" data-act="ok"
          style="${danger ? 'background:var(--red);color:#fff' : 'background:var(--accent);color:#fff'}">${confirmLabel}</button>
      </div>
    `);
    sheet.querySelector('[data-act="cancel"]').onclick = () => { closeSheet(); resolve(false); };
    sheet.querySelector('[data-act="ok"]').onclick = () => { closeSheet(); resolve(true); };
  });
}

MM.ui = { celebrate, openSheet, closeSheet, toast, confirmSheet, pulse };

})(window.MM = window.MM || {});
