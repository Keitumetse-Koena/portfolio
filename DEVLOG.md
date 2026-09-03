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

---

## Portfolio Page (index.html)

**Placeholder cleanup**
- Removed entry 04's leftover placeholder ("Third project title",
  `href="#"`, status "Planned") rather than relabeling it "Shipped" —
  a fake status next to honestly-documented entries would have
  undercut the whole point of the diary framing.
- Fixed contact email link — was still the skeleton's placeholder
  `you@example.com`; corrected to the real address, both `href` and
  visible text.
- Added GitHub and LinkedIn links to the Contact section (not the
  footer — decided contact info belongs where someone's actually
  looking to reach out, footer stays plain copyright only). Removed
  the trailing "→" arrows from both buttons per a later styling pass.

**Skills section — rebuilt from generic to evidence-linked**
- Original skill list was the unedited starter content. Rewrote it to
  reflect what was actually built this session: added REST API
  integration, Chart.js/canvas data visualization, Git & GitHub,
  debugging live projects — none of which were listed before despite
  being demonstrably backed by the F1 app and the zoo bug-fix log.
- Left "Learning" (Python, SQL) as plain unlinked text — nothing built
  yet demonstrates those, so no project or repo link was attached to
  them. Same honesty principle as the rest of the site: don't imply
  evidence that doesn't exist yet.
- Added `id` anchors to each project log entry (`proj-revs`,
  `proj-fundamentals`, `proj-zoo`, `proj-f1`) so skills can link to a
  specific card instead of just the general Work section.
- Added a `:target` CSS animation (brief highlight-pulse) so landing on
  a card via a skill link is visually obvious, not just a silent jump.
  Respects `prefers-reduced-motion`.
- **Bug found and fixed twice in the same spot:** editing entry 04's
  tags accidentally broke its HTML structure — an errant `</li>`
  closed `.log-entry` right after the tag list, orphaning the
  "View project →" link outside the card entirely (it rendered full-
  width below the section divider instead of inside the card). Root
  caused to exactly one misplaced closing tag, fixed by rebuilding the
  whole entry as a single clean block rather than patching around it.

**Deep linking — skills into specific app screens, not just cards**
- Initial version only scrolled to a project's card on the portfolio
  page itself. Reworked per a follow-up request: skills that are
  proven by one specific capability now link directly into the F1 app
  at the relevant tab, not just to the portfolio card.
- Added URL query param handling to the F1 app (`?tab=weather`,
  `?tab=location&autoload=1`) — read on page load, auto-activates the
  named tab and, where `autoload=1` is present, auto-selects the first
  lap so the destination isn't just an empty screen on arrival.
- Skill → destination mapping: JavaScript (DOM/fetch) → Laps tab,
  autoloaded; REST API integration → Weather tab; Data visualization
  → Track Map tab, autoloaded. Git & GitHub and the three QA-related
  skills link to the actual GitHub repo and `DEVLOG.md` (including a
  direct anchor into the Zoo section for the bug-related ones) rather
  than to an in-app tab, since those are proven by process/history, not
  a single screen.

---

## Reflex Lights (new mini-project)

- Added as its own small project, not bundled into an existing entry —
  reaction-time game modelled on an F1 start sequence: five lights
  fill in one at a time (staggered, same pacing idea as a real start),
  then go dark after a randomized delay; click or press spacebar as
  fast as possible.
- Real jump-start penalty logic, not just cosmetic: clicking during the
  light sequence (before they go dark) is caught and reported as a
  false start rather than silently ignored or scored.
- Personal best persisted via `localStorage` — noted this is safe here
  specifically because it's a real deployed static page, not a
  sandboxed preview environment.
- Logged as entry 05 in the main Work log, tagged JavaScript / Timing
  & state / localStorage — distinct skill evidence from the other four
  entries (event handling and time-based state, not data fetching or
  QA process).
- Documented limitation: browser timing precision varies slightly by
  browser/OS (anti-fingerprinting protections), so results are a
  good-faith approximation, not lab-grade accurate — worth knowing
  before claiming precision if asked about it directly.

---

## Reflex Lights — bug fix

- **Bug found in testing:** every click registered as an instant false
  start, and the lights appeared not to work at all. Root cause: the
  Start button sits inside the reaction zone, and both had click
  listeners. Clicking Start fired the round, then the same click
  bubbled up to the reaction-zone's own listener and immediately fired
  a false-start check — before the lights had a chance to run.
- Fixed by stopping the Start button's click from propagating to its
  parent (`e.stopPropagation()`).
- Also added spacebar as a full alternate control, not just for
  reacting — space now starts a round too, matching the original
  request that the game not require a mouse at all.

---

## Main portfolio — scroll/header bug

- **Bug found in testing:** page wouldn't scroll fully to the top —
  header stayed slightly cut off even after reaching what looked like
  position 0.
- Likely cause: CSS scroll anchoring fighting the sticky header once
  the Google Fonts (Space Grotesk, Source Serif 4) finish loading
  asynchronously and cause a small layout shift after first paint.
- Fix: `overflow-anchor: none;` added to `body` in `style.css` to stop
  the browser from auto-compensating scroll position during that
  shift.
- Noted as needing a second check: confirm this wasn't just Chrome
  restoring a previous scroll position on refresh (a hard refresh plus
  manual scroll rules that out) before treating the CSS fix as the
  full story.
