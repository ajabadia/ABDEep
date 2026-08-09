/**
 * @purpose Legacy loader — ARP, Chord, Poly Chord y Secuenciador bindings.
 * Las funciones se han extraído a:
 *   - panel_controls_arp.js   → bindPanelArpControls
 *   - panel_controls_chord.js → bindPanelChordControls, bindPanelPolyChordControls, bindPanelChordAndPolyCommon
 *   - panel_controls_seq.js   → bindPanelSeqControls
 *
 * Este archivo se mantiene como compat layer: las funciones se asignan en los nuevos archivos.
 * Carga secuencial vía script tags.
 */

// Funciones ahora definidas en los archivos extraídos.
// Mantener exports globally para compatibilidad.
if (typeof window.bindPanelArpControls === 'undefined') {window.bindPanelArpControls = function() {};}
if (typeof window.bindPanelChordControls === 'undefined') {window.bindPanelChordControls = function() {};}
if (typeof window.bindPanelPolyChordControls === 'undefined') {window.bindPanelPolyChordControls = function() {};}
if (typeof window.bindPanelChordAndPolyCommon === 'undefined') {window.bindPanelChordAndPolyCommon = function() {};}
if (typeof window.bindPanelSeqControls === 'undefined') {window.bindPanelSeqControls = function() {};}
