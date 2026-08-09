// WebUI/js/calibration_lab_picker.js — Patch picker bar and filter methods for CalibrationLabPage
// Extracted from calibration_lab_page.js (renderPatchPickerBar, bindPatchPickerEvents, applySharedFilters)

/* global CalibrationLabPage escapeHtml */

CalibrationLabPage.prototype.renderPatchPickerBar = function () {
  const state = window.calibrationStore.getState();
  const helpers = window.CalibrationPatchPickerHelpers;
  const bankNames = helpers ? helpers.getBankNames() : [];

  const selectedABank = state.selectedPatchA?.bankName || window.currentActiveBank || bankNames[0] || '';
  const selectedBBank = state.selectedPatchB?.bankName || window.currentActiveBank || bankNames[0] || '';

  const slotsA = helpers ? helpers.buildSlotOptions(selectedABank) : [];
  const slotsB = helpers ? helpers.buildSlotOptions(selectedBBank) : [];

  const selectedASlot = Number.isFinite(state.selectedPatchA?.patchIndex) ? state.selectedPatchA.patchIndex : 0;
  const selectedBSlot = Number.isFinite(state.selectedPatchB?.patchIndex) ? state.selectedPatchB.patchIndex : 0;

  return `
    <div class="cal-compare-bar">
      <div class="cal-compare-side">
        <div class="cal-compare-head">Patch A</div>
        <div class="flex-row gap-6">
          <select id="cal-bank-a" class="modal-select cal-bank-select">
            ${bankNames.map((name) => `
              <option value="${escapeHtml(name)}" ${name === selectedABank ? 'selected' : ''}>
                ${escapeHtml(name)}
              </option>
            `).join('')}
          </select>

          <select id="cal-slot-a" class="modal-select flex-1">
            ${slotsA.map((slot) => `
              <option value="${slot.index}" ${slot.index === selectedASlot ? 'selected' : ''} ${slot.disabled ? 'disabled' : ''}>
                ${escapeHtml(slot.label)}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="cal-compare-actions">
          <button id="cal-use-current-a" class="manager-btn" type="button">Use current</button>
          <span class="cal-picked-name">${escapeHtml(state.selectedPatchA?.name || '—')}</span>
        </div>
      </div>

      <button id="cal-swap-ab" class="manager-btn cal-btn-swap" type="button" title="Swap A ↔ B">⇄</button>

      <div class="cal-compare-side">
        <div class="cal-compare-head">Patch B</div>
        <div class="flex-row gap-6">
          <select id="cal-bank-b" class="modal-select cal-bank-select">
            ${bankNames.map((name) => `
              <option value="${escapeHtml(name)}" ${name === selectedBBank ? 'selected' : ''}>
                ${escapeHtml(name)}
              </option>
            `).join('')}
          </select>

          <select id="cal-slot-b" class="modal-select flex-1">
            ${slotsB.map((slot) => `
              <option value="${slot.index}" ${slot.index === selectedBSlot ? 'selected' : ''} ${slot.disabled ? 'disabled' : ''}>
                ${escapeHtml(slot.label)}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="cal-compare-actions">
          <button id="cal-use-current-b" class="manager-btn" type="button">Use current</button>
          <span class="cal-picked-name">${escapeHtml(state.selectedPatchB?.name || '—')}</span>
        </div>
      </div>
    </div>
  `;
};

CalibrationLabPage.prototype.bindPatchPickerEvents = function () {
  const helpers = window.CalibrationPatchPickerHelpers;
  if (!helpers) {return;}

  const bankAEl = this.querySelector('#cal-bank-a');
  const slotAEl = this.querySelector('#cal-slot-a');
  const bankBEl = this.querySelector('#cal-bank-b');
  const slotBEl = this.querySelector('#cal-slot-b');
  const useCurrentAEl = this.querySelector('#cal-use-current-a');
  const useCurrentBEl = this.querySelector('#cal-use-current-b');

  if (bankAEl) {
    bankAEl.onchange = () => {
      const bankName = bankAEl.value;
      const slotOptions = helpers.buildSlotOptions(bankName);
      const firstValid = slotOptions.find((x) => !x.disabled);
      if (firstValid) {
        helpers.setSelectedPatch('A', bankName, firstValid.index);
      } else {
        window.calibrationStore.setSelectedPatchA(null);
      }
    };
  }

  if (slotAEl) {
    slotAEl.onchange = () => {
      helpers.setSelectedPatch('A', bankAEl.value, Number(slotAEl.value));
    };
  }

  if (bankBEl) {
    bankBEl.onchange = () => {
      const bankName = bankBEl.value;
      const slotOptions = helpers.buildSlotOptions(bankName);
      const firstValid = slotOptions.find((x) => !x.disabled);
      if (firstValid) {
        helpers.setSelectedPatch('B', bankName, firstValid.index);
      } else {
        window.calibrationStore.setSelectedPatchB(null);
      }
    };
  }

  if (slotBEl) {
    slotBEl.onchange = () => {
      helpers.setSelectedPatch('B', bankBEl.value, Number(slotBEl.value));
    };
  }

  if (useCurrentAEl) {
    useCurrentAEl.onclick = () => helpers.setFromCurrent('A');
  }

  if (useCurrentBEl) {
    useCurrentBEl.onclick = () => helpers.setFromCurrent('B');
  }

  const swapBtn = this.querySelector('#cal-swap-ab');
  if (swapBtn) {
    swapBtn.onclick = () => {
      window.calibrationStore?.swapPatches();
    };
  }
};

CalibrationLabPage.prototype.applySharedFilters = function (rows, projector) {
  const store = window.calibrationStore;
  const state = store.getState();
  const search = (state.filters.search || '').trim().toLowerCase();

  return rows.filter((row) => {
    if (state.filters.showOnlyDifferences && !row.changed) {return false;}
    if (!search) {return true;}
    const hay = projector(row).toLowerCase();
    return hay.includes(search);
  });
};
