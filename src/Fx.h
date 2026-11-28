// FX framework: nodes with their own instances (any effect can be added many times), snapshot handoff to the audio thread,
// modulation routes from the matrix, dry/wet mixing, band split recursion. Port of runChain/applyFxMod in dsp3d.js. JUCE free.
#pragma once
#include "Engine.h"
#include "FxTable.h"
#include <atomic>
#include <memory>
#include <string>
#include <vector>
namespace whisker {

inline double fxN(const FxParamSpec& s, double v) { return s.kind == PK::Exp ? std::log(std::max(v, (double)s.mn) / s.mn) / std::log((double)s.mx / s.mn) : (v - s.mn) / ((s.mx - s.mn) != 0 ? (s.mx - s.mn) : 1.0); }
inline double fxV(const FxParamSpec& s, double n) { n = clampd(n, 0, 1); if (s.kind == PK::Exp) return s.mn * std::pow((double)s.mx / s.mn, n); const double v = s.mn + n * (s.mx - s.mn); return (s.kind == PK::Int || s.kind == PK::List) ? std::round(v) : v; }

struct FxEnv { double sr = 44100, bpm = 120, beat = 0; Engine* eng = nullptr; };

struct FxState; struct FxNode;
using NodeP = std::shared_ptr<const FxNode>;

struct FxPar {
  const FxSpec* sp; const std::atomic<float>* p; const float* m;
  double operator()(int i) const { const double v = p[i].load(std::memory_order_relaxed), mm = m[i]; if (mm == 0) return v; return fxV(sp->ps[i], fxN(sp->ps[i], v) + mm); }
  int ix(int i) const { return (int)std::lround((*this)(i)); }
};

class FxHost;
struct FxInst {
  FxEnv* E = nullptr; FxHost* hostPtr = nullptr; double gr = 0; bool hasGr = false; double pm = -1;
  virtual ~FxInst() {}
  virtual void prepare(double /*sr*/) {}
  virtual void proc(float* L, float* R, int n, const FxPar& P, const FxNode& node, int depth) = 0;
  virtual void alignDry(float* /*L*/, float* /*R*/, int /*n*/) {}
  virtual void reset() {}
};
std::unique_ptr<FxInst> makeFxInst(int type, FxEnv* env);   // defined in FxFactory.h

// Mutable part of a node. Parameter values are atomics so the UI can edit them while audio runs. m[] is written by the audio thread only.
struct FxState {
  std::atomic<float> p[kMaxFxParams]; float m[kMaxFxParams] = {};
  std::atomic<bool> on { true }; std::atomic<int> pat[16]; std::atomic<int> nb { 3 }; std::atomic<bool> so[4], ms[4];
  std::atomic<float> meter { 0 }; std::atomic<float> bandMeter[4];
  std::unique_ptr<FxInst> inst; int type = 0;
  FxState() { for (auto& x : p) x = 0.f; for (auto& x : pat) x = 1; for (auto& x : so) x = false; for (auto& x : ms) x = false; for (auto& x : bandMeter) x = 0.f; }
};
// Structure of a node. Immutable once published, so the audio thread can walk it without locks.
struct FxNode {
  std::string id; int type = 0; std::shared_ptr<FxState> st; std::vector<NodeP> bands[4];
};

struct FxRoute { int src; const FxNode* node; int pi; float amt; bool uni; };
struct ChainSet {
  std::vector<NodeP> chains[7]; std::vector<const FxNode*> all; std::vector<FxRoute> routes; uint64_t gen = 0;
};
struct FxRouteDesc { int src; std::string id; std::string key; float amt; bool uni; };

class FxHost {
public:
  FxEnv env; Engine& eng;
  explicit FxHost(Engine& e) : eng(e) { env.eng = &e; e.chainFn = &FxHost::thunk; e.preFn = &FxHost::preThunk; e.chainCtx = this; }
  // ---- message thread
  NodeP newNode(int type, const char* id = nullptr) {
    auto n = std::make_shared<FxNode>(); n->type = type; n->id = id ? id : ("n" + std::to_string(++nid)); n->st = std::make_shared<FxState>(); n->st->type = type;
    const FxSpec& sp = kFx[type]; for (int i = 0; i < sp.np; i++) n->st->p[i] = sp.ps[i].def;
    if (type == FX_tgate) { static const int dp[16] = {1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0}; for (int i = 0; i < 16; i++) n->st->pat[i] = dp[i]; }
    n->st->inst = makeFxInst(type, &env); if (n->st->inst) { n->st->inst->hostPtr = this; n->st->inst->prepare(env.sr); }
    return n;
  }
  // Publish a new set of chains with the route table (node id + param key). Safe to call while audio runs.
  void publish(const std::vector<NodeP> chains[7], const std::vector<FxRouteDesc>& routes) {
    auto cs = std::make_unique<ChainSet>(); for (int c = 0; c < 7; c++) cs->chains[c] = chains[c];
    for (int c = 0; c < 7; c++) collect(cs->chains[c], cs->all);
    for (const auto& r : routes) for (const FxNode* nd : cs->all) if (nd->id == r.id) { const FxSpec& sp = kFx[nd->type]; for (int i = 0; i < sp.np; i++) if (r.key == sp.ps[i].key) cs->routes.push_back({r.src, nd, i, r.amt, r.uni}); }
    cs->gen = ++generation; ChainSet* raw = cs.get(); sets.push_back(std::move(cs)); pending.store(raw);
    // free snapshots the audio thread has moved past
    const uint64_t seen = adopted.load(); for (size_t i = 0; i < sets.size();) { if (sets[i]->gen < seen) sets.erase(sets.begin() + (long)i); else ++i; }
  }
  void setSampleRate(double sr) { env.sr = sr; for (auto& k : sets) for (const FxNode* n : k->all) if (n->st->inst) n->st->inst->prepare(sr); }
  // ---- audio thread
  static void preThunk(void* c) { static_cast<FxHost*>(c)->beginBlock(); }
  static void thunk(void* c, int ch, float* L, float* R, int n, int d) { static_cast<FxHost*>(c)->run(ch, L, R, n, d); }
  void beginBlock() {
    if (ChainSet* p = pending.exchange(nullptr)) { cur = p; adopted.store(p->gen); }
    env.bpm = eng.pv(idx().bpm); env.beat = eng.beat;
    if (cur) applyMod();
  }
  void run(int chain, float* L, float* R, int n, int depth) { if (!cur || chain < 0 || chain > 6) return; runList(cur->chains[chain], L, R, n, depth); }
  void runList(const std::vector<NodeP>& list, float* L, float* R, int n, int depth);
  double srcValue(int s) const;
  void applyMod();
  float dryL[8][kBlock], dryR[8][kBlock];
private:
  void collect(const std::vector<NodeP>& l, std::vector<const FxNode*>& out) { for (auto& n : l) { out.push_back(n.get()); for (int b = 0; b < 4; b++) collect(n->bands[b], out); } }
  std::atomic<ChainSet*> pending { nullptr }; ChainSet* cur = nullptr; std::atomic<uint64_t> adopted { 0 }; uint64_t generation = 0; int nid = 0;
  std::vector<std::unique_ptr<ChainSet>> sets;
};

inline double FxHost::srcValue(int s) const {
  const Idx& ix = idx();
  if (s >= S_E1 && s < S_E1 + 16) { double mx = 0; for (auto& v : eng.voices) if (v->active && v->sv[s] > mx) mx = v->sv[s]; return mx; }
  if (s >= S_L1 && s < S_L1 + 4) return eng.S.gl[s - S_L1];
  if (s >= S_M1 && s < S_M1 + 8) return eng.pv(ix.m[s - S_M1]);
  switch (s) { case S_VEL: return eng.lastVel; case S_KEY: return eng.lastKey; case S_WHEEL: return eng.S.wheel; case S_BEND: return eng.S.bend; case S_AT: return eng.S.at; case S_RND: return eng.lastRnd; }
  return 0;
}
inline void FxHost::applyMod() {
  if (cur->routes.empty()) { return; }
  for (const FxNode* n : cur->all) for (int i = 0; i < kMaxFxParams; i++) n->st->m[i] = 0.f;
  for (const FxRoute& r : cur->routes) { double v = srcValue(r.src); if (r.uni) v = (v + 1) * .5; r.node->st->m[r.pi] += (float)(v * r.amt); }
}
inline void FxHost::runList(const std::vector<NodeP>& list, float* L, float* R, int n, int depth) {
  if (depth > 7) return;
  for (const NodeP& np : list) {
    const FxNode& node = *np; FxState& st = *node.st; if (!st.on.load(std::memory_order_relaxed)) continue; FxInst* inst = st.inst.get(); if (!inst) continue;
    const FxSpec& sp = kFx[node.type]; FxPar P{&sp, st.p, st.m};
    const double mix = sp.mixIdx >= 0 ? P(sp.mixIdx) : 1.0, pm = inst->pm < 0 ? mix : inst->pm; const bool wet = mix < .999 || pm < .999;
    float* dl = dryL[depth]; float* dr = dryR[depth];
    if (wet) { std::memcpy(dl, L, sizeof(float) * (size_t)n); std::memcpy(dr, R, sizeof(float) * (size_t)n); }
    inst->proc(L, R, n, P, node, depth);
    if (wet) { inst->alignDry(dl, dr, n); for (int i = 0; i < n; i++) { const double a = pm + (mix - pm) * (i + 1) / n; L[i] = (float)(dl[i] * (1 - a) + L[i] * a); R[i] = (float)(dr[i] * (1 - a) + R[i] * a); } }
    inst->pm = mix;
    if (inst->hasGr) st.meter.store((float)inst->gr, std::memory_order_relaxed);
    for (int i = 0; i < n; i++) { const float l = L[i], r = R[i]; if (!(l > -8 && l < 8) || !(r > -8 && r < 8)) { std::fill(L, L + n, 0.f); std::fill(R, R + n, 0.f); inst->reset(); break; } }
  }
}
} // namespace whisker
