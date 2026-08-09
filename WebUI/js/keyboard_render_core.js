/**
 * @purpose Core rendering utilities for the virtual piano keybed: key element creation
 * and octave-shift LCD display. Extracted from keyboard.js for modularity.
 * @classification Module/Keyboard/Render
 */

/**
 * Creates a single key DOM element with class, data attributes, and ivory texture/position.
 * Does NOT attach event listeners — those are handled in keyboard.js.
 * @param {Object} noteDef - { type: 'white'|'black', name: 'C'|'C#'|... }
 * @param {number} midiNote - Absolute MIDI note number
 * @param {number} whiteKeyIndex - Sequential white key index (1-based)
 * @returns {HTMLElement} The created key <div>
 */
window._createKeyElement = function(noteDef, midiNote, whiteKeyIndex) {
    const key = document.createElement('div');
    key.classList.add('key', noteDef.type);
    key.setAttribute('data-note', midiNote);

    if (noteDef.type === 'white') {
        if (typeof window._applyKeyIvoryTexture === 'function') {
            window._applyKeyIvoryTexture(key, midiNote);
        }
    } else {
        key.style.left = ((whiteKeyIndex - 0.6) / 28) * 100 + '%';
    }

    return key;
};

/**
 * Updates the LCD text display to show the current octave shift value.
 * @param {number} octaveShift - Current octave shift in semitones
 */
window._updateOctaveLcd = function(octaveShift) {
    const lcdText = document.getElementById('lcd-text');
    if (!lcdText) { return; }

    const sign = octaveShift > 0 ? '+' : '';
    const octaveLabel = (octaveShift / 12).toString();

    lcdText.innerHTML = '<span class=\"lcd-label\">KEYBED</span><br><strong>OCTAVE SHIFT</strong><br>'
        + '<span style=\"font-size:15px; color:var(--brand-accent);\">' + sign + octaveLabel + '</span>';

    if (typeof window.setLcdParamDisplayTimer === 'function') {
        window.setLcdParamDisplayTimer(lcdText);
    }
};
