// 发布 GitHub 仓库后，将下面地址替换为真实的 Issue 创建页。
const GITHUB_ISSUES_URL = "https://github.com/TaTaloye/Enhanced-index/issues";

const issueButton = document.getElementById("issueButton");
const issueHint = document.getElementById("issueHint");

if (GITHUB_ISSUES_URL) {
  issueButton.href = GITHUB_ISSUES_URL;
  issueHint.textContent = "";
} else {
  issueButton?.addEventListener("click", (event) => {
    event.preventDefault();
    issueHint.textContent =
      "";
  });
}
