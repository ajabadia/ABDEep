/**
 * @purpose Utilidades visuales del keybed que NO pinta el componente
 * compartido: estado de los botones de octava del chasis y resolucion del color
 * del LED segun el modo del motor (arp / seq / poly chord / chord memory).
 * @classification Module/Keyboard/Render
 *
 * (La creacion de teclas, el marfil por tecla, el desplazamiento por pitch bend
 * y el display de presion viven ahora en @abdsynths/midi-keyb.)
 */

/** Update octave button visual state (color, border, glow) */
window._renderOctaveButtons = function(octUpBtn, octDownBtn, octaveShift) {
    const currentOctVal = octaveShift / 12;

    let activeColor = 'var(--color-env-vca)';
    if (Math.abs(currentOctVal) === 1) {
        activeColor = 'var(--color-env-vcf)';
    } else if (Math.abs(currentOctVal) === 2) {
        activeColor = 'var(--color-env-mod)';
    } else if (Math.abs(currentOctVal) >= 3) {
        activeColor = 'var(--color-oct-3)';
    }

    const isUpActive = currentOctVal > 0;
    const isDownActive = currentOctVal < 0;

    const applyActive = (btn) => {
        btn.style.setProperty('color', activeColor, 'important');
        btn.style.setProperty('border-color', activeColor, 'important');
        btn.style.setProperty('box-shadow', '0 0 8px ' + activeColor, 'important');
    };
    const applyInactive = (btn) => {
        btn.style.setProperty('color', 'var(--brand-accent)', 'important');
        btn.style.setProperty('border-color', 'var(--border-dim)', 'important');
        btn.style.setProperty('box-shadow', 'none', 'important');
    };

    if (octUpBtn) {
        if (isUpActive) { applyActive(octUpBtn); }
        else { applyInactive(octUpBtn); }
    }
    if (octDownBtn) {
        if (isDownActive) { applyActive(octDownBtn); }
        else { applyInactive(octDownBtn); }
    }
};

/** Resolve key LED color based on arp/seq/chord/polyChord bridge state */
window._resolveKeyLedColor = function(bridge) {
    if (!bridge) { return 'var(--brand-accent)'; }
    const cache = bridge.parameterCache;
    if (!cache) { return 'var(--brand-accent)'; }
    const arpActive = cache['arp_enable'] > 0.5;
    const seqActive = cache['seq_enable'] > 0.5;
    const chordActive = cache['chord_enable'] > 0.5;
    const polyChordActive = cache['poly_chord_enable'] > 0.5;

    if (arpActive) { return '#ff3366'; }
    if (seqActive) { return '#9933ff'; }
    if (polyChordActive) { return '#00ffcc'; }
    if (chordActive) { return '#ffcc00'; }

    if (typeof window._getScopeColors === 'function') {
        return window._getScopeColors().waveform;
    }
    return 'var(--brand-accent)';
};
