/**
 * @purpose Logger centralizado y condicional para la WebUI.
 * @purpose_en Centralized and conditional logger for the WebUI.
 *
 * Los mensajes solo se imprimen cuando el modo debug está activado
 * mediante `localStorage.setItem('abd-eep-debug-logs', '1')` o
 * `window._ABD_DEBUG = true` antes de cargar este script.
 */

(function() {
    'use strict';

    function _enabled() {
        try {
            if (typeof window === 'undefined') {return false;}
            if (window._ABD_DEBUG === true) {return true;}
            return window.localStorage && window.localStorage.getItem('abd-eep-debug-logs') === '1';
        } catch (e) {
            return false;
        }
    }

    function _noop() {}

    const _debug = (typeof console !== 'undefined' && console.log) ? console.log.bind(console) : _noop;
    const _info = (typeof console !== 'undefined' && console.info) ? console.info.bind(console) : _noop;
    const _warn = (typeof console !== 'undefined' && console.warn) ? console.warn.bind(console) : _noop;
    const _error = (typeof console !== 'undefined' && console.error) ? console.error.bind(console) : _noop;

    const enabled = _enabled();

    /**
     * @namespace Logger
     */
    const Logger = {
        /**
         * Devuelve true si el modo debug está activo.
         * @returns {boolean}
         */
        isEnabled: function() {
            return enabled;
        },

        /**
         * Activa o desactiva el modo debug en runtime.
         * @param {boolean} value
         */
        setDebug: function(value) {
            try {
                if (typeof window !== 'undefined') {
                    window._ABD_DEBUG = !!value;
                    if (window.localStorage) {
                        window.localStorage.setItem('abd-eep-debug-logs', value ? '1' : '0');
                    }
                }
            } catch (e) {
                // localStorage puede estar bloqueado en modo privado/incógnito
            }
        },

        log: enabled ? _debug : _noop,
        info: enabled ? _info : _noop,
        warn: enabled ? _warn : _noop,
        error: enabled ? _error : _noop
    };

    if (typeof window !== 'undefined') {
        window.Logger = Logger;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Logger;
    }
})();
