(function() {
  class SequencerStepsCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = window.devicePixelRatio || 1;
      this.values = Array(32).fill(0);
      this.raw = Array(32).fill(128);
      this.skip = Array(32).fill(false);
      this.activeStep = -1;
      this.seqLength = 16;
      this._hoverStep = -1;
      this._dragging = false;
      this._dragStep = -1;
      this._onChange = null;

      this._handleDown = (e) => {
        const r = this.canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const step = this._stepFromPos(mx);
        if (step < 0 || step >= this.seqLength) {return;}
        this._dragging = true;
        this._dragStep = step;
        this._updateValue(step, my, r.height);
        this.canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      };
      this._handleMove = (e) => {
        const r = this.canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        this._hoverStep = this._stepFromPos(mx);
        if (this._dragging && this._dragStep >= 0) {
          this._updateValue(this._dragStep, my, r.height);
        }
        this._draw();
      };
      this._handleUp = () => {
        if (this._dragging) {
          this._dragging = false;
          this._dragStep = -1;
        }
      };
      this._handleLeave = () => {
        this._hoverStep = -1;
        if (!this._dragging) {this._draw();}
      };
      this._handleDblClick = (e) => {
        const r = this.canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const step = this._stepFromPos(mx);
        if (step < 0 || step >= this.seqLength) {return;}
        this._setStepValue(step, 0);
        this._fireChange(step);
      };

      canvas.addEventListener('pointerdown', this._handleDown);
      canvas.addEventListener('pointermove', this._handleMove);
      canvas.addEventListener('pointerup', this._handleUp);
      canvas.addEventListener('pointercancel', this._handleUp);
      canvas.addEventListener('mouseleave', this._handleLeave);
      canvas.addEventListener('dblclick', this._handleDblClick);
    }

    syncFromArrays(values, raw) {
      for (let i = 0; i < 32; i++) {
        this.values[i] = (values && values[i] !== undefined) ? values[i] : 0;
        this.raw[i] = (raw && raw[i] !== undefined) ? raw[i] : 128;
        this.skip[i] = this.raw[i] === 0;
      }
      this._draw();
    }

    setActiveStep(step) {
      this.activeStep = step;
      this._draw();
    }

    setSeqLength(len) {
      this.seqLength = Math.max(1, Math.min(32, len));
      this._draw();
    }

    setOnChange(fn) {
      this._onChange = fn;
    }

    resize() {
      const parent = this.canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      this.w = rect.width;
      this.h = rect.height;
      this.canvas.width = this.w * this.dpr;
      this.canvas.height = this.h * this.dpr;
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.ctx.scale(this.dpr, this.dpr);
      this._draw();
    }

    _stepFromPos(mx) {
      if (!this.w) {return -1;}
      const stepW = this.w / 32;
      const s = Math.floor(mx / stepW);
      return (s >= 0 && s < 32) ? s : -1;
    }

    _updateValue(step, my, totalH) {
      const relY = my / totalH;
      const normVal = 1.0 - Math.max(0, Math.min(1, relY));
      const bipolar = Math.round((normVal * 255) - 128);
      const clamped = Math.max(-128, Math.min(127, bipolar));
      const finalVal = Math.abs(clamped) <= 2 ? 0 : clamped;
      this._setStepValue(step, finalVal);
      this._fireChange(step);
    }

    _setStepValue(step, val) {
      this.values[step] = val;
      this.raw[step] = val + 128;
      this.skip[step] = this.raw[step] === 0;
    }

    _fireChange(step) {
      if (this._onChange) {this._onChange(step, this.values[step], this.raw[step]);}
      // Update global arrays for compatibility
      if (window.seqStepsValues) {window.seqStepsValues[step] = this.values[step];}
      if (window.seqStepsRaw) {window.seqStepsRaw[step] = this.raw[step];}
    }

    _draw() {
      const ctx = this.ctx;
      const w = this.w;
      const h = this.h;
      const dpr = this.dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w * dpr, h * dpr);
      ctx.scale(dpr, dpr);

      if (w < 20 || h < 20) {return;}

      const stepW = w / 32;
      const midY = h / 2;
      const barMaxH = h * 0.42;

      ctx.font = '7px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < 32; i++) {
        const x = i * stepW;
        const inActiveRange = i < this.seqLength;
        const isActiveStep = i === this.activeStep;
        const isHover = this._hoverStep === i;
        const val = this.values[i];
        const isSkip = this.skip[i];
        const pct = val / 127;

        // Background
        ctx.fillStyle = !inActiveRange
          ? 'rgba(30,30,30,0.4)'
          : (isActiveStep ? 'rgba(232,138,138,0.08)' : (isHover ? 'rgba(255,255,255,0.04)' : 'transparent'));
        ctx.fillRect(x + 0.5, 0, stepW - 1, h);

        // Bar
        if (inActiveRange && !isSkip) {
          const barH = Math.abs(pct) * barMaxH;
          const barY = pct >= 0 ? midY - barH : midY;
          const hue = pct >= 0 ? 140 : 330;
          const alpha = Math.max(0.3, Math.abs(pct) * 0.7 + 0.3);
          ctx.fillStyle = isActiveStep
            ? `hsla(${hue}, 80%, 60%, ${alpha})`
            : `hsla(${hue}, 50%, 45%, ${alpha * 0.7})`;
          ctx.fillRect(x + 2, barY, stepW - 4, Math.max(1, barH));
        }

        // Zero line
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, midY);
        ctx.lineTo(x + stepW, midY);
        ctx.stroke();

        // Step number
        ctx.fillStyle = inActiveRange ? (isActiveStep ? '#e68a8a' : '#555') : '#333';
        ctx.fillText(i + 1, x + stepW / 2, 7);

        // Value text
        if (inActiveRange) {
          const displayVal = isSkip ? '--' : (val >= 0 ? '+' + val : String(val));
          ctx.fillStyle = isSkip ? '#e74c3c' : (isActiveStep ? '#e68a8a' : '#888');
          ctx.font = `bold ${Math.max(5, stepW * 0.3)}px "Share Tech Mono", monospace`;
          ctx.fillText(displayVal, x + stepW / 2, h - 8);
        }

        // Active step highlight border
        if (isActiveStep) {
          ctx.strokeStyle = 'rgba(232,138,138,0.5)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1, 1, stepW - 2, h - 2);
        }

        // Skip indicator (X mark)
        if (isSkip && inActiveRange) {
          ctx.strokeStyle = 'rgba(231,76,60,0.4)';
          ctx.lineWidth = 1;
          const sx = x + stepW / 2;
          ctx.beginPath();
          ctx.moveTo(sx - 4, midY - 4);
          ctx.lineTo(sx + 4, midY + 4);
          ctx.moveTo(sx + 4, midY - 4);
          ctx.lineTo(sx - 4, midY + 4);
          ctx.stroke();
        }
      }

      // Active step label
      if (this.activeStep >= 0 && this.activeStep < this.seqLength) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const label = `▶ Step ${this.activeStep + 1}`;
        const tw = ctx.measureText(label).width + 10;
        ctx.fillRect(w - tw - 4, 2, tw, 14);
        ctx.fillStyle = '#e68a8a';
        ctx.font = 'bold 8px "Share Tech Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(label, w - 4, 4);
      }
    }
  }

  window.SequencerStepsCanvas = SequencerStepsCanvas;
})();
