/**
 * @purpose Curve preview canvas drawing and custom curve interpolation.
 * Extraído de settings_curves.js.
 */

(function() {
    const _customCurveState = null;

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

    function _getActiveCustomCtrlName() {
        const atSel = document.getElementById('settings-curve-aftertouch');
        const mwSel = document.getElementById('settings-curve-modwheel');
        const pbSel = document.getElementById('settings-curve-pitchbend');
        if (atSel && atSel.value === 'custom') {return 'aftertouch';}
        if (mwSel && mwSel.value === 'custom') {return 'modwheel';}
        if (pbSel && pbSel.value === 'custom') {return 'pitchbend';}
        return null;
    }

    window.drawCurvePreview = function(curveType, bipolar) {
        if (bipolar === undefined) {bipolar = false;}
        window._lastCurveType = curveType;
        window._lastCurveIsBipolar = bipolar;
        const canvas = document.getElementById('curve-preview-canvas');
        if (!canvas) {return;}
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const pad = 8;
        const graphW = w - pad * 2;
        const graphH = h - pad * 2;
        const centerY = pad + graphH / 2;

        ctx.clearRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const x = pad + (i / 4) * graphW;
            const y = pad + (1 - i / 4) * graphH;
            ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + graphH); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + graphW, y); ctx.stroke();
        }

        // Center line for bipolar
        if (bipolar) {
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad, centerY);
            ctx.lineTo(pad + graphW, centerY);
            ctx.stroke();
        }

        // Diagonal reference
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(pad, pad + graphH);
        ctx.lineTo(pad + graphW, pad);
        ctx.stroke();
        ctx.setLineDash([]);

        // Curve line
        const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#ff9900';
        ctx.strokeStyle = brandColor;
        ctx.lineWidth = 2;
        ctx.beginPath();

        let customPoints = null;
        if (curveType === 'custom') {
            const ctrlName = _getActiveCustomCtrlName();
            if (ctrlName) {customPoints = window.getCustomCurvePoints(ctrlName);}
        }

        for (let px = 0; px <= graphW; px++) {
            const t = px / graphW;
            let canvasY;

            if (bipolar) {
                const input = t * 2 - 1;
                let output;
                if (curveType === 'custom' && customPoints) {
                    const abs = Math.abs(input);
                    const sign = input >= 0 ? 1 : -1;
                    output = sign * _evalCustomCurve(abs, customPoints);
                } else {
                    output = typeof window.applyBipolarCurve === 'function'
                        ? window.applyBipolarCurve(input, curveType)
                        : input;
                }
                canvasY = centerY - output * (graphH / 2);
            } else {
                let y;
                if (curveType === 'custom' && customPoints) {
                    y = _evalCustomCurve(t, customPoints);
                } else {
                    y = typeof window.applyControllerCurve === 'function'
                        ? window.applyControllerCurve(t, curveType)
                        : t;
                }
                canvasY = pad + graphH - y * graphH;
            }

            const canvasX = pad + px;
            if (px === 0) {ctx.moveTo(canvasX, canvasY);}
            else {ctx.lineTo(canvasX, canvasY);}
        }
        ctx.stroke();

        // Label
        const CURVE_LABELS = {
            'linear': 'Linear',
            'expo2':  'Quadratic',
            'expo3':  'Cubic',
            'log':    'Log',
            's-curve':'S-Curve',
            'custom': 'Custom'
        };
        const label = (bipolar ? 'Bipolar ' : '') + (CURVE_LABELS[curveType] || curveType);
        ctx.fillStyle = brandColor;
        ctx.font = 'bold 8px Share Tech Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(label, pad + graphW, pad + 9);
        ctx.textAlign = 'start';

        // Axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '7px Share Tech Mono, monospace';
        if (bipolar) {
            ctx.fillText('-1', pad, pad + graphH + 7);
            ctx.fillText('0', pad + graphW / 2 - 3, pad + graphH + 7);
            ctx.fillText('+1', pad + graphW - 7, pad + graphH + 7);
        } else {
            ctx.fillText('0', pad, pad + graphH + 7);
            ctx.fillText('1', pad + graphW - 5, pad + graphH + 7);
        }

        // Custom curve nodes
        if (curveType === 'custom') {
            const ctrlName = _getActiveCustomCtrlName();
            if (ctrlName) {
                const points = window.getCustomCurvePoints(ctrlName);
                for (let i = 0; i < points.length; i++) {
                    let cx, cy;
                    if (bipolar) {
                        const input = points[i].x * 2 - 1;
                        const output = points[i].y;
                        cx = pad + (input + 1) / 2 * graphW;
                        cy = centerY - output * (graphH / 2);
                    } else {
                        cx = pad + points[i].x * graphW;
                        cy = pad + graphH - points[i].y * graphH;
                    }
                    const isEndpoint = (i === 0 || i === points.length - 1);
                    const isSelected = _customCurveState && _customCurveState.selIdx === i;
                    const radius = isEndpoint ? 3 : 4;
                    
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
                    ctx.fillStyle = isSelected ? brandColor : 'rgba(255,255,255,0.5)';
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                    ctx.fillStyle = isEndpoint ? 'rgba(255,255,255,0.3)' : brandColor;
                    ctx.fill();
                    
                    if (isEndpoint) {
                        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(cx + 3, cy + 3);
                        ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx - 3, cy + 3);
                        ctx.stroke();
                    }
                }
            }
        }
    };
})();
