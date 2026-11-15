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
    const upd = () => {
      want = progress(sec);
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
  const onGiant = () => { if (giant) giant.style.setProperty('--fill', `${(clamp((pass(giant) - 0.1) / 0.6) * 100).toFixed(1)}%`); };

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
