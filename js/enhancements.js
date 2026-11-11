'use strict';
/* =========================================================================
   QQ：点击唤起加好友
   ========================================================================= */
(function () {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initQQ, 0));
  } else {
    setTimeout(initQQ, 0);
  }
})();
