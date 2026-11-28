// Renders one factory preset (flat text from tools/preset_parity_js.js) with the C++ engine and FX host: peak, RMS in dB, count of bad samples.
#include "../src/FxFactory.h"
#include <cstdio>
#include <fstream>
#include <map>
#include <sstream>
using namespace whisker;
int main(int argc, char** argv) {
  if (argc < 3) return 1;
  std::ifstream f(argv[1], std::ios::binary); std::vector<char> raw((std::istreambuf_iterator<char>(f)), {}); if (raw.empty()) { std::puts("no tables"); return 1; }
  TableCache cache; cache.setSource(raw.data(), raw.size());
  auto eng = std::make_unique<Engine>(44100.0); Engine& e = *eng; FxHost host(e); host.setSampleRate(44100);
  std::map<std::string, std::shared_ptr<FxNode>> nodes; std::vector<std::shared_ptr<FxNode>> top[7]; std::vector<FxRouteDesc> routes; int tabs[6] = {0, 0, 0, 0, 0, 0}; e.S.nSlots = 0;
  static const char* SRC[kNumSrc] = {"e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "e10", "e11", "e12", "e13", "e14", "e15", "e16", "l1", "l2", "l3", "l4", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "vel", "key", "wheel", "bend", "at", "rnd"};
  static const char* BUS[7] = {"t0", "t1", "t2", "t3", "x1", "x2", "mst"};
  std::ifstream in(argv[2]); std::string line;
  while (std::getline(in, line)) {
    std::istringstream ss(line); std::string tag; ss >> tag;
    if (tag == "P") { std::string k; double v; ss >> k >> v; const int i = pidx(k); if (i < 0) { std::printf("bad key %s\n", k.c_str()); return 2; } e.setParam(i, v); }
    else if (tag == "T") { int o, t; ss >> o >> t; tabs[o] = t; }
    else if (tag == "S") { std::string s, d; double a; int u; ss >> s >> d >> a >> u; int si = -1; for (int i = 0; i < kNumSrc; i++) if (s == SRC[i]) si = i;
      if (d.rfind("fx:", 0) == 0) { const auto rest = d.substr(3); const auto c = rest.find(':'); routes.push_back({si, rest.substr(0, c), rest.substr(c + 1), (float)a, u != 0}); }
      else { Slot q; q.src = si; q.dst = pidx(d); q.amt = a; q.uni = u != 0; e.S.slots[e.S.nSlots++] = q; } }
    else if (tag == "N") { std::string where, type, id, ps; int on, nb; ss >> where >> type >> id >> on >> nb; std::getline(ss, ps); if (!ps.empty() && ps[0] == ' ') ps = ps.substr(1);
      const int t = fxTypeByName(type); if (t < 0) { std::printf("bad fx %s\n", type.c_str()); return 2; }
      auto n = std::make_shared<FxNode>(*host.newNode(t, id.c_str())); n->st->on = on != 0; n->st->nb = nb; const FxSpec& sp = kFx[t];
      std::istringstream pp(ps); std::string kv; while (std::getline(pp, kv, ',')) { const auto q = kv.find('='); if (q == std::string::npos) continue; const std::string k = kv.substr(0, q); for (int i = 0; i < sp.np; i++) if (k == sp.ps[i].key) n->st->p[i] = (float)std::atof(kv.c_str() + q + 1); }
      nodes[id] = n; int b = -1; for (int i = 0; i < 7; i++) if (where == BUS[i]) b = i;
      if (b >= 0) top[b].push_back(n); else { const auto c = where.find(':'); nodes[where.substr(0, c)]->bands[std::atoi(where.c_str() + c + 1)].push_back(n); } }
  }
  const Idx& I = idx(); for (int o = 0; o < 6; o++) e.S.tab[o] = cache.get(tabs[o], e.pv(I.osc[o].sw), e.pv(I.osc[o].sk));
  std::vector<NodeP> ch[7]; for (int b = 0; b < 7; b++) for (auto& n : top[b]) ch[b].push_back(n); host.publish(ch, routes);
  const int B = 2048, N = (3 * 44100 / B) * B; std::vector<float> L(B), R(B); double pk = 0, ssum = 0; int bad = 0;
  for (int b = 0; b < N / B; b++) { if (b == 0) for (int n : {45, 57, 64}) e.noteOn(n, .8); if (b == (int)(1.5 * 44100 / B)) for (int n : {45, 57, 64}) e.noteOff(n);
    e.process(L.data(), R.data(), B); for (int i = 0; i < B; i++) { if (!std::isfinite(L[i])) bad++; pk = std::max(pk, (double)std::max(std::fabs(L[i]), std::fabs(R[i]))); ssum += (L[i] * L[i] + R[i] * R[i]) / 2; } }
  std::printf("%.3f %.2f %d\n", pk, 10 * std::log10(ssum / N + 1e-12), bad);
}
