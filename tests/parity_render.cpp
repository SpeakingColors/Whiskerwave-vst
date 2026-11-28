// Renders one note with the C++ engine and prints the same statistics as tools/parity_js.js (JS reference).
// Build without JUCE: g++ -O2 -std=c++17 -Isrc tests/parity_render.cpp -o parity_render
#include "../src/Voice.h"
#include <cstdio>
#include <fstream>
using namespace whisker;
int main(int argc, char** argv)
{
    const char* bin = argc > 1 ? argv[1] : "data/ww_tables.bin";
    const std::string which = argc > 2 ? argv[2] : "init";
    std::ifstream f(bin, std::ios::binary); std::vector<char> data((std::istreambuf_iterator<char>(f)), {});
    TableCache cache; cache.setSource(data.data(), data.size());
    Patch P;
    for (int o = 0; o < 3; ++o) { P.o[o].tab = cache.get(0); P.o[o].anl = .2f; P.o[o].lvl = o == 0 ? .75f : .6f; }
    P.o[0].on = true; P.f[0].type = 14; P.f[0].cut = 9000; P.f[0].res = .2f; P.f[0].es = 2; P.f[0].env = 0;
    P.e[1].d = 550; P.e[1].s = .35f; P.e[1].r = 200; P.master = 3;
    if (which == "wonder") { P.o[0].pos = .26f; P.o[0].uv = 3; }
    if (which == "warp") { P.o[0].w1 = 1; P.o[0].w1a = .5f; P.o[0].w2 = 9; P.o[0].w2a = .4f; }
    if (which == "fm") { P.o[0].mm = 1; P.o[0].ms = 1; P.o[0].ma = .3f; P.o[0].fb = .2f; P.o[1].on = true; P.o[1].lvl = 0; P.o[1].semi = 7; P.o[1].rt = 0; }
    const double sr = 44100; const int N = (int) (4 * sr) / 2048 * 2048;
    std::vector<double> L((size_t) N), R((size_t) N);
    Engine e; e.prepare(sr); e.noteOn(57, .8, P);
    for (int off = 0; off < N; off += 2048) e.render(P, &L[(size_t) off], &R[(size_t) off], 2048);
    const double g = std::pow(10.0, P.master / 20.0);
    double pk = 0, ss = 0;
    for (int i = 0; i < N; ++i) { L[(size_t) i] *= g; R[(size_t) i] *= g; pk = std::max(pk, std::max(std::abs(L[(size_t) i]), std::abs(R[(size_t) i]))); ss += (L[(size_t) i] * L[(size_t) i] + R[(size_t) i] * R[(size_t) i]) / 2; }
    const int s0 = (int) (N * .3), W = 16384;
    std::vector<double> re((size_t) W), im((size_t) W, 0.0);
    for (int i = 0; i < W; ++i) { const double w = .5 - .5 * std::cos(2 * kPi * i / W); re[(size_t) i] = (L[(size_t) (s0 + i)] + R[(size_t) (s0 + i)]) * .5 * w; }
    fftInPlace(re, im, false);
    double tot = 0, cen = 0, b1 = 0, b2 = 0, b3 = 0;
    for (int k = 1; k < W / 2; ++k) { const double fr = k * sr / W, m = re[(size_t) k] * re[(size_t) k] + im[(size_t) k] * im[(size_t) k]; tot += m; cen += m * fr; if (fr < 500) b1 += m; else if (fr < 2000) b2 += m; else if (fr < 8000) b3 += m; }
    auto db = [&](double x) { return 10 * std::log10(x / tot + 1e-12); };
    std::printf("peak %.2f rms %.1fdB centroid %.0fHz <500 %.0f 0.5-2k %.0f 2-8k %.0f\n", pk, 10 * std::log10(ss / N + 1e-12), cen / tot, db(b1), db(b2), db(b3));
    return 0;
}
