/**
 * @purpose DeepMind 12 effect type theme colors and helper functions.
 * Extracted from effects_templates.js.
 */

/**
 * Maps each DeepMind 12 effect type to its UI theme colors.
 * Used to generate the --fx-bg, --fx-border and --fx-text CSS variables
 * applied dynamically to every effect template.
 * @type {Object.<number, {bg: string, border: string, text: string}>}
 */
const FX_THEME_COLORS = {
    1:  { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    2:  { bg: '#2c3545', border: '#3d4a60', text: '#fff' },
    3:  { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    4:  { bg: '#050000', border: '#ff2200', text: '#ff2200' },
    5:  { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    6:  { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    7:  { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    8:  { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    9:  { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    10: { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    11: { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    12: { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    13: { bg: 'var(--bg-elevated)', border: '#2d3035', text: '#fff' },
    14: { bg: '#1b364a', border: '#285474', text: '#fff' },
    15: { bg: '#c2a15f', border: '#d4b87e', text: '#000' },
    16: { bg: '#202830', border: '#303b47', text: '#fff' },
    17: { bg: '#4d6d63', border: '#5a7f73', text: '#fff' },
    18: { bg: '#333', border: 'var(--border-dim)', text: '#fff' },
    19: { bg: '#e0e0e0', border: '#ccc', text: '#000' },
    20: { bg: '#10a174', border: '#14be8a', text: '#fff' },
    21: { bg: '#a82020', border: '#c03030', text: '#000' },
    22: { bg: '#1c2430', border: '#2d3848', text: '#fff' },
    23: { bg: '#1c2430', border: '#2d3848', text: '#fff' },
    24: { bg: '#1c2430', border: '#2d3848', text: '#fff' },
    25: { bg: '#d2e5e9', border: '#b8d4dc', text: '#000' },
    31: { bg: '#135634', border: '#1a7245', text: '#fff' },
    32: { bg: '#1c1d20', border: '#00ccff', text: '#fff' },
    33: { bg: '#25272b', border: '#3d4147', text: '#fff' },
    34: { bg: '#25272b', border: '#3d4147', text: '#fff' },
    35: { bg: '#502419', border: '#6b3528', text: '#fff' }
};

/**
 * Returns the theme definition for the given effect type.
 * Falls back to a neutral theme for unknown/bypass effect types.
 * @param {number} effectType
 * @returns {{bg: string, border: string, text: string}}
 */
function _getFxTheme(effectType) {
    return FX_THEME_COLORS[effectType] || { bg: 'var(--bg-elevated)', border: 'var(--border-dim)', text: 'var(--text-primary)' };
}

/**
 * Builds the inline style string that injects the effect theme CSS variables.
 * @param {number} effectType
 * @returns {string}
 */
function _fxThemeStyle(effectType) {
    const t = _getFxTheme(effectType);
    return `--fx-bg: ${t.bg}; --fx-border: ${t.border}; --fx-text: ${t.text};`;
}

// Export to window for cross-file access (used by all effects_renderers_*.js)
window._getFxTheme = _getFxTheme;
window._fxThemeStyle = _fxThemeStyle;
