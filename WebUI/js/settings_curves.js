/**
 * @purpose Handles drawing curve previews and managing the custom response curves canvas drag/drop nodes.
 * @purpose_en Interactive response curve previews and editor.
 */

(function() {
    window._lastCurveType = 'linear';
    window._lastCurveIsBipolar = false;
    let _customCurveState = null;

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

    function _getActiveCustomCtrlName() {
        const atSel = document.getElementById('settings-curve-aftertouch');
        const mwSel = document.getElementById('settings-curve-modwheel');
        const pbSel = document.getElementById('settings-curve-pitchbend');
        if (atSel && atSel.value === 'custom') return 'aftertouch';
        if (mwSel && mwSel.value === 'custom') return 'modwheel';
        if (pbSel && pbSel.value === 'custom') return 'pitchbend';
        return null;
    }

    window.drawCurvePreview = function(curveType, bipolar = false) {
        window._lastCurveType = curveType;
        window._lastCurveIsBipolar = bipolar;
        const canvas = document.getElementById('curve-preview-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const pad = 8;
        const graphW = w - pad * 2;
        const graphH = h - pad * 2;
        const centerY = pad + graphH / 2;

        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const x = pad + (i / 4) * graphW;
            const y = pad + (1 - i / 4) * graphH;
            ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + graphH); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + graphW, y); ctx.stroke();
        }

        if (bipolar) {
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad, centerY);
            ctx.lineTo(pad + graphW, centerY);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        if (bipolar) {
            ctx.moveTo(pad, pad + graphH);
            ctx.lineTo(pad + graphW, pad);
        } else {
            ctx.moveTo(pad, pad + graphH);
            ctx.lineTo(pad + graphW, pad);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#ff9900';
        ctx.strokeStyle = brandColor;
        ctx.lineWidth = 2;
        ctx.beginPath();

        let customPoints = null;
        if (curveType === 'custom') {
            const ctrlName = _getActiveCustomCtrlName();
            if (ctrlName) customPoints = window.getCustomCurvePoints(ctrlName);
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
            if (px === 0) ctx.moveTo(canvasX, canvasY);
            else ctx.lineTo(canvasX, canvasY);
        }
        ctx.stroke();

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

    window._setupCustomCurveCanvas = function() {
        const canvas = document.getElementById('curve-preview-canvas');
        if (!canvas || canvas._customCurveSetupDone) return;
        canvas._customCurveSetupDone = true;

        let dragState = null;

        function canvasXToCurve(cvX) {
            const pad = 8, graphW = canvas.width - 16;
            return (cvX - pad) / graphW;
        }
        function canvasYToCurve(cvY, bipolar) {
            const pad = 8, graphH = canvas.height - 16;
            if (bipolar) {
                const centerY = pad + graphH / 2;
                return (centerY - cvY) / (graphH / 2);
            }
            return 1.0 - (cvY - pad) / graphH;
        }
        function curveToCanvasX(x) {
            const pad = 8, graphW = canvas.width - 16;
            return pad + x * graphW;
        }
        function curveToCanvasY(y, bipolar) {
            const pad = 8, graphH = canvas.height - 16;
            if (bipolar) {
                const centerY = pad + graphH / 2;
                return centerY - y * (graphH / 2);
            }
            return pad + (1 - y) * graphH;
        }

        function hitTest(cvX, cvY, points, bipolar) {
            for (let i = 0; i < points.length; i++) {
                const px = curveToCanvasX(points[i].x);
                const py = curveToCanvasY(points[i].y, bipolar);
                const dx = cvX - px, dy = cvY - py;
                if (dx * dx + dy * dy < 100) return i;
            }
            return -1;
        }

        function addPoint(cvX, cvY, ctrlName, bipolar) {
            let nx = Math.max(0.01, Math.min(0.99, canvasXToCurve(cvX)));
            let ny = Math.max(0, Math.min(1, canvasYToCurve(cvY, bipolar)));
            if (bipolar) ny = Math.max(-1, Math.min(1, ny));
            const points = window.getCustomCurvePoints(ctrlName);
            const intermediates = points.filter(p => p.x > 0.001 && p.x < 0.999);
            if (intermediates.length >= 5) return;
            intermediates.push({x: nx, y: ny});
            intermediates.sort((a, b) => a.x - b.x);
            window.setCustomCurvePoints(ctrlName, intermediates);
            _redrawCustom();
        }

        function deletePoint(idx, points, ctrlName) {
            if (idx <= 0 || idx >= points.length - 1) return;
            const intermediates = points.filter(p => p.x > 0.001 && p.x < 0.999);
            intermediates.splice(idx - 1, 1);
            window.setCustomCurvePoints(ctrlName, intermediates);
            _redrawCustom();
        }

        function _redrawCustom() {
            window.drawCurvePreview('custom', window._lastCurveIsBipolar);
        }

        canvas.addEventListener('pointerdown', (e) => {
            const ctrlName = _getActiveCustomCtrlName();
            if (!ctrlName) return;
            if (window._lastCurveType !== 'custom') return;
            const rect = canvas.getBoundingClientRect();
            const cvX = e.clientX - rect.left;
            const cvY = e.clientY - rect.top;
            const points = window.getCustomCurvePoints(ctrlName);
            const hit = hitTest(cvX, cvY, points, window._lastCurveIsBipolar);
            if (hit >= 0) {
                dragState = {
                    idx: hit,
                    ctrlName: ctrlName,
                    offsetX: cvX - curveToCanvasX(points[hit].x),
                    offsetY: cvY - curveToCanvasY(points[hit].y, window._lastCurveIsBipolar)
                };
                canvas.setPointerCapture(e.pointerId);
                e.preventDefault();
            } else {
                addPoint(cvX, cvY, ctrlName, window._lastCurveIsBipolar);
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!dragState) return;
            const rect = canvas.getBoundingClientRect();
            const cvX = e.clientX - rect.left;
            const cvY = e.clientY - rect.top;
            const points = window.getCustomCurvePoints(dragState.ctrlName);
            if (dragState.idx < 0 || dragState.idx >= points.length) return;
            let nx = Math.max(0, Math.min(1, canvasXToCurve(cvX - dragState.offsetX)));
            let ny = Math.max(0, Math.min(1, canvasYToCurve(cvY - dragState.offsetY, window._lastCurveIsBipolar)));
            if (window._lastCurveIsBipolar) ny = Math.max(-1, Math.min(1, ny));
            
            if (dragState.idx === 0) { nx = 0; ny = 0; }
            if (dragState.idx === points.length - 1) { nx = 1; ny = 1; }
            
            if (dragState.idx > 0) nx = Math.max(nx, points[dragState.idx - 1].x + 0.01);
            if (dragState.idx < points.length - 1) nx = Math.min(nx, points[dragState.idx + 1].x - 0.01);
            points[dragState.idx].x = nx;
            points[dragState.idx].y = ny;
            
            const intermediates = points.filter(p => p.x > 0.001 && p.x < 0.999);
            window.setCustomCurvePoints(dragState.ctrlName, intermediates);
            _redrawCustom();
            e.preventDefault();
        });

        canvas.addEventListener('pointerup', () => {
            dragState = null;
        });

        canvas.addEventListener('pointercancel', () => {
            dragState = null;
        });

        canvas.addEventListener('contextmenu', (e) => {
            const ctrlName = _getActiveCustomCtrlName();
            if (!ctrlName || window._lastCurveType !== 'custom') return;
            const rect = canvas.getBoundingClientRect();
            const cvX = e.clientX - rect.left;
            const cvY = e.clientY - rect.top;
            const points = window.getCustomCurvePoints(ctrlName);
            const hit = hitTest(cvX, cvY, points, window._lastCurveIsBipolar);
            if (hit >= 0) {
                deletePoint(hit, points, ctrlName);
                e.preventDefault();
            }
        });
    };
})();
