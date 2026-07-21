(function() {
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const IS_BLACK = [false,true,false,true,false,false,true,false,true,false,true,false];

  class ChordDisplayCanvas {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = window.devicePixelRatio || 1;
      this.startNote = (opts && opts.startNote) || 48;
      this.endNote = (opts && opts.endNote) || 72;
      this.activeNotes = [];
      this.chordLabel = '';
      this._hoverNote = -1;
      this._onNoteClick = null;

      this._handleMove = (e) => {
        const n = this._noteFromPos(e);
        this._hoverNote = n;
        this._draw();
        if (this.canvas.style) {
          this.canvas.style.cursor = n >= 0 ? 'pointer' : 'default';
        }
      };
      this._handleLeave = () => {
        this._hoverNote = -1;
        this._draw();
      };
      this._handleClick = (e) => {
        const n = this._noteFromPos(e);
        if (n >= 0 && this._onNoteClick) {this._onNoteClick(n);}
      };

      canvas.addEventListener('mousemove', this._handleMove);
      canvas.addEventListener('mouseleave', this._handleLeave);
      canvas.addEventListener('click', this._handleClick);
    }

    setActiveNotes(notes) {
      this.activeNotes = (notes || []).filter(n => n >= this.startNote && n <= this.endNote);
      this._detectChord();
      this._draw();
    }

    setChordLabel(label) {
      this.chordLabel = label || '';
      this._draw();
    }

    setCallbacks(onNoteClick) {
      this._onNoteClick = onNoteClick;
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
      this._initLayout();
      this._draw();
    }

    _initLayout() {
      this.whiteKeys = [];
      this.blackKeys = [];
      for (let n = this.startNote; n <= this.endNote; n++) {
        const cls = n % 12;
        if (IS_BLACK[cls]) {
          this.blackKeys.push(n);
        } else {
          this.whiteKeys.push(n);
        }
      }
      const numWhite = this.whiteKeys.length;
      this.wKeyW = numWhite > 0 ? (this.w - 4) / numWhite : 10;
      this.wKeyH = this.h - 4;
      this.bKeyW = this.wKeyW * 0.62;
      this.bKeyH = this.wKeyH * 0.6;
    }

    _noteFromPos(e) {
      const r = this.canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;

      // Check black keys first (they're on top)
      for (const n of this.blackKeys) {
        const { x, w, h } = this._blackKeyRect(n);
        if (mx >= x && mx <= x + w && my >= 0 && my <= h) {return n;}
      }
      // Check white keys
      for (const n of this.whiteKeys) {
        const { x, w, h } = this._whiteKeyRect(n);
        if (mx >= x && mx <= x + w && my >= 0 && my <= h) {return n;}
      }
      return -1;
    }

    _whiteKeyIdx(n) {
      return this.whiteKeys.indexOf(n);
    }

    _whiteKeyRect(n) {
      const idx = this._whiteKeyIdx(n);
      return { x: 2 + idx * this.wKeyW, w: this.wKeyW - 1, h: this.wKeyH };
    }

    _blackKeyRect(n) {
      const whiteIdx = this._whiteKeyIdx(n - 1);
      const offset = n % 12;
      let leftOff;
      if (offset === 1) {leftOff = 0.65;}
      else if (offset === 3) {leftOff = 1.15;}
      else if (offset === 6) {leftOff = 0.4;}
      else if (offset === 8) {leftOff = 0.9;}
      else if (offset === 10) {leftOff = 1.4;}
      else {leftOff = 0.7;}
      return {
        x: 2 + whiteIdx * this.wKeyW + leftOff * (this.wKeyW / 3) - this.bKeyW / 2,
        w: this.bKeyW,
        h: this.bKeyH
      };
    }

    _isActive(n) {
      return this.activeNotes.indexOf(n) >= 0;
    }

    _detectChord() {
      if (this.activeNotes.length < 2) { this.chordLabel = ''; return; }
      const sorted = this.activeNotes.slice().sort((a,b) => a - b);
      const root = sorted[0];
      const rootClass = root % 12;
      const seen = {};
      const intervals = [];
      sorted.forEach(n => {
        const iv = (n % 12 - rootClass + 12) % 12;
        if (!seen[iv]) { seen[iv] = true; intervals.push(iv); }
      });
      intervals.sort((a,b) => a - b);

      const CHORD_INTERVALS = window.CHORD_INTERVALS || {
        0: null, 1: [0,4,7], 2: [0,3,7], 3: [0,4,7,11], 4: [0,3,7,10],
        5: [0,4,7,10], 6: [0,5,7], 7: [0,7], 8: [0,4,8], 9: [0,3,6],
        10: [0,2,7], 11: [0,4,7,10]
      };
      const CHORD_TYPE_NAMES = window.CHORD_TYPE_NAMES || [
        '','Major','Minor','Maj7','Min7','Dom7','Sus4','Power','Aug','Dim','Sus2','7th'
      ];

      let best = null;
      let bestDiff = 99;
      for (const t in CHORD_INTERVALS) {
        const ivs = CHORD_INTERVALS[t];
        if (!ivs) {continue;}
        const contained = intervals.every(iv => ivs.indexOf(iv) >= 0);
        if (!contained) {continue;}
        const diff = ivs.length - intervals.length;
        if (diff < 0) {continue;}
        if (diff < bestDiff) { bestDiff = diff; best = { type: t, rootName: NOTE_NAMES[rootClass] }; }
        if (diff === 0) {break;}
      }
      if (best) {
        const name = CHORD_TYPE_NAMES[best.type] || '';
        this.chordLabel = best.rootName + ' ' + name;
      } else {
        this.chordLabel = NOTE_NAMES[rootClass] + ' (?)';
      }
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
      if (!this.wKeyW) {this._initLayout();}

      const activeSet = {};
      this.activeNotes.forEach(n => activeSet[n] = true);

      // White keys
      for (const n of this.whiteKeys) {
        const r = this._whiteKeyRect(n);
        const isActive = activeSet[n];
        const isHover = this._hoverNote === n;
        ctx.fillStyle = isActive ? '#6abf69' : (isHover ? '#444' : '#333');
        ctx.fillRect(r.x, 1, r.w, r.h - 2);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(r.x, 1, r.w, r.h - 2);

        // Note name label at bottom
        if (r.w > 14) {
          ctx.fillStyle = isActive ? '#fff' : '#888';
          ctx.font = `bold ${Math.min(8, r.w * 0.5)}px "Share Tech Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(NOTE_NAMES[n % 12], r.x + r.w / 2, r.h - 3);
        }
      }

      // Black keys
      for (const n of this.blackKeys) {
        const r = this._blackKeyRect(n);
        const isActive = activeSet[n];
        const isHover = this._hoverNote === n;
        ctx.fillStyle = isActive ? '#e68a8a' : (isHover ? '#555' : '#1a1a1a');
        ctx.fillRect(r.x, 1, r.w, r.h - 2);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(r.x, 1, r.w, r.h - 2);

        // Note name on black key
        if (r.w > 10) {
          ctx.fillStyle = isActive ? '#fff' : '#666';
          ctx.font = `bold ${Math.min(7, r.w * 0.5)}px "Share Tech Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(NOTE_NAMES[n % 12], r.x + r.w / 2, r.h - 3);
        }
      }

      // Chord label overlay
      if (this.chordLabel) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const tw = ctx.measureText(this.chordLabel).width + 16;
        ctx.fillRect(w / 2 - tw / 2, 2, tw, 16);
        ctx.fillStyle = '#4ecdc4';
        ctx.font = 'bold 10px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(this.chordLabel, w / 2, 4);
      }
    }
  }

  window.ChordDisplayCanvas = ChordDisplayCanvas;
})();
