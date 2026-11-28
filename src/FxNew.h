// FX: noise gate, dynamic EQ, tape, granular, freeze, envelope filter, vocoder, talk box, autotune, Fat Cat (port of dsp3e.js).
// The voice FX need no microphone and no side input: they work on the synth's own sound.
#pragma once
#include "FxTime.h"
#include "FxDist.h"
namespace whisker {
struct FxGateI : FxInst {
  double e = 0, g = 1; bool open = true; int hc = 0;
  FxGateI() { hasGr = true; }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::gate; const double sr = E->sr, thr = dbv(P(q::p_thr)), lo = dbv(P(q::p_thr) - P(q::p_hyst)), rng = P(q::p_range) <= -79.5 ? 0 : dbv(P(q::p_range));
    const double at = 1 - std::exp(-1 / (sr * P(q::p_att) * .001)), rl = 1 - std::exp(-1 / (sr * P(q::p_rel) * .001)), ek = std::exp(-1 / (sr * .004)); const int H = (int)std::lround(sr * P(q::p_hold) * .001); double gmin = 1;
    for (int i = 0; i < n; i++) {
      const double x = std::max(std::fabs((double)L[i]), std::fabs((double)R[i])); e = x > e ? x : ek * e + (1 - ek) * x;
      if (e > thr) { open = true; hc = H; } else if (e < lo) { if (hc > 0) hc--; else open = false; }
      const double t = open ? 1 : rng; g += (t - g) * (t > g ? at : rl); L[i] = (float)(L[i] * g); R[i] = (float)(R[i] * g); if (g < gmin) gmin = g;
    }
    gr = std::max(-80.0, 20 * std::log10(gmin + 1e-9));
  }
};

struct FxDeqI : FxInst {
  BiS d[3], f[3]; double e[3] = {0, 0, 0};
  FxDeqI() { hasGr = true; }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::deq; const double sr = E->sr, at = std::exp(-1 / (sr * P(q::p_att) * .001)), rl = std::exp(-1 / (sr * P(q::p_rel) * .001)); double gm = 0;
    for (int b = 0; b < 3; b++) {
      const int o = b * 4; const double rg = P(o + 3); if (std::fabs(rg) < .05) continue;
      const double fq = P(o), qq = P(o + 1), thr = P(o + 2); d[b].set(BT::bp, fq, qq, 0, sr); double ee = e[b];
      for (int i = 0; i < n; i++) { const double y = std::fabs(d[b].p(0, (L[i] + R[i]) * .5)); ee = y > ee ? at * ee + (1 - at) * y : rl * ee + (1 - rl) * y; }
      e[b] = ee; const double g = rg * clampd((20 * std::log10(ee + 1e-9) - thr) / 12, 0, 1);
      f[b].set(BT::peak, fq, qq, g, sr); for (int i = 0; i < n; i++) { L[i] = (float)f[b].p(0, L[i]); R[i] = (float)f[b].p(1, R[i]); }
      if (g < gm) gm = g;
    }
    gr = gm;
  }
};

struct FxTapeI : FxInst {
  DelayLine d[2], ad[2]; OS4 os[2]; BiS lp[2], ls[2]; double w = 0, f = 0, dc[2] = {0, 0}; int base = 64; Rng rng;
  void prepare(double sr) override { const int m = (int)std::floor(sr * .05) + 16; for (int c = 0; c < 2; c++) { d[c].init(m); ad[c].init(m); } }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::tape; const double sr = E->sr, dg = dbv(P(q::p_drive)), bias = P(q::p_bias) * .35, wow = P(q::p_wow), fl = P(q::p_flutter), og = dbv(P(q::p_level)), hiss = P(q::p_hiss) * .004;
    for (int c = 0; c < 2; c++) { lp[c].set(BT::lp, P(q::p_hf), .62, 0, sr); ls[c].set(BT::ls, 95, .7, P(q::p_bump), sr); }
    base = (int)std::lround(sr * .008); const double wd = wow * sr * .0022, fd = fl * sr * .00022;
    auto fn = [](double x, double dd, double b) { return (std::tanh(x * dd + b) - std::tanh(b)) / std::sqrt(dd); };
    for (int i = 0; i < n; i++) {
      const double mod = wd * std::sin(kTau * w) + fd * (std::sin(kTau * f) + .5 * std::sin(kTau * f * 2.37 + 1)); w += .55 / sr; if (w >= 1) w -= 1; f += 6.3 / sr; if (f >= 100) f -= 100;
      for (int c = 0; c < 2; c++) { float* X = c ? R : L; double y = os[c].p(c, X[i], fn, dg, bias); if (hiss > 0) y += rng.bi() * hiss;
        y = ls[c].p(c, lp[c].p(c, y)); dc[c] += kDCB * (y - dc[c]); d[c].write(y - dc[c]); X[i] = (float)(d[c].read(base + mod * (c ? 1.04 : 1) - 1) * og); }
    }
  }
  void alignDry(float* L, float* R, int n) override { for (int i = 0; i < n; i++) { ad[0].write(os[0].lin(0, L[i])); ad[1].write(os[1].lin(1, R[i])); L[i] = (float)ad[0].read(base - 1); R[i] = (float)ad[1].read(base - 1); } }
  void reset() override { for (int c = 0; c < 2; c++) { d[c].clear(); ad[c].clear(); lp[c].reset(); ls[c].reset(); dc[c] = 0; } }
};

struct FxGranI : FxInst {
  struct Grain { bool on = false; double pos = 0, inc = 1, len = 1, gl = 1, gr = 1; int age = 0; };
  std::vector<float> bl, br; int m = 1, w = 0; double t = 0, fb[2] = {0, 0}; Grain gs[24]; Rng rng;
  void prepare(double sr) override { int n = 2; while (n < sr * 4.2) n <<= 1; bl.assign((size_t)n, 0.f); br.assign((size_t)n, 0.f); m = n - 1; w = 0; for (auto& g : gs) g.on = false; }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::gran; if (m < 63) return; const double sr = E->sr, size = std::max(64.0, P(q::p_size) * .001 * sr), dens = P(q::p_density), spray = P(q::p_spray) * sr, pit = P(q::p_pitch), prnd = P(q::p_prand), rev = P(q::p_rev), spr = P(q::p_spread), fbk = P(q::p_fb);
    const double norm = 1 / std::sqrt(std::max(1.0, dens * size / sr * .5)), maxOff = m - size * 4.2 - 64;
    for (int i = 0; i < n; i++) {
      bl[(size_t)w] = (float)(L[i] + fbk * fb[0]); br[(size_t)w] = (float)(R[i] + fbk * fb[1]);
      t -= 1;
      if (t <= 0) { t += sr / dens * (.7 + .6 * rng.next());
        Grain* g = nullptr; for (auto& x : gs) if (!x.on) { g = &x; break; }
        if (g) { const double r = std::pow(2.0, (pit + rng.bi() * prnd) / 12); const bool back = rng.next() < rev; const double pan = rng.bi() * spr, a = (pan * .5 + .5) * kPi / 2;
          g->on = true; g->len = size; g->age = 0; g->inc = back ? -r : r; g->gl = std::cos(a) * 1.414; g->gr = std::sin(a) * 1.414;
          const double off = std::min(std::max(64.0, maxOff), 64 + (back ? 0 : std::max(0.0, (r - 1) * size)) + rng.next() * spray); g->pos = w - off; if (back) g->pos = w - 64 - rng.next() * spray; } }
      double oL = 0, oR = 0;
      for (auto& g : gs) { if (!g.on) continue; const double s = std::sin(kPi * g.age / g.len), wn = s * s, p = g.pos; const int ip = (int)std::floor(p); const double f = p - ip; const size_t a = (size_t)(ip & m), b = (size_t)((ip + 1) & m);
        oL += (bl[a] + (bl[b] - bl[a]) * f) * wn * g.gl; oR += (br[a] + (br[b] - br[a]) * f) * wn * g.gr; g.pos += g.inc; g.age++; if (g.age >= g.len) g.on = false; }
      w = (w + 1) & m; oL *= norm; oR *= norm; fb[0] = std::tanh(oL); fb[1] = std::tanh(oR); L[i] = (float)oL; R[i] = (float)oR;
    }
  }
  void reset() override { std::fill(bl.begin(), bl.end(), 0.f); std::fill(br.begin(), br.end(), 0.f); fb[0] = fb[1] = 0; for (auto& g : gs) g.on = false; }
};

struct FxFreezeI : FxInst {
  std::vector<float> bl, br, fl, fr; int m = 1, w = 0, len = 0; bool on = false; double g = 0, pos = 0;
  void prepare(double sr) override { int n = 2; while (n < sr * 3.2) n <<= 1; for (auto* v : {&bl, &br, &fl, &fr}) v->assign((size_t)n, 0.f); m = n - 1; w = 0; on = false; g = 0; len = 0; }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::freeze; if (m < 511) return; const double sr = E->sr; const bool want = P(q::p_on) >= .5; const int size = std::clamp((int)std::floor(P(q::p_size) * .001 * sr), 256, m - 1);
    const double thru = P(q::p_thru), lvl = dbv(P(q::p_level)), r = std::pow(2.0, P(q::p_pitch) / 12), sm = 1 - std::exp(-1 / (sr * P(q::p_fade) * .001));
    for (int i = 0; i < n; i++) {
      bl[(size_t)w] = L[i]; br[(size_t)w] = R[i]; w = (w + 1) & m;
      if (want && !on && g < .001) { len = size; for (int k = 0; k < size; k++) { const size_t qq = (size_t)((w - size + k) & m); fl[(size_t)k] = bl[qq]; fr[(size_t)k] = br[qq]; } pos = 0; on = true; }
      if (!want) on = false;
      g += ((on ? 1 : 0) - g) * sm;
      if (g > 1e-4 && len > 0) {
        const double p1 = pos, p2 = std::fmod(p1 + len * .5, (double)len), w1 = std::sin(kPi * p1 / len), w2 = std::sin(kPi * p2 / len);
        const int a1 = (int)std::floor(p1), b1 = (a1 + 1) % len, a2 = (int)std::floor(p2), b2 = (a2 + 1) % len; const double f1 = p1 - a1, f2 = p2 - a2;
        const double zl = (fl[(size_t)a1] + (fl[(size_t)b1] - fl[(size_t)a1]) * f1) * w1 + (fl[(size_t)a2] + (fl[(size_t)b2] - fl[(size_t)a2]) * f2) * w2, zr = (fr[(size_t)a1] + (fr[(size_t)b1] - fr[(size_t)a1]) * f1) * w1 + (fr[(size_t)a2] + (fr[(size_t)b2] - fr[(size_t)a2]) * f2) * w2;
        pos += r; if (pos >= len) pos -= len;
        const double dg = 1 - g * (1 - thru); L[i] = (float)(L[i] * dg + zl * g * lvl); R[i] = (float)(R[i] * dg + zr * g * lvl);
      }
    }
  }
};

struct FxEnvFI : FxInst {
  double e = 0, s[4] = {0, 0, 0, 0}, g = .05;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::envf; const double sr = E->sr; const int type = P.ix(q::p_type); const double base = P(q::p_freq), rng = P(q::p_range), res = P(q::p_res), k = 2 * std::pow(.02, res), sens = dbv(P(q::p_sens));
    const double at = std::exp(-1 / (sr * P(q::p_att) * .001)), rl = std::exp(-1 / (sr * P(q::p_rel) * .001)), cp = .45 + .55 * std::min(1.0, k), bg = k * (1 + 3 * res);
    for (int i = 0; i < n; i++) {
      const double a = std::max(std::fabs((double)L[i]), std::fabs((double)R[i])) * sens; e = a > e ? at * e + (1 - at) * a : rl * e + (1 - rl) * a;
      if ((i & 7) == 0) g = std::tan(kPi * clampd(base * std::pow(2.0, rng * std::min(1.0, e)), 20, sr * .45) / sr);
      const double a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
      for (int c = 0; c < 2; c++) { float* X = c ? R : L; const double x = X[i]; const int o = c * 2; const double v3 = x - s[o + 1], v1 = a1 * s[o] + a2 * v3, v2 = s[o + 1] + a2 * s[o] + a3 * v3; s[o] = 2 * v1 - s[o]; s[o + 1] = 2 * v2 - s[o + 1];
        X[i] = (float)(type == 0 ? v2 * cp : type == 1 ? v1 * bg : type == 2 ? (x - k * v1 - v2) * cp : x - k * v1); }
    }
  }
  void reset() override { s[0] = s[1] = s[2] = s[3] = 0; e = 0; }
};

inline double pblepF(double t, double dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
struct FxVocI : FxInst {
  BiS an[24], s1[24], s2[24], hp; double env[24] = {}, ph[8] = {}, pit = 60; bool ok[24] = {}; int knb = 0; double kshift = -1, ksr = 0; Rng rng;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::voc; static const int VOCN[4] = {8, 12, 16, 24}; static const double VOCG[9] = {1, .55, 1.6, .65, .3, 1, 1, 1, 1};
    const double sr = E->sr; const int nb = VOCN[std::clamp(P.ix(q::p_bands), 0, 3)], car = std::clamp(P.ix(q::p_carrier), 0, 8);
    const double shift = std::pow(2.0, P(q::p_shift) / 12), at = 1 - std::exp(-1 / (sr * P(q::p_att) * .001)), rl = 1 - std::exp(-1 / (sr * P(q::p_rel) * .001)), tune = P(q::p_tune), wide = P(q::p_spread), unv = P(q::p_unvoiced);
    const double og = dbv(P(q::p_gain)) * 10.5 * std::pow(nb / 8.0, .7) * VOCG[car]; const bool hold = P(q::p_hold) >= .5;
    const double lo = 90, hi = std::min(11000.0, sr * .4), ratio = std::pow(hi / lo, 1.0 / (nb - 1)), qq = 1.15 / (std::sqrt(ratio) - 1 / std::sqrt(ratio));
    if (nb != knb || std::fabs(shift - kshift) > 1e-4 || sr != ksr) { knb = nb; kshift = shift; ksr = sr;
      for (int b = 0; b < nb; b++) { const double f = lo * std::pow(ratio, b), fs = f * shift; an[b].set(BT::bp, f, qq, 0, sr); ok[b] = fs > 30 && fs < sr * .45; if (ok[b]) { s1[b].set(BT::bp, fs, qq, 0, sr); s2[b].set(BT::bp, fs, qq, 0, sr); } }
      hp.set(BT::hp, 5000, .7071, 0, sr); }
    const double tgt = (E->eng ? E->eng->curPitch : 60.0) + tune; pit += (tgt - pit) * .35; const double f0 = mtof(pit), det = wide * .006;
    const Track* tk = car >= 5 && E->eng ? &E->eng->S.tk[car - 5] : nullptr; const int top = (int)std::floor(nb * .7);
    static const double st[6] = {0, 7, 12, -12, 19, 24}; double cm[6]; if (car == 3) for (int k = 0; k < 6; k++) cm[k] = std::pow(2.0, st[k] / 12);
    for (int i = 0; i < n; i++) {
      const double md = (L[i] + R[i]) * .5; double cl = 0, cr = 0;
      if (car == 0 || car == 1) { for (int c = 0; c < 2; c++) { const double dt = std::min(.45, f0 * (c ? 1 - det : 1 + det) / sr); double p = ph[c] + dt; if (p >= 1) p -= 1; ph[c] = p;
          double v; if (car == 0) v = 2 * p - 1 - pblepF(p, dt); else { double p2 = p + .5; if (p2 >= 1) p2 -= 1; v = (p < .5 ? 1 : -1) + pblepF(p, dt) - pblepF(p2, dt); }
          if (c) cr = v; else cl = v; } }
      else if (car == 2) { cl = rng.bi(); cr = rng.bi(); }
      else if (car == 3) { for (int k = 0; k < 6; k++) { const double dt = std::min(.45, f0 * cm[k] * (1 + ((k & 1) ? -det : det)) / sr); double p = ph[k] + dt; if (p >= 1) p -= 1; ph[k] = p; const double v = (2 * p - 1 - pblepF(p, dt)) * .45; if (k & 1) cr += v; else cl += v; }
        const double mm = (cl + cr) * .5, sd = (cl - cr) * .5 * (.3 + .7 * wide); cl = mm + sd; cr = mm - sd; }
      else if (car == 4) { cl = std::tanh(L[i] * 6.0); cr = std::tanh(R[i] * 6.0); }
      else if (tk) { cl = tk->l[i]; cr = tk->r[i]; }
      double oL = 0, oR = 0, hs = 0;
      for (int b = 0; b < nb; b++) { if (!hold) { const double y = std::fabs(an[b].p(0, md)); double ee = env[b]; ee += (y - ee) * (y > ee ? at : rl); env[b] = ee; }
        const double ee = env[b]; if (b >= top) hs += ee; if (ok[b]) { oL += s2[b].p(0, s1[b].p(0, cl)) * ee; oR += s2[b].p(1, s1[b].p(1, cr)) * ee; } }
      if (unv > 0) { const double z = hp.p(0, rng.bi()) * hs * unv * .12; oL += z; oR += z; }
      L[i] = (float)(oL * og); R[i] = (float)(oR * og);
    }
  }
  void reset() override { for (int b = 0; b < 24; b++) { an[b].reset(); s1[b].reset(); s2[b].reset(); env[b] = 0; } hp.reset(); }
};

struct FxTalkI : FxInst {
  OS4 os[2]; BiS b[4]; double ph = 0, e = 0, gn[4] = {1, 0, 0, 0};
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::talk;
    static const double TBF[5][4] = {{650, 1080, 2650, 2900}, {400, 1700, 2600, 3200}, {290, 1870, 2800, 3250}, {400, 800, 2600, 2800}, {350, 600, 2700, 2900}};
    static const double TBG[5][4] = {{1, .5, .45, .4}, {1, .2, .25, .2}, {1, .18, .13, .1}, {1, .32, .25, .25}, {1, .1, .14, .2}};
    const double sr = E->sr; const int mode = P.ix(q::p_mode), steps = std::clamp(P.ix(q::p_steps), 2, 8); const double glide = P(q::p_glide), sh = std::pow(2.0, P(q::p_shift)), qq = 4 + P(q::p_res) * 16, dg = dbv(P(q::p_drive)), og = dbv(P(q::p_gain)) * 4, sens = dbv(P(q::p_sens)), pos = P(q::p_pos);
    const double inc = rateOf(E, P.ix(q::p_sync), P(q::p_rate)) / sr / (mode == 1 ? steps : 1), ek = std::exp(-1 / (sr * .03)), ea = std::exp(-1 / (sr * .004));
    double sv[8]; for (int k = 0; k < 8; k++) sv[k] = clampd(P(q::p_s1 + k), 0, 4);
    auto vt = [](double x, double d, double) { return std::tanh(x * d) / std::sqrt(d); };
    for (int i = 0; i < n; i++) {
      const double a = std::max(std::fabs((double)L[i]), std::fabs((double)R[i])) * sens; e = a > e ? ea * e + (1 - ea) * a : ek * e + (1 - ek) * a;
      if ((i & 15) == 0) {
        double x;
        if (mode == 0) x = (.5 - .5 * std::cos(kTau * ph)) * (steps - 1) + pos * (steps - 1); else if (mode == 1) x = ph * steps + pos * steps; else if (mode == 2) x = std::min(1.0, e) * (steps - 1) + pos * (steps - 1); else x = pos * (steps - 1);
        int i0, i1; double fr;
        if (mode == 1) { x = std::fmod(std::fmod(x, (double)steps) + steps, (double)steps); i0 = (int)std::floor(x); fr = x - i0; i1 = (i0 + 1) % steps; if (i0 >= steps) i0 = steps - 1; fr = glide <= .001 ? 0 : clampd((fr - (1 - glide)) / glide, 0, 1); }
        else { x = clampd(x, 0, steps - 1); i0 = std::min(steps - 1, (int)std::floor(x)); fr = x - i0; i1 = std::min(steps - 1, i0 + 1); }
        fr = fr * fr * (3 - 2 * fr); const double A = sv[i0], B = sv[i1];
        for (int k = 0; k < 4; k++) {
          auto fa = [k](double v, double& fo, double& go) { const int j = std::min(3, (int)std::floor(v)); const double t = v - j; fo = TBF[j][k] * (1 - t) + TBF[j + 1][k] * t; go = TBG[j][k] * (1 - t) + TBG[j + 1][k] * t; };
          double fA, gA, fB, gB; fa(A, fA, gA); fa(B, fB, gB);
          b[k].set(BT::bp, clampd((fA * (1 - fr) + fB * fr) * sh, 40, sr * .45), qq * (k == 0 ? .7 : 1), 0, sr); gn[k] = gA * (1 - fr) + gB * fr;
        }
      }
      for (int c = 0; c < 2; c++) { float* X = c ? R : L; const double x = dg > 1.01 ? os[c].p(c, X[i], vt, dg, 0) : X[i]; double s = 0; for (int k = 0; k < 4; k++) s += gn[k] * b[k].p(c, x); X[i] = (float)(s * og); }
      ph += inc; if (ph >= 1) ph -= 1;
    }
  }
  void reset() override { for (auto& x : b) x.reset(); }
};

inline double tuneSnap(double p, int key, const int* sc, int ns) {
  double best = p, bd = 1e9; const int b = (int)std::floor(p);
  for (int nn = b - 12; nn <= b + 13; nn++) { const int pc = (((nn - key) % 12) + 12) % 12; bool in = false; for (int i = 0; i < ns; i++) if (sc[i] == pc) in = true; if (!in) continue; const double d = std::fabs(nn - p); if (d < bd - 1e-9) { bd = d; best = nn; } }
  return best;
}
struct FxTuneI : FxInst {
  PShift p[2]; double cur = 0, x = 0;
  void prepare(double sr) override { p[0].init(sr, 90); p[1].init(sr, 90); }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::tune;
    static const int SC[13][12] = {{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0, 2, 4, 5, 7, 9, 11}, {0, 2, 3, 5, 7, 8, 10}, {0, 2, 3, 5, 7, 8, 11}, {0, 2, 4, 7, 9}, {0, 3, 5, 7, 10}, {0, 3, 5, 6, 7, 10}, {0, 2, 3, 5, 7, 9, 10}, {0, 2, 4, 5, 7, 9, 10}, {0, 1, 3, 5, 7, 8, 10}, {0, 2, 4, 6, 8, 10}, {0, 7}, {0}};
    static const int SN[13] = {12, 7, 7, 7, 5, 5, 6, 7, 7, 7, 6, 2, 1};
    const double sr = E->sr, pit = E->eng ? E->eng->curPitch : 60.0; const int sci = std::clamp(P.ix(q::p_scale), 0, 12);
    const double tg = (tuneSnap(pit, P.ix(q::p_key), SC[sci], SN[sci]) - pit) * P(q::p_amount) + P(q::p_shift) + P(q::p_fine) / 100, sp = P(q::p_speed);
    cur += (tg - cur) * (sp <= 1 ? 1 : 1 - std::exp(-n / (sr * sp * .001))); const double r = std::pow(2.0, cur / 12), want = std::fabs(cur) > .004 ? 1 : 0, sm = 1 - std::exp(-1 / (sr * .004));
    for (auto& s : p) s.setW(sr, P(q::p_win));
    for (int i = 0; i < n; i++) { x += (want - x) * sm; for (int c = 0; c < 2; c++) { float* X = c ? R : L; const double y = p[c].p(X[i], r); X[i] = (float)(X[i] * (1 - x) + y * x); } }
  }
  void reset() override { p[0].d.clear(); p[1].d.clear(); }
};

inline double fcSs(double t) { t = clampd(t, 0, 1); return t * t * (3 - 2 * t); }
inline double fcAt(double u, double nl) { return u >= 0 ? std::tanh(u) : nl * std::tanh(u / nl); }
inline double fcPurr(double x, double drive, double xs, double fuzz) {
  const double dn = fcSs((drive - .8) * 5), xn = fcSs((xs - .8) * 5), fn = fcSs((fuzz - .8) * 5); double y = x;
  if (drive > .001) { y = std::tanh(x * (1 + drive * 5 + dn * 30)); if (dn > 0) y += dn * (std::tanh(y * (2 + 10 * dn)) - y); }
  if (xs > .001) { const double nl = std::max(.25, 1 - .3 * xs - .25 * xn), u = y * (1 + xs * 5 + xn * 30); y = fcAt(u, nl); y += (.3 * xs + .25 * xn) * y * y; if (xn > 0) { const double y2 = fcAt(y * (2 + 10 * xn) + .15 * xn, nl); y += xn * (y2 - y); } }
  if (fuzz > .001) { const double fz = 1 + fuzz * 14 + fn * 70, bf = .5 * std::min(1.0, fuzz); y = std::tanh(y * fz + bf) - std::tanh(bf); if (fn > 0) { const double r = std::sqrt(y * y + .02) - .1414; y += fn * .7 * (r - .3); y = std::tanh(y * (1 + .8 * fn)); } }
  return y;
}
inline double fcMake(double drive, double xs, double fuzz, double ref) { double a = 0, b = 0; for (int i = 0; i < 64; i++) { const double x = ref * std::sin(kTau * i / 64), y = fcPurr(x, drive, xs, fuzz); a += x * x; b += y * y; } return clampd(b > 1e-9 ? std::sqrt(a / b) : 1, .25, 4); }
inline double fcClip(double v) { const double m = std::fabs(v); return m <= .7 ? v : (v < 0 ? -1 : 1) * (.7 + .27 * std::tanh((m - .7) / .27)); }
struct FxFatCatI : FxInst {
  struct Sh { bool pur = false, st2 = false; double g = 1, p = 1.6, nm = 1, d = 0, x = 0, z = 0, x1 = 0, z1 = 0, mk = 1;
    double operator()(double v) const { v = v > 8 ? 8 : v < -8 ? -8 : v; if (pur) return fcPurr(v, d, x, z) * mk; const double u = v * g, b = u / std::pow(1 + std::pow(std::fabs(u), p), 1 / p) * nm; return st2 ? fcPurr(b, 0, x1, z1) * mk : b; } };
  OS4 os[2], of[2]; OS2 oc[2]; BiS band, fhp, nlp; double env = 0, dc[2] = {0, 0}; float er[8] = {}; int ew = 0; float tr[4096] = {}; int tp = 0; Sh S; double kd = -1, kx = -1, kz = -1; int kp = -1;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::fatcat; const double sr = E->sr, drive = P(q::p_drive) * .01, xs = P(q::p_xs) * .01, gz = P(q::p_grit) * .01, fuzz = P(q::p_fuzz) * .01, color = P(q::p_color), og = dbv(P(q::p_out)); const bool pur = P.ix(q::p_char) == 1;
    if (drive != kd || xs != kx || gz != kz || (int)pur != kp) { kd = drive; kx = xs; kz = gz; kp = pur; S.pur = pur; S.d = drive; S.x = xs; S.z = gz;
      if (pur) { S.mk = fcMake(drive, xs, gz, .7); S.st2 = false; }
      else { const double b = 1.4, t = clampd((drive - .75) / .25, 0, 1), sm = t * t * (3 - 2 * t); S.g = 1 + 22 * drive * b; S.p = 1.6 + 4.4 * sm; S.nm = std::pow(1 + std::pow(S.g, S.p), 1 / S.p) / S.g; S.x1 = std::min(2.0, xs * 1.4); S.z1 = std::min(2.0, gz * 1.4); S.st2 = xs > 0 || gz > 0; S.mk = S.st2 ? fcMake(0, S.x1, S.z1, .95) : 1; } }
    const Sh sh = S; auto shape = [&sh](double v, double, double) { return sh(v); };
    const double nast = pur ? std::max({fcSs((drive - .8) * 5), fcSs((xs - .8) * 5), fcSs((gz - .8) * 5)}) : 0, ck = color * .01 * 1.6 * 1.4;
    band.set(BT::bp, 150 * std::pow(40.0, color * .01), 1.4, 0, sr); fhp.set(BT::hp, 1500, .7071, 0, sr); if (nast > 0) nlp.set(BT::lp, std::max(3000.0, 14000 - 10000 * nast), .7071, 0, sr);
    const double aA = std::exp(-1 / (.001 * sr)), aR = std::exp(-1 / (.05 * sr)), fzg = 4 + 24 * fuzz, dl = std::min(4094.0, P(q::p_turbo) * .01 * .012 * sr);
    auto th = [](double x, double, double) { return std::tanh(x); }; auto cl = [](double x, double, double) { return fcClip(x); };
    for (auto& o : oc) o.prep(sr);
    for (int i = 0; i < n; i++) {
      double yl = L[i], yr = R[i];
      if (ck > 0) { yl += ck * band.p(0, yl); yr += ck * band.p(1, yr); }
      const double pk = std::max(std::fabs(yl), std::fabs(yr)), a = pk > env ? aA : aR; env = a * env + (1 - a) * pk;
      const double inv = 1 / (env + 1e-5); er[ew] = (float)env; const double ev = er[(ew + 3) & 7]; ew = (ew + 1) & 7;
      for (int c = 0; c < 2; c++) {
        double w = os[c].p(c, (c ? yr : yl) * inv, shape, 0, 0);
        if (nast > 0) w = nlp.p(c, w);
        w *= ev; dc[c] += .0005 * (w - dc[c]); w -= dc[c];
        if (fuzz > 0) { const double aa = fhp.p(c, w) / (ev + 1e-5) * fzg; w += fuzz * .5 * of[c].p(c, aa, th, 0, 0) * ev; }
        w = oc[c].p(c, w, cl, 0, 0) * og;
        if (c) { tr[tp] = (float)w; double rp = tp - dl; if (rp < 0) rp += 4096; const int i0 = (int)std::floor(rp); const double fr = rp - i0; w = tr[i0 & 4095] * (1 - fr) + tr[(i0 + 1) & 4095] * fr; tp = (tp + 1) & 4095; R[i] = (float)w; } else L[i] = (float)w;
      }
    }
  }
  void alignDry(float* L, float* R, int n) override { for (int i = 0; i < n; i++) { L[i] = (float)oc[0].lin(0, os[0].lin(0, L[i])); R[i] = (float)oc[1].lin(1, os[1].lin(1, R[i])); } }
};
} // namespace whisker
