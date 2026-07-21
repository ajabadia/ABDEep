/**
 * Tests for WebUI/js/script_curves.js — Controller curves (expo, log, s-curve, custom)
 *
 * Strategy: self-contained extracted functions, localStorage stub.
 */

// ===== localStorage stub =====
let curveStore = {};
const mockLS = {
    getItem: function(k) { return curveStore[k] !== undefined ? curveStore[k] : null; },
    setItem: function(k, v) { curveStore[k] = String(v); },
    removeItem: function(k) { delete curveStore[k]; },
    clear: function() { curveStore = {}; }
};
globalThis.localStorage = mockLS;

// ===== Extracted Source =====

function _evalCustomCurve(x, points) {
    if (!points || points.length < 2) {return x;}
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        if (x >= a.x && x <= b.x) {
            const t = (x - a.x) / (b.x - a.x || 1);
            return a.y + (b.y - a.y) * t;
        }
    }
    return points[points.length - 1].y;
}

function applyControllerCurve(value, curveType) {
    if (curveType === 'linear' || !curveType) {return value;}
    if (curveType === 'custom') {
        const ctrlName = 'aftertouch';
        const points = getCustomCurvePoints(ctrlName);
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
}

function applyBipolarCurve(value, curveType) {
    if (curveType === 'linear' || !curveType) {return value;}
    if (curveType === 'custom') {
        const points = getCustomCurvePoints('pitchbend');
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
}

function getControllerCurve(ctrlName) {
    const key = 'abd-eep-curve-' + ctrlName;
    const saved = localStorage.getItem(key);
    return saved || 'linear';
}

function setControllerCurve(ctrlName, curveType) {
    const key = 'abd-eep-curve-' + ctrlName;
    localStorage.setItem(key, curveType);
}

function getCustomCurvePoints(ctrlName) {
    const key = 'abd-eep-custom-curve-' + ctrlName;
    const raw = localStorage.getItem(key);
    let intermediates = [];
    if (raw) {
        try { intermediates = JSON.parse(raw); } catch(e) { intermediates = []; }
    }
    const all = [{x:0, y:0}, ...intermediates, {x:1, y:1}];
    all.sort((a, b) => a.x - b.x);
    return all;
}

function setCustomCurvePoints(ctrlName, intermediates) {
    const key = 'abd-eep-custom-curve-' + ctrlName;
    const filtered = intermediates.filter(p => p.x > 0.001 && p.x < 0.999);
    const limited = filtered.slice(0, 5);
    localStorage.setItem(key, JSON.stringify(limited));
}

// ===== Tests =====

describe('_evalCustomCurve — piecewise linear interpolation', function() {
    it('returns x when no points', function() {
        expect(_evalCustomCurve(0.5, null)).toBe(0.5);
        expect(_evalCustomCurve(0.5, [])).toBe(0.5);
    });

    it('returns x when single point', function() {
        expect(_evalCustomCurve(0.5, [{x:0, y:0}])).toBe(0.5);
    });

    it('interpolates linearly between two end points', function() {
        const pts = [{x:0, y:0}, {x:1, y:1}];
        expect(_evalCustomCurve(0, pts)).toBe(0);
        expect(_evalCustomCurve(0.5, pts)).toBe(0.5);
        expect(_evalCustomCurve(1, pts)).toBe(1);
    });

    it('interpolates with offset line', function() {
        const pts = [{x:0, y:0.2}, {x:1, y:0.8}];
        expect(_evalCustomCurve(0, pts)).toBe(0.2);
        expect(_evalCustomCurve(0.5, pts)).toBe(0.5);
        expect(_evalCustomCurve(1, pts)).toBe(0.8);
    });

    it('interpolates with three points (custom curve)', function() {
        const pts = [{x:0, y:0}, {x:0.5, y:0.2}, {x:1, y:1}];
        expect(_evalCustomCurve(0.25, pts)).toBeCloseTo(0.1, 5);
        expect(_evalCustomCurve(0.75, pts)).toBeCloseTo(0.6, 5);
    });

    it('clamps to last point when x exceeds range', function() {
        const pts = [{x:0, y:0}, {x:0.5, y:0.5}];
        expect(_evalCustomCurve(0.75, pts)).toBe(0.5);
    });

    it('handles flat segment (a.x === b.x)', function() {
        const pts = [{x:0.3, y:0.1}, {x:0.3, y:0.9}];
        // when b.x - a.x === 0, t = (x - a.x) / 1, which is 0
        // So result = a.y + 0 = 0.1
        expect(_evalCustomCurve(0.3, pts)).toBe(0.1);
    });
});

describe('applyControllerCurve — unipolar (0..1)', function() {
    it('returns value unchanged for linear', function() {
        expect(applyControllerCurve(0.5, 'linear')).toBe(0.5);
    });

    it('returns value unchanged when curveType is null/undefined', function() {
        expect(applyControllerCurve(0.5, null)).toBe(0.5);
        expect(applyControllerCurve(0.5, undefined)).toBe(0.5);
    });

    it('expo2 squares the value', function() {
        expect(applyControllerCurve(0.5, 'expo2')).toBeCloseTo(0.25, 5);
        expect(applyControllerCurve(0.2, 'expo2')).toBeCloseTo(0.04, 5);
        expect(applyControllerCurve(1.0, 'expo2')).toBe(1.0);
        expect(applyControllerCurve(0.0, 'expo2')).toBe(0.0);
    });

    it('expo3 cubes the value', function() {
        expect(applyControllerCurve(0.5, 'expo3')).toBeCloseTo(0.125, 5);
        expect(applyControllerCurve(0.3, 'expo3')).toBeCloseTo(0.027, 5);
    });

    it('log returns sqrt', function() {
        expect(applyControllerCurve(0.25, 'log')).toBeCloseTo(0.5, 5);
        expect(applyControllerCurve(0.0, 'log')).toBe(0.0);
        expect(applyControllerCurve(1.0, 'log')).toBe(1.0);
    });

    it('s-curve returns smoothstep (v² * (3 - 2v))', function() {
        expect(applyControllerCurve(0.0, 's-curve')).toBe(0.0);
        expect(applyControllerCurve(0.5, 's-curve')).toBeCloseTo(0.5, 5);
        expect(applyControllerCurve(1.0, 's-curve')).toBe(1.0);
        // s-curve is symmetric: v² * (3-2v); at v=0.25: 0.0625 * 2.5 = 0.15625
        expect(applyControllerCurve(0.25, 's-curve')).toBeCloseTo(0.15625, 5);
    });

    it('clamps value to [0,1] before applying curve', function() {
        expect(applyControllerCurve(-0.5, 'expo2')).toBe(0.0);
        expect(applyControllerCurve(1.5, 'expo2')).toBe(1.0);
    });

    it('custom curve uses getCustomCurvePoints', function() {
        // Set custom curve points
        setCustomCurvePoints('aftertouch', [{x:0.3, y:0.1}, {x:0.7, y:0.9}]);
        // At x=0.5, should interpolate between (0.3,0.1) and (0.7,0.9):
        // t = (0.5-0.3)/(0.7-0.3) = 0.2/0.4 = 0.5
        // y = 0.1 + 0.5 * (0.9-0.1) = 0.1 + 0.4 = 0.5
        expect(applyControllerCurve(0.5, 'custom')).toBeCloseTo(0.5, 5);
        curveStore = {};
    });
});

describe('applyBipolarCurve — bipolar (-1..1)', function() {
    it('returns value unchanged for linear', function() {
        expect(applyBipolarCurve(0.5, 'linear')).toBe(0.5);
        expect(applyBipolarCurve(-0.5, 'linear')).toBe(-0.5);
    });

    it('expo2 squares absolute value, preserves sign', function() {
        expect(applyBipolarCurve(0.5, 'expo2')).toBeCloseTo(0.25, 5);
        expect(applyBipolarCurve(-0.5, 'expo2')).toBeCloseTo(-0.25, 5);
    });

    it('expo3 cubes absolute value, preserves sign', function() {
        expect(applyBipolarCurve(0.5, 'expo3')).toBeCloseTo(0.125, 5);
        expect(applyBipolarCurve(-0.5, 'expo3')).toBeCloseTo(-0.125, 5);
    });

    it('log returns sqrt of absolute, preserves sign', function() {
        expect(applyBipolarCurve(0.25, 'log')).toBeCloseTo(0.5, 5);
        expect(applyBipolarCurve(-0.25, 'log')).toBeCloseTo(-0.5, 5);
    });

    it('s-curve on bipolar works symmetrically', function() {
        expect(applyBipolarCurve(0.5, 's-curve')).toBeCloseTo(0.5, 5);
        expect(applyBipolarCurve(-0.5, 's-curve')).toBeCloseTo(-0.5, 5);
        expect(applyBipolarCurve(0.25, 's-curve')).toBeCloseTo(0.15625, 5);
        expect(applyBipolarCurve(-0.25, 's-curve')).toBeCloseTo(-0.15625, 5);
    });

    it('clamps to [-1,1] before applying', function() {
        expect(applyBipolarCurve(-2.0, 'expo2')).toBe(-1.0);
        expect(applyBipolarCurve(2.0, 'expo2')).toBe(1.0);
    });

    it('zero remains zero', function() {
        expect(applyBipolarCurve(0.0, 'expo2')).toBe(0.0);
        expect(applyBipolarCurve(0.0, 's-curve')).toBe(0.0);
    });
});

describe('getControllerCurve / setControllerCurve — localStorage CRUD', function() {
    beforeEach(function() {
        curveStore = {};
    });

    it('getControllerCurve returns "linear" when nothing saved', function() {
        expect(getControllerCurve('aftertouch')).toBe('linear');
    });

    it('setControllerCurve stores value, get retrieves it', function() {
        setControllerCurve('aftertouch', 'expo2');
        expect(getControllerCurve('aftertouch')).toBe('expo2');
    });

    it('stores per-controller independently', function() {
        setControllerCurve('aftertouch', 'expo2');
        setControllerCurve('modwheel', 'log');
        expect(getControllerCurve('aftertouch')).toBe('expo2');
        expect(getControllerCurve('modwheel')).toBe('log');
        expect(getControllerCurve('pitchbend')).toBe('linear');
    });
});

describe('getCustomCurvePoints / setCustomCurvePoints', function() {
    beforeEach(function() {
        curveStore = {};
    });

    it('getCustomCurvePoints returns endpoints when nothing saved', function() {
        const pts = getCustomCurvePoints('aftertouch');
        expect(pts.length).toBe(2);
        expect(pts[0]).toEqual({x:0, y:0});
        expect(pts[1]).toEqual({x:1, y:1});
    });

    it('setCustomCurvePoints stores intermediate points', function() {
        setCustomCurvePoints('aftertouch', [{x:0.3, y:0.2}]);
        const pts = getCustomCurvePoints('aftertouch');
        expect(pts.length).toBe(3); // endpoints + 1 intermediate
        expect(pts[0]).toEqual({x:0, y:0});
        expect(pts[1]).toEqual({x:0.3, y:0.2});
        expect(pts[2]).toEqual({x:1, y:1});
    });

    it('filters out points at x=0 or x=1 (endpoints)', function() {
        setCustomCurvePoints('aftertouch', [
            {x:0, y:0.5},    // should be filtered
            {x:0.4, y:0.3},  // kept
            {x:1, y:0.8}     // should be filtered
        ]);
        const pts = getCustomCurvePoints('aftertouch');
        expect(pts.length).toBe(3); // endpoints + 0.4
        expect(pts[1].x).toBe(0.4);
    });

    it('limits to 5 intermediate points max', function() {
        const manyPoints = [];
        for (let i = 1; i <= 7; i++) {
            manyPoints.push({x: i / 8, y: i / 10});
        }
        setCustomCurvePoints('aftertouch', manyPoints);
        const pts = getCustomCurvePoints('aftertouch');
        expect(pts.length).toBe(7); // 5 intermediates + 2 endpoints
        // Verify they're sorted
        for (let j = 1; j < pts.length; j++) {
            expect(pts[j].x).toBeGreaterThan(pts[j-1].x);
        }
    });

    it('sorts points by x ascending', function() {
        setCustomCurvePoints('aftertouch', [
            {x:0.7, y:0.8},
            {x:0.3, y:0.2},
            {x:0.5, y:0.5}
        ]);
        const pts = getCustomCurvePoints('aftertouch');
        expect(pts[0].x).toBe(0);
        expect(pts[1].x).toBe(0.3);
        expect(pts[2].x).toBe(0.5);
        expect(pts[3].x).toBe(0.7);
        expect(pts[4].x).toBe(1);
    });
});

describe('custom curve integration — eval with custom points', function() {
    beforeEach(function() {
        curveStore = {};
    });

    it('applyControllerCurve custom uses stored points', function() {
        setCustomCurvePoints('aftertouch', [{x:0.5, y:0.2}]);
        // At x=0.25: interpolate between (0,0) and (0.5,0.2)
        const result = applyControllerCurve(0.25, 'custom');
        expect(result).toBeCloseTo(0.1, 5);
    });

    it('applyBipolarCurve custom uses stored pitchbend points', function() {
        setCustomCurvePoints('pitchbend', [{x:0.5, y:0.6}]);
        // At value=0.5: abs=0.5, interpolate (0,0)-(0.5,0.6) → t=1.0 → 0.6
        // sign positive → 0.6
        const result = applyBipolarCurve(0.5, 'custom');
        expect(result).toBeCloseTo(0.6, 5);
    });
});
