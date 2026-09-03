const lights = document.querySelectorAll('.light');
const reactionZone = document.getElementById('reactionZone');
const statusText = document.getElementById('statusText');
const startBtn = document.getElementById('startBtn');
const lastTimeEl = document.getElementById('lastTime');
const bestTimeEl = document.getElementById('bestTime');
const attemptCountEl = document.getElementById('attemptCount');

const LIGHT_STAGGER_MS = 700;       // delay between each light turning on
const MIN_DELAY_MS = 1000;          // shortest possible wait after all 5 lights are on
const MAX_DELAY_MS = 4000;          // longest possible wait — keeps the moment unpredictable

let state = 'idle';                 // idle | lighting | waiting | go | false-start
let goTimestamp = null;
let timeouts = [];
let attempts = Number(localStorage.getItem('reflex-attempts') || 0);
let personalBest = localStorage.getItem('reflex-best')
  ? Number(localStorage.getItem('reflex-best'))
  : null;

updateStatsDisplay();

function updateStatsDisplay() {
  attemptCountEl.textContent = attempts;
  bestTimeEl.textContent = personalBest !== null ? `${personalBest} ms` : '—';
}

function clearAllTimeouts() {
  timeouts.forEach(t => clearTimeout(t));
  timeouts = [];
}

function setLights(litCount) {
  lights.forEach((light, i) => {
    light.classList.toggle('is-lit', i < litCount);
  });
}

function resetRig() {
  clearAllTimeouts();
  setLights(0);
  reactionZone.classList.remove('is-armed', 'is-go', 'is-false-start');
}

function startRound() {
  resetRig();
  state = 'lighting';
  startBtn.disabled = true;
  statusText.textContent = 'Get ready…';
  reactionZone.classList.add('is-armed');

  // Light up one at a time, same pacing as a real F1 start sequence.
  for (let i = 1; i <= 5; i++) {
    const t = setTimeout(() => setLights(i), i * LIGHT_STAGGER_MS);
    timeouts.push(t);
  }

  const allLitAt = 5 * LIGHT_STAGGER_MS;
  const randomWait = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

  const t = setTimeout(() => {
    setLights(0);
    state = 'go';
    goTimestamp = performance.now();
    reactionZone.classList.remove('is-armed');
    reactionZone.classList.add('is-go');
    statusText.textContent = 'GO!';
  }, allLitAt + randomWait);
  timeouts.push(t);

  state = 'waiting';
}

function handleReactionClick() {
  if (state === 'idle') return;

  if (state === 'lighting' || state === 'waiting') {
    // Clicked before the lights went out — jump start.
    clearAllTimeouts();
    setLights(0);
    state = 'false-start';
    reactionZone.classList.remove('is-armed', 'is-go');
    reactionZone.classList.add('is-false-start');
    statusText.textContent = 'Jump start — wait for all lights to go out.';
    lastTimeEl.textContent = 'False start';
    startBtn.disabled = false;
    attempts += 1;
    localStorage.setItem('reflex-attempts', attempts);
    updateStatsDisplay();
    state = 'idle';
    return;
  }

  if (state === 'go') {
    const reaction = Math.round(performance.now() - goTimestamp);
    lastTimeEl.textContent = `${reaction} ms`;
    statusText.textContent = `${reaction} ms — press start to go again.`;
    reactionZone.classList.remove('is-go');

    attempts += 1;
    localStorage.setItem('reflex-attempts', attempts);

    if (personalBest === null || reaction < personalBest) {
      personalBest = reaction;
      localStorage.setItem('reflex-best', personalBest);
    }

    updateStatsDisplay();
    startBtn.disabled = false;
    state = 'idle';
  }
}

startBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // stop this click from also triggering reactionZone's 
  startRound();
});
reactionZone.addEventListener('click', handleReactionClick);

// Spacebar as an alternative to clicking, since a real start reaction
// is usually a button/pedal press, not a mouse click precisely.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
    e.preventDefault();
    if (!startBtn.disabled) {
      startRound();
    } else {
    handleReactionClick();
  }
});
