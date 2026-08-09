/**
 * @purpose Mod Matrix Canvas Data — source/destination name tables and color mapping.
 * Extracted from mod-matrix-canvas.js.
 */

window.MOD_SOURCES_SHORT = [
  'None','P.Bend','M.Wheel','Foot','Breath','Press','Expr','LFO1',
  'LFO2','Env1','Env2','Env3','Note#','Vel','OffVel','Seq',
  'LFO1Uni','LFO2Uni','LFO1Fd','LFO2Fd','V#','UniV','CC115','CC116','CC117'
];

window.MOD_DESTS_SHORT = [
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

/**
 * Retorna el color asociado a un índice de fuente de modulación.
 * @param {number} i - Índice de fuente (0 = None)
 * @returns {string|null} Color CSS o null si es None
 */
window.modSrcColor = function(i) {
  if (i === 0) { return null; }
  if (i <= 6) { return '#5b9bd5'; }
  if (i === 7 || i === 8 || (i >= 16 && i <= 19)) { return '#4ecdc4'; }
  if (i <= 11) { return '#6abf69'; }
  if (i <= 14) { return '#d4a843'; }
  return '#e68a8a';
};

/**
 * Retorna el color asociado a un índice de destino de modulación.
 * @param {number} i - Índice de destino (0 = None)
 * @returns {string|null} Color CSS o null si es None
 */
window.modDstColor = function(i) {
  if (i === 0) { return null; }
  if (i <= 8) { return '#4ecdc4'; }
  if (i <= 18) { return '#5b9bd5'; }
  if (i <= 23) { return '#e68a8a'; }
  if (i <= 62) { return '#6abf69'; }
  if (i === 63 || i === 64) { return '#d4a843'; }
  return '#888';
};
