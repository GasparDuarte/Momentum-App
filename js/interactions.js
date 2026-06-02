// interactions.js — touch swipe (complete / delete) and drag-to-reorder.
(function (MM) {
const { haptic } = MM.utils;

const NO_SWIPE = 'button, a, input, textarea, select, .check, .drag-handle, .ghostbtn';

/**
 * Swipe a card right to complete, left to delete. Tapping fires onTap.
 * Expects markup: .swipe > (.swipe__bg, .swipe__fg)
 */
function attachSwipe(swipeEl, { onComplete, onDelete, onTap } = {}) {
  const fg = swipeEl.querySelector('.swipe__fg');
  const bg = swipeEl.querySelector('.swipe__bg');
  if (!fg) return;
  fg.style.touchAction = 'pan-y';

  let startX = 0, startY = 0, dx = 0, engaged = false, decided = false, pid = null;
  const width = () => swipeEl.offsetWidth;
  const THRESH = () => Math.min(120, width() * 0.32);

  const onDown = (e) => {
    if (e.target.closest(NO_SWIPE)) return;
    startX = e.clientX; startY = e.clientY; dx = 0;
    engaged = false; decided = false; pid = e.pointerId;
    fg.addEventListener('pointermove', onMove);
    fg.addEventListener('pointerup', onUp);
    fg.addEventListener('pointercancel', onUp);
  };

  const onMove = (e) => {
    const mx = e.clientX - startX, my = e.clientY - startY;
    if (!decided) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      decided = true;
      if (Math.abs(mx) > Math.abs(my)) {
        engaged = true;
        fg.classList.add('dragging');
        try { fg.setPointerCapture(pid); } catch (_) {}
      } else { cleanup(); return; }
    }
    if (!engaged) return;
    dx = mx;
    fg.style.transform = `translateX(${dx}px)`;
    if (bg) {
      bg.classList.toggle('lean-right', dx > 0);
      bg.classList.toggle('lean-left', dx < 0);
      const ds = bg.querySelector('.done-side'), dl = bg.querySelector('.del-side');
      const on = Math.abs(dx) > THRESH();
      if (ds) ds.style.opacity = dx > 0 && on ? 1 : dx > 0 ? 0.5 : 0;
      if (dl) dl.style.opacity = dx < 0 && on ? 1 : dx < 0 ? 0.5 : 0;
    }
  };

  const onUp = () => {
    if (engaged) {
      const t = THRESH();
      if (dx > t && onComplete) { fly(width()); haptic(16); onComplete(); }
      else if (dx < -t && onDelete) { fly(-width()); haptic(20); setTimeout(onDelete, 180); }
      else snapBack();
    } else if (!decided && onTap) {
      onTap();
    }
    cleanup();
  };

  const fly = (to) => { fg.classList.remove('dragging'); fg.style.transform = `translateX(${to}px)`; fg.style.opacity = '0'; };
  const snapBack = () => { fg.classList.remove('dragging'); fg.style.transform = ''; if (bg) bg.classList.remove('lean-right', 'lean-left'); };
  const cleanup = () => {
    fg.removeEventListener('pointermove', onMove);
    fg.removeEventListener('pointerup', onUp);
    fg.removeEventListener('pointercancel', onUp);
    engaged = false; decided = false;
  };

  fg.addEventListener('pointerdown', onDown);
}

/**
 * Drag-to-reorder by a `.drag-handle` inside each `[data-id]` row.
 * The dragged item follows the finger; siblings slide into place (FLIP).
 * Calls onReorder(orderedIds) on drop.
 */
const SLIDE = 'transform 0.2s cubic-bezier(0.22,0.61,0.36,1)';

function attachDragReorder(listEl, { onReorder, handle = '.drag-handle', itemSel = '[data-id]', idAttr = 'id' } = {}) {
  const siblingsOf = (item) => [...listEl.querySelectorAll(itemSel)].filter((s) => s !== item);

  const onDown = (e) => {
    const grip = e.target.closest(handle);
    if (!grip) return;
    const item = grip.closest(itemSel);
    if (!item || !listEl.contains(item)) return;
    e.preventDefault();
    item.classList.add('dragging');
    item.style.transition = 'none';
    item.style.willChange = 'transform';
    try { grip.setPointerCapture(e.pointerId); } catch (_) {}
    haptic(14);

    const r0 = item.getBoundingClientRect();
    const grabDy = e.clientY - r0.top;

    const follow = (clientY) => {
      item.style.transform = '';                       // measure natural position
      const top = item.getBoundingClientRect().top;
      const dy = clientY - top - grabDy;
      item.style.transform = `translateY(${dy}px) scale(1.02)`;
    };

    const flip = (mutate) => {
      const sibs = siblingsOf(item);
      const firsts = sibs.map((s) => s.getBoundingClientRect().top);
      mutate();
      sibs.forEach((s, i) => {
        const delta = firsts[i] - s.getBoundingClientRect().top;
        if (!delta) return;
        s.style.transition = 'none';
        s.style.transform = `translateY(${delta}px)`;
        requestAnimationFrame(() => {
          s.style.transition = SLIDE;
          s.style.transform = '';
        });
      });
    };

    const onMove = (ev) => {
      const dragRect = item.getBoundingClientRect();
      const center = dragRect.top + dragRect.height / 2;
      for (const sib of siblingsOf(item)) {
        const r = sib.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        const pos = item.compareDocumentPosition(sib);
        if (center < mid && (pos & Node.DOCUMENT_POSITION_PRECEDING)) { flip(() => listEl.insertBefore(item, sib)); break; }
        if (center > mid && (pos & Node.DOCUMENT_POSITION_FOLLOWING)) { flip(() => listEl.insertBefore(item, sib.nextSibling)); break; }
      }
      follow(ev.clientY);
    };

    const onUp = () => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      grip.removeEventListener('pointercancel', onUp);
      item.classList.remove('dragging');
      // settle back into the flow, then commit (re-render replaces the node)
      item.style.transition = SLIDE;
      item.style.transform = '';
      const ids = [...listEl.querySelectorAll(itemSel)].map((el) => el.dataset[idAttr]);
      siblingsOf(item).forEach((s) => { s.style.transition = ''; s.style.transform = ''; });
      setTimeout(() => onReorder?.(ids), 60);
    };

    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', onUp);
    follow(e.clientY);
  };

  listEl.addEventListener('pointerdown', onDown);
}

MM.interactions = { attachSwipe, attachDragReorder };

})(window.MM = window.MM || {});
