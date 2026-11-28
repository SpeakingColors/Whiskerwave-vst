// FX: distortion, fat drive, crusher, wavefolder, frequency shifter, ring mod, vowel, filter, chorus, flanger, phaser, tremolo (port of dsp3b.js).
#pragma once
#include "Fx.h"
#include "Filters.h"
namespace whisker {
inline double triF(double x) { if (x <= 1 && x >= -1) return x; double y = std::fmod(std::fmod(x + 1, 4.0) + 4, 4.0); return y < 2 ? y - 1 : 3 - y; }
inline double shp(int t, double x) {
  switch (t) {
    case 0: return std::tanh(x);
    case 1: return x > 1 ? 1 : x < -1 ? -1 : x;
    case 2: return x >= 0 ? std::tanh(x) : std::tanh(x * .6) * 1.3;
    case 3: return triF(x);
    case 4: return std::atan(x * 1.5) * .64;
    case 5: return x >= 0 ? 1 - std::exp(-x) : -(1 - std::exp(x * .7)) * .7;
    case 6: return std::fabs(std::tanh(x)) * 1.2 - .4;
    case 7: return std::sin(x * 1.5);
    case 8: return (x < 0 ? -1 : 1) * (1 - std::exp(-std::fabs(x) * 3));
    default: return x >= 0 ? std::tanh(x * 1.5) : x / (1 + std::fabs(x) * 2);
  }
}
constexpr double kDCB = .0007;
inline double wave4(int s, double p) { return s == 0 ? std::sin(kTau * p) : s == 1 ? (p < .5 ? 4 * p - 1 : 3 - 4 * p) : s == 2 ? (p < .5 ? 1 : -1) : (1 - 2 * p); }
inline double rateOf(const FxEnv* E, int sy, double rate) { return sy > 0 ? E->bpm / 60 / kSyncDiv[sy] : rate; }
inline double shpFn(double x, double a, double b) { return shp((int)a, x + b); }

struct FxDistI : FxInst {
  OS4 os[2]; BiS tl[2], hp; double dc[2] = {0, 0};
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::dist; const double sr = E->sr, t = P.ix(q::p_type), dg = dbv(P(q::p_drive)), bias = P(q::p_bias) * .5, og = dbv(P(q::p_level));
    tl[0].set(BT::lp, P(q::p_tone), .7071, 0, sr); tl[1].set(BT::lp, P(q::p_tone), .7071, 0, sr); hp.set(BT::hp, P(q::p_pre), .7071, 0, sr);
    for (int i = 0; i < n; i++) for (int c = 0; c < 2; c++) { float* X = c ? R : L; const double x = hp.p(c, X[i]) * dg; double y = os[c].p(c, x, shpFn, t, bias); y = tl[c].p(c, y); dc[c] += kDCB * (y - dc[c]); X[i] = (float)((y - dc[c]) * og); }
  }
  void alignDry(float* L, float* R, int n) override { for (int i = 0; i < n; i++) { L[i] = (float)os[0].lin(0, L[i]); R[i] = (float)os[1].lin(1, R[i]); } }
};

struct FxFatI : FxInst {
  OS4 os[2]; BiS lp, ls, hs; double dc[2] = {0, 0};
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::fat; const double sr = E->sr, dg = dbv(P(q::p_drive)), fat = P(q::p_fat), bias = P(q::p_bias) * .4, tone = P(q::p_tone), og = dbv(P(q::p_out));
    static const int map[8] = {2, 4, 0, 8, 6, 3, 1, 9}; const double t = map[std::clamp(P.ix(q::p_mode), 0, 7)];
    lp.set(BT::lp, 260, .7071, 0, sr); ls.set(BT::ls, 400, .7, -tone * 6, sr); hs.set(BT::hs, 3500, .7, tone * 6, sr);
    for (int i = 0; i < n; i++) for (int c = 0; c < 2; c++) {
      float* X = c ? R : L; const double x = X[i], low = lp.p(c, x);
      double y = os[c].p(c, x * dg, shpFn, t, bias);
      y += fat * .8 * (std::tanh(low * dg * 1.6) - low * std::min(1.0, dg * .2));
      y = hs.p(c, ls.p(c, y)); dc[c] += kDCB * (y - dc[c]); X[i] = (float)((y - dc[c]) * og);
    }
  }
  void alignDry(float* L, float* R, int n) override { for (int i = 0; i < n; i++) { L[i] = (float)os[0].lin(0, L[i]); R[i] = (float)os[1].lin(1, R[i]); } }
};

struct FxCrushI : FxInst {
  double h[2] = {0, 0}, c = 0, nx = 1; BiS lp[2]; Rng rng;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::crush; const double sr = E->sr, bits = P(q::p_bits), qq = std::pow(2.0, bits - 1), red = P(q::p_rate), jit = P(q::p_jitter), dith = P(q::p_dither), sm = P(q::p_smooth);
    const double fc = clampd(sr / std::max(red, 1.0) * .45 * (1 + (1 - sm) * 20), 200, sr * .45); lp[0].set(BT::lp, fc, .7071, 0, sr); lp[1].set(BT::lp, fc, .7071, 0, sr);
    for (int i = 0; i < n; i++) {
      c += 1;
      if (c >= nx) { c -= nx; nx = red * (1 + jit * rng.bi() * .5);
        for (int ch = 0; ch < 2; ch++) { const double x = (ch ? R : L)[i], d = dith * (rng.next() - rng.next()) / qq; h[ch] = std::round((x + d) * qq) / qq; } }
      for (int ch = 0; ch < 2; ch++) { double y = h[ch]; if (sm > 0) y = lp[ch].p(ch, y) * sm + y * (1 - sm); (ch ? R : L)[i] = (float)y; }
    }
  }
};

struct FxFolderI : FxInst {
  OS4 os[2]; BiS tl[2]; double dc[2] = {0, 0};
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::folder; const double sr = E->sr, dg = dbv(P(q::p_drive)), st = P.ix(q::p_stages), sym = P(q::p_sym) * .5, og = dbv(P(q::p_level));
    tl[0].set(BT::lp, P(q::p_tone), .7071, 0, sr); tl[1].set(BT::lp, P(q::p_tone), .7071, 0, sr);
    auto fn = [](double x, double a, double b) { double y = x + b; for (int k = 0; k < (int)a; k++) y = triF(y * 1.15); return y; };
    for (int i = 0; i < n; i++) for (int c = 0; c < 2; c++) { float* X = c ? R : L; double y = os[c].p(c, X[i] * dg, fn, st, sym); y = tl[c].p(c, y); dc[c] += kDCB * (y - dc[c]); X[i] = (float)((y - dc[c]) * og); }
  }
  void alignDry(float* L, float* R, int n) override { for (int i = 0; i < n; i++) { L[i] = (float)os[0].lin(0, L[i]); R[i] = (float)os[1].lin(1, R[i]); } }
};

struct Hilb {
  double sa[16] = {}, sb[16] = {}, d = 0, i = 0, q = 0;
  void p(double x) {
    static const double HA[4] = {.6923878, .9360654322959, .9882295226860, .9987488452737}, HB[4] = {.4021921162426, .8561710882420, .9722909545651, .9952884791278};
    double a = x, b = d; d = x;
    for (int k = 0; k < 4; k++) { const double c = HA[k] * HA[k]; double* s = sa + k * 4; const double y = c * (a + s[3]) - s[1]; s[1] = s[0]; s[0] = a; s[3] = s[2]; s[2] = y; a = y; }
    for (int k = 0; k < 4; k++) { const double c = HB[k] * HB[k]; double* s = sb + k * 4; const double y = c * (b + s[3]) - s[1]; s[1] = s[0]; s[0] = b; s[3] = s[2]; s[2] = y; b = y; }
    i = a; q = b;
  }
};
struct FxFShiftI : FxInst {
  Hilb h[2]; double ph = 0, fb[2] = {0, 0};
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::fshift; const double sr = E->sr, sh = P(q::p_shift), fbk = P(q::p_fb), w = kTau * sh / sr, sd = P(q::p_spread);
    for (int i = 0; i < n; i++) {
      const double c = std::cos(ph), s = std::sin(ph);
      for (int ch = 0; ch < 2; ch++) { float* X = ch ? R : L; Hilb& hh = h[ch]; hh.p(X[i] + fbk * fb[ch]); const double sg = ch ? 1 - sd * 4 : 1; const double y = hh.i * c + hh.q * s * sg; fb[ch] = std::tanh(y); X[i] = (float)y; }
      ph += w; if (ph > kTau) ph -= kTau; else if (ph < -kTau) ph += kTau;
    }
  }
  void reset() override { h[0] = Hilb(); h[1] = Hilb(); fb[0] = fb[1] = 0; }
};

struct FxRingI : FxInst {
  double ph = 0; OS4 os[2];
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::ring; const double sr = E->sr, f = P(q::p_freq), inc = f / sr / 4; const int w = P.ix(q::p_wave); double p = ph;
    auto fn = [&p, w, inc](double x, double, double) { const double m = wave4(w, p); p += inc; if (p >= 1) p -= 1; return x * m; };
    for (int i = 0; i < n; i++) { const double p0 = p; const double a = os[0].p(0, L[i], fn, 0, 0); p = p0; const double b = os[1].p(1, R[i], fn, 0, 0); L[i] = (float)a; R[i] = (float)b; }
    ph = p;
  }
};

struct FxVowelI : FxInst {
  OS4 os[2]; BiS b[3];
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::vowel; static const double FMT[5][3] = {{800, 1150, 2900}, {400, 1600, 2700}, {270, 2140, 2950}, {450, 830, 2830}, {325, 700, 2530}};
    const double sr = E->sr, v = clampd(P(q::p_vowel), 0, 4); const int i = std::min(3, (int)std::floor(v)); const double f = v - i, sh = std::pow(2.0, P(q::p_shift)), qq = 3 + P(q::p_res) * 14, dg = dbv(P(q::p_drive)), og = dbv(P(q::p_gain));
    for (int k = 0; k < 3; k++) b[k].set(BT::bp, (FMT[i][k] * (1 - f) + FMT[i + 1][k] * f) * sh, qq * (k == 0 ? .8 : 1.1), 0, sr);
    static const double w[3] = {1, .65, .4}; auto vt = [](double x, double d, double) { return std::tanh(x * d) / std::sqrt(d); };
    for (int j = 0; j < n; j++) for (int c = 0; c < 2; c++) { float* X = c ? R : L; const double x = dg > 1.01 ? os[c].p(c, X[j], vt, dg, 0) : X[j]; double s = 0; for (int k = 0; k < 3; k++) s += w[k] * b[k].p(c, x); X[j] = (float)(s * og * 1.6); }
  }
  void reset() override { for (auto& x : b) x.reset(); }
};

struct FxFiltI : FxInst {
  VFilt f; double o[2] = {0, 0};
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::filt; f.set(P.ix(q::p_type), P(q::p_cut), P(q::p_res), P(q::p_drive), 1, E->sr, P(q::p_shape), P.ix(q::p_dm), 32);
    for (int i = 0; i < n; i++) { f.proc(L[i], R[i], o); L[i] = (float)o[0]; R[i] = (float)o[1]; }
  }
  void reset() override { f.reset(); }
};

struct FxChorusI : FxInst {
  DelayLine d[2]; double ph = 0; BiS hp; double fbs[2] = {0, 0};
  void prepare(double sr) override { const int m = (int)std::floor(sr * .06); d[0].init(m); d[1].init(m); }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::chorus; const double sr = E->sr; const int mode = std::clamp(P.ix(q::p_mode), 0, 3); static const int NV[4] = {1, 3, 2, 1}; const int nv = NV[mode];
    const double base = P(q::p_delay) * .001 * sr, dep = P(q::p_depth), fb = P(q::p_fb), w = P(q::p_spread), inc = rateOf(E, P.ix(q::p_sync), P(q::p_rate)) / sr;
    hp.set(BT::hp, P(q::p_hp), .7071, 0, sr); double p = ph;
    for (int i = 0; i < n; i++) {
      double oL = 0, oR = 0;
      for (int c = 0; c < 2; c++) {
        float* X = c ? R : L; const double x = hp.p(c, X[i]); d[c].write(x + fbs[c] * fb); double s = 0;
        for (int v = 0; v < nv; v++) { const double pp = std::fmod(p + (double)v / nv + c * .5, 1.0), lf = mode == 2 ? std::sin(kTau * pp) * .5 + std::sin(kTau * pp * 3.1) * .1 : std::sin(kTau * pp), dd = std::max(1.5, base * (1 + dep * .85 * lf)); s += d[c].read(dd - 1); }
        s /= std::sqrt((double)nv); fbs[c] = s; if (c) oR = s; else oL = s;
      }
      const double m = (oL + oR) * .5, sd = (oL - oR) * .5 * w * 2; L[i] = (float)(m + sd); R[i] = (float)(m - sd); p += inc; if (p >= 1) p -= 1;
    }
    ph = p;
  }
  void reset() override { d[0].clear(); d[1].clear(); fbs[0] = fbs[1] = 0; hp.reset(); }
};

struct FxFlangerI : FxInst {
  DelayLine d[2]; double ph = 0, y[2] = {0, 0};
  void prepare(double sr) override { const int m = (int)std::floor(sr * .02); d[0].init(m); d[1].init(m); }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::flanger; const double sr = E->sr, base = P(q::p_delay) * .001 * sr, dep = P(q::p_depth), fb = P(q::p_fb), inc = rateOf(E, P.ix(q::p_sync), P(q::p_rate)) / sr, sp = P(q::p_spread) * .5; double p = ph;
    for (int i = 0; i < n; i++) {
      for (int c = 0; c < 2; c++) { float* X = c ? R : L; const double x = X[i], lf = .5 - .5 * std::cos(kTau * std::fmod(p + c * sp, 1.0)), dd = std::max(1.0, base * (.2 + 1.6 * dep * lf) + base * .1);
        d[c].write(x + std::tanh(fb * y[c])); const double yy = d[c].read(dd - 1); y[c] = yy; X[i] = (float)yy; }
      p += inc; if (p >= 1) p -= 1;
    }
    ph = p;
  }
  void reset() override { d[0].clear(); d[1].clear(); y[0] = y[1] = 0; }
};

struct FxPhaserI : FxInst {
  double x1[24] = {}, y1[24] = {}, a[12] = {}, ph = 0, fb[2] = {0, 0};
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::phaser; static const int NS[4] = {4, 6, 8, 12}; const double sr = E->sr; const int ns = NS[std::clamp(P.ix(q::p_stages), 0, 3)];
    const double cf = P(q::p_freq), dep = P(q::p_depth), fbk = P(q::p_fb), sp = P(q::p_spread), inc = rateOf(E, P.ix(q::p_sync), P(q::p_rate)) / sr; double p = ph;
    for (int i = 0; i < n; i++) {
      if ((i & 15) == 0) { const double lf = std::sin(kTau * p); for (int k = 0; k < ns; k++) { const double f = clampd(cf * std::pow(2.0, dep * 2.2 * lf) * (1 + k * sp * .35), 30, sr * .45), t = std::tan(kPi * f / sr); a[k] = (t - 1) / (t + 1); } }
      for (int c = 0; c < 2; c++) { float* X = c ? R : L; const int o = c * 12; double y = X[i] + fbk * fb[c];
        for (int k = 0; k < ns; k++) { const double aa = a[k]; const int o2 = o + k; const double out = aa * y + x1[o2] - aa * y1[o2]; x1[o2] = y; y1[o2] = out; y = out; }
        fb[c] = std::tanh(y); X[i] = (float)y; }
      p += inc; if (p >= 1) p -= 1;
    }
    ph = p;
  }
  void reset() override { std::fill(x1, x1 + 24, 0.0); std::fill(y1, y1 + 24, 0.0); fb[0] = fb[1] = 0; }
};

struct FxTremI : FxInst {
  double ph = 0;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::trem; const double inc = rateOf(E, P.ix(q::p_sync), P(q::p_rate)) / E->sr, dep = P(q::p_depth), st = P(q::p_stereo) * .5; const int sh = P.ix(q::p_shape), ap = P.ix(q::p_mode); double p = ph;
    for (int i = 0; i < n; i++) {
      const double a = wave4(sh, p), b = wave4(sh, std::fmod(p + st, 1.0));
      if (ap == 0) { L[i] = (float)(L[i] * (1 - dep * .5 * (1 - a))); R[i] = (float)(R[i] * (1 - dep * .5 * (1 - b))); }
      else { const double pp = a * dep, gl = std::cos((pp * .5 + .5) * kPi / 2) * 1.414, gr2 = std::sin((pp * .5 + .5) * kPi / 2) * 1.414; L[i] = (float)(L[i] * gl); R[i] = (float)(R[i] * gr2); }
      p += inc; if (p >= 1) p -= 1;
    }
    ph = p;
  }
};
} // namespace whisker
