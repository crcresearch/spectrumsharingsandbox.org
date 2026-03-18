document.addEventListener('DOMContentLoaded', () => {
  // Highlight active nav link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === 'index.html' && href === './')) {
      link.classList.add('active');
    }
  });

  // Data Browser filtering
  const filters = document.querySelectorAll('.filter-bar select');
  if (filters.length) {
    filters.forEach(f => f.addEventListener('change', applyFilters));
  }
});

function applyFilters() {
  const band = document.getElementById('filter-band')?.value || 'all';
  const location = document.getElementById('filter-location')?.value || 'all';
  const env = document.getElementById('filter-env')?.value || 'all';
  const dtype = document.getElementById('filter-dtype')?.value || 'all';

  document.querySelectorAll('#data-table tbody tr').forEach(row => {
    const matchBand = band === 'all' || row.dataset.band === band;
    const matchLoc = location === 'all' || row.dataset.location === location;
    const matchEnv = env === 'all' || row.dataset.env === env;
    const matchType = dtype === 'all' || row.dataset.dtype === dtype;
    row.style.display = (matchBand && matchLoc && matchEnv && matchType) ? '' : 'none';
  });

  const visible = document.querySelectorAll('#data-table tbody tr:not([style*="display: none"])').length;
  const counter = document.getElementById('result-count');
  if (counter) counter.textContent = `${visible} dataset${visible !== 1 ? 's' : ''} shown`;
}
