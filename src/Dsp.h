// Shared DSP helpers (JUCE free): biquad, delay line, 2x and 4x oversampling around a nonlinearity.
#pragma once
#include <cmath>
#include <cstring>
#include <vector>
#include <algorithm>
#include <cstdint>
#include <memory>
namespace whisker {
constexpr double kPi = 3.14159265358979323846, kTau = 2.0 * kPi;
inline double clampd(double x, double a, double b) { return x < a ? a : (x > b ? b : x); }
inline double fastTanh(double x) {
  if (x > 3) return 1; if (x < -3) return -1;
  const double x2 = x * x; return x * (27 + x2) / (27 + 9 * x2);
}
inline double dbv(double d) { return std::pow(10.0, d / 20.0); }
inline double mtof(double n) { return 440.0 * std::pow(2.0, (n - 69.0) / 12.0); }

enum class BT { lp, hp, bp, notch, ap, peak, ls, hs };
struct BiS {
  double s[4] = {0, 0, 0, 0}, b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  void set(BT type, double f, double q, double gdb, double sr) {
    f = clampd(f, 10, sr * .49); q = std::max(q, .05);
    const double w = kTau * f / sr, c = std::cos(w), sn = std::sin(w), al = sn / (2 * q), A = std::pow(10.0, gdb / 40);
    double B0 = 1, B1 = 0, B2 = 0, a0 = 1, A1 = 0, A2 = 0;
    switch (type) {
      case BT::lp: B0 = (1 - c) / 2; B1 = 1 - c; B2 = B0; a0 = 1 + al; A1 = -2 * c; A2 = 1 - al; break;
      case BT::hp: B0 = (1 + c) / 2; B1 = -(1 + c); B2 = B0; a0 = 1 + al; A1 = -2 * c; A2 = 1 - al; break;
      case BT::bp: B0 = al; B1 = 0; B2 = -al; a0 = 1 + al; A1 = -2 * c; A2 = 1 - al; break;
      case BT::notch: B0 = 1; B1 = -2 * c; B2 = 1; a0 = 1 + al; A1 = -2 * c; A2 = 1 - al; break;
      case BT::ap: B0 = 1 - al; B1 = -2 * c; B2 = 1 + al; a0 = 1 + al; A1 = -2 * c; A2 = 1 - al; break;
      case BT::peak: B0 = 1 + al * A; B1 = -2 * c; B2 = 1 - al * A; a0 = 1 + al / A; A1 = -2 * c; A2 = 1 - al / A; break;
      case BT::ls: { const double sq = 2 * std::sqrt(A) * al; B0 = A * ((A + 1) - (A - 1) * c + sq); B1 = 2 * A * ((A - 1) - (A + 1) * c); B2 = A * ((A + 1) - (A - 1) * c - sq); a0 = (A + 1) + (A - 1) * c + sq; A1 = -2 * ((A - 1) + (A + 1) * c); A2 = (A + 1) + (A - 1) * c - sq; break; }
      case BT::hs: { const double sq = 2 * std::sqrt(A) * al; B0 = A * ((A + 1) + (A - 1) * c + sq); B1 = -2 * A * ((A - 1) + (A + 1) * c); B2 = A * ((A + 1) + (A - 1) * c - sq); a0 = (A + 1) - (A - 1) * c + sq; A1 = 2 * ((A - 1) - (A + 1) * c); A2 = (A + 1) - (A - 1) * c - sq; break; }
    }
    b0 = B0 / a0; b1 = B1 / a0; b2 = B2 / a0; a1 = A1 / a0; a2 = A2 / a0;
  }
  double p(int ch, double x) { double* st = s + ch * 2; const double y = b0 * x + st[0]; st[0] = b1 * x - a1 * y + st[1]; st[1] = b2 * x - a2 * y; return y; }
  void reset() { s[0] = s[1] = s[2] = s[3] = 0; }
};

struct DelayLine {
  std::vector<float> b; int m = 1, w = 0;
  DelayLine() {}
  explicit DelayLine(int mx) { init(mx); }
  void init(int mx) { int n = 2; while (n < mx + 8) n <<= 1; b.assign(n, 0.f); m = n - 1; w = 0; }
  void write(double x) { b[w] = (float)x; w = (w + 1) & m; }
  double read(double d) const {
    const double p = w - 1 - d; const int i = (int)std::floor(p); const double f = p - i;
    const double xm = b[(i - 1) & m], x0 = b[i & m], x1 = b[(i + 1) & m], x2 = b[(i + 2) & m];
    const double c1 = .5 * (x1 - xm), c2 = xm - 2.5 * x0 + 2 * x1 - .5 * x2, c3 = .5 * (x2 - xm) + 1.5 * (x0 - x1);
    return ((c3 * f + c2) * f + c1) * f + x0;
  }
  void clear() { std::fill(b.begin(), b.end(), 0.f); }
};

struct OS2 {
  BiS u1, u2, d1, d2; double sr = 0; std::unique_ptr<struct OS2> tw;
  void prep(double s) { if (sr != s) { sr = s; u1.set(BT::lp, s * .46, .5412, 0, s * 2); d1 = u1; u2.set(BT::lp, s * .46, 1.3066, 0, s * 2); d2 = u2; } }
  template <class F> double p(int ch, double x, F fn, double a, double b) {
    const double ya = fn(u2.p(ch, u1.p(ch, x * 2)), a, b), yb = fn(u2.p(ch, u1.p(ch, 0)), a, b);
    const double o = d2.p(ch, d1.p(ch, ya)); d2.p(ch, d1.p(ch, yb)); return o;
  }
  double lin(int ch, double x);
};
inline double OS2::lin(int ch, double x) { if (!tw) tw.reset(new OS2()); tw->prep(sr); return tw->p(ch, x, [](double v, double, double) { return v; }, 0, 0); }
inline const double OS4C[5][5] = {{0.00026000016422421862, 0.00035970605427461925, 0.00026000016422421862, -1.510402736507739, 0.58533362714654935}, {1, -0.33272726345019515, 0.99999999999999989, -1.49596813049709, 0.67490137750001511}, {1, -0.98739672516438948, 1, -1.4804812904749551, 0.79287245548307661}, {1, -1.2177490818032131, 1.0000000000000002, -1.4768812156355668, 0.89218439530409421}, {1, -1.2964707096911294, 0.99999999999999978, -1.4943179708173511, 0.96692050659365281}};
struct OS4 {
  BiS u[5], d[5]; double sr = 0; std::unique_ptr<struct OS4> tw;
  OS4() { for (int i = 0; i < 5; i++) { u[i].b0 = d[i].b0 = OS4C[i][0]; u[i].b1 = d[i].b1 = OS4C[i][1]; u[i].b2 = d[i].b2 = OS4C[i][2]; u[i].a1 = d[i].a1 = OS4C[i][3]; u[i].a2 = d[i].a2 = OS4C[i][4]; } }
  void prep(double s) { sr = s; }
  template <class F> double p(int ch, double x, F fn, double a, double b) {
    double o = 0;
    for (int k = 0; k < 4; k++) { double v = k ? 0 : x * 4; for (int i = 0; i < 5; i++) v = u[i].p(ch, v); v = fn(v, a, b); for (int i = 0; i < 5; i++) v = d[i].p(ch, v); if (!k) o = v; }
    return o;
  }
  double lin(int ch, double x);
};
inline double OS4::lin(int ch, double x) { if (!tw) tw.reset(new OS4()); return tw->p(ch, x, [](double v, double, double) { return v; }, 0, 0); }
} // namespace whisker
