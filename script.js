// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const siteHeader = document.querySelector('.site-header');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    const isOpen = siteHeader.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });
}

// Project log filtering
const filterChips = document.querySelectorAll('.filter-chip');
const logEntries = document.querySelectorAll('.log-entry');

filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    filterChips.forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');

    const filter = chip.dataset.filter;

    logEntries.forEach(entry => {
      const tags = entry.dataset.tags || '';
      const matches = filter === 'all' || tags.split(' ').includes(filter);
      entry.classList.toggle('is-hidden', !matches);
    });
  });
});

yearSelect.addEventListener('change', loadSessions);
sessionSelect.addEventListener('change', () => {
  currentSessionKey = sessionSelect.value;
  tabCache = {};
  loadDrivers();
});

// ---------------------------------------------------------
// Deep linking — lets the portfolio's Skills section jump
// straight into a specific tab, with a lap pre-selected where
// that's needed to actually show something on arrival.
// ---------------------------------------------------------
function autoSelectFirstLap() {
  const firstRow = document.querySelector('#lapsTableBody tr');
  if (firstRow) firstRow.click();
}

const urlParams = new URLSearchParams(window.location.search);
const deepLinkTab = urlParams.get('tab');
const deepLinkAutoload = urlParams.get('autoload') === '1';

loadSessions().then(() => {
  if (!deepLinkTab) return;
  if (deepLinkAutoload && currentLaps.length) {
    autoSelectFirstLap();
  }
  activateTab(deepLinkTab);
});