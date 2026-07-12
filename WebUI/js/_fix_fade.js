const fs = require('fs');
let c = fs.readFileSync('script.js', 'utf8');
let count = 0;

// 1. Replace in window.lcdFadeUpdate (universal fade helper, ~line 2168)
const old1 = "lcdEl.style.transition = 'opacity ' + t.out + 'ms ease-out';\n    lcdEl.style.opacity = '0';\n    lcdEl._ctrlLcdFadeTimer = setTimeout(() => {\n        if (lcdEl._ctrlLcdFadeTimer === null) return;\n        lcdEl._ctrlLcdFadeTimer = null;\n        lcdEl.innerHTML = html;\n        lcdEl.style.transition = 'opacity ' + t.in + 'ms ease-in';";
const new1 = "lcdEl.style.transition = 'opacity ' + t.out + 'ms ' + window._LCD_FADE_OUT_EASING;\n    lcdEl.style.opacity = '0';\n    lcdEl._ctrlLcdFadeTimer = setTimeout(() => {\n        if (lcdEl._ctrlLcdFadeTimer === null) return;\n        lcdEl._ctrlLcdFadeTimer = null;\n        lcdEl.innerHTML = html;\n        lcdEl.style.transition = 'opacity ' + t.in + 'ms ' + window._LCD_FADE_IN_EASING;";

if (c.includes(old1)) { c = c.replace(old1, new1); count++; console.log('OK: window.lcdFadeUpdate fade'); }
else { console.log('FAIL: window.lcdFadeUpdate fade not found'); }

// 2. Replace in restore fade (_updateCtrlOverlay, ~line 1054)
const old2 = "lcdText.style.transition = 'opacity ' + rt.outR + 'ms ease-out';\n                lcdText.style.opacity = '0';\n                // After fade out, swap content and fade in\n                lcdText._ctrlLcdFadeTimer = setTimeout(() => {\n                        lcdText._ctrlLcdFadeTimer = null;\n                        // Safety: si _ctrlLcdRestore fue setteado por controller branch, no restaurar\n                        if (lcdText._ctrlLcdRestore !== null) return;\n                        lcdText.innerHTML = restoreHtml;\n                        lcdText.style.transition = 'opacity ' + rt.inR + 'ms ease-in';";
const new2 = "lcdText.style.transition = 'opacity ' + rt.outR + 'ms ' + window._LCD_FADE_OUT_EASING;\n                lcdText.style.opacity = '0';\n                // After fade out, swap content and fade in\n                lcdText._ctrlLcdFadeTimer = setTimeout(() => {\n                        lcdText._ctrlLcdFadeTimer = null;\n                        // Safety: si _ctrlLcdRestore fue setteado por controller branch, no restaurar\n                        if (lcdText._ctrlLcdRestore !== null) return;\n                        lcdText.innerHTML = restoreHtml;\n                        lcdText.style.transition = 'opacity ' + rt.inR + 'ms ' + window._LCD_FADE_IN_EASING;";

if (c.includes(old2)) { c = c.replace(old2, new2); count++; console.log('OK: restore fade'); }
else { console.log('FAIL: restore fade not found'); }

fs.writeFileSync('script.js', c);
console.log('Done. Total replacements: ' + count);
