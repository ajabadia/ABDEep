// WebUI/js/calibration_lab_utils.js — Facade / Aggregator
// Functions extracted to: calibration_lab_format.js, calibration_lab_patchdiff.js, calibration_lab_validation.js
// In browser: load all 3 scripts via <script> tags before this file
// In Node.js tests: require() this file to trigger all sub-module loads

if (typeof module !== 'undefined' && module.exports) {
  // Node.js: load sub-modules to trigger globalThis assignments
  require('./calibration_lab_format.js');
  require('./calibration_lab_patchdiff.js');
  require('./calibration_lab_validation.js');
}
