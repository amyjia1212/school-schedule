# School Pick-up / Drop-off Schedule

**Site:** https://amyjia1212.github.io/school-schedule/

A one-page site that shows Dad the day's drop-off and pick-up times. Everything lives in this GitHub repo:

| File | What it is |
|---|---|
| `index.html` / `style.css` | The page |
| `app.js` | Usual weekly schedule (`DEFAULTS` at the top), display, and the Edit form |
| `schedule.json` | Changed days only. The Edit button saves here. |

## How editing works
1. Tap **Edit** on the page. The first time on a phone, it asks for your **edit key** (see below).
2. Pick a date, then either check **No school** or change the times. Add a note if you want.
3. Tap **Save**. The page saves the change to `schedule.json` in this repo.
4. Dad's page checks for changes when he opens it and every 2 minutes, so updates show up within a couple of minutes.

**Reset day to usual** removes every change for that date.

## Getting your edit key (one time)
GitHub only lets someone who's logged in change files, so the page needs a key that can edit **only this repo**.

1. Open https://github.com/settings/personal-access-tokens/new
2. **Token name:** `school schedule`. **Expiration:** pick the longest option available.
3. **Repository access:** **Only select repositories** → `school-schedule`.
4. **Permissions → Repository permissions → Contents:** **Read and write**.
5. Click **Generate token** and copy it (it starts with `github_pat_`).
6. On your phone, open the site, tap **Edit**, and paste the key. That phone remembers it.

Keep the key private. Anyone who has it can change the schedule. If it leaks or expires, delete it on that same GitHub settings page and make a new one.
