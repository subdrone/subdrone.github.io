/* ============================================================
   text.js — 根据语言选择加载 locales.js 中的 UI 文案
   语言优先级：?lang= > localStorage('blog.lang') > zh-CN
   ============================================================ */
(function () {
  var fallback = 'zh-CN';
  var lang = fallback;
  var all = window.BLOG_LOCALES || {};

  try {
    var fromQuery = new URLSearchParams(location.search).get('lang');
    var saved = localStorage.getItem('blog.lang');
    lang = fromQuery || saved || fallback;
  } catch (e) {
    /* localStorage / URLSearchParams 不可用时使用默认语言 */
  }

  if (!all[lang]) lang = fallback;
  document.documentElement.lang = lang;
  window.BLOG_TEXT = Object.assign({}, all[fallback] || {}, all[lang] || {});
})();
