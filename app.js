// Where the schedule changes live: schedule.json in this GitHub repo.
const OWNER = "amyjia1212";
const REPO = "school-schedule";
const BRANCH = "main";
const FILE = "schedule.json";

// Usual schedule as [drop-off, pick-up] in 24-hour "HH:MM". Day numbers: 0 = Sunday ... 6 = Saturday.
// Days not listed (Saturday, Sunday) are "No school".
const DEFAULTS = {
  1: ["09:15", "15:55"], // Monday
  2: ["09:50", "15:35"], // Tuesday
  3: ["08:30", "15:35"], // Wednesday
  4: ["09:50", "15:35"], // Thursday
  5: ["08:30", "15:35"], // Friday
};

const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;
const REFRESH_MS = 2 * 60 * 1000;
const CACHE_KEY = "school-schedule-cache";
const TOKEN_KEY = "school-schedule-edit-key";

const $ = (id) => document.getElementById(id);

let overrides = loadLocal(CACHE_KEY, {}); // { "YYYY-MM-DD": { noSchool, dropoff, pickup, note } }
let viewDate = today();
let todayKey = keyOf(viewDate);

/* ---------------- dates & formatting ---------------- */
function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromKey(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtTime(hhmm) {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function weekdayName(d) { return d.toLocaleDateString(undefined, { weekday: "long" }); }

/* ---------------- local storage helpers ---------------- */
function loadLocal(k, fallback) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveLocal(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}
const getToken = () => loadLocal(TOKEN_KEY, null);

/* ---------------- GitHub ---------------- */
function headers(extra = {}) {
  const h = { Accept: "application/vnd.github+json", ...extra };
  const t = getToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

// UTF-8 safe base64 (so emoji in notes work).
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function readFromApi() {
  const res = await fetch(`${API}?ref=${BRANCH}&t=${Date.now()}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw Object.assign(new Error(`GitHub ${res.status}`), { status: res.status });
  const json = await res.json();
  return { data: JSON.parse(fromBase64(json.content) || "{}"), sha: json.sha };
}

async function refresh() {
  try {
    overrides = (await readFromApi()).data;
  } catch (err) {
    // GitHub limits anonymous reads to 60/hour per network; fall back to the copy GitHub Pages serves.
    try {
      const res = await fetch(`${FILE}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Pages ${res.status}`);
      overrides = await res.json();
    } catch (err2) {
      console.error(err, err2);
      setStatus("Couldn't load the latest changes. Showing the last saved version.");
      render();
      return;
    }
  }
  saveLocal(CACHE_KEY, overrides);
  setStatus("");
  render();
}

// Read the latest file, apply one day's change, and save it back as a commit.
async function writeDay(k, value) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, sha } = await readFromApi();
    if (value) data[k] = value; else delete data[k];
    const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
    const res = await fetch(API, {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        message: value ? `Update ${k}` : `Reset ${k} to usual`,
        content: toBase64(JSON.stringify(sorted, null, 2) + "\n"),
        sha,
        branch: BRANCH,
      }),
    });
    if (res.ok) { overrides = sorted; saveLocal(CACHE_KEY, overrides); return; }
    if (res.status === 409 && attempt === 0) continue; // someone saved at the same moment; retry once
    throw Object.assign(new Error(`GitHub ${res.status}`), { status: res.status });
  }
}

/* ---------------- schedule logic ---------------- */
function scheduleFor(d) {
  const def = DEFAULTS[d.getDay()] || null;
  const o = overrides[keyOf(d)] || {};
  const dropoff = o.dropoff || (def ? def[0] : "");
  const pickup = o.pickup || (def ? def[1] : "");
  return {
    noSchool: !!o.noSchool || (!dropoff && !pickup),
    dropoff,
    pickup,
    note: o.note || "",
    dropoffChanged: !!o.dropoff && (!def || o.dropoff !== def[0]),
    pickupChanged: !!o.pickup && (!def || o.pickup !== def[1]),
    noSchoolChanged: !!o.noSchool && !!def,
  };
}

/* ---------------- rendering ---------------- */
function render() {
  const s = scheduleFor(viewDate);
  const diff = Math.round((viewDate - today()) / 86400000);

  $("relative").textContent = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : " ";
  $("weekday").textContent = weekdayName(viewDate);
  $("fulldate").textContent = viewDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  document.body.classList.toggle("not-today", diff !== 0);
  $("todayBtn").hidden = diff === 0;

  $("times").hidden = s.noSchool;
  $("noschool").hidden = !s.noSchool;
  $("noschool").classList.toggle("changed", s.noSchoolChanged);
  $("dropoff").textContent = fmtTime(s.dropoff);
  $("pickup").textContent = fmtTime(s.pickup);
  $("dropoffSlot").classList.toggle("changed", s.dropoffChanged);
  $("pickupSlot").classList.toggle("changed", s.pickupChanged);

  const badgeText = diff === 0 ? "Changed today" : "Changed this day";
  document.querySelectorAll(".badge").forEach((b) => (b.textContent = badgeText));

  $("note").textContent = s.note || "No notes.";
  $("note").classList.toggle("empty", !s.note);
}

function setStatus(msg) { $("status").textContent = msg; }

/* ---------------- editor ---------------- */
function openEditor(k) {
  $("edDate").value = k;
  fillEditor();
  $("edErr").textContent = "";
  $("editDlg").showModal();
}

function fillEditor() {
  const k = $("edDate").value;
  if (!k) return;
  const d = fromKey(k);
  const def = DEFAULTS[d.getDay()];
  const o = overrides[k] || {};
  $("edUsual").textContent = def
    ? `Usual ${weekdayName(d)}: ${fmtTime(def[0])} / ${fmtTime(def[1])}`
    : `Usual ${weekdayName(d)}: No school (add times to make it a school day)`;
  $("edNoSchool").checked = !!o.noSchool;
  $("edDrop").value = o.dropoff || (def ? def[0] : "");
  $("edPick").value = o.pickup || (def ? def[1] : "");
  $("edNote").value = o.note || "";
  syncNoSchool();
}

function syncNoSchool() {
  const off = $("edNoSchool").checked;
  $("edDrop").disabled = off;
  $("edPick").disabled = off;
}

async function save(k, value) {
  const btns = $("editForm").querySelectorAll("button");
  btns.forEach((b) => (b.disabled = true));
  $("edErr").textContent = "Saving…";
  try {
    await writeDay(k, value);
    $("editDlg").close();
    viewDate = fromKey(k);
    render();
  } catch (err) {
    console.error(err);
    $("edErr").textContent =
      err.status === 401 ? "Your edit key isn't working (maybe expired). Tap 'Remove key' and paste a new one."
      : err.status === 403 || err.status === 404 ? "This key can't save to the schedule. Make sure it has Contents: Read and write for school-schedule."
      : "Couldn't save. Check your internet connection and try again.";
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

$("editForm").onsubmit = (e) => {
  e.preventDefault();
  const k = $("edDate").value;
  if (!k) return;
  const def = DEFAULTS[fromKey(k).getDay()];
  const noSchool = $("edNoSchool").checked;
  const drop = $("edDrop").value;
  const pick = $("edPick").value;
  const note = $("edNote").value.trim();

  // Only store what differs from the usual schedule.
  const v = {};
  if (noSchool) v.noSchool = true;
  if (!noSchool && drop && (!def || drop !== def[0])) v.dropoff = drop;
  if (!noSchool && pick && (!def || pick !== def[1])) v.pickup = pick;
  if (note) v.note = note;
  save(k, Object.keys(v).length ? v : null);
};

/* ---------------- wiring ---------------- */
$("prev").onclick = () => { viewDate = addDays(viewDate, -1); render(); };
$("next").onclick = () => { viewDate = addDays(viewDate, 1); render(); };
$("todayBtn").onclick = () => { viewDate = today(); render(); };

$("editBtn").onclick = () => {
  if (getToken()) { openEditor(keyOf(viewDate)); return; }
  $("keyInput").value = "";
  $("keyErr").textContent = "";
  $("keyDlg").showModal();
};

$("keyForm").onsubmit = async (e) => {
  e.preventDefault();
  const key = $("keyInput").value.trim();
  $("keyErr").textContent = "Checking…";
  try {
    const res = await fetch(`${API}?ref=${BRANCH}`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(String(res.status));
    saveLocal(TOKEN_KEY, key);
    $("keyDlg").close();
    openEditor(keyOf(viewDate));
  } catch {
    $("keyErr").textContent = "That key didn't work. Check you copied all of it.";
  }
};

$("edDate").onchange = fillEditor;
$("edNoSchool").onchange = syncNoSchool;
$("edReset").onclick = () => { const k = $("edDate").value; if (k) save(k, null); };
$("forgetKey").onclick = () => { saveLocal(TOKEN_KEY, null); $("editDlg").close(); };
document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => b.closest("dialog").close()));

// Roll over at midnight; re-check for changes every 2 minutes and whenever the page comes back into view.
function tick() {
  const k = keyOf(today());
  if (k !== todayKey) {
    if (keyOf(viewDate) === todayKey) viewDate = today();
    todayKey = k;
    render();
  }
}
setInterval(() => { if (!document.hidden) { tick(); refresh(); } }, REFRESH_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { tick(); refresh(); } });

render();
refresh();
