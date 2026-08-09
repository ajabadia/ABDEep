/**
 * @purpose Audio A/B Validation tab event handlers: binds click handlers for
 *          Start, Render, Finish, Compare, and Abort buttons.
 * @classification Module/Calibration/Tab
 * @dependencies calibration_lab_page.js (defines CalibrationLabPage)
 */

CalibrationLabPage.prototype.bindAudioABEvents = function () {
  const self = this;
  const startBtn = this.querySelector('#audio-btn-start');
  const renderBtn = this.querySelector('#audio-btn-render');
  const finishBtn = this.querySelector('#audio-btn-finish');
  const compareBtn = this.querySelector('#audio-btn-compare');
  const abortBtn = this.querySelector('#audio-btn-abort');

  function addLog(msg) {
    const time = new Date().toTimeString().split(' ')[0];
    self._audioLogs = self._audioLogs || [];
    self._audioLogs.push({ time: time, msg: msg });
    const state = window.calibrationStore;
    if (state) { self.render(); }
  }

  if (startBtn) {
    startBtn.onclick = async function () {
      const store = window.calibrationStore;
      if (!store) { return; }
      const st = store.getState();
      const patchName = (st.selectedPatchA && st.selectedPatchA.name) || 'Active Patch';

      const config = {
        runId: 'audio-ab-' + Date.now(),
        patchName: patchName,
        midiNote: parseInt((self.querySelector('#audio-note-input') && self.querySelector('#audio-note-input').value) || '48', 10),
        velocity: parseInt((self.querySelector('#audio-vel-input') && self.querySelector('#audio-vel-input').value) || '100', 10),
        noteDurationSec: parseFloat((self.querySelector('#audio-dur-input') && self.querySelector('#audio-dur-input').value) || '2.0'),
        tailDurationSec: 0.5,
        sampleRate: 44100.0,
        bitDepth: 24,
        numChannels: 2
      };

      const patchSnapshotJson = JSON.stringify(st.selectedPatchA || {});

      addLog('Iniciando Audio A/B Run: ' + config.runId);
      const res = window.dualMidiBridge && (await window.dualMidiBridge.startAudioABRun(JSON.stringify(config), patchSnapshotJson));
      if (res && res.ok) {
        self._audioStatus = 'running';
        self._comparisonResult = null;
        addLog('Grabador de hardware activo. Capturando se\u00f1al de audio f\u00edsica...');
      } else {
        self._audioStatus = 'error';
        addLog('Error al iniciar run: ' + ((res && res.error) || 'unknown'));
      }
    };
  }

  if (renderBtn) {
    renderBtn.onclick = async function () {
      addLog('Renderizando referencia software del SynthEngine...');
      const res = window.dualMidiBridge && (await window.dualMidiBridge.renderAudioABSoftwareReference());
      if (res && res.ok) {
        addLog('Referencia de software renderizada correctamente en buffer local.');
      } else {
        addLog('Error al renderizar software: ' + ((res && res.error) || 'unknown'));
      }
    };
  }

  if (finishBtn) {
    finishBtn.onclick = async function () {
      addLog('Finalizando run y exportando archivos a disco...');
      const res = window.dualMidiBridge && (await window.dualMidiBridge.finishAudioABRun());
      if (res && res.ok) {
        self._audioStatus = 'finished';
        self._hwWavPath = res.hwWavPath;
        self._swWavPath = res.swWavPath;
        self._lastRunId = res.runId;
        addLog('Run finalizado con \u00e9xito: ' + res.runId);
        addLog('Manifest: ' + res.manifestPath);
        addLog('WAV Hardware: ' + res.hwWavPath + ' (Peak: ' + res.hwPeak + 'dB, RMS: ' + res.hwRms + 'dB)');
        addLog('WAV Software: ' + res.swWavPath + ' (Peak: ' + res.swPeak + 'dB, RMS: ' + res.swRms + 'dB)');
      } else {
        self._audioStatus = 'error';
        addLog('Error al finalizar run: ' + ((res && res.error) || 'unknown'));
      }
    };
  }

  if (compareBtn) {
    compareBtn.onclick = async function () {
      addLog('Ejecutando algoritmo de alineaci\u00f3n y comparaci\u00f3n ac\u00fastica...');

      const store = window.calibrationStore;
      const st = store && store.getState();
      const patchName = (st && st.selectedPatchA && st.selectedPatchA.name) || 'Active Patch';

      const configJson = JSON.stringify({
        trimLeadingSilence: true,
        trimTrailingSilence: true,
        silenceThresholdDb: -72.0,
        normalizeGain: false,
        forceMonoForAnalysis: true,
        enableCrossCorrelation: true,
        maxAlignmentOffsetSamples: 8192,
        fftSize: 1024
      });

      const contextJson = JSON.stringify({
        runId: self._lastRunId || ('audio-ab-' + Date.now()),
        presetId: (st && st.selectedPatchA && st.selectedPatchA.uuid) || 'active',
        presetName: patchName
      });

      const res = window.dualMidiBridge && (await window.dualMidiBridge.compareAudioABRun(
        self._swWavPath || '',
        self._hwWavPath || '',
        configJson,
        contextJson
      ));

      if (res) {
        self._comparisonResult = res;
        if (res.status === 'error') {
          self._audioStatus = 'error';
          addLog('Error contractual en comparador: ' + res.reason_code);
        } else {
          const level = (res.verdict && res.verdict.level) || 'unknown';
          self._audioStatus = level === 'pass' ? 'passed' : 'failed';
          addLog('Comparaci\u00f3n ac\u00fastica finalizada. Veredicto: ' + level.toUpperCase());
          if (res.verdict && res.verdict.triggered_rules && res.verdict.triggered_rules.length) {
            res.verdict.triggered_rules.forEach(function (rule) { addLog(' Regla disparada: ' + rule); });
          }
        }
      } else {
        addLog('Error cr\u00edtico al despachar compareAudioABRun nativo.');
      }
    };
  }

  if (abortBtn) {
    abortBtn.onclick = async function () {
      addLog('Abortando run actual...');
      if (window.dualMidiBridge) { await window.dualMidiBridge.abortAudioABRun(); }
      self._audioStatus = 'idle';
      self._comparisonResult = null;
      addLog('Run abortado.');
    };
  }
};
