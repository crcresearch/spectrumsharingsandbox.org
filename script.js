document.addEventListener('DOMContentLoaded', () => {
  highlightActiveNav();
  initDataBrowser();
  initDataAdmin();
});

function highlightActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === 'index.html' && href === './')) {
      link.classList.add('active');
    }
  });
}

/* ========================================================================
 * Shared helpers
 * ======================================================================*/

function fetchDatasets(src) {
  return fetch(src, { cache: 'no-cache' }).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${src}`);
    return res.json();
  }).then(data => {
    if (!Array.isArray(data)) throw new Error('Dataset file must be a JSON array.');
    return data;
  });
}

function collectUnique(items, getter) {
  const set = new Set();
  items.forEach(item => (getter(item) || []).forEach(v => set.add(v)));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function toggleInSet(set, value, checked) {
  if (checked) set.add(value);
  else set.delete(value);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseDate(value) {
  if (!value) return null;
  const normalized = String(value).replace(' ', 'T');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function formatRange(r) {
  const start = parseDate(r.start);
  const end = parseDate(r.end);
  if (!start || !end) return '';
  const fmt = d => d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return `${fmt(start)} → ${fmt(end)}`;
}

function matchesFilters(d, state) {
  if (state.search) {
    const haystack = [
      d.title, d.desc, d.full_data_desc,
      ...(d.tags || []), ...(d.data_types || []),
    ].join(' ').toLowerCase();
    if (!haystack.includes(state.search)) return false;
  }

  if (state.selectedDataTypes.size > 0) {
    const dts = new Set(d.data_types || []);
    for (const needed of state.selectedDataTypes) {
      if (!dts.has(needed)) return false;
    }
  }

  if (state.selectedTags.size > 0) {
    const tags = new Set(d.tags || []);
    for (const needed of state.selectedTags) {
      if (!tags.has(needed)) return false;
    }
  }

  if (state.dateStart || state.dateEnd) {
    const ranges = (d.date_ranges || []).map(r => ({
      start: parseDate(r.start),
      end: parseDate(r.end),
    })).filter(r => r.start && r.end);
    if (ranges.length === 0) return false;
    const overlaps = ranges.some(r =>
      (!state.dateEnd || r.start <= state.dateEnd) &&
      (!state.dateStart || r.end >= state.dateStart)
    );
    if (!overlaps) return false;
  }

  return true;
}

function renderFilterOptions(datasets, containers, state, onChange) {
  const dataTypes = collectUnique(datasets, d => d.data_types);
  const tags = collectUnique(datasets, d => d.tags);

  containers.dataTypes.replaceChildren(...dataTypes.map(value =>
    makeCheckbox('dt', value, state.selectedDataTypes.has(value), checked => {
      toggleInSet(state.selectedDataTypes, value, checked);
      onChange();
    })
  ));

  containers.tags.replaceChildren(...tags.map(value =>
    makeCheckbox('tag', value, state.selectedTags.has(value), checked => {
      toggleInSet(state.selectedTags, value, checked);
      onChange();
    })
  ));
}

function makeCheckbox(namePrefix, value, checked, onChange) {
  const id = `${namePrefix}-${slug(value)}`;
  const label = document.createElement('label');
  label.className = 'checkbox-pill';
  label.setAttribute('for', id);

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.value = value;
  input.checked = checked;
  input.addEventListener('change', e => onChange(e.target.checked));

  const text = document.createElement('span');
  text.textContent = value;

  label.append(input, text);
  return label;
}

function renderDatasetCard(d, options = {}) {
  const card = document.createElement('article');
  card.className = 'dataset-card';

  const title = document.createElement('h3');
  title.className = 'dataset-title';
  title.textContent = d.title || 'Untitled dataset';
  card.appendChild(title);

  if (d.desc) {
    const desc = document.createElement('p');
    desc.className = 'dataset-desc';
    desc.textContent = d.desc;
    card.appendChild(desc);
  }

  if (d.full_data_desc && !/^\/\//.test(d.full_data_desc.trim())) {
    const details = document.createElement('details');
    details.className = 'dataset-details';
    const summary = document.createElement('summary');
    summary.textContent = 'More details';
    const body = document.createElement('p');
    body.textContent = d.full_data_desc;
    details.append(summary, body);
    card.appendChild(details);
  }

  const meta = document.createElement('dl');
  meta.className = 'dataset-meta';

  if (Array.isArray(d.date_ranges) && d.date_ranges.length) {
    meta.append(
      makeTerm('Date ranges'),
      makeDef(d.date_ranges.map(formatRange).filter(Boolean).join(' • ') || '—'),
    );
  }
  if (Array.isArray(d.data_types) && d.data_types.length) {
    meta.append(makeTerm('Data types'), makeBadgeList(d.data_types, 'tag-data'));
  }
  if (Array.isArray(d.tags) && d.tags.length) {
    meta.append(makeTerm('Tags'), makeBadgeList(d.tags, 'tag-general'));
  }
  card.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'dataset-actions';

  if (d.link) {
    const a = document.createElement('a');
    a.href = d.link;
    a.className = 'btn-download';
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Download dataset';
    actions.appendChild(a);
  }

  (options.actions || []).forEach(action => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = action.className || 'btn-secondary';
    btn.textContent = action.label;
    btn.addEventListener('click', () => action.onClick(d));
    actions.appendChild(btn);
  });

  if (actions.children.length) card.appendChild(actions);
  return card;
}

function makeTerm(text) {
  const dt = document.createElement('dt');
  dt.textContent = text;
  return dt;
}

function makeDef(content) {
  const dd = document.createElement('dd');
  if (content instanceof Node) dd.appendChild(content);
  else dd.textContent = content;
  return dd;
}

function makeBadgeList(values, cssClass) {
  const dd = document.createElement('dd');
  const list = document.createElement('ul');
  list.className = 'badge-list';
  values.forEach(v => {
    const li = document.createElement('li');
    li.className = `badge-tag ${cssClass}`;
    li.textContent = v;
    list.appendChild(li);
  });
  dd.appendChild(list);
  return dd;
}

function createFilterState() {
  return {
    search: '',
    selectedDataTypes: new Set(),
    selectedTags: new Set(),
    dateStart: null,
    dateEnd: null,
  };
}

function wireFilterInputs(state, els, onChange) {
  els.search.addEventListener('input', () => {
    state.search = els.search.value.trim().toLowerCase();
    onChange();
  });
  els.dateStart.addEventListener('change', () => {
    state.dateStart = els.dateStart.value ? new Date(els.dateStart.value + 'T00:00:00') : null;
    onChange();
  });
  els.dateEnd.addEventListener('change', () => {
    state.dateEnd = els.dateEnd.value ? new Date(els.dateEnd.value + 'T23:59:59') : null;
    onChange();
  });
  els.clear.addEventListener('click', () => {
    state.search = '';
    state.selectedDataTypes.clear();
    state.selectedTags.clear();
    state.dateStart = null;
    state.dateEnd = null;
    els.search.value = '';
    els.dateStart.value = '';
    els.dateEnd.value = '';
    els.dataTypes.querySelectorAll('input[type="checkbox"]').forEach(c => (c.checked = false));
    els.tags.querySelectorAll('input[type="checkbox"]').forEach(c => (c.checked = false));
    onChange();
  });
}

/* ========================================================================
 * Public Data Browser
 * ======================================================================*/

function initDataBrowser() {
  const root = document.getElementById('data-browser');
  if (!root) return;

  const src = root.dataset.src || 'data/datasets.json';
  const state = createFilterState();
  state.datasets = [];

  const els = {
    search: document.getElementById('db-search'),
    dateStart: document.getElementById('db-date-start'),
    dateEnd: document.getElementById('db-date-end'),
    clear: document.getElementById('db-clear'),
    dataTypes: document.getElementById('db-data-types'),
    tags: document.getElementById('db-tags'),
    results: document.getElementById('db-results'),
    count: document.getElementById('db-result-count'),
    empty: document.getElementById('db-empty'),
    error: document.getElementById('db-error'),
    errorMsg: document.getElementById('db-error-message'),
  };

  const render = () => {
    const filtered = state.datasets.filter(d => matchesFilters(d, state));
    els.count.textContent = `${filtered.length} dataset${filtered.length === 1 ? '' : 's'} shown of ${state.datasets.length}`;
    els.empty.hidden = filtered.length !== 0;
    els.error.hidden = true;
    els.results.replaceChildren(...filtered.map(d => renderDatasetCard(d)));
  };

  fetchDatasets(src).then(data => {
    state.datasets = data;
    renderFilterOptions(state.datasets, { dataTypes: els.dataTypes, tags: els.tags }, state, render);
    wireFilterInputs(state, els, render);
    render();
  }).catch(err => {
    console.error(err);
    els.count.textContent = '';
    els.error.hidden = false;
    els.errorMsg.textContent = err.message;
  });
}

/* ========================================================================
 * Data Admin (unlisted)
 * ======================================================================*/

function initDataAdmin() {
  const root = document.getElementById('data-admin');
  if (!root) return;

  const src = root.dataset.src || 'data/datasets.json';
  const state = createFilterState();
  state.datasets = [];

  const els = {
    search: document.getElementById('adm-search'),
    dateStart: document.getElementById('adm-date-start'),
    dateEnd: document.getElementById('adm-date-end'),
    clear: document.getElementById('adm-clear'),
    dataTypes: document.getElementById('adm-data-types'),
    tags: document.getElementById('adm-tags'),
    results: document.getElementById('adm-results'),
    count: document.getElementById('adm-result-count'),
    empty: document.getElementById('adm-empty'),
    error: document.getElementById('adm-error'),
    errorMsg: document.getElementById('adm-error-message'),
    addBtn: document.getElementById('adm-add'),
    downloadBtn: document.getElementById('adm-download'),
    reloadBtn: document.getElementById('adm-reload'),
    modal: document.getElementById('adm-modal'),
    modalTitle: document.getElementById('adm-modal-title'),
    form: document.getElementById('adm-form'),
    dateRangeList: document.getElementById('adm-date-ranges'),
    addRangeBtn: document.getElementById('adm-add-range'),
    formDataTypes: document.getElementById('adm-form-data-types'),
    formTags: document.getElementById('adm-form-tags'),
  };

  const renderList = () => {
    const filtered = state.datasets.filter(d => matchesFilters(d, state));
    els.count.textContent = `${filtered.length} dataset${filtered.length === 1 ? '' : 's'} shown of ${state.datasets.length}`;
    els.empty.hidden = filtered.length !== 0;
    els.error.hidden = true;
    els.results.replaceChildren(...filtered.map(d => renderDatasetCard(d, {
      actions: [
        { label: 'Edit', className: 'btn-secondary', onClick: target => openEditModal(target) },
        { label: 'Delete', className: 'btn-danger', onClick: target => confirmDelete(target) },
      ],
    })));
  };

  const refreshFilterOptions = () => {
    renderFilterOptions(state.datasets, { dataTypes: els.dataTypes, tags: els.tags }, state, renderList);
  };

  const renderAll = () => {
    refreshFilterOptions();
    renderList();
  };

  const confirmDelete = (target) => {
    if (!confirm(`Delete "${target.title || 'this dataset'}"? This only affects your in-browser working copy.`)) return;
    const idx = state.datasets.indexOf(target);
    if (idx >= 0) {
      state.datasets.splice(idx, 1);
      renderAll();
    }
  };

  const loadFromFile = () => {
    els.count.textContent = 'Loading datasets…';
    fetchDatasets(src).then(data => {
      state.datasets = data;
      renderAll();
    }).catch(err => {
      console.error(err);
      els.count.textContent = '';
      els.error.hidden = false;
      els.errorMsg.textContent = err.message;
    });
  };

  loadFromFile();
  wireFilterInputs(state, els, renderList);

  els.addBtn.addEventListener('click', () => openAddModal());
  els.downloadBtn.addEventListener('click', () => downloadConfiguration(state.datasets));
  els.reloadBtn.addEventListener('click', () => {
    if (confirm('Discard all in-browser changes and reload from the server file?')) {
      loadFromFile();
    }
  });

  /* ---------- Modal ---------- */

  let editingTarget = null;

  const openAddModal = () => {
    editingTarget = null;
    els.modalTitle.textContent = 'Add new dataset';
    populateForm({});
    showModal();
  };

  const openEditModal = (target) => {
    editingTarget = target;
    els.modalTitle.textContent = 'Edit dataset';
    populateForm(target);
    showModal();
  };

  const showModal = () => {
    els.modal.hidden = false;
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const firstInput = els.form.querySelector('input, textarea');
    if (firstInput) firstInput.focus();
  };

  const hideModal = () => {
    els.modal.hidden = true;
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    editingTarget = null;
  };

  els.modal.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', hideModal);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.modal.hidden) hideModal();
  });

  els.addRangeBtn.addEventListener('click', () => addDateRangeRow(els.dateRangeList, '', ''));

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const record = readForm();
    if (!record) return;

    if (editingTarget) {
      Object.keys(editingTarget).forEach(k => delete editingTarget[k]);
      Object.assign(editingTarget, record);
    } else {
      state.datasets.push(record);
    }
    hideModal();
    renderAll();
  });

  const populateForm = (d) => {
    els.form.reset();
    els.form.elements.title.value = d.title || '';
    els.form.elements.desc.value = d.desc || '';
    els.form.elements.full_data_desc.value = d.full_data_desc || '';
    els.form.elements.link.value = d.link || '';

    els.dateRangeList.replaceChildren();
    const ranges = Array.isArray(d.date_ranges) && d.date_ranges.length ? d.date_ranges : [{ start: '', end: '' }];
    ranges.forEach(r => addDateRangeRow(els.dateRangeList, r.start || '', r.end || ''));

    renderChipInput(els.formDataTypes, d.data_types || []);
    renderChipInput(els.formTags, d.tags || []);
  };

  const readForm = () => {
    const f = els.form.elements;
    const title = f.title.value.trim();
    const desc = f.desc.value.trim();
    const link = f.link.value.trim();

    if (!title || !desc || !link) {
      alert('Title, short description, and download link are required.');
      return null;
    }

    const date_ranges = [];
    els.dateRangeList.querySelectorAll('.date-range-row').forEach(row => {
      const start = row.querySelector('input[name="range-start"]').value.trim();
      const end = row.querySelector('input[name="range-end"]').value.trim();
      if (start || end) date_ranges.push({ start, end });
    });

    return {
      title,
      desc,
      full_data_desc: f.full_data_desc.value.trim(),
      link,
      date_ranges,
      data_types: readChipInput(els.formDataTypes),
      tags: readChipInput(els.formTags),
    };
  };
}

/* ---------- Date range row ---------- */

function addDateRangeRow(container, start, end) {
  const row = document.createElement('div');
  row.className = 'date-range-row';

  const startInput = document.createElement('input');
  startInput.type = 'text';
  startInput.name = 'range-start';
  startInput.placeholder = 'Start (YYYY-MM-DD HH:MM:SS±HHMM)';
  startInput.value = start;

  const endInput = document.createElement('input');
  endInput.type = 'text';
  endInput.name = 'range-end';
  endInput.placeholder = 'End (YYYY-MM-DD HH:MM:SS±HHMM)';
  endInput.value = end;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-link btn-remove';
  removeBtn.setAttribute('aria-label', 'Remove date range');
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => row.remove());

  row.append(startInput, endInput, removeBtn);
  container.appendChild(row);
}

/* ---------- Chip input ---------- */

function renderChipInput(container, values) {
  container.replaceChildren();

  const chipList = document.createElement('div');
  chipList.className = 'chip-list';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chip-entry';
  input.placeholder = 'Type and press Enter';

  const addChip = (value) => {
    const v = String(value).trim();
    if (!v) return;
    if ([...chipList.children].some(c => c.dataset.value === v)) return;
    chipList.appendChild(makeChip(v));
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && input.value === '' && chipList.lastElementChild) {
      chipList.lastElementChild.remove();
    }
  });
  input.addEventListener('blur', () => {
    if (input.value.trim()) {
      addChip(input.value);
      input.value = '';
    }
  });

  values.forEach(addChip);
  container.append(chipList, input);
}

function makeChip(value) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.dataset.value = value;

  const text = document.createElement('span');
  text.textContent = value;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'chip-remove';
  remove.setAttribute('aria-label', `Remove ${value}`);
  remove.textContent = '×';
  remove.addEventListener('click', () => chip.remove());

  chip.append(text, remove);
  return chip;
}

function readChipInput(container) {
  return [...container.querySelectorAll('.chip')].map(c => c.dataset.value);
}

/* ---------- Download ---------- */

function downloadConfiguration(datasets) {
  const json = JSON.stringify(datasets, null, 2) + '\n';
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'datasets.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
