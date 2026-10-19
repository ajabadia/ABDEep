/**
 * @purpose LCD priority queue, fade animations, and safe update helpers.
 * Extracted from script_controllers.js to reduce monolithic size.
 */

// LCD Priority Queue
window.LcdQueue = {
    _messages: {},
    _expiryTimers: {},

    push: function(id, content, priority, options) {
        options = options || {};
        this._messages[id] = {
            content: content,
            priority: priority,
            timestamp: Date.now()
        };
        if (this._expiryTimers[id]) {
            clearTimeout(this._expiryTimers[id]);
        }
        const duration = (options.duration !== undefined) ? options.duration : 2000;
        if (duration !== null) {
            const self = this;
            this._expiryTimers[id] = setTimeout(function() {
                delete self._messages[id];
                delete self._expiryTimers[id];
            }, duration);
        }
    },

    getActive: function() {
        let best = null;
        for (const id in this._messages) {
            const m = this._messages[id];
            if (!best || m.priority < best.priority) {
                best = m;
            }
        }
        return best;
    },

    clear: function() {
        for (const id in this._expiryTimers) {
            clearTimeout(this._expiryTimers[id]);
        }
        this._messages = {};
        this._expiryTimers = {};
    }
};

window._LCD_FADE_OUT_EASING = 'cubic-bezier(0.4, 0.0, 1.0, 1.0)';
window._LCD_FADE_IN_EASING = 'cubic-bezier(0.0, 0.0, 0.2, 1.0)';

window.getLcdFadeTiming = function() {
    const speed = localStorage.getItem('abd-eep-fade-speed') || 'normal';
    switch (speed) {
        case 'off':    return { out:0, swap:0, in:0, cleanup:0, outR:0, swapR:0, inR:0, cleanupR:0 };
        case 'fast':   return { out:60, swap:70, in:60, cleanup:80, outR:80, swapR:90, inR:80, cleanupR:100 };
        case 'normal': return { out:100, swap:110, in:100, cleanup:130, outR:150, swapR:160, inR:150, cleanupR:180 };
        case 'slow':   return { out:220, swap:230, in:220, cleanup:250, outR:300, swapR:320, inR:300, cleanupR:350 };
        default:       return { out:100, swap:110, in:100, cleanup:130, outR:150, swapR:160, inR:150, cleanupR:180 };
    }
};

let _lcdLastParam = null;

window.lcdFadeUpdate = function(lcdEl, html, paramId) {
    if (!lcdEl) {return;}
    if (lcdEl._ctrlLcdFadeTimer) {
        clearTimeout(lcdEl._ctrlLcdFadeTimer);
        lcdEl._ctrlLcdFadeTimer = null;
    }
    const contentId = 'param_' + (paramId || 'generic');
    
    // Read user timeout preference
    const saved = localStorage.getItem('abd-eep-lcd-timeout');
    let timeoutMs = 2000;
    if (saved !== null) {
        timeoutMs = saved === 'off' ? null : (parseInt(saved, 10) || 2000);
    }

    if (paramId && paramId === _lcdLastParam) {
        if (lcdEl._ctrlLcdFadeTimer) {
            clearTimeout(lcdEl._ctrlLcdFadeTimer);
            lcdEl._ctrlLcdFadeTimer = null;
        }
        lcdEl._lcdFading = false;
        lcdEl.style.removeProperty('transition');
        lcdEl.style.opacity = '1';
        window.LcdQueue.push(contentId, html, 0, {
            duration: timeoutMs !== null ? timeoutMs : null
        });
        return;
    }
    _lcdLastParam = paramId;
    lcdEl._lcdFading = true;
    window.LcdQueue.push(contentId, html, 0, {
        duration: timeoutMs !== null ? timeoutMs : null
    });
    const t = window.getLcdFadeTiming();
    if (t.out === 0) {
        lcdEl._lcdFading = false;
        lcdEl.style.removeProperty('transition');
        lcdEl.style.opacity = '1';
        lcdEl.innerHTML = html;
        return;
    }
    lcdEl.style.transition = 'opacity ' + t.out + 'ms ' + window._LCD_FADE_OUT_EASING;
    lcdEl.style.opacity = '0';
    lcdEl._ctrlLcdFadeTimer = setTimeout(() => {
        if (lcdEl._ctrlLcdFadeTimer === null) {return;}
        lcdEl._ctrlLcdFadeTimer = null;
        lcdEl.innerHTML = html;
        lcdEl.style.transition = 'opacity ' + t.in + 'ms ' + window._LCD_FADE_IN_EASING;
        lcdEl.style.opacity = '1';
        lcdEl._lcdFading = false;
        setTimeout(() => {
            lcdEl.style.removeProperty('transition');
            lcdEl.style.removeProperty('opacity');
        }, t.cleanup);
    }, t.swap);
};

window.lcdSafeUpdate = function(lcdEl, html, paramId, options) {
    if (!lcdEl) {return;}
    options = options || {};
    if (typeof window.lcdFadeUpdate === 'function' && options.useQueue !== false) {
        window.lcdFadeUpdate(lcdEl, html, paramId);
    } else {
        if (lcdEl._ctrlLcdFadeTimer) {
            clearTimeout(lcdEl._ctrlLcdFadeTimer);
            lcdEl._ctrlLcdFadeTimer = null;
        }
        lcdEl._lcdFading = false;
        lcdEl.style.removeProperty('transition');
        lcdEl.style.opacity = '1';
        lcdEl.innerHTML = html;
    }
};

/**
 * Updates the central LCD (#lcd-text) in real time when any parameter control is moved.
 */
window.updateParameterLcdReadout = function(paramId, normalizedVal, customTitle, customCategory) {
    if (!paramId) {return;}
    const lcdText = document.getElementById('lcd-text');
    if (!lcdText) {return;}

    const category = customCategory
        || (window.MIDI_NRPN_MAP && window.MIDI_NRPN_MAP[paramId] ? window.MIDI_NRPN_MAP[paramId] : 'PARAMETER');
    const title = (customTitle || paramId).toUpperCase();
    const displayVal = typeof window.formatParamValue === 'function'
        ? window.formatParamValue(paramId, normalizedVal)
        : (typeof normalizedVal === 'number' ? normalizedVal.toFixed(2) : String(normalizedVal));

    const html = '<span class="lcd-label">' + category + '</span><br>'
        + '<strong>' + title + '</strong><br>'
        + '<span class="lcd-value">' + displayVal + '</span>';

    if (typeof window.lcdFadeUpdate === 'function') {
        window.lcdFadeUpdate(lcdText, html, paramId);
    } else {
        lcdText.innerHTML = html;
    }
};

/**
 * Returns the musical default normalized value (0..1) for a parameter on double-click reset.
 */
window.getDefaultParamValue = function(paramId) {
    if (!paramId) {return 0.0;}
    if (paramId === 'global_volume' || paramId === 'vca_level' || paramId === 'vca_env_depth' || paramId === 'fx_send_level') {
        return 0.8;
    }
    if (paramId === 'vcf_cutoff' || paramId === 'env1_sustain' || paramId === 'env2_sustain' || paramId === 'env3_sustain') {
        return 1.0;
    }
    if (
        paramId === 'osc2_pitch' ||
        paramId === 'porta_osc_bal' ||
        paramId === 'arp_gate_time' ||
        paramId === 'arp_swing' ||
        paramId === 'seq_swing' ||
        paramId.endsWith('_curve') ||
        /^fx[1-4]_param\d+$/.test(paramId)
    ) {
        return 0.5;
    }
    return 0.0;
};

