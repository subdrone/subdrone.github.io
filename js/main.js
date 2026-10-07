'use strict';
/* =========================================================================
   blog — main.js
   ========================================================================= */

/* ---------- 工具 ---------- */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } },
};
const sess = {
  get(k, d) { try { return JSON.parse(sessionStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none), (max-width: 820px)').matches;

/* ---------- 文案（js/text.js） ---------- */
const T = () => window.BLOG_TEXT || {};
const tt = (key, vars) => {
  let s = T()[key];
  if (s == null) s = '';
  s = String(s);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
};

/* 用 BLOG_TEXT 覆盖页面里所有 data-text / data-ph / data-aria 元素 */
function applyText() {
  const t = T();
  if (t.title) document.title = t.title;
  if (t.metaDesc) document.querySelector('meta[name="description"]').setAttribute('content', t.metaDesc);
  $$('[data-text]').forEach((el) => {
    const k = el.dataset.text;
    if (t[k] == null) return;
    const v = String(t[k]);
    if (k === 'brand') {
      const parts = v.split('.');
      el.innerHTML = parts.join('<span class="brand-dot">.</span>');
      return;
    }
    el.textContent = v;
  });
  $$('[data-ph]').forEach((el) => { if (t[el.dataset.ph] != null) el.placeholder = t[el.dataset.ph]; });
  $$('[data-aria]').forEach((el) => { if (t[el.dataset.aria] != null) el.setAttribute('aria-label', t[el.dataset.aria]); });
}

/* ---------- 2D Simplex Noise ---------- */
class SimplexNoise {
  constructor(seed = 0x5eed) {
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],
      [1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
    ];
    const p = new Uint8Array(256);
    let s = (seed % 2147483647) || 0x5eed;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { this.perm[i] = p[i & 255]; this.permMod12[i] = this.perm[i] % 12; }
    this.F2 = 0.5 * (Math.sqrt(3) - 1);
    this.G2 = (3 - Math.sqrt(3)) / 6;
  }
  noise2D(xin, yin) {
    const { F2, G2, grad3, perm, permMod12 } = this;
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const [i1, j1] = x0 > y0 ? [1, 0] : [0, 1];
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { const g = grad3[permMod12[ii + perm[jj]]], tp = t0 * t0; n0 = tp * tp * (g[0] * x0 + g[1] * y0); }
    const t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { const g = grad3[permMod12[ii + i1 + perm[jj + j1]]], tp = t1 * t1; n1 = tp * tp * (g[0] * x1 + g[1] * y1); }
    const t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { const g = grad3[permMod12[ii + 1 + perm[jj + 1]]], tp = t2 * t2; n2 = tp * tp * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2);
  }
}

/* ---------- 光尘背景（鼠标旋动形成风眼） ---------- */
const field = (() => {
  const canvas = $('#field');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, particles = [];
  const noise = new SimplexNoise(0x5eed);
  const mouse = { x: -9999, y: -9999, active: false, lastMove: 0 };
  let running = true;

  const BASE = [[255, 143, 187], [186, 168, 246], [255, 203, 140], [143, 220, 201], [255, 158, 196]];
  const BASE_LIGHT = [[255, 158, 196], [186, 168, 246], [255, 203, 140], [143, 220, 201], [255, 143, 187]];
  const pal = () => (document.documentElement.dataset.theme === 'light' ? BASE_LIGHT : BASE);
  const isLight = () => document.documentElement.dataset.theme === 'light';

  // 每个颜色预渲染一张柔光贴图，绘制时用 drawImage 叠加，性能好且不糊
  const sprites = new Map();
  const spriteFor = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    let s = sprites.get(key);
    if (s) return s;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const gc = c.getContext('2d');
    const grad = gc.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    gc.fillStyle = grad;
    gc.fillRect(0, 0, 32, 32);
    sprites.set(key, c);
    return c;
  };

  const makeParticle = (P) => {
    const accent = Math.random() < 0.22;
    const c = accent ? P[1 + Math.floor(Math.random() * (P.length - 1))] : P[0];
    return {
      x: Math.random() * W, y: Math.random() * H,
      speed: accent ? 0.16 + Math.random() * 0.3 : 0.09 + Math.random() * 0.22, // 缓慢漂浮
      r: c[0], g: c[1], b: c[2],
      size: accent ? 2.2 + Math.random() * 2.4 : 1 + Math.random() * 1.4,
      alpha: accent ? 0.5 + Math.random() * 0.4 : 0.22 + Math.random() * 0.32,
      phase: Math.random() * Math.PI * 2,
      pulse: 0.5 + Math.random() * 0.9,          // 呼吸速度
    };
  };

  function initParticles() {
    const n = W * H < 600000 ? 90 : Math.min(220, Math.round((W * H) / 9500));
    const P = pal();
    particles = Array.from({ length: n }, () => makeParticle(P));
    const el = $('#particleCount');
    if (el) el.textContent = tt('particles', { n });
  }

  const fieldAngle = (x, y, t) => {
    // 极其缓慢的流场：微尘般自由漂浮
    const n = noise.noise2D(x * 0.0007, y * 0.0007 + t * 0.00005);
    return n * Math.PI * 1.2 + Math.sin(t * 0.00002) * 0.3;
  };
  const influence = (d, R) => { if (d > R) return 0; const f = 1 - d / R; return f * f; };

  function updateParticle(p, t) {
    const ang = fieldAngle(p.x, p.y, t);
    let vx = Math.cos(ang) * p.speed;
    let vy = Math.sin(ang) * p.speed;

    if (mouse.active) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d = Math.hypot(dx, dy) || 1;
      const R = Math.min(W, H) * 0.32;
      const inf = influence(d, R);
      if (inf > 0) {
        const tx = -dy / d, ty = dx / d;          // 切向：绕鼠标旋转
        const ix = dx / d, iy = dy / d;            // 径向：指向鼠标
        const core = Math.min(1, 60 / d);          // 核心掏空 → 风眼
        const pull = 0.22 - core;                  // 柔和牵引
        vx += (tx * 1.6 + ix * pull) * p.speed * inf;
        vy += (ty * 1.6 + iy * pull) * p.speed * inf;
      }
    }
    p.x += vx; p.y += vy;

    const m = 30;
    if (p.x < -m || p.x > W + m || p.y < -m || p.y > H + m) {
      const side = (Math.random() * 4) | 0;
      if (side === 0) { p.x = Math.random() * W; p.y = -m; }
      else if (side === 1) { p.x = Math.random() * W; p.y = H + m; }
      else if (side === 2) { p.x = -m; p.y = Math.random() * H; }
      else { p.x = W + m; p.y = Math.random() * H; }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 暗色下用「叠加」让光尘聚集发光；浅色下正常绘制
    ctx.globalCompositeOperation = isLight() ? 'source-over' : 'lighter';
    const now = performance.now();
    for (const p of particles) {
      const tw = 0.8 + 0.4 * Math.sin(now * 0.001 * p.pulse + p.phase); // 缓慢呼吸
      let a = p.alpha * tw;
      if (mouse.active) {
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        const R = Math.min(W, H) * 0.32;
        if (d < R) a *= 1 + (1 - d / R) * 0.5;     // 靠近鼠标的微尘更亮
      }
      ctx.globalAlpha = Math.max(0.02, a);
      const s = spriteFor(p.r, p.g, p.b);
      const sz = p.size * 4;
      ctx.drawImage(s, p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  let t = 0, last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(50, now - last); last = now; t += dt;
    for (const p of particles) updateParticle(p, t);
    draw();
    const eye = $('#eyeState');
    if (eye) eye.textContent = mouse.active ? tt('eyeLock') : tt('eyeIdle');
    requestAnimationFrame(frame);
  }

  function resize() {
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    initParticles();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    if (!mouse.active) mouse.active = true;
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.lastMove = performance.now();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });

  resize();
  requestAnimationFrame(frame);
  return { setTheme: initParticles };
})();

/* ---------- 状态 ---------- */
const state = {
  articles: (window.BLOG_ARTICLES || []).slice(),
  query: '',
  tag: '',
  sort: 'date',
  view: 'home',
  current: null,     // 当前打开的文章 id
  from: 'home',      // 打开文章前所在的视图
};

/* 文章前端 frontmatter 解析（与 tools/gen.mjs 保持一致） */
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  const meta = {};
  const raw = m ? m[1] : '';
  const body = (m ? m[2] : text).trim();
  for (const line of raw.split('\n')) {
    const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (/^\[.*\]$/.test(val)) {
      val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    } else {
      val = val.replace(/^['"]|['"]$/g, '');
    }
    meta[key] = val;
  }
  return { meta, body };
}

/* 若通过 HTTP 访问，尝试用 articles/*.md 覆盖内嵌数据（live 编辑）；
   在 file:// 协议下 fetch 会被浏览器拦截，自动退回内嵌数据。 */
async function maybeRefreshFromDisk() {
  if (typeof fetch !== 'function' || !location.protocol.startsWith('http')) return;
  const rebuilt = [];
  for (const a of state.articles) {
    try {
      const res = await fetch(`articles/${a.id}.md`);
      if (!res.ok) throw new Error(res.status);
      rebuilt.push({ ...a, ...parseFrontmatter(await res.text()) });
    } catch {
      return; // 任一失败则保持内嵌数据
    }
  }
  if (rebuilt.length !== state.articles.length) return;
  state.articles = rebuilt;
  renderTags(); renderCards(); renderTimeline(); refreshStats();
}

const viewsOf = (id) => store.get(`blog.views.${id}`, 0);

/* ---------- 主题 ---------- */
const theme = {
  init() {
    const saved = store.get('blog.theme', 'light');
    document.documentElement.dataset.theme = saved;
    $('#btnTheme').addEventListener('click', () => this.toggle());
  },
  toggle() {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    store.set('blog.theme', next);
    field.setTheme();
    if (state.current) renderGiscus(state.current); // 评论 iframe 跟随主题
  },
};

/* ---------- 时钟 / 状态栏 ---------- */
function initClock() {
  const el = $('#clock');
  const tick = () => {
    const d = new Date();
    el.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  };
  tick(); setInterval(tick, 1000);
}

/* ---------- 打字机 ---------- */
const typewriter = {
  line: null,
  words: null,
  init() {
    this.line = $('#typeStatic');
    this.words = $('#typeWords');
    if (!this.line || !this.words) return;
    this.words.textContent = tt('heroSubInit');
    const full = this.line.textContent;
    this.line.textContent = '';
    this.typeInto(this.line, full, 38);
    this.cycle(T().heroWords && T().heroWords.length ? T().heroWords : ['写点东西，也写点代码。']);
  },
  typeInto(el, text, speed) {
    let i = 0;
    const step = () => {
      if (i <= text.length) {
        el.textContent = text.slice(0, i);
        i++;
        setTimeout(step, speed);
      }
    };
    step();
  },
  cycle(list) {
    let idx = 0;
    const el = this.words;
    const type = () => {
      const word = list[idx % list.length];
      let i = 0, deleting = false;
      const step = () => {
        if (!deleting) {
          i++;
          el.textContent = word.slice(0, i);
          if (i >= word.length) { deleting = true; setTimeout(step, 7000); return; }
          setTimeout(step, 110);
        } else {
          i--;
          el.textContent = word.slice(0, i);
          if (i <= 0) { idx++; setTimeout(type, 350); return; }
          setTimeout(step, 40);
        }
      };
      step();
    };
    setTimeout(type, 3000);
  },
};

/* ---------- 渲染：卡片 ---------- */
function fmtDate(d) { return d.replace(/-/g, '.'); }

function cardHTML(a, extraClass = '') {
  const [c1, c2] = a.cover;
  return `
  <article class="card ${extraClass}" data-id="${a.id}" tabindex="0" role="button" aria-label="阅读：${a.title}">
    <div class="card-glow" aria-hidden="true"></div>
    <div class="card-cover" style="background:linear-gradient(135deg,${c1}33,${c2}22),var(--bg-2)">
      <span class="card-glyph" style="color:${c1}">${a.glyph}</span>
      <span class="cover-label">// ${a.id}</span>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span>${fmtDate(a.date)}</span><span>·</span><span>${a.time} ${tt('minUnit')}</span>
      </div>
      <h3 class="card-title">${a.title}</h3>
      <p class="card-excerpt">${a.excerpt}</p>
      <div class="card-foot">
        <div class="card-tags">${a.tags.map((t) => `<span class="mini-tag">#${t}</span>`).join('')}</div>
      </div>
    </div>
  </article>`;
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  return state.articles.filter((a) => {
    if (state.tag && !a.tags.includes(state.tag)) return false;
    if (!q) return true;
    const hay = (a.title + ' ' + a.excerpt + ' ' + a.body + ' ' + a.tags.join(' ')).toLowerCase();
    const tokens = q.split(/\s+/);
    return tokens.every((tk) => hay.includes(tk));
  });
}

function sorted(list) {
  const arr = list.slice();
  if (state.sort === 'date') arr.sort((a, b) => (a.date < b.date ? 1 : -1));
  else if (state.sort === 'views') arr.sort((a, b) => viewsOf(b.id) - viewsOf(a.id));
  else arr.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
  return arr;
}

function renderCards() {
  const list = sorted(filtered());
  const grid = $('#cardGrid');
  const empty = $('#emptyState');
  grid.innerHTML = list.map((a) => cardHTML(a)).join('');
  empty.hidden = list.length > 0;
  const msg = empty.querySelector('p');
  msg.textContent = state.articles.length === 0 ? tt('emptyNoArticle') : tt('emptyNoMatch');
  $('#resultCount').textContent = `${list.length} / ${state.articles.length}`;
  bindCards(grid);
}

function bindCards(grid) {
  grid.querySelectorAll('.card').forEach((card) => {
    const id = card.dataset.id;
    card.addEventListener('click', () => { openPost(id); });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPost(id); }
    });
  });
  bindTilt(grid);
}

/* ---------- 3D 倾斜卡片 ---------- */
function bindTilt(scope) {
  if (isTouch || reduceMotion) return;
  scope.querySelectorAll('.card').forEach((card) => {
    const glow = card.querySelector('.card-glow');
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 10}deg) translateY(-4px)`;
      if (glow) glow.style.left = e.clientX - r.left + 'px', glow.style.top = e.clientY - r.top + 'px';
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

/* ---------- 标签 / 搜索 ---------- */
function renderTags() {
  const counts = {};
  state.articles.forEach((a) => a.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
  const bar = $('#tagbar');
  bar.innerHTML = `<button class="tag-chip ${state.tag === '' ? 'is-active' : ''}" data-tag="">全部<span class="tag-n">${state.articles.length}</span></button>` +
    Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `<button class="tag-chip ${state.tag === t ? 'is-active' : ''}" data-tag="${t}">#${t}<span class="tag-n">${n}</span></button>`)
      .join('');
  bar.querySelectorAll('.tag-chip').forEach((btn) => {
    btn.addEventListener('click', () => { state.tag = btn.dataset.tag; renderTags(); renderCards(); });
  });
}

function initToolbar() {
  renderTags();
  const input = $('#topSearch');
  const clearBtn = $('#topSearchClear');
  if (!input) return;
  const apply = () => {
    state.query = input.value;
    clearBtn.hidden = !input.value;
    if (state.view !== 'home') {
      go('home', { noPush: true });
      setTimeout(() => $('#articles').scrollIntoView({ behavior: 'smooth' }), 60);
    }
    renderCards();
  };
  input.addEventListener('input', apply);
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    apply();
    input.focus();
  });
}

/* ---------- 时间线 ---------- */
function renderTimeline() {
  const tl = $('#timeline');
  const list = sorted(state.articles.filter((a) => !state.query || (a.title + a.body + a.excerpt + a.tags.join('')).toLowerCase().includes(state.query.toLowerCase())));
  if (!list.length) {
    tl.innerHTML = `<p style="color:var(--text-faint);text-align:center;padding:60px 0;font-size:14px">${tt('timelineEmpty')}</p>`;
    return;
  }
  tl.innerHTML = list.map((a) => `
    <div class="tl-item reveal">
      <span class="tl-dot"></span>
      <div class="tl-date">${a.date} // ${a.id}</div>
      <a class="tl-card" href="#" data-open="${a.id}">
        <div class="tl-title">${a.title}</div>
        <div class="tl-excerpt">${a.excerpt}</div>
        <div class="tl-meta">
          <span>${a.time} min</span><span>${a.words} 字</span>
          <span>${a.tags.map((t) => '#' + t).join(' ')}</span>
        </div>
      </a>
    </div>`).join('');
  tl.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); openPost(el.dataset.open); }));
  observeReveals(tl);
}

/* ---------- Giscus 评论（真实、免费、零后端） ---------- */
const GISCUS = {
  repo: 'picxis94-cyber/picxis94-cyber.github.io',
  repoId: 'R_kgDOT4yekg',   // 由 GraphQL 获取，已填
  category: 'Announcements',       // 讨论分类
  categoryId: 'DIC_kwDOT4yeks4DESMV',            // tools/setup-github.mjs 会自动查询填入
  lang: 'zh-CN',
};

/* ---------- GoatCounter 访问统计（免费） ---------- */
const GOATCOUNTER_SITE = 'noonecomes.goatcounter.com';

function initGoatCounter() {
  if (!GOATCOUNTER_SITE) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', `https://${GOATCOUNTER_SITE}/count`);
  document.head.appendChild(s);
}

function trackView() {
  if (window.goatcounter) {
    try { window.goatcounter.count({ path: location.hash || '/' }); } catch { /* ignore */ }
  }
}

function renderGiscus(postId) {
  const box = $('#giscus');
  if (!box) return;
  box.innerHTML = '';
  if (!GISCUS.categoryId) {
    box.innerHTML = `<p style="color:var(--text-faint);font-size:13px">${tt('giscusPending')}</p>`;
    return;
  }
  const theme = document.documentElement.dataset.theme === 'light' ? 'transparent_light' : 'transparent_dark';
  const s = document.createElement('script');
  s.src = 'https://giscus.app/client.js';
  s.async = true;
  s.crossOrigin = 'anonymous';
  const attrs = {
    'data-repo': GISCUS.repo,
    'data-repo-id': GISCUS.repoId,
    'data-category': GISCUS.category,
    'data-category-id': GISCUS.categoryId,
    'data-mapping': 'specific',
    'data-term': postId,
    'data-strict': '0',
    'data-reactions-enabled': '1',
    'data-emit-metadata': '0',
    'data-input-position': 'top',
    'data-theme': theme,
    'data-lang': GISCUS.lang,
    'data-loading': 'lazy',
  };
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  box.appendChild(s);
}

/* ---------- 阅读视图 ---------- */
marked.setOptions({ gfm: true, breaks: true });

function openPost(id) {
  const a = state.articles.find((x) => x.id === id);
  if (!a) return;
  state.current = id;
  state.from = state.view === 'reader' ? state.from : state.view;
  countView(id);

  const [c1, c2] = a.cover;
  $('#readerCover').innerHTML = `<span class="big-glyph" style="color:${c1}">${a.glyph}</span>`;
  $('#readerCover').style.background = `linear-gradient(135deg,${c1}44,${c2}22),var(--bg-2)`;
  $('#readerTags').innerHTML = a.tags.map((t) => `<span class="mini-tag">#${t}</span>`).join('');
  $('#readerTitle').textContent = a.title;
  $('#readerExcerpt').textContent = a.excerpt;
  $('#readerDate').textContent = fmtDate(a.date);
  $('#readerTime').textContent = tt('readerTime', { time: a.time, words: a.words });
  $('#readerViews').textContent = viewsOf(id);
  document.title = `${a.title} - ${tt('title')}`;

  const body = $('#readerBody');
  body.innerHTML = marked.parse(a.body);
  body.querySelectorAll('pre code').forEach((el) => { try { hljs.highlightElement(el); } catch { /* noop */ } });
  body.querySelectorAll('a').forEach((el) => { el.target = '_blank'; el.rel = 'noopener'; });

  renderReaderNav();
  renderGiscus(id);
  trackView();

  if (location.hash !== `#/post/${id}`) {
    try { history.pushState({ v: 'reader', id }, '', `#/post/${id}`); } catch { /* ignore */ }
  }
  go('reader');
  const progress = $('#progress');
  if (progress) progress.style.width = '0%';
}

function renderReaderNav() {
  const list = sorted(state.articles.slice());
  const i = list.findIndex((a) => a.id === state.current);
  const prev = list[i + 1], next = list[i - 1];
  $('#readerNav').innerHTML = `
    ${prev ? `<a class="reader-nav-link" href="#" data-open="${prev.id}">
      <span class="rn-kicker">${tt('prev')}</span><span class="rn-title">${prev.title}</span></a>` : '<span></span>'}
    ${next ? `<a class="reader-nav-link next" href="#" data-open="${next.id}">
      <span class="rn-kicker">${tt('next')}</span><span class="rn-title">${next.title}</span></a>` : '<span></span>'}`;
  $('#readerNav').querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); openPost(el.dataset.open); }));
}

function countView(id) {
  if (sess.get(`blog.viewed.${id}`, false)) return;
  sess.set(`blog.viewed.${id}`, true);
  store.set(`blog.views.${id}`, viewsOf(id) + 1);
}

/* ---------- 路由 ---------- */
function setNav(view) {
  $$('.nav-link').forEach((l) => {
    l.classList.toggle('is-active', l.dataset.nav === view);
  });
}

function go(view, opts = {}) {
  state.view = view;
  const home = $('[data-view="home"]');
  home.classList.toggle('is-active', view === 'home');
  $$('[data-view="timeline"],[data-view="reader"],[data-view="notfound"]')
    .forEach((s) => s.classList.toggle('is-active', s.dataset.view === view));
  if (view === 'reader') $('[data-view="reader"]').hidden = false;

  if (view === 'home' && opts.scrollTo) {
    window.scrollTo({ top: opts.scrollTo, behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0, behavior: opts.instant ? 'auto' : 'smooth' });
  }
  setNav(view);

  if (view === 'timeline') renderTimeline();
  if (view === 'notfound') startNF();
  if (view !== 'notfound') stopNF();
  if (view === 'home') renderCards();

  if (!opts.noPush) {
    const hash = view === 'home' ? '' : view === 'timeline' ? '#/timeline' : null;
    if (hash !== null) { try { history.pushState({ v: view }, '', hash); } catch { /* ignore */ } }
  }
  setTimeout(observeReveals, 50);
}

function navigateFromHash() {
  const h = location.hash;
  if (h.startsWith('#/post/')) { openPost(h.slice('#/post/'.length)); return; }
  if (h === '#/timeline') { go('timeline', { noPush: true }); return; }
  if (h === '#articles') { go('home', { scrollTo: $('#articles').offsetTop - 20 }); return; }
  go('home', { instant: true, noPush: true });
}

function initNav() {
  $$('[data-goto]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const t = el.dataset.goto;
      if (t === 'back') { history.back(); return; }
      if (t === 'articles') { go('home', { noPush: true }); setTimeout(() => $('#articles').scrollIntoView({ behavior: 'smooth' }), 60); return; }
      if (t === 'home') { go('home'); return; }
      if (t === 'timeline') { go(t); return; }
      go(t);
    });
  });
  $$('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const v = el.dataset.nav;
      if (v === 'articles') {
        go('home', { noPush: true });
        setTimeout(() => $('#articles').scrollIntoView({ behavior: 'smooth' }), 80);
        return;
      }
      go(v === 'home' ? 'home' : v);
    });
  });
  window.addEventListener('popstate', () => navigateFromHash());
}

/* ---------- 键盘：Esc 从阅读页返回 ---------- */
function initModals() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.view === 'reader') history.back();
  });
}

/* ---------- 快捷键功能已移除 ---------- */

/* ---------- 滚动：进度条 / 导航阴影 / 显现 ---------- */
function initScroll() {
  const nav = $('#nav');
  const progress = $('#progress');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? (window.scrollY / max) * 100 : 0;
      progress.style.width = p + '%';
      nav.classList.toggle('is-scrolled', window.scrollY > 10);
      ticking = false;
    });
  }, { passive: true });
}

function observeReveals(scope = document) {
  if (reduceMotion) { $$('.reveal', scope).forEach((el) => el.classList.add('is-in')); return; }
  const els = $$('.reveal:not(.is-in)', scope);
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}

/* ---------- 自定义光标 ---------- */
function initCursor() {
  if (isTouch || reduceMotion) return;
  const dot = $('.cursor-dot'), ring = $('.cursor-ring');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';
  }, { passive: true });
  (function loop() {
    rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    requestAnimationFrame(loop);
  })();
  const INTERACTIVE = 'a, button, .card, input, textarea, [data-goto]';
  document.addEventListener('mouseover', (e) => { ring.classList.toggle('is-hover', e.target.closest(INTERACTIVE)); });
  window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
  window.addEventListener('pointerup', () => ring.classList.remove('is-down'));
}

/* ---------- 统计 ---------- */
function refreshStats() {
  const total = state.articles.length;
  $('#statPosts').textContent = total;
  $('#statWords').textContent = state.articles.reduce((s, a) => s + a.words, 0);
  $('#statTags').textContent = [...new Set(state.articles.flatMap((a) => a.tags))].length;
}

/* ---------- RSS ---------- */
function initRss() {
  $$('#footerRss, #btnRss').forEach((el) => el.addEventListener('click', () => { window.open('rss.xml', '_blank'); }));
}

/* ---------- 404 粒子文字 ---------- */
let nfRAF = null, nfPts = [];
function startNF() {
  const cv = $('#nfCanvas');
  if (!cv || nfRAF) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d');
  octx.clearRect(0, 0, W, H);
  octx.fillStyle = '#fff';
  octx.font = `700 150px "JetBrains Mono", monospace`;
  octx.textAlign = 'center'; octx.textBaseline = 'middle';
  octx.fillText('404', W / 2, H / 2 + 6);
  const data = octx.getImageData(0, 0, W, H).data;
  const gap = 5;
  const targets = [];
  for (let y = 0; y < H; y += gap) {
    for (let x = 0; x < W; x += gap) {
      if (data[(y * W + x) * 4 + 3] > 128) targets.push({ x, y });
    }
  }
  nfPts = targets.map((t) => ({
    x: Math.random() * W, y: Math.random() * H,
    tx: t.x, ty: t.y,
    r: 2 + Math.random() * 2,
    col: Math.random() < 0.3 ? 'rgba(167,139,250,' : 'rgba(94,234,212,',
  }));
  const mouse = { x: -999, y: -999 };
  if (!cv.dataset.bound) {
    cv.dataset.bound = '1';
    cv.addEventListener('mousemove', (e) => {
      const r = cv.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (W / r.width);
      mouse.y = (e.clientY - r.top) * (H / r.height);
    });
  }
  let t = 0;
  const loop = () => {
    t += 0.02;
    ctx.clearRect(0, 0, W, H);
    for (const p of nfPts) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d = Math.hypot(dx, dy);
      const push = 60 / (d + 40);
      let px = p.x + (dx / (d || 1)) * push;
      let py = p.y + (dy / (d || 1)) * push;
      p.x += (p.tx - p.x) * 0.05 + (px - p.x) * 0.5;
      p.y += (p.ty - p.y) * 0.05 + (py - p.y) * 0.5;
      p.x += Math.sin(t + p.ty * 0.05) * 0.3;
      p.y += Math.cos(t + p.tx * 0.05) * 0.3;
      ctx.fillStyle = p.col + (0.5 + 0.5 * Math.sin(t * 2 + p.x)) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    nfRAF = requestAnimationFrame(loop);
  };
  loop();
}
function stopNF() { if (nfRAF) { cancelAnimationFrame(nfRAF); nfRAF = null; } }

/* ---------- 启动 ---------- */
function init() {
  applyText();
  theme.init();
  initClock();
  initToolbar();
  renderCards();
  renderTimeline();
  refreshStats();
  typewriter.init();
  initNav();
  initModals();
  initScroll();
  initCursor();
  initGoatCounter();
  initRss();
  navigateFromHash();
  observeReveals();
  maybeRefreshFromDisk();
  setTimeout(observeReveals, 300);
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
