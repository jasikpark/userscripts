# GitHub PR Size — Userscript

A [Tampermonkey](https://www.tampermonkey.net/) / [Violentmonkey](https://violentmonkey.github.io/) userscript that brings two quality-of-life overlays to GitHub:

- **Age badges** on the PR list — inspired by [PR Pulse](https://chromewebstore.google.com/detail/pr-pulse/ffmlmohnpbpplgcmkjlojmbaaeephblg) / [PR Pulse by CodePulse](https://chromewebstore.google.com/detail/pr-pulse-by-codepulse/gilemckpkkljmdmhgnangdembehklimi)
- **Size badges** on the PR detail page — thresholds aligned with [microsoft/PR-Metrics](https://github.com/microsoft/PR-Metrics)

No Chrome extension required. Works anywhere Tampermonkey or Violentmonkey runs (Chrome, Firefox, Edge, Safari).

---

## Features

### PR List — Age Badges

Each PR in `github.com/*/pulls` gets a colour-coded pill showing how many days it has been open.

| Age    | Colour   | Meaning                        |
| ------ | -------- | ------------------------------ |
| ≤ 3 d  | Green    | Fresh — no action needed       |
| ≤ 7 d  | Yellow   | Getting stale                  |
| ≤ 14 d | Orange   | Needs attention                |
| ≤ 30 d | Red      | Overdue                        |
| > 30 d | Dark red | Long-running — review priority |

### PR Detail — Size Badges

On a single PR page (`github.com/*/pull/123`) a `size/XS` … `size/XXL` badge is appended to the PR title, mirroring the label that [microsoft/PR-Metrics](https://github.com/microsoft/PR-Metrics) adds automatically in CI.

| Label      | Total lines changed | Colour     |
| ---------- | ------------------- | ---------- |
| `size/XS`  | ≤ 10                | Dark green |
| `size/S`   | ≤ 50                | Green      |
| `size/M`   | ≤ 250               | Yellow     |
| `size/L`   | ≤ 500               | Orange     |
| `size/XL`  | ≤ 1 000             | Red        |
| `size/XXL` | > 1 000             | Dark red   |

> **Note:** These thresholds differ from the microsoft/PR-Metrics _defaults_ (base 200, growth ×2). Edit the `SIZES` array in the script to match whatever your team has configured in CI.

Hovering the badge shows the full breakdown: `+additions / −deletions` and file count.

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) in your browser. Or https://github.com/quoid/userscripts
2. Open [`github-pr-size.user.js`](./github-pr-size.user.js) — your userscript manager will detect the `// ==UserScript==` header and offer to install it. Click **Install**.

---

## Setup — GitHub Personal Access Token

The size badge reads PR stats from the GitHub API, which requires authentication.

On the first visit to a PR detail page the script prompts for a **fine-grained Personal Access Token**:

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Create a token scoped to the repositories you want metrics for
3. Required permission: **Pull requests — Read-only** (or `repo` for classic tokens)
4. Paste the token into the prompt

The token is stored locally via `GM.getValue` / `GM.setValue` (never leaves your browser). To clear it and re-enter, open the Tampermonkey dashboard → Storage and delete the `github_pat` key, or simply visit any PR and enter an empty value when prompted on the next auth failure.

---

## How It Relates to PR Pulse & microsoft/PR-Metrics

| Capability                 | PR Pulse (extension)      | microsoft/PR-Metrics (CI)    | This script             |
| -------------------------- | ------------------------- | ---------------------------- | ----------------------- |
| PR age visibility          | ✅ colour-coded staleness | —                            | ✅ age badge on list    |
| PR size label              | —                         | ✅ adds `size/*` label in CI | ✅ badge on detail page |
| Requires CI setup          | —                         | ✅                           | —                       |
| Requires browser extension | ✅                        | —                            | Userscript manager only |
| Works on all GitHub repos  | ✅                        | Configured per-repo          | ✅                      |
| Jira integration           | ✅                        | —                            | —                       |
| Review / CI status         | ✅                        | —                            | —                       |

The script is intentionally focused: it adds the two most actionable at-a-glance signals (age + size) without requiring you to configure CI on every repo or install a Chrome-only extension.

---

## Roadmap

### Complexity badge on PR list
A file-count-based Low / Med / High / Critical badge on each list row, inspired by PR Pulse's complexity score. Thresholds (approximate): Low 0–25 files, Med 26–50, High 51–75, Critical 76+. Would require an API call per visible PR row — needs rate-limit consideration.

### Richer size badge tooltip
The current tooltip shows lines and file count. Could add a computed complexity score (0–100) to match PR Pulse's `Complexity Score: 85/100 / Files: 30 / Lines: +651 / −56` hover breakdown.

### Configurable thresholds
Store user preferences via `GM.getValue` / `GM.setValue` so age thresholds (e.g. green ≤ 24 h, yellow ≤ 72 h) and size/complexity breakpoints can be adjusted without editing the script.

---

For Userscript the valid keys and grants for metadata are:

```js
export const validGrants = new Set([
  "GM.info",
  "GM_info",
  "GM.addStyle",
  "GM.openInTab",
  "GM.closeTab",
  "GM.setValue",
  "GM.getValue",
  "GM.deleteValue",
  "GM.listValues",
  "GM.setClipboard",
  "GM.getTab",
  "GM.saveTab",
  "GM_xmlhttpRequest",
  "GM.xmlHttpRequest",
  "none",
]);

export const validMetaKeys = new Set([
  "author",
  "description",
  "downloadURL",
  "exclude",
  "exclude-match",
  "grant",
  "icon",
  "include",
  "inject-into",
  "match",
  "name",
  "noframes",
  "require",
  "run-at",
  "updateURL",
  "version",
  "weight",
]);
```

