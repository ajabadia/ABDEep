/**
 * @purpose Active-parameter selector buttons: LFO, OSC, and Envelope switchers.
 * @purpose_en LFO 1/2, OSC 1/2, and ENV 1/2/3 selector button click handlers.
 */

// ── INIT SELECTORS ──
// eslint-disable-next-line no-unused-vars -- called from initUIControls
function initSelectors() {
    // ACTIVE LFO SWITCHER
    let activeLfoNumber = 1;
    const lfoSelectBtn = document.getElementById('lfo-select-btn');
    if (lfoSelectBtn) {
        lfoSelectBtn.classList.add('lfo-select-btn');
        lfoSelectBtn.addEventListener('click', function () {
            activeLfoNumber = activeLfoNumber === 1 ? 2 : 1;
            lfoSelectBtn.innerText = 'LFO ' + activeLfoNumber + ' ACTIVE';

            const rateUnit = document.getElementById('lfo-ctrl-rate');
            const delayUnit = document.getElementById('lfo-ctrl-delay');
            const rateLabel = document.getElementById('lfo-label-rate');

            if (activeLfoNumber === 1) {
                rateUnit.setAttribute('data-param', 'lfo1_rate');
                delayUnit.setAttribute('data-param', 'lfo1_delay');
                rateLabel.innerText = 'LFO1 Rate';
                lfoSelectBtn.classList.remove('is-lfo2');
                lfoSelectBtn.classList.add('is-lfo1');
            } else {
                rateUnit.setAttribute('data-param', 'lfo2_rate');
                delayUnit.setAttribute('data-param', 'lfo2_delay');
                rateLabel.innerText = 'LFO2 Rate';
                lfoSelectBtn.classList.remove('is-lfo1');
                lfoSelectBtn.classList.add('is-lfo2');
            }
            window.updateLfoSlidersFromCurrentPreset();
            if (typeof window.syncDetailPanelControls === 'function') {
                window.syncDetailPanelControls();
            }
        });
    }

    // ACTIVE OSC SWITCHER
    let activeOscNumber = 1;
    const oscSelectBtn = document.getElementById('osc-select-btn');
    if (oscSelectBtn) {
        oscSelectBtn.classList.add('osc-select-btn');
        oscSelectBtn.addEventListener('click', function () {
            activeOscNumber = activeOscNumber === 1 ? 2 : 1;
            oscSelectBtn.innerText = 'OSC ' + activeOscNumber + ' ACTIVE';

            const pitchModUnit = document.getElementById('osc-ctrl-pitchmod');
            const pwmToneUnit = document.getElementById('osc-ctrl-pwm-tone');
            const pitchUnit = document.getElementById('osc-ctrl-pitch');
            const levelUnit = document.getElementById('osc-ctrl-level');
            const pitchModLabel = document.getElementById('osc-label-pitchmod');
            const pwmToneLabel = document.getElementById('osc-label-pwm-tone');

            if (activeOscNumber === 1) {
                oscSelectBtn.classList.remove('is-osc2');
                oscSelectBtn.classList.add('is-osc1');
                pitchModUnit.setAttribute('data-param', 'osc1_pitch_mod');
                pwmToneUnit.setAttribute('data-param', 'osc1_pwm_amount');
                pitchModLabel.innerText = 'Pitch Mod';
                pwmToneLabel.innerText = 'PWM';
                pitchUnit.classList.add('hidden');
                levelUnit.classList.add('hidden');
            } else {
                oscSelectBtn.classList.remove('is-osc1');
                oscSelectBtn.classList.add('is-osc2');
                pitchModUnit.setAttribute('data-param', 'osc2_pitch_mod');
                pwmToneUnit.setAttribute('data-param', 'osc2_tone_mod');
                pitchModLabel.innerText = 'Pitch Mod';
                pwmToneLabel.innerText = 'Tone Mod';
                pitchUnit.classList.remove('hidden');
                levelUnit.classList.remove('hidden');
            }

            window.updateOscSlidersFromCurrentPreset();
            if (typeof window.syncDetailPanelControls === 'function') {
                window.syncDetailPanelControls();
            }
        });
    }

    // ACTIVE ENVELOPE SWITCHER
    let activeEnvNumber = 1;
    const envBtns = document.querySelectorAll('.env-type-btn');
    envBtns.forEach(function (btn) {
        btn.classList.add('env-type-btn');
        btn.addEventListener('click', function () {
            envBtns.forEach(function (b) {
                b.classList.remove('active', 'accent-primary', 'accent-teal', 'accent-pink');
            });

            btn.classList.add('active');
            activeEnvNumber = parseInt(btn.getAttribute('data-env'));

            const atkUnit = document.getElementById('env-ctrl-attack');
            const dcyUnit = document.getElementById('env-ctrl-decay');
            const susUnit = document.getElementById('env-ctrl-sustain');
            const relUnit = document.getElementById('env-ctrl-release');

            if (activeEnvNumber === 1) {
                btn.classList.add('accent-primary');
                atkUnit.setAttribute('data-param', 'env1_attack');
                dcyUnit.setAttribute('data-param', 'env1_decay');
                susUnit.setAttribute('data-param', 'env1_sustain');
                relUnit.setAttribute('data-param', 'env1_release');
            } else if (activeEnvNumber === 2) {
                btn.classList.add('accent-teal');
                atkUnit.setAttribute('data-param', 'env2_attack');
                dcyUnit.setAttribute('data-param', 'env2_decay');
                susUnit.setAttribute('data-param', 'env2_sustain');
                relUnit.setAttribute('data-param', 'env2_release');
            } else {
                btn.classList.add('accent-pink');
                atkUnit.setAttribute('data-param', 'env3_attack');
                dcyUnit.setAttribute('data-param', 'env3_decay');
                susUnit.setAttribute('data-param', 'env3_sustain');
                relUnit.setAttribute('data-param', 'env3_release');
            }

            window.updateEnvSlidersFromCurrentPreset();
            if (typeof window.syncDetailPanelControls === 'function') {
                window.syncDetailPanelControls();
            }
        });
    });
}
