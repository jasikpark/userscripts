# GitHub PR Size — Userscript

A [Tampermonkey](https://www.tampermonkey.net/) / [Violentmonkey](https://violentmonkey.github.io/) userscript that adds two at-a-glance overlays to GitHub PR pages.

- **Age badges** on PR lists — how long has this been open?
- **Complexity badges** on PR lists and detail pages — how big/risky is this change?

No Chrome extension required. Tested with [Userscripts](https://github.com/quoid/userscripts) on macOS; should work anywhere Tampermonkey or Violentmonkey runs (Chrome, Firefox, Edge, Safari).

---

## Features

### PR List — Age Badges

Each PR in `github.com/*/pulls` gets a colour-coded pill showing how long it has been open.

| Age    | Colour   | Meaning                        |
| ------ | -------- | ------------------------------ |
| ≤ 3 d  | Green    | Fresh — no action needed       |
| ≤ 7 d  | Yellow   | Getting stale                  |
| ≤ 14 d | Orange   | Needs attention                |
| ≤ 30 d | Red      | Overdue                        |
| > 30 d | Dark red | Long-running — review priority |

Inspired by [PR Pulse](https://chromewebstore.google.com/detail/pr-pulse/ffmlmohnpbpplgcmkjlojmbaaeephblg).

### PR List + PR Detail — Complexity Badges

A **Low / Medium / High / Critical** badge appears next to each PR title on list pages, and next to the PR status badge on the detail page.

| Label      | Score  | Colour |
| ---------- | ------ | ------ |
| `Low`      | ≤ 25   | Green  |
| `Medium`   | ≤ 50   | Blue   |
| `High`     | ≤ 75   | Orange |
| `Critical` | > 75   | Red    |

Score formula (0–100):

```
score = (changed_files / 20) × 50 + (total_lines / 1000) × 50
```

Hovering the badge shows the full breakdown: complexity score, file count, and `+additions / −deletions`.

---

## Installation

1. Install [Userscripts](https://github.com/quoid/userscripts) (macOS, tested), [Tampermonkey](https://www.tampermonkey.net/), or [Violentmonkey](https://violentmonkey.github.io/) in your browser.
2. Click the raw link below — your userscript manager will detect the `// ==UserScript==` header and offer to install it:

   **[Install github-pr-size.user.js](https://raw.githubusercontent.com/jasikpark/userscripts/main/github-pr-size.user.js)**

---

## Setup — GitHub Personal Access Token

The complexity badge reads PR stats from the GitHub API, which requires authentication.

On the first visit to a PR detail page the script prompts for a **Personal Access Token**:

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Create a token scoped to the repositories you want metrics for
3. Required permission: **Pull requests — Read-only** (or `repo` for classic tokens)
4. Paste the token into the prompt

The token is stored locally via `GM.getValue` / `GM.setValue` and never leaves your browser. To clear it, open the Tampermonkey/Violentmonkey dashboard → Storage and delete the `github_pat` key, or visit any PR and submit an empty value when prompted after an auth failure.

> **Note:** Complexity badges on the PR list page are skipped silently if no token is stored yet. Visit any PR detail page first to set your token.

---

## How It Relates to PR Pulse & microsoft/PR-Metrics

| Capability                 | PR Pulse (extension)      | microsoft/PR-Metrics (CI)    | This script                     |
| -------------------------- | ------------------------- | ---------------------------- | ------------------------------- |
| PR age visibility          | ✅ colour-coded staleness | —                            | ✅ age badge on list            |
| PR complexity / size       | —                         | ✅ adds `size/*` label in CI | ✅ complexity badge on list + detail |
| Requires CI setup          | —                         | ✅                           | —                               |
| Requires browser extension | ✅                        | —                            | Userscript manager only         |
| Works on all GitHub repos  | ✅                        | Configured per-repo          | ✅                              |
| Jira integration           | ✅                        | —                            | —                               |
| Review / CI status         | ✅                        | —                            | —                               |
