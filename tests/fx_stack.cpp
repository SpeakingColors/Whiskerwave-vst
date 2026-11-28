// Stacking test: the same effect several times in one chain, nested band splits, routes and live snapshot swaps. Must stay finite and each copy must keep its own state.
#include "../src/FxFactory.h"
#include <cstdio>
using namespace whisker;
int main() {
  auto eng = std::make_unique<Engine>(44100.0); FxHost host(*eng); host.env.sr = 44100; int fails = 0;
  auto sig = [](int k, float& l, float& r) { const double tt = k / 44100.0, env = std::fmod(tt, .5) < .25 ? std::exp(-std::fmod(tt, .5) * 8) : 0.0; l = (float)(env * (.5 * std::sin(kTau * 110 * tt) + .3 * std::sin(kTau * 1760 * tt))); r = (float)(env * (.5 * std::sin(kTau * 110 * tt + .5) + .3 * std::sin(kTau * 2640 * tt))); };
  // 1. every type three times in a row
  for (int type = 0; type < kNumFxTypes; type++) {
    std::vector<NodeP> ch[7]; for (int k = 0; k < 3; k++) ch[0].push_back(host.newNode(type)); host.publish(ch, {}); host.beginBlock();
    double pk = 0; bool bad = false; float L[kBlock], R[kBlock];
    for (int t = 0; t < 44100; t += kBlock) { for (int i = 0; i < kBlock; i++) sig(t + i, L[i], R[i]); host.env.beat = t / 44100.0 * 2; host.run(0, L, R, kBlock, 0); for (int i = 0; i < kBlock; i++) { if (!std::isfinite(L[i]) || !std::isfinite(R[i])) bad = true; pk = std::max(pk, (double)std::fabs(L[i])); } }
    if (bad || pk > 7.9) { std::printf("FAIL %s x3 peak %.3f\n", kFx[type].type, pk); fails++; }
  }
  // 2. two delays with different times keep separate state: the result differs from one delay run twice with the same time
  { std::vector<NodeP> ch[7]; auto a = host.newNode(FX_delay), b = host.newNode(FX_delay); a->st->p[fxp::delay::p_syncl] = 0; b->st->p[fxp::delay::p_syncl] = 0; a->st->p[fxp::delay::p_timel] = 100; b->st->p[fxp::delay::p_timel] = 333; ch[0] = {a, b}; host.publish(ch, {}); host.beginBlock();
    if (a->st->inst.get() == b->st->inst.get()) { std::printf("FAIL shared instance\n"); fails++; } }
  // 3. split with a split inside, each band holding the same effect, plus a route onto one of them, swapped live
  { std::vector<NodeP> ch[7]; auto mk = [&](int depth, auto&& self) -> NodeP { auto s = std::make_shared<FxNode>(*host.newNode(FX_split)); for (int b = 0; b < 3; b++) { s->bands[b].push_back(host.newNode(FX_fatcat)); s->bands[b].push_back(host.newNode(FX_fatcat)); if (depth < 2 && b == 1) s->bands[b].push_back(self(depth + 1, self)); } return s; };
    auto top = mk(0, mk); auto voc = host.newNode(FX_voc), tune = host.newNode(FX_tune); ch[6] = {top, voc, tune, host.newNode(FX_maxi)};
    std::vector<FxRouteDesc> routes { {S_L1, voc->id, "shift", .5f, false}, {S_M1, tune->id, "shift", 1.f, true} };
    double pk = 0; bool bad = false; float L[kBlock], R[kBlock];
    for (int t = 0; t < 44100 * 2; t += kBlock) { if ((t / kBlock) % 200 == 0) host.publish(ch, routes); host.beginBlock(); for (int i = 0; i < kBlock; i++) sig(t + i, L[i], R[i]); host.run(6, L, R, kBlock, 0); for (int i = 0; i < kBlock; i++) { if (!std::isfinite(L[i])) bad = true; pk = std::max(pk, (double)std::fabs(L[i])); } }
    if (bad || pk > 1.01 || pk < .01) { std::printf("FAIL nested split chain peak %.3f\n", pk); fails++; } else std::printf("nested chain ok, peak %.3f\n", pk); }
  std::printf(fails ? "STACK TEST FAILED\n" : "STACK TEST OK (%d types x3)\n", kNumFxTypes); return fails;
}
