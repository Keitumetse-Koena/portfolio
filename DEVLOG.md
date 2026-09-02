# Dev Log

Reference notes for portfolio diary entries. Written after the fact from the
build session — dates approximate to "this session," not per-day.

---

## F1 Data Explorer

**Scoping**
- Considered real telemetry via FastF1 (Python library) — ruled out because
  it can't run client-side in a static site; would need a separate Python
  backend, which GitHub Pages (static-only hosting) can't run.
- Chose OpenF1 (REST API, free, no auth, direct `fetch()` from the browser)
  as the actual data source.

**v1 — Laps + telemetry**
- Season → session → driver dropdowns, cascading fetches (sessions, then
  drivers for that session).
- Laps table: lap number, lap time, three sector times.
- Click a lap → fetch `car_data` for that lap's exact time window → render
  speed/throttle/brake as a Chart.js line chart, dual y-axis (km/h vs %).
- Fixed: folder was placed directly under the portfolio root instead of a
  nested `projects/` path originally planned — corrected the "back to
  portfolio" link (`../index.html`, not `../../index.html`) to match.

**Scope expansion — all 18 OpenF1 endpoints attempted**
- Built a config-driven generic table renderer instead of one bespoke
  function per endpoint — a column list + endpoint name is enough to wire
  up a new tab. Used for: weather, stints, pit, position, intervals,
  race_control, overtakes, starting_grid, session_result (9 endpoints,
  one renderer).
- Three endpoints needed bespoke handling because they're not tabular:
  - `location` → canvas-drawn track map, reusing whichever lap was
    selected on the Laps tab.
  - `team_radio` → list of `<audio>` players, not a table.
  - `championship_drivers` / `championship_teams` → marked beta by
    OpenF1, so columns are generated dynamically from whatever keys the
    response actually contains, rather than hardcoded — protects against
    schema drift.
- Excluded on purpose, not by oversight: live/real-time streaming
  (positions, intervals, team radio *during* an in-progress session)
  requires a paid OpenF1 tier — everything here is historical-only
  (2023 season onward, the free tier's floor).
- Added per-tab caching keyed by session+driver so switching tabs back
  and forth doesn't re-hit the API (also helps stay under the free
  tier's 3 requests/second limit).
- Year range corrected to 2023–2026 (2023 is the earliest free data;
  2026 added since the season is in progress).

**Track map → animated replay**
- Started as a static line trace of the lap's path (x/y coordinates from
  `location`, canvas-drawn, Y-axis flipped to match screen coordinates).
- Added a "Replay lap" button: animates a marker moving along the path
  using `requestAnimationFrame`, with the full track drawn faintly
  underneath as a reference.
- Added a toggle: **Sped up** (fixed 6-second playback regardless of
  real lap length) vs **Real time** (plays back over the lap's actual
  duration — a 90-second lap takes 90 seconds to replay). Switching
  modes mid-animation cancels the running frame loop cleanly.

**Known open issue — not fixed, documented instead**
- `starting_grid` and `championship_drivers` / `championship_teams`
  return `404` from OpenF1. Left visible with the real error message
  in the UI rather than hidden or faked. Root cause not yet diagnosed —
  candidates: wrong required parameters, endpoint path differs from
  docs, or the specific sessions/years tested don't have that data
  populated. Next step: check OpenF1's docs directly against the exact
  failing request URL.

**Declined, deliberately**
- Engine audio — OpenF1 has no engine-sound or RPM-to-audio feed of any
  kind (its only audio is `team_radio`, driver-to-pit voice). Adding
  engine sound would mean synthesizing audio from telemetry from
  scratch, or sourcing real F1 audio separately (copyright risk for a
  public repo). Out of scope for this build.

---

## Zoo Website

**Assessment going in**
- Flagged as a common tutorial-clone project (recognizable HTML/CSS
  practice site), not something to present as differentiating work on
  its own — but a legitimate case study *if framed as a QA/debugging
  exercise* rather than a finished product.
- Decision made: house it as-is, with known bugs, and document the
  fixing process — turns a beginner clone into evidence of debugging
  judgment.

**Known bugs, identified but not yet fixed (open — track in the
portfolio diary as they get resolved)**
- Most nav links across `animal.html` point to `href="#"` instead of
  real pages.
- Typo in `Places.html`: `rel="stlesheet"` instead of `rel="stylesheet"`
  — the page's CSS silently fails to load.
- `feedback.html`'s "SUBMIT" is a styled `<a>` tag, not a real form
  submit — it doesn't actually send anything.

**File organization issues found and fixed during setup**
- A zip-extracted folder named `Pine-city-zoo-main` (GitHub's default
  naming for a downloaded repo) was sitting in the project root,
  containing the zoo's actual images and its own `style.css` — this had
  been accidentally committed alongside the portfolio skeleton.
- Renamed/moved into a proper `zoo/` folder at the portfolio root.
- Found and renamed a file called `zoo index.html` (space in the
  filename — breaks on the web, gets encoded as `%20` and often just
  fails) to `index.html`.
- Deleted a stray `amphitheatre.html.crswap` file — an editor backup
  file, not a real project file, that had also been committed by
  mistake.
- Corrected the link from the main portfolio page to `zoo/index.html`
  once the final folder location was confirmed.
