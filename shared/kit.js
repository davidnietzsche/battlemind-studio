// Shared renderers. Load order: content.js, kit.js, then the build renders its own markup and calls BMK.init().
// A build marks slots with data-bm="nav|logos|reviews|faq|foot" and kit fills them.
// Everything here is plain HTML, so with no JS or reduced motion the text still reads fine.
(function () {
  const B = window.BM;
  const R = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) R.classList.add("motion");

  const img = (n, m) => `../shared/img/${n}${m ? "-m" : ""}.webp`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const T = {
    nav: () => `<a class="bm-brand" href="#top">${esc(B.name)}</a>
      <nav class="links" aria-label="Sections"><a href="#services">Services</a><a href="#clients">Clients</a><a href="#reviews">Reviews</a><a href="#faq">FAQ</a></nav>
      <a class="btn" href="${B.cta.href}" target="_blank" rel="noopener">${esc(B.cta.label)}</a>`,
    logos: () => {
      const half = Math.ceil(B.logos.length / 2);
      const row = (list, rev) => `<div class="row${rev ? " rev" : ""}">${[...list, ...list]
        .map((l, i) => `<img src="../shared/logos/${l}.webp" alt="${i < list.length ? esc(l.replace(/-logo.*|-v2/g, "").replace(/-/g, " ")) : ""}" loading="lazy" width="120" height="96">`).join("")}</div>`;
      return row(B.logos.slice(0, half)) + row(B.logos.slice(half), true);
    },
    reviews: () => B.reviews.map((r) => `<figure class="bm-review" data-rv>
      <div class="bm-stars" aria-label="5 stars">★★★★★</div>
      <blockquote>“${esc(r.q)}”</blockquote>
      <figcaption class="who"><img src="${img(r.img)}" alt="" loading="lazy"><span><b>${esc(r.who)}</b><span>${esc(r.role)}</span></span></figcaption>
    </figure>`).join(""),
    faq: () => B.faq.map((f, i) => `<details${i ? "" : " open"}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join(""),
    foot: () => `<div class="wrap"><div class="grid">
      <div><a class="bm-brand" href="#top">${esc(B.name)}</a>
        <p class="addr">${esc(B.contact.address)}</p></div>
      <div><h3>Services</h3><ul>${B.services.map((s) => `<li><a href="#services">${esc(s.name)}</a></li>`).join("")}</ul></div>
      <div><h3>Talk to us</h3><ul><li><a href="tel:${B.contact.tel}">${esc(B.contact.phone)}</a></li>
        <li><a href="mailto:${B.contact.email}">${esc(B.contact.email)}</a></li>
        <li><a href="${B.cta.href}" target="_blank" rel="noopener">WhatsApp us</a></li></ul></div>
    </div>
    <div class="group" aria-label="Battle group of companies"><div class="gl">Group of<br>companies</div><div class="units">
      <div><small>MARKETING</small><img src="../shared/brand/bm-lockup.webp" alt="Battle Mind"><span>Battle Mind Creative Sdn. Bhd. (1379718-A)</span></div>
      <div><small>TECH</small><img src="../shared/brand/bx-lockup.webp" alt="Battle X"><span>BattleX Sdn. Bhd. (1666567-U)</span></div>
    </div></div>
    <p class="legal">${esc(B.legal)}</p></div>`,
  };
  function init() {
  document.querySelectorAll("[data-bm]").forEach((el) => {
    const f = T[el.dataset.bm];
    if (f) el.innerHTML = f();
  });

  // Count-up: [data-count="200"] with optional data-prefix / data-suffix. The final value is already in the HTML.
  const fmt = (el, v) => (el.textContent = (el.dataset.prefix || "") + Math.round(v) + (el.dataset.suffix || ""));
  const counters = document.querySelectorAll("[data-count]");
  counters.forEach((el) => fmt(el, +el.dataset.count));
  // Ranges like "20–25%" don't count up: a mid-animation "20–3%" reads as a wrong number.
  const animated = [...counters].filter((el) => !el.dataset.prefix);
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, t0 = performance.now(), d = 1400;
      const tick = (t) => { const k = Math.min(1, (t - t0) / d); fmt(el, to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
      fmt(el, 0); requestAnimationFrame(tick);
    }), { threshold: 0.6 });
    animated.forEach((el) => io.observe(el));
  }

  }
  window.BMK = { B, img, esc, reduce, init,
    stat: (s) => `<span data-count="${s.n}" data-prefix="${s.prefix || ""}" data-suffix="${s.suffix}">${s.prefix || ""}${s.n}${s.suffix}</span>` };
})();
