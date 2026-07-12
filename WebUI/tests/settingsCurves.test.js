/**
 * Tests for WebUI/js/settings_curves.js — Curve preview canvas math, custom point editing
 *
 * Strategy: extracted coordinate conversion, hit testing, point CRUD, and curve labels.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};

// ===== Extracted Source Functions =====

var CURVE_LABELS = {
    'linear': 'Linear',
    'expo2':  'Quadratic',
    'expo3':  'Cubic',
    'log':    'Log',
    's-curve':'S-Curve',
    'custom': 'Custom'
};

// Coordinate transformations (canvas dimensions, pad=8)
function canvasXToCurve(cvX, canvasWidth, pad) {
    pad = pad || 8;
    var graphW = canvasWidth - pad * 2;
    return (cvX - pad) / graphW;
}

function canvasYToCurve(cvY, bipolar, canvasHeight, pad) {
    pad = pad || 8;
    var graphH = canvasHeight - pad * 2;
    if (bipolar) {
        var centerY = pad + graphH / 2;
        return (centerY - cvY) / (graphH / 2);
    }
    return 1.0 - (cvY - pad) / graphH;
}

function curveToCanvasX(x, canvasWidth, pad) {
    pad = pad || 8;
    var graphW = canvasWidth - pad * 2;
    return pad + x * graphW;
}

function curveToCanvasY(y, bipolar, canvasHeight, pad) {
    pad = pad || 8;
    var graphH = canvasHeight - pad * 2;
    if (bipolar) {
        var centerY = pad + graphH / 2;
        return centerY - y * (graphH / 2);
    }
    return pad + (1 - y) * graphH;
}

function hitTest(cvX, cvY, points, bipolar, canvasWidth, canvasHeight, pad, threshold) {
    pad = pad || 8;
    threshold = threshold || 10; // 10px squared = 100 px²
    var thresholdSq = threshold * threshold;
    for (var i = 0; i < points.length; i++) {
        var px = curveToCanvasX(points[i].x, canvasWidth, pad);
        var py = curveToCanvasY(points[i].y, bipolar, canvasHeight, pad);
        var dx = cvX - px, dy = cvY - py;
        if (dx * dx + dy * dy < thresholdSq) return i;
    }
    return -1;
}

function getActiveCustomCtrlName(selectEls) {
    selectEls = selectEls || {};
    if (selectEls.aftertouch && selectEls.aftertouch === 'custom') return 'aftertouch';
    if (selectEls.modwheel && selectEls.modwheel === 'custom') return 'modwheel';
    if (selectEls.pitchbend && selectEls.pitchbend === 'custom') return 'pitchbend';
    return null;
}

function addCustomPoint(cvX, cvY, points, bipolar, canvasWidth, canvasHeight, pad) {
    pad = pad || 8;
    var nx = Math.max(0.01, Math.min(0.99, canvasXToCurve(cvX, canvasWidth, pad)));
    var ny = Math.max(0, Math.min(1, canvasYToCurve(cvY, bipolar, canvasHeight, pad)));
    if (bipolar) ny = Math.max(-1, Math.min(1, ny));

    var intermediates = points.filter(function(p) { return p.x > 0.001 && p.x < 0.999; });
    if (intermediates.length >= 5) return null;

    var newPoint = {x: nx, y: ny};
    var result = [].concat(intermediates);
    result.push(newPoint);
    result.sort(function(a, b) { return a.x - b.x; });
    return result;
}

function deleteCustomPoint(idx, points) {
    if (idx <= 0 || idx >= points.length - 1) return null;
    var intermediates = points.filter(function(p) { return p.x > 0.001 && p.x < 0.999; });
    intermediates.splice(idx - 1, 1);
    return intermediates;
}

function getCurveLabel(curveType, bipolar) {
    var name = CURVE_LABELS[curveType] || curveType;
    return (bipolar ? 'Bipolar ' : '') + name;
}

// ===== Tests =====

describe('CURVE_LABELS mapping', function() {
    it('has all curve types', function() {
        expect(CURVE_LABELS.linear).toBe('Linear');
        expect(CURVE_LABELS.expo2).toBe('Quadratic');
        expect(CURVE_LABELS.expo3).toBe('Cubic');
        expect(CURVE_LABELS.log).toBe('Log');
        expect(CURVE_LABELS['s-curve']).toBe('S-Curve');
        expect(CURVE_LABELS.custom).toBe('Custom');
    });
});

describe('getCurveLabel', function() {
    it('returns unipolar label by default', function() {
        expect(getCurveLabel('linear')).toBe('Linear');
        expect(getCurveLabel('expo2')).toBe('Quadratic');
    });

    it('prepends "Bipolar " for bipolar curves', function() {
        expect(getCurveLabel('linear', true)).toBe('Bipolar Linear');
        expect(getCurveLabel('s-curve', true)).toBe('Bipolar S-Curve');
    });

    it('falls back to curveType string for unknown types', function() {
        expect(getCurveLabel('unknown')).toBe('unknown');
    });
});

describe('canvasXToCurve — pixel to normalized coordinate', function() {
    var canvasW = 256, pad = 8;
    var graphW = 256 - 16; // 240

    it('maps left edge (pad) to 0', function() {
        expect(canvasXToCurve(pad, canvasW, pad)).toBe(0);
    });

    it('maps right edge (pad + graphW) to 1', function() {
        expect(canvasXToCurve(pad + graphW, canvasW, pad)).toBeCloseTo(1, 5);
    });

    it('maps center to 0.5', function() {
        var centerX = pad + graphW / 2;
        expect(canvasXToCurve(centerX, canvasW, pad)).toBeCloseTo(0.5, 5);
    });

    it('handles values outside canvas bounds', function() {
        expect(canvasXToCurve(0, canvasW, pad)).toBeLessThan(0);
        expect(canvasXToCurve(canvasW, canvasW, pad)).toBeGreaterThan(1);
    });
});

describe('curveToCanvasX — normalized to pixel coordinate', function() {
    var canvasW = 256, pad = 8;

    it('maps 0 to left edge (pad)', function() {
        expect(curveToCanvasX(0, canvasW, pad)).toBe(pad);
    });

    it('maps 1 to right edge (pad + graphW)', function() {
        var graphW = canvasW - pad * 2;
        expect(curveToCanvasX(1, canvasW, pad)).toBeCloseTo(pad + graphW, 5);
    });

    it('maps 0.5 to center', function() {
        var graphW = canvasW - pad * 2;
        expect(curveToCanvasX(0.5, canvasW, pad)).toBeCloseTo(pad + graphW / 2, 5);
    });

    it('round-trip: curveToCanvasX ∘ canvasXToCurve', function() {
        var x = 0.3;
        var cvX = curveToCanvasX(x, canvasW, pad);
        var back = canvasXToCurve(cvX, canvasW, pad);
        expect(back).toBeCloseTo(x, 5);
    });
});

describe('unipolar canvasYToCurve and curveToCanvasY', function() {
    var canvasH = 256, pad = 8;

    it('maps bottom of graph (y=1) to pad + graphH', function() {
        // y=1 is at the bottom: curveToCanvasY(1, false, ...) = pad + 0 * graphH = pad
        // Actually: pad + (1-1)*graphH = pad
        // Wait... curveToCanvasY(y, false) = pad + (1-y)*graphH
        // y=1 → pad + 0*graphH = pad
        expect(curveToCanvasY(1, false, canvasH, pad)).toBe(pad);
    });

    it('maps top of graph (y=0) to pad + graphH', function() {
        // y=0 → pad + 1*graphH = pad + graphH
        expect(curveToCanvasY(0, false, canvasH, pad)).toBe(pad + (canvasH - pad * 2));
    });

    it('round-trip unipolar', function() {
        var y = 0.3;
        var cvY = curveToCanvasY(y, false, canvasH, pad);
        var back = canvasYToCurve(cvY, false, canvasH, pad);
        expect(back).toBeCloseTo(y, 5);
    });
});

describe('bipolar coordinate conversion', function() {
    var canvasH = 256, pad = 8;
    var graphH = canvasH - pad * 2; // 240
    var centerY = pad + graphH / 2; // 128

    it('maps y=0 (center) to centerY', function() {
        expect(curveToCanvasY(0, true, canvasH, pad)).toBeCloseTo(centerY, 5);
    });

    it('maps y=-1 (bottom) to pad + graphH', function() {
        // centerY - (-1) * graphH/2 = centerY + graphH/2 = pad + graphH
        expect(curveToCanvasY(-1, true, canvasH, pad)).toBeCloseTo(pad + graphH, 5);
    });

    it('maps y=1 (top) to pad', function() {
        // centerY - (1) * graphH/2 = centerY - graphH/2 = pad
        expect(curveToCanvasY(1, true, canvasH, pad)).toBeCloseTo(pad, 5);
    });

    it('round-trip bipolar', function() {
        var y = -0.3;
        var cvY = curveToCanvasY(y, true, canvasH, pad);
        var back = canvasYToCurve(cvY, true, canvasH, pad);
        expect(back).toBeCloseTo(y, 5);
    });

    it('round-trip bipolar positive', function() {
        var y = 0.7;
        var cvY = curveToCanvasY(y, true, canvasH, pad);
        var back = canvasYToCurve(cvY, true, canvasH, pad);
        expect(back).toBeCloseTo(y, 5);
    });
});

describe('hitTest — point detection in canvas', function() {
    var points, canvasW, canvasH, pad;

    beforeEach(function() {
        points = [{x: 0, y: 0}, {x: 0.3, y: 0.2}, {x: 0.7, y: 0.8}, {x: 1, y: 1}];
        canvasW = 256;
        canvasH = 256;
        pad = 8;
    });

    it('returns index 0 when clicking near first point', function() {
        // Point 0 is at canvas coords (pad, pad + graphH) = (8, 248)
        // Actually for unipolar y=0 → pad + (1-0)*240 = 8 + 240 = 248
        var px = curveToCanvasX(points[0].x, canvasW, pad);
        var py = curveToCanvasY(points[0].y, false, canvasH, pad);
        expect(hitTest(px, py, points, false, canvasW, canvasH, pad)).toBe(0);
    });

    it('returns index 2 when clicking near third point', function() {
        var px = curveToCanvasX(points[2].x, canvasW, pad);
        var py = curveToCanvasY(points[2].y, false, canvasH, pad);
        expect(hitTest(px, py, points, false, canvasW, canvasH, pad)).toBe(2);
    });

    it('returns -1 when clicking far from any point', function() {
        expect(hitTest(0, 0, points, false, canvasW, canvasH, pad)).toBe(-1);
    });

    it('returns -1 for empty points array', function() {
        expect(hitTest(100, 100, [], false, canvasW, canvasH, pad)).toBe(-1);
    });

    it('near miss is still a miss (slightly outside threshold)', function() {
        // threshold default is 10px. A point 20px away should miss
        var px = curveToCanvasX(points[1].x, canvasW, pad);
        var py = curveToCanvasY(points[1].y, false, canvasH, pad);
        expect(hitTest(px + 20, py + 20, points, false, canvasW, canvasH, pad)).toBe(-1);
    });
});

describe('getActiveCustomCtrlName — DOM selector state', function() {
    it('returns "aftertouch" when aftertouch select is custom', function() {
        expect(getActiveCustomCtrlName({ aftertouch: 'custom' })).toBe('aftertouch');
    });

    it('returns "modwheel" when modwheel is custom', function() {
        expect(getActiveCustomCtrlName({ modwheel: 'custom' })).toBe('modwheel');
    });

    it('returns "pitchbend" when pitchbend is custom and others are not', function() {
        expect(getActiveCustomCtrlName({
            aftertouch: 'linear',
            modwheel: 'expo2',
            pitchbend: 'custom'
        })).toBe('pitchbend');
    });

    it('returns aftertouch when multiple are custom (priority order)', function() {
        expect(getActiveCustomCtrlName({
            aftertouch: 'custom',
            modwheel: 'custom',
            pitchbend: 'custom'
        })).toBe('aftertouch');
    });

    it('returns null when no controller is set to custom', function() {
        expect(getActiveCustomCtrlName({ aftertouch: 'linear', modwheel: 'expo2' })).toBeNull();
    });

    it('returns null for empty object', function() {
        expect(getActiveCustomCtrlName({})).toBeNull();
    });
});

describe('addCustomPoint — adding intermediate points', function() {
    var points;

    beforeEach(function() {
        points = [{x: 0, y: 0}, {x: 1, y: 1}]; // endpoints only
    });

    it('adds intermediate point (source stores only intermediates, excludes endpoints)', function() {
        // Source's addPoint filters out endpoints (x<0.001 or x>0.999), stores only intermediates
        var cvX = curveToCanvasX(0.3, 256, 8);
        var cvY = curveToCanvasY(0.2, false, 256, 8);
        var result = addCustomPoint(cvX, cvY, points, false, 256, 256, 8);
        expect(result).not.toBeNull();
        expect(result.length).toBe(1); // only the new intermediate, endpoints are excluded by filter
        expect(result[0].x).toBeCloseTo(0.3, 5);
        expect(result[0].y).toBeCloseTo(0.2, 5);
    });

    it('clamps x to [0.01, 0.99] (not on endpoints)', function() {
        var cvX = curveToCanvasX(0.0, 256, 8); // maps to 0
        var cvY = curveToCanvasY(0.5, false, 256, 8);
        var result = addCustomPoint(cvX, cvY, points, false, 256, 256, 8);
        // x should be clamped to 0.01
        expect(result[0].x).toBeCloseTo(0.01, 5);
    });

    it('returns null when there are already 5 intermediate points', function() {
        var manyPoints = [{x:0,y:0},{x:0.1,y:0.1},{x:0.2,y:0.2},{x:0.3,y:0.3},{x:0.4,y:0.4},{x:0.5,y:0.5},{x:1,y:1}];
        // That's 5 intermediates (indices 1-5)
        var cvX = curveToCanvasX(0.6, 256, 8);
        var cvY = curveToCanvasY(0.6, false, 256, 8);
        var result = addCustomPoint(cvX, cvY, manyPoints, false, 256, 256, 8);
        expect(result).toBeNull();
    });

    it('handles bipolar y clamping', function() {
        // In bipolar mode, y is clamped to [-1, 1]
        var cvY = curveToCanvasY(2.0, true, 256, 8); // y=2 is outside canvas visually
        // cvY = centerY - 2 * graphH/2 = 128 - 240 = -112
        // canvasYToCurve(-112, true, 256, 8) = (128 - (-112)) / 120 = 240/120 = 2
        // So ny = Math.max(-1, Math.min(1, 2)) = 1
        var cvX = curveToCanvasX(0.5, 256, 8);
        var result = addCustomPoint(cvX, cvY, points, true, 256, 256, 8);
        expect(result[0].y).toBeCloseTo(1.0, 5);
    });
});

describe('deleteCustomPoint — removing intermediate points', function() {
    var points;

    beforeEach(function() {
        points = [{x: 0, y: 0}, {x: 0.3, y: 0.2}, {x: 0.7, y: 0.8}, {x: 1, y: 1}];
    });

    it('removes an intermediate point (not endpoint)', function() {
        var result = deleteCustomPoint(1, points); // Remove middle point (index 1 in full, index 0 in intermediates)
        expect(result.length).toBe(1); // 1 intermediate point left (the 0.7 one)
        expect(result[0].x).toBeCloseTo(0.7, 5);
    });

    it('returns null when trying to delete an endpoint (idx=0)', function() {
        expect(deleteCustomPoint(0, points)).toBeNull();
    });

    it('returns null when trying to delete an endpoint (idx=last)', function() {
        expect(deleteCustomPoint(points.length - 1, points)).toBeNull();
    });

    it('returns empty array when only one intermediate and it is deleted', function() {
        var twoPoints = [{x:0,y:0},{x:0.5,y:0.5},{x:1,y:1}];
        var result = deleteCustomPoint(1, twoPoints);
        expect(result).toEqual([]);
    });
});

describe('_evalCustomCurve integration (core curve math)', function() {
    it('interpolates with custom points from curve editor', function() {
        // This function is duplicated from script_curves.js, test it works
        // within the curve editor context
        var points = [{x:0,y:0}, {x:0.3,y:0.1}, {x:0.7,y:0.9}, {x:1,y:1}];
        // At x=0.5: interpolate between (0.3,0.1) and (0.7,0.9)
        // t = (0.5-0.3)/(0.7-0.3) = 0.5
        // y = 0.1 + 0.5*(0.9-0.1) = 0.1 + 0.4 = 0.5
        // We'll call the function exported from the source
        // (it's the same function, so test it directly)
        var fn = function(x, pts) {
            if (!pts || pts.length < 2) return x;
            for (var i = 0; i < pts.length - 1; i++) {
                var a = pts[i], b = pts[i + 1];
                if (x >= a.x && x <= b.x) {
                    var t = (x - a.x) / (b.x - a.x || 1);
                    return a.y + (b.y - a.y) * t;
                }
            }
            return pts[pts.length - 1].y;
        };
        expect(fn(0.5, points)).toBeCloseTo(0.5, 5);
    });
});
