/**
 * @purpose Mod Matrix Canvas Rendering — pure function for drawing the modulation matrix on a <canvas>.
 * Extracted from mod-matrix-canvas.js for SRP separation.
 * Uses MOD_SOURCES_SHORT, MOD_DESTS_SHORT, modSrcColor, modDstColor from mod-matrix-canvas_data.js
 */

/**
 * Dibuja la matriz de modulación completa en un canvas.
 * @param {CanvasRenderingContext2D} ctx - Contexto del canvas
 * @param {number} w - Ancho lógico (sin DPR)
 * @param {number} h - Alto lógico (sin DPR)
 * @param {number} dpr - Device pixel ratio
 * @param {Array} slots - Array de 8 slots con { srcIdx, dstIdx, depth, depthNorm, active, srcName, dstName, srcColor, dstColor }
 * @param {number} hoverSlot - Índice del slot bajo el ratón (-1 si ninguno)
 * @param {number} activeCount - Número de slots activos
 * @param {number} animPhase - Fase de animación actual (radianes)
 */
window.drawModMatrixCanvas = function(ctx, w, h, dpr, slots, hoverSlot, activeCount, animPhase) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.scale(dpr, dpr);

  if (w < 50 || h < 50) { return; }

  const slotH = h / 8;
  const cx = w / 2;
  const srcColRight = 85;
  const dstColLeft = cx + 55;

  ctx.font = '9px "Share Tech Mono", monospace';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 8; i++) {
    const sl = slots[i];
    if (!sl) { continue; }
    const y = i * slotH + slotH / 2;
    const isHover = hoverSlot === i;

    if (!sl.active) {
      ctx.globalAlpha = 0.2;
    } else {
      ctx.globalAlpha = isHover ? 1.0 : 0.7;
    }

    // Source label
    ctx.textAlign = 'right';
    ctx.fillStyle = sl.srcColor || '#666';
    ctx.fillText(sl.srcName, srcColRight - 4, y);

    // Dest label
    ctx.textAlign = 'left';
    ctx.fillStyle = sl.dstColor || '#666';
    ctx.fillText(sl.dstName, dstColLeft + 4, y);

    if (sl.active) {
      // Flow line: source → slot → dest
      const depth = sl.depth;
      const absDepth = Math.abs(depth);
      const lineW = Math.max(1, absDepth * 4 + 1);
      const polarity = depth >= 0 ? 'pos' : 'neg';
      const hue = polarity === 'pos' ? 140 : 330;

      ctx.strokeStyle = 'hsla(' + hue + ', 70%, 55%, ' + (0.3 + absDepth * 0.5) + ')';
      ctx.lineWidth = lineW;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const srcX = srcColRight;
      const dstX = dstColLeft;
      const cpOff = 40;
      ctx.moveTo(srcX, y);
      ctx.bezierCurveTo(srcX + cpOff, y - 3, cx - cpOff, y + 3, cx, y);
      ctx.bezierCurveTo(cx + cpOff, y + 3, dstX - cpOff, y - 3, dstX, y);
      ctx.stroke();

      // Pulse dot animation
      if (isHover) {
        const pulse = Math.sin(animPhase) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(cx, y, 6 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + hue + ', 80%, 60%, ' + (pulse * 0.4) + ')';
        ctx.fill();
      }

      // Slot number badge
      ctx.textAlign = 'center';
      ctx.fillStyle = isHover ? '#fff' : '#aaa';
      ctx.font = 'bold 8px "Share Tech Mono", monospace';
      ctx.fillText('#' + (i + 1), cx, y - 10);

      // Depth text
      ctx.font = '7px "Share Tech Mono", monospace';
      const dStr = (depth >= 0 ? '+' : '') + Math.round(depth * 128);
      ctx.fillStyle = polarity === 'pos' ? '#6abf69' : '#e68a8a';
      ctx.fillText(dStr, cx, y + 11);
    } else {
      // Inactive: ghost slot number
      ctx.textAlign = 'center';
      ctx.fillStyle = '#444';
      ctx.font = 'bold 8px "Share Tech Mono", monospace';
      ctx.fillText('#' + (i + 1), cx, y);
    }

    ctx.globalAlpha = 1.0;
  }

  // Top summary
  ctx.textAlign = 'center';
  ctx.font = '8px "Share Tech Mono", monospace';
  ctx.fillStyle = '#666';
  ctx.fillText('Active: ' + activeCount + '/8', cx, 10);
};
