/**
 * @purpose Custom curve canvas drag/drop interaction for the response curve editor.
 * Canvas drawing extraído a settings_curves_draw.js.
 */

(function() {
    window._lastCurveType = 'linear';
    window._lastCurveIsBipolar = false;

    function _getActiveCustomCtrlName() {
        const atSel = document.getElementById('settings-curve-aftertouch');
        const mwSel = document.getElementById('settings-curve-modwheel');
        const pbSel = document.getElementById('settings-curve-pitchbend');
        if (atSel && atSel.value === 'custom') {return 'aftertouch';}
        if (mwSel && mwSel.value === 'custom') {return 'modwheel';}
        if (pbSel && pbSel.value === 'custom') {return 'pitchbend';}
        return null;
    }

    window._setupCustomCurveCanvas = function() {
        const canvas = document.getElementById('curve-preview-canvas');
        if (!canvas || canvas._customCurveSetupDone) {return;}
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
                if (dx * dx + dy * dy < 100) {return i;}
            }
            return -1;
        }

        function addPoint(cvX, cvY, ctrlName, bipolar) {
            const nx = Math.max(0.01, Math.min(0.99, canvasXToCurve(cvX)));
            let ny = Math.max(0, Math.min(1, canvasYToCurve(cvY, bipolar)));
            if (bipolar) {ny = Math.max(-1, Math.min(1, ny));}
            const points = window.getCustomCurvePoints(ctrlName);
            const intermediates = points.filter(p => p.x > 0.001 && p.x < 0.999);
            if (intermediates.length >= 5) {return;}
            intermediates.push({x: nx, y: ny});
            intermediates.sort((a, b) => a.x - b.x);
            window.setCustomCurvePoints(ctrlName, intermediates);
            _redrawCustom();
        }

        function deletePoint(idx, points, ctrlName) {
            if (idx <= 0 || idx >= points.length - 1) {return;}
            const intermediates = points.filter(p => p.x > 0.001 && p.x < 0.999);
            intermediates.splice(idx - 1, 1);
            window.setCustomCurvePoints(ctrlName, intermediates);
            _redrawCustom();
        }

        function _redrawCustom() {
            if (typeof window.drawCurvePreview === 'function') {
                window.drawCurvePreview('custom', window._lastCurveIsBipolar);
            }
        }

        canvas.addEventListener('pointerdown', (e) => {
            const ctrlName = _getActiveCustomCtrlName();
            if (!ctrlName) {return;}
            if (window._lastCurveType !== 'custom') {return;}
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
            if (!dragState) {return;}
            const rect = canvas.getBoundingClientRect();
            const cvX = e.clientX - rect.left;
            const cvY = e.clientY - rect.top;
            const points = window.getCustomCurvePoints(dragState.ctrlName);
            if (dragState.idx < 0 || dragState.idx >= points.length) {return;}
            let nx = Math.max(0, Math.min(1, canvasXToCurve(cvX - dragState.offsetX)));
            let ny = Math.max(0, Math.min(1, canvasYToCurve(cvY - dragState.offsetY, window._lastCurveIsBipolar)));
            if (window._lastCurveIsBipolar) {ny = Math.max(-1, Math.min(1, ny));}
            
            if (dragState.idx === 0) { nx = 0; ny = 0; }
            if (dragState.idx === points.length - 1) { nx = 1; ny = 1; }
            
            if (dragState.idx > 0) {nx = Math.max(nx, points[dragState.idx - 1].x + 0.01);}
            if (dragState.idx < points.length - 1) {nx = Math.min(nx, points[dragState.idx + 1].x - 0.01);}
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
            if (!ctrlName || window._lastCurveType !== 'custom') {return;}
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
