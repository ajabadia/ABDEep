---
name: juce-audio-hybrid-plugin
description: Comprehensive guidance, real-time DSP safety, Juno/DeepMind synth architecture (PolyBLEP, TPT/ZDF filters, BBD Chorus), CMake build rules, and WebUI/WASM data contracts for JUCE audio plugins.
---

# JUCE Audio & Hybrid Plugin Engineering Skill

This skill provides industry best practices and lessons learned for developing high-performance, real-time audio plugins and diagnostic tools using **JUCE (C++20)** combined with modern **WebUI (HTML/CSS/JS)** frontends and **WASM** targets.

---

## 1. Real-Time Audio & Threading Safety Rules

### Critical Audio Thread Constraints
The audio processing callback (e.g., `processBlock`) executes on a real-time thread where timing deadlines are absolute (typically < 5ms).

- **Zero Memory Allocation**: NEVER call `new`, `malloc`, `realloc`, `delete`, `free`, or resize dynamic containers (`std::vector::push_back`, `std::string`, `std::map`) in the audio thread. Pre-allocate all buffers in `prepareToPlay`.
- **Lock-Free Communication**: NEVER use blocking primitives (`std::mutex`, `std::unique_lock`, `JUCE CriticalSection`, `ConditionVariable`, `webLatch.await`) on the audio thread. Use lock-free single-producer single-consumer (SPSC) ring buffers or `std::atomic<float>/int` flags.
- **No System/I/O Calls**: Avoid file I/O, console logging (`DBG`, `printf`), UI repaint requests, or network calls inside DSP processing loops.
- **Denormal Prevention**: Apply denormal protection (e.g., `juce::ScopedNoDenormals`) at the start of `processBlock` to prevent CPU spikes when signals decay to subnormal floating-point values.

---

## 2. Juno & DeepMind Virtual Analog DSP Architecture

### A. Polyphonic Voice Manager & DCO Oscillators (`SynthesiserVoice`)
- **Juno DCO Structure**: Combine Saw, PWM Pulse, and a Square Sub-oscillator (-1 octave) summed before the filter.
- **DeepMind DCO Structure**: Add DCO 2 (Square with Tone Mod PWM and Hard Sync to DCO 1).
- **Anti-Aliasing (PolyBLEP)**: Use PolyBLEP (Band-Limited Polynomials) or mip-mapped wavetables for Saw/Square transitions to eliminate high-frequency aliasing above Nyquist.
- **Sample-Accurate MIDI**: Process `juce::MidiBuffer` using sample offsets (`samplePosition`) to trigger `startNote` / `stopNote` at the exact sample boundary within the block.

### B. TPT/ZDF Filter Modeling (Roland IR3109 / DeepMind VCF)
- **Zero-Delay Feedback (TPT Topology)**: Implement 4-pole 24dB/oct low-pass filters using Topology-Preserving Transforms (TPT) and trapezoidal integration.
- **Non-Linear Feedback Saturation**: Include non-linear transfer functions (e.g., `std::tanh` or polynomial saturators) inside the resonance feedback loop to prevent explosive self-oscillation and model analog warmth.
- **Bass Compensation**: Add dynamic bass-boost/compensation in the feedback path to offset the characteristic low-end drop of 4-pole ladder filters at high resonance.

### C. Analog BBD Stereo Chorus Emulation
- **Dual Fractional Delay Lines**: Use Lagrange or linear interpolation for sub-sample delay taps (delay range ~5-15ms).
- **LFO Rates**: Mode I (~0.5 Hz deep modulation), Mode II (~8.3 Hz fast vibrato), Mode I+II (combined dual LFOs).
- **180° Out-of-Phase Stereo**: Invert the right channel LFO phase by 180° relative to the left channel for the signature wide Roland stereo field.

---

## 3. Build System & Codebase Architecture (CMake)

- **CMake is the Single Source of Truth**: Do NOT use Projucer `.jucer` files or manual Visual Studio/Xcode project edits. Manage all target outputs, JUCE module imports, and C++ standard flags through `CMakeLists.txt`.
- **Modular Layer Separation**:
  - `Source/Core/`: Pure C++ DSP algorithms, state models, and parameter spec tables. Must remain independent of UI framework specifics.
  - `Source/Plugin/`: JUCE plugin wrappers (`AudioProcessor`, `AudioProcessorEditor`).
  - `WebUI/`: Frontend web application (HTML5, Vanilla CSS, JavaScript ES Modules, Vitest test suites).
  - `schemas/`: Machine-readable JSON schemas defining contract standards.

---

## 4. Data Contracts & Parameter Synchronization

### Dual Representation Pattern
- **Low-Level / C++ Engine**: Uses **XML** for local configuration dumps, `CalibrationSpec`, and hardware-level parameter spec definitions (`ParametersSpec`).
- **Frontend / Bridge / CLI**: Uses **JSON Schema** (`schemaVersion: 1`) for client communication, settings exports, and automated report generation.

### Automated Parameter Registry Generation
- Maintain a single canonical parameter specification generator (e.g., `scripts/registry_generator.js`).
- Automatically emit synchronized build artifacts across layers:
  - `ParameterRegistry.gen.h` / `.cpp` for C++ lookup and enum mapping.
  - `registry.gen.js` for WebUI parameter state management and validation.
  - `parameter-registry.data.json` for validation and schema enforcement.

### Parameter Normalization Bridge
- Normalization mapping (`0.0` to `1.0` <-> Raw Hardware Value) must be centralized in the WebUI store (`normalizeSnapshot()`, `rawToNormalized()`).
- Map raw hardware byte offsets and NRPN numbers accurately according to official hardware spec tables (e.g., Arpeggiator Clock Divider 13 ratios `1/2`...`1/48`, Arp Pattern `0`...`64`).

---

## 5. WebUI Design & Performance Standards

- **Vanilla CSS Directives**: Avoid heavy CSS utility frameworks (like Tailwind/Bootstrap) inside embedded plugin WebViews to minimize layout latency and memory overhead. Use explicit CSS variables for tokens (`--border-dim`, `--bg-surface`, `--color-accent`).
- **Hardware-Accurate UI Rendering**: Render LCD displays, LED indicators, faders, and rotary controls with sub-millisecond DOM updates.
- **Throttling & High-Frequency Updates**: Throttle slider input events (`requestAnimationFrame` or debounced bridges) to avoid overwhelming the IPC message bridge when sending MIDI/NRPN updates.

---

## 6. Quality Assurance & Testing Workflow

Before concluding any feature or bug fix:
1. **C++ Unit Test Execution**: Compile and execute C++ test suites (DSP unit tests, SysEx encoder/decoder tests).
2. **WebUI Vitest Suite**: Run `npm test` from project root. Ensure 100% test file pass rate across contract, store, UI, and roundtrip equality fuzzing suites.
3. **Parity Verification**: Spot-check generated registry files and data schemas against hardware spec sources.

---

## 7. WebAssembly & AudioWorklet Core Constraints

When porting JUCE-based DSP engines to run inside a headless browser environment (AudioWorklet + Emscripten WASM), the following rules are critical:

### A. Thread Entropy Restrictions (`juce::Random` Safety)
- **The Bug**: `juce::Random`'s default constructor seeks random system entropy (e.g., `/dev/urandom` or browser crypto APIs). Calling it inside the high-priority, isolated `AudioWorkletProcessor` thread triggers a web security exception, causing an immediate crash with `libc++abi: terminating` or `RuntimeError: unreachable`.
- **The Rule**: **NEVER** use the default constructor or system-wide static methods (like `juce::Random::getSystemRandom()`) in any class compiled for the AudioWorklet.
- **The Pattern**: Initialize all random generators using an explicit, constant seed constructor: `juce::Random noiseGen (12345);`.
- **Ultra-performance Alternative**: For fast oscillators (like LFO Sample & Hold) where a heavy class instantiation is undesirable, use an inline **Linear Congruential Generator (LCG)**:
  ```cpp
  // Inline LCG pseudo-random value between -1.0f and 1.0f
  lcgSeed = lcgSeed * 196314165u + 907633515u;
  float randomValue = (2.f * (float)lcgSeed / (float)0xFFFFFFFFu) - 1.f;
  ```

### B. Emscripten Memory Heap Exports (`HEAPF32`)
- **The Bug**: High-performance javascript pipelines copy and write audio channels directly out of the WASM memory block. By default, release-level optimizations may strip reference access to JavaScript runtime arrays.
- **The Rule**: You must explicitly instruct Emscripten's linker to keep and export the float heap arrays. Add `'HEAPF32'` to the compiler configuration (`EXPORTED_RUNTIME_METHODS`) in your CMake config:
  ```cmake
  -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','HEAPF32']"
  ```

### C. Parameter Mapping & Desnormalization Bridges
- **The Bug**: The WebUI communicates knob, switch, and slider values as normalized floats (`0.0f` to `1.0f`). Directly casting them or truncating them inside the C++ bridge (e.g., `(int)getMap("param")`) leads to index loss or silent DSP features (such as division settings truncating to 0).
- **The Rule**: Always desnormalize and scale the incoming parameter float inside the `WasmBridge.cpp` sync logic using `std::lround()` or mathematical ranges to match the native C++ expectation:
  ```cpp
  gParams.polyMode = (int)std::lround(getMap("polyMode", 0.0f) * 2.0f) + 1; // Maps 0.0, 0.5, 1.0 -> 1, 2, 3
  ```

### D. Single-File Packaging Standard (Base64 Embedding)
- **Problem**: AudioWorklets execute in a highly isolated scope without access to standard window methods or network requests. Fetching a separate `.wasm` file asynchronously inside the worklet context often triggers CORS/security blockers.
- **Best Practice**: Embed the binary `.wasm` file directly inside the `.js` glue code as a Base64 string using `-s SINGLE_FILE=1` in the linker flags. This guarantees zero-dependency loading in production.

### E. Zero-Copy Heap Aliasing (Garbage Collection Prevention)
- **Problem**: Re-allocating typed array views (like `new Float32Array(...)`) inside the `process()` callback of the AudioWorklet generates garbage collector (GC) pressure, leading to periodic audio dropouts (clicks/pops).
- **Best Practice**: Cache references to the WASM heap subarray views during the initialization phase (`HEAPF32.subarray(ptr, ptr + len)`). In the render loop, copy data using in-place operations (`outputBuffer.set(cachedSubarray)`) instead of creating fresh array instances.

### F. Allocator Tuning for Web Audio (`emmalloc`)
- **Best Practice**: Use Emscripten's specialized allocator `-s MALLOC=emmalloc` for AudioWorklets. It is optimized for minimum code footprint and real-time execution profiles, avoiding the runtime footprint of `dlmalloc` or the memory overhead of multithreaded allocators.
