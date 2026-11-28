#include "PluginEditor.h"

using namespace whisker;
namespace { constexpr int kCheek = 34, kCell = 66, kCellH = 74, kHead = 64, kSecHead = 22, kGap = 8; }

ParamControl::ParamControl(juce::AudioProcessorValueTreeState& apvts, const juce::String& id, const juce::String& label)
{
    auto* p = apvts.getParameter(id);
    title.setText(label, juce::dontSendNotification);
    title.setJustificationType(juce::Justification::centred);
    title.setFont(juce::FontOptions(11.f));
    addAndMakeVisible(title);
    if (auto* c = dynamic_cast<juce::AudioParameterChoice*>(p))
    {
        kind = 1; combo.addItemList(c->choices, 1); addAndMakeVisible(combo);
        ca = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment>(apvts, id, combo);
    }
    else if (dynamic_cast<juce::AudioParameterBool*>(p))
    {
        kind = 2; toggle.setButtonText({}); addAndMakeVisible(toggle);
        ba = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>(apvts, id, toggle);
    }
    else
    {
        slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, kCell - 4, 14);
        addAndMakeVisible(slider);
        sa = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(apvts, id, slider);
    }
}

void ParamControl::resized()
{
    auto r = getLocalBounds();
    title.setBounds(r.removeFromTop(14));
    if (kind == 0) slider.setBounds(r);
    else if (kind == 1) combo.setBounds(r.withSizeKeepingCentre(r.getWidth() - 4, 24));
    else toggle.setBounds(r.withSizeKeepingCentre(28, 28));
}

void WaveView::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff0e1213));
    const auto* T = proc.tableFor(0);
    const float pos = proc.apvts.getRawParameterValue("a_pos")->load();
    const int idx = (int) proc.apvts.getRawParameterValue("a_tab")->load();
    g.setColour(juce::Colour(0xff9a9690)); g.setFont(juce::FontOptions(12.f));
    g.drawText(juce::String(kTableNames[juce::jlimit(0, kNumTables - 1, idx)]) + "   frame " + juce::String(pos * (kTableFrames - 1), 1) + "/" + juce::String(kTableFrames),
               8, 4, getWidth() - 16, 14, juce::Justification::left);
    const auto r = getLocalBounds().toFloat().reduced(6.f, 22.f);
    g.setColour(juce::Colour(0xff33403f)); g.drawHorizontalLine((int) r.getCentreY(), r.getX(), r.getRight());
    if (!T) return;
    const double fi = pos * (kTableFrames - 1); const int f0 = std::min(kTableFrames - 1, (int) fi), f1 = std::min(kTableFrames - 1, f0 + 1); const float ff = (float) (fi - f0);
    const float* A = T->frame(0, f0); const float* B = T->frame(0, f1);
    juce::Path p;
    for (int x = 0; x < (int) r.getWidth(); ++x)
    {
        const int i = (int) ((float) x / r.getWidth() * (kTableLen - 1));
        const float v = A[i] + (B[i] - A[i]) * ff, y = r.getCentreY() - v * r.getHeight() * .5f;
        x ? p.lineTo(r.getX() + (float) x, y) : p.startNewSubPath(r.getX(), y);
    }
    g.setColour(juce::Colour(0xffe8a33d)); g.strokePath(p, juce::PathStrokeType(2.f));
    const float lv = juce::jlimit(0.f, 1.f, proc.outLevel.load());
    g.setColour(juce::Colour(0xff58e08a)); g.fillRect((float) getWidth() - 8.f, (float) getHeight() * (1.f - lv), 6.f, (float) getHeight() * lv);
}

void WhiskerwaveEditor::addSection(const juce::String& name, int cols, std::initializer_list<std::pair<const char*, const char*>> items)
{
    auto s = std::make_unique<Section>(); s->name = name; s->cols = cols;
    for (auto& it : items) { s->ctl.push_back(std::make_unique<ParamControl>(proc.apvts, it.first, it.second)); addAndMakeVisible(*s->ctl.back()); }
    sections.push_back(std::move(s));
}

WhiskerwaveEditor::WhiskerwaveEditor(WhiskerwaveProcessor& p) : AudioProcessorEditor(&p), proc(p), wave(p)
{
    setLookAndFeel(&laf);
    addAndMakeVisible(wave);
    for (int i = 0; i < proc.getNumPrograms(); ++i) presets.addItem(proc.getProgramName(i), i + 1);
    presets.setSelectedId(proc.getCurrentProgram() + 1, juce::dontSendNotification);
    presets.onChange = [this] { proc.setCurrentProgram(presets.getSelectedId() - 1); };
    addAndMakeVisible(presets);
    auto osc = [&](const char* k, const char* nm)
    {
        const juce::String a = k;
        addSection(nm, 6, { { (a + "_on").toRawUTF8(), "On" }, { (a + "_tab").toRawUTF8(), "Table" }, { (a + "_pos").toRawUTF8(), "Wave pos" },
            { (a + "_lvl").toRawUTF8(), "Level" }, { (a + "_pan").toRawUTF8(), "Pan" }, { (a + "_rt").toRawUTF8(), "Route" },
            { (a + "_oct").toRawUTF8(), "Octave" }, { (a + "_semi").toRawUTF8(), "Semi" }, { (a + "_fine").toRawUTF8(), "Fine" },
            { (a + "_ph").toRawUTF8(), "Phase" }, { (a + "_rnd").toRawUTF8(), "Rand" }, { (a + "_anl").toRawUTF8(), "Analog" },
            { (a + "_uv").toRawUTF8(), "Voices" }, { (a + "_ud").toRawUTF8(), "Detune" }, { (a + "_us").toRawUTF8(), "Style" },
            { (a + "_ub").toRawUTF8(), "Blend" }, { (a + "_usp").toRawUTF8(), "Spread" } });
    };
    // NB: toRawUTF8 of temporaries is only valid inside the call, and ParamControl copies the text, so this is safe.
    osc("a", "OSC A"); osc("b", "OSC B"); osc("c", "OSC C");
    addSection("SUB", 4, { { "sub_on", "On" }, { "sub_wave", "Wave" }, { "sub_oct", "Octave" }, { "sub_lvl", "Level" }, { "sub_pw", "PW" }, { "sub_fine", "Fine" }, { "sub_pan", "Pan" }, { "sub_rt", "Route" } });
    addSection("NOISE", 3, { { "nz_on", "On" }, { "nz_type", "Type" }, { "nz_lvl", "Level" }, { "nz_pan", "Pan" }, { "nz_rt", "Route" } });
    addSection("FILTER 1", 3, { { "f1_type", "Type" }, { "f1_cut", "Cutoff" }, { "f1_res", "Reso" }, { "f1_kt", "Key trk" }, { "f1_env", "Env amt" }, { "f1_es", "Env src" } });
    addSection("FILTER 2", 3, { { "f2_type", "Type" }, { "f2_cut", "Cutoff" }, { "f2_res", "Reso" }, { "f2_kt", "Key trk" }, { "f2_env", "Env amt" }, { "f2_es", "Env src" } });
    addSection("ROUTING", 1, { { "frt", "Filters" } });
    addSection("ENV 1 (AMP)", 4, { { "e1_a", "Attack" }, { "e1_h", "Hold" }, { "e1_d", "Decay" }, { "e1_s", "Sustain" }, { "e1_r", "Release" }, { "e1_c", "Curve" }, { "e1_ca", "A curve" } });
    addSection("ENV 2 (FILTER)", 4, { { "e2_a", "Attack" }, { "e2_h", "Hold" }, { "e2_d", "Decay" }, { "e2_s", "Sustain" }, { "e2_r", "Release" }, { "e2_c", "Curve" }, { "e2_ca", "A curve" } });
    addSection("MASTER", 2, { { "master", "Master dB" }, { "poly", "Voices" }, { "vel", "Velocity" }, { "bendr", "Bend" } });
    addSection("REVERB", 3, { { "rvType", "Type" }, { "rvDecay", "Decay" }, { "rvDamp", "Damp" }, { "rvMix", "Mix" }, { "rvShift", "Shim pitch" }, { "rvShim", "Shim amt" } });
    addSection("DELAY", 3, { { "dlMix", "Mix" }, { "dlTime", "Time" }, { "dlFb", "Feedback" }, { "dlShift", "Shim pitch" }, { "dlShim", "Shim amt" } });
    setSize(1240, 780);
    gate.onFrame = [this] { wave.repaint(); };
    gate.start(30);
}

void WhiskerwaveEditor::paint(juce::Graphics& g)
{
    g.fillAll(catui::Colours::panel());
    catui::drawWoodCheeks(g, getLocalBounds(), kCheek);
    g.setColour(catui::Colours::accent()); g.setFont(juce::FontOptions(22.f, juce::Font::bold));
    g.drawText("WhiskerWave", kCheek + 12, 8, 260, 30, juce::Justification::left);
    g.setColour(catui::Colours::dim()); g.setFont(juce::FontOptions(11.f));
    g.drawText("Studio 87  |  engine core preview: oscillators, unison, sub, noise, filters, envelopes, FX", kCheek + 12, 38, 700, 14, juce::Justification::left);
    for (auto& s : sections)
    {
        g.setColour(juce::Colour(0x22ffffff)); g.fillRoundedRectangle(s->area.toFloat(), 4.f);
        g.setColour(catui::Colours::accent()); g.setFont(juce::FontOptions(12.f, juce::Font::bold));
        g.drawText(s->name, s->area.getX() + 6, s->area.getY() + 2, s->area.getWidth() - 12, 16, juce::Justification::left);
    }
}

void WhiskerwaveEditor::resized()
{
    auto top = getLocalBounds().withTrimmedLeft(kCheek).withTrimmedRight(kCheek).withHeight(kHead).reduced(8, 6);
    presets.setBounds(top.removeFromRight(190).withHeight(26).translated(0, 4));
    wave.setBounds(top.removeFromRight(300).withTrimmedRight(10));
    // shelf packing: sections left to right, wrap at the right cheek
    const int x0 = kCheek + 8, x1 = getWidth() - kCheek - 8;
    int x = x0, y = kHead + 4, rowH = 0;
    for (auto& s : sections)
    {
        const int rows = ((int) s->ctl.size() + s->cols - 1) / s->cols;
        const int w = s->cols * kCell + 8, h = kSecHead + rows * kCellH + 6;
        if (x + w > x1 && x > x0) { x = x0; y += rowH + kGap; rowH = 0; }
        s->area = { x, y, w, h };
        for (size_t i = 0; i < s->ctl.size(); ++i)
            s->ctl[i]->setBounds(x + 4 + ((int) i % s->cols) * kCell, y + kSecHead + ((int) i / s->cols) * kCellH, kCell, kCellH);
        x += w + kGap; rowH = std::max(rowH, h);
    }
}
