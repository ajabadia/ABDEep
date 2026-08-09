/**
 * @purpose LED click handlers for binary parameter toggles.
 * @purpose_en Click-to-toggle LED indicators with bridge parameter updates.
 */

// ── INIT LEDS ──
// eslint-disable-next-line no-unused-vars -- called from initUIControls
function initLeds() {
    // LED click handlers
    document.querySelectorAll('.led').forEach(function (led) {
        const parent = led.closest('[data-param]');
        if (!parent) {return;}
        const paramId = parent.getAttribute('data-param');
        led.addEventListener('click', function () {
            const active = led.classList.toggle('active');
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, active ? 1.0 : 0.0);
            }
        });
    });
}
