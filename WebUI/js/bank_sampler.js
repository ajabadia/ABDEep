/**
 * @purpose Facade for stratified bank sampling logic.
 * Algorithmic functions (selectStratifiedPresetSample, runStratifiedBankValidation)
 * are defined in bank_sampler_algo.js. This file re-exports them.
 */

// Re-export for browser (window.*) — functions are already global from bank_sampler_algo.js
// Re-export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    const algo = require('./bank_sampler_algo.js');
    module.exports = algo;
}
