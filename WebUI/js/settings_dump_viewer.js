/**
 * @purpose Decodes, filters, and renders unpacked hardware SysEx bytes as an interactive grid with tooltips and region highlight overlays.
 * @purpose_en SysEx decoded dump viewer.
 */

const DUMP_REGION_COLORS = {
  'LFO1':    {bg:'#1a2a3a', fg:'#7fc8ff'},
  'LFO2':    {bg:'#1a2a3a', fg:'#7fc8ff'},
  'OSC1':    {bg:'#2a1a3a', fg:'#c87fff'},
  'OSC2':    {bg:'#2a1a3a', fg:'#c87fff'},
  'OSC':     {bg:'#2a1a3a', fg:'#c87fff'},
  'Noise':   {bg:'#1a1a2a', fg:'#7f7fff'},
  'Porta':   {bg:'#1a2a1a', fg:'#7fff7f'},
  'Pitch':   {bg:'#1a2a1a', fg:'#7fff7f'},
  'VCF':     {bg:'#1a3a2a', fg:'#7fffaf'},
  'HPF':     {bg:'#1a3a2a', fg:'#7fffaf'},
  'ENV1':    {bg:'#3a2a1a', fg:'#ffc87f'},
  'ENV2':    {bg:'#3a2a1a', fg:'#ffc87f'},
  'ENV3':    {bg:'#3a2a1a', fg:'#ffc87f'},
  'VCA':     {bg:'#2a3a1a', fg:'#afff7f'},
  'Voice':   {bg:'#2a1a1a', fg:'#ff7f7f'},
  'ModMat':  {bg:'#1a1a3a', fg:'#7f7fff'},
  'Seq':     {bg:'#2a2a1a', fg:'#ffff7f'},
  'SeqSteps':{bg:'#2a2a1a', fg:'#ffff7f'},
  'Arp':     {bg:'#1a2a2a', fg:'#7fffff'},
  'FX':      {bg:'#2a1a2a', fg:'#ff7fff'},
  'FX1':     {bg:'#2a1a2a', fg:'#ff7fff'},
  'FX2':     {bg:'#2a1a2a', fg:'#ff7fff'},
  'FX3':     {bg:'#2a1a2a', fg:'#ff7fff'},
  'FX4':     {bg:'#2a1a2a', fg:'#ff7fff'},
  'Name':    {bg:'#1a1a1a', fg:'#cccccc'},
  'Tail':     {bg:'#1e1a14', fg:'#998866'},
  'Firmware': {bg:'#141e28', fg:'#88aacc'},
  '?':        {bg:'#1a1a1a', fg:'#666666'},
};

const RESERVED_REGION = '?';
const DEFAULT_REGION_COLOR = {bg:'#111', fg:'#888'};

function getRegionColor(region) {
  return DUMP_REGION_COLORS[region] || DEFAULT_REGION_COLOR;
}

function formatTooltip(info, val) {
  const pct = (val / 255 * 100).toFixed(1);
  const lines = [`Byte ${info.idx} — ${info.param}`];
  lines.push(`Region: ${info.region} | Type: ${info.type}`);
  lines.push(`Value: ${val} (0x${val.toString(16).toUpperCase().padStart(2,'0')}) [${pct}%]`);
  
  if (info.type === 'toggle') {
    lines.push(`→ ${val > 0 ? 'ON (1)' : 'OFF (0)'}`);
  } else if (info.type === 'enum' && info.enumLabels) {
    const idx = Math.min(val, info.enumLabels.length - 1);
    lines.push(`→ ${info.enumLabels[idx]} (index ${idx})`);
  } else if (info.type === 'bipolar') {
    const bipolar = val - 128;
    lines.push(`→ Bipolar: ${bipolar} (center=0, range -128..+127)`);
    if (val === 128) {lines.push('→ Center (no modulation)');}
    else if (val === 0) {lines.push('→ Skip step (seq) or min');}
  } else if (info.type === 'time') {
    const secs = (val / 255 * 10).toFixed(3);
    lines.push(`→ ${secs}s`);
  } else if (info.type === 'ascii') {
    const ch = val >= 32 && val < 127 ? String.fromCharCode(val) : '·';
    lines.push(`→ '${ch}'`);
  }
  
  if (info.desc) {lines.push(`Note: ${info.desc}`);}
  
  return lines.join('\n');
}

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
    
    html += `<span style="color:var(--text-dim);margin-right:6px;opacity:0.5">${rowStart.toString(16).toUpperCase().padStart(3,'0')}0</span>`;
    
    for (let i = rowStart; i < rowEnd; i++) {
      const val = bytes[i];
      const info = bm[i] || null;
      const region = info ? info.region : '?';
      const colors = getRegionColor(region);
      const tooltip = info ? formatTooltip(info, val) : `Byte ${i} — No mapping\nValue: ${val} (0x${val.toString(16).toUpperCase().padStart(2,'0')})`;
      
      const matchesSearch = !searchTerm || 
        (info && info.param.toLowerCase().includes(searchTerm)) ||
        info && info.region.toLowerCase().includes(searchTerm) ||
        String(i).includes(searchTerm) ||
        val.toString(16).toUpperCase().padStart(2,'0').includes(searchTerm) ||
        val.toString().includes(searchTerm);
      
      const isReserved = (region === RESERVED_REGION);
      const reservedStyle = isReserved ? ';border:1px dotted #555;' : '';
      const displayVal = isReserved ? `•${val.toString(16).toUpperCase().padStart(2,'0')}` : val.toString(16).toUpperCase().padStart(2,'0');
      
      if (searchTerm && !matchesSearch) {
        html += `<span style="opacity:0.15;color:${colors.fg};background:${colors.bg};padding:1px 3px;margin:1px;border-radius:2px;cursor:default;font-size:9px${reservedStyle}" title="${tooltip}">${displayVal}</span>`;
      } else {
        const highlight = searchTerm && matchesSearch ? ';outline:1px solid var(--accent-primary);outline-offset:0px' : '';
        html += `<span class="dump-byte" data-idx="${i}" style="color:${colors.fg};background:${colors.bg};padding:1px 3px;margin:1px;border-radius:2px;cursor:help;font-size:9px${highlight}${reservedStyle}" title="${tooltip}">${displayVal}</span>`;
      }
    }
    html += '<br>\n';
  }
  
  grid.innerHTML = html;
  
  const active = bytes.filter(b => b > 0).length;
  const zero = bytes.filter(b => b === 0).length;
  const total = bytes.length;
  const reservedCount = bytes.filter((_, i) => {
    const info = bm[i] || null;
    return info && info.region === RESERVED_REGION;
  }).length;
  
  if (summary) {
    const parts = [`${total} bytes`, `${active} active`, `${zero} zero`];
    if (reservedCount > 0) {parts.push(`🟦 ${reservedCount} reserved`);}
    summary.textContent = parts.join(' | ');
  }
  
  const byteEls = grid.querySelectorAll('.dump-byte');
  byteEls.forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      const infoEl = document.getElementById('dump-selection-info');
      if (infoEl) {
        const val = bytes[idx];
        const info = bm[idx] || null;
        if (info) {
          infoEl.textContent = `Selected: b[${idx}] ${info.param} = ${val} (0x${val.toString(16).toUpperCase().padStart(2,'0')}) [${info.region}]`;
        } else {
          infoEl.textContent = `Selected: b[${idx}] = ${val} (0x${val.toString(16).toUpperCase().padStart(2,'0')}) [unmapped]`;
        }
        el.style.outline = '2px solid var(--accent-primary)';
        setTimeout(() => { el.style.outline = ''; }, 1500);
      }
    });
  });
}

function initDumpView() {
  const dumpBtn = document.querySelector('.btn[data-tab="dump"]');
  if (!dumpBtn) {return;}
  
  const refreshBtn = document.getElementById('dump-refresh-btn');
  const requestHwBtn = document.getElementById('dump-request-hw-btn');
  const searchInput = document.getElementById('dump-search-input');
  
  function refreshDump() {
    const bytes = window._lastUnpackedBytes;
    renderDumpView(bytes);
  }
  
  const requestGlobalBtn = document.getElementById('dump-request-global-btn');
  if (requestGlobalBtn) {
    requestGlobalBtn.addEventListener('click', async () => {
      const bridge = window.dualMidiBridge;
      if (!bridge) {
        alert('Bridge not initialized.');
        return;
      }
      requestGlobalBtn.disabled = true;
      requestGlobalBtn.textContent = '⏳ Requesting...';
      requestGlobalBtn.classList.add('btn-loading');
      try {
        const response = await bridge.requestMidiDump('global', 4000, 2);
        if (response && response.length >= 30) {
          console.log('[GlobalDump] ✅ Global dump received:', response.length, 'bytes');
          if (typeof window.unpack7to8 === 'function') {
            window._lastUnpackedBytes = response;
            window._lastPresetName = 'GLOBAL SETTINGS DUMP';
            renderDumpView(response);
          }
        } else {
          console.warn('[GlobalDump] No response from hardware');
        }
      } catch (err) {
        console.error('[GlobalDump] Error:', err);
      } finally {
        requestGlobalBtn.disabled = false;
        requestGlobalBtn.textContent = '🌐 Global Dump';
        requestGlobalBtn.classList.remove('btn-loading');
      }
    });
  }

  if (requestHwBtn) {
    requestHwBtn.addEventListener('click', async () => {
      const bridge = window.dualMidiBridge;
      if (!bridge) {
        alert('Bridge not initialized.');
        return;
      }
      requestHwBtn.disabled = true;
      requestHwBtn.textContent = '⏳ Requesting...';
      requestHwBtn.classList.add('btn-loading');
      try {
        const response = await bridge.requestMidiDump('edit', 4000, 2);
        if (response && response.length >= 291) {
          const packedPayload = response.slice(8, 286);
          if (typeof window.unpack7to8 === 'function') {
            const unpackedBytes = window.unpack7to8(packedPayload);
            const name = (typeof window.extractNameFromRawSysex === 'function'
                ? window.extractNameFromRawSysex(response)
                : undefined) || 'EDIT BUFFER';
            window._lastUnpackedBytes = unpackedBytes;
            window._lastPresetName = name;
            renderDumpView(unpackedBytes);
            console.log('[DumpView] ✅ Dump received and decoded:', name);
          }
        } else {
          console.warn('[DumpView] No response from hardware');
        }
      } catch (err) {
        console.error('[DumpView] Error requesting dump:', err);
      } finally {
        requestHwBtn.disabled = false;
        requestHwBtn.textContent = '⬇ Request from HW';
        requestHwBtn.classList.remove('btn-loading');
      }
    });
  }
  
  dumpBtn.addEventListener('click', () => {
    setTimeout(refreshDump, 50);
  });
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshDump);
  }
  
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshDump, 150);
    });
  }
}

window.renderDumpView = renderDumpView;
window.initDumpView = initDumpView;
