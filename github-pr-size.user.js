// ==UserScript==
// @name         GitHub PR Size
// @namespace    https://jasik.xyz
// @version      1.1.0
// @description  Age badges on PR list + size badge on PR detail (matches team PR-Metrics thresholds). Requires Safari 15.4+ / Chrome 92+.
// @match        https://github.com/*/*/pull/*
// @match        https://github.com/*/*/pulls*
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(() => {
  // ── Age badge colors (PR list) ────────────────────────────────────────────
  // Matches the style seen in PR Pulse: pill badge next to PR title

  function getAgeStyle(days) {
    if (days <= 3) return { bg: "#dafbe1", fg: "#1a7f37", border: "#1a7f37" };
    if (days <= 7) return { bg: "#fff8c5", fg: "#9a6700", border: "#9a6700" };
    if (days <= 14) return { bg: "#fff1e5", fg: "#cf6c0f", border: "#cf6c0f" };
    if (days <= 30) return { bg: "#ffebe9", fg: "#d1242f", border: "#d1242f" };
    return { bg: "#ffebe9", fg: "#6e1c1c", border: "#6e1c1c" };
  }

  function renderAgeBadges() {
    // Each PR row on the list page
    const rows = document.querySelectorAll(
      "[id^='issue_'], .js-issue-row, [data-hovercard-type='pull_request']",
    );

    rows.forEach((row) => {
      if (row.querySelector(".gh-pr-age")) return; // already added

      // GitHub renders open date as <relative-time datetime="ISO">
      const timeEl = row.querySelector(
        "relative-time[datetime], time[datetime]",
      );
      if (!timeEl) return;

      const openedAt = new Date(timeEl.getAttribute("datetime"));
      const days = Math.floor((Date.now() - openedAt) / 86_400_000);
      const label = days >= 99 ? "99d+" : `${days}d`;
      const { bg, fg, border } = getAgeStyle(days);

      const badge = document.createElement("span");
      badge.className = "gh-pr-age";
      badge.title = `Open for ${days} day${days === 1 ? "" : "s"}`;
      badge.style.cssText = [
        "display: inline-flex",
        "align-items: center",
        "padding-inline: 6px",
        "border-radius: 8px",
        `background: ${bg}`,
        `color: ${fg}`,
        `border: 1px solid ${border}`,
        "font-size: 11px",
        "font-weight: 600",
        "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        "vertical-align: middle",
        "margin-left: 6px",
        "cursor: default",
        "line-height: 18px",
      ].join("; ");
      badge.textContent = label;

      // Insert after the PR title link
      const titleEl = row.querySelector(
        "a.markdown-title, a[data-hovercard-type='pull_request'], .js-issue-row-title a",
      );
      if (titleEl) titleEl.insertAdjacentElement("afterend", badge);
    });
  }

  // ── Size badge (PR detail page) ───────────────────────────────────────────
  // Uses GitHub API since line counts aren't in the DOM

  const SIZES = [
    { label: "XS", max: 10, bg: "#1a7f37", fg: "#fff" },
    { label: "S", max: 50, bg: "#4c9d0e", fg: "#fff" },
    { label: "M", max: 250, bg: "#9a6700", fg: "#fff" },
    { label: "L", max: 500, bg: "#cf6c0f", fg: "#fff" },
    { label: "XL", max: 1000, bg: "#d1242f", fg: "#fff" },
    { label: "XXL", max: Infinity, bg: "#6e1c1c", fg: "#fff" },
  ];

  function getSize(lines) {
    return SIZES.find((s) => lines <= s.max) ?? SIZES.at(-1);
  }

  async function getOrPromptToken() {
    let token = await GM.getValue("github_pat", "");
    if (!token) {
      token = prompt(
        "GitHub PR Size: Enter a Personal Access Token\n" +
          "• Fine-grained token: Pull requests → Read-only (personal repos only)\n" +
          "• Classic token: repo scope (required for org repos)\n\n" +
          "Stored locally, only used to read PR stats from api.github.com.",
      );
      if (token) await GM.setValue("github_pat", token.trim());
    }
    return token;
  }

  function fetchPR(owner, repo, prNumber, token) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: "GET",
        url: `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        onload(r) {
          if (r.status === 401 || r.status === 403) {
            GM.setValue("github_pat", "");
            reject(
              new Error(
                `Auth failed (${r.status}) — token cleared, refresh to re-enter`,
              ),
            );
          } else if (r.status === 404) {
            reject(new Error("PR not found or no repo access"));
          } else {
            resolve(JSON.parse(r.responseText));
          }
        },
        onerror: () => reject(new Error("Network error fetching PR stats")),
      });
    });
  }

  function renderSizeBadge({ additions, deletions, changed_files }) {
    const totalLines = additions + deletions;
    const size = getSize(totalLines);

    const badge = document.createElement("span");
    badge.title = `${totalLines.toLocaleString()} lines (${additions.toLocaleString()}+ / ${deletions.toLocaleString()}−) across ${changed_files} files`;
    badge.style.cssText = [
      "display: inline-flex",
      "align-items: center",
      "padding: 2px 8px",
      "border-radius: 12px",
      `background: ${size.bg}`,
      `color: ${size.fg}`,
      "font-size: 12px",
      "font-weight: 600",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "vertical-align: middle",
      "margin-left: 8px",
      "cursor: default",
    ].join("; ");
    badge.textContent = `size/${size.label}`;

    const titleEl = document.querySelector(
      '.js-issue-title, [data-testid="issue-title"], h1.gh-header-title',
    );
    if (titleEl) titleEl.appendChild(badge);
  }

  async function runSizeBadge(owner, repo, prNumber) {
    const token = await getOrPromptToken();
    if (!token) return;
    try {
      const pr = await fetchPR(owner, repo, prNumber, token);
      renderSizeBadge(pr);
    } catch (err) {
      console.warn("[GitHub PR Size]", err.message);
    }
  }

  // ── Route ─────────────────────────────────────────────────────────────────

  const detailMatch = location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/,
  );
  const listMatch = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pulls/);

  if (detailMatch) {
    const [, owner, repo, prNumber] = detailMatch;
    runSizeBadge(owner, repo, prNumber);
  } else if (listMatch) {
    // DOM is already rendered; run immediately then watch for filter/page changes
    renderAgeBadges();
    new MutationObserver(renderAgeBadges).observe(
      document.querySelector(".js-issue-list, #js-issues-toolbar") ??
        document.body,
      { childList: true, subtree: true },
    );
  }
})();
