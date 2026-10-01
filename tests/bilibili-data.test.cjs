const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({ URL });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../bilibili-data.js"), "utf8"), context);
const api = context.EnhancedIndexBilibili;

test("时长：分钟、小时、全角冒号和长合集", () => {
  for (const [text, expected] of [["00:00", 0], ["08:25", 505], ["01:02:03", 3723], ["90:00", 5400], ["60:10:24", 216624], ["００：１０", 10]]) {
    assert.equal(api.parseDuration(text), expected, text);
  }
});
test("非法时长不能变成 0 秒", () => {
  for (const text of ["", "直播", "10", "-01:00", "00:60", "1:60:00", "1:2:3:4", "1.5:00", "x12:30"]) {
    assert.equal(api.parseDuration(text), null, text);
  }
});
test("播放量按卡片简写值换算，避免浮点误差", () => {
  for (const [text, expected] of [["0",0], ["1.2万",12000], ["1.13万",11300], ["2亿",200000000], ["1,234",1234], ["1.5K",1500], ["2.3M",2300000], ["1.2万次播放",12000], ["１．２万",12000]]) {
    assert.equal(api.parseViews(text), expected, text);
  }
  for (const text of ["", "—", "-1", "1.2", "1,2", "1w", "12人正在观看", "9007199254740992"]) {
    assert.equal(api.parseViews(text), null, text);
  }
});
test("空白不限、区间包含边界、范围倒置报错", () => {
  const defaults = api.defaultSettings();
  const checked = api.validateSettings({...defaults, maxDuration:"10:00", minViews:"1万"});
  assert.equal(checked.error, null);
  assert.equal(api.evaluateVideo({durationSeconds:600,viewCount:10000}, checked.rules).visible, true);
  assert.equal(api.evaluateVideo({durationSeconds:601,viewCount:10000}, checked.rules).visible, false);
  assert.equal(api.evaluateVideo({durationSeconds:600,viewCount:9999}, checked.rules).visible, false);
  assert.ok(api.validateSettings({...defaults,minDuration:"10:00",maxDuration:"05:00"}).error);
  assert.ok(api.validateSettings({...defaults,minViews:"2万",maxViews:"1万"}).error);
  assert.ok(api.validateSettings({...defaults,maxDuration:"00:90"}).error);
});
test("未知信息默认保留；已知不符合条件仍然隐藏", () => {
  const rules = api.validateSettings({...api.defaultSettings(),maxDuration:"10:00",minViews:"1万"}).rules;
  assert.equal(api.evaluateVideo({durationSeconds:null,viewCount:10000},rules).visible,true);
  assert.equal(api.evaluateVideo({durationSeconds:null,viewCount:100},rules).visible,false);
  assert.equal(api.evaluateVideo({durationSeconds:20,viewCount:null},{...rules,keepUnknown:false}).visible,false);
  const none = api.validateSettings({...api.defaultSettings(),keepUnknown:false}).rules;
  assert.equal(api.evaluateVideo({durationSeconds:null,viewCount:null},none).visible,true);
});
test("只处理 B 站综合与视频搜索结果路由", () => {
  for (const url of ["https://search.bilibili.com/all?keyword=test","https://search.bilibili.com/video?keyword=test"]) assert.equal(api.isSearchPage(new URL(url)),true);
  for (const url of ["https://www.bilibili.com/","https://search.bilibili.com/live?keyword=test","https://search.bilibili.com/bangumi"]) assert.equal(api.isSearchPage(new URL(url)),false);
});
