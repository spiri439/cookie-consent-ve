CookieConsent Demo (spiri439)

Production-ready example using the official orestbida/cookieconsent v3 with:
- Real script gating via `manageScriptTags: true`
- In-banner Manage preferences button
- Preferences modal with category toggles (necessary, analytics, marketing)
- Auto-clear of category cookies and page reload on change

Structure
- demo/index.html → main demo (loads `cookieconsent.umd.js` and `cookieconsent.css` locally)
- demo/settings.html → quick settings portal (opens preferences on load)
- cookieconsent.umd.js / cookieconsent.css → local library files
- src/cc.js / styles/cc.css → local helpers (optional for experiments)

Run locally
- Serve as static files (any HTTP server). No build needed.

Publish to GitHub (using gh)
```bash
cd /home/dev/cookie-consent-ve
git init
git add .
git commit -m "CookieConsent demo: gated scripts + autoClear + settings link"
gh repo create spiri439/cookieconsent-demo --public --source . --remote origin --push --disable-issues=false --disable-wiki=true
```

GitHub Pages
1) Repo → Settings → Pages → Deploy from a branch → main / root → Save
2) Visit https://spiri439.github.io/cookieconsent-demo/

