/**
 * Migra las llamadas a console.* en WebUI/js/*.js a Logger.*,
 * añadiendo un fallback `var Logger = globalThis.Logger || console;`
 * al inicio de cada archivo si no existe ya.
 */

const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '..', 'WebUI', 'js');

function shouldProcess(file) {
    const basename = path.basename(file);
    if (basename === 'logger.js') {return false;}
    if (basename === 'webview-bootstrap.js') {return false;}
    if (basename === '_fix_fade.js') {return false;}
    if (basename === 'factory_fx_presets.js') {return false;}
    if (basename === 'factory_seq_presets.js') {return false;}
    if (basename.startsWith('.')) {return false;}
    return true;
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Skip if already migrated
    if (content.includes('globalThis.Logger || console')) {
        return;
    }

    const hasLog = /\bconsole\.(log|warn|error|info)\b/.test(content);
    if (!hasLog) {
        return;
    }

    // Determine insertion point: after the leading comment block if present
    let insertIndex = 0;
    const firstNonWhitespace = content.search(/\S/);
    if (firstNonWhitespace > 0) {
        insertIndex = firstNonWhitespace;
    }

    const preamble = '// eslint-disable-next-line no-var\nvar Logger = globalThis.Logger || console;\n\n';

    // Insert before any leading comment so the comment remains at the top
    content = content.slice(0, insertIndex) + preamble + content.slice(insertIndex);

    // Replace console.* calls (avoid matching console itself in strings? basic)
    content = content.replace(/\bconsole\.log\b/g, 'Logger.log');
    content = content.replace(/\bconsole\.warn\b/g, 'Logger.warn');
    content = content.replace(/\bconsole\.error\b/g, 'Logger.error');
    content = content.replace(/\bconsole\.info\b/g, 'Logger.info');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Migrated ${path.relative(process.cwd(), filePath)}`);
}

function run() {
    const files = fs.readdirSync(JS_DIR)
        .filter(f => f.endsWith('.js'))
        .map(f => path.join(JS_DIR, f))
        .filter(shouldProcess);

    for (const filePath of files) {
        processFile(filePath);
    }

    console.log('Migration complete.');
}

run();
