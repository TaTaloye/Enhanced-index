// B 站页面的“翻译员”：把卡片文字转换成可比较的数字。
// 此文件必须在 bilibili-content.js 之前加载。
(() => {
  "use strict";
  const CARD_SELECTOR = ".bili-video-card, .video-item";

  function normalizeText(value) {
    return String(value ?? "").normalize("NFKC").trim();
  }

  // 08:25 -> 505；01:02:03 -> 3723；90:00 也可以。
  function parseDuration(value) {
    const text = normalizeText(value).replace(/\s/g, "");
    if (!/^\d+:\d{1,2}(?::\d{1,2})?$/.test(text)) return null;
    const parts = text.split(":").map(Number);
    if (parts.at(-1) >= 60 || (parts.length === 3 && parts[1] >= 60)) return null;
    const seconds = parts.reduce((total, part) => total * 60 + part, 0);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }

  // 卡片的 1.2万 只能按 12000 比较，不假装知道实际精确播放量。
  function parseViews(value) {
    let text = normalizeText(value).replace(/\s/g, "")
      .replace(/^(播放量|播放|观看)/, "")
      .replace(/(次播放|次观看|播放|观看|次)$/i, "");
    if (text.includes(",")) {
      if (!/^\d{1,3}(,\d{3})+(\.\d+)?([万亿kmb])?\+?$/i.test(text)) return null;
      text = text.replace(/,/g, "");
    }
    const match = text.match(/^(\d+(?:\.\d+)?)([万亿kmb])?\+?$/i);
    if (!match) return null;
    const places = { "万": 4, "亿": 8, k: 3, m: 6, b: 9 };
    const exponent = places[(match[2] || "").toLowerCase()] || 0;
    const [whole, fraction = ""] = match[1].split(".");
    // 用十进制字符串换算，避免 1.13 * 10000 的浮点误差。
    if (/[1-9]/.test(fraction.slice(exponent))) return null;
    const count = Number(whole + fraction.padEnd(exponent, "0").slice(0, exponent));
    return Number.isSafeInteger(count) ? count : null;
  }

  function defaultSettings() {
    return { minDuration: "", maxDuration: "", minViews: "", maxViews: "", keepUnknown: true };
  }

  // 空白表示不限；错误条件不应用，避免误隐藏整页。
  function validateSettings(input) {
    const values = defaultSettings();
    const rules = {};
    for (const key of ["minDuration", "maxDuration", "minViews", "maxViews"]) {
      values[key] = normalizeText(input[key]);
      const parser = key.includes("Duration") ? parseDuration : parseViews;
      rules[key] = values[key] === "" ? null : parser(values[key]);
      if (values[key] !== "" && rules[key] === null) {
        return { error: key.includes("Duration")
          ? "时长请填写 分:秒 或 时:分:秒，例如 10:00；秒数须小于 60。"
          : "播放量请填写整数或带单位的数字，例如 10000、1.2万、2亿。", field: key };
      }
    }
    for (const [min, max, label] of [
      ["minDuration", "maxDuration", "时长"], ["minViews", "maxViews", "播放量"]
    ]) {
      if (rules[min] !== null && rules[max] !== null && rules[min] > rules[max]) {
        return { error: label + "下限不能大于上限。", field: max };
      }
    }
    values.keepUnknown = input.keepUnknown !== false;
    rules.keepUnknown = values.keepUnknown;
    return { values, rules, error: null };
  }

  function videoId(card) {
    for (const link of card.querySelectorAll('a[href*="/video/"]')) {
      try {
        const url = new URL(link.getAttribute("href"), "https://www.bilibili.com/");
        if (!["www.bilibili.com", "bilibili.com"].includes(url.hostname)) continue;
        const match = url.pathname.match(/^\/video\/(BV[0-9a-z]{10}|av\d+)(?:\/|$)/i);
        if (match) return match[1];
      } catch { /* 跳过无效链接。 */ }
    }
    return null;
  }

  function readCard(card) {
    const id = videoId(card);
    if (!id) return null; // 不把直播、广告入口、番剧或骨架屏当作普通视频。
    const duration = card.querySelector(".bili-video-card__stats__duration, .so-imgTag_rb, .duration");
    // 当前新版卡片第一个统计项是播放量，第二个是弹幕数。
    const views = card.querySelector(".bili-video-card__stats--left .bili-video-card__stats--item")
      || card.querySelector(".watch-num");
    const durationText = duration?.textContent.trim() || "";
    const viewText = views?.textContent.trim() || "";
    return {
      id, durationText, viewText,
      durationSeconds: parseDuration(durationText),
      viewCount: parseViews(viewText),
      maxResolution: null // 卡片没有可靠的最高画质；不能从标题“4K”推断。
    };
  }

  // 隐藏网格的单个格子，而不是仅隐藏格子里面的卡片，避免留下空洞。
  function cardTarget(card) {
    const parent = card.parentElement;
    if (parent && (/(^|\s)col_/.test(parent.className) || parent.matches(".video-list-item")) &&
        parent.querySelectorAll(CARD_SELECTOR).length === 1) return parent;
    return card;
  }

  function evaluateVideo(video, rules) {
    let unknown = false;
    for (const [value, min, max] of [
      [video.durationSeconds, rules.minDuration, rules.maxDuration],
      [video.viewCount, rules.minViews, rules.maxViews]
    ]) {
      if (min === null && max === null) continue;
      if (value === null) { unknown = true; continue; }
      if ((min !== null && value < min) || (max !== null && value > max)) {
        return { visible: false, unknown };
      }
    }
    return { visible: !unknown || rules.keepUnknown, unknown };
  }

  function isSearchPage(url = new URL(location.href)) {
    return url.hostname === "search.bilibili.com" && /^\/(all|video)\/?$/.test(url.pathname);
  }

  globalThis.EnhancedIndexBilibili = Object.freeze({
    CARD_SELECTOR, parseDuration, parseViews, defaultSettings,
    validateSettings, readCard, cardTarget, evaluateVideo, isSearchPage
  });
})();
