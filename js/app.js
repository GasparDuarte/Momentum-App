// app.js — entry point: init, theming, routing, nav, settings, PWA.
(function (MM) {
const store = MM.store;
const { $, prettyToday, esc, prefersReducedMotion } = MM.utils;
const { icon } = MM.icons;
const { openSheet, closeSheet, toast, confirmSheet } = MM.ui;

const views = {
  home: MM.views.home,
  habits: MM.views.habits,
  tasks: MM.views.tasks,
  goals: MM.views.goals,
  stats: MM.views.stats,
};
const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'habits', label: 'Habits', icon: 'repeat' },
  { id: 'tasks', label: 'Tasks', icon: 'listChecks' },
  { id: 'goals', label: 'Goals', icon: 'target' },
  { id: 'stats', label: 'Status', icon: 'barChart' },
];
const ACCENTS = {
  violet: 'linear-gradient(135deg,#8b5cff,#ff49c0)',
  cyan: 'linear-gradient(135deg,#22d3ee,#6a5cff)',
  pink: 'linear-gradient(135deg,#ff49c0,#ff8a3d)',
  blue: 'linear-gradient(135deg,#4f74ff,#22d3ee)',
  green: 'linear-gradient(135deg,#14e0a0,#22d3ee)',
};
const BG = { light: '#eef0fb', dark: '#07060f' };

let current = 'home';
let devVisual = false; // when the dev panel is driving the scene, skip auto perf updates
let devPanelEl = null;

/* ---------- theming ---------- */
function applyTheme(settings) {
  const root = document.documentElement;
  root.dataset.theme = settings.theme || 'light';
  root.dataset.accent = settings.accent || 'indigo';
  $('#theme-color-meta')?.setAttribute('content', BG[settings.theme] || BG.light);
  const tt = $('#theme-toggle');
  if (tt) tt.innerHTML = icon(settings.theme === 'dark' ? 'sun' : 'moon', 20);
}

/* ---------- visual energy system (scene reacts to progress) ---------- */
function energyFromState({ momentum, streak, objectives }) {
  const m = Math.max(0, Math.min(1, momentum / 100));
  const s = streak >= 100 ? 1 : streak >= 30 ? 0.85 : streak >= 14 ? 0.65 : streak >= 7 ? 0.45 : streak >= 3 ? 0.25 : 0;
  const o = objectives >= 5 ? 1 : objectives >= 3 ? 0.65 : objectives >= 1 ? 0.3 : 0;
  const city = Math.min(1, m * 0.45 + s * 0.35 + o * 0.20);
  return { m, s, o, city };
}
const energyTier = (c) => c >= 0.9 ? 'overdrive' : c >= 0.7 ? 'charged' : c >= 0.45 ? 'active' : c >= 0.2 ? 'warming' : 'standby';
const streakTier = (s) => s >= 100 ? 'legend' : s >= 30 ? 'elite' : s >= 14 ? 'strong' : s >= 7 ? 'building' : s >= 3 ? 'ignition' : 'zero';
const objState = (o) => o >= 5 ? 'complete' : o >= 3 ? 'active' : o >= 1 ? 'started' : 'empty';

function updateEnergyState({ momentum, streak, objectives }) {
  const { m, s, o, city } = energyFromState({ momentum, streak, objectives });
  const root = document.documentElement;
  root.style.setProperty('--momentum-energy', m.toFixed(3));
  root.style.setProperty('--streak-energy', s.toFixed(3));
  root.style.setProperty('--objective-energy', o.toFixed(3));
  root.style.setProperty('--city-energy', city.toFixed(3));
  root.style.setProperty('--perf', city.toFixed(3)); // legacy alias
  root.dataset.energyTier = energyTier(city);
  root.dataset.streakTier = streakTier(streak);
  root.dataset.objectiveState = objState(objectives);
}

let lastProtoComplete = false;
function applyPerf() {
  if (devVisual) return; // dev panel is overriding the scene
  const mo = store.momentum();
  const objectives = mo.protocol + mo.habits; // objectives executed today
  updateEnergyState({ momentum: mo.score, streak: mo.streak, objectives });
  const done = mo.protocolTotal > 0 && mo.protocol >= mo.protocolTotal;
  if (done && !lastProtoComplete) triggerEnergySurge();
  lastProtoComplete = done;
}

/* a brief, premium "power surge" from the reactor — on completing your day */
function triggerEnergySurge() {
  if (prefersReducedMotion()) return;
  document.body.classList.remove('energy-surge');
  void document.body.offsetWidth;
  document.body.classList.add('energy-surge');
  setTimeout(() => document.body.classList.remove('energy-surge'), 1500);
}

/* ---------- visual debug panel (open from Settings or ?dev=1) ---------- */
function openVisualDebug() {
  if (!devPanelEl) buildDevPanel();
  devPanelEl.hidden = false;
}
function buildDevPanel() {
  const preview = { momentum: 0, streak: 0, objectives: 0 };
  const apply = () => { devVisual = true; updateEnergyState(preview); if (preview.objectives >= 5) triggerEnergySurge(); };

  const row = (label, attr, opts) =>
    `<label>${label}</label><div class="dvc-row">${opts.map(([v, t]) => `<button data-${attr}="${v}">${t}</button>`).join('')}</div>`;

  const panel = document.createElement('div');
  panel.className = 'dev-visual-controls';
  panel.innerHTML = `
    <strong>Visual Debug</strong>
    <button class="dvc-close" data-close="1" aria-label="Close">${icon('x', 14)}</button>
    ${row('Momentum', 'momentum', [[0,'0'],[25,'25'],[50,'50'],[75,'75'],[100,'100']])}
    ${row('Streak', 'streak', [[0,'0d'],[3,'3d'],[7,'7d'],[14,'14d'],[30,'30d'],[100,'100d']])}
    ${row('Objectives', 'objectives', [[0,'0/5'],[1,'1/5'],[3,'3/5'],[5,'5/5']])}
    ${row('Theme', 'theme-toggle', [['dark','Night'],['light','Day']])}
    <div class="dvc-row" style="margin-top:10px">
      <button data-demo="max" class="dvc-demo">⚡ Demo Max</button>
      <button data-demo="reset" class="dvc-demo">Reset</button>
    </div>
  `;
  document.body.appendChild(panel);
  devPanelEl = panel;

  const markBtn = (attr, btn) => panel.querySelectorAll(`[data-${attr}]`).forEach((x) => x.classList.toggle('on', x === btn));
  const syncMarks = () => {
    const setOn = (attr, val) => panel.querySelectorAll(`[data-${attr}]`).forEach((x) => x.classList.toggle('on', Number(x.getAttribute(`data-${attr}`)) === val));
    setOn('momentum', preview.momentum); setOn('streak', preview.streak); setOn('objectives', preview.objectives);
  };

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.close) {
      devVisual = false; lastProtoComplete = false;
      panel.querySelectorAll('button.on').forEach((x) => x.classList.remove('on'));
      panel.hidden = true; applyPerf();
    } else if (b.dataset.momentum != null) { preview.momentum = +b.dataset.momentum; markBtn('momentum', b); apply(); }
    else if (b.dataset.streak != null) { preview.streak = +b.dataset.streak; markBtn('streak', b); apply(); }
    else if (b.dataset.objectives != null) { preview.objectives = +b.dataset.objectives; markBtn('objectives', b); apply(); }
    else if (b.dataset.themeToggle) { store.setTheme(b.dataset.themeToggle); markBtn('theme-toggle', b); }
    else if (b.dataset.demo === 'max') { preview.momentum = 100; preview.streak = 100; preview.objectives = 5; syncMarks(); apply(); }
    else if (b.dataset.demo === 'reset') { preview.momentum = 0; preview.streak = 0; preview.objectives = 0; syncMarks(); apply(); }
  });
}

/* ---------- appbar ---------- */
function refreshAppbar() {
  const s = store.getState().settings;
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#greeting').textContent = s.name ? `${part}, ${s.name}` : part;
  $('#today-date').textContent = prettyToday();
}

/* ---------- nav ---------- */
function buildTabs() {
  const bar = $('#tabbar');
  bar.innerHTML = TABS.map((t) =>
    `<button class="tab" data-route="${t.id}">${icon(t.icon, 23)}<span>${t.label}</span></button>`).join('');
  bar.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => go(b.dataset.route)));
}
function updateTabs() {
  $('#tabbar').querySelectorAll('.tab').forEach((b) =>
    b.classList.toggle('active', b.dataset.route === current));
}

function renderCurrent(animateIn) {
  const el = $('#view');
  el.classList.remove('view-enter');
  if (animateIn) { void el.offsetWidth; el.classList.add('view-enter'); }
  views[current].render(el, { animateIn });
}

function go(route) {
  if (!(route in views)) route = 'home';
  current = route;
  if (location.hash !== '#' + route) location.hash = route;
  updateTabs();
  renderCurrent(true);
  window.scrollTo({ top: 0 });
}

/* ---------- settings sheet ---------- */
function openSettings() {
  const s = store.getState().settings;
  const sheet = openSheet(`
    <h3>Settings</h3>
    <p class="sub">Make Momentum yours. Your data stays on this device.</p>

    <div class="field">
      <label>Your name (for the greeting)</label>
      <input class="input" id="set-name" placeholder="e.g. Gaspar" maxlength="24" value="${esc(s.name || '')}" />
    </div>

    <div class="set-row">
      <div><div class="t">Dark mode</div><div class="d">Easy on the eyes at night.</div></div>
      <button class="switch ${s.theme === 'dark' ? 'on' : ''}" id="set-theme" aria-label="Toggle dark mode"></button>
    </div>

    <div class="set-row">
      <div><div class="t">Accent color</div><div class="d">A little personality.</div></div>
      <div class="accent-grid" id="set-accent">
        ${Object.entries(ACCENTS).map(([k, v]) =>
          `<button class="accent-swatch ${k === s.accent ? 'active' : ''}" data-accent="${k}" style="background:${v}" aria-label="${k}"></button>`).join('')}
      </div>
    </div>

    <div class="set-row">
      <div><div class="t">Visual debug</div><div class="d">Preview how the interface evolves with progress.</div></div>
      <button class="btn btn--ghost" id="set-devvis">Open</button>
    </div>

    <div class="section-head" style="margin:18px 0 6px"><h2 style="font-size:.92rem">Backup</h2></div>
    <p class="sub" style="margin-bottom:12px">Export your data to a file so you never lose it, and restore it on any device.</p>
    <div class="sheet-actions">
      <button class="btn btn--ghost btn--block" id="set-export">${icon('download', 18)} Export</button>
      <button class="btn btn--ghost btn--block" id="set-import">${icon('upload', 18)} Import</button>
    </div>

    <div id="install-row"></div>

    <div class="set-row" style="margin-top:14px">
      <div><div class="t" style="color:var(--red)">Erase everything</div><div class="d">Delete all data on this device. Cannot be undone.</div></div>
      <button class="btn btn--ghost" id="set-wipe" style="color:var(--red)">${icon('trash', 18)}</button>
    </div>

    <p class="center-muted" style="margin-top:16px">Momentum · v1 · made for you</p>
  `);

  sheet.querySelector('#set-name').addEventListener('change', (e) => { store.setName(e.target.value); refreshAppbar(); });
  sheet.querySelector('#set-theme').addEventListener('click', (e) => {
    const next = store.getState().settings.theme === 'dark' ? 'light' : 'dark';
    store.setTheme(next);
    e.target.classList.toggle('on', next === 'dark');
  });
  sheet.querySelectorAll('#set-accent .accent-swatch').forEach((b) => b.addEventListener('click', () => {
    store.setAccent(b.dataset.accent);
    sheet.querySelectorAll('#set-accent .accent-swatch').forEach((x) => x.classList.toggle('active', x === b));
  }));

  sheet.querySelector('#set-devvis').addEventListener('click', () => { closeSheet(); openVisualDebug(); });
  sheet.querySelector('#set-export').addEventListener('click', exportBackup);
  sheet.querySelector('#set-import').addEventListener('click', importBackup);
  sheet.querySelector('#set-wipe').addEventListener('click', async () => {
    closeSheet();
    const ok = await confirmSheet({
      title: 'Erase everything?', message: 'All your tasks, habits and history will be permanently deleted.',
      confirmLabel: 'Erase all',
    });
    if (ok) { await store.wipeAll(); toast('All data erased'); go('home'); }
  });

  if (deferredInstall) {
    sheet.querySelector('#install-row').innerHTML =
      `<button class="btn btn--soft btn--block" id="set-install" style="margin-top:14px">${icon('download', 18)} Install app on this device</button>`;
    sheet.querySelector('#set-install').addEventListener('click', async () => {
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      closeSheet();
    });
  }
}

function exportBackup() {
  const data = store.exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `momentum-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('Backup downloaded', { icon: 'download' });
}

function importBackup() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.addEventListener('change', async () => {
    const file = inp.files?.[0]; if (!file) return;
    try {
      await store.importData(await file.text());
      closeSheet();
      toast('Backup restored', { icon: 'check' });
    } catch (e) {
      toast(e.message || 'Could not import file', { icon: 'alert', duration: 4000 });
    }
  });
  inp.click();
}

/* ---------- PWA install ---------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

/* ---------- boot / loading splash ---------- */
function playBootSplash() {
  const el = document.getElementById('boot');
  if (!el) return;
  const fill = el.querySelector('.boot__bar > i');
  const pctEl = el.querySelector('.boot__pct');
  const statusEl = el.querySelector('.boot__status');

  const finish = () => {
    if (fill) fill.style.width = '100%';
    if (pctEl) pctEl.textContent = '100%';
    if (statusEl) statusEl.textContent = 'SYSTEM ONLINE';
    el.classList.add('boot--ready');
    setTimeout(() => {
      el.classList.add('boot--done');
      setTimeout(() => el.remove(), 600);
    }, 420);
  };

  if (prefersReducedMotion()) { finish(); return; }

  const DURATION = 1150;
  let start = null;
  function frame(now) {
    if (start === null) start = now;
    const t = Math.min((now - start) / DURATION, 1);
    const p = Math.round(t * 100);
    if (fill) fill.style.width = p + '%';
    if (pctEl) pctEl.textContent = p + '%';
    if (t < 1) requestAnimationFrame(frame); else finish();
  }
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
async function boot() {
  await store.init();
  applyTheme(store.getState().settings);
  applyPerf();
  refreshAppbar();
  buildTabs();

  $('#theme-toggle').addEventListener('click', () => {
    const next = store.getState().settings.theme === 'dark' ? 'light' : 'dark';
    store.setTheme(next);
  });
  $('#open-settings').addEventListener('click', openSettings);
  $('#open-settings').innerHTML = icon('settings', 20);

  store.subscribe(() => { applyTheme(store.getState().settings); applyPerf(); renderCurrent(false); });

  window.addEventListener('hashchange', () => {
    const r = location.hash.slice(1) || 'home';
    if (r !== current && r in views) { current = r; updateTabs(); renderCurrent(true); window.scrollTo({ top: 0 }); }
  });

  // Pause the ambient scene whenever the app isn't the active view (another
  // window focused, tab hidden, minimised). This frees the GPU for whatever else
  // is running — e.g. a video playing alongside — and lets the glass surfaces
  // stop re-blurring the moving background. It resumes instantly on return.
  const html = document.documentElement;
  const syncIdle = () => html.classList.toggle('fx-idle', document.hidden || !document.hasFocus());
  window.addEventListener('focus', syncIdle);
  window.addEventListener('blur', syncIdle);

  // keep the date / calendar fresh when returning to the app (e.g. across midnight)
  document.addEventListener('visibilitychange', () => {
    syncIdle();
    if (!document.hidden) { refreshAppbar(); renderCurrent(false); }
  });
  syncIdle();

  const initial = location.hash.slice(1);
  go(initial in views ? initial : 'home');

  // dev/demo visual controls — also openable from Settings
  if (new URLSearchParams(location.search).get('dev') === '1') openVisualDebug();

  // Ask the browser to keep our data durable so it isn't evicted under storage
  // pressure. Best-effort: usually granted automatically for installed PWAs.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted()
      .then((already) => { if (!already) return navigator.storage.persist(); })
      .catch(() => {});
  }

  // Service worker only works over http(s) — skip silently on file://.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () =>
      navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
  }
}

playBootSplash();
boot();

})(window.MM = window.MM || {});
