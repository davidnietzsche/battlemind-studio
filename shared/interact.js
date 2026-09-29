// Hero interactions for the v3 ("Interactive") designs. Each one reacts to the pointer in the hero.
// Budget rules for an 8GB Mac: canvases draw at 1x device pixels, loops stop while the pointer is idle or the
// hero is off-screen or the tab is hidden, and nothing measures layout per frame.
// Reduced motion: every interaction renders a still, readable state and never animates.
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = matchMedia("(hover: none)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // Runs `step(dt)` on rAF only while `el` is on screen and the tab is visible. `step` returns true to keep going
  // (still settling); returning false parks the loop until `wake()` is called (e.g. on pointer move).
  function loop(el, step) {
    let on = false, vis = false, last = 0, id = 0;
    const tick = (t) => { const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      if (vis && !document.hidden && step(dt, t)) id = requestAnimationFrame(tick); else { on = false; last = 0; } };
    const wake = () => { if (!on && vis && !document.hidden) { on = true; id = requestAnimationFrame(tick); } };
    new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis) wake(); }).observe(el);
    document.addEventListener("visibilitychange", wake);
    return { wake };
  }
  // Pointer position relative to an element, updated from events (never from per-frame layout reads).
  function pointer(el, onMove) {
    const p = { x: 0.5, y: 0.5, px: 0, py: 0, vx: 0, vy: 0, inside: false, r: el.getBoundingClientRect() };
    const measure = () => (p.r = el.getBoundingClientRect());
    addEventListener("resize", measure); addEventListener("scroll", measure, { passive: true });
    el.addEventListener("pointermove", (e) => {
      const x = e.clientX - p.r.left, y = e.clientY - p.r.top;
      p.vx = x - p.px; p.vy = y - p.py; p.px = x; p.py = y;
      p.x = clamp(x / p.r.width); p.y = clamp(y / p.r.height); p.inside = true; onMove && onMove(p);
    });
    el.addEventListener("pointerleave", () => { p.inside = false; onMove && onMove(p); });
    return p;
  }

  // 1 · Watcher: a head-turn frame sequence (left → right). Pointer X picks the frame, pointer Y tilts slightly.
  //     Touch devices: the head turns with scroll instead.
  function watcher(host, { dir, count, pad = 3 }) {
    const img = new Image(); img.className = "watcher-img"; img.alt = ""; img.decoding = "async";
    const frames = []; const src = (i) => `../shared/seq/${dir}/f${String(i + 1).padStart(pad, "0")}.webp`;
    for (let i = 0; i < count; i++) { const im = new Image(); im.src = src(i); frames.push(im); }
    const mid = Math.round((count - 1) / 2);
    img.src = src(mid); host.appendChild(img);
    if (reduce) return;
    let cur = mid, want = mid, tilt = 0, tiltWant = 0, shown = mid;
    const hero = host.closest("[data-hero]") || host;
    const L = loop(hero, (dt) => {
      cur += (want - cur) * Math.min(1, dt * 9); tilt += (tiltWant - tilt) * Math.min(1, dt * 6);
      const i = Math.round(cur);
      if (i !== shown && frames[i].complete) { img.src = frames[i].src; shown = i; host.dataset.frame = i; }
      img.style.transform = `rotateX(${tilt.toFixed(2)}deg) translateY(${(-tilt * 1.2).toFixed(1)}px)`;
      return Math.abs(want - cur) > 0.02 || Math.abs(tiltWant - tilt) > 0.02;
    });
    if (touch) {
      addEventListener("scroll", () => { const r = hero.getBoundingClientRect(); want = clamp(-r.top / r.height * 2) * (count - 1); L.wake(); }, { passive: true });
    } else {
      // the whole window counts, so the head keeps following when the pointer is over the headline
      addEventListener("pointermove", (e) => {
        const r = host.getBoundingClientRect(), cx = r.left + r.width / 2;
        const k = clamp(0.5 + (e.clientX - cx) / (innerWidth * 0.9));
        want = k * (count - 1); tiltWant = clamp((e.clientY - (r.top + r.height * 0.35)) / innerHeight, -0.6, 0.6) * -10; L.wake();
      });
    }
    host.dataset.frame = mid;
  }

  // 2 · Rhythm field: a grid of dots that swells and ripples with pointer speed. Idle = still.
  function field(canvas, { gap = 28, color = "215,0,15", base = 0.18 } = {}) {
    const ctx = canvas.getContext("2d"); let W = 0, H = 0, dots = [], ripples = [];
    const hero = canvas.closest("[data-hero]") || canvas.parentElement;
    const size = () => { W = canvas.width = canvas.clientWidth; H = canvas.height = canvas.clientHeight; dots = [];
      for (let y = gap / 2; y < H; y += gap) for (let x = gap / 2; x < W; x += gap) dots.push({ x, y, e: 0 }); draw(); };
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const d of dots) { const a = base + d.e * 0.82, r = 1.3 + d.e * 3.2;
        ctx.fillStyle = `rgba(${color},${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 6.2832); ctx.fill(); }
    }
    addEventListener("resize", size); size();
    if (reduce) return;
    const p = pointer(hero, () => L.wake());
    let energy = 0;
    const L = loop(hero, (dt, t) => {
      const sp = Math.hypot(p.vx, p.vy); p.vx *= 0.6; p.vy *= 0.6;
      const de = (Math.min(1, sp / 40) - energy) * 0.2; energy += de;
      if (sp > 26 && p.inside && (!ripples.length || t - ripples[ripples.length - 1].t > 120)) ripples.push({ x: p.px, y: p.py, t, r: 0 });
      ripples = ripples.filter((r) => (r.r += dt * 520) < Math.max(W, H));
      // "busy" means something is still changing, not that something is lit: a resting pointer settles and parks
      let busy = Math.abs(de) > 0.001 || ripples.length > 0;
      for (const d of dots) {
        let e = 0;
        if (p.inside) { const dx = d.x - p.px, dy = d.y - p.py, dist = Math.sqrt(dx * dx + dy * dy); e = Math.max(0, 1 - dist / 160) * (0.35 + energy * 0.65); }
        for (const r of ripples) { const dist = Math.hypot(d.x - r.x, d.y - r.y), band = Math.abs(dist - r.r); if (band < 26) e = Math.max(e, (1 - band / 26) * (1 - r.r / Math.max(W, H)) * 0.9); }
        const step = (e - d.e) * 0.25; d.e += step; if (Math.abs(step) > 0.0015) busy = true;
      }
      draw(); canvas.dataset.energy = energy.toFixed(3);
      return busy;
    });
  }

  // 3 · Magnetic type: letters lean away from the pointer and spring back.
  function magnetic(el, { radius = 180, force = 34 } = {}) {
    const text = el.textContent; el.setAttribute("aria-label", text);
    el.innerHTML = [...text].map((c) => c === " " ? " " : `<span class="mg" aria-hidden="true">${c}</span>`).join("");
    if (reduce) return;
    const ch = [...el.querySelectorAll(".mg")].map((s) => ({ s, x: 0, y: 0, tx: 0, ty: 0, cx: 0, cy: 0 }));
    const hero = el.closest("[data-hero]") || el;
    const measure = () => ch.forEach((c) => { const r = c.s.getBoundingClientRect(); c.cx = r.left + r.width / 2 - c.x; c.cy = r.top + r.height / 2 - c.y; });
    let mx = -9999, my = -9999;
    addEventListener("resize", measure); addEventListener("scroll", measure, { passive: true });
    hero.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; L.wake(); });
    hero.addEventListener("pointerleave", () => { mx = my = -9999; L.wake(); });
    requestAnimationFrame(measure);
    const L = loop(hero, () => {
      let busy = false;
      for (const c of ch) {
        const dx = c.cx - mx, dy = c.cy - my, d = Math.hypot(dx, dy), k = Math.max(0, 1 - d / radius);
        c.tx = d ? (dx / d) * k * force : 0; c.ty = d ? (dy / d) * k * force : 0;
        c.x += (c.tx - c.x) * 0.18; c.y += (c.ty - c.y) * 0.18;
        c.s.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0) rotate(${(c.x * 0.4).toFixed(1)}deg)`;
        if (Math.abs(c.tx - c.x) > 0.1 || Math.abs(c.ty - c.y) > 0.1) busy = true;
      }
      el.dataset.moved = ch.some((c) => Math.abs(c.x) > 1) ? "1" : "0";
      return busy;
    });
  }

  // 4 · Spotlight: a soft circle follows the pointer and reveals the layer underneath (CSS mask via variables).
  function spotlight(layer, { size = 220 } = {}) {
    const hero = layer.closest("[data-hero]") || layer.parentElement;
    layer.style.setProperty("--sr", size + "px");
    if (reduce) { layer.style.setProperty("--sx", "70%"); layer.style.setProperty("--sy", "50%"); return; }
    let x = hero.clientWidth * 0.7, y = hero.clientHeight * 0.5, tx = x, ty = y, rad = size, trad = size;
    const p = pointer(hero, () => L.wake());
    const L = loop(hero, () => {
      if (p.inside) { tx = p.px; ty = p.py; trad = size; } else { trad = size * 0.8; }
      x += (tx - x) * 0.16; y += (ty - y) * 0.16; rad += (trad - rad) * 0.12;
      layer.style.setProperty("--sx", x.toFixed(1) + "px"); layer.style.setProperty("--sy", y.toFixed(1) + "px"); layer.style.setProperty("--sr", rad.toFixed(1) + "px");
      layer.dataset.sx = Math.round(x);
      return Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3 || Math.abs(trad - rad) > 0.3;
    });
  }

  // 5 · Ink trail: soft red ink puffs follow the pointer and dissolve.
  // mode "light" draws on white paper (normal blending); the default adds light, for dark backgrounds
  function ink(canvas, { color = "215,0,15", mode = "dark" } = {}) {
    const ctx = canvas.getContext("2d"); let W = 0, H = 0, puffs = [];
    const hero = canvas.closest("[data-hero]") || canvas.parentElement;
    const size = () => { W = canvas.width = canvas.clientWidth; H = canvas.height = canvas.clientHeight; };
    addEventListener("resize", size); size();
    if (reduce) return;
    const p = pointer(hero, (pp) => { if (!pp.inside) return; const sp = Math.hypot(pp.vx, pp.vy);
      for (let i = 0; i < 1 + Math.min(3, sp / 18); i++) puffs.push({ x: pp.px + (Math.random() - 0.5) * 10, y: pp.py + (Math.random() - 0.5) * 10,
        vx: pp.vx * 0.05 + (Math.random() - 0.5) * 0.6, vy: pp.vy * 0.05 - Math.random() * 0.5, r: 6 + Math.random() * 10 + sp * 0.25, a: 0.5 });
      const cap = mode === "light" ? 520 : 260; if (puffs.length > cap) puffs.splice(0, puffs.length - cap); L.wake(); });
    // on white paper ink lingers and spreads (about 3s); on dark it is a quick glow (about 1s)
    const fade = mode === "light" ? 0.17 : 0.55, grow = mode === "light" ? 34 : 26;
    const L = loop(hero, (dt) => {
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = mode === "light" ? "source-over" : "lighter";
      for (const q of puffs) { q.x += q.vx; q.y += q.vy; q.vy -= 0.02; q.r += dt * grow; q.a -= dt * fade;
        if (q.a <= 0) continue; const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r);
        g.addColorStop(0, `rgba(${color},${(q.a * (mode === "light" ? 0.95 : 0.55)).toFixed(3)})`); g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.2832); ctx.fill(); }
      ctx.globalCompositeOperation = "source-over";
      puffs = puffs.filter((q) => q.a > 0); canvas.dataset.puffs = puffs.length;
      return puffs.length > 0;
    });
  }

  // 6 · Hover-scrub: pointer X scrubs a frame sequence on a canvas (before any scrolling happens).
  function hoverScrub(canvas, { dir, count }) {
    const ctx = canvas.getContext("2d"), frames = [];
    const hero = canvas.closest("[data-hero]") || canvas.parentElement;
    const src = (i) => `../shared/seq/${dir}/f${String(i + 1).padStart(3, "0")}.webp`;
    // reduced motion shows one still (the last frame), so only that frame is downloaded
    for (let i = 0; i < count; i++) { const im = new Image(); if (!reduce || i === count - 1) im.src = src(i); frames.push(im); }
    let cur = reduce ? count - 1 : 0, want = cur, shown = -1;
    const size = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; shown = -1; paint(Math.round(cur)); };
    function paint(i) { const f = frames[i]; if (!f || !f.complete || !f.naturalWidth) return false;
      const cw = canvas.width, ch = canvas.height, k = Math.max(cw / f.naturalWidth, ch / f.naturalHeight);
      ctx.drawImage(f, (cw - f.naturalWidth * k) / 2, (ch - f.naturalHeight * k) / 2, f.naturalWidth * k, f.naturalHeight * k); shown = i; canvas.dataset.frame = i; return true; }
    const first = frames[Math.round(cur)];
    if (first.complete && first.naturalWidth) size(); else first.onload = size;   // it may already be cached and loaded
    addEventListener("resize", size);                                            // size() repaints Math.round(cur), so the still survives resizes
    if (reduce) return;
    // the pointer is measured across the frame itself, so its full width spans the full turn
    const p = pointer(canvas.parentElement, () => { want = p.x * (count - 1); L.wake(); });
    const L = loop(hero, (dt) => { cur += (want - cur) * Math.min(1, dt * 8); const i = Math.round(cur); if (i !== shown) paint(i); return Math.abs(want - cur) > 0.05; });
  }

  window.BMX = { watcher, field, magnetic, spotlight, ink, hoverScrub, reduce, touch };
})();
