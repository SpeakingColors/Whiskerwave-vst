#include "PluginEditor.h"
#include <juce_dsp/juce_dsp.h>
using namespace whisker; using namespace wwui; using namespace wwl;
namespace { constexpr int kCheek = 36; constexpr float kPageX = 10.f, kPageY = 96.f, kPageW = kW - 20.f, kPageH = 646.f;
juce::Rectangle<float> rc(float x, float y, float w, float h) { return { x, y, w, h }; } }
using Ed = WhiskerwaveEditor;

// ================================================================= one control of the mockup
struct Ed::Widget : public juce::Component, public juce::SettableTooltipClient
{
    Ed& ed; const Ctl* c = nullptr; char type; Bind b; double last = -1.0e30, startN = 0; int lastAux = -1; juce::String lastText; bool over = false;
    Widget(Ed& e, const Ctl* ctl) : ed(e), c(ctl), type(ctl->type) { setBounds(juce::Rectangle<float>(c->x, c->y, c->w, c->h).getSmallestIntegerContainer()); rebind(); }
    Widget(Ed& e, char t, Bind bb) : ed(e), type(t), b(std::move(bb)) { setTooltip(b.tip); }
    float ox() const { return c ? c->x - (float) getX() : 0.f; } float oy() const { return c ? c->y - (float) getY() : 0.f; }
    juce::Rectangle<float> area() const { return c ? rc(ox(), oy(), c->w, c->h) : getLocalBounds().toFloat(); }
    void rebind()
    {
        if (c == nullptr) return;
        if (type == 'k' || type == 's' || type == 'g' || type == 't' || type == 'l' || type == 'f') b = bindParam(ed.proc, ed.keyFor(c->key, c->grp));
        juce::String t = juce::String::fromUTF8(c->tip); if (t.isEmpty()) t = b.tip; setTooltip(t); last = -1.0e30; repaint();
    }
    int tabIdx() const { return ed.proc.tableOf(ed.oscOf(c->grp)); }
    void tick()
    {
        if (type == 'c') { repaint(); return; }
        if (type == 'n') { if (lastText != ed.proc.patchName) { lastText = ed.proc.patchName; repaint(); } return; }
        if (type == 'T') { const int t = tabIdx(); if (t != lastAux) { lastAux = t; repaint(); } return; }
        if (type == 'q' || type == 'L') { repaint(); return; }
        if (b.valid()) { const double v = b.get(); if (v != last) { last = v; repaint(); } }
    }
    void setV(double v) { if (b.valid()) { b.set(juce::jlimit(b.mn, b.mx, v)); } }
    void paint(juce::Graphics& g) override;
    void paintDisplay(juce::Graphics& g, juce::Rectangle<float> r);
    void mouseDown(const juce::MouseEvent& e) override;
    void mouseDrag(const juce::MouseEvent& e) override;
    void mouseUp(const juce::MouseEvent&) override { if ((type == 'k' || type == 'f') && b.valid() && dragging) { b.end(); dragging = false; } if (type == 'w' && c && c->a == 0) { wheelV = 0; ed.proc.midiFromUi(juce::MidiMessage::pitchWheel(1, 8192)); repaint(); } }
    void mouseDoubleClick(const juce::MouseEvent&) override { if ((type == 'k' || type == 'f') && b.valid()) { b.begin(); b.set(b.def); b.end(); } }
    void mouseWheelMove(const juce::MouseEvent&, const juce::MouseWheelDetails& w) override { if ((type == 'k' || type == 'f') && b.valid()) { b.begin(); b.set(b.fromN(b.toN(b.get()) + w.deltaY * .15)); b.end(); } }
    void menuFor(juce::StringArray items, int current, std::function<void(int)> fn)
    {
        juce::PopupMenu m; for (int i = 0; i < items.size(); ++i) m.addItem(i + 1, items[i], true, i == current);
        m.setLookAndFeel(&getLookAndFeel()); m.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(this), [fn](int r) { if (r > 0) fn(r - 1); });
    }
    bool dragging = false; double wheelV = 0; int seqStart = 0;
};

void Ed::Widget::paint(juce::Graphics& g)
{
    const auto r = area(); const bool dim = c && c->grp >= 1 && c->grp <= 3 && ed.proc.paramValue(pidx(std::string(1, "abcdef"[ed.oscOf(c->grp)]) + ".on")) < .5f && type != 'l' && type != 'G';
    if (dim) g.setOpacity(.45f);
    const float al = dim ? .45f : 1.f;
    switch (type)
    {
        case 'k':
        {
            if (!b.valid()) return; const double v = b.get(), n = b.toN(v);
            const auto cr = c ? rc(c->cx - (float) getX(), c->cy - (float) getY(), c->cw, c->ch) : rc((getWidth() - 40) / 2.f, 0, 40, 40);
            paintKnob(g, cr, n, b.bipolar(), al);
            int k = 0; for (auto& s : ed.proc.slots) if (s.d == b.key && !s.b) { const float cx = cr.getCentreX(), cy = cr.getCentreY(), rr = cr.getWidth() / 2 - 7, a0 = juce::MathConstants<float>::pi * 1.25f, sw = juce::MathConstants<float>::pi * 1.5f; const double lo = juce::jlimit(0.0, 1.0, n), hi = juce::jlimit(0.0, 1.0, n + s.a);
                juce::Path p; p.addCentredArc(cx, cy, rr, rr, 0, a0 + sw * (float) std::min(lo, hi), a0 + sw * (float) std::max(lo, hi), true); g.setColour(srcColour(s.s).withMultipliedAlpha(al)); g.strokePath(p, juce::PathStrokeType(2.f)); ++k; }
            const float ly = c ? c->a / 10.f + oy() : cr.getBottom() + 2, vy = c ? c->b / 10.f + oy() : cr.getBottom() + 14, lfs = c ? c->lfs : 9.f, vfs = c ? c->vfs : 9.f;
            paintText(g, (c ? juce::String::fromUTF8(c->label) : b.label).toUpperCase(), rc(-10, ly - 1, (float) getWidth() + 20, lfs + 3), cDim.withMultipliedAlpha(al), font(lfs, 400, false, .4f));
            paintText(g, b.text(v), rc(-10, vy - 1, (float) getWidth() + 20, vfs + 3), cGold.withMultipliedAlpha(al), font(vfs, 400, true, .2f));
            break;
        }
        case 's': case 'T':
        {
            paintBox(g, r, cBtn.withMultipliedAlpha(al), cLine.withMultipliedAlpha(al));
            const juce::String t = type == 'T' ? juce::String(kTableNames[juce::jlimit(0, kNumTables - 1, tabIdx())]) : (b.valid() ? b.text(b.get()) : juce::String());
            paintText(g, t, r.withTrimmedLeft(8).withTrimmedRight(18), cText.withMultipliedAlpha(al), font(12), juce::Justification::centredLeft);
            juce::Path ch; const float ax = r.getRight() - 12, ay = r.getCentreY() - 2; ch.startNewSubPath(ax - 4, ay); ch.lineTo(ax, ay + 4); ch.lineTo(ax + 4, ay); g.setColour(cText.withMultipliedAlpha(al)); g.strokePath(ch, juce::PathStrokeType(1.8f));
            break;
        }
        case 'g': case 'G': case 'N': case 'L':
        {
            int cur = 0; if (type == 'g' && b.valid()) cur = (int) std::lround(b.get()); else if (type == 'G') cur = ed.oscSel[c->grp - 1]; else if (type == 'N') cur = ed.envSel - 1; else if (type == 'L') cur = ed.proc.seq.len / 4 - 1;
            g.saveState(); juce::Path clip; clip.addRoundedRectangle(r, 5.f); g.reduceClipRegion(clip);
            for (int i = c->a; i < c->b; ++i) { const auto& ce = kCells[i]; const auto cr = rc(ce.x - (float) getX(), ce.y - (float) getY(), ce.w, ce.h); const bool on = i - c->a == cur; g.setColour((on ? cSelBg : cBtn).withMultipliedAlpha(al)); g.fillRect(cr); paintText(g, juce::String::fromUTF8(ce.s), cr, (on ? cMist : cDim).withMultipliedAlpha(al), font(11, 600, false, .2f)); }
            g.restoreState(); g.setColour(cLine.withMultipliedAlpha(al)); g.drawRoundedRectangle(r.reduced(.5f), 5.f, 1.f);
            break;
        }
        case 't': { const bool on = b.valid() && b.get() >= .5; paintBox(g, r, on ? cSelBg : cBtn, on ? cLilac : cLine); paintText(g, c ? juce::String::fromUTF8(c->label) : b.label, r, on ? cMist : cText, font(on ? 11.f : 12.f)); break; }
        case 'l': { const bool on = b.valid() && b.get() >= .5; juce::ColourGradient gr(on ? juce::Colour(0xffb8ffc9) : juce::Colour(0xffffb8b8), r.getX() + r.getWidth() * .35f, r.getY() + r.getHeight() * .35f, on ? juce::Colour(0xff2fe07a) : juce::Colour(0xffd92c2c), r.getRight(), r.getBottom(), true);
            if (on) { g.setColour(juce::Colour(0x553be07a)); g.fillEllipse(r.expanded(3)); } g.setGradientFill(gr); g.fillEllipse(r); break; }
        case 'a': { const bool save = juce::String(c->label) == "Save"; paintBox(g, r, save ? cSelBg : cBtn, save ? cLilac : cLine); paintText(g, juce::String::fromUTF8(c->label), r, save ? cMist : cText, font(12)); break; }
        case 'b': { const bool on = ed.page == c->a; g.setColour(on ? cBtn : cPanel); g.fillRoundedRectangle(r, 6.f); g.setColour(on ? cLilac : cLine); g.drawRoundedRectangle(r.reduced(.5f), 6.f, 1.f);
            static const char* names[8] = {"SOUND", "FILTER", "MOD + MATRIX", "FX", "MIXER", "ARP", "WAVE LAB", "PRESETS"}; paintText(g, names[c->a], r, on ? cAcc : cDim, font(14, 700, false, 1.2f)); break; }
        case 'n': { paintBox(g, r, cDisp, cLine); paintText(g, ed.proc.patchName, r.reduced(6, 0), cGold, font(14, 400, false, .2f)); break; }
        case 'f':
        {
            if (!b.valid()) return; const float tx = r.getCentreX(), top = r.getY(), h = r.getHeight(); g.setColour(cDisp); g.fillRoundedRectangle(tx - 3, top, 6, h, 3); g.setColour(cLine); g.drawRoundedRectangle(tx - 3, top, 6, h, 3, 1);
            const double db = b.get(); const float y = top + (float) ((6.0 - juce::jlimit(-60.0, 6.0, db)) / 66.0) * h;
            juce::ColourGradient gr(juce::Colour(0xffe8e8ec), tx, y - 7, juce::Colour(0xff8f9098), tx, y + 7, false); g.setGradientFill(gr); g.fillRoundedRectangle(tx - 12.5f, y - 7, 25, 14, 2.5f); g.setColour(juce::Colour(0xff111111)); g.drawLine(tx - 9, y, tx + 9, y, 1.f);
            break;
        }
        case 'q':
        {
            const auto& sq = ed.proc.seq; const int i = c->b; const bool act = i < sq.len; const float a2 = act ? 1.f : .3f; g.setColour(cDisp.withMultipliedAlpha(a2)); g.fillRoundedRectangle(r, 3); g.setColour(cLine.withMultipliedAlpha(a2)); g.drawRoundedRectangle(r.reduced(.5f), 3, 1);
            if (c->a == 0) { if (sq.on[i] >= .5) { g.setColour(cAcc.withMultipliedAlpha(a2)); g.fillRoundedRectangle(r.reduced(1), 3); } }
            else if (c->a == 1) { g.setColour(juce::Colour(0xff8a2be2).withMultipliedAlpha(a2)); g.fillRoundedRectangle(r.reduced(1).withTrimmedTop((r.getHeight() - 2) * (float) (1 - sq.vel[i])), 3); paintText(g, juce::String((int) std::lround(sq.vel[i] * 127)), r.withHeight(18), cText.withMultipliedAlpha(a2), font(10, 400, true)); }
            else if (c->a == 2) { paintText(g, juce::String((int) std::lround(sq.semi[i])), r.withHeight(18), cText.withMultipliedAlpha(a2), font(10, 400, true)); const float mid = r.getCentreY() + 6, hh = (float) (sq.semi[i] / 24.0) * (r.getHeight() / 2 - 10); g.setColour(juce::Colour(0xff8a2be2).withMultipliedAlpha(a2)); if (std::abs(hh) > .5f) g.fillRect(r.getX() + 2, hh > 0 ? mid - hh : mid, r.getWidth() - 4, std::abs(hh)); }
            else { paintText(g, juce::String((int) std::lround(sq.rat[i])) + "x", r.withHeight(18), cText.withMultipliedAlpha(a2), font(10, 400, true)); g.setColour(juce::Colour(0xff8a2be2).withMultipliedAlpha(a2)); const float hh = 12.f * (float) sq.rat[i] / 1.f; g.fillRect(r.getX() + 1, r.getBottom() - 1 - std::min(hh, r.getHeight() - 20), r.getWidth() - 2, std::min(hh, r.getHeight() - 20)); }
            break;
        }
        case 'w': { paintBox(g, r, juce::Colour(0xff101114), cLine, 4); const float y = c->a == 0 ? r.getCentreY() - (float) wheelV * (r.getHeight() / 2 - 6) : r.getBottom() - 6 - (float) wheelV * (r.getHeight() - 12); g.setColour(cAcc); g.fillRoundedRectangle(r.getX() + 3, y - 2, r.getWidth() - 6, 4, 2); break; }
        case 'c': paintDisplay(g, r); break;
        default: break;
    }
}

void Ed::Widget::paintDisplay(juce::Graphics& g, juce::Rectangle<float> r)
{
    paintBox(g, r, cDisp, cLine, 4); auto& P = ed.proc; g.saveState(); g.reduceClipRegion(r.reduced(1).getSmallestIntegerContainer());
    const int kind = c->a;
    if (kind == 1) // header meter with dB scale
    {
        const float x0 = r.getX() + 4, w = r.getWidth() - 8; auto xdb = [&](double db) { return x0 + (float) juce::jlimit(0.0, 1.0, (db + 60.0) / 66.0) * w; };
        const double l = toDb(P.outL.load()), rr = toDb(P.outR.load());
        for (int ch = 0; ch < 2; ++ch) { const double db = ch ? rr : l; const float y = r.getY() + 5 + ch * 8.f; g.setColour(cGrid); g.fillRect(x0, y, w, 6.f); if (db > -60) { juce::ColourGradient gr(meterColour(-60), x0, 0, meterColour(6), x0 + w, 0, false); gr.addColour(26.0 / 66, meterColour(-34)); gr.addColour(38.0 / 66, meterColour(-22)); gr.addColour(52.0 / 66, meterColour(-8)); gr.addColour(59.0 / 66, meterColour(-1)); g.setGradientFill(gr); g.fillRect(x0, y, xdb(db) - x0, 6.f); } }
        for (int db : { -48, -36, -24, -12, -6, 0 }) { g.setColour(cDim); g.setFont(font(7, 400, true)); g.drawText(juce::String(db), juce::Rectangle<float>(xdb(db) - 12, r.getBottom() - 12, 24, 10), juce::Justification::centred, false); g.setColour(cLine); g.fillRect(xdb(db), r.getY() + 4, 1.f, 16.f); }
    }
    else if (kind == 2) // scope
    {
        const float* sc = P.engine->scope; const int sp = P.engine->sp; juce::Path p; const int n = 512; for (int i = 0; i < n; ++i) { const float v = sc[(sp - n + i + 2048) & 2047]; const float x = r.getX() + r.getWidth() * i / (n - 1.f), y = r.getCentreY() - juce::jlimit(-1.f, 1.f, v) * (r.getHeight() / 2 - 4); if (i) p.lineTo(x, y); else p.startNewSubPath(x, y); }
        g.setColour(cGrid); g.fillRect(r.getX(), r.getCentreY(), r.getWidth(), 1.f); g.setColour(cAcc); g.strokePath(p, juce::PathStrokeType(1.4f));
    }
    else if (kind == 3) // spectrum, -80 to -20 dB
    {
        static juce::dsp::FFT fft(10); static juce::dsp::WindowingFunction<float> win(1024, juce::dsp::WindowingFunction<float>::hann); float buf[2048] = {}; const float* sc = P.engine->scope; const int sp = P.engine->sp;
        for (int i = 0; i < 1024; ++i) buf[i] = sc[(sp - 1024 + i + 2048) & 2047]; win.multiplyWithWindowingTable(buf, 1024); fft.performFrequencyOnlyForwardTransform(buf);
        const double sr = P.getSampleRate() > 0 ? P.getSampleRate() : 44100.0; auto xf = [&](double f) { return r.getX() + 22 + (float) (std::log(f / 30.0) / std::log(20000.0 / 30.0)) * (r.getWidth() - 26); }; auto yd = [&](double db) { return r.getY() + 4 + (float) juce::jlimit(0.0, 1.0, (-20.0 - db) / 60.0) * (r.getHeight() - 16); };
        g.setFont(font(7, 400, true)); for (int db : { -20, -40, -60, -80 }) { g.setColour(cGrid); g.fillRect(r.getX() + 20, yd(db), r.getWidth() - 22, 1.f); g.setColour(cDim); g.drawText(juce::String(db), juce::Rectangle<float>(r.getX() + 1, yd(db) - 5, 18, 10), juce::Justification::centredRight, false); }
        for (auto f : { 100.0, 1000.0, 10000.0 }) { g.setColour(cGrid); g.fillRect(xf(f), r.getY() + 3, 1.f, r.getHeight() - 14); g.setColour(cDim); g.drawText(f >= 1000 ? juce::String((int) (f / 1000)) + "k" : juce::String((int) f), juce::Rectangle<float>(xf(f) - 12, r.getBottom() - 10, 24, 9), juce::Justification::centred, false); }
        juce::Path p; bool st = false; for (int k = 1; k < 512; ++k) { const double f = k * sr / 1024.0; if (f < 30 || f > 20000) continue; const double db = toDb(buf[k] / 256.0); const float x = xf(f), y = yd(db); if (st) p.lineTo(x, y); else { p.startNewSubPath(x, y); st = true; } }
        g.setColour(cPurple); g.strokePath(p, juce::PathStrokeType(1.2f));
    }
    else if (kind == 4) // wavetable: all frames behind, the playing frame in front
    {
        const int o = ed.oscOf(c->grp); const auto& I = idx(); const int ti = juce::jlimit(0, kNumTables - 1, P.tableOf(o)); const Table* t = P.tables.get(ti, P.paramValue(I.osc[o].sw), P.paramValue(I.osc[o].sk));
        const float pos = P.paramValue(I.osc[o].pos); const float fx = pos * (kTableFrames - 1); const int cf = (int) std::lround(fx);
        const float x0 = r.getX() + 14, w = r.getWidth() - 110, base = r.getBottom() - 30, amp = 26.f;
        if (t != nullptr) for (int f = kTableFrames - 1; f >= 0; --f)
        {
            const float dx = f * 2.6f, dy = f * 1.9f; const float* d = t->frame(0, f); juce::Path p; for (int i = 0; i <= 96; ++i) { const float v = d[(i * 2047) / 96]; const float x = x0 + dx + w * i / 96.f, y = base - dy - v * amp; if (i) p.lineTo(x, y); else p.startNewSubPath(x, y); }
            if (f == cf) { g.setColour(cAcc); g.strokePath(p, juce::PathStrokeType(2.4f)); } else { g.setColour(cPurple.withAlpha(.35f)); g.strokePath(p, juce::PathStrokeType(.8f)); }
        }
        g.setFont(font(9, 400, true)); g.setColour(cDim); g.drawText(kTableNames[ti], r.reduced(7, 4), juce::Justification::topLeft, false); g.drawText("frame " + juce::String(fx + 1, 1) + "/" + juce::String(kTableFrames), r.reduced(7, 4), juce::Justification::topRight, false);
    }
    else if (kind == 5) // envelope shape of the selected modulator
    {
        const juce::String e = "e" + juce::String(ed.envSel) + "."; auto pv = [&](const char* k) { const int i = pidx((e + k).toStdString()); return i >= 0 ? (double) P.paramValue(i) : 0.0; };
        const double a = pv("a"), hd = pv("h"), d = pv("d"), s = pv("s"), rl = pv("r"), tot = std::max(50.0, a + hd + d + rl) * 1.25; const float x0 = r.getX() + 3, w = r.getWidth() - 6, yb = r.getBottom() - 4, hh = r.getHeight() - 8; auto X = [&](double ms) { return x0 + (float) (ms / tot) * w; };
        juce::Path p; p.startNewSubPath(X(0), yb); p.lineTo(X(a), yb - hh); p.lineTo(X(a + hd), yb - hh); for (int i = 1; i <= 24; ++i) { const double q = i / 24.0; p.lineTo(X(a + hd + d * q), yb - hh * (float) (s + (1 - s) * std::exp(-4 * q))); }
        const double sus = tot - (a + hd + d + rl); p.lineTo(X(a + hd + d + sus), yb - hh * (float) s); for (int i = 1; i <= 24; ++i) { const double q = i / 24.0; p.lineTo(X(a + hd + d + sus + rl * q), yb - hh * (float) (s * std::exp(-4 * q))); }
        juce::Path fill = p; fill.lineTo(X(tot), yb); fill.closeSubPath(); g.setColour(cGold.withAlpha(.12f)); g.fillPath(fill); g.setColour(cGold); g.strokePath(p, juce::PathStrokeType(1.6f));
    }
    else if (kind == 7) // mixer meter with dB scale positions matching the fader
    {
        const auto& m = P.engine->meter[juce::jlimit(0, 7, c->b)]; const double db[2] = { toDb(m.l), toDb(m.r) };
        for (int ch = 0; ch < 2; ++ch) { const float x = r.getX() + 4 + ch * (r.getWidth() / 2 - 1), w = r.getWidth() / 2 - 7, top = r.getY() + 4, h = r.getHeight() - 8; const float lv = (float) juce::jlimit(0.0, 1.0, (db[ch] + 60.0) / 66.0); if (lv > 0) { juce::ColourGradient gr(meterColour(-60), 0, top + h, meterColour(6), 0, top, false); gr.addColour(26.0 / 66, meterColour(-34)); gr.addColour(38.0 / 66, meterColour(-22)); gr.addColour(52.0 / 66, meterColour(-8)); gr.addColour(59.0 / 66, meterColour(-1)); g.setGradientFill(gr); g.fillRect(x, top + h * (1 - lv), w, h * lv); } }
    }
    g.restoreState();
}

void Ed::Widget::mouseDown(const juce::MouseEvent& e)
{
    switch (type)
    {
        case 'k': case 'f':
            if (!b.valid()) return;
            if (e.mods.isPopupMenu() && c != nullptr && type == 'k' && !b.key.startsWith("fx:"))
            {
                juce::PopupMenu m, src; for (int i = 0; i < kNumSrc; ++i) src.addItem(100 + i, srcName(i)); m.addItem(1, "Reset to default"); m.addSubMenu("Modulate with", src);
                int k = 0; for (auto& s : ed.proc.slots) { if (s.d == b.key) m.addItem(1000 + k, "Remove " + juce::String(srcName(juce::jmax(0, juce::StringArray(juce::StringArray::fromTokens("e1 e2 e3 e4 e5 e6 e7 e8 e9 e10 e11 e12 e13 e14 e15 e16 l1 l2 l3 l4 m1 m2 m3 m4 m5 m6 m7 m8 vel key wheel bend at rnd", " ", "")).indexOf(s.s))))); ++k; }
                juce::Component::SafePointer<Widget> self(this);
                m.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(this), [self](int r) { if (self == nullptr || r <= 0) return; auto& w = *self; if (r == 1) { w.b.begin(); w.b.set(w.b.def); w.b.end(); } else if (r >= 1000) { const int ix = r - 1000; if (ix < (int) w.ed.proc.slots.size()) { w.ed.proc.slots.erase(w.ed.proc.slots.begin() + ix); w.ed.proc.commitSlots(); } } else if (r >= 100) { SlotDesc s; s.s = srcId(r - 100); s.d = w.b.key; s.a = .5; w.ed.proc.slots.push_back(s); w.ed.proc.commitSlots(); } w.repaint(); });
                return;
            }
            b.begin(); dragging = true; startN = type == 'f' ? 0 : b.toN(b.get()); if (type == 'f') mouseDrag(e); break;
        case 's': if (b.valid()) { juce::Component::SafePointer<Widget> self(this); menuFor(b.items, (int) std::lround(b.get()), [self](int i) { if (self != nullptr) { self->b.begin(); self->b.set(i); self->b.end(); } }); } break;
        case 'T': { juce::Component::SafePointer<Widget> self(this); juce::StringArray n; for (int i = 0; i < kNumTables; ++i) n.add(kTableNames[i]); menuFor(n, tabIdx(), [self](int i) { if (self != nullptr) if (auto* p = self->ed.proc.apvts.getParameter(juce::String("abcdef").substring(self->ed.oscOf(self->c->grp), self->ed.oscOf(self->c->grp) + 1) + "_tab")) p->setValueNotifyingHost(p->convertTo0to1((float) i)); }); break; }
        case 'g': case 'G': case 'N': case 'L':
            for (int i = c->a; i < c->b; ++i) if (rc(kCells[i].x - (float) getX(), kCells[i].y - (float) getY(), kCells[i].w, kCells[i].h).contains(e.position))
            { const int k = i - c->a; if (type == 'g' && b.valid()) { b.begin(); b.set(k); b.end(); } else if (type == 'G') { ed.oscSel[c->grp - 1] = k; ed.rebindAll(); } else if (type == 'N') { ed.envSel = k + 1; ed.rebindAll(); } else if (type == 'L') { ed.proc.seq.len = (k + 1) * 4; ed.proc.commitShapes(); } }
            break;
        case 't': case 'l': if (b.valid()) { b.begin(); b.set(b.get() >= .5 ? 0 : 1); b.end(); } break;
        case 'a': ed.action(c->a, c->grp); break;
        case 'b': ed.setPage(c->a); break;
        case 'n': ed.showPresetMenu(this); break;
        case 'q': { auto& sq = ed.proc.seq; const int i = c->b; if (c->a == 0) sq.on[i] = sq.on[i] >= .5 ? 0 : 1; else if (c->a == 3) sq.rat[i] = sq.rat[i] >= 4 ? 1 : sq.rat[i] + 1; else mouseDrag(e); ed.proc.commitShapes(); repaint(); break; }
        case 'w': mouseDrag(e); break;
        default: break;
    }
}
void Ed::Widget::mouseDrag(const juce::MouseEvent& e)
{
    const auto r = area();
    if (type == 'k' && dragging) b.set(b.fromN(startN - e.getDistanceFromDragStartY() / (e.mods.isShiftDown() ? 900.0 : 170.0)));
    else if (type == 'f' && dragging) b.set(6.0 - juce::jlimit(0.0, 1.0, (double) ((e.position.y - r.getY()) / r.getHeight())) * 66.0);
    else if (type == 'q' && (c->a == 1 || c->a == 2)) { auto& sq = ed.proc.seq; const double q = juce::jlimit(0.0, 1.0, 1.0 - (double) ((e.position.y - r.getY()) / r.getHeight())); if (c->a == 1) sq.vel[c->b] = q; else sq.semi[c->b] = std::round((q * 2 - 1) * 24); ed.proc.commitShapes(); repaint(); }
    else if (type == 'w') { const double q = juce::jlimit(0.0, 1.0, 1.0 - (double) ((e.position.y - r.getY()) / r.getHeight())); if (c->a == 0) { wheelV = q * 2 - 1; ed.proc.midiFromUi(juce::MidiMessage::pitchWheel(1, juce::jlimit(0, 16383, 8192 + (int) (wheelV * 8191)))); } else { wheelV = q; ed.proc.midiFromUi(juce::MidiMessage::controllerEvent(1, 1, (int) (q * 127))); } repaint(); }
}

// ================================================================= keyboard
struct Ed::Keyboard : public juce::Component
{
    Ed& ed; int down = -1; juce::Rectangle<float> bounds;
    explicit Keyboard(Ed& e) : ed(e) { for (int i = 0; i < kNumKeys; ++i) { const auto r = rc(kKeys[i].x, kKeys[i].y, kKeys[i].w, kKeys[i].h); bounds = i ? bounds.getUnion(r) : r; } setBounds(bounds.getSmallestIntegerContainer()); }
    int keyAt(juce::Point<float> p) const { const auto q = p + getPosition().toFloat(); for (int pass = 1; pass >= 0; --pass) for (int i = 0; i < kNumKeys; ++i) if (kKeys[i].black == pass && rc(kKeys[i].x, kKeys[i].y, kKeys[i].w, kKeys[i].h).contains(q)) return i; return -1; }
    void paint(juce::Graphics& g) override
    {
        for (int pass = 0; pass < 2; ++pass) for (int i = 0; i < kNumKeys; ++i) if (kKeys[i].black == pass)
        {
            const auto r = rc(kKeys[i].x - (float) getX(), kKeys[i].y - (float) getY(), kKeys[i].w, kKeys[i].h); const bool on = i == down;
            if (pass == 0) { juce::ColourGradient gr(juce::Colour(0xfff4f4f4), 0, r.getY(), juce::Colour(0xffcfcfcf), 0, r.getBottom(), false); if (on) g.setColour(cAcc); else g.setGradientFill(gr); g.fillRoundedRectangle(r.reduced(.5f, 0), 2); g.setColour(juce::Colour(0xff222222)); g.drawRoundedRectangle(r.reduced(.5f, 0), 2, 1);
                if (kKeys[i].note % 12 == 0) { g.setColour(juce::Colour(0xff333333)); g.setFont(font(9)); g.drawText("C" + juce::String(kKeys[i].note / 12 - 1), r.withTrimmedTop(r.getHeight() - 14).translated(3, 0), juce::Justification::centredLeft, false); } }
            else { juce::ColourGradient gr(juce::Colour(0xff333333), 0, r.getY(), juce::Colour(0xff000000), 0, r.getBottom(), false); if (on) g.setColour(cAcc.darker(.3f)); else g.setGradientFill(gr); g.fillRoundedRectangle(r, 2); }
        }
    }
    void press(int k, float vel) { if (k == down) return; if (down >= 0) ed.proc.noteFromUi(kKeys[down].note, 0, false); down = k; if (k >= 0) ed.proc.noteFromUi(kKeys[k].note, vel, true); repaint(); }
    void mouseDown(const juce::MouseEvent& e) override { const int k = keyAt(e.position); press(k, k >= 0 ? juce::jlimit(.2f, 1.f, (e.position.y + (float) getY() - kKeys[k].y) / kKeys[k].h * .8f + .3f) : .8f); }
    void mouseDrag(const juce::MouseEvent& e) override { press(keyAt(e.position), .8f); }
    void mouseUp(const juce::MouseEvent&) override { press(-1, 0); }
};

// ================================================================= FX page: chains per track, each effect as often as you like
struct Ed::FxPage : public juce::Component
{
    Ed& ed; int bus = 6; std::vector<std::pair<std::string, int>> path; std::string sel; juce::OwnedArray<Widget> ctl; juce::String note;
    explicit FxPage(Ed& e) : ed(e) { setBounds((int) kPageX, (int) kPageY, (int) kPageW, (int) kPageH); rebuild(); }
    static std::vector<NodeP> listAt(const std::vector<NodeP>& root, const std::vector<std::pair<std::string, int>>& p, size_t d) { if (d == p.size()) return root; for (auto& n : root) if (n->id == p[d].first) return listAt(n->bands[p[d].second], p, d + 1); return {}; }
    static std::vector<NodeP> withList(const std::vector<NodeP>& root, const std::vector<std::pair<std::string, int>>& p, size_t d, const std::vector<NodeP>& nl)
    { if (d == p.size()) return nl; auto out = root; for (auto& n : out) if (n->id == p[d].first) { auto cp = std::make_shared<FxNode>(*n); cp->bands[p[d].second] = withList(n->bands[p[d].second], p, d + 1, nl); n = cp; } return out; }
    std::vector<NodeP> list() const { return listAt(ed.proc.chains[bus], path, 0); }
    void setList(const std::vector<NodeP>& l) { ed.proc.chains[bus] = withList(ed.proc.chains[bus], path, 0, l); ed.proc.commitChains(); rebuild(); }
    NodeP selected() const { for (auto& n : list()) if (n->id == sel) return n; return {}; }
    juce::Rectangle<float> busRect(int i) const { static const float w[7] = {44, 40, 40, 44, 44, 44, 78}; float x = 110; for (int k = 0; k < i; ++k) x += w[k] + 2; return rc(x, 12, w[i], 22); }
    static int busOf(int i) { static const int m[7] = {6, 4, 5, 0, 1, 2, 3}; return m[i]; }
    juce::Rectangle<float> rowRect(int i) const { return rc(20, 96 + i * 34.f, 200, 28); }
    juce::Rectangle<float> addRect() const { return rc(20, 96 + (float) list().size() * 34.f + 2, 200, 22); }
    void rebuild()
    {
        ctl.clear(); const auto l = list(); if (!selected() && !l.empty()) sel = l.front()->id; const auto n = selected(); if (!n) { repaint(); return; }
        const auto& sp = kFx[n->type]; float x = 260, y = 150; int col = 0;
        for (int i = 0; i < sp.np; ++i)
        {
            auto b = bindFx(n, i); const bool isList = sp.ps[i].kind == PK::List, isTog = sp.ps[i].kind == PK::Int && sp.ps[i].mn == 0 && sp.ps[i].mx == 1;
            auto* w = ctl.add(new Widget(ed, isList ? 's' : isTog ? 't' : 'k', b)); addAndMakeVisible(w);
            if (isList) { w->setBounds((int) x, (int) y + 14, 118, 22); x += 128; } else if (isTog) { w->setBounds((int) x, (int) y + 14, 64, 20); x += 74; } else { w->setBounds((int) x, (int) y, 62, 70); x += 66; }
            if (x > kPageW - 80) { x = 260; y += 84; ++col; }
        }
        repaint();
    }
    void paint(juce::Graphics& g) override
    {
        paintBox(g, rc(0, 4, kPageW, 38), cPanel, cLine, 7); paintText(g, "APPLY EFFECTS TO", rc(10, 12, 96, 22), cDim, font(10, 400, false, .8f), juce::Justification::centredLeft);
        static const char* bn[7] = {"Main", "FX 1", "FX 2", "A + D", "B + E", "C + F", "Sub + Noise"};
        for (int i = 0; i < 7; ++i) { const bool on = busOf(i) == bus; paintBox(g, busRect(i), on ? cSelBg : cBtn, on ? cLilac : cLine); paintText(g, bn[i], busRect(i), on ? cMist : cDim, font(11, 600)); }
        paintBox(g, rc(0, 50, 232, kPageH - 54), cPanel, cLine, 7); paintText(g, "EFFECTS", rc(10, 58, 200, 16), cMist, font(13, 700, false, 1.f), juce::Justification::centredLeft);
        juce::String where = path.empty() ? juce::String("In order, top to bottom. Add the same effect as often as you like.") : juce::String("Inside band ") + juce::String(path.back().second + 1) + " of a Band Split. Click here to go back.";
        paintText(g, where, rc(10, 74, 212, 20), path.empty() ? cDim : cAcc, font(10), juce::Justification::centredLeft);
        const auto l = list(); int i = 0;
        for (auto& n : l) { const auto r = rowRect(i); const bool s = n->id == sel, on = n->st->on.load(); paintBox(g, r, s ? cSelBg : cBtn, s ? cAcc : cLine); g.setColour(on ? cAcc : cLine); g.fillEllipse(r.getX() + 8, r.getCentreY() - 4, 8, 8);
            paintText(g, juce::String(i + 1) + ". " + kFx[n->type].name, r.withTrimmedLeft(22).withTrimmedRight(62), on ? cText : cDim, font(12, 600), juce::Justification::centredLeft);
            static const char* bt[3] = {"^", "v", "x"}; for (int k = 0; k < 3; ++k) { const auto br = rc(r.getRight() - 60 + k * 19.f, r.getY() + 6, 16, 16); paintBox(g, br, cPanel, cLine, 3); paintText(g, bt[k], br, cDim, font(10, 400, true)); } ++i; }
        paintBox(g, addRect(), cBtn, cLine); paintText(g, "+ Add effect", addRect(), cText, font(12));
        paintBox(g, rc(240, 50, kPageW - 240, kPageH - 54), cPanel, cLine, 7); paintText(g, "MODULE", rc(250, 58, 200, 16), cMist, font(13, 700, false, 1.f), juce::Justification::centredLeft);
        if (auto n = selected())
        {
            const auto& sp = kFx[n->type]; const bool on = n->st->on.load(); paintText(g, sp.name, rc(260, 84, 240, 22), cText, font(16, 700), juce::Justification::centredLeft); paintText(g, juce::String(sp.cat).toUpperCase(), rc(260, 106, 120, 14), cDim, font(9, 400, false, .8f), juce::Justification::centredLeft);
            paintBox(g, rc(390, 86, 34, 20), on ? cSelBg : cBtn, on ? cLilac : cLine); paintText(g, on ? "On" : "Off", rc(390, 86, 34, 20), on ? cMist : cDim, font(11));
            g.setColour(cDim); g.setFont(font(11)); g.drawFittedText(sp.tip, 440, 80, (int) kPageW - 460, 44, juce::Justification::centredLeft, 3);
            for (auto* w : ctl) if (w->type != 'k') paintText(g, w->b.label.toUpperCase(), rc((float) w->getX(), (float) w->getY() - 13, 130, 11), cDim, font(9, 400, false, .4f), juce::Justification::centredLeft);
            float y = 150 + 84.f * (float) ((ctl.size() + 14) / 15 + 1);
            if (n->type == FX_tgate) { paintText(g, "STEPS", rc(260, y - 16, 80, 12), cDim, font(9, 400, false, .8f), juce::Justification::centredLeft); for (int k = 0; k < 16; ++k) { const auto r = rc(260 + k * 34.f, y, 30, 30); const bool s = n->st->pat[k].load() != 0; paintBox(g, r, s ? cAcc : cDisp, cLine, 3); } }
            if (n->type == FX_split) { const int nb = n->st->nb.load(); paintText(g, "BANDS", rc(260, y - 16, 80, 12), cDim, font(9, 400, false, .8f), juce::Justification::centredLeft);
                for (int k = 0; k < 3; ++k) { const auto r = rc(260 + k * 30.f, y, 28, 22); paintBox(g, r, nb == k + 2 ? cSelBg : cBtn, nb == k + 2 ? cLilac : cLine); paintText(g, juce::String(k + 2), r, nb == k + 2 ? cMist : cDim, font(11, 600)); }
                for (int k = 0; k < nb; ++k) { const auto r = rc(370 + k * 150.f, y, 142, 22); paintBox(g, r, cBtn, cAcc); paintText(g, "Band " + juce::String(k + 1) + " effects (" + juce::String((int) n->bands[k].size()) + ")", r, cText, font(11)); const float lv = n->st->bandMeter[k].load(); g.setColour(meterColour(toDb(lv))); g.fillRect(r.getX(), r.getBottom() + 3, r.getWidth() * (float) juce::jlimit(0.0, 1.0, (toDb(lv) + 60) / 66), 3.f); } }
        }
        else paintText(g, "No effect here yet. Use + Add effect.", rc(260, 90, 400, 20), cDim, font(12), juce::Justification::centredLeft);
    }
    void addMenu()
    {
        juce::PopupMenu m; for (int cI = 0; cI < kNumFxCats; ++cI) { juce::PopupMenu sub; for (int t = 0; t < kNumFxTypes; ++t) if (juce::String(kFx[t].cat) == kFxCats[cI]) sub.addItem(t + 1, kFx[t].name); if (sub.getNumItems() > 0) m.addSubMenu(kFxCats[cI], sub); }
        juce::Component::SafePointer<FxPage> self(this);
        m.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(this).withTargetScreenArea(localAreaToGlobal(addRect().toNearestInt())), [self](int r) { if (self == nullptr || r <= 0) return; auto l = self->list(); if (auto n = self->ed.proc.makeNode(kFx[r - 1].type)) { l.push_back(n); self->sel = n->id; self->setList(l); } });
    }
    void mouseDown(const juce::MouseEvent& e) override
    {
        const auto p = e.position;
        for (int i = 0; i < 7; ++i) if (busRect(i).contains(p)) { bus = busOf(i); path.clear(); sel.clear(); rebuild(); return; }
        if (!path.empty() && rc(10, 74, 212, 20).contains(p)) { sel = path.back().first; path.pop_back(); rebuild(); return; }
        auto l = list();
        for (int i = 0; i < (int) l.size(); ++i) { const auto r = rowRect(i); if (!r.contains(p)) continue; const float bx = p.x - (r.getRight() - 60);
            if (bx >= 0) { const int k = (int) (bx / 19); if (k == 0 && i > 0) std::swap(l[(size_t) i], l[(size_t) i - 1]); else if (k == 1 && i + 1 < (int) l.size()) std::swap(l[(size_t) i], l[(size_t) i + 1]); else if (k == 2) { l.erase(l.begin() + i); sel.clear(); } setList(l); return; }
            if (p.x < r.getX() + 20) { l[(size_t) i]->st->on = !l[(size_t) i]->st->on.load(); repaint(); return; } sel = l[(size_t) i]->id; rebuild(); return; }
        if (addRect().contains(p)) { addMenu(); return; }
        if (auto n = selected())
        {
            if (rc(390, 86, 34, 20).contains(p)) { n->st->on = !n->st->on.load(); repaint(); return; }
            const float y = 150 + 84.f * (float) ((ctl.size() + 14) / 15 + 1);
            if (n->type == FX_tgate) for (int k = 0; k < 16; ++k) if (rc(260 + k * 34.f, y, 30, 30).contains(p)) { n->st->pat[k] = n->st->pat[k].load() ? 0 : 1; repaint(); return; }
            if (n->type == FX_split) { for (int k = 0; k < 3; ++k) if (rc(260 + k * 30.f, y, 28, 22).contains(p)) { n->st->nb = k + 2; repaint(); return; } for (int k = 0; k < n->st->nb.load(); ++k) if (rc(370 + k * 150.f, y, 142, 22).contains(p)) { path.push_back({ n->id, k }); sel.clear(); rebuild(); return; } }
        }
    }
    void tick() { for (auto* w : ctl) w->tick(); if (auto n = selected()) if (n->type == FX_split) repaint(); }
};

// ================================================================= modulation matrix as a list (the grid view of the mockup is not ported yet)
struct Ed::MatrixPage : public juce::Component
{
    Ed& ed; int first = 0; int dragRow = -1; static constexpr int kRows = 12;
    explicit MatrixPage(Ed& e) : ed(e) { setBounds((int) kPageX, (int) kPageY + 172, (int) kPageW, (int) kPageH - 172); }
    juce::Rectangle<float> row(int i) const { return rc(14, 44 + i * 33.f, kPageW - 28, 28); }
    juce::String destName(const juce::String& d) const
    {
        if (d.startsWith("fx:")) { const auto rest = d.substring(3), id = rest.upToFirstOccurrenceOf(":", false, false), key = rest.fromFirstOccurrenceOf(":", false, false); std::function<juce::String(const std::vector<NodeP>&)> find = [&](const std::vector<NodeP>& l) -> juce::String { for (auto& n : l) { if (juce::String(n->id) == id) { const auto& sp = kFx[n->type]; for (int i = 0; i < sp.np; ++i) if (key == sp.ps[i].key) return juce::String(sp.name) + ": " + sp.ps[i].label; } for (auto& b : n->bands) { auto r = find(b); if (r.isNotEmpty()) return r; } } return {}; };
            for (auto& c : ed.proc.chains) { auto r = find(c); if (r.isNotEmpty()) return r; } return "Effect (removed)"; }
        const int i = pidx(d.toStdString()); return i >= 0 ? groupOf(kParams[i].key) + ": " + kParams[i].label : d;
    }
    void paint(juce::Graphics& g) override
    {
        paintBox(g, getLocalBounds().toFloat(), cPanel, cLine, 7); paintText(g, "MODULATION MATRIX", rc(14, 10, 240, 18), cMist, font(13, 700, false, 1.f), juce::Justification::centredLeft);
        auto& sl = ed.proc.slots; paintText(g, juce::String((int) sl.size()) + " / 64 routes. Right click any knob to modulate it, or add a route here.", rc(260, 10, 520, 18), cDim, font(11), juce::Justification::centredLeft);
        paintBox(g, rc(kPageW - 190, 9, 84, 20), cSelBg, cLilac); paintText(g, "+ Add route", rc(kPageW - 190, 9, 84, 20), cMist, font(11)); paintBox(g, rc(kPageW - 98, 9, 84, 20), cBtn, cLine); paintText(g, "Clear all", rc(kPageW - 98, 9, 84, 20), cText, font(11));
        for (int i = 0; i < kRows; ++i) { const int k = first + i; if (k >= (int) sl.size()) break; const auto r = row(i); const auto& s = sl[(size_t) k]; paintBox(g, r, cBtn, cLine);
            const int si = juce::StringArray::fromTokens("e1 e2 e3 e4 e5 e6 e7 e8 e9 e10 e11 e12 e13 e14 e15 e16 l1 l2 l3 l4 m1 m2 m3 m4 m5 m6 m7 m8 vel key wheel bend at rnd", " ", "").indexOf(s.s);
            g.setColour(srcColour(s.s)); g.fillEllipse(r.getX() + 8, r.getCentreY() - 5, 10, 10); paintText(g, si >= 0 ? srcName(si) : s.s, rc(r.getX() + 26, r.getY(), 150, r.getHeight()), cText, font(12, 600), juce::Justification::centredLeft);
            paintText(g, "to", rc(r.getX() + 180, r.getY(), 20, r.getHeight()), cDim, font(11)); paintText(g, destName(s.d), rc(r.getX() + 206, r.getY(), 330, r.getHeight()), cText, font(12), juce::Justification::centredLeft);
            const auto bar = rc(r.getX() + 560, r.getCentreY() - 4, 360, 8); g.setColour(cDisp); g.fillRoundedRectangle(bar, 4); g.setColour(cLine); g.fillRect(bar.getCentreX(), bar.getY() - 3, 1.f, 14.f); const float ax = bar.getCentreX() + (float) s.a * bar.getWidth() / 2; g.setColour(s.b ? cLine : srcColour(s.s)); g.fillRect(std::min(ax, bar.getCentreX()), bar.getY(), std::abs(ax - bar.getCentreX()), 8.f); g.setColour(cText); g.fillEllipse(ax - 5, bar.getCentreY() - 5, 10, 10);
            paintText(g, juce::String((int) std::lround(s.a * 100)) + "%", rc(r.getX() + 930, r.getY(), 50, r.getHeight()), cGold, font(10, 400, true));
            const auto ub = rc(r.getRight() - 236, r.getY() + 4, 70, 20); paintBox(g, ub, s.u ? cSelBg : cPanel, s.u ? cLilac : cLine); paintText(g, s.u ? "One way" : "Two way", ub, s.u ? cMist : cDim, font(10));
            const auto bb = rc(r.getRight() - 160, r.getY() + 4, 60, 20); paintBox(g, bb, s.b ? cSelBg : cPanel, s.b ? cLilac : cLine); paintText(g, s.b ? "Bypassed" : "Active", bb, s.b ? cMist : cDim, font(10));
            const auto xb = rc(r.getRight() - 30, r.getY() + 4, 20, 20); paintBox(g, xb, cPanel, cLine); paintText(g, "x", xb, cDim, font(10, 400, true)); }
        if ((int) sl.size() > kRows) { paintBox(g, rc(14, getHeight() - 30.f, 60, 20), cBtn, cLine); paintText(g, "< Prev", rc(14, getHeight() - 30.f, 60, 20), cText, font(11)); paintBox(g, rc(80, getHeight() - 30.f, 60, 20), cBtn, cLine); paintText(g, "Next >", rc(80, getHeight() - 30.f, 60, 20), cText, font(11)); }
        if (sl.empty()) paintText(g, "No modulation yet.", row(0), cDim, font(12));
    }
    juce::PopupMenu destMenu()
    {
        juce::PopupMenu m; juce::StringArray groups; std::vector<juce::PopupMenu> subs;
        for (int i = 0; i < kNumParams; ++i) { if (kParams[i].kind == PK::List) continue; const auto gname = groupOf(kParams[i].key); int gi = groups.indexOf(gname); if (gi < 0) { groups.add(gname); subs.emplace_back(); gi = groups.size() - 1; } subs[(size_t) gi].addItem(10000 + i, kParams[i].label); }
        for (int i = 0; i < groups.size(); ++i) m.addSubMenu(groups[i], subs[(size_t) i]);
        juce::PopupMenu fxm; fxIds.clear(); std::function<void(const std::vector<NodeP>&, juce::PopupMenu&)> walk = [&](const std::vector<NodeP>& l, juce::PopupMenu& into) { for (auto& n : l) { juce::PopupMenu nm; const auto& sp = kFx[n->type]; for (int i = 0; i < sp.np; ++i) if (sp.ps[i].kind != PK::List) { fxIds.add("fx:" + juce::String(n->id) + ":" + sp.ps[i].key); nm.addItem(50000 + fxIds.size() - 1, sp.ps[i].label); } into.addSubMenu(sp.name, nm); for (auto& b : n->bands) walk(b, into); } };
        static const char* bn[7] = {"A + D", "B + E", "C + F", "Sub + Noise", "FX 1", "FX 2", "Main"}; for (int c = 0; c < 7; ++c) if (!ed.proc.chains[c].empty()) { juce::PopupMenu bm; walk(ed.proc.chains[c], bm); fxm.addSubMenu(bn[c], bm); }
        if (fxm.getNumItems() > 0) m.addSubMenu("Effects", fxm);
        return m;
    }
    juce::StringArray fxIds;
    void pickDest(int k) { auto m = destMenu(); juce::Component::SafePointer<MatrixPage> self(this); m.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(this), [self, k](int r) { if (self == nullptr || r <= 0) return; auto& sl = self->ed.proc.slots; if (k >= (int) sl.size()) return; if (r >= 50000) sl[(size_t) k].d = self->fxIds[r - 50000]; else sl[(size_t) k].d = kParams[r - 10000].key; self->ed.proc.commitSlots(); self->repaint(); }); }
    void pickSrc(int k) { juce::PopupMenu m; for (int i = 0; i < kNumSrc; ++i) m.addItem(i + 1, srcName(i)); juce::Component::SafePointer<MatrixPage> self(this); m.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(this), [self, k](int r) { if (self == nullptr || r <= 0) return; auto& sl = self->ed.proc.slots; if (k >= (int) sl.size()) return; sl[(size_t) k].s = srcId(r - 1); self->ed.proc.commitSlots(); self->repaint(); }); }
    void mouseDown(const juce::MouseEvent& e) override
    {
        const auto p = e.position; auto& sl = ed.proc.slots; dragRow = -1;
        if (rc(kPageW - 190, 9, 84, 20).contains(p)) { if (sl.size() < 64) { SlotDesc s; s.s = "l1"; s.d = "f1.cut"; s.a = .25; sl.push_back(s); ed.proc.commitSlots(); first = juce::jmax(0, (int) sl.size() - kRows); repaint(); } return; }
        if (rc(kPageW - 98, 9, 84, 20).contains(p)) { sl.clear(); first = 0; ed.proc.commitSlots(); repaint(); return; }
        if ((int) sl.size() > kRows) { if (rc(14, getHeight() - 30.f, 60, 20).contains(p)) { first = juce::jmax(0, first - kRows); repaint(); return; } if (rc(80, getHeight() - 30.f, 60, 20).contains(p)) { if (first + kRows < (int) sl.size()) first += kRows; repaint(); return; } }
        for (int i = 0; i < kRows; ++i) { const int k = first + i; if (k >= (int) sl.size()) break; const auto r = row(i); if (!r.contains(p)) continue; const float x = p.x - r.getX();
            if (x < 180) pickSrc(k); else if (x < 545) pickDest(k); else if (x < 930) { dragRow = k; mouseDrag(e); }
            else if (p.x > r.getRight() - 32) { sl.erase(sl.begin() + k); ed.proc.commitSlots(); } else if (p.x > r.getRight() - 162 && p.x < r.getRight() - 98) { sl[(size_t) k].b = !sl[(size_t) k].b; ed.proc.commitSlots(); } else if (p.x > r.getRight() - 238 && p.x < r.getRight() - 164) { sl[(size_t) k].u = !sl[(size_t) k].u; ed.proc.commitSlots(); }
            repaint(); return; }
    }
    void mouseDrag(const juce::MouseEvent& e) override { auto& sl = ed.proc.slots; if (dragRow < 0 || dragRow >= (int) sl.size()) return; const auto r = row(dragRow - first); const auto bar = rc(r.getX() + 560, r.getCentreY() - 4, 360, 8); sl[(size_t) dragRow].a = juce::jlimit(-1.0, 1.0, (double) ((e.position.x - bar.getCentreX()) / (bar.getWidth() / 2))); if (std::abs(sl[(size_t) dragRow].a) < .02) sl[(size_t) dragRow].a = 0; ed.proc.commitSlots(); repaint(); }
};

// ================================================================= presets page
struct Ed::PresetPage : public juce::Component
{
    Ed& ed; int filter = 0; juce::Array<juce::File> user; int first = 0; static constexpr int kPer = 72;
    explicit PresetPage(Ed& e) : ed(e) { setBounds((int) kPageX, (int) kPageY, (int) kPageW, (int) kPageH); }
    juce::StringArray types() const { return { "All", "Lead", "Pluck", "Bass", "Keys", "Pad", "Arp", "FX", "My presets" }; }
    juce::Rectangle<float> typeRect(int i) const { return rc(14 + i * 86.f, 34, 82, 22); }
    juce::Rectangle<float> cell(int i) const { return rc(14 + (i / 18) * 312.f, 70 + (i % 18) * 31.f, 304, 27); }
    std::vector<int> shown() const { std::vector<int> v; const auto t = types()[filter]; for (int i = 0; i < ed.proc.numFactory(); ++i) if (filter == 0 || ed.proc.factoryInfo(i)["type"].toString() == t) v.push_back(i); return v; }
    void refreshUser() { user = ed.proc.userPresetDir().findChildFiles(juce::File::findFiles, false, "*.wwpreset"); user.sort(); }
    void paint(juce::Graphics& g) override
    {
        paintBox(g, getLocalBounds().toFloat().withTrimmedTop(4), cPanel, cLine, 7); paintText(g, "PRESETS", rc(14, 12, 200, 16), cMist, font(13, 700, false, 1.f), juce::Justification::centredLeft);
        paintText(g, "Click a preset to load it. Save keeps your own sound in My presets. Presets use the same format as the web mockup.", rc(220, 12, 760, 16), cDim, font(11), juce::Justification::centredLeft);
        const auto ty = types(); for (int i = 0; i < ty.size(); ++i) { const bool on = i == filter; paintBox(g, typeRect(i), on ? cSelBg : cBtn, on ? cLilac : cLine); paintText(g, ty[i], typeRect(i), on ? cMist : cDim, font(11, 600)); }
        if (filter == 8) { if (user.isEmpty()) paintText(g, "No own presets yet. Press Save at the top to keep the current sound.", rc(14, 76, 600, 20), cDim, font(12), juce::Justification::centredLeft);
            for (int i = 0; i < juce::jmin(kPer, user.size() - first); ++i) { const auto r = cell(i); const auto nm = user[first + i].getFileNameWithoutExtension(); const bool on = nm == ed.proc.patchName; paintBox(g, r, on ? cSelBg : cBtn, on ? cAcc : cLine); paintText(g, nm, r.reduced(10, 0), on ? cGold : cText, font(12, 600), juce::Justification::centredLeft); } return; }
        const auto v = shown(); for (int i = 0; i < juce::jmin(kPer, (int) v.size()); ++i) { const auto r = cell(i); const auto info = ed.proc.factoryInfo(v[(size_t) i]); const bool on = info["name"].toString() == ed.proc.patchName; paintBox(g, r, on ? cSelBg : cBtn, on ? cAcc : cLine);
            paintText(g, info["name"].toString(), r.reduced(10, 0).withTrimmedRight(110), on ? cGold : cText, font(12, 600), juce::Justification::centredLeft); paintText(g, info["type"].toString() + "  " + info["genre"].toString(), r.reduced(10, 0), cDim, font(10), juce::Justification::centredRight); }
    }
    void mouseDown(const juce::MouseEvent& e) override
    {
        const auto p = e.position; for (int i = 0; i < types().size(); ++i) if (typeRect(i).contains(p)) { filter = i; first = 0; if (i == 8) refreshUser(); repaint(); return; }
        if (filter == 8) { for (int i = 0; i < juce::jmin(kPer, user.size() - first); ++i) if (cell(i).contains(p)) { ed.proc.loadUserPreset(user[first + i]); repaint(); return; } return; }
        const auto v = shown(); for (int i = 0; i < juce::jmin(kPer, (int) v.size()); ++i) if (cell(i).contains(p)) { ed.proc.setCurrentProgram(v[(size_t) i]); repaint(); return; }
    }
};
struct Ed::WavePage : public juce::Component
{
    explicit WavePage(Ed&) { setBounds((int) kPageX, (int) kPageY, (int) kPageW, (int) kPageH); }
    void paint(juce::Graphics& g) override { paintBox(g, getLocalBounds().toFloat().withTrimmedTop(4), cPanel, cLine, 7); paintText(g, "WAVE LAB", rc(14, 12, 200, 16), cMist, font(13, 700, false, 1.f), juce::Justification::centredLeft);
        g.setColour(cDim); g.setFont(font(13)); g.drawFittedText("The Wave Lab (draw and import your own wavetables) is not in the plugin yet. It is the next page to be ported from the mockup. The 41 factory wavetables are all here: pick them on the Sound page.", 14, 44, 620, 80, juce::Justification::topLeft, 4); }
};

// ================================================================= the stage: static look of the mockup plus the live controls
struct Ed::Stage : public juce::Component
{
    Ed& ed; juce::OwnedArray<Widget> widgets; std::unique_ptr<Keyboard> kb; std::unique_ptr<FxPage> fx; std::unique_ptr<MatrixPage> matrix; std::unique_ptr<PresetPage> presets; std::unique_ptr<WavePage> wave;
    explicit Stage(Ed& e) : ed(e)
    {
        setBounds(0, 0, (int) kW, (int) kH); setOpaque(true);
        for (int i = 0; i < kNumCtls; ++i) { auto* w = widgets.add(new Widget(ed, &kCtls[i])); addChildComponent(w); }
        kb = std::make_unique<Keyboard>(ed); addAndMakeVisible(*kb); fx = std::make_unique<FxPage>(ed); addChildComponent(*fx); matrix = std::make_unique<MatrixPage>(ed); addChildComponent(*matrix); presets = std::make_unique<PresetPage>(ed); addChildComponent(*presets); wave = std::make_unique<WavePage>(ed); addChildComponent(*wave);
        showPage();
    }
    void showPage() { for (auto* w : widgets) w->setVisible(w->c->page < 0 || w->c->page == ed.page); fx->setVisible(ed.page == 3); matrix->setVisible(ed.page == 2); presets->setVisible(ed.page == 7); wave->setVisible(ed.page == 6); if (ed.page == 3) fx->rebuild(); if (ed.page == 7) presets->refreshUser(); repaint(); }
    bool dimmed(int grp) const { return grp >= 1 && grp <= 3 && ed.proc.paramValue(pidx(std::string(1, "abcdef"[ed.oscOf(grp)]) + ".on")) < .5f; }
    void paint(juce::Graphics& g) override
    {
        g.fillAll(cBg);
        for (int i = 0; i < kNumBoxes; ++i) { const auto& b = kBoxes[i]; if (b.page >= 0 && b.page != ed.page) continue; const float a = b.op * (dimmed(b.grp) ? .45f : 1.f); paintBox(g, rc(b.x, b.y, b.w, b.h), juce::Colour(b.bg).withMultipliedAlpha(a), juce::Colour(b.bc).withMultipliedAlpha(a), b.rad, b.bw); }
        catui::drawCatHead(g, rc(14, 6, 46, 46), cPink);
        for (int i = 0; i < kNumTexts; ++i)
        {
            const auto& t = kTexts[i]; if (t.page >= 0 && t.page != ed.page) continue; juce::String s = juce::String::fromUTF8(t.s);
            if (t.dyn == 2) s = "LIM " + juce::String(-std::abs(ed.proc.limGr.load()), 1) + " dB"; else if (t.dyn == 3) s = juce::String(ed.proc.voicesOn.load()); else if (t.dyn >= 10) { const int bi = t.dyn - 10; static const char* bn[8] = {"t0", "t1", "t2", "t3", "x1", "x2", "fx", "mst"}; const int pi = pidx(std::string("bus.") + bn[bi] + ".vol"); const float v = pi >= 0 ? ed.proc.paramValue(pi) : 0.f; s = v <= -59.9f ? juce::String("-inf dB") : juce::String(v, 1) + " dB"; }
            if (t.grp >= 1 && t.grp <= 3 && s == "OSC") s = "OSC";
            if (t.up) s = s.toUpperCase();
            const float a = t.op * (dimmed(t.grp) ? .45f : 1.f); const auto f = font(t.fs, t.fw, t.mono != 0, t.ls); g.setColour(juce::Colour(t.col).withMultipliedAlpha(a)); g.setFont(f);
            if (t.h > t.fs * 1.9f) g.drawFittedText(s, juce::Rectangle<float>(t.x, t.y, t.w + 6, t.h + 2).toNearestInt(), juce::Justification::topLeft, 12, 1.f);
            else g.drawText(s, juce::Rectangle<float>(t.x - 1, t.y - 2, t.w + 30, t.h + 4), juce::Justification::centredLeft, false);
        }
    }
};

// ================================================================= editor
Ed::WhiskerwaveEditor(WhiskerwaveProcessor& p) : juce::AudioProcessorEditor(&p), proc(p)
{
    setLookAndFeel(&laf); tip.setLookAndFeel(&laf);
    stage = std::make_unique<Stage>(*this); addAndMakeVisible(*stage);
    const float aspect = (kW + 2 * kCheek) / kH; limits.setFixedAspectRatio(aspect); limits.setSizeLimits((int) ((kW + 2 * kCheek) * .55f), (int) (kH * .55f), (int) ((kW + 2 * kCheek) * 2.f), (int) (kH * 2.f));
    setConstrainer(&limits); setResizable(true, true);
    float s = 1.f; if (auto* d = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay()) if (d->userBounds.getHeight() < 1000) s = juce::jmax(.6f, (float) (d->userBounds.getHeight() - 90) / kH);
    setSize((int) ((kW + 2 * kCheek) * s), (int) (kH * s));
    proc.patchChanged.addChangeListener(this); startTimerHz(30);
    // Development aid: with WW_SNAPSHOT_DIR set, the standalone app saves a picture of every page there and quits (used by CI to check the window).
    const auto snapDir = juce::SystemStats::getEnvironmentVariable("WW_SNAPSHOT_DIR", {});
    if (snapDir.isNotEmpty())
    {
        juce::Component::SafePointer<Ed> self(this);
        juce::Timer::callAfterDelay(1500, [self, snapDir] {
            if (self == nullptr) return; juce::File dir(snapDir); dir.createDirectory(); self->setSize((int) (kW + 2 * kCheek), (int) kH);
            auto shot = [&](const juce::String& name) { const auto img = self->createComponentSnapshot(self->getLocalBounds(), true, 1.f); juce::FileOutputStream os(dir.getChildFile(name + ".png")); if (os.openedOk()) { os.setPosition(0); os.truncate(); juce::PNGImageFormat().writeImageToStream(img, os); } };
            static const char* names[8] = {"sound", "filter", "mod", "fx", "mixer", "arp", "wave", "presets"};
            for (int i = 0; i < 8; ++i) { self->setPage(i); shot(names[i]); }
            self->proc.setCurrentProgram(4); self->rebindAll(); self->setPage(3); self->stage->fx->bus = 0; self->stage->fx->rebuild(); shot("fx_preset"); self->setPage(0); shot("sound_preset"); self->setPage(2); shot("mod_preset");
            if (auto* app = juce::JUCEApplicationBase::getInstance()) app->systemRequestedQuit();
        });
    }
}
Ed::~WhiskerwaveEditor() { stopTimer(); proc.patchChanged.removeChangeListener(this); tip.setLookAndFeel(nullptr); setLookAndFeel(nullptr); }
void Ed::paint(juce::Graphics& g) { g.fillAll(cBg); const float s = getHeight() / kH; catui::drawWoodCheeks(g, getLocalBounds(), (int) std::ceil(kCheek * s)); }
void Ed::resized() { if (stage == nullptr) return; const float s = getHeight() / kH; stage->setTransform(juce::AffineTransform::scale(s).translated(kCheek * s, 0)); }
void Ed::timerCallback() { for (auto* w : stage->widgets) if (w->isVisible()) w->tick(); if (page == 3) stage->fx->tick(); static int n = 0; if ((++n % 3) == 0) stage->repaint(0, 0, (int) kW, 60); if (page == 4 && (n % 6) == 0) stage->repaint(); }
void Ed::changeListenerCallback(juce::ChangeBroadcaster*) { rebindAll(); if (page == 3) stage->fx->rebuild(); stage->repaint(); }
void Ed::setPage(int p) { page = p; stage->showPage(); }
void Ed::rebindAll() { for (auto* w : stage->widgets) w->rebind(); stage->repaint(); }
juce::String Ed::keyFor(const char* key, int grp) const
{
    juce::String k(key); if (k.isEmpty()) return k;
    if (grp >= 1 && grp <= 3 && k.length() > 2 && k[1] == '.') return juce::String::charToString((juce::juce_wchar) "abcdef"[oscOf(grp)]) + k.substring(1);
    if (grp == 4 && k.startsWith("e1.")) return "e" + juce::String(envSel) + k.substring(2);
    return k;
}
void Ed::showPresetMenu(juce::Component* at)
{
    juce::PopupMenu m; juce::StringArray types { "Lead", "Pluck", "Bass", "Keys", "Pad", "Arp", "FX" };
    for (auto& t : types) { juce::PopupMenu sub; for (int i = 0; i < proc.numFactory(); ++i) if (proc.factoryInfo(i)["type"].toString() == t) sub.addItem(i + 1, proc.factoryName(i), true, proc.factoryName(i) == proc.patchName); if (sub.getNumItems() > 0) m.addSubMenu(t, sub); }
    juce::PopupMenu um; auto files = proc.userPresetDir().findChildFiles(juce::File::findFiles, false, "*.wwpreset"); files.sort(); for (int i = 0; i < files.size(); ++i) um.addItem(5000 + i, files[i].getFileNameWithoutExtension()); if (um.getNumItems() > 0) m.addSubMenu("My presets", um);
    juce::Component::SafePointer<Ed> self(this);
    m.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(at), [self, files](int r) { if (self == nullptr || r <= 0) return; if (r >= 5000) self->proc.loadUserPreset(files[r - 5000]); else self->proc.setCurrentProgram(r - 1); });
}
void Ed::action(int id, int grp)
{
    const int o = oscOf(grp);
    auto stepParam = [&](const juce::String& pid, int delta, int n) { if (auto* p = proc.apvts.getParameter(pid)) { const float v = p->convertFrom0to1(p->getValue()); p->setValueNotifyingHost(p->convertTo0to1((float) juce::jlimit(0, n, (int) std::lround(v) + delta))); } };
    switch (id)
    {
        case 1: proc.setCurrentProgram((proc.getCurrentProgram() + proc.getNumPrograms() - 1) % proc.getNumPrograms()); break;
        case 2: proc.setCurrentProgram((proc.getCurrentProgram() + 1) % proc.getNumPrograms()); break;
        case 3:
        {
            auto* aw = new juce::AlertWindow("Save preset", "Name of your preset:", juce::MessageBoxIconType::NoIcon, this); aw->addTextEditor("n", proc.patchName); aw->addButton("Save", 1, juce::KeyPress(juce::KeyPress::returnKey)); aw->addButton("Cancel", 0, juce::KeyPress(juce::KeyPress::escapeKey));
            juce::Component::SafePointer<Ed> self(this); aw->enterModalState(true, juce::ModalCallbackFunction::create([self, aw](int r) { if (r == 1 && self != nullptr) { const auto nm = aw->getTextEditorContents("n").trim(); if (nm.isNotEmpty()) self->proc.saveUserPreset(nm); } }), true); break;
        }
        case 4:
            juce::AlertWindow::showAsync(juce::MessageBoxOptions().withIconType(juce::MessageBoxIconType::NoIcon).withTitle("WhiskerWave").withMessage(juce::String("Version ") + JucePlugin_VersionString + "\nWavetable synth by Studio 87.\n\nFree and open source (AGPL-3.0-or-later).\nCollects nothing: no telemetry, no accounts, no network use.\n\nIf you like it, you can leave a tip on Ko-fi.").withButton("Open Ko-fi").withButton("Close").withAssociatedComponent(this),
                                         [](int r) { if (r == 1) juce::URL("https://ko-fi.com/studio87").launchInDefaultBrowser(); });
            break;
        case 5: proc.panicFromUi(); break;
        case 6: stepParam(juce::String("abcdef").substring(o, o + 1) + "_tab", -1, kNumTables - 1); break;
        case 7: stepParam(juce::String("abcdef").substring(o, o + 1) + "_tab", 1, kNumTables - 1); break;
        case 8: case 9: if (auto* p = proc.apvts.getParameter(juce::String("abcdef").substring(o, o + 1) + "_semi")) { const float v = p->convertFrom0to1(p->getValue()); p->setValueNotifyingHost(p->convertTo0to1(juce::jlimit(-48.f, 48.f, v + (id == 8 ? -12.f : 12.f)))); } break;
        case 10: { auto& r = juce::Random::getSystemRandom(); for (int i = 0; i < 16; ++i) { proc.seq.on[i] = r.nextFloat() < .8f ? 1 : 0; proc.seq.vel[i] = .5 + .5 * r.nextFloat(); proc.seq.semi[i] = r.nextFloat() < .7f ? 0 : (double) (r.nextInt(5) - 2) * 12 / 2; proc.seq.rat[i] = r.nextFloat() < .85f ? 1 : 2; } proc.commitShapes(); break; }
        case 11: proc.seq = ArpSeq(); proc.commitShapes(); break;
        default: break;
    }
    stage->repaint();
}
