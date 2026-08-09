/**
 * @purpose Arpeggiator Control UI Helpers — LCD display helpers, enable feedback, reset button flash.
 * Extracted from arpeggiator_controls.js for SRP separation.
 */

/* global lcdSafeUpdate, setLcdParamDisplayTimer */

/**
 * Shows a select/dropdown value on the LCD with color-coded label.
 */
window._showArpSelectLcd = function(type, selectEl, names, colorClass) {
    const idx = parseInt(selectEl.value);
    const name = names[idx] || '';
    const label = type === 'arp_clock' ? 'CLOCK' : (type === 'arp_velgate' ? 'VEL GATE' : 'MODE');
    const lcd = document.getElementById('lcd-text');
    if (lcd) {
        lcd.innerHTML = '<span class="lcd-label">ARPEGGIATOR</span><br><strong class="text-accent">' + label + ': <span class="lcd-color-' + colorClass + '">' + name + '</span></strong>';
        if (typeof window.setLcdParamDisplayTimer === 'function') { window.setLcdParamDisplayTimer(lcd); }
    }
};

/**
 * Shows a generic LCD message with header, label, value and color class.
 */
window._showArpLcdMessage = function(header, label, value, colorClass) {
    const lcd = document.getElementById('lcd-text');
    if (lcd) {
        lcd.innerHTML = '<span class="lcd-label">' + header + '</span><br><strong class="text-accent">' + label + ': <span class="lcd-color-' + colorClass + '">' + value + '</span></strong>';
        if (typeof window.setLcdParamDisplayTimer === 'function') { window.setLcdParamDisplayTimer(lcd); }
    }
};

/**
 * Shows arpeggiator enable feedback on the LCD (held notes count, step info).
 */
window._showArpEnableFeedback = function() {
    window._arpLastResetTime = Date.now();
    window._arpResetCount = (window._arpResetCount || 0) + 1;
    const engine = window.dualMidiBridge._arpEngine;
    if (!engine) {return;}
    const heldNotes = engine.heldNotes.length;
    const stepIdx = engine.stepIndex;
    const bar = window._genFillBar(Math.round((heldNotes / 12) * 18), 18);
    const lcdText = document.getElementById('lcd-text');
    if (lcdText) {
        const html = window._genLcdBarHtml('arp', {
            header: 'ARPEGGIATOR RESET #' + window._arpResetCount,
            stepInfo: 'Step ' + stepIdx + ' \u00B7 ' + heldNotes + ' notes held',
            bar: bar
        });
        window.lcdSafeUpdate(lcdText, html, 'arp_enable');
    }
};

/**
 * Flashes the reset button with danger color feedback, then fades back.
 */
window._flashArpResetBtn = function(btn) {
    btn.style.transition = 'background 60ms ease-out, box-shadow 60ms ease-out';
    btn.style.background = 'color-mix(in srgb, var(--color-danger) 70%, transparent)';
    btn.style.boxShadow = '0 0 16px var(--color-danger)';
    btn.style.borderColor = 'var(--color-danger)';
    btn.style.color = 'var(--color-danger)';
    setTimeout(function() {
        btn.style.transition = 'background 300ms ease-out, box-shadow 300ms ease-out, border-color 300ms ease-out, color 300ms ease-out';
        btn.style.background = '';
        btn.style.boxShadow = '';
        btn.style.borderColor = '';
        btn.style.color = '';
        setTimeout(function() { btn.style.transition = ''; }, 320);
    }, 60);
};
