// FX: EQ, compressor, maximizer, squeeze, pump, trance gate, transient shaper (port of dsp3a.js).
#pragma once
#include "Fx.h"
namespace whisker {
inline double SD(int i) { return kSyncDiv[i + 1]; }

struct XSplit { // Linkwitz-Riley 4 multiband splitter with allpass phase compensation, stereo (max 4 bands)
  int nb; BiS lp[3][2], hp[3][2], ap[4][3];
  explicit XSplit(int n = 3) : nb(n) {}
  void set(const double* f, double sr) {
    double prev = 20;
    for (int k = 0; k < nb - 1; k++) {
      const double fk = clampd(std::max(f[k], prev * 1.05), 20, sr * .45); prev = fk;
      for (int s = 0; s < 2; s++) { lp[k][s].set(BT::lp, fk, .7071, 0, sr); hp[k][s].set(BT::hp, fk, .7071, 0, sr); }
      for (int j = 0; j < k; j++) ap[j][k].set(BT::ap, fk, .7071, 0, sr);
      ap[k][k].set(BT::ap, fk, .7071, 0, sr);
    }
  }
  // out[b][0] = left, out[b][1] = right
  void split(const float* L, const float* R, int n, float (*out)[2][kBlock]) {
    for (int i = 0; i < n; i++) {
      double l = L[i], r = R[i];
      for (int k = 0; k < nb - 1; k++) {
        double bl = lp[k][1].p(0, lp[k][0].p(0, l)), br = lp[k][1].p(1, lp[k][0].p(1, r));
        const double nl = hp[k][1].p(0, hp[k][0].p(0, l)), nr = hp[k][1].p(1, hp[k][0].p(1, r));
        for (int m = k + 1; m < nb - 1; m++) { bl = ap[k][m].p(0, bl); br = ap[k][m].p(1, br); }
        out[k][0][i] = (float)bl; out[k][1][i] = (float)br; l = nl; r = nr;
      }
      out[nb - 1][0][i] = (float)l; out[nb - 1][1][i] = (float)r;
    }
  }
};

struct FxEq : FxInst {
  BiS b[4], h[2], l[2];
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::eq; const double sr = E->sr; const double g[4] = {P(q::p_lg), P(q::p_m1g), P(q::p_m2g), P(q::p_hg)};
    b[0].set(BT::ls, P(q::p_lf), .7, g[0], sr); b[1].set(BT::peak, P(q::p_m1f), P(q::p_m1q), g[1], sr); b[2].set(BT::peak, P(q::p_m2f), P(q::p_m2q), g[2], sr); b[3].set(BT::hs, P(q::p_hf), .7, g[3], sr);
    const double hp = P(q::p_hp), lpf = P(q::p_lp); const bool uh = hp > 22, ul = lpf < 19000;
    if (uh) for (auto& f : h) f.set(BT::hp, hp, .7071, 0, sr);
    if (ul) for (auto& f : l) f.set(BT::lp, lpf, .7071, 0, sr);
    for (int i = 0; i < n; i++) {
      double x = L[i], y = R[i];
      if (uh) { x = h[1].p(0, h[0].p(0, x)); y = h[1].p(1, h[0].p(1, y)); }
      for (int k = 0; k < 4; k++) if (std::fabs(g[k]) > .02) { x = b[k].p(0, x); y = b[k].p(1, y); }
      if (ul) { x = l[1].p(0, l[0].p(0, x)); y = l[1].p(1, l[0].p(1, y)); }
      L[i] = (float)x; R[i] = (float)y;
    }
  }
  void reset() override { for (auto& f : b) f.reset(); for (auto& f : h) f.reset(); for (auto& f : l) f.reset(); }
};

struct FxComp : FxInst {
  double e = -90, hv = -90; int hc = 0;
  FxComp() { hasGr = true; }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::comp; const double sr = E->sr, thr = P(q::p_thr), ra = P(q::p_ratio), kn = std::max(P(q::p_knee), .01), mk = dbv(P(q::p_makeup));
    const double at = std::exp(-1 / (sr * P(q::p_att) * .001)), rl = std::exp(-1 / (sr * P(q::p_rel) * .001));
    double gmin = 0; const int H = (int)std::lround(sr * .015); const double dec = 60 / (sr * std::max(.005, P(q::p_rel) * .001));
    for (int i = 0; i < n; i++) {
      const double x = std::max(std::fabs((double)L[i]), std::fabs((double)R[i])), xl = 20 * std::log10(x + 1e-9);
      if (xl >= hv) { hv = xl; hc = H; } else if (hc > 0) hc--; else hv = std::max(xl, hv - dec);
      e = hv > e ? at * e + (1 - at) * hv : rl * e + (1 - rl) * hv;
      const double ov = e - thr; double gr;
      if (2 * ov < -kn) gr = 0; else if (2 * std::fabs(ov) <= kn) { const double t = ov + kn / 2; gr = (1 / ra - 1) * t * t / (2 * kn); } else gr = (1 / ra - 1) * ov;
      const double g = dbv(gr) * mk; L[i] = (float)(L[i] * g); R[i] = (float)(R[i] * g); if (gr < gmin) gmin = gr;
    }
    this->gr = gmin;
  }
};

inline double sclip(double x, double k, double c) { const double a = std::fabs(x); if (a <= k) return x; return (x < 0 ? -1 : 1) * (k + (c - k) * std::tanh((a - k) / (c - k + 1e-9))); }

struct FxMaxi : FxInst {
  std::unique_ptr<LookLim> ll; OS4 os; bool soft = false; std::vector<float> adl, adr; int aw = 0; double lsr = 0;
  FxMaxi() { hasGr = true; }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::maxi; const double sr = E->sr, gain = dbv(P(q::p_gain)), ce = dbv(P(q::p_ceil)), sf = P(q::p_soft);
    if (!ll || lsr != sr) { ll.reset(new LookLim(sr)); lsr = sr; adl.assign((size_t)ll->M, 0.f); adr.assign((size_t)ll->M, 0.f); aw = 0; }
    const double k = ce * (1 - .35 * sf);
    if (sf > 0) { os.prep(sr); auto fn = [](double x, double a, double b) { return sclip(x, a, b); }; for (int i = 0; i < n; i++) { L[i] = (float)os.p(0, L[i] * gain, fn, k, ce * 1.15); R[i] = (float)os.p(1, R[i] * gain, fn, k, ce * 1.15); } }
    else for (int i = 0; i < n; i++) { L[i] = (float)(L[i] * gain); R[i] = (float)(R[i] * gain); }
    ll->proc(L, R, n, ce, P(q::p_rel)); gr = ll->gr; soft = sf > 0;
  }
  void alignDry(float* L, float* R, int n) override {
    if (!ll) return; const int M = ll->M;
    for (int i = 0; i < n; i++) { double l = L[i], r = R[i]; if (soft) { l = os.lin(0, l); r = os.lin(1, r); } const int w = aw; L[i] = adl[(size_t)w]; R[i] = adr[(size_t)w]; adl[(size_t)w] = (float)l; adr[(size_t)w] = (float)r; aw = (w + 1) % M; }
  }
};

struct FxSqueeze : FxInst {
  XSplit x { 3 }; float bb[3][2][kBlock]; double e[3] = {-80, -80, -80}, g[3] = {0, 0, 0};
  FxSqueeze() { hasGr = true; }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::squeeze; const double sr = E->sr, dep = P(q::p_depth), tm = P(q::p_time), ing = dbv(P(q::p_in)), og = dbv(P(q::p_out));
    const double bg[3] = {dbv(P(q::p_lowg)), dbv(P(q::p_midg)), dbv(P(q::p_highg))};
    const double f[2] = {P(q::p_xlo), P(q::p_xhi)}; x.set(f, sr);
    for (int i = 0; i < n; i++) { L[i] = (float)(L[i] * ing); R[i] = (float)(R[i] * ing); }
    x.split(L, R, n, bb);
    const double at = std::exp(-1 / (sr * .003 * tm)), rl = std::exp(-1 / (sr * .09 * tm)), sm = std::exp(-1 / (sr * .004 * tm)), hi = -22, lo = -44; double gmin = 0;
    for (int i = 0; i < n; i++) {
      double ol = 0, orr = 0;
      for (int b = 0; b < 3; b++) {
        const double bl = bb[b][0][i], br = bb[b][1][i], lv = 20 * std::log10(std::max(std::fabs(bl), std::fabs(br)) + 1e-9);
        double ee = e[b]; ee = lv > ee ? at * ee + (1 - at) * lv : rl * ee + (1 - rl) * lv; e[b] = ee;
        double tg = 0; if (ee > hi) tg = -(ee - hi) * .75 * dep; else if (ee < lo) tg = std::min(20.0, (lo - ee) * .7) * dep;
        g[b] = sm * g[b] + (1 - sm) * tg; const double gg = dbv(g[b]) * bg[b] * og; ol += bl * gg; orr += br * gg; if (g[b] < gmin) gmin = g[b];
      }
      L[i] = (float)ol; R[i] = (float)orr;
    }
    gr = gmin;
  }
};

struct FxPump : FxInst {
  double g = 1;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::pump; const double sr = E->sr, div = SD(P.ix(q::p_div)), dep = P(q::p_depth), atk = P(q::p_attack), rel = P(q::p_release), pw = std::pow(2.0, P(q::p_curve) * 2), adv = E->bpm / 60 / sr / div;
    double ph = std::fmod(E->beat / div, 1.0); if (ph < 0) ph += 1; const double sm = 1 - std::exp(-1 / (sr * .0008)); double gg = g;
    for (int i = 0; i < n; i++) {
      double t;
      if (ph < atk) t = 1 - dep * (ph / std::max(atk, 1e-4)); else { const double x = std::min(1.0, (ph - atk) / std::max(rel, 1e-3)); t = (1 - dep) + dep * std::pow(x, pw); }
      gg += (t - gg) * sm; L[i] = (float)(L[i] * gg); R[i] = (float)(R[i] * gg); ph += adv; if (ph >= 1) ph -= 1;
    }
    g = gg;
  }
};

struct FxTGate : FxInst {
  double g = 1;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode& node, int) override {
    namespace q = fxp::tgate; const double sr = E->sr, sl = SD(P.ix(q::p_div)), dep = P(q::p_depth), sm = 1 - std::exp(-1 / (sr * std::max(.0002, P(q::p_smooth) * .001))), sw = P(q::p_swing);
    double gg = g; const double adv = E->bpm / 60 / sr / sl; double pos = E->beat / sl; const int len = 16;
    for (int i = 0; i < n; i++) {
      int idx = (int)std::floor(pos) % len; if (idx < 0) idx += len;
      const double fr = pos - std::floor(pos); if (idx % 2 == 1 && sw > 0 && fr < sw * .5) idx = (idx + len - 1) % len;
      const double t = 1 - dep + dep * node.st->pat[idx].load(std::memory_order_relaxed); gg += (t - gg) * sm; L[i] = (float)(L[i] * gg); R[i] = (float)(R[i] * gg); pos += adv;
    }
    g = gg;
  }
};

struct FxTrans : FxInst {
  double f = 0, s = 0, g = 1;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::trans; const double sr = E->sr, at = P(q::p_attack), su = P(q::p_sustain);
    const double k = std::exp(-1 / (sr * .001)), k2 = std::exp(-1 / (sr * .02)), k3 = std::exp(-1 / (sr * .03)), k4 = std::exp(-1 / (sr * .25)), sm = 1 - std::exp(-1 / (sr * .001));
    for (int i = 0; i < n; i++) {
      const double a = std::max(std::fabs((double)L[i]), std::fabs((double)R[i]));
      f = a > f ? k * f + (1 - k) * a : k2 * f + (1 - k2) * a; s = a > s ? k3 * s + (1 - k3) * a : k4 * s + (1 - k4) * a;
      const double r = (f + 1e-5) / (s + 1e-5); double t = 1; if (r > 1) t = std::pow(r, at * .7); else t = std::pow(r, -su * .5);
      t = clampd(t, .2, 5); g += (t - g) * sm; L[i] = (float)(L[i] * g); R[i] = (float)(R[i] * g);
    }
  }
};
} // namespace whisker
