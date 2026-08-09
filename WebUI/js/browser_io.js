// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Fachada de browser I/O: bank loading y paste logic.
 *   - loadAllFactoryBanksNatively  → browser_io_load.js
 *   - pasteSysexFromClipboard      → browser_io_paste.js
 *   - parseSysexText, parseSysexBytes, parseSyxFile  → browser_io_parse.js
 *   - exportSinglePatch, exportBankJson  → browser_io_parse_export.js, browser_io_export.js
 */

document.addEventListener('DOMContentLoaded', function() {
    if (typeof window._wireBrowserIOEvents === 'function') {
        window._wireBrowserIOEvents();
    }
});
