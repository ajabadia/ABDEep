/**
 * @purpose Key LED animations for panic, patch change, and bank change visuals.
 * Extracted from keyboard.js — standalone function, no closure dependencies.
 */

function playKeyLedAnimation(type) {
    const keybed = document.getElementById('ivory-keys-bed');
    if (!keybed) {return;}
    const keys = Array.from(keybed.querySelectorAll('.key'));
    // Sort left to right by MIDI note
    keys.sort((a, b) => parseInt(a.getAttribute('data-note')) - parseInt(b.getAttribute('data-note')));
    
    if (keys.length === 0) {return;}
    
    if (window._activeKeyLedAnimationInterval) {
        clearInterval(window._activeKeyLedAnimationInterval);
        window._activeKeyLedAnimationInterval = null;
        keys.forEach(k => {
            k.classList.remove('pushed-anim');
            k.style.removeProperty('--key-led-color');
        });
    }

    const totalSteps = keys.length;
    
    if (type === 'panic') {
        const duration = 12; // ms per key
        let i = 0;
        const interval = setInterval(() => {
            if (i < totalSteps) {
                const key = keys[i];
                key.classList.add('pushed-anim');
                key.style.setProperty('--key-led-color', '#ff0000');
                setTimeout(() => {
                    key.classList.remove('pushed-anim');
                    key.style.removeProperty('--key-led-color');
                }, 180);
                i++;
            } else if (i < totalSteps * 2) {
                const revIdx = totalSteps * 2 - 1 - i;
                const key = keys[revIdx];
                if (key) {
                    key.classList.add('pushed-anim');
                    key.style.setProperty('--key-led-color', '#ff0000');
                    setTimeout(() => {
                        key.classList.remove('pushed-anim');
                        key.style.removeProperty('--key-led-color');
                    }, 180);
                }
                i++;
            } else {
                clearInterval(interval);
            }
        }, duration);
        window._activeKeyLedAnimationInterval = interval;
    }
    else if (type === 'patch-up' || type === 'patch-down') {
        const isUp = type === 'patch-up';
        const duration = 15;
        let i = 0;
        
        const interval = setInterval(() => {
            if (i < totalSteps) {
                const idx = isUp ? i : (totalSteps - 1 - i);
                const key = keys[idx];
                if (key) {
                    const hue = Math.round((i / totalSteps) * 360);
                    key.classList.add('pushed-anim');
                    key.style.setProperty('--key-led-color', `hsl(${hue}, 100%, 50%)`);
                    setTimeout(() => {
                        key.classList.remove('pushed-anim');
                        key.style.removeProperty('--key-led-color');
                    }, 250);
                }
                i++;
            } else {
                clearInterval(interval);
            }
        }, duration);
        window._activeKeyLedAnimationInterval = interval;
    }
    else if (type === 'bank-up' || type === 'bank-down') {
        const isUp = type === 'bank-up';
        const duration = 40;
        let groupIdx = 0;
        const groupSize = 3;
        const totalGroups = Math.ceil(totalSteps / groupSize);
        
        const interval = setInterval(() => {
            if (groupIdx < totalGroups) {
                const g = isUp ? groupIdx : (totalGroups - 1 - groupIdx);
                const start = g * groupSize;
                const hue = Math.round((groupIdx / totalGroups) * 360);
                
                for (let kIdx = 0; kIdx < groupSize; kIdx++) {
                    const key = keys[start + kIdx];
                    if (key) {
                        key.classList.add('pushed-anim');
                        key.style.setProperty('--key-led-color', `hsl(${hue}, 100%, 50%)`);
                        setTimeout(() => {
                            key.classList.remove('pushed-anim');
                            key.style.removeProperty('--key-led-color');
                        }, 300);
                    }
                }
                groupIdx++;
            } else {
                clearInterval(interval);
            }
        }, duration);
        window._activeKeyLedAnimationInterval = interval;
    }
}

window.playKeyLedAnimation = playKeyLedAnimation;
