const supportedLanguages = ["zh-CN", "en"];

const translations = {
  en: {
    pageTitle: "Enhanced-index · Welcome",
    skipToMain: "Skip to main content",
    headerLabel: "Page header",
    brandHomeLabel: "Enhanced-index home",
    brandName: "Enhanced-index",
    languageSwitchLabel: "Interface language",
    languageChinese: "中文",
    languageEnglish: "English",
    thanksForUsing: "Thanks for using Enhanced-index",
    heroTitle: "Don't just search titles",
    heroDescription:
      "Enhanced-index improves search on Bilibili and YouTube.",
    platformChoiceLabel: "Choose a video platform",
    bilibili: "Bilibili",
    youtube: "YouTube",
    installCheck: "✓",
    installSuccess: "Extension installed successfully",
    issueSectionNumber: "02",
    issueEyebrow: "Feedback",
    issueTitle: "Having a problem? Tell us",
    issueButton: "Issue",
    footerBrand: "Enhanced-index",
    footerCredit: "TaTaloye · 2026",
  },
  "zh-CN": {
    pageTitle: "Enhanced-index · 欢迎",
    skipToMain: "跳到主要内容",
    headerLabel: "页面标题栏",
    brandHomeLabel: "Enhanced-index 首页",
    brandName: "Enhanced-index",
    languageSwitchLabel: "界面语言",
    languageChinese: "中文",
    languageEnglish: "English",
    thanksForUsing: "感谢使用",
    heroTitle: "不只搜标题",
    heroDescription: "Enhanced-index 将增强你的bilibili和YouTube搜索的搜索引擎",
    platformChoiceLabel: "选择视频平台",
    bilibili: "哔哩哔哩",
    youtube: "YouTube",
    installCheck: "✓",
    installSuccess: "扩展已成功安装",
    issueSectionNumber: "02",
    issueEyebrow: "问题反馈",
    issueTitle: "遇到问题？告诉我们",
    issueButton: "Issue",
    footerBrand: "Enhanced-index",
    footerCredit: "TaTaloye · 2026",
  },
};
function optionsLanguage(language){
  return normallanguage.has(language) ? language : "en";
} 
const normallanguage = new Set(['en', 'zh-CN']);
function weblanguage_en(key){
  document.querySelectorAll("[data-i18n]").forEach((el) => {
  const key = el.dataset.i18n;
  el.textContent = translations[optionsLanguage("en")][key];
}); 
}
function weblanguage_zh(key){
  document.querySelectorAll("[data-i18n]").forEach((el) => {
  const key = el.dataset.i18n;
  el.textContent = translations[optionsLanguage("zh-CN")][key];
});
  
}
  
