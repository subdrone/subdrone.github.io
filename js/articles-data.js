/* ============================================================
   articles-data.js — 文章数据（直接编辑本文件即可，无需构建工具）
   每篇文章是一个对象，字段：
     id       必填，URL 用，只能用字母/数字/-（例 "hello-world"）
     title    标题
     date     日期 "YYYY-MM-DD"
     time     预计阅读分钟（数字）
     words    字数（数字）
     tags     标签数组，例 ["随笔","代码"]
     cover    封面渐变色，两个十六进制色，例 ["#ff8ebd","#b0a0f0"]
     glyph    封面上的大字（一个汉字或字母）
     excerpt  摘要（卡片上显示）
     body     正文，Markdown 字符串（用反引号模板字符串，可换行）
   写好后保存 → git 提交推送，GitHub Pages 会自动更新。
   ============================================================ */
window.BLOG_ARTICLES = [
  {
    id: "first-note",
    title: "碎碎念",
    date: "2026-10-07",
    time: 1,
    words: 25,
    tags: ["碎碎念"],
    cover: ["#ff8ebd", "#b0a0f0"],
    glyph: "念",
    excerpt: "其实我也不知道在这里写什么，总之就是写点碎碎念（？",
    body: `
其实我也不知道在这里写什么，总之就是写点碎碎念（？
`
  },

  // 复制下面这段新增文章（去掉每行开头的 //）：
  // {
  //   id: "hello-world",
  //   title: "标题",
  //   date: "2026-10-08",
  //   time: 3,
  //   words: 620,
  //   tags: ["随笔"],
  //   cover: ["#ff8ebd", "#b0a0f0"],
  //   glyph: "初",
  //   excerpt: "卡片上显示的摘要",
  //   body: `
  // ## 小标题
  //
  // 正文支持 **Markdown**、列表、代码块等。
  // `
  // },
];
