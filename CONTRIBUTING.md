# Contributing to Who Owns You

Thanks for helping improve this extension. This guide explains how to propose code changes and contribute ownership data safely and consistently.

> By participating, you agree to follow the [Code of Conduct]([MIT](https://github.com/zacharyisnthere/who-owns-you/blob/main/CODE_OF_CONDUCT.md).

---

## 1) What we accept

- **Data contributions**: new or corrected entries in `data/channels.json` and `data/owners.json` with public sources.
- **Code contributions**: improvements to the content script, DOM placement, performance, UI/UX, or documentation.
- **Bug reports**: reproducible problems with steps, sample URLs, and console logs.

---

## 2) Quick dev setup

1. Fork and clone the repo
   ```bash
   git clone https://github.com/YOUR-USERNAME/who-owns-you.git
   cd who-owns-you
   ```
2. Load the extension (Manifest V3)
   - Chrome/Brave/Edge → `chrome://extensions/`
   - Enable **Developer mode**
   - **Load unpacked** → select the repo root
3. Open a YouTube video/channel/shorts page and check the DevTools Console for logs from `content.js`.

---

## 3) Issues: how to file

- **Bug report** – steps, expected vs actual result, sample URL, console logs.
- **Data addition/correction** – channel URL/ID + owner + at least one public source.
- **Feature request** – clear problem statement and suggested solution.

Provide exact YouTube URLs (e.g., `/watch?v=...`, `/@handle`, `/channel/UC...`).

---

## 4) Branching, commits, PRs

- Branch from `main`:
  - `feat/...` for features
  - `fix/...` for bug fixes
  - `data/...` for dataset changes
  - `docs/...` for documentation changes
- Keep PRs small and focused. Link related issues.
- Include screenshots for UI changes.

---

## 5) Coding standards

- **MV3 only**. Keep permissions minimal.
- Use stable DOM selectors (`ytd-watch-metadata`, `#above-the-fold`) instead of brittle class chains.
- Ensure `injectBadge()` is idempotent (no duplicate badges).
- No analytics, tracking, or remote fetches—lookups must be from packaged JSON.

---

## 6) Data contributions

Each `channels.json` entry must follow this format:

```json
{
  "channel_id": "UCxxxxxxxxxxxxxxxxxxxxxx",
  "channel_name": "Example Channel",
  "channel_tag": "examplehandle",
  "channel_url": "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx",
  "owner": "Example Capital",
  "ownership_type": "Full | Partial | Majority | Minority",
  "acquisition_date": "YYYY-MM-DD",
  "source_url": ["https://example.com/source"],
  "notes": "One-sentence summary (stake + timing)."
}
```

Rules:
- Use accurate `channel_id` (24 characters, starts with UC).
- Include at least one public, verifiable `source_url`.
- Keep `notes` to one clear sentence—no dollar amounts.

---

## 7) Testing UI changes

- Test on a **video**, **short**, and **channel** page.
- Confirm badge placement is correct and no duplicates appear.
- Navigate within YouTube (SPA) and ensure the badge re-injects when needed.

---

## 8) Review & merge

- Maintainers review for correctness, style, and data sourcing.
- Squash merge preferred.
- You may be asked to adjust selectors, performance, or sourcing.

---

## License

By contributing, you agree your work will be licensed under the project’s [LICENSE](https://github.com/zacharyisnthere/who-owns-you/blob/main/LICENSE)
