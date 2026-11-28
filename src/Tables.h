// Wavetables: band-limited levels, spectral warp and smear (WT.build in dsp1.js), warp functions.
#pragma once
#include <array>
#include <cassert>
#include <string>
#include <cmath>
#include <cstdint>
#include <memory>
#include <mutex>
#include <vector>
#include <map>
#include "Dsp.h"
#include "TableNames.h"
namespace whisker {
constexpr int kBlock = 32;           // control rate block, like the JS engine
constexpr int kMaxVoices = 32;
constexpr int kLevels = 11;          // band-limited copies of every frame
constexpr int kStride = kTableLen + 1;
// ---------------------------------------------------------------- wavetables
inline void fftInPlace(std::vector<double>& re, std::vector<double>& im, bool inverse)
{
    const int n = (int) re.size();
    for (int i = 1, j = 0; i < n; ++i)
    {
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { std::swap(re[(size_t) i], re[(size_t) j]); std::swap(im[(size_t) i], im[(size_t) j]); }
    }
    for (int len = 2; len <= n; len <<= 1)
    {
        const double ang = (inverse ? 2.0 : -2.0) * kPi / len, wr = std::cos(ang), wi = std::sin(ang);
        const int h = len >> 1;
        for (int i = 0; i < n; i += len)
        {
            double cr = 1, ci = 0;
            for (int k = 0; k < h; ++k)
            {
                const size_t a = (size_t) (i + k), b = a + (size_t) h;
                const double xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
                re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
                const double t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
            }
        }
    }
    if (inverse) for (int i = 0; i < n; ++i) { re[(size_t) i] /= n; im[(size_t) i] /= n; }
}

struct Table
{
    std::vector<float> d; // [(level * frames + frame) * kStride + i]
    const float* frame(int level, int f) const { return &d[((size_t) level * kTableFrames + (size_t) f) * kStride]; }
};

// Builds the 11 band-limited levels exactly like WT.build(sw, sk) in the JS engine.
inline std::unique_ptr<Table> buildTable(const int16_t* src, bool taper, double sw = 0, double sk = 0)
{
    auto t = std::make_unique<Table>();
    t->d.assign((size_t) kLevels * kTableFrames * kStride, 0.f);
    const int N = kTableLen, H = N / 2;
    std::vector<double> re((size_t) N), im((size_t) N), r2((size_t) N), i2((size_t) N), r((size_t) N), i3((size_t) N);
    for (int f = 0; f < kTableFrames; ++f)
    {
        for (int i = 0; i < N; ++i) { re[(size_t) i] = src[(size_t) f * N + (size_t) i] / 32767.0; im[(size_t) i] = 0; }
        fftInPlace(re, im, false);
        if (sw != 0 || sk != 0)
        {
            std::fill(r2.begin(), r2.end(), 0.0); std::fill(i2.begin(), i2.end(), 0.0);
            for (int k = 1; k < H; ++k)
            {
                const double s = sw < 0 ? k * (1 + sw * 0.9) : k - sw * 24;
                if (s < 1 || s >= H - 1) continue;
                const int a = (int) std::floor(s); const double fr = s - a;
                r2[(size_t) k] = re[(size_t) a] * (1 - fr) + re[(size_t) a + 1] * fr; i2[(size_t) k] = im[(size_t) a] * (1 - fr) + im[(size_t) a + 1] * fr;
            }
            if (sk > 0)
            {
                const int w = std::max(1, (int) std::lround(sk * 5));
                for (int k = 1; k < H; ++k)
                {
                    double sr = 0, si = 0; int c = 0;
                    for (int j = -w; j <= w; ++j) { const int q = k + j; if (q < 1 || q >= H) continue; sr += r2[(size_t) q]; si += i2[(size_t) q]; ++c; }
                    r2[(size_t) k] = r2[(size_t) k] * (1 - sk) + sk * sr / c; i2[(size_t) k] = i2[(size_t) k] * (1 - sk) + sk * si / c;
                }
            }
            for (int k = 1; k < H; ++k) { r2[(size_t) (N - k)] = r2[(size_t) k]; i2[(size_t) (N - k)] = -i2[(size_t) k]; }
            re = r2; im = i2;
        }
        for (int m = 0; m < kLevels; ++m)
        {
            const int maxH = std::max(1, H >> m), t0 = (int) std::floor(maxH * 0.7);
            std::fill(r.begin(), r.end(), 0.0); std::fill(i3.begin(), i3.end(), 0.0);
            for (int k = 1; k <= maxH && k < H; ++k)
            {
                const double g = (taper && m > 0 && k > t0) ? 0.5 + 0.5 * std::cos(kPi * (k - t0) / (maxH + 1 - t0)) : 1.0;
                r[(size_t) k] = re[(size_t) k] * g; i3[(size_t) k] = im[(size_t) k] * g;
                r[(size_t) (N - k)] = re[(size_t) (N - k)] * g; i3[(size_t) (N - k)] = im[(size_t) (N - k)] * g;
            }
            fftInPlace(r, i3, true);
            float* o = &t->d[((size_t) m * kTableFrames + (size_t) f) * kStride];
            for (int i = 0; i < N; ++i) o[i] = (float) r[(size_t) i];
            o[N] = o[0];
        }
    }
    return t;
}

// Holds every table that was ever asked for (per table, warp and smear), so the audio thread can use plain pointers.
class TableCache
{
public:
    void setSource(const void* data, size_t bytes)
    { src = static_cast<const int16_t*>(data); assert(bytes >= (size_t) kNumTables * kTableFrames * kTableLen * 2); (void) bytes; }
    const Table* get(int index, double sw = 0, double sk = 0) // message thread only (may build)
    {
        index = std::max(0, std::min(kNumTables - 1, index));
        sw = std::round(sw * 20) / 20; sk = std::round(sk * 20) / 20;
        const long key = (long) index * 1000000 + (long) std::lround(sw * 20 + 20) * 1000 + (long) std::lround(sk * 20);
        std::lock_guard<std::mutex> lk(m);
        auto it = tabs.find(key);
        if (it != tabs.end()) return it->second.get();
        if (!src) return nullptr;
        const std::string cat = kTableCats[index];
        auto t = buildTable(src + (size_t) index * kTableFrames * kTableLen, cat == "FM" || cat == "Bell", sw, sk);
        const Table* p = t.get(); tabs[key] = std::move(t); return p;
    }
private:
    const int16_t* src = nullptr;
    std::mutex m;
    std::map<long, std::unique_ptr<Table>> tabs;
};


// warp modes (wph / wamp in the JS engine)
inline double wph(int id, double a, double p)
{
    switch (id)
    {
        case 1: { const double r = 1 + a * 7; return std::fmod(p * r, 1.0); }
        case 2: return std::pow(p, 1 + a * 3);
        case 3: return 1 - std::pow(1 - p, 1 + a * 3);
        case 4: return p < .5 ? .5 * std::pow(2 * p, 1 + a * 3) : 1 - .5 * std::pow(2 * (1 - p), 1 + a * 3);
        case 5: { const double w = .5 - a * .45; return p < w ? p * .5 / w : .5 + (p - w) * .5 / (1 - w); }
        case 6: return p * (1 - a) + (p < .5 ? 2 * p : 2 - 2 * p) * a;
        case 7: return p + a * .25 * std::sin(kTau * p) / kPi * 2;
        case 8: { const double st = std::max(2.0, std::round(66 - a * 64)); return p + (std::floor(p * st) / st - p) * std::min(1.0, a * 3); }
        default: return p;
    }
}
inline double wamp(int id, double a, double s, double p)
{
    switch (id)
    {
        case 9: { double y = s * (1 + a * 6); int n = 0; while ((y > 1 || y < -1) && n++ < 8) y = y > 1 ? 2 - y : -2 - y; return y; }
        case 10: { const double g = 1 + a * 8; return clampd(s * g, -1, 1) * (1 - .3 * a); }
        case 11: { const double q = std::pow(2.0, 1 + (1 - a) * 10); return std::round(s * q) / q; }
        case 12: return p < .5 ? s : s * (1 - 2 * a);
        default: return s;
    }
}

// ---------------------------------------------------------------- envelope (Env.tick in JS)
} // namespace whisker
