/**
 * @purpose Evaluates and handles response curves for hardware controllers.
 * @purpose_en Controller Response Curves and piecewise custom curve editor support.
 */

function _evalCustomCurve(x, points) {
    if (!points || points.length < 2) return x;
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        if (x >= a.x && x <= b.x) {
            const t = (x - a.x) / (b.x - a.x || 1);
            return a.y + (b.y - a.y) * t;
        }
    }
    return points[points.length - 1].y;
}

window.applyControllerCurve = function(value, curveType) {
    if (curveType === 'linear' || !curveType) return value;
    if (curveType === 'custom') {
        const atSel = document.getElementById('settings-curve-aftertouch');
        const mwSel = document.getElementById('settings-curve-modwheel');
        const pbSel = document.getElementById('settings-curve-pitchbend');
        let ctrlName = 'aftertouch';
        if (atSel && atSel.value === 'custom') ctrlName = 'aftertouch';
        else if (mwSel && mwSel.value === 'custom') ctrlName = 'modwheel';
        else if (pbSel && pbSel.value === 'custom') ctrlName = 'pitchbend';
        const points = window.getCustomCurvePoints(ctrlName);
        const v = Math.max(0, Math.min(1, value));
        return _evalCustomCurve(v, points);
    }
    const v = Math.max(0, Math.min(1, value));
    switch (curveType) {
        case 'expo2':    return v * v;
        case 'expo3':    return v * v * v;
        case 'log':      return Math.sqrt(v);
        case 's-curve':  return v * v * (3 - 2 * v);
        default:         return v;
    }
};

window.getControllerCurve = function(ctrlName) {
    const key = 'abd-eep-curve-' + ctrlName;
    const saved = localStorage.getItem(key);
    return saved || 'linear';
};

window.setControllerCurve = function(ctrlName, curveType) {
    const key = 'abd-eep-curve-' + ctrlName;
    localStorage.setItem(key, curveType);
};

window.applyBipolarCurve = function(value, curveType) {
    if (curveType === 'linear' || !curveType) return value;
    if (curveType === 'custom') {
        const points = window.getCustomCurvePoints('pitchbend');
        const abs = Math.max(0, Math.min(1, Math.abs(value)));
        const sign = value >= 0 ? 1 : -1;
        return sign * _evalCustomCurve(abs, points);
    }
    const abs = Math.max(0, Math.min(1, Math.abs(value)));
    const sign = value >= 0 ? 1 : -1;
    switch (curveType) {
        case 'expo2':    return sign * abs * abs;
        case 'expo3':    return sign * abs * abs * abs;
        case 'log':      return sign * Math.sqrt(abs);
        case 's-curve':  return sign * (abs * abs * (3 - 2 * abs));
        default:         return value;
    }
};

window.getCustomCurvePoints = function(ctrlName) {
    const key = 'abd-eep-custom-curve-' + ctrlName;
    const raw = localStorage.getItem(key);
    let intermediates = [];
    if (raw) {
        try { intermediates = JSON.parse(raw); } catch(e) { intermediates = []; }
    }
    const all = [{x:0, y:0}, ...intermediates, {x:1, y:1}];
    all.sort((a, b) => a.x - b.x);
    return all;
};

window.setCustomCurvePoints = function(ctrlName, intermediates) {
    const key = 'abd-eep-custom-curve-' + ctrlName;
    const filtered = intermediates.filter(p => p.x > 0.001 && p.x < 0.999);
    const limited = filtered.slice(0, 5);
    localStorage.setItem(key, JSON.stringify(limited));
};
