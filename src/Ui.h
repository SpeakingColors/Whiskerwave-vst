// Shared look of the native window: colours, fonts and painters taken from the mockup, and the value binding used by every control.
#pragma once
#include <juce_audio_utils/juce_audio_utils.h>
#include "PluginProcessor.h"
#include "WhiskerBinary.h"
namespace wwui {
inline const juce::Colour cBg(0xff0b0b0d), cPanel(0xff15161a), cDisp(0xff06080a), cText(0xfff4f5f7), cDim(0xffa9adb8), cAcc(0xff02EBBA), cPink(0xffFF1383), cPurple(0xffA43DFF), cGold(0xffFFD100), cGrid(0xff1b2523), cLine(0xff2b2d34), cSelBg(0xff241238), cLilac(0xffcd92fe), cMist(0xffe1cbf4), cBtn(0xff1c1d22);

inline juce::Font font(float px, int weight = 400, bool mono = false, float letterSpacing = 0)
{
    static juce::Typeface::Ptr tf[5];
    if (tf[0] == nullptr)
    {
        tf[0] = juce::Typeface::createSystemTypefaceFor(WhiskerBinary::barlow_condensed_400_ttf, (size_t) WhiskerBinary::barlow_condensed_400_ttfSize);
        tf[1] = juce::Typeface::createSystemTypefaceFor(WhiskerBinary::barlow_condensed_600_ttf, (size_t) WhiskerBinary::barlow_condensed_600_ttfSize);
        tf[2] = juce::Typeface::createSystemTypefaceFor(WhiskerBinary::barlow_condensed_700_ttf, (size_t) WhiskerBinary::barlow_condensed_700_ttfSize);
        tf[3] = juce::Typeface::createSystemTypefaceFor(WhiskerBinary::jetbrains_mono_400_ttf, (size_t) WhiskerBinary::jetbrains_mono_400_ttfSize);
        tf[4] = juce::Typeface::createSystemTypefaceFor(WhiskerBinary::jetbrains_mono_600_ttf, (size_t) WhiskerBinary::jetbrains_mono_600_ttfSize);
    }
    const int i = mono ? (weight >= 600 ? 4 : 3) : (weight >= 700 ? 2 : weight >= 600 ? 1 : 0);
    juce::Font f(juce::FontOptions().withTypeface(tf[i]).withPointHeight(px));
    return letterSpacing != 0 ? f.withExtraKerningFactor(letterSpacing / px) : f;
}

// One value a control edits: a plugin parameter or a parameter of one FX node.
struct Bind
{
    std::function<double()> get; std::function<void(double)> set; std::function<void()> begin, end;
    double mn = 0, mx = 1, def = 0; whisker::PK kind = whisker::PK::Lin; juce::String unit, label, tip, key; juce::StringArray items;
    bool valid() const { return get != nullptr; }
    double toN(double v) const { if (kind == whisker::PK::Exp) return std::log(std::max(v, mn) / mn) / std::log(mx / mn); return (v - mn) / ((mx - mn) != 0 ? (mx - mn) : 1.0); }
    double fromN(double n) const { n = juce::jlimit(0.0, 1.0, n); if (kind == whisker::PK::Exp) return mn * std::pow(mx / mn, n); const double v = mn + n * (mx - mn); return (kind == whisker::PK::Int || kind == whisker::PK::List) ? std::round(v) : v; }
    bool bipolar() const { return mn < 0 && mx > 0 && std::abs(std::abs(mn) - std::abs(mx)) < 1.0e-9; }
    juce::String text(double v) const
    {
        if (kind == whisker::PK::List) return items[juce::jlimit(0, juce::jmax(0, items.size() - 1), (int) std::lround(v))];
        const double a = std::abs(v);
        if (unit == " Hz" && a >= 1000) return juce::String(v / 1000, a >= 10000 ? 1 : 2) + " kHz";
        if (unit == " ms" && a >= 1000) return juce::String(v / 1000, 2) + " s";
        if (kind == whisker::PK::Int) return juce::String((int) std::lround(v)) + unit;
        if (mx - mn <= 2 && unit.isEmpty()) return juce::String((int) std::lround(v * 100)) + "%";
        return juce::String(v, a >= 100 ? 0 : a >= 10 ? 1 : 2) + unit;
    }
};
inline Bind bindParam(WhiskerwaveProcessor& p, const juce::String& key)
{
    Bind b; const int i = whisker::pidx(key.toStdString()); if (i < 0) return b;
    const auto& ps = whisker::kParams[i]; auto* rp = p.apvts.getParameter(ps.id); if (rp == nullptr) return b;
    auto* pp = &p; b.key = key; b.mn = ps.mn; b.mx = ps.mx; b.def = ps.def; b.kind = ps.kind; b.unit = ps.unit; b.label = ps.label; b.tip = ps.tip;
    if (ps.kind == whisker::PK::List) { int n = 0; auto* it = whisker::listItems(ps.list, n); for (int k = 0; k <= (int) ps.mx; ++k) b.items.add(it && k < n ? juce::String(it[k]) : juce::String(k)); }
    b.get = [pp, i] { return (double) pp->paramValue(i); };
    b.set = [rp](double v) { rp->setValueNotifyingHost(rp->convertTo0to1((float) v)); };
    b.begin = [rp] { rp->beginChangeGesture(); }; b.end = [rp] { rp->endChangeGesture(); };
    return b;
}
inline Bind bindFx(const whisker::NodeP& n, int pi)
{
    Bind b; const auto& sp = whisker::kFx[n->type]; if (pi < 0 || pi >= sp.np) return b; const auto& ps = sp.ps[pi]; auto st = n->st;
    b.key = "fx:" + juce::String(n->id) + ":" + ps.key; b.mn = ps.mn; b.mx = ps.mx; b.def = ps.def; b.kind = ps.kind; b.unit = ps.unit; b.label = ps.label; b.tip = ps.tip;
    for (int k = 0; k < ps.nItems; ++k) b.items.add(ps.items[k]);
    b.get = [st, pi] { return (double) st->p[pi].load(); }; b.set = [st, pi](double v) { st->p[pi] = (float) v; }; b.begin = [] {}; b.end = [] {};
    return b;
}

inline void paintKnob(juce::Graphics& g, juce::Rectangle<float> c, double n, bool bipolar, float alpha = 1.f)
{
    const float cx = c.getCentreX(), cy = c.getCentreY(), r = c.getWidth() / 2 - 3, a0 = juce::MathConstants<float>::pi * 1.25f, a1 = juce::MathConstants<float>::pi * 2.75f; // JUCE angles start at 12 o'clock
    juce::Path track; track.addCentredArc(cx, cy, r, r, 0, a0, a1, true); g.setColour(cLine.withMultipliedAlpha(alpha)); g.strokePath(track, juce::PathStrokeType(3.f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    const float z = bipolar ? .5f : 0.f, lo = (float) std::min((double) z, n), hi = (float) std::max((double) z, n);
    if (hi - lo > .002f) { juce::Path v; v.addCentredArc(cx, cy, r, r, 0, a0 + (a1 - a0) * lo, a0 + (a1 - a0) * hi, true); g.setColour(cAcc.withMultipliedAlpha(alpha)); g.strokePath(v, juce::PathStrokeType(3.f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded)); }
    const float an = a0 + (a1 - a0) * (float) n - juce::MathConstants<float>::halfPi; g.setColour(cText.withMultipliedAlpha(alpha));
    g.drawLine(cx + std::cos(an) * (r - 8), cy + std::sin(an) * (r - 8), cx + std::cos(an) * (r - 1), cy + std::sin(an) * (r - 1), 2.f);
}
inline juce::Colour meterColour(double db)
{
    static const double st[6] = {-60, -34, -22, -8, -1, 6}; static const juce::uint32 cs[6] = {0xff398BC4, 0xff6CC9F5, 0xff774BF9, 0xffA43DFF, 0xffFF1383, 0xffFF1383};
    if (db <= st[0]) return juce::Colour(cs[0]); for (int i = 1; i < 6; ++i) if (db <= st[i]) return juce::Colour(cs[i - 1]).interpolatedWith(juce::Colour(cs[i]), (float) ((db - st[i - 1]) / (st[i] - st[i - 1]))); return juce::Colour(cs[5]);
}
inline double toDb(double x) { return 20.0 * std::log10(std::max(x, 1.0e-6)); }
inline void paintBox(juce::Graphics& g, juce::Rectangle<float> r, juce::Colour bg, juce::Colour border, float rad = 5.f, float bw = 1.f)
{
    if (!bg.isTransparent()) { g.setColour(bg); g.fillRoundedRectangle(r, rad); }
    if (bw > 0 && !border.isTransparent()) { g.setColour(border); g.drawRoundedRectangle(r.reduced(bw * .5f), rad, bw); }
}
inline void paintText(juce::Graphics& g, const juce::String& s, juce::Rectangle<float> r, juce::Colour c, const juce::Font& f, juce::Justification j = juce::Justification::centred)
{ g.setColour(c); g.setFont(f); g.drawText(s, r, j, false); }
inline const char* srcName(int i) { static const char* n[whisker::kNumSrc] = {"Env 1 (Amp)", "Env 2 (Filter)", "Env 3", "Env 4", "Env 5", "Env 6", "Env 7", "Env 8", "Env 9", "Env 10", "Env 11", "Env 12", "Env 13", "Env 14", "Env 15", "Env 16", "LFO 1", "LFO 2", "LFO 3", "LFO 4", "Macro 1", "Macro 2", "Macro 3", "Macro 4", "Macro 5", "Macro 6", "Macro 7", "Macro 8", "Velocity", "Key", "Mod Wheel", "Pitch Bend", "Aftertouch", "Random"}; return n[i]; }
inline const char* srcId(int i) { static const char* n[whisker::kNumSrc] = {"e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "e10", "e11", "e12", "e13", "e14", "e15", "e16", "l1", "l2", "l3", "l4", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "vel", "key", "wheel", "bend", "at", "rnd"}; return n[i]; }
inline juce::Colour srcColour(const juce::String& s) { return s.startsWithChar('e') ? cGold : s.startsWithChar('l') ? juce::Colour(0xff6CC9F5) : s.startsWithChar('m') ? cPink : cDim; }
} // namespace wwui
