// Voice and polyphonic engine (port of Voice.control/render and Engine.process from the mockup JS engine).
#pragma once
#include "Engine.h"
#include <algorithm>
#include <random>

namespace whisker
{
inline double pblep(double t, double dt)
{
    if (t < dt) { t /= dt; return t + t - t * t - 1; }
    if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
    return 0;
}
inline double subWave(int w, double p, double dt, double pw)
{
    dt = std::min(.45, std::max(1e-6, dt));
    switch (w)
    {
        case 0: return std::sin(kTau * p);
        case 1: return p < .5 ? 4 * p - 1 : 3 - 4 * p;
        case 2: case 4: return ((p < pw ? 1 : -1) + pblep(p, dt) - pblep(std::fmod(p - pw + 1, 1.0), dt)) * .7;
        case 3: return ((2 * p - 1) - pblep(p, dt)) * .7;
        case 5: { const double s = std::sin(kTau * p); return (s > 0 ? s : 0) * 1.6 - .5; }
        case 6: return std::tanh(std::sin(kTau * p) * 3) * .9;
        default: return (std::sin(kTau * p) + .5 * std::sin(kTau * 2 * p) + .25 * std::sin(kTau * 3 * p)) * .62;
    }
}

// JP-8000 style detune curves (Szabo 2010), same constants as the JS engine
static const double kJpOff[6] = { -0.11002313, -0.06288439, -0.01952356, 0.01991221, 0.06216538, 0.10745242 };
static const double kJpC[12] = { 10028.7312891634, -50818.8652045924, 111363.4808729368, -138150.6761080548, 106649.6679158292,
                                 -53046.9642751875, 17019.9518580080, -3425.0836591318, 404.2703938388, -24.1878824391, 0.6717417634, 0.0030115596 };
inline double jpCurve(double x) { double y = 0; for (double c : kJpC) y = y * x + c; return std::max(0.0, y); }
inline double jpCen(double m) { return -0.55366 * m + 0.99785; }
inline double jpSide(double m) { return -0.73764 * m * m + 1.2841 * m + 0.044372; }

class Voice
{
public:
    bool active = false, gate = false;
    int note = 60; double vel = 1; uint64_t serial = 0;

    void start(int n, double v, double sampleRate, const Patch& P, uint64_t ser, std::mt19937& rng)
    {
        sr = sampleRate; active = true; gate = true; note = n; vel = v; serial = ser;
        std::uniform_real_distribution<double> u01(0, 1), u11(-1, 1);
        if (env[0].st == 0) { s1.fill(0); s2.fill(0); }
        env[0].on(); env[1].on();
        for (double& x : anP) x = u11(rng);
        for (double& x : anC) x = u11(rng);
        anE = u11(rng);
        for (int j = 0; j < 3; ++j) { anDt[j] = u11(rng); anDr[j] = anDt[j]; }
        for (int o = 0; o < 3; ++o)
            for (int u = 0; u < 8; ++u) ph[o][u] = std::fmod(P.o[o].ph + u01(rng) * P.o[o].rnd, 1.0);
        subPh = 0; fresh = true;
        ks = 1 - std::exp(-1 / (sr * .00035));
    }
    void release() { gate = false; env[0].off(); env[1].off(); }
    void kill()
    {
        active = false; gate = false; env[0].st = env[1].st = 0; env[0].v = env[1].v = 0;
        for (auto& f : flt) { f[0].reset(); f[1].reset(); }
    }

    // render n <= kBlock samples and add to out
    void render(int n, const Patch& P, double bendNorm, double* outL, double* outR, std::mt19937& rng)
    {
        const double dt = n / sr;
        std::uniform_real_distribution<double> u01(0, 1), u11(-1, 1);
        // analog life
        double anl = 0;
        for (int o = 0; o < 3; ++o) if (P.o[o].on) anl = std::max(anl, (double) P.o[o].anl);
        const double aef = anl > 0 ? 1 + anl * .05 * anE : 1.0;
        if (anl > 0)
        {
            const double k1 = std::min(1.0, dt / .7), pn = std::min(1.0, dt / 1.1);
            for (int j = 0; j < 3; ++j) { if (u01(rng) < pn) anDt[j] = u11(rng); anDr[j] += (anDt[j] - anDr[j]) * k1; }
        }
        // envelopes (block rate)
        const EnvP& e1 = P.e[0]; const EnvP& e2 = P.e[1];
        evP = ev; envP[0] = envV[0]; envP[1] = envV[1];
        env[0].tick(dt, e1.a * aef, e1.h, e1.d * aef, e1.s, e1.r * aef, e1.ca, e1.c);
        env[1].tick(dt, e2.a * aef, e2.h, e2.d * aef, e2.s, e2.r * aef, e2.ca, e2.c);
        ev = env[0].v; envV[0] = env[0].v; envV[1] = env[1].v;
        if (fresh) { evP = ev; envP[0] = envV[0]; envP[1] = envV[1]; }
        if (env[0].st == 0) { kill(); return; }
        const double bend = bendNorm * P.bendr;
        const double velg = (1 - P.vel) + P.vel * vel;
        // oscillator control
        struct Osc { int nU = 0; double inc[8], gL[8], gR[8], fmax = 0, posP = 0, pos = 0, lvP = 0, lv = 0; bool jp = false; double jg = 0; };
        Osc os[3];
        for (int o = 0; o < 3; ++o)
        {
            const OscP& c = P.o[o]; Osc& q = os[o];
            if (!c.on || !c.tab) { q.nU = 0; continue; }
            const double base = note + c.oct * 12 + c.semi + c.fine / 100.0 + bend;
            const int nU = std::max(1, c.uv); q.nU = nU;
            const double ud = c.ud, maxc = std::pow(ud, 1.6) * 120.0;
            double gsum = 0, gg[8];
            for (int u = 0; u < nU; ++u)
            {
                const double x = nU > 1 ? ((double) u / (nU - 1)) * 2 - 1 : 0;
                double cents = 0, semi = 0, gain = 1;
                switch (c.us)
                {
                    case 0: cents = x * maxc; break;
                    case 1: cents = (x < 0 ? -1 : 1) * std::pow(std::abs(x), 1.35) * maxc; gain = std::abs(x) > .01 ? .15 + .85 * c.ub : 1; break;
                    case 2:
                        if (u > 0 && nU > 1)
                        {
                            const double sx = nU > 2 ? (double) (u - 1) / (nU - 2) * 5 : 2.5;
                            const int i = std::min(4, (int) sx); const double f = sx - i, off = kJpOff[i] + (kJpOff[i + 1] - kJpOff[i]) * f;
                            cents = 1200 * std::log2(std::max(.5, 1 + jpCurve(ud) * off)); gain = jpSide(c.ub) / jpCen(c.ub);
                        }
                        break;
                    case 3: { static const int sm[8] = { 0, -12, 12, 0, 12, -12, 0, 12 }; semi = sm[u]; cents = (u % 2 ? -1 : 1) * maxc * .12; break; }
                    case 4: { static const int sm[8] = { 0, 7, 12, 0, 7, 12, 0, 7 }; semi = sm[u]; cents = (u % 2 ? -1 : 1) * maxc * .12; break; }
                    default: { static const int sm[8] = { 0, 3, 7, 12, 0, 3, 7, 12 }; semi = sm[u]; cents = (u % 2 ? -1 : 1) * maxc * .12; break; }
                }
                if (c.anl > 0) cents += c.anl * (5 * anP[o * 8 + u] + 3 * anDr[o]);
                q.inc[u] = mtof(base + semi + cents / 100.0) / sr;
                q.fmax = std::max(q.fmax, q.inc[u] * sr);
                gg[u] = gain; gsum += gain * gain;
                const double xp = c.us == 2 ? (u == 0 || nU < 2 ? 0 : (nU > 2 ? ((double) (u - 1) / (nU - 2)) * 2 - 1 : 0)) : x;
                const double pan = clampd(xp * c.usp, -1, 1) * .5 + .5;
                const double pp = clampd(c.pan * .5 + .5 + (pan - .5) * .999, 0, 1);
                q.gL[u] = std::cos(pp * kPi / 2); q.gR[u] = std::sin(pp * kPi / 2);
            }
            const double nrm = 1 / std::sqrt(gsum > 0 ? gsum : 1);
            for (int u = 0; u < nU; ++u) { q.gL[u] *= gg[u] * nrm; q.gR[u] *= gg[u] * nrm; }
            q.pos = c.pos; q.posP = fresh ? c.pos : lastPos[o]; lastPos[o] = c.pos;
            q.lv = c.lvl; q.lvP = fresh ? c.lvl : lastLvl[o]; lastLvl[o] = c.lvl;
            q.jp = c.us == 2 && nU > 1;
            if (q.jp) { const double fh = std::min(.45 * sr, mtof(base)); q.jg = std::tan(kPi * fh / sr); }
        }
        // filters: one pair per source, only the sources that are routed
        const double keyOct = (note - 60) / 12.0;
        double fcv[2];
        for (int f = 0; f < 2; ++f)
        {
            const FiltP& k = P.f[f];
            const double envv = k.es == 1 ? envV[0] : (k.es == 2 ? envV[1] : 0);
            fcv[f] = std::min(20000.0, k.cut * std::pow(2.0, keyOct * k.kt + 5 * k.env * envv) * (anl > 0 ? 1 + anl * .03 * anC[f] : 1));
        }
        const int rts[5] = { P.o[0].rt, P.o[1].rt, P.o[2].rt, P.subrt, P.nzrt };
        for (int s = 0; s < 5; ++s)
            if (rts[s] != 0) for (int f = 0; f < 2; ++f) flt[s][f].set(P.f[f].type, fcv[f], P.f[f].res, sr, n);
        // sub and noise parameters
        const double f0 = mtof(note + P.subo * 12 + bend + P.subfn / 100.0), sf = f0 / sr;
        // render
        for (int i = 0; i < n; ++i)
        {
            const double t = (double) i / n;
            const double evi = (evP + (ev - evP) * t) * velg;
            double sL[5] = { 0, 0, 0, 0, 0 }, sR[5] = { 0, 0, 0, 0, 0 };
            for (int o = 0; o < 3; ++o)
            {
                Osc& q = os[o]; if (q.nU == 0) continue;
                const Table* T = P.o[o].tab;
                const double maxH = std::max(1.0, std::floor(sr * .5 / q.fmax));
                int m = 0; if (maxH < 1024) m = std::min(10, (int) std::ceil(std::log2(1024.0 / maxH)));
                const double pos = q.posP + (q.pos - q.posP) * t;
                const double fi = pos * (kTableFrames - 1);
                const int f0i = std::min(kTableFrames - 1, (int) fi), f1i = std::min(kTableFrames - 1, f0i + 1);
                const double ff = fi - f0i;
                const float* A = T->frame(m, f0i); const float* B = T->frame(m, f1i);
                double sumL = 0, sumR = 0;
                for (int u = 0; u < q.nU; ++u)
                {
                    double p = ph[o][u] + q.inc[u]; if (p >= 1) p -= 1; ph[o][u] = p;
                    const double idx = p * kTableLen; const int i0 = (int) idx; const double fq = idx - i0;
                    const double a = A[i0] + (A[i0 + 1] - A[i0]) * fq, b = B[i0] + (B[i0 + 1] - B[i0]) * fq;
                    const double s = a + (b - a) * ff;
                    sumL += s * q.gL[u]; sumR += s * q.gR[u];
                }
                if (q.jp)
                {
                    const double g = q.jg, dn = 1 / (1 + 1.4142135623730951 * g + g * g); double* S = jps + o * 4;
                    double hp = (sumL - (1.4142135623730951 + g) * S[0] - S[1]) * dn, bp = g * hp + S[0]; S[0] = g * hp + bp; S[1] += 2 * g * bp; sumL = hp;
                    hp = (sumR - (1.4142135623730951 + g) * S[2] - S[3]) * dn; bp = g * hp + S[2]; S[2] = g * hp + bp; S[3] += 2 * g * bp; sumR = hp;
                }
                const double lv = (q.lvP + (q.lv - q.lvP) * t) * .5;
                const double amp = lv * sg(o, evi);
                sL[o] = sumL * amp; sR[o] = sumR * amp;
            }
            if (P.sub)
            {
                subPh += sf; if (subPh >= 1) subPh -= 1;
                const double s1 = subWave(P.subw, std::fmod(subPh + 4, 1.0), sf, P.subw == 2 ? .5 : P.subpw);
                const double amp = P.subl * .7 * sg(3, evi), pn = P.subpn;
                sL[3] = s1 * amp * (pn > 0 ? 1 - pn : 1); sR[3] = s1 * amp * (pn < 0 ? 1 + pn : 1);
            }
            if (P.nz)
            {
                const double xl = nzGen(0, P.nzt, rng), amp = P.nzl * .5 * sg(4, evi), pn = P.nzpn;
                sL[4] = xl * amp * (pn > 0 ? 1 - pn : 1); sR[4] = xl * amp * (pn < 0 ? 1 + pn : 1);
            }
            double tl = 0, tr = 0;
            for (int s = 0; s < 5; ++s)
            {
                double l = sL[s], r = sR[s];
                if (l == 0 && r == 0 && s >= 3) continue;
                const int rr = rts[s];
                if (rr != 0)
                {
                    double a, b, c2, d;
                    if (rr == 1) flt[s][0].proc(l, r, l, r);
                    else if (rr == 2) flt[s][1].proc(l, r, l, r);
                    else if (P.serial) { flt[s][0].proc(l, r, a, b); flt[s][1].proc(a, b, l, r); }
                    else { flt[s][0].proc(l, r, a, b); flt[s][1].proc(l, r, c2, d); l = (a + c2) * .707; r = (b + d) * .707; }
                }
                tl += l; tr += r;
            }
            outLbuf[i] += tl; outRbuf[i] += tr;
        }
        fresh = false;
        for (int i = 0; i < n; ++i) { outL[i] += outLbuf[i]; outR[i] += outRbuf[i]; outLbuf[i] = outRbuf[i] = 0; }
    }

private:
    double sg(int q, double x) { s1[(size_t) q] += (x - s1[(size_t) q]) * ks; s2[(size_t) q] += (s1[(size_t) q] - s2[(size_t) q]) * ks; return s2[(size_t) q]; }
    double nzGen(int, int nt, std::mt19937& rng)
    {
        std::uniform_real_distribution<double> u11(-1, 1);
        const double w = u11(rng); double x;
        switch (nt)
        {
            case 1: na = .97 * na + .03 * w; nb = .9 * nb + .1 * na; x = (na + nb) * 3; break;
            case 2: nc = (nc + .02 * w) / 1.02; x = nc * 14; break;
            default: x = w;
        }
        return x;
    }
    double sr = 44100, ks = .01;
    std::array<double, 8> s1 {}, s2 {};
    Env env[2]; double ev = 0, evP = 0, envV[2] {}, envP[2] {};
    double ph[3][8] {}; double anP[24] {}, anC[2] {}, anE = 0, anDt[3] {}, anDr[3] {}; double lastPos[3] {}, lastLvl[3] {};
    double subPh = 0, na = 0, nb = 0, nc = 0, jps[12] {};
    Filt flt[5][2];
    bool fresh = true;
    double outLbuf[kBlock] {}, outRbuf[kBlock] {};
};

class Engine
{
public:
    void prepare(double sampleRate) { sr = sampleRate; for (auto& v : voices) v.kill(); }
    void noteOn(int n, double vel, const Patch& P)
    {
        Voice* v = nullptr;
        for (auto& x : voices) if (!x.active) { v = &x; break; }
        if (!v) // steal: oldest releasing voice, else oldest
        {
            uint64_t best = ~0ull;
            for (auto& x : voices) if (!x.gate && x.serial < best) { best = x.serial; v = &x; }
            if (!v) for (auto& x : voices) if (x.serial < best) { best = x.serial; v = &x; }
            v->kill();
        }
        v->start(n, vel, sr, P, ++serial, rng);
    }
    void noteOff(int n) { for (auto& v : voices) if (v.active && v.gate && v.note == n) v.release(); }
    void allOff() { for (auto& v : voices) v.kill(); }
    void setBend(double b) { bend = b; }
    void render(const Patch& P, double* L, double* R, int num)
    {
        int voicesOn = 0;
        for (int off = 0; off < num; off += kBlock)
        {
            const int n = std::min(kBlock, num - off);
            double bl[kBlock] {}, br[kBlock] {};
            int count = 0;
            for (auto& v : voices) { if (!v.active) continue; if (++count > P.poly) { v.kill(); continue; } v.render(n, P, bend, bl, br, rng); }
            voicesOn = count;
            for (int i = 0; i < n; ++i) { L[off + i] += bl[i]; R[off + i] += br[i]; }
        }
        active = voicesOn;
    }
    int activeVoices() const { int c = 0; for (auto& v : voices) if (v.active) ++c; return c; }
private:
    double sr = 44100, bend = 0; uint64_t serial = 0; int active = 0;
    std::mt19937 rng { std::random_device{}() };
    std::array<Voice, kMaxVoices> voices;
};
}
