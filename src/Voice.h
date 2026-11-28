// Voice: full port of the mockup voice (dsp2.js): 6 oscillators (wavetable, sample, granular), sub, noise, 16 modulator
// slots, 4 LFOs, per-source envelopes and filters, analog drift, modulation matrix. Audio thread only.
#pragma once
#include "Tables.h"
#include "Mod.h"
#include "Filters.h"
#include "ParamIdx.h"
namespace whisker {
inline double fromNorm(int k, double n) {
  const ParamSpec& p = kParams[k]; n = clampd(n, 0, 1);
  if (p.kind == PK::Exp) return p.mn * std::pow((double)p.mx / p.mn, n);
  const double v = p.mn + n * (p.mx - p.mn);
  return (p.kind == PK::Int || p.kind == PK::List) ? std::floor(v + 0.5) : v;
}
inline double toNorm(int k, double v) {
  const ParamSpec& p = kParams[k];
  if (p.kind == PK::Exp) return std::log(std::max(v, (double)p.mn) / p.mn) / std::log((double)p.mx / p.mn);
  const double d = (double)p.mx - p.mn; return (v - p.mn) / (d == 0 ? 1 : d);
}
// sources: e1..e16, l1..l4, m1..m8, vel, key, wheel, bend, at, rnd
enum Src { S_E1 = 0, S_L1 = 16, S_M1 = 20, S_VEL = 28, S_KEY, S_WHEEL, S_BEND, S_AT, S_RND, kNumSrc };
struct Slot { int src = 0, dst = -1; double amt = 0; bool uni = false; };
struct Sample { std::vector<float> d; double sr = 44100; };
struct Track { float l[kBlock] = {}, r[kBlock] = {}; };
inline const double kSyncDiv[13] = {0, 4, 2, 1, .5, .25, .125, 2.0 / 3, 1.0 / 3, 1.0 / 6, 1.5, .75, .375};
inline const double kESyncB[9] = {0, .25, .5, 1, 2, 4, 8, 16, 32}; // beats per drawn-shape length (esync list)
struct Shared {
  double sr = 44100;
  double pv[kNumParams] = {}, bn[kNumParams] = {};
  Slot slots[64]; int nSlots = 0;
  float custom[20][32] = {}; float draw[16][128] = {}; int drawN[16] = {};
  const Table* tab[6] = {}; const Sample* smp[6] = {};
  double wheel = 0, bend = 0, at = 0, gl[4] = {0, 0, 0, 0};
  Track tk[4]; int serial = 0; bool hasGlide = false; double glideFrom = 0;
  Shared() {
    for (int k = 0; k < kNumParams; k++) { pv[k] = kParams[k].def; bn[k] = toNorm(k, pv[k]); }
    for (int j = 0; j < 20; j++) for (int i = 0; i < 32; i++) custom[j][i] = (float)std::sin(i / 32.0 * kTau);
    for (int j = 0; j < 16; j++) { drawN[j] = 32; for (int i = 0; i < 32; i++) draw[j][i] = (float)(j == 2 ? std::exp(-i / 8.0) : j == 3 ? i / 31.0 : std::exp(-i / 8.0)); }
  }
  void setParam(int k, double v) { pv[k] = v; bn[k] = toNorm(k, v); }
};

constexpr double kSqrt2 = 1.41421356237309504880;
inline const double JPOFF[6] = {-0.11002313, -0.06288439, -0.01952356, 0.01991221, 0.06216538, 0.10745242};
inline const double JPC[12] = {10028.7312891634, -50818.8652045924, 111363.4808729368, -138150.6761080548, 106649.6679158292, -53046.9642751875, 17019.9518580080, -3425.0836591318, 404.2703938388, -24.1878824391, 0.6717417634, 0.0030115596};
inline double jpCurve(double x) { double y = 0; for (double c : JPC) y = y * x + c; return std::max(0.0, y); }
inline double jpCen(double m) { return -0.55366 * m + 0.99785; }
inline double jpSide(double m) { return -0.73764 * m * m + 1.2841 * m + 0.044372; }
inline double pblep(double t, double dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
inline double subWave(int w, double p, double dt, double pw) {
  dt = std::min(.45, std::max(1e-6, dt));
  switch (w) {
    case 0: return std::sin(kTau * p);
    case 1: return p < .5 ? 4 * p - 1 : 3 - 4 * p;
    case 2: case 4: return ((p < pw ? 1 : -1) + pblep(p, dt) - pblep(std::fmod(p - pw + 1, 1.0), dt)) * .7;
    case 3: return ((2 * p - 1) - pblep(p, dt)) * .7;
    case 5: { const double s = std::sin(kTau * p); return (s > 0 ? s : 0) * 1.6 - .5; }
    case 6: return std::tanh(std::sin(kTau * p) * 3) * .9;
    case 7: return (std::sin(kTau * p) + .5 * std::sin(kTau * 2 * p) + .25 * std::sin(kTau * 3 * p)) * .62;
    default: return p < .5 ? 1 - 16 * (p - .25) * (p - .25) : -(1 - 16 * (p - .75) * (p - .75));
  }
}
inline const std::array<double, 31>& fir4() {
  static const std::array<double, 31> k = [] {
    std::array<double, 31> a{}; double sm = 0;
    for (int j = 0; j < 31; j++) { const double x = j - 15; const double w = .42 - .5 * std::cos(2 * kPi * j / 30) + .08 * std::cos(4 * kPi * j / 30); a[j] = (x == 0 ? .25 : std::sin(kPi * x * .25) / (kPi * x)) * w; sm += a[j]; }
    for (auto& v : a) v /= sm; return a; }();
  return k;
}
struct NzState { double a = 0, b = 0, c = 0, pw = 0, pd = 0, sh = 0, cnt = 0, gp = 0, lp1 = 0, lp2 = 0, hp1 = 0, hp2 = 0, v1 = 0, v2 = 0; };
struct Grain { double pos, age, len, pan, rate; };
struct OscCache {
  bool init = false; double pos = 0, posP = 0, w1a = 0, w1aP = 0, w2a = 0, w2aP = 0, ma = 0, maP = 0, fb = 0, fbP = 0, lvl = 0, lvlP = 0;
  int w1 = 0, w2 = 0, mm = 0, ms = 0, eng = 0, loop = 0; bool os = false, jp = false; double fmax = 0, jg = 0, gp = 0, gs = 0, gd = 0, gj = 0, root = 60, pr = 1;
  double pi = 0, a1i = 0, a2i = 0, mai = 0, fbi = 0, lvi = 0;
};
struct SubNzCache { double sl, nl, sf, sf2, sf3, th, spn, sph, spw, sfm, sdr, npn, nw, lpc, hpc, ntn, ng, tc, nd, nrp; };

class Voice {
public:
  Shared& E; int vindex;
  double s1[8] = {}, s2[8] = {}, ks;
  bool active = false, gate = false, pfresh = true; int note = 60; double noteCur = 60, vel = 1; int age = 0, serial = 0;
  Env env[16]; Lfo elfo[16], lfo[4]; Env sen[8]; double senV[8] = {}, senP[8] = {};
  double sv[kNumSrc] = {};
  double ph[6][8] = {}, inc[6][8] = {}, gl[6][8] = {}, gr[6][8] = {}, spos[6][8] = {}; int nU[6] = {1, 1, 1, 1, 1, 1};
  double last[8] = {}, fbs[6] = {}, oh[6][256] = {}; int ow[6][8] = {};
  double diveT[6] = {};
  Grain grains[6][24]; int ngr[6] = {}; double gacc[6] = {};
  double subph = 0, subph2 = .31, subph3 = .67, punch = 0, rnd = 0;
  NzState nzS[2];
  VFilt flt[8][2];
  double ev = 0, evP = 0, envV[16] = {}, envP[16] = {};
  double kf = 1, kfd = 0; double fade = 1;
  OscCache pc[6]; SubNzCache pcs{};
  struct Analog { double p[48] = {}, c[2] = {}, e = 0, dr[6] = {}, dt[6] = {}; } an; bool hasAn = false;
  double jps[24] = {};
  double acc[kNumParams]; bool accSet[kNumParams]; int accList[256]; int nAcc = 0;
  double tmp[2] = {};

  Voice(Shared& e, int i) : E(e), vindex(i) { ks = 1 - std::exp(-1 / (e.sr * .00035)); std::memset(acc, 0, sizeof acc); std::memset(accSet, 0, sizeof accSet); }

  void start(int n, double v, bool retrig) {
    const Idx& I = idx_(); active = true; gate = true; note = n; vel = v; age = 0; serial = ++E.serial;
    if (retrig) {
      noteCur = (E.hasGlide && E.pv[I.glide] > 0) ? E.glideFrom : n;
      if (env[0].st == 0) { std::memset(s1, 0, sizeof s1); std::memset(s2, 0, sizeof s2); }
      for (auto& e : env) e.on(); for (auto& e : sen) e.on();
      for (int i = 0; i < 4; i++) lfo[i].start(E.pv[I.lfo[i].ph]);
      for (int i = 0; i < 16; i++) elfo[i].start(E.pv[I.env[i].lph]);
      for (int j = 0; j < 48; j++) an.p[j] = gRng.bi(); an.c[0] = gRng.bi(); an.c[1] = gRng.bi(); an.e = gRng.bi(); for (int j = 0; j < 6; j++) { an.dt[j] = gRng.bi(); an.dr[j] = an.dt[j]; } hasAn = true;
      rnd = gRng.bi(); punch = 1; if (E.pv[I.srs]) { subph = 0; subph2 = .31; subph3 = .67; }
      for (int o = 0; o < 6; o++) {
        const OscIdx& x = I.osc[o]; const double rn = E.pv[x.rnd], p0 = E.pv[x.ph];
        for (int u = 0; u < 8; u++) { ph[o][u] = std::fmod(p0 + gRng.next() * rn, 1.0); spos[o][u] = 0; }
        diveT[o] = 0; ngr[o] = 0;
      }
    } else { for (auto& e : env) if (e.st == 5) e.on(); }
    fade = 0; pfresh = true; kf = 1; kfd = 0;
  }
  double sg(int q, double x) { double* a = s1; double* b = s2; a[q] += (x - a[q]) * ks; b[q] += (a[q] - b[q]) * ks; return b[q]; }
  void fadeKill(double ms) { if (!active) return; kfd = 1 / std::max(1.0, E.sr * (ms > 0 ? ms : 6) / 1000); if (!kf) kf = 1; }
  void release() { gate = false; for (auto& e : env) e.off(); for (auto& e : sen) e.off(); }
  void kill() {
    std::memset(jps, 0, sizeof jps); active = false; gate = false; kfd = 0; kf = 1;
    for (auto& e : env) { e.st = 0; e.v = 0; e.rf = 0; } for (auto& e : sen) { e.st = 0; e.v = 0; }
    for (auto& f : flt) { f[0].reset(); f[1].reset(); } std::memset(last, 0, sizeof last);
  }
  double oscS(int o, const OscCache& c, double p, double msrc) {
    double q = p;
    if (c.mm == 1) q += c.mai * msrc * .8;
    if (c.fb > 0) q += c.fbi * fbs[o] * .5;
    q -= std::floor(q);
    if (c.w1 >= 1 && c.w1 <= 8) q = wph(c.w1, c.a1i, q);
    if (c.w2 >= 1 && c.w2 <= 8) q = wph(c.w2, c.a2i, q);
    double s = tableRead(o, q);
    if (c.w1 >= 9) s = wamp(c.w1, c.a1i, s, q);
    if (c.w2 >= 9) s = wamp(c.w2, c.a2i, s, q);
    if (c.mm == 2) s *= (1 - c.mai) + c.mai * (msrc * .5 + .5); else if (c.mm == 3) s *= (1 - c.ma) + c.mai * msrc;
    return s;
  }
  bool control(int n);
  void render(int n);
  double tableRead(int o, double p) {
    const OscCache& c = pc[o]; const Table* T = E.tab[o]; if (!T) return 0;
    const int maxH = std::max(1, (int)std::floor(E.sr * .5 / c.fmax)); int m = 0; if (maxH < 1024) m = std::min(10, (int)std::ceil(std::log2(1024.0 / maxH)));
    const double fi = c.pi * (kTableFrames - 1); const int f0 = std::min(kTableFrames - 1, (int)fi), f1 = std::min(kTableFrames - 1, f0 + 1); const double ff = fi - f0;
    const double ix = p * 2048; const int i0 = (int)ix; const double fq = ix - i0;
    const float* A = T->frame(m, f0); const float* B = T->frame(m, f1);
    const double a = A[i0] + (A[i0 + 1] - A[i0]) * fq, b = B[i0] + (B[i0 + 1] - B[i0]) * fq; return a + (b - a) * ff;
  }
  double nzGen(NzState& S, int nt, const SubNzCache& c, double sr) {
    const double w = gRng.bi(); double x = 0;
    switch (nt) {
      case 0: x = w; break;
      case 1: S.a = .97 * S.a + .03 * w; S.b = .9 * S.b + .1 * S.a; x = (S.a + S.b) * 3; break;
      case 2: S.c = (S.c + .02 * w) / 1.02; x = S.c * 14; break;
      case 3: x = gRng.next() < .002 + .04 * c.nd ? w * 2 : 0; break;
      case 4: x = (w - S.pw) * .7; S.pw = w; break;
      case 5: { const double d = w - S.pw; x = (d - S.pd) * .5; S.pd = d; S.pw = w; break; }
      case 6: x = gRng.next() < .001 + .03 * c.nd ? (gRng.next() < .5 ? -1 : 1) * (1 + gRng.next()) * 1.5 : 0; break;
      case 7: if (--S.cnt <= 0) { S.sh = w; S.cnt = std::max(1.0, c.nrp); } x = S.sh; break;
      case 8: S.a = .97 * S.a + .03 * w; x = S.a * 1.2 + (gRng.next() < .0008 + .02 * c.nd ? w * 3 : 0); break;
      default: S.a = .97 * S.a + .03 * w; S.b = .9 * S.b + .1 * S.a; S.gp += kTau * .31 / sr; if (S.gp > kTau) S.gp -= kTau; x = (S.a + S.b) * 3 * (.45 + .55 * std::sin(S.gp) * std::sin(S.gp * .37 + 1));
    }
    if (c.lpc > 0) { S.lp1 += c.lpc * (x - S.lp1); S.lp2 += c.lpc * (S.lp1 - S.lp2); x = S.lp2; }
    if (c.hpc > 0) { S.hp1 += c.hpc * (x - S.hp1); S.hp2 += c.hpc * (x - S.hp1 - S.hp2); x = x - S.hp1 - S.hp2; }
    if (c.ntn > 0.001) { const double g = c.ng, q = .04; S.v1 += g * S.v2; const double hi = x - S.v1 - q * S.v2; S.v2 += g * hi; if (!std::isfinite(S.v2)) { S.v1 = 0; S.v2 = 0; } x = x * (1 - c.ntn) + S.v2 * c.tc * c.ntn; }
    return x;
  }
private:
  static const Idx& idx_() { return idx(); }
};

inline bool Voice::control(int n) {
  const Idx& I = idx(); const double sr = E.sr, dt = n / sr;
  // modulation accumulation (sources are the values of the previous block, like the JS engine)
  for (int i = 0; i < nAcc; i++) { accSet[accList[i]] = false; acc[accList[i]] = 0; } nAcc = 0;
  for (int i = 0; i < E.nSlots; i++) {
    const Slot& s = E.slots[i]; if (s.dst < 0) continue;
    double v = (s.src >= S_L1 && s.src < S_L1 + 4 && E.pv[I.lfo[s.src - S_L1].mode] == 1) ? E.gl[s.src - S_L1] : sv[s.src];
    if (s.uni) v = (v + 1) * .5;
    if (!accSet[s.dst]) { accSet[s.dst] = true; acc[s.dst] = 0; if (nAcc < 256) accList[nAcc++] = s.dst; }
    acc[s.dst] += v * s.amt;
  }
  auto R = [&](int k) -> double { return accSet[k] ? fromNorm(k, E.bn[k] + acc[k]) : E.pv[k]; };
  const double* pv = E.pv;
  const double gld = pv[I.glide];
  if (gld > 0) noteCur += (note - noteCur) * (1 - std::exp(-dt * 1000 / gld)); else noteCur = note;
  double anl = 0; for (int j = 0; j < 6; j++) if (pv[I.osc[j].on] && pv[I.osc[j].anl] > anl) anl = pv[I.osc[j].anl];
  const double aef = hasAn && anl > 0 ? 1 + anl * .05 * an.e : 1;
  if (hasAn && anl > 0) { const double k1 = std::min(1.0, dt / .7), pn = std::min(1.0, dt / 1.1); for (int j = 0; j < 6; j++) { if (gRng.next() < pn) an.dt[j] = gRng.bi(); an.dr[j] += (an.dt[j] - an.dr[j]) * k1; } }
  // envelopes and modulator slots
  for (int i = 0; i < 16; i++) {
    Env& e = env[i]; const EnvIdx& x = I.env[i]; const int md = (int)pv[x.mode];
    if (md >= 2 && i > 0) {
      const int sy = (int)pv[x.lsy]; const double rate = sy > 0 ? pv[I.bpm] / 60 / kSyncDiv[sy] : R(x.lr);
      static const int RS[9] = {5, 6, 8, 9, 10, 11, 12, 13, 14};
      const int sh = md == 2 ? (int)pv[x.lsh] : RS[(int)pv[x.rsh]];
      sv[S_E1 + i] = (elfo[i].tick(dt, rate, sh, R(x.lsm), R(x.lfd), E.custom[3 + i + 1 < 20 ? 3 + i + 1 : 0], 32) + 1) * .5; continue;
    }
    if (md == 1 && E.drawN[i] > 1)
      sv[S_E1 + i] = e.drawTick(dt, pv[x.sync] >= 1 ? 60000 / std::max(20.0, pv[I.bpm] > 0 ? pv[I.bpm] : 120.0) * kESyncB[(int)pv[x.sync]] : R(x.len), (int)pv[x.loop], R(x.ls), R(x.le), E.draw[i], E.drawN[i], R(x.r), R(x.slew));
    else
      sv[S_E1 + i] = e.tick(dt, R(x.a) * aef, R(x.h), R(x.d) * aef, R(x.s), R(x.r) * aef, R(x.ca), R(x.c));
  }
  // per-source envelopes
  for (int i = 0; i < 8; i++) { senP[i] = senV[i]; senV[i] = sen[i].tick(dt, R(I.srcEnv[i][0]), 0, R(I.srcEnv[i][1]), R(I.srcEnv[i][2]), R(I.srcEnv[i][3]), 0, -.4); }
  // lfos
  for (int i = 0; i < 4; i++) {
    const LfoIdx& x = I.lfo[i]; const double sync = R(x.sync); double rate = R(x.rate); if (sync > 0) rate = pv[I.bpm] / 60 / kSyncDiv[(int)sync];
    if (pv[x.mode] == 1) sv[S_L1 + i] = E.gl[i]; else sv[S_L1 + i] = lfo[i].tick(dt, rate, (int)R(x.shape), R(x.sm), R(x.fade), E.custom[i], 32);
  }
  for (int i = 0; i < 8; i++) sv[S_M1 + i] = R(I.m[i]);
  sv[S_VEL] = vel; sv[S_KEY] = clampd((note - 36) / 60.0, 0, 1); sv[S_WHEEL] = E.wheel; sv[S_BEND] = E.bend; sv[S_AT] = E.at; sv[S_RND] = rnd;
  evP = ev; ev = env[0].v;
  for (int i = 0; i < 16; i++) { envP[i] = envV[i]; envV[i] = sv[S_E1 + i]; }
  // liveness
  bool alive = false;
  for (int i = 0; i < 8; i++) {
    const bool on = (i < 3 || i > 4) ? (i < 3 ? pv[I.osc[i].on] : pv[I.osc[i].on]) != 0 : (i == 3 ? pv[I.sub] != 0 : pv[I.nz] != 0);
    // sources: a b c sub nz d e f; osc index for d,e,f is 3,4,5
    const int oi = i < 3 ? i : i - 2; const bool on2 = (i == 3) ? pv[I.sub] != 0 : (i == 4) ? pv[I.nz] != 0 : pv[I.osc[oi].on] != 0; (void)on;
    if (!on2) continue;
    if (pv[I.srcEnv[i][5]]) { if (sen[i].st != 0) alive = true; } else if (env[(int)pv[I.srcEnv[i][4]] & 15].st != 0) alive = true;
  }
  if (!alive) { kill(); return false; }
  // oscillator control
  const double bend = E.bend * pv[I.bendr];
  for (int o = 0; o < 6; o++) {
    const OscIdx& x = I.osc[o]; if (!pv[x.on]) { nU[o] = 0; continue; }
    const double dv = R(x.dv), dtm = R(x.dt); diveT[o] += dt * 1000;
    const double diveSt = dv * std::exp(-diveT[o] / dtm * 3);
    const int eng = (int)pv[x.eng];
    const double base = noteCur + R(x.oct) * 12 + R(x.semi) + R(x.fine) / 100 + R(x.pit) + bend + diveSt;
    int nu = eng == 2 ? 1 : (int)pv[x.uv]; nu = std::max(1, nu); nU[o] = nu;
    const double ud = R(x.ud); const int us = (int)pv[x.us]; const double ub = R(x.ub), usp = R(x.usp);
    const double maxc = std::pow(ud, 1.6) * 120;
    double gsum = 0; double gg[8] = {};
    for (int u = 0; u < nu; u++) {
      const double xx = nu > 1 ? ((double)u / (nu - 1)) * 2 - 1 : 0; double cents = 0, semi = 0, gain = 1;
      static const int sm3[8] = {0, -12, 12, 0, 12, -12, 0, 12}, sm4[8] = {0, 7, 12, 0, 7, 12, 0, 7}, sm5[8] = {0, 3, 7, 12, 0, 3, 7, 12};
      if (us == 0) cents = xx * maxc;
      else if (us == 1) { cents = (xx > 0 ? 1 : xx < 0 ? -1 : 0) * std::pow(std::fabs(xx), 1.35) * maxc; const bool side = std::fabs(xx) > .01; gain = side ? .15 + .85 * ub : 1; }
      else if (us == 3) { semi = sm3[u]; cents = (u % 2 ? -1 : 1) * maxc * .12; }
      else if (us == 4) { semi = sm4[u]; cents = (u % 2 ? -1 : 1) * maxc * .12; }
      else if (us == 2) {
        if (u > 0 && nu > 1) { const double sx = nu > 2 ? (u - 1.0) / (nu - 2) * 5 : 2.5; const int i = std::min(4, (int)sx); const double f = sx - i, off = JPOFF[i] + (JPOFF[i + 1] - JPOFF[i]) * f;
          cents = 1200 * std::log2(std::max(.5, 1 + jpCurve(ud) * off)); gain = jpSide(ub) / jpCen(ub); }
      } else { semi = sm5[u]; cents = (u % 2 ? -1 : 1) * maxc * .12; }
      { const double oa = pv[x.anl]; if (oa > 0 && hasAn) cents += oa * (5 * an.p[o * 8 + u] + 3 * an.dr[o]); }
      inc[o][u] = mtof(base + semi + cents / 100) / sr;
      gg[u] = gain; gsum += gain * gain;
      const double xp = us == 2 ? (u == 0 || nu < 2 ? 0 : (nu > 2 ? ((u - 1.0) / (nu - 2)) * 2 - 1 : 0)) : xx;
      const double pan = clampd(xp * usp, -1, 1) * .5 + .5;
      const double pp = clampd(R(x.pan) * .5 + .5 + (pan - .5) * 0.999, 0, 1);
      gl[o][u] = std::cos(pp * kPi / 2); gr[o][u] = std::sin(pp * kPi / 2);
    }
    const double nrm = 1 / std::sqrt(gsum > 0 ? gsum : 1);
    for (int u = 0; u < nu; u++) { gl[o][u] *= gg[u] * nrm; gr[o][u] *= gg[u] * nrm; }
    OscCache& c = pc[o];
    c.posP = c.pos; c.w1aP = c.w1a; c.w2aP = c.w2a; c.maP = c.ma; c.fbP = c.fb; c.lvlP = c.lvl;
    c.pos = R(x.pos); c.w1 = (int)pv[x.w1]; c.w1a = R(x.w1a); c.w2 = (int)pv[x.w2]; c.w2a = R(x.w2a); c.lvl = R(x.lvl);
    c.mm = (int)pv[x.mm]; c.ms = (int)pv[x.ms]; c.ma = R(x.ma); c.fb = R(x.fb); c.eng = eng;
    c.os = eng == 0 && ((c.w1 > 0 && c.w1a > 0) || (c.w2 > 0 && c.w2a > 0) || (c.mm > 0 && c.ma > 0) || c.fb > 0);
    if (!c.init || pfresh) { c.posP = c.pos; c.w1aP = c.w1a; c.w2aP = c.w2a; c.maP = c.ma; c.fbP = c.fb; c.lvlP = c.lvl; c.init = true; }
    double fm = 0; for (int u = 0; u < nu; u++) fm = std::max(fm, inc[o][u] * sr); c.fmax = fm;
    c.jp = eng == 0 && us == 2 && nu > 1; if (c.jp) { const double fh = std::min(.45 * sr, mtof(base)); c.jg = std::tan(kPi * fh / sr); }
    c.gp = R(x.gp); c.gs = R(x.gs); c.gd = R(x.gd); c.gj = pv[x.gj]; c.root = pv[x.sroot]; c.loop = (int)pv[x.sloop]; c.pr = std::pow(2.0, (base - c.root) / 12);
  }
  // filters
  const double keyOct = (note - 60) / 12.0;
  for (int f = 0; f < 2; f++) {
    const FiltIdx& x = I.filt[f]; const int es = (int)pv[x.es]; const double envv = es ? sv[S_E1 + es - 1] : 0; const int type = (int)pv[x.type];
    const double fc = std::min(20000.0, R(x.cut) * std::pow(2.0, keyOct * pv[x.kt] + 5 * R(x.env) * envv) * (anl > 0 && hasAn ? 1 + anl * .03 * an.c[f] : 1));
    const double res = R(x.res), drv = R(x.drv), mix = R(x.mix), sh = R(x.sh); const int dm = (int)pv[x.dm];
    for (int s = 0; s < 8; s++) flt[s][f].set(type, fc, res, drv, mix, sr, sh, dm, n);
  }
  // sub and noise
  {
    const int kt = (int)pv[I.skt]; const double th = R(I.sth);
    const double f0 = kt ? mtof(noteCur + pv[I.so] * 12 + bend + R(I.sfn) / 100) : R(I.sfh) * std::pow(2.0, R(I.sfn) / 1200);
    const double nlp = R(I.nlp), nhp = R(I.nhp); const double nf = std::min(.45, mtof(noteCur + bend) / sr);
    SubNzCache& p = pcs; p.sl = R(I.sl); p.nl = R(I.nl); p.sf = f0 / sr; p.sf2 = f0 * std::pow(2.0, th * 25 / 1200) / sr; p.sf3 = f0 * std::pow(2.0, -th * 25 / 1200) / sr; p.th = th;
    p.spn = R(I.spn); p.sph = R(I.sph); p.spw = R(I.spw); p.sfm = R(I.sfm); p.sdr = R(I.sdr);
    p.npn = R(I.npn); p.nw = R(I.nw); p.lpc = nlp >= 19000 ? 0 : 1 - std::exp(-kTau * nlp / sr); p.hpc = nhp <= 25 ? 0 : 1 - std::exp(-kTau * nhp / sr);
    p.ntn = R(I.ntn); p.ng = 2 * std::sin(kPi * nf); p.tc = .25 / std::sqrt(std::max(1e-5, 2 * std::sin(kPi * nf) * .04)); p.nd = R(I.nd); p.nrp = sr / R(I.nr);
  }
  return true;
}

inline void Voice::render(int n) {
  pfresh = false; if (kfd && kf <= 0) { kill(); return; }
  const Idx& I = idx(); const double* pv = E.pv; const double sr = E.sr; const SubNzCache& P = pcs;
  const double velg = (1 - pv[I.vel]) + pv[I.vel] * vel;
  static const int SLOT[6] = {0, 1, 2, 5, 6, 7}, MSL[7] = {0, 1, 2, 3, 5, 6, 7}, TKOF[8] = {0, 1, 2, 3, 3, 0, 1, 2};
  int rt[8] = {(int)pv[I.osc[0].rt], (int)pv[I.osc[1].rt], (int)pv[I.osc[2].rt], (int)pv[I.srt_], (int)pv[I.srtn], (int)pv[I.osc[3].rt], (int)pv[I.osc[4].rt], (int)pv[I.osc[5].rt]};
  bool eo[8]; int eIdx[8];
  for (int q = 0; q < 8; q++) { eo[q] = pv[I.srcEnv[q][5]] != 0; eIdx[q] = (int)pv[I.srcEnv[q][4]] & 15; }
  const bool serial_ = pv[I.frt] == 0; double out[2], o2[2]; double evS[8];
  const double e1a = evP, e1b = ev;
  const auto& FIR = fir4();
  for (int i = 0; i < n; i++) {
    const double t = (double)i / n;
    const double evi = (e1a + (e1b - e1a) * t) * velg; (void)evi;
    for (int q = 0; q < 8; q++) { const int ix = eIdx[q]; evS[q] = (envP[ix] + (envV[ix] - envP[ix]) * t) * velg; }
    double outL[8] = {}, outR[8] = {};
    for (int o = 0; o < 6; o++) {
      const int nu = nU[o]; if (nu == 0) continue; const int sl_ = SLOT[o]; OscCache& c = pc[o];
      c.pi = c.posP + (c.pos - c.posP) * t; c.a1i = c.w1aP + (c.w1a - c.w1aP) * t; c.a2i = c.w2aP + (c.w2a - c.w2aP) * t; c.mai = c.maP + (c.ma - c.maP) * t; c.fbi = c.fbP + (c.fb - c.fbP) * t; c.lvi = c.lvlP + (c.lvl - c.lvlP) * t;
      double sumL = 0, sumR = 0; double* phh = ph[o]; double* inc_ = inc[o]; double* gL = gl[o]; double* gR = gr[o];
      const double msrc = c.mm > 0 ? last[MSL[c.ms]] : 0;
      if (c.eng == 0 && c.os) {
        double* H = oh[o]; int* W = ow[o];
        for (int u = 0; u < nu; u++) {
          double p = phh[u] + inc_[u]; if (p >= 1) p -= 1; phh[u] = p;
          const int b = u * 32; int w = W[u];
          for (int k = 3; k >= 0; k--) { double pk = p - inc_[u] * k * .25; if (pk < 0) pk += 1; H[b + w] = oscS(o, c, pk, msrc); w = (w + 1) & 31; }
          W[u] = w; double sm = 0; for (int j = 0; j < 31; j++) sm += FIR[j] * H[b + ((w - 1 - j) & 31)];
          sumL += sm * gL[u]; sumR += sm * gR[u];
        }
        fbs[o] = (sumL + sumR) * .5;
      } else if (c.eng == 0) {
        for (int u = 0; u < nu; u++) {
          double p = phh[u] + inc_[u]; if (p >= 1) p -= 1; phh[u] = p; double q = p;
          if (c.mm == 1) q += c.mai * msrc * .8;
          if (c.fb > 0) q += c.fbi * fbs[o] * .5;
          q -= std::floor(q);
          if (c.w1 >= 1 && c.w1 <= 8) q = wph(c.w1, c.a1i, q);
          if (c.w2 >= 1 && c.w2 <= 8) q = wph(c.w2, c.a2i, q);
          double s = tableRead(o, q);
          if (c.w1 >= 9) s = wamp(c.w1, c.a1i, s, q);
          if (c.w2 >= 9) s = wamp(c.w2, c.a2i, s, q);
          if (c.mm == 2) s *= (1 - c.mai) + c.mai * (msrc * .5 + .5); else if (c.mm == 3) s *= (1 - c.ma) + c.mai * msrc;
          sumL += s * gL[u]; sumR += s * gR[u];
        }
        fbs[o] = (sumL + sumR) * .5;
      } else if (c.eng == 1) {
        const Sample* buf = E.smp[o];
        if (buf && !buf->d.empty()) {
          const int bl = (int)buf->d.size(); const double rate = buf->sr / sr;
          for (int u = 0; u < nu; u++) {
            double pos = spos[o][u]; const double stepR = (inc_[u] * sr / mtof(c.root)) * rate;
            pos += stepR; if (c.loop && pos >= bl) pos -= bl * std::floor(pos / bl); else if (pos >= bl - 1) pos = bl - 1;
            spos[o][u] = pos; const int i0 = (int)pos; const double fq = pos - i0, s = buf->d[i0] * (1 - fq) + buf->d[std::min(bl - 1, i0 + 1)] * fq;
            sumL += s * gL[u]; sumR += s * gR[u];
          }
        }
      } else {
        const Sample* buf = E.smp[o];
        if (buf && buf->d.size() > 2) {
          const int bl = (int)buf->d.size(); Grain* G_ = grains[o]; int& ng = ngr[o];
          gacc[o] += c.gd / sr;
          while (gacc[o] >= 1 && ng < 24) { gacc[o] -= 1; G_[ng++] = Grain{clampd(c.gp + gRng.bi() * c.gj * .5, 0, 1) * (bl - 1), 0, c.gs * .001 * sr, gRng.bi(), c.pr * buf->sr / sr}; }
          if (gacc[o] >= 1) gacc[o] = 0;
          for (int g = ng - 1; g >= 0; g--) {
            Grain& gr_ = G_[g]; if (gr_.age >= gr_.len) { G_[g] = G_[--ng]; continue; }
            const double w = .5 - .5 * std::cos(kTau * gr_.age / gr_.len); gr_.pos += gr_.rate; if (gr_.pos >= bl - 1) gr_.pos -= bl - 1;
            const int i0 = (int)gr_.pos; const double fq = gr_.pos - i0, s = (buf->d[i0] * (1 - fq) + buf->d[i0 + 1] * fq) * w * .5; gr_.age++;
            const double pp = gr_.pan * .5 + .5; sumL += s * std::cos(pp * kPi / 2) * 1.4; sumR += s * std::sin(pp * kPi / 2) * 1.4;
          }
        }
      }
      if (c.jp) {
        double* S = jps; const int b = o * 4; const double g = c.jg, dn = 1 / (1 + kSqrt2 * g + g * g);
        double hp = (sumL - (kSqrt2 + g) * S[b] - S[b + 1]) * dn, bp = g * hp + S[b]; S[b] = g * hp + bp; S[b + 1] += 2 * g * bp; sumL = hp;
        hp = (sumR - (kSqrt2 + g) * S[b + 2] - S[b + 3]) * dn; bp = g * hp + S[b + 2]; S[b + 2] = g * hp + bp; S[b + 3] += 2 * g * bp; sumR = hp;
      }
      double amp = c.lvi * .5; const double own = senP[sl_] + (senV[sl_] - senP[sl_]) * t;
      amp *= sg(sl_, eo[sl_] ? own : own * evS[sl_]);
      if (eo[sl_]) amp *= velg;
      outL[sl_] = sumL * amp; outR[sl_] = sumR * amp; last[sl_] = (sumL + sumR) * .5;
    }
    // sub
    if (pv[I.sub]) {
      const double dt1 = P.sf; subph += dt1; if (subph >= 1) subph -= 1;
      const int w = (int)pv[I.sw]; const double th = P.th, fmv = P.sfm * last[0] * .3, pwv = w == 2 ? .5 : P.spw;
      const double s1_ = subWave(w, std::fmod(subph + P.sph + fmv + 4, 1.0), dt1, pwv); double sL = s1_, sR = s1_;
      if (th > 0.001) { subph2 += P.sf2; if (subph2 >= 1) subph2 -= 1; subph3 += P.sf3; if (subph3 >= 1) subph3 -= 1;
        const double g = th * .7, nm = 1 / (1 + g); sL = (s1_ + g * subWave(w, std::fmod(subph2 + P.sph + fmv + 4, 1.0), P.sf2, pwv)) * nm; sR = (s1_ + g * subWave(w, std::fmod(subph3 + P.sph + fmv + 4, 1.0), P.sf3, pwv)) * nm; }
      if (P.sdr > 0.001) { const double k = 1 + P.sdr * 6, nk = 1 / std::tanh(k); sL = std::tanh(sL * k) * nk; sR = std::tanh(sR * k) * nk; }
      const double own = senP[3] + (senV[3] - senP[3]) * t; const double amp = P.sl * .7 * (eo[3] ? own * velg : sg(3, own * evS[3]));
      const double pn = P.spn, gl_ = pn > 0 ? 1 - pn : 1, gr_ = pn < 0 ? 1 + pn : 1;
      outL[3] = sL * amp * gl_; outR[3] = sR * amp * gr_; last[3] = (sL + sR) * .5;
    }
    if (pv[I.nz]) {
      const int nt = (int)pv[I.nt]; double xl = nzGen(nzS[0], nt, P, sr), xr = xl;
      if (P.nw > 0.001) { const double x2 = nzGen(nzS[1], nt, P, sr); xr = xl * (1 - P.nw) + x2 * P.nw; }
      if (punch > 0) { const double pk = std::sin(kTau * punch * 40) * pv[I.pk] * punch * 1.5; xl += pk; xr += pk; punch = std::max(0.0, punch - 1 / (sr * .012)); }
      const double own = senP[4] + (senV[4] - senP[4]) * t; const double amp = P.nl * .5 * (eo[4] ? own * velg : sg(4, own * evS[4]));
      const double pn = P.npn, gl_ = pn > 0 ? 1 - pn : 1, gr_ = pn < 0 ? 1 + pn : 1;
      outL[4] = xl * amp * gl_; outR[4] = xr * amp * gr_;
    }
    // filters and routing
    double kg = 1; if (kfd) { kf = std::max(0.0, kf - kfd); kg = kf * kf; }
    for (int s = 0; s < 8; s++) {
      double l = outL[s], r = outR[s];
      if (l == 0 && r == 0 && s >= 3) continue;
      const int rr = rt[s];
      if (rr != 0) {
        VFilt& f1 = flt[s][0]; VFilt& f2 = flt[s][1];
        if (rr == 1) { f1.proc(l, r, out); l = out[0]; r = out[1]; }
        else if (rr == 2) { f2.proc(l, r, out); l = out[0]; r = out[1]; }
        else if (serial_) { f1.proc(l, r, out); f2.proc(out[0], out[1], o2); l = o2[0]; r = o2[1]; }
        else { f1.proc(l, r, out); const double a = out[0], b = out[1]; f2.proc(l, r, out); l = (a + out[0]) * .707; r = (b + out[1]) * .707; }
      }
      Track& T = E.tk[TKOF[s]]; T.l[i] += (float)(l * kg); T.r[i] += (float)(r * kg);
    }
  }
}
} // namespace whisker
