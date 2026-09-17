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

### A.0 Listas de fuentes single-source (anti-drift: `DspSources.cmake`)

**Lección transversal de la suite (2026-09):** duplicar la lista de `.cpp` del motor en el CMake nativo y en el WASM garantiza drift silencioso. Ocurrió en ABDMS2000 (4 ficheros sin replicar — el motor web sonaba, pero no era el sintetizador completo), y se detectó también en ABDCZ101 (GLOB nativo vs lista estática WASM) y ABDJUNiO601 (46 ficheros de hueco). El remedio, aplicado a los cinco proyectos con doble build:

- **Un único `DspSources.cmake` en la raíz** con dos variables (`<PROY>_DSP_SOURCES` nativa y `<PROY>_DSP_SOURCES_WASM`), consumido vía `include()` por el CMake raíz y por `wasm/CMakeLists.txt`.
- Toda diferencia entre listas se **documenta en la cabecera del propio fichero** (exclusión justificada ≠ drift silencioso).
- Regla de mantenimiento: un módulo DSP nuevo va a las **dos** listas, o se justifica su exclusión en ese bloque.

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

**⚠️ Actualización JUCE 8 (2026-09):** este mock sigue siendo válido como técnica general, pero la vía moderna ya no pasa por él en los TUs que construyen layouts APVTS. La variante `juce_audio_processors_headless` de JUCE 8 **redefine** `ParameterID`/`AudioParameter*` que ya existen en `juce_audio_basics` (redefiniciones + `override` inválido), y el módulo completo arrastra `juce_gui_extra` — no hay combinación viable con `audio_basics` activo. La solución aplicada en la suite: los TUs que construyen el layout APVTS (`ParametersSpec*` y similares) son **exclusivos del plugin nativo**; el motor WASM consume el registry generado (`ParameterRegistry.gen.*`) directamente desde el bridge. Ver `DspSources.cmake` de ABDEep para la exclusión documentada.

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

### Estado por proyecto (auditoría anti-drift 2026-09-17)

| Proyecto | Estrategia WASM | Lista single-source | Estado |
|---|---|---|---|
| ABDNeural | JUCE 8 nativo con em++ (sin shim) sobre `DspEngineFacade` | `DspSources.cmake` | ✅ verde (smoke test Node) |
| ABDMS2000 | sin-JUCE, bridge `extern "C"` | `DspSources.cmake` | ✅ verde (2 módulos recuperados) |
| ABDCZ101 | `juce_shim` + módulos JUCE | `DspSources.cmake` | ✅ verde (receta SIMD, lección 7) |
| ABDJUNiO601 | 3 módulos vendados | `DspSources.cmake` | ✅ verde (motor SysEx pendiente: depende de `JuceHeader.h` completo) |
| ABDEep | `juce_shim` + módulos JUCE | `DspSources.cmake` | ✅ verde (BankFileReader + CalibrationSpec recuperados) |

---

## ⚡ 6. Lecciones Críticas de Depuración en AudioWorklets (WASM)

Al portar motores C++ complejos de JUCE a AudioWorklet, ten siempre presente:

### 1. El Constructor por defecto de `juce::Random`
* **Problema**: El constructor por defecto de `juce::Random` (o llamadas estáticas como `juce::Random::getSystemRandom()`) intenta leer del sistema operativo (p. ej. `/dev/urandom` o APIs criptográficas de JS). En el hilo seguro y aislado del `AudioWorkletProcessor`, esto viola la seguridad y provoca un aborto catastrófico en tiempo de ejecución: `libc++abi: terminating`.
* **Solución**: Inicializa siempre los miembros `juce::Random` con una semilla numérica fija (ej: `juce::Random noiseGen (12345);`).
* **Alternativa LCG**: Para módulos de velocidad crítica (como Sample & Hold en LFOs), sustituye la clase `juce::Random` por un generador congruencial lineal (LCG) en línea:
  ```cpp
  lcgSeed = lcgSeed * 196314165u + 907633515u;
  float val = (2.f * (float)lcgSeed / (float)0xFFFFFFFFu) - 1.f;
  ```

### 2. Exportación de `HEAPF32` en el Linker
* **Problema**: JavaScript lee y escribe audio en los búferes copiando directamente del array `HEAPF32` de WASM. Si las optimizaciones de Emscripten están al máximo, esta propiedad del módulo puede resultar eliminada si no se exporta explícitamente.
* **Solución**: Añade `'HEAPF32'` a `EXPORTED_RUNTIME_METHODS` en el linker de CMake:
  ```cmake
  -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','HEAPF32']"
  ```

### 3. Escalado y Desnormalización de Parámetros
* **Problema**: La UI web envía valores normalizados entre `0.0` y `1.0`. C++ espera valores en rangos discretos nativos (por ejemplo, `polyMode` de `1` a `3`). Mapear directamente sin desnormalizar rompe la lógica interna del motor.
* **Solución**: Desnormaliza y escala los flotantes en `WasmBridge.cpp` usando `std::lround()` antes de asignarlos a `gParams`:
  ```cpp
  gParams.polyMode = (int)std::lround(getMap("polyMode", 0.0f) * 2.0f) + 1; // 0.0, 0.5, 1.0 -> 1, 2, 3
  ```

### 4. Empaquetado Single-File (Base64)
* **Mejor Práctica**: Para evitar fallos de CORS al importar el archivo `.wasm` separado dentro del contexto de AudioWorklet en servidores de producción estrictos, utiliza la bandera `-s SINGLE_FILE=1` en el linker de CMake.

### 5. Optimización Zero-Copy
* **Mejor Práctica**: Evita inicializar vistas typed array (`new Float32Array`) en el callback `process()` de JS para no saturar el Garbage Collector. Obtén las referencias `HEAPF32.subarray(ptr, ptr+len)` una sola vez y copia sobre el búfer utilizando `outputBuffer.set(cachedSubarray)`.

### 6. Uso del Asignador `emmalloc`
* **Mejor Práctica**: Para aplicaciones web de audio ligeras, fuerza el uso del asignador `-s MALLOC=emmalloc` en el linker de CMake. Esto optimiza el binario de WebAssembly reduciendo significativamente su peso y el jitter de latencia.

### 7. Intrinsics SSE en headers DSP compartidos (`-msimd128` + shims)
* **Problema**: los headers DSP compartidos (p. ej. `ABDSharedCode/LutDSP/LutEvaluatorSimd.h`) usan `__m128`/`_mm_*` de x86. Bajo WASM no existen, y `juce::dsp::SIMDRegister` tampoco: JUCE lo excluye en Emscripten (`JUCE_USE_SIMD=0`, no hay backend SIMD WASM).
* **Solución**: Emscripten trae shims compat (`system/include/compat/immintrin.h`) que traducen los intrinsics SSE a WASM SIMD128 real, pero exigen las macros x86 que `emcc` no define por defecto. Receta completa (probada en ABDCZ101):
```cmake
target_compile_options(tu_target PRIVATE
    -msimd128
    "SHELL:-D__SSE__ -D__SSE2__"      # los shims dan #error sin estas macros
    "SHELL:-include immintrin.h"
)
```
* **Efecto colateral en JUCE**: con `__SSE__` definido, `juce_TargetPlatform.h` deduce `JUCE_INTEL=1` y JUCE emite inline asm x86 (`bswap %%eax` en `juce_ByteOrder`) que WASM no soporta. Interruptor oficial: añade `JUCE_NO_INLINE_ASM=1` a los defines.

### 8. La trampa de `juce_audio_processors` (y su variante headless) en JUCE 8
* **Problema**: activar `JUCE_MODULE_AVAILABLE_juce_audio_processors=1` sin compilar su `.cpp` parece la vía natural para APVTS/`AudioParameterBool`, pero el módulo completo incluye `juce_gui_extra` (no vendado), y su variante `juce_audio_processors_headless` **redefine** `ParameterID`, `RangedAudioParameter` y `AudioParameter*` que ya existen en `juce_audio_basics` — con `audio_basics` activo produce redefiniciones y `override` inválidos, con o sin su flag de módulo.
* **Solución**: los TUs que construyen el layout APVTS son exclusivos del plugin nativo (ver lección del mock, §2.C). El motor WASM consume el registry generado directamente. Documenta la exclusión en `DspSources.cmake`.

### 9. El quirk de `emsdk_env.bat` en los `.bat` (PATH perdido)
* **Problema**: `call C:\emsdk\emsdk_env.bat >nul 2>nul` silencia también su `set PATH`; y bajo Git Bash el script emite exports `sh` que cmd no ejecuta. Resultado: `"emcmake" no se reconoce` aunque el SDK esté instalado. Afectó a los `.bat` de CZ101, JUNiO y EEP.
* **Solución**: montar el PATH a mano, determinista:
```bat
if exist "C:\emsdk\upstream\emscripten\emcmake.exe" (
    set "PATH=C:\emsdk;C:\emsdk\upstream\emscripten;C:\emsdk\node\22.16.0_64bit\bin;C:\emsdk\python\3.13.3_64bit;%PATH%"
    set "EM_CONFIG=C:\emsdk\.emscripten"
) else (
    call C:\emsdk\emsdk_env.bat >nul 2>nul
)
```
* **Relacionado (CMake de VS)**: si un directorio de build nativo fue configurado con el CMake que trae Visual Studio, reconfigurarlo después con el CMake independiente lo corrompe (`No preprocessor test for "PellesC"`). Usa siempre el CMake que creó el directorio: `.../Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe`.




