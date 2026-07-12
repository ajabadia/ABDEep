#pragma once

namespace ABD
{
    /**
     * Generador de envolvente ADSR de 4 fases con curvatura ajustable por etapa.
     */
    class Envelope
    {
    public:
        enum class Stage
        {
            kIdle,
            kAttack,
            kDecay,
            kSustain,
            kRelease
        };

        Envelope();
        ~Envelope() = default;

        void setSampleRate(double sampleRate);
        void setParameters(float attackTimeSec, float decayTimeSec, float sustainLevel, float releaseTimeSec);
        void setCurves(float attackCurve, float decayCurve, float sustainCurve, float releaseCurve);

        void trigger();
        void release();
        void reset();

        float nextSample();
        bool isActive() const { return currentStage != Stage::kIdle; }
        Stage getCurrentStage() const { return currentStage; }

    private:
        double sampleRate = 44100.0;
        Stage currentStage = Stage::kIdle;

        // Tiempos y niveles de destino
        float attackTime = 0.01f;
        float decayTime = 0.1f;
        float sustainLevel = 1.0f;
        float releaseTime = 0.2f;

        // Curvaturas (-1.0 a 1.0: < 0 exp, 0 linear, > 0 log)
        float attackCurve = 0.0f;
        float decayCurve = 0.0f;
        float sustainCurve = 0.0f;
        float releaseCurve = 0.0f;

        // Estado interno de la fase actual
        double currentProgress = 0.0; // 0.0 a 1.0 dentro de la fase actual
        double progressIncrement = 0.0;
        double currentStageDurationSec = 0.01; // duración de la fase actual (para setTimeScale)
        float startLevel = 0.0f;
        float targetLevel = 0.0f;
        float currentLevel = 0.0f;

        void changeStage(Stage newStage);
        float applyCurve(float progress, float curveAmount);

    public:
        /**
         * Ajusta dinámicamente la velocidad de la fase actual.
         * scale=1.0 → velocidad normal.
         * scale>1.0 → fase más rápida (menor duración).
         * scale<1.0 → fase más lenta (mayor duración).
         * Se usa para aplicar envTimeDrift del Analog Drift Engine.
         */
        void setTimeScale(float scale);

        /**
         * Activa/desactiva el modo Loop.
         * En modo Loop, al completar la fase Decay (entrar a Sustain),
         * la envolvente se re-triggerea automáticamente a Attack.
         * Release() desactiva el loop temporalmente para que el release
         * complete y la envolvente retorne a Idle.
         */
        void setLoopMode(bool loop);
        bool getLoopMode() const { return loopMode; }

    private:
        bool loopMode = false;
    };
}
