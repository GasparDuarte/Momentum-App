// confetti.js — cyberpunk celebration: neon shockwave rings + glowing light shards.
(function (MM) {
const { prefersReducedMotion } = MM.utils;

const COLORS = ['#22d3ee', '#8b5cff', '#ff49c0', '#6a5cff', '#2ce59b'];

function confettiBurst() {
  const canvas = document.getElementById('confetti');
  if (!canvas || prefersReducedMotion()) return;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cx = W / 2, cy = H * 0.34;

  const rings = [0, 1, 2].map((i) => ({
    r: 6, max: 150 + i * 70, w: 5 - i * 1.2, color: COLORS[i], delay: i * 5,
  }));

  const shards = Array.from({ length: 52 }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.9;
    const sp = 7 + Math.random() * 10;
    return {
      x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      len: 12 + Math.random() * 26, color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 0, ttl: 46 + Math.random() * 34,
    };
  });

  let t = 0, raf;
  function frame() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    let alive = false;

    rings.forEach((rg) => {
      if (t < rg.delay) { alive = true; return; }
      const p = rg.r / rg.max;
      if (p >= 1) return;
      alive = true;
      rg.r += (rg.max - rg.r) * 0.08 + 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rg.r, 0, Math.PI * 2);
      ctx.strokeStyle = rg.color;
      ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
      ctx.lineWidth = rg.w;
      ctx.shadowBlur = 20; ctx.shadowColor = rg.color;
      ctx.stroke();
    });

    shards.forEach((s) => {
      s.life++;
      if (s.life > s.ttl) return;
      alive = true;
      s.vy += 0.16; s.vx *= 0.99;
      s.x += s.vx; s.y += s.vy;
      const fade = Math.max(0, 1 - s.life / s.ttl);
      const mag = Math.hypot(s.vx, s.vy) || 1;
      const ux = s.vx / mag, uy = s.vy / mag;
      ctx.globalAlpha = fade;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.4;
      ctx.shadowBlur = 12; ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - ux * s.len, s.y - uy * s.len);
      ctx.stroke();
    });

    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
    t++;
    if (alive) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  }
  cancelAnimationFrame(raf);
  frame();
}

MM.confetti = { confettiBurst };

})(window.MM = window.MM || {});
