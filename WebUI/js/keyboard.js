/**
 * @purpose Módulo de inicialización y control del teclado de piano virtual (Keybed), ruedas de Pitch y Mod, y Octave Shift.
 * @purpose_en Initializes and manages the virtual piano keybed, Pitch/Mod wheels, and octave shifting.
 */

function initKeyboardAndWheels() {
    const keybed = document.getElementById('ivory-keys-bed');
    if (!keybed) return;

    // Control de desplazamiento de octavas (Octave Shift)
    let octaveShift = 0; // en semitonos de 12 en 12 (octavas)
    const octUpBtn = document.getElementById('oct-up-btn');
    const octDownBtn = document.getElementById('oct-down-btn');

    const updateOctaveButtonsVisuals = () => {
        const currentOctVal = octaveShift / 12;
        
        // Determinar el color según la cantidad de octavas
        let activeColor = "var(--color-env-vca)"; // Por defecto (no debería usarse si es 0, pero por si acaso)
        if (Math.abs(currentOctVal) === 1) {
            activeColor = "var(--color-env-vcf)"; // +/-1 (Verde)
        } else if (Math.abs(currentOctVal) === 2) {
            activeColor = "var(--color-env-mod)"; // +/-2 (Rosa)
        } else if (Math.abs(currentOctVal) >= 3) {
            activeColor = "var(--color-oct-3)";   // +/-3 (Azul Cián)
        }

        // Si es 0, ninguno se colorea (quedan por defecto)
        const isUpActive = currentOctVal > 0;
        const isDownActive = currentOctVal < 0;

        if (octUpBtn) {
            if (isUpActive) {
                octUpBtn.style.setProperty('color', activeColor, 'important');
                octUpBtn.style.setProperty('border-color', activeColor, 'important');
                octUpBtn.style.setProperty('box-shadow', `0 0 8px ${activeColor}`, 'important');
            } else {
                octUpBtn.style.setProperty('color', 'var(--brand-accent)', 'important');
                octUpBtn.style.setProperty('border-color', '#444', 'important');
                octUpBtn.style.setProperty('box-shadow', 'none', 'important');
            }
        }

        if (octDownBtn) {
            if (isDownActive) {
                octDownBtn.style.setProperty('color', activeColor, 'important');
                octDownBtn.style.setProperty('border-color', activeColor, 'important');
                octDownBtn.style.setProperty('box-shadow', `0 0 8px ${activeColor}`, 'important');
            } else {
                octDownBtn.style.setProperty('color', 'var(--brand-accent)', 'important');
                octDownBtn.style.setProperty('border-color', '#444', 'important');
                octDownBtn.style.setProperty('box-shadow', 'none', 'important');
            }
        }
    };
    
    if (octUpBtn) {
        octUpBtn.addEventListener('click', () => {
            octaveShift = Math.min(36, octaveShift + 12); // máximo +3 octavas
            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">KEYBED</span><br><strong>OCTAVE SHIFT</strong><br><span style="font-size:15px; color:var(--brand-accent);">${octaveShift > 0 ? '+' : ''}${octaveShift/12}</span>`;
            }
            updateOctaveButtonsVisuals();
        });
    }
    if (octDownBtn) {
        octDownBtn.addEventListener('click', () => {
            octaveShift = Math.max(-36, octaveShift - 12); // mínimo -3 octavas
            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">KEYBED</span><br><strong>OCTAVE SHIFT</strong><br><span style="font-size:15px; color:var(--brand-accent);">${octaveShift/12}</span>`;
            }
            updateOctaveButtonsVisuals();
        });
    }

    // Inicializar color por defecto
    updateOctaveButtonsVisuals();

    const notes = [
        { type: 'white', name: 'C' }, { type: 'black', name: 'C#' },
        { type: 'white', name: 'D' }, { type: 'black', name: 'D#' },
        { type: 'white', name: 'E' },
        { type: 'white', name: 'F' }, { type: 'black', name: 'F#' },
        { type: 'white', name: 'G' }, { type: 'black', name: 'G#' },
        { type: 'white', name: 'A' }, { type: 'black', name: 'A#' },
        { type: 'white', name: 'B' }
    ];

    let whiteKeyIndex = 0;
    const totalOctaves = 4; // 4 octavas
    const baseMidiNote = 36; // C2

    for (let octave = 0; octave < totalOctaves; octave++) {
        notes.forEach((note) => {
            const originalMidiNote = baseMidiNote + (octave * 12) + notes.indexOf(note);
            const key = document.createElement('div');
            key.classList.add('key', note.type);
            key.setAttribute('data-note', originalMidiNote);

            if (note.type === 'white') {
                whiteKeyIndex++;
            } else {
                const leftPosition = ((whiteKeyIndex - 0.6) / 28) * 100;
                key.style.left = leftPosition + '%';
            }

            const noteOn = (e) => {
                e.preventDefault();
                key.classList.add('pushed');
                const shiftedMidiNote = originalMidiNote + octaveShift;
                if (window.dualMidiBridge && window.dualMidiBridge.midiOutput) {
                    const statusByte = 0x90 | (window.dualMidiBridge.midiChannel - 1);
                    window.dualMidiBridge.midiOutput.send([statusByte, shiftedMidiNote, 100]);
                }
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) lcdText.innerText = `NOTE ON: ${note.name}${octave + 2 + (octaveShift/12)} (${shiftedMidiNote})`;
            };

            const noteOff = (e) => {
                e.preventDefault();
                key.classList.remove('pushed');
                const shiftedMidiNote = originalMidiNote + octaveShift;
                if (window.dualMidiBridge && window.dualMidiBridge.midiOutput) {
                    const statusByte = 0x80 | (window.dualMidiBridge.midiChannel - 1);
                    window.dualMidiBridge.midiOutput.send([statusByte, shiftedMidiNote, 0]);
                }
            };

            key.addEventListener('pointerdown', noteOn);
            key.addEventListener('pointerup', noteOff);
            key.addEventListener('pointerleave', noteOff);

            keybed.appendChild(key);
        });
    }

    // Configurar Ruedas
    const setupWheel = (wheelId, isPitch) => {
        const slot = document.getElementById(wheelId);
        if (!slot) return;
        const wheel = slot.querySelector('.wheel');
        let isMoving = false;

        const updateWheel = (clientY) => {
            const rect = slot.getBoundingClientRect();
            let pct = 1.0 - (clientY - rect.top) / rect.height;
            pct = Math.max(0, Math.min(1, pct));

            const wheelHeight = 40;
            const pos = (1.0 - pct) * (rect.height - wheelHeight);
            wheel.style.bottom = (rect.height - wheelHeight - pos) + 'px';

            if (window.dualMidiBridge && window.dualMidiBridge.midiOutput) {
                const statusByte = (isPitch ? 0xE0 : 0xB0) | (window.dualMidiBridge.midiChannel - 1);
                if (isPitch) {
                    const bendVal = Math.round(pct * 16383);
                    const lsb = bendVal & 0x7F;
                    const msb = (bendVal >> 7) & 0x7F;
                    window.dualMidiBridge.midiOutput.send([statusByte, lsb, msb]);
                } else {
                    const modVal = Math.round(pct * 127);
                    window.dualMidiBridge.midiOutput.send([statusByte, 1, modVal]);
                }
            }
        };

        const rectCenterY = (el) => {
            const r = el.getBoundingClientRect();
            return r.top + (r.height / 2);
        };

        slot.addEventListener('pointerdown', (e) => {
            isMoving = true;
            slot.setPointerCapture(e.pointerId);
            updateWheel(e.clientY);
        });

        slot.addEventListener('pointermove', (e) => {
            if (isMoving) updateWheel(e.clientY);
        });

        slot.addEventListener('pointerup', (e) => {
            isMoving = false;
            if (isPitch) {
                updateWheel(rectCenterY(slot));
            }
        });
    };

    setupWheel('wheel-pitch', true);
    setupWheel('wheel-mod', false);
}

// Exportar al ámbito de window
window.initKeyboardAndWheels = initKeyboardAndWheels;
