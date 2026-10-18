#pragma once
#include <juce_dsp/juce_dsp.h>
#include <vector>
#include <cmath>
#include "WaveData.h"

namespace whisker
{
// All wavetables, each stored at several band-limited levels (level k keeps harmonics up to 1024 >> k).
// A voice picks the level from its pitch, so high notes do not alias.
class WaveBank
{
public:
    static constexpr int kLevels = 10, kLen = kWaveLen;

    WaveBank()
    {
        data.assign((size_t) kNumWaves * kLevels * (kLen + 1), 0.f);
        juce::dsp::FFT fft(11); // 2048
        std::vector<std::complex<float>> time((size_t) kLen), freq((size_t) kLen);
        for (int w = 0; w < kNumWaves; ++w)
        {
            double mean = 0.0;
            for (int i = 0; i < kLen; ++i) mean += kWaveData[w][i];
            mean /= kLen;
            float peak = 1e-9f;
            for (int i = 0; i < kLen; ++i) peak = std::max(peak, std::abs((float) (kWaveData[w][i] - mean)));
            for (int i = 0; i < kLen; ++i) time[(size_t) i] = { (float) (kWaveData[w][i] - mean) / peak, 0.f }; // remove DC, normalise
            fft.perform(time.data(), freq.data(), false);
            for (int lvl = 0; lvl < kLevels; ++lvl)
            {
                const int maxH = std::max(1, (kLen / 2) >> lvl);
                auto f = freq;
                for (int k = 1; k < kLen / 2; ++k)
                    if (k > maxH) { f[(size_t) k] = 0.f; f[(size_t) (kLen - k)] = 0.f; }
                f[0] = 0.f; f[kLen / 2] = 0.f;
                fft.perform(f.data(), time.data(), true);
                float* dst = &data[((size_t) w * kLevels + (size_t) lvl) * (kLen + 1)];
                for (int i = 0; i < kLen; ++i) dst[i] = time[(size_t) i].real();
                dst[kLen] = dst[0];
            }
        }
    }

    // frequency in Hz -> level index
    static int levelFor(float hz, float sampleRate)
    {
        const float allowed = 0.5f * sampleRate / std::max(hz, 1.f); // harmonics that fit below Nyquist
        int lvl = 0;
        while (lvl < kLevels - 1 && (float) ((kLen / 2) >> lvl) > allowed) ++lvl;
        return lvl;
    }

    const float* table(int wave, int level) const
    {
        return &data[((size_t) juce::jlimit(0, kNumWaves - 1, wave) * kLevels + (size_t) juce::jlimit(0, kLevels - 1, level)) * (kLen + 1)];
    }

    // phase 0..1, morph position 0..kNumWaves-1
    float read(float phase, float pos, int level) const
    {
        const int i0 = juce::jlimit(0, kNumWaves - 1, (int) pos);
        const int i1 = std::min(i0 + 1, kNumWaves - 1);
        const float fr = pos - (float) i0;
        const float x = phase * (float) kLen;
        const int a = (int) x; const float t = x - (float) a;
        const float* A = table(i0, level); const float* B = table(i1, level);
        const float va = A[a] + (A[a + 1] - A[a]) * t, vb = B[a] + (B[a + 1] - B[a]) * t;
        return va + (vb - va) * fr;
    }

private:
    std::vector<float> data;
};
}
