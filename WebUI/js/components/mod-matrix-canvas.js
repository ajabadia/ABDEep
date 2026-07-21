(function() {
  const MOD_SOURCES_SHORT = [
    'None','P.Bend','M.Wheel','Foot','Breath','Press','Expr','LFO1',
    'LFO2','Env1','Env2','Env3','Note#','Vel','OffVel','Seq',
    'LFO1Uni','LFO2Uni','LFO1Fd','LFO2Fd','V#','UniV','CC115','CC116','CC117'
  ];
  const MOD_DESTS_SHORT = [
    'None','LFO1Rt','LFO1Dly','LFO1Slw','LFO1Shp','LFO2Rt','LFO2Dly','LFO2Slw',
    'LFO2Shp','O1+2Pit','O1+2Fin','O1Pit','O1Fin','O2Pit','O2Fin','O1PM',
    'PWM','TMod','O2PM','Porta','VCFf','VCFr','VCFenv','VCFlfo',
    'EnvRts','AllA','AllD','AllS','AllR','E1Rts','E2Rts','E3Rts',
    'E1Cur','E2Cur','E3Cur','E1A','E1D','E1S','E1R','E1AC',
    'E1DC','E1SC','E1RC','E2A','E2D','E2S','E2R','E2AC',
    'E2DC','E2SC','E2RC','E3A','E3D','E3S','E3R','E3AC',
    'E3DC','E3SC','E3RC','VCA','VCAAct','VCAEnv','PanSpr','VCPan',
    'O2Lvl','Noise','HPF','UniDt','Drift','P.Drift','DrfRt','ArpG',
    'SeqSlw',
    '','','','','','','','','','','','','','','','','','','','',
    '','','','','','','','','','','','','','','','','','','','',
    '','','','','','','','','','','','','','','','','','','','',
    '','','','','','','','','','','','','','','','','','','','',
    '','','','','','','','','','','','','','','','','','','','',
    '','','','','','','','','','','','','','','','','','','','',
    '','','','','','','','','','','','','','','','','','','','',
    '','','','','','','','','','','','','','','','','','','','',
    'Fx1','Fx2','Fx3','Fx4'
  ];
  function srcColor(i) {
    if (i===0) {return null;}
    if (i<=6) {return '#5b9bd5';}
    if (i===7||i===8||(i>=16&&i<=19)) {return '#4ecdc4';}
    if (i<=11) {return '#6abf69';}
    if (i<=14) {return '#d4a843';}
    return '#e68a8a';
  }
  function dstColor(i) {
    if (i===0) {return null;}
    if (i<=8) {return '#4ecdc4';}
    if (i<=18) {return '#5b9bd5';}
    if (i<=23) {return '#e68a8a';}
    if (i<=62) {return '#6abf69';}
    if (i===63||i===64) {return '#d4a843';}
    return '#888';
  }

  class ModMatrixCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = window.devicePixelRatio || 1;
      this.slots = [];
      this.hoverSlot = -1;
      this.activeCount = 0;
      this.animPhase = 0;
      this._onParamChange = null;
      this._onClick = null;

      this._handleClick = (e) => {
        const r = this.canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const slot = this._hitTest(mx, my);
        if (slot >= 0 && this._onClick) {this._onClick(slot, mx, my);}
      };
      this._handleMove = (e) => {
        const r = this.canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        this.hoverSlot = this._hitTest(mx, my);
        if (this.hoverSlot === -1) {
          this.hoverSlot = this._hitTestLabel(mx, my, 'source');
          if (this.hoverSlot === -1) {
            this.hoverSlot = this._hitTestLabel(mx, my, 'dest');
          }
        }
        this._draw();
      };
      this._handleLeave = () => {
        this.hoverSlot = -1;
        this._draw();
      };

      canvas.addEventListener('click', this._handleClick);
      canvas.addEventListener('mousemove', this._handleMove);
      canvas.addEventListener('mouseleave', this._handleLeave);
    }

    syncFromCache(cache) {
      this.slots = [];
      this.activeCount = 0;
      for (let s = 1; s <= 8; s++) {
        const srcRaw = cache[`mod_matrix_slot${s}_src`] || 0;
        const dstRaw = cache[`mod_matrix_slot${s}_dest`] || 0;
        const depRaw = cache[`mod_matrix_slot${s}_depth`];
        const depthVal = (depRaw !== undefined && depRaw !== null) ? depRaw : 0.5;
        const srcIdx = Math.round(srcRaw * 22);
        const dstIdx = Math.round(dstRaw * 129);
        const active = srcIdx > 0;
        if (active) {this.activeCount++;}
        this.slots.push({
          srcIdx, dstIdx,
          depth: (depthVal * 2) - 1,
          depthNorm: depthVal,
          active,
          srcName: MOD_SOURCES_SHORT[srcIdx] || '?',
          dstName: MOD_DESTS_SHORT[dstIdx] || '?',
          srcColor: srcColor(srcIdx),
          dstColor: dstColor(dstIdx)
        });
      }
      this._draw();
    }

    setCallbacks(onClickSlot) {
      this._onClick = onClickSlot;
    }

    startAnim() {
      const loop = () => {
        this.animPhase = (this.animPhase + 0.02) % (Math.PI * 2);
        if (this.activeCount > 0) {this._draw();}
        this._animId = requestAnimationFrame(loop);
      };
      this._animId = requestAnimationFrame(loop);
    }

    stopAnim() {
      if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.canvas.width = rect.width * this.dpr;
      this.canvas.height = rect.height * this.dpr;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.ctx.scale(this.dpr, this.dpr);
      this.w = rect.width;
      this.h = rect.height;
      this._draw();
    }

    _hitTest(mx, my) {
      const slotH = this.h / 8;
      const slotW = 120;
      const cx = this.w / 2;
      const left = cx - slotW / 2;
      const right = cx + slotW / 2;
      for (let i = 0; i < 8; i++) {
        const y = i * slotH + slotH / 2;
        if (mx >= left && mx <= right && my >= y - 12 && my <= y + 12) {return i;}
      }
      return -1;
    }

    _hitTestLabel(mx, my, side) {
      const slotH = this.h / 8;
      const colW = 80;
      const cx = this.w / 2;
      let x1, x2;
      if (side === 'source') { x1 = 10; x2 = 10 + colW; }
      else { x1 = cx + 60; x2 = cx + 60 + colW; }
      for (let i = 0; i < 8; i++) {
        const y = i * slotH + slotH / 2;
        if (mx >= x1 && mx <= x2 && my >= y - 8 && my <= y + 8) {return i;}
      }
      return -1;
    }

    _draw() {
      const ctx = this.ctx;
      const w = this.w;
      const h = this.h;
      const dpr = this.dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w * dpr, h * dpr);
      ctx.scale(dpr, dpr);

      if (w < 50 || h < 50) {return;}

      const slotH = h / 8;
      const cx = w / 2;
      const srcColRight = 85;
      const dstColLeft = cx + 55;

      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < 8; i++) {
        const sl = this.slots[i];
        if (!sl) {continue;}
        const y = i * slotH + slotH / 2;
        const isHover = this.hoverSlot === i;

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

          ctx.strokeStyle = `hsla(${hue}, 70%, 55%, ${0.3 + absDepth * 0.5})`;
          ctx.lineWidth = lineW;
          ctx.lineCap = 'round';
          ctx.beginPath();
          // Bezier: from source area to slot center to dest area
          const srcX = srcColRight;
          const dstX = dstColLeft;
          const cpOff = 40;
          ctx.moveTo(srcX, y);
          ctx.bezierCurveTo(srcX + cpOff, y - 3, cx - cpOff, y + 3, cx, y);
          ctx.bezierCurveTo(cx + cpOff, y + 3, dstX - cpOff, y - 3, dstX, y);
          ctx.stroke();

          // Pulse dot animation
          if (isHover) {
            const pulse = Math.sin(this.animPhase) * 0.3 + 0.7;
            ctx.beginPath();
            ctx.arc(cx, y, 6 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${pulse * 0.4})`;
            ctx.fill();
          }

          // Slot number badge
          ctx.textAlign = 'center';
          ctx.fillStyle = isHover ? '#fff' : '#aaa';
          ctx.font = 'bold 8px "Share Tech Mono", monospace';
          ctx.fillText(`#${i + 1}`, cx, y - 10);

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
          ctx.fillText(`#${i + 1}`, cx, y);
        }

        ctx.globalAlpha = 1.0;
      }

      // Top summary
      ctx.textAlign = 'center';
      ctx.font = '8px "Share Tech Mono", monospace';
      ctx.fillStyle = '#666';
      ctx.fillText(`Active: ${this.activeCount}/8`, cx, 10);
    }
  }

  window.ModMatrixCanvas = ModMatrixCanvas;
})();
