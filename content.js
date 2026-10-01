// 页面交互层：两平台共用按钮、面板和筛选流程。
(() => {
  "use strict";
  const data = globalThis.EnhancedIndex;
  const ROOT_ID = "ei-video-root";
  // 保留 B 站旧版存储键，YouTube 的条件单独保存。
  const STORAGE_KEY = "ei." + data?.PLATFORM + ".filters.v1";
  if (!data || document.getElementById(ROOT_ID)) return;

  let settings = data.defaultSettings();
  let rules = data.validateSettings(settings).rules;
  let edited = false;
  let scanTimer = null;
  let positionFrame = null;
  let lastUrl = location.href;
  let touchedTargets = new Set();
  let storageWarning = "";

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.lang = "zh-CN";
  
  root.innerHTML = `
    <button type="button" id="ei-video-toggle" aria-label="视频筛选" title="视频筛选"
      aria-expanded="false" aria-controls="ei-video-panel" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/>
        <circle cx="8" cy="6" r="2"/><circle cx="15" cy="12" r="2"/></svg>
      <span class="ei-active-dot" aria-hidden="true"></span>
    </button>
    <section id="ei-video-panel" role="dialog" aria-labelledby="ei-video-heading" hidden>
      <div class="ei-heading-row"><h2 id="ei-video-heading">视频筛选</h2>
        <button type="button" class="ei-close" aria-label="关闭筛选面板">×</button></div>
      <form id="ei-video-form" novalidate>
        <fieldset><legend>视频时长</legend>
          <div class="ei-range">
            <label><span>最短</span><input name="minDuration" placeholder="00:00" maxlength="20" autocomplete="off" aria-describedby="ei-duration-help"></label>
            <span class="ei-range-dash" aria-hidden="true">—</span>
            <label><span>最长</span><input name="maxDuration" placeholder="10:00" maxlength="20" autocomplete="off" aria-describedby="ei-duration-help"></label>
          </div>
          <p class="ei-help" id="ei-duration-help">输入 1–59 自动补为分钟，如 10 → 10:00；也可填 分:秒 / 时:分:秒，留空不限。</p>
        </fieldset>
        <fieldset><legend>播放量</legend>
          <div class="ei-range">
            <label><span>最低</span><input name="minViews" placeholder="例如 1万" maxlength="24" autocomplete="off" aria-describedby="ei-views-help"></label>
            <span class="ei-range-dash" aria-hidden="true">—</span>
            <label><span>最高</span><input name="maxViews" placeholder="不限" maxlength="24" autocomplete="off" aria-describedby="ei-views-help"></label>
          </div>
          <p class="ei-help" id="ei-views-help">按卡片显示值比较，例如 1.2万按 12000 计算。</p>
        </fieldset>
        <fieldset class="ei-quality" aria-describedby="ei-quality-help"><legend>视频画质</legend>
          <div class="ei-quality-choices">
            <label><input name="hd" type="checkbox" checked><span>HD</span></label>
            <label><input name="sd" type="checkbox" checked><span>SD</span></label>
          </div>
          <p class="ei-help" id="ei-quality-help"></p>
        </fieldset>
        <label class="ei-unknown"><input name="keepUnknown" type="checkbox" checked>保留筛选信息不全的视频（含未知画质）</label>
        <p id="ei-video-error" role="alert" hidden></p>
        <div class="ei-actions"><button type="button" class="ei-reset">恢复全部</button><button type="submit" class="ei-apply">应用筛选</button></div>
      </form>
      <p id="ei-video-status" role="status" aria-live="polite"></p>
      <p class="ei-scope">仅筛选搜索页已加载的普通视频，保留平台原有顺序；不处理直播、Shorts 或播放列表。</p>
    </section>`;
  document.body.append(root);

  const toggle = root.querySelector("#ei-video-toggle");
  const panel = root.querySelector("#ei-video-panel");
  const form = root.querySelector("form");
  const status = root.querySelector("#ei-video-status");
  const errorBox = root.querySelector("#ei-video-error");
  const isYouTube = data.PLATFORM === "youtube";
  root.querySelector("#ei-quality-help").textContent = isYouTube
    ? "都选中表示不限。只识别平台画质标识：HD / 4K / 8K 归为 HD，SD 归为 SD；未标注为未知，不代表 SD。"
    : "都选中表示不限。B 站卡片未提供可靠的最高画质，目前均为未知；单选画质仍按下方未知信息开关处理。";

  function fillForm() {
    for (const key of ["minDuration", "maxDuration", "minViews", "maxViews"]) {
      form.elements.namedItem(key).value = settings[key];
    }
    for (const key of ["hd", "sd", "keepUnknown"]) form.elements.namedItem(key).checked = settings[key];
  }

  function closePanel(returnFocus = false) {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (returnFocus && !toggle.hidden) toggle.focus();
  }

  function isVisible(element) {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight &&
      style.visibility !== "hidden" && style.display !== "none";
  }

  function findAnchor() {
    // 搜索页优先使用大搜索框；首页/视频页使用导航栏搜索框。
    const selectors = isYouTube ? ['input[name="search_query"]', 'ytd-searchbox input#search']
      : [".search-input-el", ".nav-search-input", "#search-keyword"];
    for (const selector of selectors) {
      for (const input of document.querySelectorAll(selector)) {
        if (!isVisible(input)) continue;
        return input.closest(isYouTube ? "yt-searchbox, ytd-searchbox, .ytSearchboxComponentHost"
          : ".search-input-wrap, #nav-searchform, .nav-search-form, .searchform")
          || input.parentElement;
      }
    }
    return null;
  }

  function positionUI() {
    positionFrame = null;
    const anchor = findAnchor();
    if (!anchor) {
      toggle.hidden = true;
      closePanel();
      return;
    }
    toggle.hidden = false;
    const box = anchor.getBoundingClientRect();
    const size = 36;
    let left = box.right + 8;
    let top = box.top + (box.height - size) / 2;
    // YouTube 搜索框右边通常紧挨语音按钮，不能把它盖住。
    const voice = isYouTube && document.querySelector("#voice-search-button");
    if (voice && isVisible(voice)) {
      const voiceBox = voice.getBoundingClientRect();
      if (left < voiceBox.right && left + size > voiceBox.left &&
          top < voiceBox.bottom && top + size > voiceBox.top) left = voiceBox.right + 8;
    }
    // 狭窄窗口里放在搜索框右下方，避免盖住搜索按钮。
    if (left + size > innerWidth - 12) {
      left = Math.max(12, Math.min(box.right - size, innerWidth - size - 12));
      top = box.bottom + 8;
    }
    toggle.style.left = Math.round(Math.max(12, left)) + "px";
    toggle.style.top = Math.round(Math.max(8, top)) + "px";
    if (!panel.hidden) {
      const width = Math.min(344, innerWidth - 24);
      panel.style.width = width + "px";
      panel.style.left = Math.round(Math.max(12, Math.min(left + size - width, innerWidth - width - 12))) + "px";
      // 默认从按钮下展开，空间不足时让面板内部滚动。
      const panelTop = Math.min(Math.max(8, top + size + 8), Math.max(8, innerHeight - 180));
      panel.style.top = Math.round(panelTop) + "px";
      panel.style.maxHeight = Math.max(120, innerHeight - panelTop - 12) + "px";
    }
  }

  function queuePosition() {
    if (positionFrame === null) positionFrame = requestAnimationFrame(positionUI);
  }

  function hasFilters() {
    return !rules.hd || !rules.sd || ["minDuration", "maxDuration", "minViews", "maxViews"].some(key => rules[key] !== null);
  }

  function setHidden(target, hidden) {
    if (hidden) {
      if (target.getAttribute("data-ei-video-hidden") !== "true") target.setAttribute("data-ei-video-hidden", "true");
    } else {
      target.removeAttribute("data-ei-video-hidden");
    }
  }

  function updateStatus(message) {
    const next = message + (storageWarning ? " " + storageWarning : "");
    if (status.textContent !== next) status.textContent = next;
  }

  function scanCards() {
    if (scanTimer !== null) clearTimeout(scanTimer);
    scanTimer = null;
    if (!root.isConnected) document.body.append(root);
    queuePosition();
    const active = hasFilters();
    root.toggleAttribute("data-active", active);
    toggle.setAttribute("aria-label", active ? "视频筛选（已启用）" : "视频筛选");

    if (!data.isSearchPage()) {
      for (const target of touchedTargets) setHidden(target, false);
      touchedTargets.clear();
      updateStatus(isYouTube ? ""
        : "");
      return;
    }

    const nextTargets = new Set();
    let total = 0, visible = 0, unknownKept = 0, unreadable = 0, qualityUnknown = 0;
    for (const card of document.querySelectorAll(data.CARD_SELECTOR)) {
      const video = data.readCard(card);
      if (!video) { unreadable++; continue; }
      const target = data.cardTarget(card);
      if (nextTargets.has(target)) continue;
      nextTargets.add(target);
      if ((!rules.hd || !rules.sd) && video.quality === null) qualityUnknown++;
      const result = data.evaluateVideo(video, rules);
      setHidden(target, !result.visible);
      total++;
      if (result.visible) visible++;
      if (result.visible && result.unknown) unknownKept++;
    }
    for (const target of touchedTargets) {
      if (!nextTargets.has(target)) setHidden(target, false);
    }
    touchedTargets = nextTargets;

    let message = total
      ? "已读取 " + total + " 张视频卡片 · 显示 " + visible + " 张 · 隐藏 " + (total - visible) + " 张。"
      : "暂未读取到普通视频卡片，等待结果加载；若页面已有视频，可能需要适配新版页面。";
    if (unknownKept) message += " 其中 " + unknownKept + " 张信息不全，已保留。";
    if (qualityUnknown) message += " 有 " + qualityUnknown + " 张画质未知，无法确认是否匹配 HD / SD。";
    if (total && !visible) message += " 没有匹配的视频，可以放宽条件或恢复全部。";
    if (unreadable) message += " 未识别的卡片不作处理。";
    updateStatus(message);
  }

  // 多次页面更新合并处理；不主动翻页，不请求视频接口。
  function scheduleScan() {
    if (scanTimer === null) scanTimer = setTimeout(scanCards, 180);
  }

  async function saveSettings() {
    try {
      if (!globalThis.chrome?.storage?.local) throw new Error("storage unavailable");
      await chrome.storage.local.set({ [STORAGE_KEY]: settings });
      storageWarning = "";
    } catch {
      storageWarning = "条件仅在本页有效，未能保存到浏览器。";
    }
    scheduleScan();
  }

  function showError(message, field) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
    for (const input of form.querySelectorAll("input")) input.removeAttribute("aria-invalid");
    if (field) {
      const input = form.elements.namedItem(field);
      input.setAttribute("aria-invalid", "true");
      input.focus();
    }
  }

  toggle.addEventListener("click", () => {
    if (!panel.hidden) { closePanel(true); return; }
    fillForm();
    showError("");
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    scanCards();
    positionUI();
    form.elements.namedItem("minDuration").focus();
  });
  root.querySelector(".ei-close").addEventListener("click", () => closePanel(true));
  root.addEventListener("click", event => event.stopPropagation());
  root.addEventListener("keydown", event => {
    event.stopPropagation(); // 不触发宿主网站的快捷键。
    if (event.key === "Escape") { event.preventDefault(); closePanel(true); }
  });
  document.addEventListener("pointerdown", event => {
    if (!root.contains(event.target)) closePanel();
  }, true);
  document.addEventListener("focusin", event => {
    if (!panel.hidden && !root.contains(event.target)) closePanel();
  });

  function normalizeDurationFields() {
    for (const key of ["minDuration", "maxDuration"]) {
      const input = form.elements.namedItem(key);
      input.value = data.normalizeDurationInput(input.value);
    }
  }

  form.addEventListener("focusout", event => {
    const input = event.target;
    if (input.name === "minDuration" || input.name === "maxDuration") {
      input.value = data.normalizeDurationInput(input.value);
    }
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    normalizeDurationFields(); // Enter 或程序提交时也补全，不依赖是否触发失焦。
    const values = Object.fromEntries(new FormData(form));
    for (const key of ["hd", "sd", "keepUnknown"]) values[key] = form.elements.namedItem(key).checked;
    const checked = data.validateSettings(values);
    if (checked.error) { showError(checked.error, checked.field); return; }
    edited = true;
    settings = checked.values;
    rules = checked.rules;
    showError("");
    scanCards();
    void saveSettings();
  });
  root.querySelector(".ei-reset").addEventListener("click", () => {
    edited = true;
    settings = data.defaultSettings();
    rules = data.validateSettings(settings).rules;
    fillForm();
    showError("");
    scanCards();
    void saveSettings();
  });

  // DOM 改动可能来自翻页、换关键词或懒加载；忽略面板自己的改动，避免循环。
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => !root.contains(mutation.target))) scheduleScan();
  });
  observer.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ["href", "class", "aria-label", "overlay-style"]
  });
  document.addEventListener("yt-navigate-finish", () => { closePanel(); scheduleScan(); });
  window.addEventListener("resize", queuePosition);
  window.addEventListener("scroll", queuePosition, { passive: true, capture: true });
  // 网站可能只更改路由，不重新载入文档。
  setInterval(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; closePanel(); scheduleScan(); }
  }, 800);

  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[STORAGE_KEY]) return;
      const checked = data.validateSettings(changes[STORAGE_KEY].newValue || data.defaultSettings());
      if (checked.error) return;
      settings = checked.values;
      rules = checked.rules;
      if (panel.hidden) fillForm();
      scheduleScan();
    });
  }

  fillForm();
  scanCards();
  (async () => {
    try {
      const stored = await globalThis.chrome?.storage?.local?.get(STORAGE_KEY);
      if (!edited && stored?.[STORAGE_KEY]) {
        const checked = data.validateSettings(stored[STORAGE_KEY]);
        if (!checked.error) {
          settings = checked.values;
          rules = checked.rules;
          if (panel.hidden) fillForm();
          scanCards();
        }
      }
    } catch { /* 没有存储权限时仍能在当前页面工作。 */ }
  })();
})();
