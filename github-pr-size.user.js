// ==UserScript==
// @name         GitHub PR Size
// @namespace    https://jasik.xyz
// @version      1.3.0
// @description  Age badges on PR list + size badge on PR detail (matches team PR-Metrics thresholds). Requires Safari 15.4+ / Chrome 92+.
// @match        https://github.com/*/*/pull/*
// @match        https://github.com/*/*/pulls*
// @match        https://github.com/pulls*
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(() => {
  // ── Shared selectors ──────────────────────────────────────────────────────
  const ROW_SELECTOR =
    "[id^='issue_'], .js-issue-row, [data-hovercard-type='pull_request']";
  const TITLE_LINK_SELECTOR =
    "a.markdown-title, a[data-hovercard-type='pull_request'], .js-issue-row-title a";

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
    const rows = document.querySelectorAll(ROW_SELECTOR);

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
        TITLE_LINK_SELECTOR,
      );
      if (titleEl) titleEl.insertAdjacentElement("afterend", badge);
    });
  }

  // ── Size badge (PR detail page) ───────────────────────────────────────────
  // Uses GitHub API since line counts aren't in the DOM

  function getTier(score) {
    const tiers = isDark()
      ? [
          { label: "Low",      max: 25,  bg: "#238636", fg: "#fff" },
          { label: "Medium",   max: 50,  bg: "#1f6feb", fg: "#fff" },
          { label: "High",     max: 75,  bg: "#9e6a03", fg: "#fff" },
          { label: "Critical", max: 100, bg: "#da3633", fg: "#fff" },
        ]
      : [
          { label: "Low",      max: 25,  bg: "#1a7f37", fg: "#fff" },
          { label: "Medium",   max: 50,  bg: "#0969da", fg: "#fff" },
          { label: "High",     max: 75,  bg: "#cf6c0f", fg: "#fff" },
          { label: "Critical", max: 100, bg: "#d1242f", fg: "#fff" },
        ];
    return tiers.find((t) => score <= t.max) ?? tiers.at(-1);
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

  const COMPLEXITY_CRITICAL_FILES = 20;
  const COMPLEXITY_CRITICAL_LINES = 1000;

  function complexityScore(totalLines, files) {
    return Math.min(
      100,
      Math.round(
        (files / COMPLEXITY_CRITICAL_FILES) * 50 +
        (totalLines / COMPLEXITY_CRITICAL_LINES) * 50,
      ),
    );
  }

  // ── Shared tooltip helper ─────────────────────────────────────────────────

  function createTooltip(badge, score, additions, deletions, changed_files) {
    const tooltip = document.createElement("div");
    tooltip.popover = "manual";
    tooltip.style.cssText = [
      "position: fixed",
      "inset: unset",
      "margin: 0",
      "background: #161b22",
      "border: 1px solid #30363d",
      "border-radius: 8px",
      "padding: 12px 16px",
      "color: #e6edf3",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "font-size: 13px",
      "line-height: 1.5",
      "width: max-content",
      "max-width: 220px",
      "box-shadow: 0 8px 24px rgba(0,0,0,0.5)",
      "pointer-events: none",
      "z-index: 10000",
    ].join("; ");
    tooltip.innerHTML =
      `<div style="font-weight:600;margin-bottom:4px">Complexity Score: ${score}/100</div>` +
      `<div>Files: ${changed_files}</div>` +
      `<div>Lines: +${additions.toLocaleString()} / \u2212${deletions.toLocaleString()}</div>` +
      `<hr style="border:none;border-top:1px solid #30363d;margin:8px 0 6px">` +
      `<div style="color:#8b949e;font-size:11px">\u26a1 github-pr-size</div>`;
    document.body.appendChild(tooltip);

    badge.addEventListener("mouseenter", () => {
      tooltip.showPopover();
      const r = badge.getBoundingClientRect();
      let top = r.bottom + 8;
      let left = r.left;
      if (top + tooltip.offsetHeight > window.innerHeight - 8)
        top = r.top - tooltip.offsetHeight - 8;
      if (left + tooltip.offsetWidth > window.innerWidth - 8)
        left = window.innerWidth - tooltip.offsetWidth - 8;
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    });
    badge.addEventListener("mouseleave", () => tooltip.hidePopover());

    return tooltip;
  }

  function renderSizeBadge({ additions, deletions, changed_files }) {
    if (document.querySelector(".gh-pr-size")) return; // already rendered

    const totalLines = additions + deletions;
    const score = complexityScore(totalLines, changed_files);
    const tier = getTier(score);

    const badge = document.createElement("span");
    badge.className = "gh-pr-size";
    badge.style.cssText = [
      "display: inline-flex",
      "align-items: center",
      "justify-content: center",
      "padding: 0 12px",
      "height: 32px",
      "border-radius: 999px",
      `background: ${tier.bg}`,
      `color: ${tier.fg}`,
      "font-size: 14px",
      "font-weight: 600",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "cursor: default",
    ].join("; ");
    badge.textContent = tier.label;

    // ── Popover tooltip ───────────────────────────────────────────────────────
    const tooltip = createTooltip(badge, score, additions, deletions, changed_files);

    const stateEl = document.querySelector(
      "span[data-status], .State, .gh-header-meta .State",
    );
    if (!stateEl) return;
    stateEl.insertAdjacentElement("afterend", badge);

    // Re-inject if React hydration removes our badge
    const removalObserver = new MutationObserver(() => {
      if (!document.contains(badge)) {
        removalObserver.disconnect();
        tooltip.remove();
        if (cachedPr) renderSizeBadge(cachedPr);
      }
    });
    removalObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ── Complexity badge (PR list) ────────────────────────────────────────────

  // href → pr data | "pending" | "error"
  const listPrCache = new Map();

  function renderComplexityBadgeForRow(row, { additions, deletions, changed_files }) {
    if (row.querySelector(".gh-pr-complexity")) return;

    const totalLines = additions + deletions;
    const score = complexityScore(totalLines, changed_files);
    const tier = getTier(score);

    const badge = document.createElement("span");
    badge.className = "gh-pr-complexity";
    badge.style.cssText = [
      "display: inline-flex",
      "align-items: center",
      "padding-inline: 6px",
      "border-radius: 8px",
      `background: ${tier.bg}`,
      `color: ${tier.fg}`,
      `border: 1px solid ${tier.bg}`,
      "font-size: 11px",
      "font-weight: 600",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "vertical-align: middle",
      "margin-left: 6px",
      "cursor: default",
      "line-height: 18px",
    ].join("; ");
    badge.textContent = tier.label;

    createTooltip(badge, score, additions, deletions, changed_files);

    const ageBadge = row.querySelector(".gh-pr-age");
    const titleEl = row.querySelector(
      TITLE_LINK_SELECTOR,
    );
    if (ageBadge) ageBadge.insertAdjacentElement("afterend", badge);
    else if (titleEl) titleEl.insertAdjacentElement("afterend", badge);
  }

  async function renderComplexityBadges() {
    const token = await GM.getValue("github_pat", "");
    if (!token) return;

    const rows = document.querySelectorAll(ROW_SELECTOR);

    rows.forEach((row) => {
      if (row.querySelector(".gh-pr-complexity")) return;

      const titleEl = row.querySelector(
        TITLE_LINK_SELECTOR,
      );
      if (!titleEl) return;

      const href = titleEl.getAttribute("href") ?? "";
      const match = href.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      if (!match) return;

      const cached = listPrCache.get(href);
      if (cached && cached !== "pending" && cached !== "error") {
        renderComplexityBadgeForRow(row, cached);
        return;
      }
      if (cached === "pending" || cached === "error") return;

      listPrCache.set(href, "pending");
      const [, owner, repo, prNumber] = match;
      fetchPR(owner, repo, prNumber, token)
        .then((pr) => {
          listPrCache.set(href, pr);
          renderComplexityBadgeForRow(row, pr);
        })
        .catch(() => listPrCache.set(href, "error"));
    });
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
      renderComplexityBadges();
      listObserver = new MutationObserver(() => {
        renderAgeBadges();
        renderComplexityBadges();
      });
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
