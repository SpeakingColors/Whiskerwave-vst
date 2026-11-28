// Runs one FX on a fixed test signal and prints peak, rms and a checksum. Compare with tools/fx_parity_js.js.
// Usage: fx_parity <type> "key=value;key=value" [seconds]
#include "../src/FxFactory.h"
#include <cstdio>
#include <cstdlib>
using namespace whisker;
int main(int argc, char** argv) {
  if (argc < 2) return 1;
  auto eng = std::make_unique<Engine>(44100.0); FxHost host(*eng); host.env.sr = 44100; host.env.bpm = 120;
  const int type = fxTypeByName(argv[1]); if (type < 0) { std::printf("unknown type\n"); return 2; }
  NodeP node = host.newNode(type); const FxSpec& sp = kFx[type];
  std::string s = argc > 2 ? argv[2] : ""; size_t pos = 0;
  while (pos < s.size()) { size_t e = s.find(';', pos); if (e == std::string::npos) e = s.size(); const std::string kv = s.substr(pos, e - pos); pos = e + 1; const size_t q = kv.find('='); if (q == std::string::npos) continue;
    const std::string k = kv.substr(0, q); const double v = std::atof(kv.c_str() + q + 1); bool ok = false; for (int i = 0; i < sp.np; i++) if (k == sp.ps[i].key) { node->st->p[i] = (float)v; ok = true; } if (!ok) std::printf("bad key %s\n", k.c_str()); }
  const double secs = argc > 3 ? std::atof(argv[3]) : 2.0; const int total = (int)(secs * 44100);
  std::vector<NodeP> list { node }; float L[kBlock], R[kBlock]; double pk = 0, sum = 0, chk = 0; uint32_t lcg = 12345; double beat = 0;
  for (int t = 0; t < total; t += kBlock) {
    for (int i = 0; i < kBlock; i++) { const int k = t + i; const double tt = k / 44100.0, env = std::fmod(tt, .5) < .25 ? std::exp(-std::fmod(tt, .5) * 8) : 0.0;
      lcg = lcg * 1664525u + 1013904223u; const double nz = ((lcg >> 8) & 0xFFFF) / 32768.0 - 1.0;
      L[i] = (float)(env * (.5 * std::sin(kTau * 110 * tt) + .3 * std::sin(kTau * 1760 * tt) + .1 * nz)); R[i] = (float)(env * (.5 * std::sin(kTau * 110 * tt + .5) + .3 * std::sin(kTau * 2640 * tt) - .1 * nz)); }
    host.env.beat = beat; host.runList(list, L, R, kBlock, 0); beat += kBlock * 120.0 / 60 / 44100;
    for (int i = 0; i < kBlock; i++) { pk = std::max(pk, (double)std::max(std::fabs(L[i]), std::fabs(R[i]))); sum += L[i] * L[i] + R[i] * R[i]; chk += L[i] * std::sin((t + i) * .0137) + R[i] * std::cos((t + i) * .0071); }
  }
  std::printf("%s peak %.6f rms %.6f chk %.6f\n", argv[1], pk, std::sqrt(sum / (2 * total)), chk);
}
