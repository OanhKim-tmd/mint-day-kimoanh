# Mint Day v2 — Daily Planner + History

A free static daily planner with task countdown timers and per-day history.

## Run locally
Open `index.html` in a modern browser. No install, backend, account, or API key is required.

## Publish on GitHub Pages
1. Replace the existing `index.html`, `styles.css`, and `app.js` in the root of your `Mint-Day` repository with these files.
2. Commit and push to `main`.
3. In GitHub, open **Settings → Pages** and keep `main` + `/(root)`.
4. Wait for the Pages deployment to finish.

## Features
- Unlimited tasks, edit/delete, category and duration per task.
- Per-task Start / Pause / Resume / Reset countdown.
- Timer completion automatically marks the task complete.
- Manual completion and All / To do / Completed filters.
- Daily progress and completed focus time.
- Calendar with per-day snapshots and history detail (tasks, completion ratio, focus time).
- Each new local day archives the previous checklist, then resets task completion for the new day.
- Export/import JSON backup including history.
- Responsive mint-and-cream UI.

## Data and important limitations
- Data is stored in this browser's localStorage on this device. It does not sync between devices or browsers.
- The app snapshots today's data every 15 seconds and before page unload. It also archives the previous date before resetting when it detects a new day.
- If the browser's site data is cleared, data can be lost. Use Export regularly to keep a backup.
- A static GitHub Pages site does not provide cloud database storage. Cross-device sync requires adding a backend/database later.
- The countdown is timestamp-based. If the computer sleeps or the browser is closed, the display will not update in real time, but on return the timer catches up and marks an expired task complete.
- Google Fonts is optional; the app remains usable if the font service is unavailable.
