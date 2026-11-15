/* TORRQE — motion everywhere, nothing static. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  // progress of a tall section through the viewport: 0 at its top, 1 at its bottom
  const progress = (el) => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };
  // progress of an element passing through the viewport: 0 entering bottom, 1 leaving top
  const pass = (el) => { const r = el.getBoundingClientRect(); return clamp((innerHeight - r.top) / (innerHeight + r.height)); };

  /* ---------- page in / page out ---------- */
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('loaded')));
  addEventListener('pageshow', (e) => { if (e.persisted) document.documentElement.classList.remove('leaving'); });
  $$('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || a.target === '_blank' || /^(mailto|tel|https?):/.test(href)) return;
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || reduced) return;
      const [path, hash] = href.split('#');
      if (path === '' || location.pathname.endsWith(path)) return;
      e.preventDefault(); document.documentElement.classList.add('leaving');
      setTimeout(() => { location.href = href; }, 520);
      void hash;
    });
  });

  /* ---------- header ---------- */
  const hdr = $('.hdr'); let lastY = scrollY;
  const onHdr = () => {
    const y = scrollY; hdr.classList.toggle('solid', y > 40);
    hdr.classList.toggle('hide', y > lastY && y > 400 && !document.body.classList.contains('open')); lastY = y;
  };
  addEventListener('scroll', onHdr, { passive: true }); onHdr();
  const mb = $('.menu-btn');
  if (mb) mb.addEventListener('click', () => { const o = document.body.classList.toggle('open'); mb.setAttribute('aria-expanded', String(o)); });
  $$('.nav a').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('open')));

  /* ---------- split headings into words ---------- */
  $$('.split').forEach((el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/); const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const s = document.createElement('span'); s.textContent = p; s.style.setProperty('--i', i++); w.appendChild(s); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
  });

  /* ---------- reveal on view ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('[data-r], .split, .rule, .compare, .steps').forEach((el) => io.observe(el));

  /* ---------- videos: play only while on screen ---------- */
  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.src && v.dataset.src) { v.src = v.dataset.src; }
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    } else v.pause();
  }), { threshold: 0.05, rootMargin: '200px 0px' });
  $$('video.loop').forEach((v) => { if (reduced) { v.removeAttribute('autoplay'); return; } vio.observe(v); });

  /* ---------- statement: words light up as you read ---------- */
  const stmts = $$('.statement');
  stmts.forEach((s) => {
    const words = s.textContent.trim().split(/\s+/); s.textContent = '';
    words.forEach((w, i) => { const sp = document.createElement('span'); sp.className = 'dimw'; sp.textContent = w; s.appendChild(sp); if (i < words.length - 1) s.appendChild(document.createTextNode(' ')); });
  });
  const onStmt = () => stmts.forEach((s) => {
    const r = s.getBoundingClientRect(); const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35));
    const ws = s.children; const n = Math.round(p * ws.length);
    for (let i = 0; i < ws.length; i++) ws[i].classList.toggle('lit', i < n);
  });

  /* ---------- scroll films ---------- */
  const scrubs = $$('.scrub').map((sec) => {
    const v = $('.scrub-film', sec); const notes = $$('[data-at]', sec).map((n) => { const [a, b] = n.dataset.at.split('-').map(Number); return { n, a, b }; });
    const steps = $$('.scrub-steps span', sec); const bar = $('.scrub-bar', sec);
    let want = 0, raf = 0, ready = false;
    const seek = () => { raf = 0; if (ready && v.duration) { const t = want * (v.duration - 0.05); if (Math.abs(v.currentTime - t) > 0.02) v.currentTime = t; } };
    const show = () => { if (v.readyState >= 2) sec.classList.add('film-live'); };
    v.addEventListener('seeked', show); v.addEventListener('loadeddata', show);
    const src = (matchMedia('(max-width: 760px)').matches && v.dataset.srcM) || v.dataset.src;
    const load = () => {
      if (v.dataset.loading) return; v.dataset.loading = '1';
      const go = (url) => {
        v.src = url; v.load();
        v.addEventListener('loadedmetadata', () => { ready = true; const p = v.play(); if (p && p.then) p.then(() => { v.pause(); upd(); }).catch(() => upd()); else upd(); }, { once: true });
      };
      fetch(src).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then((b) => go(URL.createObjectURL(b))).catch(() => go(src));
    };
    new IntersectionObserver((es, o) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); load(); } }, { rootMargin: '150% 0px' }).observe(sec);
    /* labels that follow the parts: positions per frame come from Blender (track JSON) */
    const tagsEl = $('.tags', sec); let track = null, tagSpecs = [], svg = null, marks = []; const legend = $('.legend', sec);
    const drawTags = () => {
      if (!track || !tagsEl) return;
      const N = track.frames.length;
      let f = (ready && v.duration && v.currentTime > 0.01) ? Math.round(v.currentTime * (track.fps || 24)) : Math.round(want * (N - 1));
      f = Math.max(0, Math.min(N - 1, f)); const fr = track.frames[f];
      const W = tagsEl.clientWidth, H = tagsEl.clientHeight, vw = track.w || 1280, vh = track.h || 720;
      const k = Math.max(W / vw, H / vh), dw = vw * k, dh = vh * k, ox = (W - dw) / 2, oy = (H - dh) / 2;
      const map = (p) => [ox + p[0] * dw, oy + p[1] * dh];
      const ok = (x, y) => x > 12 && x < W - 12 && y > 60 && y < H - 40;
      let paths = '';
      let nb = null; const on = $('.scrub-notes > div.on', sec); if (on) { const r0 = tagsEl.getBoundingClientRect(), r1 = on.getBoundingClientRect(); nb = { left: r1.left - r0.left, right: r1.right - r0.left, top: r1.top - r0.top, bottom: r1.bottom - r0.top }; }
      if (tagsEl.hasAttribute('data-all')) {
        const pts = fr.all || fr;
        const vis = want >= +(tagsEl.dataset.from || 0) && want <= +(tagsEl.dataset.to || 1);
        const ds = pts.map((p) => p[2] || 0); const dmin = Math.min(...ds), dmax = Math.max(...ds);
        pts.forEach((p, i) => {
          const m = marks[i]; if (!m) return; const [x, y] = map(p);
          const near = dmax > dmin ? 1 - (p[2] - dmin) / (dmax - dmin) : 1;
          m.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
          m.style.opacity = vis && ok(x, y) && !(nb && x > nb.left - 8 && x < nb.right + 8 && y > nb.top - 14 && y < nb.bottom + 14) ? (0.45 + 0.55 * near).toFixed(2) : 0; m.style.zIndex = Math.round(near * 100);
        });
      }
      const fan = [], placed = [];
      tagSpecs.forEach((t) => {
        const p = fr[t.k]; const inR = f >= t.a && f <= t.b && p && (p.length < 3 || p[2] === 1);
        if (!inR) { t.el.style.opacity = 0; return; }
        const [x, y] = map(p); if (!ok(x, y)) { t.el.style.opacity = 0; return; }
        if (nb && x > nb.left - 6 && x < nb.right + 6 && y > nb.top - 10 && y < nb.bottom + 10) { t.el.style.opacity = 0; return; }
        if (t.fan) { fan.push({ t, x, y }); return; }
        const lw = t.el.offsetWidth || 120, lh = t.el.offsetHeight || 24, gap = Math.min(110, W * 0.09);
        const box = (sd, yy) => { let l = sd > 0 ? x + gap : x - gap - lw; l = Math.max(6, Math.min(W - lw - 6, l)); return { l, r: l + lw, t: yy - lh / 2, b: yy + lh / 2 }; };
        const clash = (bx) => (nb && bx.l < nb.right + 8 && bx.r > nb.left - 8 && bx.t < nb.bottom + 10 && bx.b > nb.top - 10) || placed.some((q) => bx.l < q.r + 4 && bx.r > q.l - 4 && bx.t < q.b + 3 && bx.b > q.t - 3);
        let side = x > W / 2 ? 1 : -1, ly = y - 28, bx = box(side, ly);
        if (clash(bx)) { const tries = [[-side, ly], [side, y + 28], [-side, y + 28]]; let okk = false;
          for (const [sd, yy] of tries) { const b2 = box(sd, yy); if (!clash(b2)) { side = sd; ly = yy; bx = b2; okk = true; break; } }
          if (!okk) { t.el.style.opacity = 0; return; } }
        placed.push(bx); const ex = side > 0 ? bx.l : bx.r; const kx = x + (ex > x ? 1 : -1) * Math.min(22, Math.abs(ex - x) / 2);
        t.el.style.opacity = 1; t.el.style.transform = `translate(${bx.l.toFixed(1)}px,${ly.toFixed(1)}px) translate(0,-50%)`;
        paths += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}L${kx.toFixed(1)} ${ly.toFixed(1)}L${ex.toFixed(1)} ${ly.toFixed(1)}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"/>`;
      });
      if (fan.length) {
        fan.sort((p, q) => p.y - q.y); const narrow = W < 760; const lx = narrow ? W - 16 : W * 0.72;
        const y0 = H * (narrow ? 0.42 : 0.2), y1 = H * (narrow ? 0.76 : 0.8);
        fan.forEach((o, i) => {
          const ly = y0 + (y1 - y0) * (fan.length > 1 ? i / (fan.length - 1) : 0.5);
          o.t.el.style.opacity = 1; o.t.el.style.transform = `translate(${lx.toFixed(1)}px,${ly.toFixed(1)}px) translate(${narrow ? '-100%' : '0'},-50%)`;
          const ex = narrow ? lx - o.t.el.offsetWidth - 6 : lx - 6;
          paths += `<path d="M${o.x.toFixed(1)} ${o.y.toFixed(1)}L${(ex - 30).toFixed(1)} ${ly.toFixed(1)}L${ex.toFixed(1)} ${ly.toFixed(1)}"/><circle cx="${o.x.toFixed(1)}" cy="${o.y.toFixed(1)}" r="3.5"/>`;
        });
      }
      svg.innerHTML = paths;
    };
    if (tagsEl) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); tagsEl.prepend(svg);
      tagSpecs = $$('.tag', tagsEl).map((el) => { const [a, b] = (el.dataset.f || '0-99999').split('-').map(Number); return { el, k: el.dataset.k, a, b, fan: el.hasAttribute('data-fan') }; });
      fetch(tagsEl.dataset.track).then((r) => r.json()).then((j) => {
        track = j;
        if (tagsEl.hasAttribute('data-all') && j.names) {
          marks = j.names.map((n, i) => { const m = document.createElement('span'); m.className = 'mk'; m.textContent = i + 1; tagsEl.appendChild(m); return m; });
          if (legend) {
            legend.innerHTML = j.names.map((n, i) => `<li data-i="${i}"><span class="mk-n">${i + 1}</span>${n}<em>${(j.sizes || [])[i] || ''}</em></li>`).join('');
            $$('li', legend).forEach((li) => { li.addEventListener('mouseenter', () => marks[+li.dataset.i].classList.add('hot')); li.addEventListener('mouseleave', () => marks[+li.dataset.i].classList.remove('hot')); });
          }
        }
        drawTags();
      }).catch(() => {});
      v.addEventListener('seeked', drawTags); addEventListener('resize', drawTags);
    }
    const upd = () => {
      want = progress(sec); drawTags();
      notes.forEach(({ n, a, b }) => n.classList.toggle('on', want >= a && want < b));
      steps.forEach((s, i) => { const nn = notes[i]; s.classList.toggle('on', !!nn && want >= nn.a && want < nn.b); });
      if (bar) bar.style.setProperty('--p', want.toFixed(4));
      if (!raf) raf = requestAnimationFrame(seek);
    };
    return upd;
  });

  /* ---------- product rail: vertical scroll drives the cards sideways ---------- */
  const rails = $$('.rail').map((sec) => {
    const track = $('.rail-track', sec); const bar = $('.rail-progress', sec);
    return () => {
      const p = progress(sec); const max = Math.max(0, track.scrollWidth - innerWidth);
      track.style.transform = `translate3d(${(-p * max).toFixed(1)}px,0,0)`; if (bar) bar.style.setProperty('--p', p.toFixed(4));
    };
  });

  /* ---------- outside -> inside reveal ---------- */
  const reveals = $$('.reveal');
  const onReveal = () => reveals.forEach((r) => { const p = clamp((pass(r) - 0.22) / 0.42); r.style.setProperty('--p', p.toFixed(4)); });

  /* ---------- parallax ---------- */
  const px = $$('[data-px]');
  const onPx = () => px.forEach((el) => { const k = parseFloat(el.dataset.px) || 0.1; const r = el.getBoundingClientRect(); const c = r.top + r.height / 2 - innerHeight / 2; el.style.transform = `translate3d(0,${(-c * k).toFixed(1)}px,0)`; });

  /* ---------- giant footer word fills with orange ---------- */
  const giant = $('.giant');
  const onGiant = () => { if (!giant) return; const r = giant.getBoundingClientRect(); const end = document.documentElement.scrollHeight - innerHeight - scrollY; const p = end < 4 ? 1 : clamp((innerHeight - r.top) / (r.height * 1.6)); giant.style.setProperty('--fill', `${(p * 100).toFixed(1)}%`); };

  /* ---------- counters ---------- */
  const cio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target; const to = parseFloat(el.dataset.count); const dec = (el.dataset.count.split('.')[1] || '').length; const t0 = performance.now(); const dur = 1800;
    const step = (t) => { const k = clamp((t - t0) / dur); const v = to * (1 - Math.pow(1 - k, 4)); el.textContent = v.toFixed(dec); if (k < 1) requestAnimationFrame(step); };
    if (reduced) el.textContent = to.toFixed(dec); else requestAnimationFrame(step);
  }), { threshold: 0.4 });
  $$('[data-count]').forEach((el) => cio.observe(el));

  /* ---------- product index highlight ---------- */
  const idx = $$('.p-index a'); const prods = idx.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const onIdx = () => { let cur = 0; prods.forEach((p, i) => { if (p.getBoundingClientRect().top < innerHeight * 0.4) cur = i; }); idx.forEach((a, i) => a.classList.toggle('on', i === cur)); };

  let ticking = false;
  const frame = () => { ticking = false; onStmt(); scrubs.forEach((f) => f()); rails.forEach((f) => f()); onReveal(); if (!reduced) onPx(); onGiant(); if (idx.length) onIdx(); };
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req); frame();

  /* ---------- contact panel (Formspree) ---------- */
  const modal = $('#contact-modal');
  if (modal) {
    const panel = $('.contact-modal', modal); const close = $('.modal-close', modal); const form = $('#contact-form'); const state = $('[data-form-state]', modal); const err = $('#form-error');
    let last = null;
    const open = (e) => { e.preventDefault(); last = e.currentTarget; modal.hidden = false; document.body.classList.add('modal-open'); close.focus(); };
    const shut = () => { modal.hidden = true; document.body.classList.remove('modal-open'); if (last) last.focus(); };
    $$('.contact-trigger').forEach((t) => t.addEventListener('click', open));
    close.addEventListener('click', shut);
    modal.addEventListener('click', (e) => { if (e.target === modal) shut(); });
    document.addEventListener('keydown', (e) => {
      if (modal.hidden) return; if (e.key === 'Escape') shut(); if (e.key !== 'Tab') return;
      const f = $$('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])', modal); const a = f[0], b = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); } else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = ''; if (!form.reportValidity()) return;
      const btn = $('button[type="submit"]', form); btn.disabled = true; btn.textContent = 'Sending...';
      try {
        const r = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error('fail');
        state.innerHTML = '<p class="eyebrow">Get in touch</p><h2 id="modal-title">Message received</h2><p id="modal-desc">Thanks. Someone from our team will be in touch shortly.</p><button class="btn solid modal-submit" type="button" data-close-success>Close</button>';
        panel.setAttribute('aria-labelledby', 'modal-title'); $('[data-close-success]', state).addEventListener('click', shut); $('[data-close-success]', state).focus();
      } catch (_) { err.textContent = 'Something went wrong. Please try again.'; btn.disabled = false; btn.textContent = 'Send message'; }
    });
  }
})();
