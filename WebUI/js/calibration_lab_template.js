/**
 * @purpose Calibration Lab modal HTML template.
 * Extracted from calibration_lab_page.js template() method.
 * Returns the full modal HTML string for the CalibrationLabPage custom element.
 */

window._getCalibrationLabTemplate = function() {
    return `
      <div class="modal-backdrop hidden" id="cal-modal-backdrop">
        <div class="modal cal-modal-wide flex-col">
          <div class="modal-header">
            <h2>Calibration Lab</h2>
            <div class="cal-header-actions">
              <button id="cal-export-json-btn" class="manager-btn" type="button" title="Export session as JSON">📄 JSON</button>
              <button id="cal-export-csv-btn" class="manager-btn" type="button" title="Export run as CSV">📊 CSV</button>
              <button id="cal-export-pdf-btn" class="manager-btn" type="button" title="Export report as PDF">📑 PDF</button>
              <button id="cal-export-syx-btn" class="manager-btn" type="button" title="Export current patch .syx">💾 .SYX</button>
              <span id="cal-export-feedback" class="cal-export-feedback"></span>
            </div>
            <div class="close-btn" id="cal-close-btn">&times;</div>
          </div>
          <div class="modal-body cal-modal-body">

            <!-- Left: compare pane -->
            <section class="cal-page cal-page-flex">
              <div class="cal-header">
                <div>
                  <h2 class="cal-title cal-title-hidden">Calibration Lab</h2>
                  <div class="cal-subtitle">Raw / Semantic / PatchDiff / Engine / Effective</div>
                </div>

                <div class="cal-toolbar">
                  <label class="cal-inline">
                    <span>Voice</span>
                    <select id="cal-voice-select" class="modal-select">
                      ${Array.from({ length: 12 }).map((_, i) => `<option value="${i}">Voice ${i + 1}</option>`).join('')}
                    </select>
                  </label>

                  <button id="cal-refresh-btn" class="manager-btn btn-solid" type="button">Refresh</button>
                </div>
              </div>

              <div id="cal-picker-mount"></div>

              <div class="cal-status-row">
                <span id="cal-status-text" class="cal-status">Idle</span>
              </div>

              <div class="cal-tabs">
                <button class="cal-tab active" data-cal-tab="patchdiff" type="button">PatchDiff</button>
                <button class="cal-tab" data-cal-tab="raw" type="button">Raw</button>
                <button class="cal-tab" data-cal-tab="semantic" type="button">Semantic</button>
                <button class="cal-tab" data-cal-tab="engine" type="button">Engine</button>
                <button class="cal-tab" data-cal-tab="effective" type="button">Effective</button>
                <button class="cal-tab" data-cal-tab="audio-ab" type="button">Audio A/B</button>
                <button class="cal-tab" data-cal-tab="roundtrip" type="button">RoundTrip</button>
                <button class="cal-tab" data-cal-tab="live" type="button">Live</button>
              </div>

              <div class="cal-filters cal-filters-mb">
                <label class="cal-inline">
                  <input id="cal-filter-diff" type="checkbox" />
                  <span>Only differences</span>
                </label>
                <label class="cal-inline">
                  <input id="cal-filter-critical" type="checkbox" />
                  <span>Only critical</span>
                </label>
                <label class="cal-inline">
                  <input id="cal-filter-aliases" type="checkbox" />
                  <span>Only aliases</span>
                </label>
                <input id="cal-search-input" class="modal-input" type="text" placeholder="Search paramId / offset" />
              </div>

              <div id="cal-summary-mount"></div>

              <div id="cal-panel" class="cal-panel cal-panel-flex"></div>
            </section>

            <!-- Right: Bank Run + Workflow pane -->
            <aside class="cal-side-pane">
              <!-- CL-08: Stratified Bank Run -->
              <div class="cal-run-section">
                <div class="cal-run-header" id="cal-run-toggle">
                  <span class="cal-run-title">⚙ Stratified Bank Run</span>
                  <span class="cal-run-toggle-icon" id="cal-run-icon">▶</span>
                </div>
                <div id="cal-run-controls" class="cal-run-controls hidden">
                  <div class="cal-run-field">
                    <label class="cal-run-label">Sample size</label>
                    <input id="cal-run-size" type="number" class="modal-input cal-input-w64" value="24" min="1" max="128" />
                  </div>
                  <div class="cal-run-field">
                    <label class="cal-run-label">Seed</label>
                    <input id="cal-run-seed" type="number" class="modal-input cal-input-w64" value="42" min="0" />
                  </div>
                  <div class="cal-run-field">
                    <label class="cal-run-label">Category filter</label>
                    <input id="cal-run-category" type="text" class="modal-input cal-input-full" placeholder="e.g. bass" />
                  </div>
                  <div class="cal-run-field">
                    <label class="cal-inline">
                      <input id="cal-run-favonly" type="checkbox" />
                      <span>Favorites only</span>
                    </label>
                  </div>
                  <div class="cal-run-field">
                    <label class="cal-inline">
                      <input id="cal-run-critical" type="checkbox" />
                      <span>Critical only</span>
                    </label>
                  </div>
                  <button id="cal-run-generate" class="manager-btn btn-solid cal-btn-full" type="button">Generate Run</button>
                  <button id="cal-run-clear" class="manager-btn cal-btn-full" type="button">Clear Run</button>
                </div>
              </div>

              <!-- CL-08d: Run results list -->
              <div id="cal-run-list-mount" class="cal-run-list-mount"></div>

              <!-- CL-09: Workflow Drawer -->
              <div id="cal-workflow-mount" class="cal-workflow-mount"></div>
            </aside>

          </div>
        </div>
      </div>
    `;
};
