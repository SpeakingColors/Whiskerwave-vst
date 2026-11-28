// FX: delay, quad taps, pitch shifter, reverb, disperser, imager, wide, utility, bass weight, exciter, stutter (port of dsp3c.js).
#pragma once
#include "FxDyn.h"
namespace whisker {
struct FxDelayI : FxInst {
  DelayLine dl[2]; double tl = 0, tr = 0; bool init = false; BiS hp[2], lp[2]; double wp = 0; OS2 os[2];
  void prepare(double sr) override { const int m = (int)std::floor(sr * 4) + 16; dl[0].init(m); dl[1].init(m); init = false; }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::delay; const double sr = E->sr, beat = 60000 / E->bpm; const int mode = P.ix(q::p_mode), sl = P.ix(q::p_syncl), srr = P.ix(q::p_syncr);
    const double msL = sl > 0 ? beat * kSyncDiv[sl] : P(q::p_timel), msR = mode == 3 ? (srr > 0 ? beat * kSyncDiv[srr] : P(q::p_timer)) : msL;
    const bool tape = mode == 2; const double fb = std::min(.98, P(q::p_fb)), sat = std::max(P(q::p_sat), tape ? .35 : 0.0), wow = std::max(P(q::p_wow), tape ? .3 : 0.0), hc = tape ? std::min(P(q::p_hc), 5500.0) : P(q::p_hc);
    for (int c = 0; c < 2; c++) { hp[c].set(BT::hp, P(q::p_lc), .7071, 0, sr); lp[c].set(BT::lp, hc, .7071, 0, sr); }
    const double tgL = clampd(msL * sr * .001, 8, sr * 3.9), tgR = clampd(msR * sr * .001, 8, sr * 3.9);
    if (!init) { tl = tgL; tr = tgR; init = true; }
    const double k = .0012, satg = 1 + sat * 3, satn = 1 / (1 + sat * 1.2); for (auto& o : os) o.prep(sr);
    auto dsat = [](double x, double g, double nn) { return std::tanh(x * g) * nn; };
    for (int i = 0; i < n; i++) {
      tl += (tgL - tl) * k; tr += (tgR - tr) * k;
      const double wl = wow > 0 ? 1 + wow * .004 * std::sin(kTau * wp) : 1, wr = wow > 0 ? 1 + wow * .004 * std::sin(kTau * wp * 1.13 + 1) : 1; wp += .6 / sr; if (wp > 1) wp -= 1;
      const double yl = dl[0].read(tl * wl - 1), yr = dl[1].read(tr * wr - 1);
      double fl = lp[0].p(0, hp[0].p(0, yl)), fr = lp[1].p(1, hp[1].p(1, yr));
      if (sat > 0) { fl = os[0].p(0, fl, dsat, satg, satn); fr = os[1].p(1, fr, dsat, satg, satn); }
      if (mode == 1) { const double m = (L[i] + R[i]) * .5; dl[0].write(m + fb * fr); dl[1].write(fb * fl); }
      else { dl[0].write(L[i] + fb * fl); dl[1].write(R[i] + fb * fr); }
      L[i] = (float)yl; R[i] = (float)yr;
    }
  }
  void reset() override { dl[0].clear(); dl[1].clear(); for (int c = 0; c < 2; c++) { hp[c].reset(); lp[c].reset(); } }
};

struct FxTapsI : FxInst {
  DelayLine d; BiS lp, hp; double t[4] = {0, 0, 0, 0}; bool init = false;
  void prepare(double sr) override { d.init((int)std::floor(sr * 6) + 16); init = false; }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::taps; const double sr = E->sr, beat = 60 / E->bpm, fb = std::min(.95, P(q::p_fb));
    lp.set(BT::lp, P(q::p_hc), .7071, 0, sr); hp.set(BT::hp, P(q::p_lc), .7071, 0, sr);
    double tg[4], lv[4], cs[4], sn[4];
    for (int k = 0; k < 4; k++) { const int b = q::p_d1 + k * 4; tg[k] = clampd(beat * SD(P.ix(b)) * sr * P(b + 1), 8, sr * 5.9); lv[k] = P(b + 2); const double a = (P(b + 3) * .5 + .5) * kPi / 2; cs[k] = std::cos(a) * 1.414; sn[k] = std::sin(a) * 1.414; }
    if (!init) { for (int k = 0; k < 4; k++) t[k] = tg[k]; init = true; }
    for (int i = 0; i < n; i++) {
      double oL = 0, oR = 0, sum = 0;
      for (int k = 0; k < 4; k++) { t[k] += (tg[k] - t[k]) * .0012; const double y = d.read(t[k] - 1) * lv[k]; sum += y; oL += y * cs[k]; oR += y * sn[k]; }
      const double m = (L[i] + R[i]) * .5, f = lp.p(0, hp.p(0, sum)); d.write(m + fb * std::tanh(f)); L[i] = (float)oL; R[i] = (float)oR;
    }
  }
  void reset() override { d.clear(); lp.reset(); hp.reset(); }
};

struct PShift { // two overlapping grains read from a delay line
  int W = 2205; DelayLine d; double ph = 0;
  void init(double sr, double maxMs = 50) { W = (int)std::floor(sr * maxMs * .001); d.init(W * 2 + 16); ph = 0; }
  void setW(double sr, double ms) { W = std::max(64, (int)std::floor(sr * ms * .001)); }
  double p(double x, double r) {
    d.write(x); ph += (1 - r) / W; ph -= std::floor(ph);
    const double p2 = std::fmod(ph + .5, 1.0), s1 = std::sin(kPi * ph), s2 = std::sin(kPi * p2);
    return d.read(ph * W) * s1 * s1 + d.read(p2 * W) * s2 * s2;
  }
};
struct FxPitchI : FxInst {
  PShift p[2]; double fb[2] = {0, 0};
  void prepare(double sr) override { p[0].init(sr, 130); p[1].init(sr, 130); } // room for the longest window (120 ms)
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::pitch; const double sr = E->sr, r = std::pow(2.0, (P(q::p_semi) + P(q::p_fine) / 100) / 12), w = P(q::p_win), fbk = P(q::p_fb);
    for (auto& x : p) x.setW(sr, w);
    for (int i = 0; i < n; i++) for (int c = 0; c < 2; c++) { float* X = c ? R : L; const double y = p[c].p(X[i] + fb[c] * fbk, r); fb[c] = std::tanh(y); X[i] = (float)y; }
  }
  void reset() override { p[0].d.clear(); p[1].d.clear(); fb[0] = fb[1] = 0; }
};

struct AP1 { DelayLine d; void init(int mx) { d.init(mx); } double p(double x, double D, double g) { const double z = d.read(D - 1), w = x + g * z; d.write(w); return z - g * w; } };
struct FxVerbI : FxInst {
  DelayLine ln[8], pre[2]; double lps[8] = {}, lph[8]; AP1 apl[4], apr[4], spl[6], spr[6]; BiS hp[2]; PShift ps; double sh = 0, gate = 0, hold = 0, swell = 0; double dl[8] = {}, o[8] = {}, gn[8] = {};
  FxVerbI() { for (int i = 0; i < 8; i++) lph[i] = i * .37; }
  void prepare(double sr) override {
    const int m = (int)std::floor(16384 * sr / 44100) + 64; for (auto& l : ln) l.init(m);
    const int am = (int)(2048 * std::max(1.0, sr / 44100)), sm = (int)(512 * std::max(1.0, sr / 44100));
    for (int i = 0; i < 4; i++) { apl[i].init(am); apr[i].init(am); } for (int i = 0; i < 6; i++) { spl[i].init(sm); spr[i].init(sm); }
    pre[0].init((int)std::floor(sr * .55)); pre[1].init((int)std::floor(sr * .55)); ps.init(sr);
  }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::verb;
    static const double VBASE[8] = {1087, 1283, 1471, 1699, 1949, 2203, 2467, 2749};
    static const double VT[10][4] = {{.45, .6, .15, .9}, {.8, .8, .3, 0}, {1.4, .7, .3, .4}, {2.6, .75, .35, .2}, {.7, .65, .2, .6}, {.35, .3, .05, 0}, {1.6, .75, .45, 0}, {.8, .7, .2, .3}, {1.8, .8, .4, 0}, {2.0, .85, .6, 0}};
    static const double ERT[6] = {11, 17, 23, 31, 43, 59}, ERG[6] = {.7, .6, .5, .45, .35, .3};
    static const double APS[4] = {142, 107, 379, 277}, SPD[6] = {37, 53, 71, 89, 107, 131}, lfi[8] = {.11, .17, .23, .29, .13, .19, .31, .37};
    const double sr = E->sr, k = sr / 44100; const int ty = std::clamp(P.ix(q::p_type), 0, 9); const double* T = VT[ty];
    const double size = P(q::p_size), rt = P(q::p_decay), pd = P(q::p_pre) * .001 * sr, diff = clampd(T[1] * (.6 + .6 * P(q::p_diff)), .1, .86), md = T[2] * P(q::p_mod), er = T[3] * P(q::p_early), wid = P(q::p_width), shim = P(q::p_shim);
    const double scale = T[0] * (.5 + size) * k;
    for (int i = 0; i < 8; i++) { dl[i] = std::max(32.0, std::floor(VBASE[i] * scale)); gn[i] = std::pow(10.0, -3 * dl[i] / (sr * rt)); }
    const double dk = 1 - std::exp(-kTau * P(q::p_damp) / sr), hpf = P(q::p_lc); for (int c = 0; c < 2; c++) hp[c].set(BT::hp, hpf, .7071, 0, sr);
    double aps[4], spd[6]; for (int i = 0; i < 4; i++) aps[i] = std::max(8.0, std::floor(APS[i] * k * (.6 + .5 * size))); for (int i = 0; i < 6; i++) spd[i] = std::floor(SPD[i] * k);
    const bool lm = ty == 7, bl = ty == 8, sp = ty == 5, shm = ty == 6; const double holdS = sr * (.08 + size * .4), sq = 1 / std::sqrt(8.0);
    for (int i = 0; i < n; i++) {
      const double xl = L[i], xr = R[i]; pre[0].write(xl); pre[1].write(xr);
      const double pl = pd > 1 ? pre[0].read(pd - 1) : xl, pr = pd > 1 ? pre[1].read(pd - 1) : xr;
      const double lv = std::max(std::fabs(xl), std::fabs(xr));
      if (lm) { if (lv > .01) hold = holdS; else if (hold > 0) hold--; gate += ((hold > 0 ? 1 : 0) - gate) * (hold > 0 ? .01 : .0015); }
      if (bl) swell += ((lv > .005 ? 1 : 0) - swell) * (lv > .005 ? .00015 : .00006);
      double erl = 0, err = 0;
      if (er > 0) { for (int t = 0; t < 6; t++) { const double d = std::floor(ERT[t] * .001 * sr * (.5 + size) + std::max(0.0, pd)); const double a = pre[t & 1].read(d); if (t & 1) err += a * ERG[t]; else erl += a * ERG[t]; } erl *= er; err *= er; }
      double il = pl, ir = pr;
      if (shm) { il += sh * shim * .5; ir += sh * shim * .5; }
      if (sp) for (int s = 0; s < 6; s++) { il = spl[s].p(il, spd[s], .62); ir = spr[s].p(ir, spd[s] + 3, .62); }
      for (int s = 0; s < 4; s++) { il = apl[s].p(il, aps[s], diff); ir = apr[s].p(ir, aps[s] + 11, diff); }
      if (bl) { il *= swell; ir *= swell; }
      for (int j = 0; j < 8; j++) {
        lph[j] += lfi[j] / sr; if (lph[j] > 1) lph[j] -= 1;
        const double mod = md > 0 ? std::sin(kTau * lph[j]) * md * 10 * k : 0; const double v = ln[j].read(dl[j] + mod - 1);
        lps[j] += dk * (v - lps[j]); o[j] = lps[j];
      }
      const double oL = (o[0] + o[2] + o[4] + o[6]) * .4, oR = (o[1] + o[3] + o[5] + o[7]) * .4;
      const double a0 = o[0] + o[1], a1 = o[0] - o[1], a2 = o[2] + o[3], a3 = o[2] - o[3], a4 = o[4] + o[5], a5 = o[4] - o[5], a6 = o[6] + o[7], a7 = o[6] - o[7];
      const double b0 = a0 + a2, b1 = a1 + a3, b2 = a0 - a2, b3 = a1 - a3, b4 = a4 + a6, b5 = a5 + a7, b6 = a4 - a6, b7 = a5 - a7;
      const double m0 = (b0 + b4) * sq, m1 = (b1 + b5) * sq, m2 = (b2 + b6) * sq, m3 = (b3 + b7) * sq, m4 = (b0 - b4) * sq, m5 = (b1 - b5) * sq, m6 = (b2 - b6) * sq, m7 = (b3 - b7) * sq;
      ln[0].write(il * .5 + gn[0] * m0); ln[1].write(ir * .5 + gn[1] * m1); ln[2].write(il * .5 + gn[2] * m2); ln[3].write(ir * .5 + gn[3] * m3);
      ln[4].write(il * .5 + gn[4] * m4); ln[5].write(ir * .5 + gn[5] * m5); ln[6].write(il * .5 + gn[6] * m6); ln[7].write(ir * .5 + gn[7] * m7);
      double wl = oL + erl, wr = oR + err;
      if (shm) sh = ps.p((wl + wr) * .5, 2);
      if (lm) { wl *= gate; wr *= gate; }
      const double mm = (wl + wr) * .5, ss = (wl - wr) * .5 * wid * 2; wl = mm + ss; wr = mm - ss;
      L[i] = (float)hp[0].p(0, wl); R[i] = (float)hp[1].p(1, wr);
    }
  }
  void reset() override { for (auto& l : ln) l.clear(); for (auto& a : apl) a.d.clear(); for (auto& a : apr) a.d.clear(); for (auto& a : spl) a.d.clear(); for (auto& a : spr) a.d.clear(); pre[0].clear(); pre[1].clear(); ps.d.clear(); std::fill(lps, lps + 8, 0.0); sh = 0; hp[0].reset(); hp[1].reset(); }
};

struct FxDispI : FxInst {
  double x1[128] = {}, y1[128] = {}, a[64] = {}, b[64] = {}, fb[2] = {0, 0};
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::disp; const double sr = E->sr; const int ns = std::clamp(P.ix(q::p_amount), 1, 64); const double fc = P(q::p_freq), pin = std::pow(2.0, P(q::p_pinch) * 1.5), spr = P(q::p_spread), fbk = P(q::p_fb), oct = P(q::p_range);
    for (int k = 0; k < ns; k++) { const double u = (k + .5) / ns * 2 - 1, w = (u < 0 ? -1 : 1) * std::pow(std::fabs(u), pin);
      for (int c = 0; c < 2; c++) { const double f = clampd(fc * std::pow(2.0, w * oct) * (c ? 1 + spr * .6 : 1), 20, sr * .45), t = std::tan(kPi * f / sr); (c ? b : a)[k] = (t - 1) / (t + 1); } }
    for (int i = 0; i < n; i++) for (int c = 0; c < 2; c++) { float* X = c ? R : L; const double* A = c ? b : a; const int o = c * 64; double y = X[i] + fbk * fb[c];
      for (int k = 0; k < ns; k++) { const double aa = A[k]; const int j = o + k; const double out = aa * y + x1[j] - aa * y1[j]; x1[j] = y; y1[j] = out; y = out; }
      fb[c] = std::tanh(y * .9); X[i] = (float)y; }
  }
  void reset() override { std::fill(x1, x1 + 128, 0.0); std::fill(y1, y1 + 128, 0.0); fb[0] = fb[1] = 0; }
};

struct FxImageI : FxInst {
  BiS hp;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::image; const double sr = E->sr, w = P(q::p_width), bm = P(q::p_bass), pn = P(q::p_pan), mg = dbv(P(q::p_mid)), sg = dbv(P(q::p_side)), gl = std::cos((pn * .5 + .5) * kPi / 2) * 1.414, gr2 = std::sin((pn * .5 + .5) * kPi / 2) * 1.414;
    if (bm > 25) hp.set(BT::hp, bm, .7071, 0, sr);
    for (int i = 0; i < n; i++) { const double m = (L[i] + R[i]) * .5; double s = (L[i] - R[i]) * .5; if (bm > 25) s = hp.p(0, s); s *= w * sg; L[i] = (float)((m * mg + s) * gl); R[i] = (float)((m * mg - s) * gr2); }
  }
};

struct FxHaasI : FxInst {
  DelayLine d; AP1 al[4], ar[4];
  void prepare(double sr) override { d.init((int)std::floor(sr * .04)); const int am = (int)(512 * std::max(1.0, sr / 44100)); for (int i = 0; i < 4; i++) { al[i].init(am); ar[i].init(am); } }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::haas; static const double DL[4] = {23, 37, 53, 71}, DR[4] = {29, 43, 61, 83};
    const double sr = E->sr, t = P(q::p_time) * .001 * sr, dec = P(q::p_decor); const int side = P.ix(q::p_side); double dl[4], dr[4]; for (int k = 0; k < 4; k++) { dl[k] = std::floor(DL[k] * sr / 44100); dr[k] = std::floor(DR[k] * sr / 44100); } const double g = .5 * dec;
    for (int i = 0; i < n; i++) {
      double l = L[i], r = R[i];
      if (dec > 0) for (int k = 0; k < 4; k++) { l = al[k].p(l, dl[k], g); r = ar[k].p(r, dr[k], -g); }
      if (t > 1) { const double X = side == 0 ? l : r; d.write(X); const double y = d.read(t - 1); if (side == 0) l = y; else r = y; }
      L[i] = (float)l; R[i] = (float)r;
    }
  }
};

struct FxUtilI : FxInst {
  double dc[2] = {0, 0}, g = 1;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::util; const double tg = P(q::p_gain) <= -60 ? 0 : dbv(P(q::p_gain)), pn = P(q::p_pan), gl = std::cos((pn * .5 + .5) * kPi / 2) * 1.414, gr2 = std::sin((pn * .5 + .5) * kPi / 2) * 1.414;
    const int mono = P.ix(q::p_mono), inv = P.ix(q::p_invert), sw = P.ix(q::p_swap), dcf = P.ix(q::p_dc); const double sm = 1 - std::exp(-1 / (E->sr * .004));
    for (int i = 0; i < n; i++) {
      double l = L[i], r = R[i];
      if (sw) std::swap(l, r); if (inv == 1 || inv == 3) l = -l; if (inv == 2 || inv == 3) r = -r;
      if (mono) l = r = (l + r) * .5;
      if (dcf) { dc[0] += .0008 * (l - dc[0]); dc[1] += .0008 * (r - dc[1]); l -= dc[0]; r -= dc[1]; }
      g += (tg - g) * sm; L[i] = (float)(l * g * gl); R[i] = (float)(r * g * gr2);
    }
  }
};

struct FxSubxI : FxInst {
  OS2 os; BiS lp, lp2, hp;
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::subx; const double sr = E->sr, f = P(q::p_freq), amt = P(q::p_amount), hm = P(q::p_harm), lv = dbv(P(q::p_level)); os.prep(sr);
    lp.set(BT::lp, f, .7071, 0, sr); lp2.set(BT::lp, f * 2.2, .7071, 0, sr); hp.set(BT::hp, f * .5, .7071, 0, sr);
    auto subfn = [](double x, double, double) { return std::tanh(x * 4) * .6 - x * .3; };
    for (int i = 0; i < n; i++) { const double m = (L[i] + R[i]) * .5, low = lp.p(0, m); const double h = lp2.p(0, hp.p(0, os.p(0, low, subfn, 0, 0))) * hm; const double add = (low * amt * .5 + h * amt) * lv; L[i] = (float)(L[i] + add); R[i] = (float)(R[i] + add); }
  }
};

struct FxExcI : FxInst {
  BiS hp, lp; OS4 os[2];
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::exciter; static const double EXK = 1 - std::tanh(.25) * std::tanh(.25);
    const double sr = E->sr, f = P(q::p_freq), amt = P(q::p_amount), dr = dbv(P(q::p_drive)), bias = .25;
    hp.set(BT::hp, f, .7071, 0, sr); lp.set(BT::lp, std::min(sr * .45, f * 6), .7071, 0, sr);
    auto fn = [](double x, double d, double b) { return std::tanh(x * d + b) - std::tanh(b) - x * d * EXK; };
    for (int i = 0; i < n; i++) for (int c = 0; c < 2; c++) { float* X = c ? R : L; const double h = hp.p(c, X[i]), s = h * dr * EXK + os[c].p(c, h, fn, dr, bias); X[i] = (float)(X[i] + lp.p(c, s) * amt); }
  }
};

struct FxStutterI : FxInst {
  std::vector<float> bl, br, fl, fr; int m = 0, w = 0, pos = 0, len = 0; bool on = false; int64_t last = -1; Rng rng;
  void prepare(double sr) override { m = (int)std::floor(sr * 2); bl.assign((size_t)m, 0.f); br.assign((size_t)m, 0.f); fl.assign((size_t)m, 0.f); fr.assign((size_t)m, 0.f); w = 0; on = false; }
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode&, int) override {
    namespace q = fxp::stutter; if (m < 64) return; const double sr = E->sr, sl = SD(P.ix(q::p_div)), pr = P(q::p_prob), slen = SD(P.ix(q::p_len)), adv = E->bpm / 60 / sr; double bp = E->beat;
    const int ln = std::max(32, std::min(m - 1, (int)std::floor(slen * 60 / E->bpm * sr)));
    for (int i = 0; i < n; i++) {
      bl[(size_t)w] = L[i]; br[(size_t)w] = R[i]; w = (w + 1) % m;
      const int64_t idx = (int64_t)std::floor(bp / sl);
      if (idx != last) { last = idx; on = rng.next() < pr;
        if (on) { len = ln; for (int k = 0; k < ln; k++) { const int qq = (w - ln + k + m * 2) % m; fl[(size_t)k] = bl[(size_t)qq]; fr[(size_t)k] = br[(size_t)qq]; } pos = 0; } }
      if (on) { const double f = std::min(1.0, std::min(pos / 48.0, (len - pos) / 48.0)); const double g = f < 1 ? f : 1; L[i] = (float)(fl[(size_t)pos] * g + L[i] * (1 - g)); R[i] = (float)(fr[(size_t)pos] * g + R[i] * (1 - g)); pos = (pos + 1) % len; }
      bp += adv;
    }
  }
};

struct FxSplitI : FxInst {
  XSplit xs { 3 }; int nb = 0; float bf[4][2][kBlock]; double pk[4] = {0, 0, 0, 0};
  void proc(float* L, float* R, int n, const FxPar& P, const FxNode& node, int depth) override {
    namespace q = fxp::split; const int want = std::clamp(node.st->nb.load(std::memory_order_relaxed), 2, 4);
    if (nb != want) { nb = want; xs = XSplit(nb); }
    const double f[3] = {P(q::p_x1), P(q::p_x2), P(q::p_x3)}; xs.set(f, E->sr); xs.split(L, R, n, bf);
    bool solo = false; for (int j = 0; j < 4; j++) if (node.st->so[j].load(std::memory_order_relaxed)) solo = true;
    FxHost* host = hostPtr; if (host) for (int j = 0; j < nb; j++) if (!node.bands[j].empty()) host->runList(node.bands[j], bf[j][0], bf[j][1], n, depth + 1);
    std::fill(L, L + n, 0.f); std::fill(R, R + n, 0.f);
    for (int j = 0; j < nb; j++) {
      const bool mute = node.st->ms[j].load(std::memory_order_relaxed) || (solo && !node.st->so[j].load(std::memory_order_relaxed)); const double g = mute ? 0 : dbv(P(q::p_g1 + j)); double p = 0;
      for (int i = 0; i < n; i++) { const double l = bf[j][0][i] * g, r = bf[j][1][i] * g; L[i] = (float)(L[i] + l); R[i] = (float)(R[i] + r); const double a = std::max(std::fabs(l), std::fabs(r)); if (a > p) p = a; }
      pk[j] = std::max(pk[j] * .9, p); node.st->bandMeter[j].store((float)pk[j], std::memory_order_relaxed);
    }
  }
};
} // namespace whisker
