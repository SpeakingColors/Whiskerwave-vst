#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>
#include "WaveBank.h"

namespace whisker
{
// Raw parameter pointers shared by all voices (read each block).
struct Params
{
    std::atomic<float> *pos{}, *uni{}, *det{}, *spread{}, *aA{}, *aD{}, *aS{}, *aR{},
        *fc{}, *fr{}, *fe{}, *fA{}, *fD{}, *fS{}, *fR{}, *lfoRate{}, *lfoAmt{}, *vol{}, *bend{};
};

struct Sound : juce::SynthesiserSound
{
    bool appliesToNote(int) override { return true; }
    bool appliesToChannel(int) override { return true; }
};

class Voice : public juce::SynthesiserVoice
{
public:
    static constexpr int kMaxUni = 7;
    Voice(const WaveBank& b, const Params& p) : bank(b), P(p) {}
    bool canPlaySound(juce::SynthesiserSound* s) override { return dynamic_cast<Sound*>(s) != nullptr; }

    void startNote(int note, float vel, juce::SynthesiserSound*, int pitchWheel) override
    {
        midiNote = note; velocity = vel; bendSemis = (float) (pitchWheel - 8192) / 8192.f * P.bend->load();
        juce::Random r((juce::int64) note * 7919 + juce::Time::getMillisecondCounter());
        for (auto& ph : phase) ph = r.nextFloat();
        lfoPhase = 0.f;
        amp.setSampleRate(getSampleRate()); flt.setSampleRate(getSampleRate());
        amp.setParameters({ P.aA->load(), P.aD->load(), P.aS->load(), P.aR->load() });
        flt.setParameters({ P.fA->load(), P.fD->load(), P.fS->load(), P.fR->load() });
        amp.noteOn(); flt.noteOn();
        svf[0].reset(); svf[1].reset();
        juce::dsp::ProcessSpec spec{ getSampleRate(), 512, 1 };
        svf[0].prepare(spec); svf[1].prepare(spec);
        svf[0].setType(juce::dsp::StateVariableTPTFilterType::lowpass);
        svf[1].setType(juce::dsp::StateVariableTPTFilterType::lowpass);
    }
    void stopNote(float, bool tail) override
    {
        if (tail) { amp.noteOff(); flt.noteOff(); } else { amp.reset(); flt.reset(); clearCurrentNote(); }
    }
    void pitchWheelMoved(int v) override { bendSemis = (float) (v - 8192) / 8192.f * P.bend->load(); }
    void controllerMoved(int, int) override {}

    void renderNextBlock(juce::AudioBuffer<float>& out, int start, int num) override
    {
        if (!isVoiceActive()) return;
        const float sr = (float) getSampleRate();
        amp.setParameters({ P.aA->load(), P.aD->load(), P.aS->load(), P.aR->load() });
        flt.setParameters({ P.fA->load(), P.fD->load(), P.fS->load(), P.fR->load() });
        const int uni = juce::jlimit(1, kMaxUni, (int) P.uni->load());
        const float detCents = P.det->load(), spread = P.spread->load();
        const float baseHz = 440.f * std::pow(2.f, ((float) midiNote - 69.f + bendSemis) / 12.f);
        const float pos0 = P.pos->load(), lfoRate = P.lfoRate->load(), lfoAmt = P.lfoAmt->load();
        const float cutoff = P.fc->load(), fenv = P.fe->load();
        const float q = 0.707f + P.fr->load() * 9.f, gain = P.vol->load() * velocity / std::sqrt((float) uni);
        float ratio[kMaxUni], pan[kMaxUni];
        for (int u = 0; u < uni; ++u)
        {
            const float t = uni == 1 ? 0.f : (2.f * (float) u / (float) (uni - 1) - 1.f);
            ratio[u] = std::pow(2.f, t * detCents / 1200.f);
            pan[u] = 0.5f + 0.5f * t * spread;
        }
        const int level = WaveBank::levelFor(baseHz * ratio[uni - 1], sr);
        auto* L = out.getWritePointer(0, start);
        auto* R = out.getNumChannels() > 1 ? out.getWritePointer(1, start) : nullptr;
        for (int i = 0; i < num; ++i)
        {
            lfoPhase += lfoRate / sr; if (lfoPhase >= 1.f) lfoPhase -= 1.f;
            const float lfo = std::sin(juce::MathConstants<float>::twoPi * lfoPhase);
            const float pos = juce::jlimit(0.f, (float) (kNumWaves - 1), pos0 + lfo * lfoAmt * 0.25f * (float) (kNumWaves - 1));
            float sl = 0.f, sr_ = 0.f;
            for (int u = 0; u < uni; ++u)
            {
                phase[u] += baseHz * ratio[u] / sr; if (phase[u] >= 1.f) phase[u] -= 1.f;
                const float s = bank.read(phase[u], pos, level);
                sl += s * (1.f - pan[u]); sr_ += s * pan[u];
            }
            const float fe_ = flt.getNextSample();
            const float fcHz = juce::jlimit(20.f, 0.45f * sr, cutoff * std::pow(2.f, fenv * fe_ * 5.f));
            svf[0].setCutoffFrequency(fcHz); svf[1].setCutoffFrequency(fcHz);
            svf[0].setResonance(q); svf[1].setResonance(q);
            const float a = amp.getNextSample() * gain * 2.f;
            sl = svf[0].processSample(0, sl) * a; sr_ = svf[1].processSample(0, sr_) * a;
            L[i] += sl; if (R) R[i] += sr_;
        }
        if (!amp.isActive()) clearCurrentNote();
    }

private:
    const WaveBank& bank; const Params& P;
    int midiNote = 60; float velocity = 1.f, bendSemis = 0.f, lfoPhase = 0.f;
    float phase[kMaxUni] {};
    juce::ADSR amp, flt;
    juce::dsp::StateVariableTPTFilter<float> svf[2];
};
}
