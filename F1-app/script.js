const API_BASE = 'https://api.openf1.org/v1';

// ---------------------------------------------------------
// Shared state
// ---------------------------------------------------------
let currentLaps = [];
let currentDriverNumber = null;
let currentSessionKey = null;
let selectedLap = null;        // last lap clicked on the Laps tab — reused by Track Map
let telemetryChart = null;
let tabCache = {};             // { tabId: { key: data } } to avoid refetching on every switch

const yearSelect = document.getElementById('yearSelect');
const sessionSelect = document.getElementById('sessionSelect');
const driverSelect = document.getElementById('driverSelect');
const statusMsg = document.getElementById('statusMsg');

function setStatus(message, isError = false) {
  statusMsg.textContent = message;
  statusMsg.classList.toggle('is-error', isError);
}

function formatLapTime(seconds) {
  if (typeof seconds !== 'number') return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${minutes}:${remainder}`;
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

// ---------------------------------------------------------
// Step 1: sessions for the selected year
// ---------------------------------------------------------
async function loadSessions() {
  sessionSelect.innerHTML = '<option value="">Loading sessions…</option>';
  driverSelect.innerHTML = '<option value="">Select a session first</option>';
  tabCache = {};
  resetLapsUI();
  setStatus('');

  try {
    const sessions = await fetchJSON(`${API_BASE}/sessions?year=${yearSelect.value}&session_name=Race`);
    if (!sessions.length) {
      sessionSelect.innerHTML = '<option value="">No sessions found</option>';
      return;
    }
    sessionSelect.innerHTML = sessions
      .map(s => `<option value="${s.session_key}">${s.location} — ${s.date_start.slice(0, 10)}</option>`)
      .join('');
    await loadDrivers();
  } catch (err) {
    setStatus(`Couldn't load sessions: ${err.message}`, true);
  }
}

// ---------------------------------------------------------
// Step 2: drivers in the selected session
// ---------------------------------------------------------
async function loadDrivers() {
  const sessionKey = sessionSelect.value;
  driverSelect.innerHTML = '<option value="">Loading drivers…</option>';
  tabCache = {};
  resetLapsUI();
  if (!sessionKey) return;

  try {
    const drivers = await fetchJSON(`${API_BASE}/drivers?session_key=${sessionKey}`);
    if (!drivers.length) {
      driverSelect.innerHTML = '<option value="">No drivers found</option>';
      return;
    }
    const seen = new Set();
    const unique = drivers.filter(d => {
      if (seen.has(d.driver_number)) return false;
      seen.add(d.driver_number);
      return true;
    });
    driverSelect.innerHTML = unique
      .map(d => `<option value="${d.driver_number}">${d.full_name || d.name_acronym}</option>`)
      .join('');
    currentSessionKey = sessionKey;
    currentDriverNumber = driverSelect.value;
    await loadLaps();
  } catch (err) {
    setStatus(`Couldn't load drivers: ${err.message}`, true);
  }
}

driverSelect.addEventListener('change', () => {
  currentDriverNumber = driverSelect.value;
  tabCache = {}; // driver changed — session_driver-scoped tabs need refetching
  loadLaps();
  refreshActiveTab();
});

// ---------------------------------------------------------
// Laps (kept bespoke — feeds the telemetry + track map view)
// ---------------------------------------------------------
function resetLapsUI() {
  document.getElementById('lapsTable').hidden = true;
  document.getElementById('lapsTableBody').innerHTML = '';
  document.getElementById('lapsHint').hidden = true;
  document.getElementById('telemetrySection').hidden = true;
  currentLaps = [];
  selectedLap = null;
}

async function loadLaps() {
  if (!currentSessionKey || !currentDriverNumber) return;
  resetLapsUI();
  setStatus('Loading laps…');

  try {
    const laps = await fetchJSON(`${API_BASE}/laps?session_key=${currentSessionKey}&driver_number=${currentDriverNumber}`);
    if (!laps.length) {
      setStatus('No lap data available for this driver/session.');
      return;
    }
    laps.sort((a, b) => a.lap_number - b.lap_number);
    currentLaps = laps;

    const validTimes = laps.map(l => l.lap_duration).filter(t => typeof t === 'number');
    const fastest = validTimes.length ? Math.min(...validTimes) : null;

    const tbody = document.getElementById('lapsTableBody');
    tbody.innerHTML = laps.map(lap => `
      <tr class="${lap.lap_duration === fastest ? 'fastest-lap' : ''}" data-lap-number="${lap.lap_number}">
        <td>${lap.lap_number}</td>
        <td>${formatLapTime(lap.lap_duration)}</td>
        <td>${formatLapTime(lap.duration_sector_1)}</td>
        <td>${formatLapTime(lap.duration_sector_2)}</td>
        <td>${formatLapTime(lap.duration_sector_3)}</td>
        <td class="top-speed-cell">—</td>
      </tr>
    `).join('');

    document.getElementById('lapsTable').hidden = false;
    document.getElementById('lapsHint').hidden = false;
    setStatus(`${laps.length} laps loaded. Click a lap for telemetry and the track map.`);
  } catch (err) {
    setStatus(`Couldn't load laps: ${err.message}`, true);
  }
}

document.getElementById('lapsTableBody').addEventListener('click', (e) => {
  const row = e.target.closest('tr');
  if (!row) return;
  const lapNumber = Number(row.dataset.lapNumber);
  const lap = currentLaps.find(l => l.lap_number === lapNumber);
  if (!lap || !lap.date_start || typeof lap.lap_duration !== 'number') {
    setStatus('This lap is missing timing data needed for telemetry (in/out laps often are).', true);
    return;
  }
  document.querySelectorAll('#lapsTableBody tr').forEach(r => r.classList.remove('is-selected'));
  row.classList.add('is-selected');
  selectedLap = lap;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  loadTelemetry(lap, row);
});

async function loadTelemetry(lap, row) {
  const section = document.getElementById('telemetrySection');
  const title = document.getElementById('telemetryTitle');
  const status = document.getElementById('telemetryStatus');
  const stats = document.getElementById('telemetryStats');

  section.hidden = false;
  title.textContent = `Lap ${lap.lap_number} telemetry`;
  status.textContent = 'Loading car data…';
  stats.innerHTML = '';

  const startDate = new Date(lap.date_start);
  const endDate = new Date(startDate.getTime() + lap.lap_duration * 1000);
  const url = `${API_BASE}/car_data?driver_number=${currentDriverNumber}&session_key=${currentSessionKey}` +
              `&date>=${startDate.toISOString()}&date<=${endDate.toISOString()}`;

  try {
    const points = await fetchJSON(url);
    if (!points.length) {
      status.textContent = 'No car_data available for this lap (coverage varies by session).';
      if (telemetryChart) { telemetryChart.destroy(); telemetryChart = null; }
      return;
    }
    points.sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = points.map(p => ((new Date(p.date) - startDate) / 1000).toFixed(1));
    const speeds = points.map(p => p.speed);
    const throttle = points.map(p => p.throttle);
    const brake = points.map(p => p.brake);
    const topSpeed = Math.max(...speeds.filter(s => typeof s === 'number'));
    const avgThrottle = Math.round(throttle.reduce((s, t) => s + (t || 0), 0) / throttle.length);

    stats.innerHTML = `
      <div class="stat-block"><span class="stat-label">Top speed</span><span class="stat-value">${topSpeed} km/h</span></div>
      <div class="stat-block"><span class="stat-label">Avg throttle</span><span class="stat-value">${avgThrottle}%</span></div>
      <div class="stat-block"><span class="stat-label">Data points</span><span class="stat-value">${points.length}</span></div>
    `;
    if (row) {
      const cell = row.querySelector('.top-speed-cell');
      if (cell) cell.textContent = `${topSpeed} km/h`;
    }
    renderTelemetryChart(labels, speeds, throttle, brake);
    status.textContent = `${points.length} telemetry samples across the lap.`;
  } catch (err) {
    status.textContent = `Couldn't load telemetry: ${err.message}`;
  }
}

function renderTelemetryChart(labels, speeds, throttle, brake) {
  if (telemetryChart) telemetryChart.destroy();
  telemetryChart = new Chart(document.getElementById('telemetryChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Speed (km/h)', data: speeds, borderColor: '#2B5F4D', backgroundColor: 'transparent', yAxisID: 'ySpeed', pointRadius: 0, borderWidth: 2, tension: 0.15 },
        { label: 'Throttle (%)', data: throttle, borderColor: '#B35E28', backgroundColor: 'transparent', yAxisID: 'yPercent', pointRadius: 0, borderWidth: 1.5, tension: 0.15 },
        { label: 'Brake', data: brake, borderColor: '#8A2E2E', backgroundColor: 'transparent', yAxisID: 'yPercent', pointRadius: 0, borderWidth: 1.5, tension: 0.15 }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { title: { display: true, text: 'Seconds into lap' }, grid: { color: '#C6C1AF' } },
        ySpeed: { position: 'left', title: { display: true, text: 'km/h' }, grid: { color: '#C6C1AF' } },
        yPercent: { position: 'right', min: 0, max: 100, title: { display: true, text: '%' }, grid: { drawOnChartArea: false } }
      },
      plugins: { legend: { position: 'top' } }
    }
  });
}

// ---------------------------------------------------------
// GENERIC TABLE TABS
// Config-driven: endpoint name, scope (what params it needs),
// and either a fixed column list or "auto" (derive from data).
// ---------------------------------------------------------
const TABLE_TABS = {
  weather:        { endpoint: 'weather',        scope: 'session',        columns: [['date','Time','time'], ['air_temperature','Air °C'], ['track_temperature','Track °C'], ['humidity','Humidity %'], ['wind_speed','Wind (m/s)'], ['rainfall','Rainfall']] },
  stints:         { endpoint: 'stints',          scope: 'session_driver', columns: [['stint_number','Stint'], ['compound','Compound'], ['lap_start','From lap'], ['lap_end','To lap'], ['tyre_age_at_start','Tyre age start']] },
  pit:            { endpoint: 'pit',             scope: 'session',        columns: [['driver_number','Driver #'], ['lap_number','Lap'], ['pit_duration','Duration (s)']] },
  position:       { endpoint: 'position',        scope: 'session_driver', columns: [['date','Time','time'], ['position','Position']] },
  intervals:      { endpoint: 'intervals',       scope: 'session_driver', columns: [['date','Time','time'], ['gap_to_leader','Gap to leader'], ['interval','Interval']] },
  race_control:   { endpoint: 'race_control',    scope: 'session',        columns: [['date','Time','time'], ['category','Category'], ['flag','Flag'], ['message','Message']] },
  overtakes:      { endpoint: 'overtakes',       scope: 'session',        columns: [['date','Time','time'], ['overtaking_driver_number','Overtaking #'], ['overtaken_driver_number','Overtaken #']] },
  starting_grid:  { endpoint: 'starting_grid',   scope: 'session',        columns: [['position','Grid pos'], ['driver_number','Driver #']] },
  session_result: { endpoint: 'session_result',  scope: 'session',        columns: [['position','Finish pos'], ['driver_number','Driver #'], ['points','Points']] }
};

function buildScopedUrl(endpoint, scope) {
  const params = new URLSearchParams();
  params.set('session_key', currentSessionKey);
  if (scope === 'session_driver') params.set('driver_number', currentDriverNumber);
  return `${API_BASE}/${endpoint}?${params.toString()}`;
}

function renderTable(container, rows, columns) {
  if (!rows.length) {
    container.innerHTML = '<p class="table-empty">No data returned for this selection.</p>';
    return;
  }
  const cols = columns || Object.keys(rows[0]).map(k => [k, k]);
  const head = cols.map(([, label]) => `<th>${label}</th>`).join('');
  const body = rows.map(row => {
    const cells = cols.map(([key, , fmt]) => {
      let val = row[key];
      if (fmt === 'time') val = formatTime(val);
      if (val === null || val === undefined) val = '—';
      return `<td>${val}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  container.innerHTML = `<table class="auto-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

async function loadTableTab(tabId) {
  const config = TABLE_TABS[tabId];
  const container = document.getElementById(`table-${tabId}`);
  if (!currentSessionKey || (config.scope === 'session_driver' && !currentDriverNumber)) {
    container.innerHTML = '<p class="table-empty">Pick a session (and driver) above first.</p>';
    return;
  }

  const cacheKey = `${currentSessionKey}-${currentDriverNumber}`;
  tabCache[tabId] = tabCache[tabId] || {};
  if (tabCache[tabId][cacheKey]) {
    renderTable(container, tabCache[tabId][cacheKey], config.columns);
    return;
  }

  container.innerHTML = '<p class="table-empty">Loading…</p>';
  try {
    const url = buildScopedUrl(config.endpoint, config.scope);
    const data = await fetchJSON(url);
    tabCache[tabId][cacheKey] = data;
    renderTable(container, data, config.columns);
  } catch (err) {
    container.innerHTML = `<p class="table-empty">Couldn't load: ${err.message}</p>`;
  }
}

// ---------------------------------------------------------
// TRACK MAP (location endpoint) — bespoke, reuses selectedLap
// ---------------------------------------------------------
let trackPoints = [];        // cached points for the currently displayed lap
let trackScale = null;       // { minX, minY, scale, pad } — reused by both draw and animate
let animationFrameId = null; // requestAnimationFrame handle, so replay can be cancelled/restarted

const replayBtn = document.getElementById('replayBtn');
const replayStatus = document.getElementById('replayStatus');

async function loadTrackMap() {
  const canvas = document.getElementById('trackCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  replayBtn.disabled = true;
  replayStatus.textContent = '';
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  if (!selectedLap) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#4B4F47';
    ctx.fillText('Select a lap on the Laps tab first.', 20, 30);
    return;
  }

  const startDate = new Date(selectedLap.date_start);
  const endDate = new Date(startDate.getTime() + selectedLap.lap_duration * 1000);
  const cacheKey = `${currentSessionKey}-${currentDriverNumber}-${selectedLap.lap_number}`;
  tabCache.location = tabCache.location || {};

  let points = tabCache.location[cacheKey];
  if (!points) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#4B4F47';
    ctx.fillText('Loading track position data…', 20, 30);
    try {
      const url = `${API_BASE}/location?driver_number=${currentDriverNumber}&session_key=${currentSessionKey}` +
                  `&date>=${startDate.toISOString()}&date<=${endDate.toISOString()}`;
      points = await fetchJSON(url);
      tabCache.location[cacheKey] = points;
    } catch (err) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillText(`Couldn't load location data: ${err.message}`, 20, 30);
      return;
    }
  }

  if (!points.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#4B4F47';
    ctx.fillText('No location data available for this lap.', 20, 30);
    return;
  }

  // store elapsed-seconds-into-lap on each point, needed to pace the animation
  points = points
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(p => ({ ...p, elapsed: (new Date(p.date) - startDate) / 1000 }));

  trackPoints = points;
  computeTrackScale(canvas, points);
  drawStaticTrack(ctx, points, { faint: false });
  replayBtn.disabled = false;
  replayStatus.textContent = `${points.length} position samples — ${selectedLap.lap_duration.toFixed(1)}s real lap. Choose real time or sped up, then replay.`;
}

function computeTrackScale(canvas, points) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 30;
  const scale = Math.min(
    (canvas.width - pad * 2) / (maxX - minX || 1),
    (canvas.height - pad * 2) / (maxY - minY || 1)
  );
  trackScale = { minX, minY, scale, pad, height: canvas.height };
}

function toCanvasXY(point) {
  const { minX, minY, scale, pad, height } = trackScale;
  return {
    x: pad + (point.x - minX) * scale,
    y: height - pad - (point.y - minY) * scale // flip Y — track data is Y-up, canvas is Y-down
  };
}

function drawStaticTrack(ctx, points, { faint }) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = faint ? '#C6C1AF' : '#2B5F4D';
  ctx.lineWidth = faint ? 1.5 : 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const { x, y } = toCanvasXY(p);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const start = toCanvasXY(points[0]);
  ctx.fillStyle = '#B35E28';
  ctx.beginPath();
  ctx.arc(start.x, start.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

// Playback duration: "sped-up" is a fixed watchable length; "real-time"
// matches the actual lap duration, so a 90s lap plays back over 90s.
const SPED_UP_DURATION_MS = 6000;
let replayMode = 'sped-up';

const replayToggle = document.getElementById('replayToggle');
replayToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;
  replayMode = btn.dataset.mode;
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('is-active', b === btn));
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  replayBtn.disabled = false;
});

function replayLap() {
  if (!trackPoints.length || !trackScale) return;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  const canvas = document.getElementById('trackCanvas');
  const ctx = canvas.getContext('2d');
  const totalElapsed = trackPoints[trackPoints.length - 1].elapsed;
  const playDurationMs = replayMode === 'real-time' ? totalElapsed * 1000 : SPED_UP_DURATION_MS;
  const playStart = performance.now();

  replayBtn.disabled = true;

  function frame(now) {
    const playProgress = Math.min((now - playStart) / playDurationMs, 1);
    const lapElapsed = playProgress * totalElapsed;

    // draw faint full track, then the portion covered so far in full color
    drawStaticTrack(ctx, trackPoints, { faint: true });

    const covered = trackPoints.filter(p => p.elapsed <= lapElapsed);
    if (covered.length > 1) {
      ctx.strokeStyle = '#2B5F4D';
      ctx.lineWidth = 3;
      ctx.beginPath();
      covered.forEach((p, i) => {
        const { x, y } = toCanvasXY(p);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // moving marker at current position
    if (covered.length) {
      const current = toCanvasXY(covered[covered.length - 1]);
      ctx.fillStyle = '#B35E28';
      ctx.beginPath();
      ctx.arc(current.x, current.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    const modeLabel = replayMode === 'real-time' ? 'real time' : 'sped up';
    replayStatus.textContent = `Replaying (${modeLabel}) — ${lapElapsed.toFixed(1)}s / ${totalElapsed.toFixed(1)}s into the lap`;

    if (playProgress < 1) {
      animationFrameId = requestAnimationFrame(frame);
    } else {
      replayBtn.disabled = false;
      const modeNote = replayMode === 'real-time'
        ? `played back at real speed (${totalElapsed.toFixed(1)}s)`
        : `played back in ${(SPED_UP_DURATION_MS / 1000).toFixed(0)}s`;
      replayStatus.textContent = `Replay finished — ${totalElapsed.toFixed(1)}s real lap, ${modeNote}.`;
    }
  }

  animationFrameId = requestAnimationFrame(frame);
}

replayBtn.addEventListener('click', replayLap);

// ---------------------------------------------------------
// TEAM RADIO — bespoke, audio players
// ---------------------------------------------------------
async function loadTeamRadio() {
  const container = document.getElementById('radioList');
  if (!currentSessionKey) {
    container.innerHTML = '<p class="table-empty">Pick a session above first.</p>';
    return;
  }
  const cacheKey = currentSessionKey;
  tabCache.team_radio = tabCache.team_radio || {};
  if (tabCache.team_radio[cacheKey]) {
    renderRadio(container, tabCache.team_radio[cacheKey]);
    return;
  }
  container.innerHTML = '<p class="table-empty">Loading…</p>';
  try {
    const clips = await fetchJSON(`${API_BASE}/team_radio?session_key=${currentSessionKey}`);
    tabCache.team_radio[cacheKey] = clips;
    renderRadio(container, clips);
  } catch (err) {
    container.innerHTML = `<p class="table-empty">Couldn't load: ${err.message}</p>`;
  }
}

function renderRadio(container, clips) {
  if (!clips.length) {
    container.innerHTML = '<p class="table-empty">No team radio clips released for this session.</p>';
    return;
  }
  container.innerHTML = clips.map(c => `
    <div class="radio-item">
      <div class="radio-meta">Driver #${c.driver_number} — ${formatTime(c.date)}</div>
      <audio controls src="${c.recording_url}"></audio>
    </div>
  `).join('');
}

// ---------------------------------------------------------
// CHAMPIONSHIP (beta) — year-scoped, columns derived from data
// ---------------------------------------------------------
async function loadChampionship() {
  const driversContainer = document.getElementById('table-championship-drivers');
  const teamsContainer = document.getElementById('table-championship-teams');
  const year = yearSelect.value;

  driversContainer.innerHTML = '<p class="table-empty">Loading…</p>';
  teamsContainer.innerHTML = '<p class="table-empty">Loading…</p>';

  try {
    const [drivers, teams] = await Promise.all([
      fetchJSON(`${API_BASE}/championship_drivers?year=${year}`),
      fetchJSON(`${API_BASE}/championship_teams?year=${year}`)
    ]);
    renderTable(driversContainer, drivers, null); // null = derive columns automatically
    renderTable(teamsContainer, teams, null);
  } catch (err) {
    driversContainer.innerHTML = `<p class="table-empty">Couldn't load (beta endpoint): ${err.message}</p>`;
    teamsContainer.innerHTML = '';
  }
}

// ---------------------------------------------------------
// TAB SWITCHING
// ---------------------------------------------------------
const tabBar = document.getElementById('tabBar');

function activateTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('is-active'));
  const panel = document.getElementById(`tab-${tabId}`);
  if (panel) { panel.hidden = false; panel.classList.add('is-active'); }
  loadTabContent(tabId);
}

function loadTabContent(tabId) {
  if (tabId === 'laps') return; // already loaded via loadLaps()
  if (tabId === 'location') return loadTrackMap();
  if (tabId === 'team_radio') return loadTeamRadio();
  if (tabId === 'championship') return loadChampionship();
  if (TABLE_TABS[tabId]) return loadTableTab(tabId);
}

function refreshActiveTab() {
  const activeBtn = document.querySelector('.tab-btn.is-active');
  if (activeBtn) loadTabContent(activeBtn.dataset.tab);
}

tabBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (btn) activateTab(btn.dataset.tab);
});

// ---------------------------------------------------------
// Wire up top-level controls
// ---------------------------------------------------------
yearSelect.addEventListener('change', loadSessions);
sessionSelect.addEventListener('change', () => {
  currentSessionKey = sessionSelect.value;
  tabCache = {};
  loadDrivers();
});

loadSessions();
