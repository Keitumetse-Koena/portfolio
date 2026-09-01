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
