// ==UserScript==
// @name         GitHub PR Size
// @namespace    https://jasik.xyz
// @version      1.2.0
// @description  Age badges on PR list + size badge on PR detail (matches team PR-Metrics thresholds). Requires Safari 15.4+ / Chrome 92+.
// @match        https://github.com/*/*/pull/*
// @match        https://github.com/*/*/pulls*
// @match        https://github.com/pulls*
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(() => {
  function isDark() {
    const mode = document.documentElement.dataset.colorMode;
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // ── Age badge colors (PR list) ────────────────────────────────────────────
  // Matches the style seen in PR Pulse: pill badge next to PR title

  function getAgeStyle(days) {
    if (isDark()) {
      if (days <= 3)  return { bg: "#1a3a29", fg: "#56d364", border: "#238636" };
      if (days <= 7)  return { bg: "#2d2000", fg: "#e3b341", border: "#9e6a03" };
      if (days <= 14) return { bg: "#2d1200", fg: "#f0883e", border: "#bd561d" };
      if (days <= 30) return { bg: "#3d1111", fg: "#f85149", border: "#da3633" };
      return                 { bg: "#3d0a0a", fg: "#ff9492", border: "#b62324" };
    }
    if (days <= 3)  return { bg: "#dafbe1", fg: "#1a7f37", border: "#1a7f37" };
    if (days <= 7)  return { bg: "#fff8c5", fg: "#9a6700", border: "#9a6700" };
    if (days <= 14) return { bg: "#fff1e5", fg: "#cf6c0f", border: "#cf6c0f" };
    if (days <= 30) return { bg: "#ffebe9", fg: "#d1242f", border: "#d1242f" };
    return                 { bg: "#ffebe9", fg: "#6e1c1c", border: "#6e1c1c" };
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
      const ageMs = Date.now() - openedAt;
      const hours = Math.floor(ageMs / 3_600_000);
      const days = Math.floor(ageMs / 86_400_000);
      const label = days >= 99 ? "99d+" : hours < 1 ? "<1h" : hours < 24 ? `${hours}h` : `${days}d`;
      const { bg, fg, border } = getAgeStyle(days);

      const badge = document.createElement("span");
      badge.className = "gh-pr-age";
      badge.title = hours < 24
        ? `Open for ${hours} hour${hours === 1 ? "" : "s"}`
        : `Open for ${days} day${days === 1 ? "" : "s"}`;
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

  function getSizes() {
    return isDark()
      ? [
          { label: "XS",  max: 10,       bg: "#238636", fg: "#fff" },
          { label: "S",   max: 50,       bg: "#347d39", fg: "#fff" },
          { label: "M",   max: 250,      bg: "#9e6a03", fg: "#fff" },
          { label: "L",   max: 500,      bg: "#bd561d", fg: "#fff" },
          { label: "XL",  max: 1000,     bg: "#da3633", fg: "#fff" },
          { label: "XXL", max: Infinity, bg: "#b62324", fg: "#fff" },
        ]
      : [
          { label: "XS",  max: 10,       bg: "#1a7f37", fg: "#fff" },
          { label: "S",   max: 50,       bg: "#4c9d0e", fg: "#fff" },
          { label: "M",   max: 250,      bg: "#9a6700", fg: "#fff" },
          { label: "L",   max: 500,      bg: "#cf6c0f", fg: "#fff" },
          { label: "XL",  max: 1000,     bg: "#d1242f", fg: "#fff" },
          { label: "XXL", max: Infinity, bg: "#6e1c1c", fg: "#fff" },
        ];
  }

  function getSize(lines) {
    const sizes = getSizes();
    return sizes.find((s) => lines <= s.max) ?? sizes.at(-1);
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
    if (document.querySelector(".gh-pr-size")) return; // already rendered

    const totalLines = additions + deletions;
    const size = getSize(totalLines);

    const badge = document.createElement("span");
    badge.className = "gh-pr-size";
    badge.title = `${totalLines.toLocaleString()} lines (${additions.toLocaleString()}+ / ${deletions.toLocaleString()}−) across ${changed_files} files`;
    badge.style.cssText = [
      "display: inline-flex",
      "align-items: center",
      "padding: 2px 8px",
      "border-radius: 12px",
      `background: ${size.bg}`,
      `color: ${size.fg}`,
      "font-weight: 600",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "cursor: default",
    ].join("; ");
    badge.textContent = size.label;

    const titleEl = document.querySelector(
      'h1[class*="prc-PageHeader-Title"], .js-issue-title, [data-testid="issue-title"], h1.gh-header-title',
    );
    if (!titleEl) return;
    const titleFontSize = parseFloat(getComputedStyle(titleEl).fontSize);
    badge.style.fontSize = `${titleFontSize * 0.8}px`;
    titleEl.style.display = "flex";
    titleEl.style.alignItems = "center";
    titleEl.style.flexWrap = "wrap";
    titleEl.style.gap = "8px";
    titleEl.prepend(badge);

    // Re-inject if React hydration removes our badge
    const removalObserver = new MutationObserver(() => {
      if (!document.contains(badge)) {
        removalObserver.disconnect();
        if (cachedPr) renderSizeBadge(cachedPr);
      }
    });
    removalObserver.observe(document.body, { childList: true, subtree: true });
  }

  let cachedPr = null;
  let cachedPrPath = null;

  async function runSizeBadge(owner, repo, prNumber) {
    if (cachedPr && cachedPrPath === location.pathname) {
      renderSizeBadge(cachedPr);
      return;
    }
    const token = await getOrPromptToken();
    if (!token) return;
    try {
      const pr = await fetchPR(owner, repo, prNumber, token);
      cachedPrPath = location.pathname;
      cachedPr = pr;
      renderSizeBadge(pr);
    } catch (err) {
      console.warn("[GitHub PR Size]", err.message);
    }
  }

  // ── Route ─────────────────────────────────────────────────────────────────

  let listObserver = null;

  function run() {
    if (listObserver) {
      listObserver.disconnect();
      listObserver = null;
    }

    const detailMatch = location.pathname.match(
      /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/,
    );
    const listMatch = location.pathname.match(/^\/(?:[^/]+\/[^/]+\/)?pulls/);

    if (detailMatch) {
      const [, owner, repo, prNumber] = detailMatch;
      runSizeBadge(owner, repo, prNumber);
    } else if (listMatch) {
      renderAgeBadges();
      listObserver = new MutationObserver(renderAgeBadges);
      listObserver.observe(
        document.querySelector(".js-issue-list, #js-issues-toolbar") ??
          document.body,
        { childList: true, subtree: true },
      );
    }
  }

  run();
  document.addEventListener("turbo:load", run);
})();
