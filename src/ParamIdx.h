// Name to index lookup for the generated parameter table, plus per-section index structs.
#pragma once
#include "ParamTable.h"
#include <string>
#include <unordered_map>
namespace whisker {
inline int pidx(const std::string& key) {
  static const std::unordered_map<std::string, int> m = [] { std::unordered_map<std::string, int> r; for (int i = 0; i < kNumParams; i++) r[kParams[i].key] = i; return r; }();
  auto it = m.find(key); return it == m.end() ? -1 : it->second;
}
struct OscIdx { int on, eng, pos, w1, w1a, w2, w2a, sw, sk, oct, semi, fine, lvl, pan, ph, rnd, uv, ud, us, ub, usp, anl, mm, ms, ma, dv, dt, fb, rt, sroot, sloop, gp, gs, gd, gj, pit, ea, ed, es, er, env, eo; };
struct EnvIdx { int a, h, d, s, r, c, ca, mode, lr, lsy, lsh, rsh, lph, lsm, lfd, len, sync, loop, ls, le, slew; };
struct LfoIdx { int shape, rate, sync, ph, fade, mode, sm; };
struct FiltIdx { int type, cut, res, drv, kt, env, es, mix, sh, dm; };
struct Idx {
  OscIdx osc[6]; EnvIdx env[16]; LfoIdx lfo[4]; FiltIdx filt[2];
  int srcEnv[8][6];            // ea ed es er env eo for a b c sub nz d e f order
  int sub, sw, so, sl, nz, nt, nl, pk, sfn, spn, sph, spw, sth, sfm, sdr, skt, sfh, srs, srt_, srtn, npn, nw, nhp, nlp, ntn, nd, nr;
  int master, poly, vmode, glide, bendr, bpm, vel, lim, ceil, frt, m[8];
  int arpOn, arpMode, arpRate, arpOct, arpGate, arpSwing, arpHold;
  int busVol[7], busPan[7], busS1[4], busS2[4], busDest[4]; // t0..t3, x1, x2, fx, mst
};
inline const Idx& idx() {
  static const Idx I = [] {
    Idx r{}; const char* O = "abcdef"; const char* S[8] = {"a", "b", "c", "sub", "nz", "d", "e", "f"};
    for (int o = 0; o < 6; o++) {
      const std::string k = std::string(1, O[o]) + "."; OscIdx& x = r.osc[o];
      #define G(n) x.n = pidx(k + #n);
      G(on) G(eng) G(pos) G(w1) G(w1a) G(w2) G(w2a) G(sw) G(sk) G(oct) G(semi) G(fine) G(lvl) G(pan) G(ph) G(rnd) G(uv) G(ud) G(us) G(ub) G(usp) G(anl) G(mm) G(ms) G(ma) G(dv) G(dt) G(fb) G(rt) G(sroot) G(sloop) G(gp) G(gs) G(gd) G(gj) G(pit) G(ea) G(ed) G(es) G(er) G(env) G(eo)
      #undef G
    }
    for (int i = 0; i < 16; i++) {
      const std::string k = "e" + std::to_string(i + 1) + "."; EnvIdx& x = r.env[i];
      x.a = pidx(k + "a"); x.h = pidx(k + "h"); x.d = pidx(k + "d"); x.s = pidx(k + "s"); x.r = pidx(k + "r"); x.c = pidx(k + "c"); x.ca = pidx(k + "ca"); x.mode = pidx(k + "mode");
      x.lr = pidx(k + "lr"); x.lsy = pidx(k + "lsy"); x.lsh = pidx(k + "lsh"); x.rsh = pidx(k + "rsh"); x.lph = pidx(k + "lph"); x.lsm = pidx(k + "lsm"); x.lfd = pidx(k + "lfd");
      x.len = pidx(k + "len"); x.sync = pidx(k + "sync"); x.loop = pidx(k + "loop"); x.ls = pidx(k + "ls"); x.le = pidx(k + "le"); x.slew = pidx(k + "slew");
    }
    for (int i = 0; i < 4; i++) { const std::string k = "l" + std::to_string(i + 1) + "."; LfoIdx& x = r.lfo[i]; x.shape = pidx(k + "shape"); x.rate = pidx(k + "rate"); x.sync = pidx(k + "sync"); x.ph = pidx(k + "ph"); x.fade = pidx(k + "fade"); x.mode = pidx(k + "mode"); x.sm = pidx(k + "sm"); }
    for (int f = 0; f < 2; f++) { const std::string k = "f" + std::to_string(f + 1) + "."; FiltIdx& x = r.filt[f]; x.type = pidx(k + "type"); x.cut = pidx(k + "cut"); x.res = pidx(k + "res"); x.drv = pidx(k + "drv"); x.kt = pidx(k + "kt"); x.env = pidx(k + "env"); x.es = pidx(k + "es"); x.mix = pidx(k + "mix"); x.sh = pidx(k + "sh"); x.dm = pidx(k + "dm"); }
    for (int i = 0; i < 8; i++) { const std::string k = std::string(S[i]) + "."; r.srcEnv[i][0] = pidx(k + "ea"); r.srcEnv[i][1] = pidx(k + "ed"); r.srcEnv[i][2] = pidx(k + "es"); r.srcEnv[i][3] = pidx(k + "er"); r.srcEnv[i][4] = pidx(k + "env"); r.srcEnv[i][5] = pidx(k + "eo"); }
    #define S(n) r.n = pidx(std::string("s.") + #n);
    S(sub) S(sw) S(so) S(sl) S(nz) S(nt) S(nl) S(pk) S(sfn) S(spn) S(sph) S(spw) S(sth) S(sfm) S(sdr) S(skt) S(sfh) S(srs) S(npn) S(nw) S(nhp) S(nlp) S(ntn) S(nd) S(nr)
    #undef S
    r.srt_ = pidx("s.srt"); r.srtn = pidx("s.rt");
    r.master = pidx("master"); r.poly = pidx("poly"); r.vmode = pidx("vmode"); r.glide = pidx("glide"); r.bendr = pidx("bendr"); r.bpm = pidx("bpm"); r.vel = pidx("vel"); r.lim = pidx("lim"); r.ceil = pidx("ceil"); r.frt = pidx("frt");
    for (int i = 0; i < 8; i++) r.m[i] = pidx("m" + std::to_string(i + 1));
    r.arpOn = pidx("arp.on"); r.arpMode = pidx("arp.mode"); r.arpRate = pidx("arp.rate"); r.arpOct = pidx("arp.oct"); r.arpGate = pidx("arp.gate"); r.arpSwing = pidx("arp.swing"); r.arpHold = pidx("arp.hold");
    const char* B[7] = {"t0", "t1", "t2", "t3", "x1", "x2", "fx"};
    for (int i = 0; i < 7; i++) { r.busVol[i] = pidx(std::string("bus.") + B[i] + ".vol"); r.busPan[i] = pidx(std::string("bus.") + B[i] + ".pan"); }
    for (int i = 0; i < 4; i++) { r.busS1[i] = pidx(std::string("bus.t") + std::to_string(i) + ".s1"); r.busS2[i] = pidx(std::string("bus.t") + std::to_string(i) + ".s2"); r.busDest[i] = pidx(std::string("bus.t") + std::to_string(i) + ".dest"); }
    return r;
  }();
  return I;
}
} // namespace whisker
