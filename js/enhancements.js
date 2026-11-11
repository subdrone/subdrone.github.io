'use strict';
/* =========================================================================
   交互增强：UI 语言 / 社交媒体手牌展开 / QQ 加好友
   ========================================================================= */
(function () {
  const EXTRA_TEXT = {
    'zh-CN': { themeDark: '夜间', themeLight: '白天', readerViewsLabel: '次阅读' },
    'zh-TW': { themeDark: '夜晚', themeLight: '白天', readerViewsLabel: '次閱讀' },
    en: { themeDark: 'Dark', themeLight: 'Light', readerViewsLabel: 'views' },
    ja: { themeDark: 'ダーク', themeLight: 'ライト', readerViewsLabel: '回閲覧' },
    ko: { themeDark: '다크', themeLight: '라이트', readerViewsLabel: '회 읽음' },
    de: { themeDark: 'Dunkel', themeLight: 'Hell', readerViewsLabel: 'Aufrufe' },
  };

  /* ---------- 补齐 HTML 里硬编码的少量 UI 文案 ---------- */
  function localizeExtras() {
    const lang = document.documentElement.lang || 'zh-CN';
    const extra = EXTRA_TEXT[lang] || EXTRA_TEXT['zh-CN'];
    Object.assign(window.BLOG_TEXT || (window.BLOG_TEXT = {}), extra);

    document.querySelectorAll('.theme-label-dark').forEach((el) => { el.textContent = extra.themeDark; });
    document.querySelectorAll('.theme-label-light').forEach((el) => { el.textContent = extra.themeLight; });

    const views = document.getElementById('readerViews');
    if (views && views.parentElement) {
      const parent = views.parentElement;
      [...parent.childNodes].forEach((node) => { if (node.nodeType === 3) node.remove(); });
      parent.appendChild(document.createTextNode(' ' + extra.readerViewsLabel));
    }
  }

  /* ---------- UI 语言 ---------- */
  function initLanguage() {
    const select = document.getElementById('langSelect');
    if (!select) return;
    select.value = document.documentElement.lang || 'zh-CN';
    select.addEventListener('change', () => {
      const lang = select.value || 'zh-CN';
      try { localStorage.setItem('blog.lang', lang); } catch { /* ignore */ }
      const url = new URL(location.href);
      url.searchParams.set('lang', lang);
      location.href = url.toString();
    });
  }

  /* ---------- 社交媒体手牌进入视口时摊开 ---------- */
  function initSocialReveal() {
    const section = document.getElementById('social');
    if (!section) return;
    if (!('IntersectionObserver' in window)) { section.classList.add('is-in'); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        section.classList.add('is-in');
        io.disconnect();
      });
    }, { threshold: 0.2 });
    io.observe(section);
  }

  /* ---------- QQ：点击唤起加好友 ---------- */
  function openQQAdd(qq) {
    const mobile = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent);
    const target = mobile
      ? `mqqapi://card/show_pslcard?src_type=internal&version=1&uin=${encodeURIComponent(qq)}&card_type=person&source=sharecard`
      : `tencent://AddContact/?fromId=45&fromSubId=1&subcmd=all&uin=${encodeURIComponent(qq)}`;
    window.location.href = target;
  }

  function initQQ() {
    document.querySelectorAll('[data-qq]').forEach((el) => {
      let qq = '';
      try { qq = atob(el.dataset.qq || '').split('').reverse().join(''); } catch { return; }
      if (!qq) return;
      const fresh = el.cloneNode(true);
      el.replaceWith(fresh);
      fresh.href = `https://wpa.qq.com/msgrd?v=3&uin=${encodeURIComponent(qq)}&site=qq&menu=yes`;
      fresh.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        openQQAdd(qq);
      });
    });
  }

  function init() {
    localizeExtras();
    initLanguage();
    initSocialReveal();
    initQQ();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  } else {
    setTimeout(init, 0);
  }
})();
