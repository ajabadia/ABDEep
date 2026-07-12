/**
 * @purpose Generates Unicode visual bars and LCD layout helper strings.
 * @purpose_en Shared Visual Bar Generators.
 */

window._getBarStyleChars = function() {
    try {
        var style = localStorage.getItem('abd-eep-bar-style') || 'solid';
        var map = {
            'solid':  { fill: '\u2588', empty: '\u2591' },
            'dark':   { fill: '\u2593', empty: '\u2591' },
            'medium': { fill: '\u2592', empty: '\u2591' }
        };
        return map[style] || map['solid'];
    } catch(e) {
        return { fill: '\u2588', empty: '\u2591' };
    }
};

window._genFillBar = function(fillLen, totalLen, fillChar, emptyChar) {
    if (totalLen === undefined) totalLen = 18;
    if (fillChar === undefined || emptyChar === undefined) {
        var _bc = window._getBarStyleChars();
        if (fillChar === undefined) fillChar = _bc.fill;
        if (emptyChar === undefined) emptyChar = _bc.empty;
    }
    fillLen = Math.max(0, Math.round(fillLen));
    return fillChar.repeat(Math.min(fillLen, totalLen)) + emptyChar.repeat(Math.max(0, totalLen - fillLen));
};

window._genPosBar = function(pos, totalLen, fillChar, emptyChar) {
    if (totalLen === undefined) totalLen = 18;
    if (fillChar === undefined || emptyChar === undefined) {
        var _bc = window._getBarStyleChars();
        if (fillChar === undefined) fillChar = _bc.fill;
        if (emptyChar === undefined) emptyChar = _bc.empty;
    }
    pos = Math.max(0, Math.min(Math.round(pos), totalLen - 1));
    return emptyChar.repeat(pos) + fillChar + emptyChar.repeat(Math.max(0, totalLen - pos - 1));
};

window._genBarHtml = function(bar, opts) {
    opts = opts || {};
    var fontSize = opts.fontSize || '8px';
    var letterSpacing = opts.letterSpacing || '1px';
    var color = opts.color || 'var(--text-faint)';
    var style = 'font-size:' + fontSize + '; letter-spacing:' + letterSpacing + '; color:' + color;
    if (opts.marginLeft) style += '; margin-left:' + opts.marginLeft;
    var extra = opts.suffix || '';
    return '<span style="' + style + ';">' + bar + extra + '</span>';
};

window._genLcdBarHtml = function(type, opts) {
    var barColor = (type === 'seq' || type === 'seq_preset') ? 'var(--accent-pink)' : 'var(--accent-primary)';
    var bar = opts.bar || '';
    
    if (type === 'seq_preset') {
        return '<span style="font-size:9px; opacity:0.6;">' + opts.header + '</span><br>'
            + '<strong style="color:' + barColor + ';font-size:9px;">' + opts.presetName + '</strong><br>'
            + '<span style="font-size:7px; letter-spacing:1px; color:var(--text-faint);">' + bar + '</span><br>'
            + '<span style="font-size:7px; color:var(--text-dim);">' + opts.meta + '</span>';
    }
    
    var headerStyle = opts.decorated
        ? 'font-size:7px; opacity:0.6; color:' + barColor + ';'
        : 'font-size:9px; opacity:0.6;';
    
    return '<span style="' + headerStyle + '">' + opts.header + '</span><br>'
        + '<span style="font-size:9px; color:' + barColor + '; font-weight:bold;">' + opts.stepInfo + '</span><br>'
        + '<span style="font-size:7px; letter-spacing:1px; color:var(--text-faint);">' + bar + '</span>';
};
