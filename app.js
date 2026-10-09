/* Somec Mecânica — sequências de frames controladas pelo scroll */
(() => {
  const WA_NUMBER = '5511943026164';
  const WA_DEFAULT = 'Olá! Vim pelo site da Somec e quero agendar um diagnóstico. Meu carro é: ';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Links do WhatsApp com mensagem pronta
  document.querySelectorAll('[data-wa]').forEach(a => {
    const msg = a.getAttribute('data-wa') || WA_DEFAULT;
    a.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
    a.target = '_blank';
    a.rel = 'noopener';
  });

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const span = (p, a, b) => clamp((p - a) / (b - a));
  const pad = n => String(n).padStart(3, '0');

  // Sequência de imagens: carrega 1 a cada 4 primeiro, depois completa
  class Sequence {
    constructor(dir, count, onProgress) {
      this.count = count;
      this.frames = new Array(count);
      this.loaded = 0;
      const order = [];
      for (let s of [8, 4, 2, 1]) for (let i = 0; i < count; i += s) if (!order.includes(i)) order.push(i);
      order.push(count - 1);
      let active = 0, k = 0;
      const next = () => {
        while (active < 6 && k < order.length) {
          const i = order[k++];
          if (this.frames[i]) continue;
          active++;
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => { this.frames[i] = img; this.loaded++; active--; onProgress && onProgress(this); next(); };
          img.onerror = () => { active--; next(); };
          img.src = `${dir}/${pad(i + 1)}.webp`;
        }
      };
      next();
    }
    // frame carregado mais próximo do pedido
    get(i) {
      i = Math.round(clamp(i, 0, this.count - 1));
      if (this.frames[i]) return this.frames[i];
      for (let d = 1; d < this.count; d++) {
        if (this.frames[i - d]) return this.frames[i - d];
        if (this.frames[i + d]) return this.frames[i + d];
      }
      return null;
    }
  }

  // Desenha a imagem cobrindo o canvas e devolve a transformação usada
  function drawCover(canvas, ctx, img) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const ox = (w - dw) / 2, oy = (h - dh) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, ox, oy, dw, dh);
    return { ox, oy, dw, dh };
  }

  /* ---------- Hero raio-x ---------- */
  const xray = document.getElementById('xray');
  const stage = xray.querySelector('.xray-stage');
  const canvas = xray.querySelector('.xray-canvas');
  const ctx = canvas.getContext('2d');
  const intro = xray.querySelector('.xray-intro');
  const outro = xray.querySelector('.xray-outro');
  const tags = [...xray.querySelectorAll('.tag')];
  const caption = xray.querySelector('.tag-caption');
  const bar = document.querySelector('.progress');
  const loader = document.querySelector('.loader');
  const loaderPct = loader && loader.querySelector('.loader-pct');

  const isPortrait = () => innerWidth / innerHeight < 1;
  let portrait = isPortrait();
  const sets = {};
  const getSet = () => {
    const key = portrait ? 'mobile' : 'desktop';
    if (!sets[key]) {
      sets[key] = new Sequence(`frames/${key}`, portrait ? 101 : 118, seq => {
        if (loader && !loader.classList.contains('done')) {
          const pct = Math.min(100, Math.round(seq.loaded / Math.ceil(seq.count / 4) * 100));
          if (loaderPct) loaderPct.textContent = pct + '%';
          if (seq.loaded >= Math.ceil(seq.count / 4)) loader.classList.add('done');
        }
        needs = true;
      });
    }
    return sets[key];
  };
  let seq = getSet();
  setTimeout(() => loader && loader.classList.add('done'), 6000); // nunca prende a página

  let needs = true, lastTag = -1;

  // Roteiro do scroll (0 a 1):
  // 0.00-0.08 parado | 0.08-0.42 carroceria sobe | 0.42-0.66 marcadores |
  // 0.66-0.88 carroceria desce | 0.88-1.00 fechamento com CTA
  function frameFor(p) {
    if (p < .08) return 0;
    if (p < .42) return ease(span(p, .08, .42));
    if (p < .66) return 1;
    if (p < .88) return 1 - ease(span(p, .66, .88));
    return 0;
  }

  function renderHero() {
    const r = xray.getBoundingClientRect();
    const total = r.height - innerHeight;
    const p = clamp(-r.top / total);
    const img = seq.get(frameFor(p) * (seq.count - 1));
    if (!img) return;
    const t = drawCover(canvas, ctx, img);

    if (bar) bar.style.transform = `scaleX(${r.top <= 0 && r.bottom > innerHeight ? p : (r.bottom <= innerHeight ? 1 : 0)})`;
    if (bar) bar.classList.toggle('on', r.top <= 0 && r.bottom > innerHeight * 1.02);

    // Abertura some enquanto a carroceria sobe
    const io = 1 - span(p, .06, .16);
    intro.style.opacity = io;
    intro.style.transform = `translateY(${(1 - io) * -24}px)`;
    intro.style.visibility = io <= 0 ? 'hidden' : 'visible';

    // Fechamento
    // some quando o hero começa a sair da tela (não passa por baixo do topo)
    const leave = clamp((innerHeight - r.bottom) / (innerHeight * .22));
    const oo = span(p, .88, .95) * (1 - leave);
    outro.style.opacity = oo;
    outro.style.transform = `translateY(${(1 - oo) * 24}px)`;
    outro.style.visibility = oo <= 0 ? 'hidden' : 'visible';

    // Marcadores posicionados sobre as peças do último quadro
    const showTags = p >= .44 && p < .66;
    if (!portrait) {
      const labelY = t.oy + t.dh * 0.79;
      tags.forEach((tag, i) => {
        const [fx, fy] = tag.dataset.d.split(',').map(Number);
        const x = t.ox + t.dw * fx, y = t.oy + t.dh * fy;
        tag.style.transform = `translate(${x}px, ${y}px)`;
        tag.style.setProperty('--stem', Math.max(40, labelY - y) + 'px');
        const on = showTags && p >= .44 + i * .025;
        tag.classList.toggle('on', on);
      });
    } else {
      const k = showTags ? Math.min(tags.length - 1, Math.floor(span(p, .44, .64) * tags.length)) : -1;
      tags.forEach((tag, i) => {
        const [fx, fy] = tag.dataset.m.split(',').map(Number);
        tag.style.transform = `translate(${t.ox + t.dw * fx}px, ${t.oy + t.dh * fy}px)`;
        tag.classList.toggle('on', i === k);
      });
      if (k !== lastTag) {
        lastTag = k;
        caption.classList.toggle('on', k >= 0);
        if (k >= 0) caption.textContent = tags[k].querySelector('.label').textContent;
      }
    }
  }

  /* ---------- Câmbio ---------- */
  const gear = document.getElementById('cambio');
  const gCanvas = gear.querySelector('.gearbox-canvas');
  const gCtx = gCanvas.getContext('2d');
  let gSeq = null;
  new IntersectionObserver((es, ob) => {
    if (es.some(e => e.isIntersecting)) { gSeq = new Sequence('frames/cambio', 55, () => { needs = true; }); ob.disconnect(); }
  }, { rootMargin: '150% 0px' }).observe(gear);

  function renderGear() {
    if (!gSeq) return;
    const r = gear.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    let p;
    if (getComputedStyle(gear.querySelector(".gearbox-stage")).position === "sticky") {
      p = span(clamp(-r.top / (r.height - innerHeight)), .08, .78);
    } else {
      const c = gCanvas.getBoundingClientRect();
      p = span((innerHeight - c.bottom) / (innerHeight * .55), 0, 1);
    }
    const img = gSeq.get(ease(p) * (gSeq.count - 1));
    if (img) drawCover(gCanvas, gCtx, img);
  }

  /* ---------- Barra superior e WhatsApp flutuante ---------- */
  const topbar = document.querySelector('.topbar');
  const waFloat = document.querySelector('.wa-float');
  const visit = document.getElementById('contato');
  function renderChrome() {
    const r = xray.getBoundingClientRect();
    const past = r.bottom < innerHeight * .6;
    topbar.classList.toggle('solid', past);
    waFloat.classList.toggle('show', past);
    const v = visit.getBoundingClientRect();
    waFloat.classList.toggle('hide', v.top < innerHeight * .75 && v.bottom > 0);
  }

  /* ---------- Loop ---------- */
  addEventListener('scroll', () => { needs = true; }, { passive: true });
  addEventListener('resize', () => {
    const now = isPortrait();
    if (now !== portrait) { portrait = now; seq = getSet(); lastTag = -1; }
    needs = true;
  });
  (function loop() {
    if (needs) { needs = false; renderHero(); renderGear(); renderChrome(); }
    requestAnimationFrame(loop);
  })();

  /* ---------- Capturas de teste: ?p=0.5 (progresso do hero) ou ?el=#cambio&gp=0.6 ---------- */
  const qs = new URLSearchParams(location.search);
  if (qs.has('p') || qs.has('el')) {
    loader && loader.classList.add('done');
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('in'));
    const go = () => {
      if (qs.has('p')) scrollTo(0, (xray.offsetHeight - innerHeight) * +qs.get('p'));
      else {
        const el = document.querySelector(qs.get('el'));
        const gp = +(qs.get('gp') || 0);
        scrollTo(0, el.offsetTop + Math.max(0, el.offsetHeight - innerHeight) * gp);
      }
      needs = true;
    };
    addEventListener('load', go); setTimeout(go, 400);
  }

  /* ---------- Revelações ao entrar na tela ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('in'));
  } else {
    const ob = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); ob.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
    revealEls.forEach(el => ob.observe(el));
  }
})();

/* Carrossel de avaliações no celular: contador e pontos */
(() => {
  const track = document.querySelector('.review-track');
  const dots = document.querySelector('.review-dots');
  const count = document.querySelector('.review-count');
  if (!track || !dots) return;
  const cards = [...track.children];
  cards.forEach(() => dots.appendChild(document.createElement('i')));
  const update = () => {
    const x = track.scrollLeft;
    let k = 0, best = Infinity;
    cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft - track.offsetLeft - x - parseFloat(getComputedStyle(track).paddingLeft || 0)); if (d < best) { best = d; k = i; } });
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) k = cards.length - 1;
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === k));
    count.textContent = `${k + 1} / ${cards.length}`;
  };
  track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  update();
})();
