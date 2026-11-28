// Lookahead brickwall limiter (LookLim in dsp3a.js): 5 ms lookahead, 25 ms hold, smooth release.
#pragma once
#include "Dsp.h"
namespace whisker {
struct LookLim {
  double sr; int N, M, H, hc = 0; std::vector<float> dl, dr; int w = 0; std::vector<double> tg, dq; int64_t qh = 0, qt = 0, cnt = 0; std::vector<double> bx; double bsum; int bw = 0; double rel = 1, gr = 0;
  explicit LookLim(double s = 44100) : sr(s) { N = std::max(16, (int)std::lround(sr * .005)); M = N + 1; H = (int)std::lround(sr * .025); dl.assign(M, 0.f); dr.assign(M, 0.f); tg.assign(M, 0.0); dq.assign(M + 2, 0.0); bx.assign(M, 1.0); bsum = M; }
  int latency() const { return N; }
  void proc(float* L, float* R, int n, double ce, double relMs) {
    const int Q = M + 2; const double rc = std::exp(-1 / (sr * std::max(5.0, relMs) * .001)); double gmin = 1;
    for (int i = 0; i < n; i++) {
      const double l = L[i], r = R[i], pk = std::max(std::fabs(l), std::fabs(r)), x = pk > ce ? ce / pk : 1; const int64_t t = cnt++;
      tg[t % M] = x;
      while (qt > qh && tg[(int64_t)dq[(qt - 1) % Q] % M] >= x) qt--;
      dq[qt % Q] = (double)t; qt++;
      while ((int64_t)dq[qh % Q] <= t - M) qh++;
      const double wm = tg[(int64_t)dq[qh % Q] % M];
      const int bi = bw; bsum += wm - bx[bi]; bx[bi] = wm; bw = (bi + 1) % M;
      const double g = bsum / M;
      if (g < rel) { rel = g; hc = H; } else if (hc > 0) hc--; else rel += (g - rel) * (1 - rc);
      const double go = rel; const int wi = w; const double d1 = dl[wi], d2 = dr[wi]; dl[wi] = (float)l; dr[wi] = (float)r; w = (wi + 1) % M;
      double ol = d1 * go, orr = d2 * go; if (ol > ce) ol = ce; else if (ol < -ce) ol = -ce; if (orr > ce) orr = ce; else if (orr < -ce) orr = -ce;
      L[i] = (float)ol; R[i] = (float)orr; if (go < gmin) gmin = go;
    }
    gr = 20 * std::log10(gmin);
  }
};
} // namespace whisker
