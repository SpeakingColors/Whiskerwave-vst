// All 47 filter types of the mockup (port of dsp_filt.js). Stereo, own implementations.
#pragma once
#include "Dsp.h"
namespace whisker {
inline const double kFormants[5][3] = {{800, 1150, 2900}, {400, 1600, 2700}, {270, 2140, 2950}, {450, 830, 2830}, {325, 700, 2530}};
struct VFilt {
  static constexpr int kNS = 15;
  double s[48] = {}, c[32] = {}; float cb[2][2048] = {}; int ci = 0;
  int type = 0; double sr = 44100, mix = 1, res = 0, sh = .5; int dm = 0; double dg = 1, mk = 1, gg = 0, kfb = 0, a = 0, G = 0, D = 100, fb = 0, damp = .5, cap = 0;
  double ap[12] = {}; int n = 4; double w[4] = {1, 1, 1, 1}; int djm = 0; double rate = .5, fg = 1, r[3] = {}, fc = 1000;
  bool fresh = true; int rs = 0, nc = 0, nap = 0, nw = 0;
  double oc[32] = {}, tc[32] = {}, dc[32] = {}, os[kNS] = {}, ts[kNS] = {}, ds[kNS] = {}, oap[12] = {}, tap[12] = {}, dap[12] = {}, ow[4] = {}, tw[4] = {}, dw[4] = {};
  double* scp[kNS];
  OS4 ov4; OS2 ovs; bool ov4ready = false;
  VFilt() { double* p[kNS] = {&gg, &a, &kfb, &G, &fg, &rate, &D, &fb, &damp, &cap, &dg, &mk, &mix, &res, &sh}; for (int i = 0; i < kNS; i++) scp[i] = p[i]; }
  VFilt(const VFilt&) = delete; VFilt& operator=(const VFilt&) = delete;

  static double sh32(double x, double, double) { return fastTanh(x * 1.5) * .8; }
  static double sh44(double x, double, double) { return fastTanh(x * 6) * .7; }
  static double fold(double x, double fgn, double) { double y = x * fgn; int k = 0; while ((y > 1 || y < -1) && k++ < 8) y = y > 1 ? 2 - y : -2 - y; return y; }
  static double shape(double x, double dgn, double dmode) {
    const double m = 1 / std::sqrt(dgn);
    switch ((int)dmode) {
      case 0: return fastTanh(x * dgn) * m * 1.15;
      case 1: return x / (1 + std::fabs(x * (dgn - 1)));
      case 2: return clampd(x * dgn, -1, 1) * m;
      default: { double y = x * dgn * .7; int k = 0; while ((y > 1 || y < -1) && k++ < 8) y = y > 1 ? 2 - y : -2 - y; return y * m * 1.1; }
    }
  }
  void su(int i, double f, double k) {
    f = clampd(f, 20, sr * .47); const double g = std::tan(kPi * f / sr), a1 = 1 / (1 + g * (g + k)); const int j = i * 4;
    c[j] = a1; c[j + 1] = g * a1; c[j + 2] = g * g * a1; c[j + 3] = k;
  }
  void set(int t, double fcut, double rs_, double drv, double mx, double sr_, double shp, int dmode, int nb = 32) {
    const bool same = !fresh && t == type && sr_ == sr;
    if (same) { std::memcpy(oc, c, sizeof c); for (int i = 0; i < kNS; i++) os[i] = *scp[i]; std::memcpy(oap, ap, sizeof ap); std::memcpy(ow, w, sizeof w); }
    set0(t, fcut, rs_, drv, mx, sr_, shp, dmode); fresh = false;
    if (!same) { rs = 0; return; }
    if (nb < 1) nb = 32; const double inv = 1.0 / nb;
    nc = ((t >= 2 && t <= 4) || (t >= 6 && t <= 13) || t == 19 || (t >= 29 && t <= 32) || (t >= 37 && t <= 41) || (t >= 43 && t <= 45) || t == 20) ? 16 : 0;
    nap = (t >= 33 && t <= 36) ? 12 : 0; nw = (t == 39 || t == 40) ? 4 : 0;
    for (int i = 0; i < nc; i++) { tc[i] = c[i]; dc[i] = (c[i] - oc[i]) * inv; c[i] = oc[i]; }
    for (int i = 0; i < kNS; i++) { ts[i] = *scp[i]; ds[i] = (ts[i] - os[i]) * inv; *scp[i] = os[i]; }
    for (int i = 0; i < nap; i++) { tap[i] = ap[i]; dap[i] = (ap[i] - oap[i]) * inv; ap[i] = oap[i]; }
    for (int i = 0; i < nw; i++) { tw[i] = w[i]; dw[i] = (w[i] - ow[i]) * inv; w[i] = ow[i]; }
    rs = nb;
  }
  void ramp() {
    if (--rs <= 0) { rs = 0; for (int i = 0; i < nc; i++) c[i] = tc[i]; for (int i = 0; i < kNS; i++) *scp[i] = ts[i]; for (int i = 0; i < nap; i++) ap[i] = tap[i]; for (int i = 0; i < nw; i++) w[i] = tw[i]; return; }
    for (int i = 0; i < nc; i++) c[i] += dc[i]; for (int i = 0; i < kNS; i++) *scp[i] += ds[i];
    for (int i = 0; i < nap; i++) ap[i] += dap[i]; for (int i = 0; i < nw; i++) w[i] += dw[i];
  }
  void set0(int t, double fcut, double rs_, double drv, double mx, double sr_, double shp, int dmode) {
    type = t; sr = sr_; mix = mx; res = rs_; sh = shp; dm = dmode; dg = 1 + drv * 7; mk = 1 / std::sqrt(dg);
    fcut = clampd(fcut, 20, sr * .45); fc = fcut; const double q = 2 - 1.96 * res;
    if (t == 1 || t == 5 || t == 46) { a = 1 - std::exp(-kTau * fcut / sr); G = res * 2 - 1; }
    else if (t == 2 || t == 6 || t == 8 || t == 10 || t == 20) su(0, fcut, q);
    else if (t == 3 || t == 7) { su(0, fcut, 1.4); su(1, fcut, q); }
    else if (t == 4) { su(0, fcut, 1.5); su(1, fcut, 1.5); su(2, fcut, 1.5); su(3, fcut, q); }
    else if (t == 9) { su(0, fcut, q); su(1, fcut, q); }
    else if (t == 11) { su(0, fcut, 1.0); G = res * 10; }
    else if (t == 12 || t == 13) { su(0, fcut, 1.0); G = (res * 2 - 1) * 3; }
    else if (t >= 14 && t <= 18) { const double g = std::tan(kPi * fcut / sr); gg = g / (1 + g); kfb = res * 4; }
    else if (t == 19) su(0, fcut, 1.0);
    else if (t == 21) { const double g = std::tan(kPi * fcut / sr); gg = g / (1 + g); kfb = res * 3.7; }
    else if (t == 22) { const double g = std::tan(kPi * fcut / sr); gg = g / (1 + g); kfb = res * 3.5; }
    else if (t >= 23 && t <= 28) {
      D = clampd(sr / fcut, 4, 2040);
      fb = t == 23 ? res * .93 : t == 24 ? -res * .93 : t == 25 ? (res * 2 - 1) : t == 26 ? .8 + .199 * res : res * .9;
      damp = .1 + .85 * (1 - sh); cap = sh * .8;
    }
    else if (t == 29 || t == 30) {
      const double p = clampd(std::log(fcut / 20) / std::log(1000.0), 0, 1) * 4; const int i = std::min(3, (int)std::floor(p)); const double f = p - i, k = 2 - 1.7 * res;
      for (int j = 0; j < 3; j++) su(j, kFormants[i][j] * (1 - f) + kFormants[i + 1][j] * f, k);
      if (t == 30) su(3, 3400, k);
    }
    else if (t == 31) { const double k = 2 - 1.7 * res; su(0, fcut * .6, k); su(1, fcut * 1.5, k); su(2, fcut * 2.2, 1.2); }
    else if (t == 32) { su(0, fcut * .35, 1.2); su(1, fcut * 1.8, 1.2); }
    else if (t >= 33 && t <= 36) {
      const int nn = t == 33 ? 4 : t == 34 ? 8 : t == 35 ? 12 : std::min(12, 4 + (int)std::lround(res * 8)); n = nn; fb = t == 36 ? 0 : res * .85;
      for (int i = 0; i < nn; i++) { const double f = clampd(fcut * std::pow(2.0, (i - nn / 2.0) * (sh * .5 + .02)), 20, sr * .45), tn = std::tan(kPi * f / sr); ap[i] = (1 - tn) / (1 + tn); }
    }
    else if (t == 37) { const double sp = 1 + sh * 1.5; su(0, fcut / sp, .6); su(1, fcut * sp, .6); G = res * 8; }
    else if (t == 38) { const double sp = 1 + sh * 1.5; su(0, fcut / sp, q); su(1, fcut * sp, q); }
    else if (t == 39 || t == 40) { const double k = std::max(.06, q); const double m39[4] = {1, 2, 3, 4}, m40[4] = {1, 3, 5, 7}; for (int i = 0; i < 4; i++) { su(i, fcut * (t == 39 ? m39[i] : m40[i]), k); w[i] = std::pow(1.0 / (i + 1), sh * 2); } }
    else if (t == 41) { const double p = clampd(std::log(fcut / 20) / std::log(1000.0), 0, 1); djm = p < .5 ? 0 : 2; su(0, 20 * std::pow(1000.0, djm == 0 ? p * 2 : (p - .5) * 2), q); }
    else if (t == 42) rate = clampd(fcut / sr * 2, .0005, 1);
    else if (t == 43) { su(0, fcut, 1.2); fg = 1 + res * 6; }
    else if (t == 44 || t == 45) su(0, fcut, t == 44 ? 1.2 : std::max(q, .25));
  }
  double uu(int ch, int i, double x) {
    const int j = i * 4, so = ch * 24 + i * 2; const double a1 = c[j], a2 = c[j + 1], a3 = c[j + 2], k = c[j + 3];
    const double v3 = x - s[so + 1], v1 = a1 * s[so] + a2 * v3, v2 = s[so + 1] + a2 * s[so] + a3 * v3;
    s[so] = 2 * v1 - s[so]; s[so + 1] = 2 * v2 - s[so + 1];
    r[0] = v2; r[1] = v1; r[2] = x - k * v1 - v2; return k;
  }
  double u(int ch, int i, double x, int m) { const double k = uu(ch, i, x); return m == 0 ? r[0] : m == 1 ? r[1] : m == 2 ? r[2] : m == 3 ? r[0] + r[2] : r[1] * k; }
  void lad(int ch, double xi, bool sat) {
    const int o = ch * 24; const double Gp = gg, k = kfb, G2 = Gp * Gp, G3 = G2 * Gp, G4 = G2 * G2, cc = 1 - Gp;
    const double z1 = s[o + 20], z2 = s[o + 21], z3 = s[o + 22], z4 = s[o + 23];
    double uu_ = (xi - k * cc * (G3 * z1 + G2 * z2 + Gp * z3 + z4)) / (1 + k * G4); if (sat) uu_ = fastTanh(uu_ * .3) * 3.333333;
    double v = (uu_ - z1) * Gp; const double y1 = v + z1; s[o + 20] = y1 + v;
    v = (y1 - z2) * Gp; const double y2 = v + z2; s[o + 21] = y2 + v;
    v = (y2 - z3) * Gp; const double y3 = v + z3; s[o + 22] = y3 + v;
    v = (y3 - z4) * Gp; const double y4 = v + z4; s[o + 23] = y4 + v;
    s[o + 16] = y1; s[o + 17] = y2; s[o + 18] = y3; s[o + 19] = y4;
  }
  double rd(int ch, double d) const {
    const double rp = ci - d; const int ri = (int)std::floor(rp); const double fr = rp - ri;
    return cb[ch][ri & 2047] * (1 - fr) + cb[ch][(ri + 1) & 2047] * fr;
  }
  double pre(double x, int ch) { if (dg < 1.0001) return x; ovs.prep(sr); return ovs.p(ch, x, [](double v, double d, double m) { return shape(v, d, m); }, dg, dm); }
  double o4p(int ch, double x, double (*fn)(double, double, double), double a_) { ov4.prep(sr); return ov4.p(ch, x, fn, a_, 0); }
  double one(int ch, double x) {
    const int t = type, o = ch * 24; const double xi = pre(x, ch);
    switch (t) {
      case 1: s[o + 20] += a * (xi - s[o + 20]); return s[o + 20];
      case 5: s[o + 20] += a * (xi - s[o + 20]); return xi - s[o + 20];
      case 2: return u(ch, 0, xi, 0);
      case 3: return u(ch, 1, u(ch, 0, xi, 0), 0);
      case 4: return u(ch, 3, u(ch, 2, u(ch, 1, u(ch, 0, xi, 0), 0), 0), 0);
      case 6: return u(ch, 0, xi, 2);
      case 7: return u(ch, 1, u(ch, 0, xi, 2), 2);
      case 8: return u(ch, 0, xi, 4);
      case 9: return u(ch, 1, u(ch, 0, xi, 4), 4);
      case 10: return u(ch, 0, xi, 3);
      case 11: return xi + G * u(ch, 0, xi, 4);
      case 12: return xi + G * u(ch, 0, xi, 0);
      case 13: return xi + G * u(ch, 0, xi, 2);
      case 14: lad(ch, xi, true); return s[o + 19] * (1 + .5 * res);
      case 15: lad(ch, xi, true); return s[o + 17] * (1 + .6 * res);
      case 16: lad(ch, xi, true); return s[o + 18] * 1.4 * (1 + .5 * res);
      case 17: lad(ch, xi, true); return xi - 4 * s[o + 16] + 6 * s[o + 17] - 4 * s[o + 18] + s[o + 19];
      case 18: lad(ch, xi, true); return 4 * (s[o + 17] - 2 * s[o + 18] + s[o + 19]) * (1 + res);
      case 19: { const double xin = xi - res * 2.2 * fastTanh(s[o] * 2); return u(ch, 0, xin, 0) * (1 + .5 * res); }
      case 20: { uu(ch, 0, xi); const double lp = r[0], hp = r[2]; return sh < .5 ? lp * (1 - 2 * sh) + (lp + hp) * 2 * sh : (lp + hp) * (2 - 2 * sh) + hp * (2 * sh - 1); }
      case 21: lad(ch, xi, false); return s[o + 19] * (1 + .4 * res);
      case 22: {
        const double Gp = gg, k = kfb, G2 = Gp * Gp, G3 = G2 * Gp, cc = 1 - Gp, z1 = s[o + 21], z2 = s[o + 22], z3 = s[o + 23];
        double uu_ = (xi - k * cc * (G2 * z1 + Gp * z2 + z3)) / (1 + k * G3); uu_ = uu_ > 0 ? fastTanh(uu_) : fastTanh(uu_ * .7) * 1.2;
        double v = (uu_ - z1) * Gp; const double y1 = v + z1; s[o + 21] = y1 + v; v = (y1 - z2) * Gp; const double y2 = v + z2; s[o + 22] = y2 + v; v = (y2 - z3) * Gp; const double y3 = v + z3; s[o + 23] = y3 + v;
        const double y = y3 * (1 + .5 * res); s[o + 20] += .002 * (y - s[o + 20]); return y - s[o + 20];
      }
      case 23: case 24: { const double d = rd(ch, D), y = xi + fb * d; cb[ch][ci & 2047] = (float)y; return (y + xi) * .5; }
      case 25: { const double d = rd(ch, D); cb[ch][ci & 2047] = (float)xi; return xi + fb * d; }
      case 26: { const double d = rd(ch, D); s[o + 20] += damp * (d - s[o + 20]); const double y = xi * .4 + fb * s[o + 20]; cb[ch][ci & 2047] = (float)y; return y * (1 - fb) * 3; }
      case 27: { const double d1 = rd(ch, D), d2 = rd(ch, D * .5), y = xi + fb * (d1 + d2) * .5; cb[ch][ci & 2047] = (float)y; return (y + xi) * .5; }
      case 28: { const double d = rd(ch, D), cc = cap, z = -cc * d + s[o + 20]; s[o + 20] = d + cc * z; const double y = xi + fb * z; cb[ch][ci & 2047] = (float)y; return (y + xi) * .5; }
      case 29: return (u(ch, 0, xi, 4) + .7 * u(ch, 1, xi, 4) + .45 * u(ch, 2, xi, 4)) * .6;
      case 30: return (u(ch, 0, xi, 4) + .8 * u(ch, 1, xi, 4) + .5 * u(ch, 2, xi, 4) + .3 * u(ch, 3, xi, 4)) * .5;
      case 31: return u(ch, 0, xi, 4) + .8 * u(ch, 1, xi, 4) + .4 * u(ch, 2, xi, 0);
      case 32: { const double y = u(ch, 1, u(ch, 0, xi, 2), 0); return o4p(ch, y, sh32, 0); }
      case 33: case 34: case 35: { double y = xi + fb * s[o + 23]; for (int i = 0; i < n; i++) { const double aa = ap[i], z = -aa * y + s[o + i]; s[o + i] = y + aa * z; y = z; } s[o + 23] = y; return (xi + y) * .5; }
      case 36: { double y = xi; for (int i = 0; i < n; i++) { const double aa = ap[i], z = -aa * y + s[o + i]; s[o + i] = y + aa * z; y = z; } return y; }
      case 37: return xi + G * (u(ch, 0, xi, 4) + u(ch, 1, xi, 4)) * .7;
      case 38: return u(ch, 1, u(ch, 0, xi, 3), 3);
      case 39: case 40: { double sum = 0; for (int i = 0; i < 4; i++) sum += w[i] * u(ch, i, xi, 4); return sum * .9; }
      case 41: return u(ch, 0, xi, djm);
      case 42: { s[o + 20] += rate; if (s[o + 20] >= 1) { s[o + 20] -= 1; s[o + 21] = xi; } s[o + 22] += (1 - res * .95) * (s[o + 21] - s[o + 22]); return s[o + 22]; }
      case 43: { const double y = o4p(ch, xi, fold, fg); return u(ch, 0, y, 0); }
      case 44: return o4p(ch, u(ch, 0, xi, 4), sh44, 0);
      case 45: return u(ch, 0, xi, 4) * 1.3;
      case 46: { s[o + 20] += a * (xi - s[o + 20]); const double lp = s[o + 20], hp = xi - lp, tl = G; return lp * (1 + tl) + hp * (1 - tl); }
    }
    return xi;
  }
  void proc(double l, double rr, double* out) {
    if (type == 0) { out[0] = l; out[1] = rr; return; }
    if (rs > 0) ramp();
    const double yl = one(0, l), yr = one(1, rr);
    if (type >= 23 && type <= 28) ci = (ci + 1) & 2047;
    out[0] = l + (yl - l) * mix; out[1] = rr + (yr - rr) * mix;
  }
  void reset() { fresh = true; rs = 0; std::memset(s, 0, sizeof s); std::memset(cb, 0, sizeof cb); }
};
} // namespace whisker
