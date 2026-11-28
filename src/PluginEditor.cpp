#include "PluginEditor.h"
using namespace whisker;
namespace { constexpr int kCheek = 34, kHead = 44; }

// one tab: a grid of controls for every parameter of one group
struct WhiskerwaveEditor::Page : public juce::Component
{
    struct Ctl
    {
        juce::Label title; juce::Slider slider { juce::Slider::RotaryHorizontalVerticalDrag, juce::Slider::TextBoxBelow }; juce::ComboBox combo; juce::ToggleButton toggle;
        std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> sa; std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> ca; std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> ba;
        int kind = 0;
    };
    std::vector<std::unique_ptr<Ctl>> ctls;
    void add(juce::AudioProcessorValueTreeState& apvts, const juce::String& id, const juce::String& label, const juce::String& tip)
    {
        auto c = std::make_unique<Ctl>(); auto* p = apvts.getParameter(id);
        c->title.setText(label, juce::dontSendNotification); c->title.setJustificationType(juce::Justification::centred); c->title.setFont(juce::FontOptions(11.f));
        addAndMakeVisible(c->title);
        if (auto* ch = dynamic_cast<juce::AudioParameterChoice*>(p)) { c->kind = 1; c->combo.addItemList(ch->choices, 1); c->combo.setTooltip(tip); addAndMakeVisible(c->combo); c->ca = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment>(apvts, id, c->combo); }
        else if (dynamic_cast<juce::AudioParameterBool*>(p)) { c->kind = 2; c->toggle.setTooltip(tip); addAndMakeVisible(c->toggle); c->ba = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>(apvts, id, c->toggle); }
        else { c->slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 14); c->slider.setTooltip(tip); addAndMakeVisible(c->slider); c->sa = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(apvts, id, c->slider); }
        ctls.push_back(std::move(c));
    }
    void resized() override
    {
        const int n = (int) ctls.size(); if (n == 0) return;
        const auto b = getLocalBounds().reduced(6); const int cols = std::max(1, (int) std::ceil(std::sqrt(n * (double) b.getWidth() / b.getHeight())));
        const int rows = (n + cols - 1) / cols, cw = b.getWidth() / cols, ch = b.getHeight() / rows;
        for (int i = 0; i < n; ++i)
        {
            auto r = juce::Rectangle<int>(b.getX() + (i % cols) * cw, b.getY() + (i / cols) * ch, cw, ch).reduced(2); auto& c = *ctls[(size_t) i];
            c.title.setBounds(r.removeFromTop(14));
            if (c.kind == 1) c.combo.setBounds(r.withSizeKeepingCentre(std::min(r.getWidth(), 130), 24));
            else if (c.kind == 2) c.toggle.setBounds(r.withSizeKeepingCentre(28, 28));
            else c.slider.setBounds(r);
        }
    }
};

WhiskerwaveEditor::WhiskerwaveEditor(WhiskerwaveProcessor& p) : juce::AudioProcessorEditor(&p), proc(p)
{
    setLookAndFeel(&laf);
    // pages in the order of first appearance of each group
    juce::StringArray order; std::vector<Page*> pages;
    auto pageFor = [&](const juce::String& g) -> Page* { int i = order.indexOf(g); if (i >= 0) return pages[(size_t) i]; order.add(g); auto* pg = new Page(); pages.push_back(pg); tabs.addTab(g, juce::Colours::transparentBlack, pg, true); return pg; };
    pageFor("Global");
    for (int i = 0; i < kNumParams; ++i) pageFor(groupOf(kParams[i].key))->add(proc.apvts, kParams[i].id, kParams[i].label, kParams[i].tip);
    for (int o = 0; o < 6; ++o) pageFor("Osc " + juce::String("ABCDEF").substring(o, o + 1))->add(proc.apvts, juce::String("abcdef").substring(o, o + 1) + "_tab", "Table", "Wavetable of this oscillator.");
    tabs.setTabBarDepth(24); addAndMakeVisible(tabs);
    setSize(1240, 780);
}
WhiskerwaveEditor::~WhiskerwaveEditor() { setLookAndFeel(nullptr); }
void WhiskerwaveEditor::paint(juce::Graphics& g)
{
    g.fillAll(catui::Colours::panel()); catui::drawWoodCheeks(g, getLocalBounds(), kCheek);
    g.setColour(catui::Colours::accent()); g.setFont(juce::FontOptions(22.f, juce::Font::bold)); g.drawText("WhiskerWave", kCheek + 10, 6, 300, 30, juce::Justification::left);
    g.setColour(catui::Colours::dim()); g.setFont(juce::FontOptions(11.f)); g.drawText("development window: the mockup window replaces this before release", 330, 10, 600, 20, juce::Justification::left);
}
void WhiskerwaveEditor::resized() { tabs.setBounds(getLocalBounds().withTrimmedLeft(kCheek).withTrimmedRight(kCheek).withTrimmedTop(kHead).reduced(4)); }
