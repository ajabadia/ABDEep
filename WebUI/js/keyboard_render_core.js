/**
 * @purpose LCD del desplazamiento de octava (el resto de la utilidad de render
 * del keybed —creacion de teclas— la cubre el componente compartido).
 * @classification Module/Keyboard/Render
 */

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
