#include "PluginEditor.h"

using namespace whisker;

void Knob::init(juce::Component& parent, juce::AudioProcessorValueTreeState& apvts, const juce::String& id, const juce::String& name)
{
    s.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 62, 15);
    l.setText(name, juce::dontSendNotification);
    l.setJustificationType(juce::Justification::centred);
    l.setFont(juce::FontOptions(12.f));
    parent.addAndMakeVisible(s); parent.addAndMakeVisible(l);
    a = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(apvts, id, s);
}

void WaveView::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff0e1213));
    const float pos = proc.apvts.getRawParameterValue("pos")->load();
    const int i0 = juce::jlimit(0, kNumWaves - 1, (int) pos);
    g.setColour(juce::Colour(0xff9a9690)); g.setFont(juce::FontOptions(12.f));
    const int i1 = std::min(i0 + 1, kNumWaves - 1);
    g.drawText(juce::String(kWaveNames[i0]) + "  >  " + kWaveNames[i1], 8, 4, getWidth() - 16, 14, juce::Justification::left);
    const auto r = getLocalBounds().toFloat().reduced(6.f, 22.f);
    g.setColour(juce::Colour(0xff33403f)); g.drawHorizontalLine((int) r.getCentreY(), r.getX(), r.getRight());
    juce::Path p;
    for (int x = 0; x < (int) r.getWidth(); ++x)
    {
        const float ph = (float) x / r.getWidth();
        const float v = proc.bank.read(ph * 0.9999f, pos, 0);
        const float y = r.getCentreY() - v * r.getHeight() * 0.5f;
        x ? p.lineTo(r.getX() + (float) x, y) : p.startNewSubPath(r.getX(), y);
    }
    g.setColour(juce::Colour(0xffe8a33d)); g.strokePath(p, juce::PathStrokeType(2.f));
    // output level
    const float lv = juce::jlimit(0.f, 1.f, proc.outLevel.load());
    g.setColour(juce::Colour(0xff58e08a)); g.fillRect((float) getWidth() - 8.f, (float) getHeight() * (1.f - lv), 6.f, (float) getHeight() * lv);
}

WhiskerwaveEditor::WhiskerwaveEditor(WhiskerwaveProcessor& p) : AudioProcessorEditor(&p), proc(p), wave(p)
{
    setLookAndFeel(&laf);
    addAndMakeVisible(wave);
    static const char* ids[] = { "pos", "uni", "det", "spread", "lfoRate", "lfoAmt", "fc", "fr", "fe", "vol",
                                 "aA", "aD", "aS", "aR", "fA", "fD", "fS", "fR", "bend" };
    static const char* nm[] = { "Wave pos", "Unison", "Detune", "Spread", "LFO rate", "LFO>pos", "Cutoff", "Reso", "Filt env", "Volume",
                                "Amp A", "Amp D", "Amp S", "Amp R", "Filt A", "Filt D", "Filt S", "Filt R", "Bend" };
    for (size_t i = 0; i < knobs.size(); ++i) knobs[i].init(*this, p.apvts, ids[i], nm[i]);
    setSize(900, 460);
    gate.onFrame = [this] { wave.repaint(); };
    gate.start(30);
}

void WhiskerwaveEditor::paint(juce::Graphics& g)
{
    g.fillAll(catui::Colours::panel());
    g.setColour(catui::Colours::accent()); g.setFont(juce::FontOptions(20.f, juce::Font::bold));
    g.drawText("Whiskerwave", 12, 8, 240, 26, juce::Justification::left);
}

void WhiskerwaveEditor::resized()
{
    auto r = getLocalBounds().reduced(10);
    r.removeFromTop(30);
    wave.setBounds(r.removeFromTop(150));
    r.removeFromTop(8);
    const int cols = 10, kw = r.getWidth() / cols, kh = 92;
    for (size_t i = 0; i < knobs.size(); ++i)
        knobs[i].place({ r.getX() + (int) (i % cols) * kw, r.getY() + (int) (i / cols) * (kh + 8), kw, kh });
}
