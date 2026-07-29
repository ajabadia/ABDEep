# 📘 Guía Maestra: Compilación de Motores DSP JUCE en WebAssembly (WASM)

Este documento es el **manual estándar de referencia** para adaptar, compilar, asegurar y publicar cualquier sintetizador o efecto basado en C++ / JUCE en la Web utilizando **Emscripten (em++)** y la **Web Audio API (AudioWorklet)**.

---

## 🛠️ 1. El Problema Fundamental
JUCE es un framework nativo pesado orientado a escritorio. Cuando intentas compilarlo con **Emscripten (em++)**, surgen tres problemas críticos:
1. **Dependencias de Interfaz Gráfica (GUI):** Las clases como `AudioProcessor` arrastran módulos de gráficos y ventanas (`juce_graphics`, `juce_gui_basics`).
2. **Hilos de Sistema (Threads):** JUCE asume entornos multihilo basados en POSIX/Windows (`pthread`). En navegadores web, los hilos nativos tienen soporte parcial y fallan en assertions de Clang por tamaño y prioridad.
3. **APVTS (`AudioProcessorValueTreeState`):** Esta clase mapea los parámetros al host DAW/UI. Compilarla en WASM arrastra todo el módulo `juce_audio_processors`, el cual falla por stubs no implementados en plataformas no-DAW.

---

## 🚀 2. La Solución Técnica: Arquitectura Headless con Mocking

La estrategia consiste en **aislar el motor DSP** compilándolo sin dependencias de hosts de audio externos ni UI nativa, inyectando un **Mock del gestor de parámetros de JUCE** en el preprocesador global.

### A. Deshabilitar Módulos Gráficos y de Host en CMake
En tu `CMakeLists.txt` de WASM, deshabilita de forma explícita los módulos innecesarios:
```cmake
target_compile_definitions(tu_target PRIVATE
    JUCE_MODULE_AVAILABLE_juce_core=1
    JUCE_MODULE_AVAILABLE_juce_events=1
    JUCE_MODULE_AVAILABLE_juce_data_structures=1
    JUCE_MODULE_AVAILABLE_juce_audio_basics=1
    JUCE_MODULE_AVAILABLE_juce_audio_formats=1
    JUCE_MODULE_AVAILABLE_juce_dsp=1
    
    # Deshabilitar hosts y gráficos
    JUCE_MODULE_AVAILABLE_juce_audio_processors=0
    JUCE_MODULE_AVAILABLE_juce_graphics=0
    JUCE_MODULE_AVAILABLE_juce_gui_basics=0
    JUCE_MODULE_AVAILABLE_juce_gui_extra=0
    JUCE_MODULE_AVAILABLE_juce_audio_devices=0
)
```

---

### B. Inyección Global del Mock de Parámetros (`wasm_compat.h`)
Para evitar reescribir las asignaciones de parámetros en el motor DSP (que típicamente leen de un objeto `juce::AudioProcessorValueTreeState`), creamos un archivo de compatibilidad global que el compilador inyecta a **todos** los archivos de la compilación mediante la bandera de GCC/Clang `-include`.

#### Código del Mock (`wasm_compat.h`):
```cpp
#pragma once
#ifdef __EMSCRIPTEN__

#include <emscripten/emscripten.h>
#include <atomic>
#include <map>
#include <string>
#include <memory>
#include <cmath>

namespace juce
{
    class String;

    // 1. Clase base polimórfica para que dynamic_cast funcione en compiladores estrictos
    class RangedAudioParameter
    {
    public:
        virtual ~RangedAudioParameter() = default;
    };

    // 2. Struct minimalista de IDs de parámetros
    struct ParameterID
    {
        ParameterID() = default;
        ParameterID (const juce::String&, int) {}
        ParameterID (const char*, int) {}
    };

    // 3. Mock de selectores de opción (ej. formas de onda)
    class AudioParameterChoice : public RangedAudioParameter
    {
    public:
        AudioParameterChoice() = default;
        template <typename... Args> AudioParameterChoice (Args&&...) {}

        int getIndex() const noexcept { return static_cast<int>(std::round(value.load())); }
        std::atomic<float> value{0.0f};
    };

    // 4. Mock de parámetros flotantes
    class AudioParameterFloat : public RangedAudioParameter
    {
    public:
        AudioParameterFloat() = default;
        template <typename... Args> AudioParameterFloat (Args&&...) {}

        std::atomic<float> value{0.0f};
    };

    // 5. Mock de la APVTS
    class AudioProcessorValueTreeState
    {
    public:
        struct ParameterLayout
        {
            template <typename T> void add (T&&) {} // Ignora inserciones del layout original
        };

        AudioProcessorValueTreeState() = default;
        ~AudioProcessorValueTreeState() = default;

        std::atomic<float>* getRawParameterValue(const juce::String& id) noexcept;
        RangedAudioParameter* getParameter(const juce::String& id) noexcept;

        std::map<std::string, std::atomic<float>> values;
        std::map<std::string, AudioParameterChoice> choices;
    };
}
#endif
```

En la configuración de CMake de tu target, fuerza la inclusión de esta cabecera:
```cmake
target_compile_options(tu_target PRIVATE
    -include ${CMAKE_CURRENT_SOURCE_DIR}/juce_shim/wasm_compat.h
)
```

---

### C. Implementación del Bridge C++ / JS (`WasmBridge.cpp`)
El bridge actúa como el punto de entrada que expone los métodos de audio al hilo de javascript (AudioWorklet). En este archivo implementamos los métodos del Mock declarados en la cabecera anterior:

```cpp
#include <JuceHeader.h>
#include <cmath>

namespace juce
{
    std::atomic<float>* AudioProcessorValueTreeState::getRawParameterValue(const juce::String& id) noexcept
    {
        return &values[id.toStdString()];
    }

    RangedAudioParameter* AudioProcessorValueTreeState::getParameter(const juce::String& id) noexcept
    {
        auto stdStr = id.toStdString();
        choices[stdStr].value.store(values[stdStr].load());
        return &choices[stdStr];
    }
}

// Exportación C para Javascript
extern "C" {

EMSCRIPTEN_KEEPALIVE void wasm_init_engine(double sampleRate, int blockSize)
{
    // Inicializar tu SynthEngine C++ aquí
}

EMSCRIPTEN_KEEPALIVE void wasm_process_audio(float* outL, float* outR, int numSamples)
{
    // Procesar buffer y sincronizar parámetros usando el Mock de APVTS
}

EMSCRIPTEN_KEEPALIVE void wasm_set_parameter(const char* paramId, float value)
{
    // Escribir directamente en el mapa atómico del mock
    if (auto* param = gAPVTS->getRawParameterValue(paramId))
    {
        param->store(value);
    }
}

}
```

---

## 📈 3. Flujo de Trabajo en el Navegador (AudioWorklet)
1. **ES6 Module:** Configura CMake para exportar el JS resultante como módulo ES6 (`-s EXPORT_ES6=1 -s MODULARIZE=1`).
2. **AudioWorkletProcessor:** Carga el módulo WASM de forma asíncrona dentro del hilo de audio de alta prioridad.
3. **Midi & Parameter Routing:** Envía eventos MIDI e IDs de parámetros desde el hilo principal de la UI al AudioWorklet mediante `postMessage`. El AudioWorklet llama a `wasm_set_parameter` y `wasm_process_audio` en cada iteración del renderizador.

---

## 🔒 4. Medidas de Seguridad, Protección IP y Consideraciones de Publicación Web

Al publicar una aplicación WebAssembly interactiva completa en producción sin gestión de usuarios ni licencias en servidor, existen aspectos técnicos y comerciales a considerar:

### A. Naturaleza Técnica de WebAssembly (¿Es posible robar el código?)
* **Imposibilidad de Decompilar a C++:** WebAssembly se compila a un código de bytes binario de bajo nivel (`.wasm`). Aunque herramientas como WABT o Ghidra pueden desensamblar el binario a lenguaje ensamblador abstracto (`i32.add`, `f32.mul`), **es técnicamente imposible recuperar las funciones C++, estructuras de clases ni fórmulas matemáticas originales.**
* **Aislamiento del Código Nativo (VST3/DAW):** El binario `.wasm` está compilado exclusivamente para el runtime de navegador (`WebAudio/AudioWorklet`). No posee llamadas a la API del sistema operativo, ni bindings de JUCE Desktop. Es virtualmente imposible convertir un binario `.wasm` de vuelta a una librería ejecutable DLL o VST3.

### B. Medidas de Protección y Seguridad Aplicadas en Compilación

1. **Stripping de Símbolos y Ofuscación Binaria (`-s STRIP_ALL=1`):**
   - El compilador Emscripten está configurado para eliminar todos los nombres de funciones, identificadores de parámetros internos y símbolos de depuración en la compilación de Release.
   - Banderas activas en CMake de WASM:
     ```cmake
     set_target_properties(abdeep_dsp PROPERTIES
         LINK_FLAGS "-O3 --strip-all -s EVAL_CTORS=1 --closure 1"
     )
     ```

2. **Minificación del JavaScript de la WebUI (Terser / Build Pipeline):**
   - El código de la interfaz gráfica (`WebUI/js/`) debe minificarse antes del despliegue en servidor web público. Todas las variables globales, handlers e instancias se renombra a identificadores de un solo carácter.

3. **Verificación de Dominio (CORS / DRM Liviano):**
   - Para evitar que terceros descarguen los archivos `.wasm` / `index.html` y los hospeden en un dominio ajeno (hotlinking / plagio de sitio), se valida el nombre de host en el arranque del AudioWorklet:
     ```javascript
     const allowedDomains = ['abdsynths.com', 'localhost'];
     if (!allowedDomains.some(domain => location.hostname.endsWith(domain))) {
         console.warn('Ejecución no autorizada fuera del servidor oficial.');
         // Silenciar audio o aplicar ráfagas de atenuación
     }
     ```

### C. Estrategia Comercial de Publicación Web (Full Version sin Usuarios)
* **Uso no continuo/profesional:** Dado que la versión web se ejecuta de forma local en la memoria del navegador del usuario sin persistencia en la nube ni gestión de usuarios, sirve como una excelente herramienta de demostración completa.
* **Incentivo a la Versión Nativa (VST3/Standalone):** Para producción musical en DAWs (Cubase, Ableton, Reaper), latencias ultra-bajas de sub-milisegundo y automatización de pistas, la versión nativa compilada en C++ sigue siendo la única solución profesional, protegiendo la propuesta de valor comercial.

---

## 🏁 5. Flujo Completo de Build y Despliegue Web

### Requisitos del Entorno (Windows)
1. **Emscripten SDK (emsdk):** Debe estar instalado en la ruta por defecto `C:\emsdk`.
2. **Generador CMake / Build System:** Visual Studio 2026 / MSVC + Ninja / CMake (`emcmake`).

### Ejecución de Compilación

Para compilar el sintetizador completo (VST3/Standalone + WASM) en **ABDEep**:
```cmd
.\build.bat 2
```

O para compilar directamente el binario WASM de forma independiente (aplicable tanto a **ABDEep** como a **ABDJUNiO601**):
Abrir un terminal de Windows (`cmd.exe` o `PowerShell`) en la raíz del proyecto (ej: `d:\desarrollos\ABDSynths\ABDJUNiO601`) y ejecutar:
```cmd
wasm\build_wasm.bat
```

**Artefactos Generados:**
* `WebUI/wasm/abdeep_dsp.wasm` / `WebUI/wasm/abdjunio601_dsp.wasm` (Binario DSP optimizado sin símbolos)
* `WebUI/wasm/abdeep_dsp.js` / `WebUI/wasm/abdjunio601_dsp.js` (Glue code modularizado ES6/AudioWorklet)


