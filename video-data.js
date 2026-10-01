// 数据层：认识两家网站的卡片，把文字换算成数字；不发送网络请求。
(() => {
  "use strict";
  const PLATFORM = globalThis.location?.hostname === "www.youtube.com" ? "youtube" : "bilibili";
  const SELECTORS = {
    bilibili: ".bili-video-card, .video-item",
    youtube: "ytd-video-renderer, yt-lockup-view-model"
  };
  const CARD_SELECTOR = SELECTORS[PLATFORM];
  const normalizeText = value => String(value ?? "").normalize("NFKC").trim();

  function parseDuration(value) {
    const text = normalizeText(value).replace(/\s/g, "");
    if (!/^\d+:\d{1,2}(?::\d{1,2})?$/.test(text)) return null;
    const parts = text.split(":").map(Number);
    if (parts.at(-1) >= 60 || (parts.length === 3 && parts[1] >= 60)) return null;
    const seconds = parts.reduce((total, part) => total * 60 + part, 0);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }

  // 只解释中文/英文播放量，不猜测其他语言的数字分隔方式。
  function parseViews(value) {
    let text = normalizeText(value).replace(/\s/g, "");
    if (/^(noviews|暂无观看|暂无观看次数|尚無觀看次數)$/i.test(text)) return 0;
    text = text.replace(/^(播放量|播放|观看次数|觀看次數|观看)/, "")
      .replace(/(次播放|次观看|次觀看|次觀看次數|次观看次数|播放|观看|觀看|次|views?)$/i, "");
    if (text.includes(",")) {
      if (!/^\d{1,3}(,\d{3})+(\.\d+)?([万萬亿億kmb])?\+?$/i.test(text)) return null;
      text = text.replace(/,/g, "");
    }
    const match = text.match(/^(\d+(?:\.\d+)?)([万萬亿億kmb])?\+?$/i);
    if (!match) return null;
    const places = { "万": 4, "萬": 4, "亿": 8, "億": 8, k: 3, m: 6, b: 9 };
    const exponent = places[(match[2] || "").toLowerCase()] || 0;
    const [whole, fraction = ""] = match[1].split(".");
    if (/[1-9]/.test(fraction.slice(exponent))) return null;
    const count = Number(whole + fraction.padEnd(exponent, "0").slice(0, exponent));
    return Number.isSafeInteger(count) ? count : null;
  }

  function defaultSettings() {
    // HD、SD 都选中表示不限；旧版保存的条件会自动得到这个默认值。
    return { minDuration: "", maxDuration: "", minViews: "", maxViews: "", hd: true, sd: true, keepUnknown: true };
  }

  function validateSettings(input) {
    const values = defaultSettings();
    const rules = {};
    for (const key of ["minDuration", "maxDuration", "minViews", "maxViews"]) {
      values[key] = normalizeText(input[key]);
      const parser = key.includes("Duration") ? parseDuration : parseViews;
      rules[key] = values[key] === "" ? null : parser(values[key]);
      if (values[key] !== "" && rules[key] === null) return {
        error: key.includes("Duration") ? "时长请填写 分:秒 或 时:分:秒，例如 10:00；秒数须小于 60。"
          : "播放量请填写整数或带单位的数字，例如 10000、1.2万、1.5M。", field: key
      };
    }
    for (const [min, max, label] of [["minDuration", "maxDuration", "时长"], ["minViews", "maxViews", "播放量"]]) {
      if (rules[min] !== null && rules[max] !== null && rules[min] > rules[max]) {
        return { error: label + "下限不能大于上限。", field: max };
      }
    }
    for (const key of ["hd", "sd", "keepUnknown"]) rules[key] = values[key] = input[key] !== false;
    if (!values.hd && !values.sd) return { error: "HD、SD 请至少选择一项；都选中表示不限。", field: "hd" };
    return { values, rules, error: null };
  }

  function videoId(card, platform = PLATFORM) {
    const selector = platform === "youtube"
      ? 'a#video-title[href], a.ytLockupMetadataViewModelTitle[href], a#thumbnail[href]'
      : 'a[href*="/video/"]';
    for (const link of card.querySelectorAll(selector)) {
      try {
        const url = new URL(link.getAttribute("href"), platform === "youtube" ? "https://www.youtube.com/" : "https://www.bilibili.com/");
        if (platform === "youtube") {
          if (url.hostname !== "www.youtube.com" || url.pathname !== "/watch") continue;
          const id = url.searchParams.get("v");
          if (/^[\w-]{11}$/.test(id || "")) return id;
        } else {
          if (!["www.bilibili.com", "bilibili.com"].includes(url.hostname)) continue;
          const match = url.pathname.match(/^\/video\/(BV[0-9a-z]{10}|av\d+)(?:\/|$)/i);
          if (match) return match[1];
        }
      } catch { /* 跳过无效链接。 */ }
    }
    return null;
  }

  // 仅用于网站提供的画质徽章。绝不能把整个标题传进来猜画质。
  function qualityFromBadges(labels) {
    const text = labels.map(value => normalizeText(value).toUpperCase());
    if (text.some(value => /^(HD|4K|8K|720P|1080P|1440P|2160P|4320P)$/.test(value))) return "hd";
    if (text.includes("SD")) return "sd";
    return null; // 没有 HD 标志 ≠ SD。
  }

  function readCard(card, platform = PLATFORM) {
    if (platform === "youtube") return readYouTubeCard(card);
    const id = videoId(card, "bilibili");
    if (!id) return null;
    const durationText = card.querySelector(".bili-video-card__stats__duration, .so-imgTag_rb, .duration")?.textContent.trim() || "";
    const viewText = (card.querySelector(".bili-video-card__stats--left .bili-video-card__stats--item")
      || card.querySelector(".watch-num"))?.textContent.trim() || "";
    return { id, durationText, viewText, durationSeconds: parseDuration(durationText), viewCount: parseViews(viewText), quality: null };
  }

  function readYouTubeCard(card) {
    // 新版播放列表也有 watch 链接；先排除整个合集和广告，再读普通视频。
    if (card.closest("ytd-ad-slot-renderer, ytd-promoted-video-renderer, ytd-reel-shelf-renderer") ||
        card.querySelector("yt-collection-thumbnail-view-model, yt-collections-stack, ytd-playlist-thumbnail")) return null;
    const id = videoId(card, "youtube");
    if (!id) return null;
    const badges = [...card.querySelectorAll("#badges .badge, #badges badge-shape, .ytContentMetadataViewModelMetadataRow badge-shape")]
      .map(node => node.getAttribute("aria-label") || node.textContent);
    const overlays = [...card.querySelectorAll("ytd-thumbnail-overlay-time-status-renderer .ytBadgeShapeText, ytd-thumbnail-overlay-time-status-renderer #text, yt-thumbnail-overlay-badge-view-model .ytBadgeShapeText")];
    const liveTexts = [...badges, ...overlays.map(node => node.textContent)].map(normalizeText);
    if (card.querySelector('[overlay-style="LIVE"], [overlay-style="UPCOMING"]') ||
        liveTexts.some(text => /^(LIVE|LIVE NOW|UPCOMING|直播|直播中|正在直播|即将开始|即將開始|首映)$/i.test(text))) return null;
    const durationText = overlays.map(node => node.textContent.trim()).find(text => parseDuration(text) !== null) || "";
    const metadata = [...card.querySelectorAll("#metadata-line > span, .ytContentMetadataViewModelMetadataText")];
    // 搜索页中文有时只写 969万，不带“次观看”；只在统计区域读取，绝不读取标题。
    const viewText = metadata.map(node => node.textContent.trim()).find(text => parseViews(text) !== null) || "";
    return { id, durationText, viewText, durationSeconds: parseDuration(durationText), viewCount: parseViews(viewText), quality: qualityFromBadges(badges) };
  }

  function cardTarget(card, platform = PLATFORM) {
    if (platform === "youtube") return card;
    const parent = card.parentElement;
    if (parent && (/(^|\s)col_/.test(parent.className) || parent.matches(".video-list-item")) &&
        parent.querySelectorAll(SELECTORS.bilibili).length === 1) return parent;
    return card;
  }

  function evaluateVideo(video, rules) {
    let unknown = false;
    for (const [value, min, max] of [[video.durationSeconds, rules.minDuration, rules.maxDuration], [video.viewCount, rules.minViews, rules.maxViews]]) {
      if (min === null && max === null) continue;
      if (value == null) { unknown = true; continue; }
      if ((min !== null && value < min) || (max !== null && value > max)) return { visible: false, unknown };
    }
    if (rules.hd === false || rules.sd === false) {
      if (video.quality !== "hd" && video.quality !== "sd") unknown = true;
      else if (!rules[video.quality]) return { visible: false, unknown };
    }
    return { visible: !unknown || rules.keepUnknown, unknown };
  }

  function isSearchPage(url = new URL(location.href)) {
    return (url.hostname === "search.bilibili.com" && /^\/(all|video)\/?$/.test(url.pathname)) ||
      (url.hostname === "www.youtube.com" && /^\/results\/?$/.test(url.pathname));
  }

  globalThis.EnhancedIndex = Object.freeze({ PLATFORM, CARD_SELECTOR, parseDuration, parseViews, defaultSettings,
    validateSettings, readCard, cardTarget, evaluateVideo, isSearchPage, qualityFromBadges });
})();
