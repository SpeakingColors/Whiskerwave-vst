// Engine: voices, mono/legato/poly, arp, global LFOs, tracks, buses and master limiter (port of Engine in dsp3d.js).
// Audio thread only; the processor feeds it through Engine::noteOn/noteOff/setSmooth and friends.
#pragma once
#include "Voice.h"
#include "Limiter.h"
#include <memory>
namespace whisker {
struct ArpSeq { int len = 16; double on[16], vel[16], semi[16], rat[16]; ArpSeq() { for (int i = 0; i < 16; i++) { on[i] = 1; vel[i] = 1; semi[i] = 0; rat[i] = 1; } } };
using ChainFn = void (*)(void* ctx, int chain, float* L, float* R, int n, int depth);

class Engine {
public:
  Shared S; std::unique_ptr<Voice> voices[kMaxVoices];
  Lfo glfo[4]; ArpSeq seq;
  double beat = 0; int nHeldDown = 0;
  struct Note { int n; double v; };
  Note held[64]; int nHeld = 0; Note mstack[64]; int nMstack = 0;
  struct Ev { double t; int on; int n; double v; };
  Ev evq[256]; int nEv = 0;
  int64_t nextStepI = 0; double nextStep = 0; int64_t si = 0; bool arpWas = false;
  double lastVel = .6, lastKey = .5, lastRnd = 0, lastNote = 60, curPitch = 60;
  struct Sm { int k = -1; double n = 0, d = 0, v = 0; int left = 0; }; Sm psm[64];
  float ml[kBlock], mr[kBlock]; Track aux[2], mst, fxo;
  struct Meter { double l = 0, r = 0; }; Meter meter[11]; double limGR = 0;
  float scope[2048] = {}; int sp = 0;
  double bgL[8] = {}, bgR[8] = {}; bool bgInit[8] = {};
  std::unique_ptr<LookLim> mlim;
  ChainFn chainFn = nullptr; void* chainCtx = nullptr; void (*preFn)(void*) = nullptr;
  double wheelT = 0, bendT = 0, atT = 0;

  explicit Engine(double sr) { S.sr = sr; for (int i = 0; i < kMaxVoices; i++) voices[i] = std::make_unique<Voice>(S, i); mlim = std::make_unique<LookLim>(sr); }
  void setSampleRate(double sr) { S.sr = sr; for (auto& v : voices) v->ks = 1 - std::exp(-1 / (sr * .00035)); mlim = std::make_unique<LookLim>(sr); }
  const Idx& I() const { return idx(); }
  double pv(int k) const { return S.pv[k]; }
  void setParam(int k, double v) { S.setParam(k, v); }
  void setSmooth(int k, double v) {
    const ParamSpec& p = kParams[k];
    if (p.kind == PK::List || p.kind == PK::Int) { for (auto& m : psm) if (m.k == k) m.k = -1; setParam(k, v); return; }
    const double n0 = S.bn[k], n1 = toNorm(k, v); const int steps = std::max(1, (int)std::lround(S.sr * .015 / kBlock));
    if (std::fabs(n1 - n0) < 1e-9) { setParam(k, v); for (auto& m : psm) if (m.k == k) m.k = -1; return; }
    Sm* slot = nullptr; for (auto& m : psm) if (m.k == k) { slot = &m; break; } if (!slot) for (auto& m : psm) if (m.k < 0) { slot = &m; break; }
    if (!slot) { setParam(k, v); return; }
    slot->k = k; slot->n = n1; slot->d = (n1 - n0) / steps; slot->left = steps; slot->v = v;
  }
  // ---- voices
  Voice* alloc(int poly) {
    int live = 0; for (auto& v : voices) if (v->active && !v->kfd) live++;
    auto freeV = [&]() -> Voice* { for (auto& v : voices) if (!v->active) return v.get(); return nullptr; };
    if (live < poly) { if (Voice* f = freeV()) return f; }
    Voice* best = nullptr;
    for (auto& v : voices) { if (!v->active || v->kfd) continue; if (!v->gate && (!best || v->serial < best->serial)) best = v.get(); }
    if (!best) for (auto& v : voices) { if (!v->active || v->kfd) continue; if (!best || v->serial < best->serial) best = v.get(); }
    if (best) best->fadeKill(6);
    if (Voice* f = freeV()) return f;
    Voice* o = nullptr; for (auto& v : voices) if (v->kfd && (!o || v->kf < o->kf)) o = v.get();
    if (o) { o->kill(); return o; }
    if (best) { best->kill(); return best; }
    return voices[0].get();
  }
  void trigger(int note, double vel) {
    const Idx& ix = I(); const int mode = (int)pv(ix.vmode);
    lastVel = vel; lastKey = clampd((note - 36) / 60.0, 0, 1); lastNote = note; lastRnd = gRng.bi();
    if (mode == 0) {
      for (auto& x : voices) if (x->active && x->gate && x->note == note) { x->fadeKill(6); x->gate = false; break; }
      Voice* v = alloc((int)pv(ix.poly)); if (v->active) v->kill(); S.hasGlide = false; v->start(note, vel, true);
    } else {
      Voice* v = voices[0].get(); const bool leg = mode == 2 && v->active && v->gate;
      S.hasGlide = v->active; S.glideFrom = v->noteCur;
      int j = 0; for (int i = 0; i < nMstack; i++) if (mstack[i].n != note) mstack[j++] = mstack[i]; nMstack = j; if (nMstack < 64) mstack[nMstack++] = {note, vel};
      v->start(note, vel, !leg);
    }
  }
  void untrigger(int note) {
    const Idx& ix = I();
    if ((int)pv(ix.vmode) == 0) { for (auto& v : voices) if (v->active && v->gate && v->note == note) v->release(); return; }
    int j = 0; for (int i = 0; i < nMstack; i++) if (mstack[i].n != note) mstack[j++] = mstack[i]; nMstack = j;
    Voice* v = voices[0].get(); if (!v->active || !v->gate || v->note != note) return;
    if (nMstack) { const Note b = mstack[nMstack - 1]; S.hasGlide = true; S.glideFrom = v->noteCur; v->start(b.n, b.v, (int)pv(ix.vmode) == 1); } else v->release();
  }
  void noteOn(int note, double vel = .8) {
    const Idx& ix = I();
    if (pv(ix.arpOn) != 0) {
      if (pv(ix.arpHold) != 0 && nHeldDown == 0) nHeld = 0; nHeldDown++;
      int j = 0; for (int i = 0; i < nHeld; i++) if (held[i].n != note) held[j++] = held[i]; nHeld = j; if (nHeld < 64) held[nHeld++] = {note, vel}; return;
    }
    trigger(note, vel);
  }
  void noteOff(int note) {
    const Idx& ix = I();
    if (pv(ix.arpOn) != 0) { nHeldDown = std::max(0, nHeldDown - 1); if (pv(ix.arpHold) == 0) { int j = 0; for (int i = 0; i < nHeld; i++) if (held[i].n != note) held[j++] = held[i]; nHeld = j; } return; }
    untrigger(note);
  }
  void panic() { for (auto& v : voices) v->kill(); nHeld = 0; nMstack = 0; nEv = 0; nHeldDown = 0; }
  // ---- arp
  void tickArp(double bb) {
    const Idx& ix = I(); static const double DIV[6] = {1, .5, .25, .125, 1.0 / 3, 1.0 / 6}; const double div = DIV[(int)pv(ix.arpRate) % 6]; const double end = beat + bb;
    if (!arpWas) { arpWas = true; si = (int64_t)std::ceil(beat / div); nextStep = si * div; }
    while (nextStep < end) {
      const double t = nextStep;
      Note list[256]; int ln = 0; { Note base[64]; int bn = nHeld; for (int i = 0; i < nHeld; i++) base[i] = held[i];
        if ((int)pv(ix.arpMode) != 4) std::sort(base, base + bn, [](const Note& a, const Note& b) { return a.n < b.n; });
        const int oc = std::max(1, (int)pv(ix.arpOct)); for (int o = 0; o < oc; o++) for (int i = 0; i < bn && ln < 256; i++) list[ln++] = {base[i].n + 12 * o, base[i].v}; }
      if (ln) {
        const int L = seq.len, i = (int)(si % L), mode = (int)pv(ix.arpMode);
        if (seq.on[i] != 0) {
          const double swing = (si % 2) ? pv(ix.arpSwing) * div : 0; Note notes[256]; int nn = 0;
          if (mode == 5) { for (int k = 0; k < ln; k++) notes[nn++] = list[k]; }
          else { int idxn = (int)(si % ln);
            if (mode == 0 || mode == 4) idxn = (int)(si % ln); else if (mode == 1) idxn = ln - 1 - (int)(si % ln);
            else if (mode == 2) { const int per = std::max(1, 2 * ln - 2), p = (int)(si % per); idxn = p < ln ? p : per - p; } else idxn = (int)std::floor(gRng.next() * ln);
            notes[nn++] = list[idxn]; }
          const double r = seq.rat[i] ? seq.rat[i] : 1; const double sub = div / r, gl_ = sub * pv(ix.arpGate);
          for (int k = 0; k < (int)r; k++) for (int q = 0; q < nn; q++) {
            const int nnn = notes[q].n + (int)seq.semi[i]; const double v = clampd(notes[q].v * seq.vel[i], .05, 1), t0 = t + swing + k * sub;
            if (nEv < 254) { evq[nEv++] = {t0, 1, nnn, v}; evq[nEv++] = {t0 + gl_, 0, nnn, 0}; }
          }
        }
      }
      si++; nextStep = si * div;
    }
    std::stable_sort(evq, evq + nEv, [](const Ev& a, const Ev& b) { return a.t < b.t; });
    int k = 0; while (k < nEv && evq[k].t < end) { if (evq[k].on) trigger(evq[k].n, evq[k].v); else untrigger(evq[k].n); k++; }
    for (int i = k; i < nEv; i++) evq[i - k] = evq[i]; nEv -= k;
  }
  // ---- blocks
  void block(int m) {
    const Idx& ix = I(); const double sr = S.sr, dt = m / sr, bpm = pv(ix.bpm), bb = m * bpm / 60 / sr;
    for (auto& q : psm) { if (q.k < 0) continue; if (--q.left <= 0) { setParam(q.k, q.v); q.k = -1; } else { const double nn = S.bn[q.k] + q.d; S.bn[q.k] = nn; S.pv[q.k] = fromNorm(q.k, nn); } }
    { const double kk = 1 - std::exp(-dt / .008); S.wheel += (wheelT - S.wheel) * kk; S.bend += (bendT - S.bend) * kk; S.at += (atT - S.at) * kk; }
    if (pv(ix.arpOn) != 0) tickArp(bb);
    else if (arpWas) { arpWas = false; for (int i = 0; i < nEv; i++) if (!evq[i].on) untrigger(evq[i].n); nEv = 0; for (auto& v : voices) if (v->active && v->gate) v->release(); nHeld = 0; nHeldDown = 0; }
    for (int i = 0; i < 4; i++) { const LfoIdx& x = ix.lfo[i]; const int sy = (int)pv(x.sync); const double rate = sy > 0 ? bpm / 60 / kSyncDiv[sy] : pv(x.rate);
      S.gl[i] = glfo[i].tick(dt, rate, (int)pv(x.shape), pv(x.sm), pv(x.fade), S.custom[i], 32); }
    { const Voice* b = nullptr; for (auto& v : voices) if (v->active && !v->kfd && (!b || v->serial > b->serial)) b = v.get(); curPitch = (b ? b->noteCur : lastNote) + S.bend * pv(ix.bendr); } // pitch of the newest voice, for the Autotune and Vocoder FX
    if (preFn) preFn(chainCtx);
    for (int t = 0; t < 4; t++) { std::fill(S.tk[t].l, S.tk[t].l + m, 0.f); std::fill(S.tk[t].r, S.tk[t].r + m, 0.f); }
    for (auto& v : voices) if (v->active) { if (v->control(m)) v->render(m); }
    mixdown(m); beat += bb;
  }
  void swapG(int b, double tl, double tr, double& pl, double& pr) { if (!bgInit[b]) { bgL[b] = tl; bgR[b] = tr; bgInit[b] = true; } pl = bgL[b]; pr = bgR[b]; bgL[b] = tl; bgR[b] = tr; }
  void peak(int b, const float* L, const float* R, int m) { double pl = 0, pr = 0; for (int i = 0; i < m; i++) { pl = std::max(pl, (double)std::fabs(L[i])); pr = std::max(pr, (double)std::fabs(R[i])); } meter[b].l = std::max(meter[b].l * .92, pl); meter[b].r = std::max(meter[b].r * .92, pr); }
  void runChain(int c, float* L, float* R, int m) { if (chainFn) chainFn(chainCtx, c, L, R, m, 0); }
  void mixdown(int m) {
    const Idx& ix = I();
    std::fill(mst.l, mst.l + m, 0.f); std::fill(mst.r, mst.r + m, 0.f); std::fill(fxo.l, fxo.l + m, 0.f); std::fill(fxo.r, fxo.r + m, 0.f);
    for (auto& a : aux) { std::fill(a.l, a.l + m, 0.f); std::fill(a.r, a.r + m, 0.f); }
    auto gains = [&](int vi, int pi, double& tl, double& tr) { const double v = pv(vi), pn = pv(pi), tv = v <= -59.9 ? 0 : dbv(v); tl = tv * std::cos((pn * .5 + .5) * kPi / 2) * 1.414; tr = tv * std::sin((pn * .5 + .5) * kPi / 2) * 1.414; };
    for (int t = 0; t < 4; t++) {
      Track& tk = S.tk[t]; runChain(t, tk.l, tk.r, m);
      const double s1 = pv(ix.busS1[t]), s2 = pv(ix.busS2[t]); double tl, tr, pl, pr; gains(ix.busVol[t], ix.busPan[t], tl, tr); swapG(t, tl, tr, pl, pr);
      int dest = (int)pv(ix.busDest[t]); Track* target = nullptr; if (dest >= 3) { const int tt = dest - 2; if (tt > t) target = &S.tk[tt]; else dest = 0; }
      Track& a1 = aux[0]; Track& a2 = aux[1];
      for (int i = 0; i < m; i++) {
        const double w = (i + 1.0) / m, gl_ = pl + (tl - pl) * w, gr_ = pr + (tr - pr) * w, l = tk.l[i] * gl_, r = tk.r[i] * gr_; tk.l[i] = (float)l; tk.r[i] = (float)r;
        if (s1 > 0) { a1.l[i] += (float)(l * s1); a1.r[i] += (float)(r * s1); } if (s2 > 0) { a2.l[i] += (float)(l * s2); a2.r[i] += (float)(r * s2); }
        if (target) { target->l[i] += (float)l; target->r[i] += (float)r; } else if (dest == 1) { a1.l[i] += (float)l; a1.r[i] += (float)r; } else if (dest == 2) { a2.l[i] += (float)l; a2.r[i] += (float)r; } else { mst.l[i] += (float)l; mst.r[i] += (float)r; }
      }
      peak(t, tk.l, tk.r, m);
    }
    for (int x = 0; x < 2; x++) {
      Track& a = aux[x]; runChain(4 + x, a.l, a.r, m); double tl, tr, pl, pr; gains(ix.busVol[4 + x], ix.busPan[4 + x], tl, tr); swapG(4 + x, tl, tr, pl, pr);
      static int x1dest = -1; x1dest = pidx("bus.x1.dest");
      for (int i = 0; i < m; i++) { const double w = (i + 1.0) / m, l = a.l[i] * (pl + (tl - pl) * w), r = a.r[i] * (pr + (tr - pr) * w); a.l[i] = (float)l; a.r[i] = (float)r;
        if (x == 0 && pv(x1dest) == 1) { aux[1].l[i] += (float)l; aux[1].r[i] += (float)r; } else { fxo.l[i] += (float)l; fxo.r[i] += (float)r; } }
      peak(4 + x, a.l, a.r, m);
    }
    { double tl, tr, pl, pr; gains(ix.busVol[6], ix.busPan[6], tl, tr); swapG(6, tl, tr, pl, pr);
      for (int i = 0; i < m; i++) { const double w = (i + 1.0) / m, l = fxo.l[i] * (pl + (tl - pl) * w), r = fxo.r[i] * (pr + (tr - pr) * w); fxo.l[i] = (float)l; fxo.r[i] = (float)r; mst.l[i] += (float)l; mst.r[i] += (float)r; }
      peak(6, fxo.l, fxo.r, m); }
    runChain(6, mst.l, mst.r, m);
    { static int mv = pidx("bus.mst.vol"), mp = pidx("bus.mst.pan"); double tv = pv(mv) + pv(ix.master), pn = pv(mp); tv = tv <= -59.9 ? 0 : dbv(tv);
      const double tl = tv * std::cos((pn * .5 + .5) * kPi / 2) * 1.414, tr = tv * std::sin((pn * .5 + .5) * kPi / 2) * 1.414; double pl, pr; swapG(7, tl, tr, pl, pr);
      const bool lim = pv(ix.lim) != 0; const double ce = dbv(pv(ix.ceil));
      for (int i = 0; i < m; i++) { const double w = (i + 1.0) / m; double l = mst.l[i] * (pl + (tl - pl) * w), r = mst.r[i] * (pr + (tr - pr) * w); if (!(l > -40 && l < 40)) l = 0; if (!(r > -40 && r < 40)) r = 0; mst.l[i] = (float)l; mst.r[i] = (float)r; }
      if (lim) mlim->proc(mst.l, mst.r, m, ce, 140); limGR = mlim->gr;
      for (int i = 0; i < m; i++) { double l = mst.l[i], r = mst.r[i]; if (l > ce) l = ce; else if (l < -ce) l = -ce; if (r > ce) r = ce; else if (r < -ce) r = -ce;
        if (!lim) { if (l > 1) l = 1; else if (l < -1) l = -1; if (r > 1) r = 1; else if (r < -1) r = -1; }
        mst.l[i] = (float)l; mst.r[i] = (float)r; ml[i] = (float)l; mr[i] = (float)r; scope[sp] = (float)((l + r) * .5); sp = (sp + 1) & 2047; }
      peak(7, mst.l, mst.r, m); }
  }
  void process(float* oL, float* oR, int n) { int pos = 0; while (pos < n) { const int m = std::min(kBlock, n - pos); block(m); for (int i = 0; i < m; i++) { oL[pos + i] = ml[i]; oR[pos + i] = mr[i]; } pos += m; } }
};
} // namespace whisker
