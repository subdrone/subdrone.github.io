'use strict';
/* =========================================================================
   首页右侧 X 推文 + QQ 加好友跳转
   ========================================================================= */
(function () {
  const X_PROFILE = 'subdrone0_o';

  function xTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }

  function showFallback() {
    const box = document.getElementById('xFallback');
    if (box) box.hidden = false;
  }

  function mountTimeline() {
    const holder = document.getElementById('xTimeline');
    if (!holder) return;
    const fallback = document.getElementById('xFallback');
    if (fallback) fallback.hidden = true;
    holder.innerHTML = `<a class="twitter-timeline" data-theme="${xTheme()}" data-lang="zh-cn" data-height="520" data-dnt="true" data-chrome="noheader nofooter noborders transparent" href="https://twitter.com/${X_PROFILE}?ref_src=twsrc%5Etfw">@${X_PROFILE} 的推文</a>`;
    if (window.twttr && window.twttr.widgets) {
      window.twttr.widgets.load(holder);
    }
  }

  function initTimeline() {
    const holder = document.getElementById('xTimeline');
    if (!holder) return;
    mountTimeline();
    if (window.twttr && window.twttr.widgets) {
      window.twttr.widgets.load(holder);
    } else {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      script.onload = () => mountTimeline();
      script.onerror = showFallback;
      document.head.appendChild(script);
    }
    setTimeout(() => {
      if (!holder.querySelector('iframe')) showFallback();
    }, 9000);
    const btn = document.getElementById('btnTheme');
    if (btn) btn.addEventListener('click', () => setTimeout(mountTimeline, 60));
  }

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
    initTimeline();
    initQQ();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  } else {
    setTimeout(init, 0);
  }
})();
