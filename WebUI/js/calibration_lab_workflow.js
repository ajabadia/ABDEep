/**
 * @purpose Facade for Calibration Lab workflow. Actual implementation in:
 *          - calibration_lab_workflow_render.js  (renderBankRunList, renderWorkflowDrawer)
 *          - calibration_lab_workflow_events.js  (bindBankRunControls, bindWorkflowEvents, etc.)
 * @classification Module/Calibration/Workflow/Facade
 * @dependencies calibration_lab_page.js (defines CalibrationLabPage)
 */

// Custom element registration (must happen after all prototype methods are attached)
if (typeof window !== 'undefined') {
  customElements.define('calibration-lab-page', CalibrationLabPage);
}
