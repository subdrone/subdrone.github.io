'use strict';
/* =========================================================================
   交互增强：UI 语言 / 社交媒体展开 / QQ 加好友 / 卡片倾斜
   ========================================================================= */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noHover = window.matchMedia('(hover: none), (max-width: 820px)');

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

  /* ---------- 社交媒体展开 ---------- */
  const social = {
    section: null,
    nav: null,
    open() {
      if (!this.section) return;
      const home = document.querySelector('[data-view="home"]');
      if (home && !home.classList.contains('is-active')) {
        const homeLink = document.querySelector('.sidebar [data-nav="home"]');
        if (homeLink) homeLink.click();
      }
      this.section.hidden = false;
      if (this.nav) {
        this.nav.classList.add('is-social-open');
        this.nav.setAttribute('aria-expanded', 'true');
      }
      requestAnimationFrame(() => {
        this.section.classList.add('is-open');
        setTimeout(() => {
          this.section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }, 120);
      });
    },
    close() {
      if (!this.section) return;
      this.section.classList.remove('is-open');
      this.section.hidden = true;
      if (this.nav) {
        this.nav.classList.remove('is-social-open');
        this.nav.setAttribute('aria-expanded', 'false');
      }
      if (location.hash === '#social') {
        try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
      }
    },
    toggle() {
      if (!this.section) return;
      if (this.section.hidden || !this.section.classList.contains('is-open')) this.open();
      else this.close();
    },
    init() {
      this.section = document.getElementById('social');
      this.nav = document.getElementById('navSocial');
      if (!this.section || !this.nav) return;
      this.nav.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle();
      });
      const collapse = document.getElementById('socialCollapse');
      if (collapse) collapse.addEventListener('click', () => this.close());
      document.querySelectorAll('.sidebar [data-nav]').forEach((link) => {
        link.addEventListener('click', () => this.close());
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.section.hidden) this.close();
      });
      if (location.hash === '#social') this.open();
    },
  };

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

  /* ---------- 社交卡片鼠标倾斜 ---------- */
  function initTilt() {
    if (noHover.matches || reduceMotion) return;
    document.querySelectorAll('.social-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  function init() {
    initLanguage();
    social.init();
    initQQ();
    initTilt();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  } else {
    setTimeout(init, 0);
  }
})();
