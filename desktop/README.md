# JobPilot AI — Desktop App

Installable Windows desktop app (Electron) that runs JobPilot locally on your PC.

This package contains only the client product. The owner portal is not bundled, linked, or enabled in the desktop backend.

## Run in development (no installer)

From the **jobpilot-ai** root folder:

```bash
npm install
npm run build
npm run desktop
```

This opens JobPilot in its own window. The server runs on `http://127.0.0.1:51234` (not port 3000).
The Help menu opens the public app at `https://jobpilot-ai.up.railway.app` unless `JOBPILOT_PUBLIC_URL` is set.

## Build Windows installer (.exe)

```bash
cd desktop
npm install
npm run dist
```

Installer output: `desktop/release/JobPilot AI Setup *.exe`

Unpacked app (for testing): `npm run dist:dir` → `desktop/release/win-unpacked/`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend crash on start | From project root: `npm run fix:sqlite` |
| "Build required" dialog | Run `npm run build` from jobpilot-ai root |
| Blank window | Wait a few seconds; check antivirus is not blocking the app |

## Notes

- Data is stored in `backend/data/` (SQLite) next to the app when running from source; in the installed app, data lives under your user profile via the bundled backend path.
- Gmail OAuth redirect URL when using the desktop app: `http://127.0.0.1:51234/api/gmail/callback`
