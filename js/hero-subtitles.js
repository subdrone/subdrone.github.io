/* ============================================================
   首页滚动副标题（只使用中文，不随 UI 语言切换）
   由博客编辑器发布；每行一条。
   ============================================================ */
window.BLOG_HERO_WORDS = [
  "我们的存在就是对恶意的最大反抗",
  "一份无憾答卷，一个美丽的生命，在春暖花开中毫无保留地绽放。",
  "她终于变成了一滴雨，不用躲避，也不考虑方向。"
];

(function () {
  var words = window.BLOG_HERO_WORDS;
  if (!Array.isArray(words) || !words.length) return;
  window.BLOG_TEXT = window.BLOG_TEXT || {};
  window.BLOG_TEXT.heroWords = words.slice();
  window.BLOG_TEXT.heroSubInit = words[0];
})();
