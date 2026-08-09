/**
 * @purpose Mod Matrix Canvas — interactive canvas widget for modulation matrix visualization.
 * Data tables (MOD_SOURCES_SHORT, MOD_DESTS_SHORT, color helpers) in mod-matrix-canvas_data.js.
 * Canvas rendering (_draw) in mod-matrix-canvas_render.js.
 */

(function() {
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
        if (slot >= 0 && this._onClick) { this._onClick(slot, mx, my); }
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
      const sources = window.MOD_SOURCES_SHORT;
      const dests = window.MOD_DESTS_SHORT;
      for (let s = 1; s <= 8; s++) {
        const srcRaw = cache['mod_matrix_slot' + s + '_src'] || 0;
        const dstRaw = cache['mod_matrix_slot' + s + '_dest'] || 0;
        const depRaw = cache['mod_matrix_slot' + s + '_depth'];
        const depthVal = (depRaw !== undefined && depRaw !== null) ? depRaw : 0.5;
        const srcIdx = Math.round(srcRaw * 22);
        const dstIdx = Math.round(dstRaw * 129);
        const active = srcIdx > 0;
        if (active) { this.activeCount++; }
        this.slots.push({
          srcIdx: srcIdx, dstIdx: dstIdx,
          depth: (depthVal * 2) - 1,
          depthNorm: depthVal,
          active: active,
          srcName: sources[srcIdx] || '?',
          dstName: dests[dstIdx] || '?',
          srcColor: window.modSrcColor(srcIdx),
          dstColor: window.modDstColor(dstIdx)
        });
      }
      this._draw();
    }

    setCallbacks(onClickSlot) {
      this._onClick = onClickSlot;
    }

    startAnim() {
      const self = this;
      function loop() {
        self.animPhase = (self.animPhase + 0.02) % (Math.PI * 2);
        if (self.activeCount > 0) { self._draw(); }
        self._animId = requestAnimationFrame(loop);
      }
      self._animId = requestAnimationFrame(loop);
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
        if (mx >= left && mx <= right && my >= y - 12 && my <= y + 12) { return i; }
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
        if (mx >= x1 && mx <= x2 && my >= y - 8 && my <= y + 8) { return i; }
      }
      return -1;
    }

    _draw() {
      window.drawModMatrixCanvas(
        this.ctx, this.w, this.h, this.dpr,
        this.slots, this.hoverSlot, this.activeCount, this.animPhase
      );
    }
  }

  window.ModMatrixCanvas = ModMatrixCanvas;
})();
