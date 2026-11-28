// Renders one note through the C++ engine and prints peak / rms / centroid / band energies, to compare with tools/parity_js.js.
// Build: g++ -O2 -std=c++17 tests/parity_render.cpp -o /tmp/parity_render
// Run:   /tmp/parity_render data/ww_tables.bin "a.pos=.26;a.uv=3;slot=l1>a.pos:.5;note=57"
#include "../src/Engine.h"
#include <cstdio>
#include <fstream>
#include <sstream>
using namespace whisker;
int main(int argc, char** argv) {
  const char* bin = argc > 1 ? argv[1] : "data/ww_tables.bin"; const std::string ov = argc > 2 ? argv[2] : "";
  std::ifstream f(bin, std::ios::binary); std::vector<char> raw((std::istreambuf_iterator<char>(f)), {}); if (raw.empty()) { std::puts("no tables"); return 1; }
  TableCache cache; cache.setSource(raw.data(), raw.size());
  Engine e(44100); e.setParam(pidx("master"), 3); e.setParam(pidx("lim"), 0);
  for (const char* k : {"a.anl", "b.anl", "c.anl"}) e.setParam(pidx(k), .2);
  int note = 57; std::vector<Slot> slots;
  std::stringstream ss(ov); std::string it;
  while (std::getline(ss, it, ';')) {
    if (it.empty()) continue; const auto eq = it.find('='); const std::string k = it.substr(0, eq); const double v = std::atof(it.c_str() + eq + 1);
    if (k == "note") note = (int)v;
    else if (k == "slot") { const auto gt = it.find('>'), co = it.find(':'); const std::string s = it.substr(5, gt - 5), d = it.substr(gt + 1, co - gt - 1); const double a = std::atof(it.c_str() + co + 1);
      static const char* NM[] = {"e1","e2","e3","e4","e5","e6","e7","e8","e9","e10","e11","e12","e13","e14","e15","e16","l1","l2","l3","l4","m1","m2","m3","m4","m5","m6","m7","m8","vel","key","wheel","bend","at","rnd"};
      int si = -1; for (int i = 0; i < 34; i++) if (s == NM[i]) si = i; Slot sl; sl.src = si; sl.dst = pidx(d); sl.amt = a; slots.push_back(sl); }
    else { const int p = pidx(k); if (p < 0) { std::printf("unknown param %s\n", k.c_str()); return 1; } e.setParam(p, v); }
  }
  for (size_t i = 0; i < slots.size() && i < 64; i++) e.S.slots[i] = slots[i]; e.S.nSlots = (int)std::min<size_t>(64, slots.size());
  const Table* t0 = cache.get(0); for (int o = 0; o < 6; o++) e.S.tab[o] = t0;
  e.noteOn(note, .8);
  const int N = (44100 * 4 / 2048) * 2048; std::vector<float> L(N), R(N);
  for (int b = 0; b < N / 2048; b++) e.process(&L[b * 2048], &R[b * 2048], 2048);
  double pk = 0, sq = 0; for (int i = 0; i < N; i++) { pk = std::max({pk, (double)std::fabs(L[i]), (double)std::fabs(R[i])}); sq += (L[i] * L[i] + R[i] * R[i]) / 2.0; }
  const int s0 = (int)(N * .3), W = 16384; std::vector<double> re(W), im(W, 0.0);
  for (int i = 0; i < W; i++) { const double w = .5 - .5 * std::cos(2 * kPi * i / W); re[i] = (L[s0 + i] + R[s0 + i]) * .5 * w; } fftInPlace(re, im, false);
  double tot = 0, cen = 0, b1 = 0, b2 = 0, b3 = 0;
  for (int k = 1; k < W / 2; k++) { const double fr = k * 44100.0 / W, m = re[k] * re[k] + im[k] * im[k]; tot += m; cen += m * fr; if (fr < 500) b1 += m; else if (fr < 2000) b2 += m; else if (fr < 8000) b3 += m; }
  auto db = [&](double x) { return 10 * std::log10(x / tot + 1e-12); };
  std::printf("peak %.2f rms %.1fdB centroid %dHz <500 %.0f 0.5-2k %.0f 2-8k %.0f\n", pk, 10 * std::log10(sq / N + 1e-12), (int)std::lround(cen / tot), db(b1), db(b2), db(b3));
}
