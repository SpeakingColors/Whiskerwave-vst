// Envelopes, LFO and random sources (port of Env and Lfo in dsp2.js). Audio thread only.
#pragma once
#include "Dsp.h"
#include <cstdint>
namespace whisker {
struct Rng {
  uint64_t s = 0x9E3779B97F4A7C15ull;
  double next() { s ^= s << 13; s ^= s >> 7; s ^= s << 17; return (double)(s >> 11) * (1.0 / 9007199254740992.0); } // [0,1)
  double bi() { return next() * 2 - 1; }
};
inline Rng gRng;
inline double curveG(double x, double k) { return std::fabs(k) < 1e-3 ? x : (1 - std::exp(-k * x)) / (1 - std::exp(-k)); }

struct Env {
  int st = 0; double v = 0, x = 0, v0 = 0, t = 0, a0 = 0, y = 0, u = 1; int rf = 0;
  void on() { a0 = st == 0 ? 0 : v; st = 1; x = 0; t = 0; }
  void off() { if (st != 0 && st != 5) { st = 5; x = 0; v0 = v; } }
  double tick(double dt, double a, double h, double d, double s, double r, double ca, double c) {
    switch (st) {
      case 1: x += dt * 1000 / a; if (x >= 1) { x = 0; v = 1; st = h > 0 ? 2 : 3; } else v = a0 + (1 - a0) * curveG(x, ca * 5); break;
      case 2: x += dt * 1000 / h; v = 1; if (x >= 1) { x = 0; st = 3; } break;
      case 3: x += dt * 1000 / d; if (x >= 1) { x = 1; st = 4; v = s; } else v = s + (1 - s) * (1 - curveG(x, -c * 5)); break;
      case 4: v = s; break;
      case 5: x += dt * 1000 / r; if (x >= 1) { v = 0; st = 0; } else v = v0 * (1 - curveG(x, -c * 5)); break;
      default: v = 0;
    }
    return v;
  }
  // drawn shape; lm 0 off, 1 loop all, 2 hold at end marker, 3 loop markers
  double drawTick(double dt, double len, int lm, double ls, double le, const float* pts, int n, double rel, double slew) {
    auto at = [&](double u_) { const double p = clampd(u_, 0, 1) * (n - 1); const int i = std::min(n - 2, (int)std::floor(p)); const double f = p - i; return pts[i] * (1 - f) + pts[i + 1] * f; };
    if (le < ls + .001) std::swap(ls, le);
    double yy;
    if (st >= 1 && st <= 4) {
      t += dt * 1000; double uu = t / len;
      if (lm == 1) { if (uu >= 1) { t = std::fmod(t, len); uu = t / len; } }
      else if (lm == 2) { if (uu >= le) { uu = le; t = le * len; } }
      else if (lm == 3 && le - ls > .002) { if (uu >= le) { uu = ls + std::fmod(uu - ls, le - ls); t = uu * len; } }
      else if (uu >= 1) { uu = 1; st = 4; }
      u = uu; yy = at(uu); y = yy;
    } else if (st == 5) {
      if ((lm == 2 || lm == 3) && u < 1 && !rf) { t += dt * 1000; u = t / len; if (u >= 1) { u = 1; rf = 1; x = 0; v0 = v; } yy = at(u); }
      else { if (!rf) { rf = 1; x = 0; v0 = v; } x += dt * 1000 / std::max(1.0, rel); if (x >= 1) { st = 0; v = 0; rf = 0; return 0; } yy = v0 * (1 - x); }
    } else { v = 0; rf = 0; return 0; }
    if (st == 1 && x == 0 && t <= dt * 1000 + 1e-9 && a0 == 0) v = yy;
    const double k = 1 - std::exp(-dt * 1000 / std::max(.05, slew)); v += (yy - v) * k;
    if (st != 5) rf = 0;
    return v;
  }
};

struct Lfo {
  double ph = 0, sh = 0, sh2 = 0, sm = 0, fade = 0; int si = -1; double sv = 0, sa = 0, wk = 0; int dir = 1; double amp = 1;
  void start(double p) { ph = p; si = -1; wk = 0; dir = 1; amp = 1; fade = 0; sh2 = gRng.bi(); sh = gRng.bi(); sm = 0; }
  double tick(double dt, double rate, int shape, double smooth, double fadeMs, const float* custom, int cn) {
    ph += rate * dt; bool wrapped = false; if (ph >= 1) { ph -= std::floor(ph); wrapped = true; }
    if (wrapped) { sh = sh2; sh2 = gRng.bi(); dir = gRng.next() < .5 ? 1 : -1; amp = .4 + gRng.next() * .6; }
    const double p = ph; double v = 0;
    switch (shape) {
      case 0: v = std::sin(kTau * p); break;
      case 1: v = p < .5 ? 4 * p - 1 : 3 - 4 * p; break;
      case 2: v = 2 * p - 1; break;
      case 3: v = 1 - 2 * p; break;
      case 4: v = p < .5 ? 1 : -1; break;
      case 5: v = sh; break;
      case 6: { const double t = (1 - std::cos(kPi * p)) * .5; v = sh * (1 - t) + sh2 * t; break; }
      case 7: { const double q = p * cn; const int i = (int)std::floor(q) % cn; const double f = q - std::floor(q); v = custom[i] * (1 - f) + custom[(i + 1) % cn] * f; break; }
      case 8: case 9: case 13: { const int nn = shape == 8 ? 4 : 8; const int idx = (int)std::floor(p * nn); if (idx != si) { si = idx; sv = shape == 13 ? (gRng.next() < .5 ? 1 : -1) : gRng.bi(); } v = sv; break; }
      case 10: { const double q = p * 4; const int idx = (int)std::floor(q); if (idx != si) { si = idx; sa = sv; sv = gRng.bi(); } const double f = q - idx; v = sa * (1 - f) + sv * f; break; }
      case 11: { wk += gRng.bi() * std::sqrt(std::max(rate, .05) * dt) * 1.6; if (wk > 1) wk = 2 - wk; if (wk < -1) wk = -2 - wk; wk = clampd(wk, -1, 1); v = wk; break; }
      case 12: v = gRng.bi(); break;
      case 14: v = (dir > 0 ? 2 * p - 1 : 1 - 2 * p) * amp; break;
    }
    if (smooth > 0) { const double a = 1 - std::exp(-dt / (0.0005 + smooth * 0.2)); sm += (v - sm) * a; v = sm; }
    if (fadeMs > 0) { fade = std::min(1.0, fade + dt * 1000 / fadeMs); v *= fade; }
    return v;
  }
};
} // namespace whisker
