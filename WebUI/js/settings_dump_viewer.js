/**
 * @purpose Renders unpacked hardware SysEx bytes as an interactive hex grid
 * with tooltips, region highlight overlays, and search filtering.
 * Data helpers (DUMP_REGION_COLORS, getRegionColor, formatTooltip) are in
 * settings_dump_viewer_data.js; event wiring is in settings_dump_viewer_events.js.
 * @purpose_en SysEx decoded dump viewer — hex grid renderer.
 */

function renderDumpView(bytes) {
  const grid = document.getElementById('dump-byte-grid');
  const summary = document.getElementById('dump-byte-summary');
  const nameEl = document.getElementById('dump-patch-name');
  const searchInput = document.getElementById('dump-search-input');
  if (!grid) {return;}

  if (!bytes || bytes.length < 242) {
    grid.innerHTML = '<div class="text-dim text-center" style="padding:40px">No data loaded. Load a preset or click Refresh.</div>';
    if (summary) {summary.textContent = 'No bytes loaded';}
    return;
  }

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const bm = window.BYTE_MAP || [];

  if (nameEl) {
    if (window._lastPresetName) {
      nameEl.textContent = window._lastPresetName;
    } else {
      nameEl.textContent = '—';
    }
  }

  let html = '';
  const rows = Math.ceil(bytes.length / 16);

  for (let row = 0; row < rows; row++) {
    const rowStart = row * 16;
    const rowEnd = Math.min(rowStart + 16, bytes.length);

    html += '<span style="color:var(--text-dim);margin-right:6px;opacity:0.5">' + rowStart.toString(16).toUpperCase().padStart(3,'0') + '0</span>';

    for (let i = rowStart; i < rowEnd; i++) {
      const val = bytes[i];
      const info = bm[i] || null;
      const region = info ? info.region : '?';
      const colors = getRegionColor(region);
      const tooltip = info
        ? formatTooltip(info, val)
        : 'Byte ' + i + ' — No mapping\nValue: ' + val + ' (0x' + val.toString(16).toUpperCase().padStart(2,'0') + ')';

      const matchesSearch = !searchTerm ||
        (info && info.param.toLowerCase().includes(searchTerm)) ||
        info && info.region.toLowerCase().includes(searchTerm) ||
        String(i).includes(searchTerm) ||
        val.toString(16).toUpperCase().padStart(2,'0').includes(searchTerm) ||
        val.toString().includes(searchTerm);

      const isReserved = (region === '?');
      const reservedStyle = isReserved ? ';border:1px dotted #555;' : '';
      const displayVal = isReserved
        ? '•' + val.toString(16).toUpperCase().padStart(2,'0')
        : val.toString(16).toUpperCase().padStart(2,'0');

      // Fase 3 (§4.1): tooltip entra en un atributo title → escapar contexto de atributo
      const safeTooltip = escapeHtml(tooltip);
      if (searchTerm && !matchesSearch) {
        html += '<span style="opacity:0.15;color:' + colors.fg + ';background:' + colors.bg + ';padding:1px 3px;margin:1px;border-radius:2px;cursor:default;font-size:9px' + reservedStyle + '" title="' + safeTooltip + '">' + displayVal + '</span>';
      } else {
        const highlight = searchTerm && matchesSearch ? ';outline:1px solid var(--accent-primary);outline-offset:0px' : '';
        html += '<span class="dump-byte" data-idx="' + i + '" style="color:' + colors.fg + ';background:' + colors.bg + ';padding:1px 3px;margin:1px;border-radius:2px;cursor:help;font-size:9px' + highlight + reservedStyle + '" title="' + safeTooltip + '">' + displayVal + '</span>';
      }
    }
    html += '<br>\n';
  }

  grid.innerHTML = html;

  const active = bytes.filter(function(b) { return b > 0; }).length;
  const zero = bytes.filter(function(b) { return b === 0; }).length;
  const total = bytes.length;
  const reservedCount = bytes.filter(function(_, i) {
    const info = bm[i] || null;
    return info && info.region === '?';
  }).length;

  if (summary) {
    const parts = [total + ' bytes', active + ' active', zero + ' zero'];
    if (reservedCount > 0) { parts.push('🟦 ' + reservedCount + ' reserved'); }
    summary.textContent = parts.join(' | ');
  }

  const byteEls = grid.querySelectorAll('.dump-byte');
  byteEls.forEach(function(el) {
    el.addEventListener('click', function() {
      const idx = parseInt(el.dataset.idx);
      const infoEl = document.getElementById('dump-selection-info');
      if (infoEl) {
        const val = bytes[idx];
        const info = bm[idx] || null;
        if (info) {
          infoEl.textContent = 'Selected: b[' + idx + '] ' + info.param + ' = ' + val + ' (0x' + val.toString(16).toUpperCase().padStart(2,'0') + ') [' + info.region + ']';
        } else {
          infoEl.textContent = 'Selected: b[' + idx + '] = ' + val + ' (0x' + val.toString(16).toUpperCase().padStart(2,'0') + ') [unmapped]';
        }
        el.style.outline = '2px solid var(--accent-primary)';
        setTimeout(function() { el.style.outline = ''; }, 1500);
      }
    });
  });
}

window.renderDumpView = renderDumpView;
