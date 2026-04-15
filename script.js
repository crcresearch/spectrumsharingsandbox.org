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

  // CBRS status loading
  const cbrsRows = document.querySelectorAll('#cbrs-table tbody tr');
  if (cbrsRows.length) {
    fetch('https://raw.githubusercontent.com/crcresearch/spectrumsharingsandbox.org/refs/heads/master/latest-cbrs.json')
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      const lastUpdateLabel = document.querySelector('#cbrs-update');
      if (lastUpdateLabel) {
        lastUpdateLabel.innerText = new Date(data.timestamp);
      }
      appendCbrsData(data.enodebs, cbrsRows);
    })
    .catch(function (err) {
      console.log('error: ' + err);
    });
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

const opStatusDict = {
  0: "<span class='status-disabled'>Unknown</span>",
  1: "<span class='status-attn'>New</span>",
  2: "<span class='status-attn'>Pending</span>",
  3: "<span class='status-attn'>Provisioned</span>",
  4: "<span class='status-online'>Up</span>",
  5: "<span class='status-offline'>Down</span>",
  6: "<span class='status-attn'>Deployed</span>",
}

function appendCbrsData(enodebArr, cbrsRows) {
  for (const row of cbrsRows) {
    const enodebName = row.children[0].innerText;
    const enodeb = enodebArr.find((element) => element.name.toUpperCase() === enodebName);
    if (enodeb) {
      row.children[3].innerHTML = `${enodeb.neutral_host_enabled ? "Yes" : "No"}`;
      row.children[4].innerHTML = enodeb.current_radio_technology_label;
      const radioCount = enodeb.radios.length;
      if (radioCount === 0) {
        row.children[5].innerHTML = "Unknown";
        row.children[6].innerHTML = opStatusDict[0];
      } else {
        let bw = enodeb.radios[0].channel_bandwidth;
        if (enodeb.current_radio_technology_label === "4G") {
          bw = bw / 5
        }
        row.children[5].innerHTML = `[${enodeb.radios[0].pci}] ${enodeb.radios[0].frequency_dl} – ${bw}`;
        row.children[6].innerHTML = opStatusDict[enodeb.radios[0].op_status];

        if (radioCount === 2) {
          row.children[0].rowSpan = 2;
          row.children[0].scope = "rowgroup";
          row.children[1].rowSpan = 2;
          row.children[2].rowSpan = 2;
          row.children[3].rowSpan = 2;
          row.children[4].rowSpan = 2;

          const tr = document.createElement("tr");
          let bw1 = enodeb.radios[1].channel_bandwidth;
          if (enodeb.current_radio_technology_label === "4G") {
            bw1 = bw1 / 5
          }
          const tdChannel = document.createElement("td");
          tdChannel.innerHTML = `[${enodeb.radios[1].pci}] ${enodeb.radios[1].frequency_dl} – ${bw1}`;
          tr.appendChild(tdChannel);
          const tdStatus = document.createElement("td");
          tdStatus.innerHTML = opStatusDict[enodeb.radios[1].op_status];
          tr.appendChild(tdStatus);
          row.insertAdjacentElement("afterend", tr);
        }
      }
    }
  }
}
