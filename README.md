# Mint Day — Daily Planner

A small, free, static daily checklist with per-task countdown timers.

## Run locally
Open `index.html` in a modern browser. No installation, server, account, or API key is required.

## Publish free with GitHub Pages
1. Create a GitHub repository, for example `mint-day`.
2. Upload `index.html`, `styles.css`, and `app.js` to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then Save.
6. Wait for GitHub Pages to publish. Your URL will look like `https://YOUR-USERNAME.github.io/mint-day/`.

## Features
- Add as many tasks as you need; edit and delete them.
- Each task has a name, duration (1–1440 minutes), and category.
- Select a task, start/pause/resume/reset its countdown.
- Timer completion automatically marks the task complete.
- Manually mark tasks complete and filter All / To do / Completed.
- Daily progress and completed focus time.
- Checklist resets its completion state on the next local calendar day; task definitions remain.
- Export/import a JSON backup.
- Responsive mint-and-cream interface.

## Storage and limitations
- All data is stored in this browser's `localStorage` on this device. It is not synced across devices or browsers.
- Clearing browser data can erase the checklist. Use Export periodically to keep a backup.
- The app has no backend and no hosting fee on GitHub Pages.
- A browser tab is not guaranteed to execute JavaScript continuously while the computer is asleep or the browser is fully closed. The timer uses timestamps, so when you return it catches up and completes an expired task.
- Google Fonts is an optional external font; the app still works if it cannot load.
