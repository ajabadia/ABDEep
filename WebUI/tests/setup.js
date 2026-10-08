/**
 * setup.js — setup global de Vitest (registrado en vitest.config.js).
 *
 * Fase 6 (plan v3.2 §6): retirada de compatibilidad legacy. Los módulos de fuente
 * migrados llaman a `getBridge()` (acceso canónico definido en bridge-dual.js).
 * Los tests que stubbean `window.dualMidiBridge` SIN evaluar bridge-dual.js no
 * tienen esa función global — este setup la define con el MISMO fallback que el
 * canónico: `window._bridgeInstance || window.dualMidiBridge`.
 *
 * Cuando un test evalúa bridge-dual.js real, su `getBridge()` (instancia canónica
 * privada) reemplaza este fallback — comportamiento correcto en ambos casos.
 */
if (typeof globalThis !== 'undefined' && typeof globalThis.getBridge === 'undefined') {
    globalThis.getBridge = function getBridgeFallback() {
        if (typeof globalThis !== 'undefined' && globalThis.window) {
            if (globalThis.window._bridgeInstance) { return globalThis.window._bridgeInstance; }
            if (globalThis.window.dualMidiBridge) { return globalThis.window.dualMidiBridge; }
        }
        return null;
    };
}

// Inyección de safe.directory en worker de vitest
if (typeof process !== 'undefined' && process.env) {
    const rootDir = process.cwd().replace(/\\/g, '/').replace(/\/+$/, '');
    const count = Number.parseInt(process.env.GIT_CONFIG_COUNT ?? '0', 10);
    let found = false;
    for (let i = 0; i < count; i += 1) {
        if (process.env[`GIT_CONFIG_KEY_${i}`] === 'safe.directory') {
            found = true;
            break;
        }
    }
    if (!found) {
        process.env.GIT_CONFIG_COUNT = String(count + 1);
        process.env[`GIT_CONFIG_KEY_${count}`] = 'safe.directory';
        process.env[`GIT_CONFIG_VALUE_${count}`] = rootDir;
    }
}
