/**
 * @purpose Gestión de temas visuales (8 temas data-theme) y persistencia en localStorage.
 * Extraído de settings.js como parte de la modularización.
 */

/**
 * Apply a theme by setting data-theme on document.body and persisting to localStorage.
 * @param {string} theme - Theme ID ('default', 'red', 'blue', 'green', 'midnight', 'dark-v2', 'light', 'juno-106')
 */
function setActiveTheme(theme) {
    if (theme === 'default') {
        delete document.body.dataset.theme;
    } else {
        document.body.dataset.theme = theme;
    }
    localStorage.setItem('abd-eep-theme', theme);
    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect) {themeSelect.value = theme;}
}

/**
 * Initialize the theme selector dropdown in Settings modal.
 * Restores saved theme from localStorage and wires the change event.
 */
function initThemeSelector() {
    const themeSelect = document.getElementById('settings-theme-select');
    if (!themeSelect) {return;}
    const savedTheme = localStorage.getItem('abd-eep-theme') || 'default';
    setActiveTheme(savedTheme);
    themeSelect.value = savedTheme;
    themeSelect.addEventListener('change', () => {
        setActiveTheme(themeSelect.value);
    });
}

/**
 * Initialize the navbar theme selector (theme-option buttons in the menu).
 */
function initNavbarThemeSelector() {
    const themeMap = {
        'menu-theme-default': 'default',
        'menu-theme-red': 'red',
        'menu-theme-blue': 'blue',
        'menu-theme-green': 'green',
        'menu-theme-midnight': 'midnight',
        'menu-theme-dark-v2': 'dark-v2',
        'menu-theme-light': 'light',
        'menu-theme-juno': 'juno-106'
    };

    document.addEventListener('click', (e) => {
        const target = e.target.closest('.theme-option');
        if (target && target.id && themeMap[target.id]) {
            e.preventDefault();
            setActiveTheme(themeMap[target.id]);
        }
    });
}

// Expose for backward compatibility and tests
window.setActiveTheme = setActiveTheme;
window.initThemeSelector = initThemeSelector;
window.initNavbarThemeSelector = initNavbarThemeSelector;
