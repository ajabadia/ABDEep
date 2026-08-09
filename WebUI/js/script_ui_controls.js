/**
 * @purpose Facade that initializes all interactive UI controls.
 * @purpose_en Delegates to: sliders, selectors, LEDs, and MIDI router sub-modules.
 * @see script_ui_sliders.js   — V-Slider drag + position + preset sync
 * @see script_ui_selectors.js — LFO/OSC/ENV selector buttons
 * @see script_ui_leds.js      — LED click handlers
 * @see script_ui_midi.js      — MIDI parameter router + HPF/VCA + hex byte
 */

/* global initSliders, initSelectors, initLeds, initMidiRouter */

// ── INIT UI CONTROLS (facade) ──
// eslint-disable-next-line no-unused-vars -- called from script.js via window.*
function initUIControls() {
    initSliders();
    initSelectors();
    initLeds();
    initMidiRouter();
}

window.initUIControls = initUIControls;
