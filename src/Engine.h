// Whiskerwave engine core, ported from the mockup's JS engine (dsp1/dsp2/dsp_filt).
// Milestone 1: wavetable oscillators A, B, C with unison, sub, noise, filters, two envelopes.
// Not ported yet: warp modes, FM/AM, feedback, sample/granular engines, modulation matrix, FX chains, arp.
#pragma once
#include <array>
#include <cassert>
#include <string>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <memory>
#include <mutex>
#include <vector>
#include "TableNames.h"

namespace whisker
{
constexpr double kPi = 3.14159265358979323846;
constexpr double kTau = 2.0 * kPi;
constexpr int kBlock = 32;           // control rate block, like the JS engine
constexpr int kMaxVoices = 32;
constexpr int kLevels = 11;          // band-limited copies of every frame
constexpr int kStride = kTableLen + 1;

inline double clampd(double x, double a, double b) { return x < a ? a : (x > b ? b : x); }
inline double mtof(double n) { return 440.0 * std::pow(2.0, (n - 69.0) / 12.0); }
inline double fastTanh(double x)
{
    if (x > 3) return 1;
    if (x < -3) return -1;
    const double x2 = x * x; return x * (27 + x2) / (27 + 9 * x2);
}
inline double curveG(double x, double k) { return std::abs(k) < 1e-3 ? x : (1 - std::exp(-k * x)) / (1 - std::exp(-k)); }

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

// Builds the 11 band-limited levels of one table exactly like WT.build() in the JS engine.
inline std::unique_ptr<Table> buildTable(const int16_t* src, bool taper)
{
    auto t = std::make_unique<Table>();
    t->d.assign((size_t) kLevels * kTableFrames * kStride, 0.f);
    const int N = kTableLen, H = N / 2;
    std::vector<double> re((size_t) N), im((size_t) N), r((size_t) N), i2((size_t) N);
    for (int f = 0; f < kTableFrames; ++f)
    {
        for (int i = 0; i < N; ++i) { re[(size_t) i] = src[(size_t) f * N + (size_t) i] / 32767.0; im[(size_t) i] = 0; }
        fftInPlace(re, im, false);
        for (int m = 0; m < kLevels; ++m)
        {
            const int maxH = std::max(1, H >> m), t0 = (int) std::floor(maxH * 0.7);
            std::fill(r.begin(), r.end(), 0.0); std::fill(i2.begin(), i2.end(), 0.0);
            for (int k = 1; k <= maxH && k < H; ++k)
            {
                const double g = (taper && m > 0 && k > t0) ? 0.5 + 0.5 * std::cos(kPi * (k - t0) / (maxH + 1 - t0)) : 1.0;
                r[(size_t) k] = re[(size_t) k] * g; i2[(size_t) k] = im[(size_t) k] * g;
                r[(size_t) (N - k)] = re[(size_t) (N - k)] * g; i2[(size_t) (N - k)] = im[(size_t) (N - k)] * g;
            }
            fftInPlace(r, i2, true);
            float* o = &t->d[((size_t) m * kTableFrames + (size_t) f) * kStride];
            for (int i = 0; i < N; ++i) o[i] = (float) r[(size_t) i];
            o[N] = o[0];
        }
    }
    return t;
}

// Holds every table that was ever asked for, so the audio thread can use plain pointers without freeing anything.
class TableCache
{
public:
    void setSource(const void* data, size_t bytes)
    { src = static_cast<const int16_t*>(data); assert(bytes >= (size_t) kNumTables * kTableFrames * kTableLen * 2); (void) bytes; }
    const Table* get(int index) // message thread only (may build)
    {
        index = std::max(0, std::min(kNumTables - 1, index));
        std::lock_guard<std::mutex> lk(m);
        if (!tabs[(size_t) index] && src)
        {
            const std::string cat = kTableCats[index];
            tabs[(size_t) index] = buildTable(src + (size_t) index * kTableFrames * kTableLen, cat == "FM" || cat == "Bell");
        }
        return tabs[(size_t) index].get();
    }
private:
    const int16_t* src = nullptr;
    std::mutex m;
    std::array<std::unique_ptr<Table>, kNumTables> tabs;
};

// ---------------------------------------------------------------- patch (plain values read once per host block)
struct OscP
{
    bool on = false; const Table* tab = nullptr;
    float pos = 0, lvl = .6f, pan = 0, ph = 0, rnd = 1, ud = .25f, ub = .5f, usp = .7f, anl = 0, fine = 0;
    int oct = 0, semi = 0, uv = 1, us = 0, rt = 1;
    int w1 = 0, w2 = 0, mm = 0, ms = 0; float w1a = 0, w2a = 0, ma = 0, fb = 0; // warp 1/2, FM/AM/ring from source ms (A,B,C,Sub), feedback
};
struct FiltP { int type = 0; float cut = 9000, res = .2f, kt = .25f, env = 0; int es = 2; };
struct EnvP { float a = 2, h = 0, d = 400, s = .7f, r = 180, c = -.4f, ca = 0; };
struct Patch
{
    OscP o[3];
    FiltP f[2];
    EnvP e[2];
    bool serial = true;
    float master = 3, vel = .6f, bendr = 2;
    int poly = 16;
    bool sub = false, nz = false;
    int subw = 0, subo = -1, subrt = 0, nzt = 0, nzrt = 0;
    float subl = .5f, subpw = .5f, subfn = 0, subpn = 0, nzl = .3f, nzpn = 0;
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
struct Env
{
    int st = 0; double v = 0, x = 0, v0 = 0, a0 = 0;
    void on() { a0 = st == 0 ? 0 : v; st = 1; x = 0; }
    void off() { if (st != 0 && st != 5) { st = 5; x = 0; v0 = v; } }
    double tick(double dt, double a, double h, double d, double s, double r, double ca, double c)
    {
        switch (st)
        {
            case 1: x += dt * 1000 / a; if (x >= 1) { x = 0; v = 1; st = h > 0 ? 2 : 3; } else v = a0 + (1 - a0) * curveG(x, ca * 5); break;
            case 2: x += dt * 1000 / h; v = 1; if (x >= 1) { x = 0; st = 3; } break;
            case 3: x += dt * 1000 / d; if (x >= 1) { x = 1; st = 4; v = s; } else v = s + (1 - s) * (1 - curveG(x, -c * 5)); break;
            case 4: v = s; break;
            case 5: x += dt * 1000 / r; if (x >= 1) { v = 0; st = 0; } else v = v0 * (1 - curveG(x, -c * 5)); break;
            default: v = 0;
        }
        return v;
    }
};

// ---------------------------------------------------------------- filter (VFilt in JS; types 0,2,3,6,7,8,10,14..17)
// type ids are the JS filter list indices.
struct Filt
{
    static constexpr int kC = 16;
    int type = 0; double sr = 44100, res = 0;
    double cur[kC] {}, tgt[kC] {}, dlt[kC] {};
    double ggC = 0, ggT = 0, ggD = 0, kC_ = 0, kT = 0, kD = 0;
    double s[48] {};
    int ramp = 0; bool fresh = true;

    void reset() { fresh = true; ramp = 0; std::fill(std::begin(s), std::end(s), 0.0); }
    void su(double* c, int i, double f, double k) const
    {
        f = clampd(f, 20, sr * .47);
        const double g = std::tan(kPi * f / sr), a1 = 1 / (1 + g * (g + k));
        c[i * 4] = a1; c[i * 4 + 1] = g * a1; c[i * 4 + 2] = g * g * a1; c[i * 4 + 3] = k;
    }
    void set(int t, double fc, double rs, double sampleRate, int n)
    {
        sr = sampleRate; res = rs;
        const bool same = !fresh && t == type;
        double nc[kC] {}; double ng = 0, nk = 0;
        fc = clampd(fc, 20, sr * .45);
        const double q = 2 - 1.96 * rs;
        if (t == 2 || t == 6 || t == 8 || t == 10) su(nc, 0, fc, q);
        else if (t == 3 || t == 7) { su(nc, 0, fc, 1.4); su(nc, 1, fc, q); }
        else if (t >= 14 && t <= 17) { const double g = std::tan(kPi * fc / sr); ng = g / (1 + g); nk = rs * 4; }
        type = t;
        if (!same) { for (int i = 0; i < kC; ++i) { cur[i] = tgt[i] = nc[i]; dlt[i] = 0; } ggC = ggT = ng; kC_ = kT = nk; ggD = kD = 0; ramp = 0; fresh = false; return; }
        const double inv = 1.0 / std::max(1, n);
        for (int i = 0; i < kC; ++i) { tgt[i] = nc[i]; dlt[i] = (nc[i] - cur[i]) * inv; }
        ggT = ng; ggD = (ng - ggC) * inv; kT = nk; kD = (nk - kC_) * inv; ramp = n;
    }
    void step()
    {
        if (ramp <= 0) return;
        if (--ramp <= 0) { for (int i = 0; i < kC; ++i) cur[i] = tgt[i]; ggC = ggT; kC_ = kT; return; }
        for (int i = 0; i < kC; ++i) cur[i] += dlt[i];
        ggC += ggD; kC_ += kD;
    }
    double u(int ch, int i, double x, int m)
    {
        const int j = i * 4, so = ch * 24 + i * 2;
        const double a1 = cur[j], a2 = cur[j + 1], a3 = cur[j + 2], k = cur[j + 3];
        const double v3 = x - s[so + 1], v1 = a1 * s[so] + a2 * v3, v2 = s[so + 1] + a2 * s[so] + a3 * v3;
        s[so] = 2 * v1 - s[so]; s[so + 1] = 2 * v2 - s[so + 1];
        const double hp = x - k * v1 - v2;
        return m == 0 ? v2 : (m == 1 ? v1 : (m == 2 ? hp : (m == 3 ? v2 + hp : v1 * k)));
    }
    void lad(int ch, double xi)
    {
        double* o = s + ch * 24;
        const double G = ggC, k = kC_, G2 = G * G, G3 = G2 * G, G4 = G2 * G2, c = 1 - G;
        const double z1 = o[20], z2 = o[21], z3 = o[22], z4 = o[23];
        double uu = (xi - k * c * (G3 * z1 + G2 * z2 + G * z3 + z4)) / (1 + k * G4);
        uu = fastTanh(uu * .3) * 3.333333;
        double v = (uu - z1) * G; const double y1 = v + z1; o[20] = y1 + v;
        v = (y1 - z2) * G; const double y2 = v + z2; o[21] = y2 + v;
        v = (y2 - z3) * G; const double y3 = v + z3; o[22] = y3 + v;
        v = (y3 - z4) * G; const double y4 = v + z4; o[23] = y4 + v;
        o[16] = y1; o[17] = y2; o[18] = y3; o[19] = y4;
    }
    double one(int ch, double xi)
    {
        double* o = s + ch * 24;
        switch (type)
        {
            case 2: return u(ch, 0, xi, 0);
            case 3: return u(ch, 1, u(ch, 0, xi, 0), 0);
            case 6: return u(ch, 0, xi, 2);
            case 7: return u(ch, 1, u(ch, 0, xi, 2), 2);
            case 8: return u(ch, 0, xi, 4);
            case 10: return u(ch, 0, xi, 3);
            case 14: lad(ch, xi); return o[19] * (1 + .5 * res);
            case 15: lad(ch, xi); return o[17] * (1 + .6 * res);
            case 16: lad(ch, xi); return o[18] * 1.4 * (1 + .5 * res);
            case 17: lad(ch, xi); return xi - 4 * o[16] + 6 * o[17] - 4 * o[18] + o[19];
            default: return xi;
        }
    }
    void proc(double l, double r, double& ol, double& orr)
    {
        if (type == 0) { ol = l; orr = r; return; }
        step();
        ol = one(0, l); orr = one(1, r);
    }
};
}
