# Enhanced-index

Filter videos directly on Bilibili and YouTube search pages.

**English** · [简体中文](README.zh.md)

## Introduction

Enhanced-index is a Chrome / Edge extension. It adds a small button beside the search bar so you can filter videos by duration, quality, and view count.
You don't need a build step, API key, AI model, or advance configuration.

## Getting started

1. Download and extract the source ZIP from this repository, or clone the repository.
2. In Chrome, open `chrome://extensions`. In Edge, open `edge://extensions`.
3. Enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`.

The welcome page opens on first installation.

After editing the code or downloading an update, reload the extension in the extension manager, then refresh the video site's tab.

The duration fields expand whole numbers from **1 to 59** into minutes when you leave the field or apply the form. This doesn't happen after each keystroke. Full-width digits such as `１０` also work. Bare `0`, `60`, negative numbers, and decimals are not valid shortcuts; use a full duration such as `00:00` or `60:00` instead.

### Tips

- View counts use the approximation shown on the card: `1.2万` counts as 12,000. The extension cannot recover the exact count that the card doesn't show.
- Select both **HD** and **SD** for no quality restriction. Keep at least one selected.
- Explicit YouTube badges such as HD, 4K, and 8K count as HD; an explicit SD badge counts as SD. A title containing "4K" doesn't establish the video's quality.
- **保留筛选信息不全的视频** (Keep videos with missing filter data) is on by default. If a field needed for filtering is unknown, the extension keeps the card. A known value outside your range still causes it to hide the card.
- **恢复全部** (Reset) clears all conditions and restores the cards. Press Esc or click outside the panel to close it.

## Known limitations

- The extension filters only loaded search cards it can recognize. It doesn't search the entire platform, fetch additional pages, or change the result order.
- Shorts, playlists, live streams, non-video entries, and unrecognized content fall outside the supported scope. They may remain visible.
- YouTube may load a card's duration later. The extension treats unreadable values as unknown and reapplies filters once they become available. It doesn't guess at number formats it cannot parse.
- Bilibili cards don't provide a reliable maximum-quality field to the current reader. Selecting only HD or SD and turning off "keep unknown" may hide all recognized Bilibili videos.
- Complete quality lookup needs an additional metadata source that has been checked for reliability. This version doesn't call video or player APIs.
- Site layout changes can break the selectors for cards and search bars. Include a reproducible example when reporting a problem.

## Privacy and permissions

The extension requests `storage` to save filter preferences and runs content scripts on `www.bilibili.com`, `search.bilibili.com`, and `www.youtube.com`.

Preferences stay in the browser's local extension storage. The code doesn't read cookies, upload browsing history, collect usage statistics, or send video metadata to a server. Filtering reads the current page and changes card visibility. The welcome page and its external links are separate from the filtering logic.

## License

[MIT](LICENSE). The license file retains its original copyright notices.
