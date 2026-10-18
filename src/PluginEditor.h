#pragma once
#include "PluginProcessor.h"
#include <catui/CatLookAndFeel.h>
#include <catui/RenderGate.h>

namespace whisker
{
struct Knob
{
    juce::Slider s { juce::Slider::RotaryVerticalDrag, juce::Slider::TextBoxBelow };
    juce::Label l;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> a;
    void init(juce::Component& parent, juce::AudioProcessorValueTreeState& apvts, const juce::String& id, const juce::String& name);
    void place(juce::Rectangle<int> r) { l.setBounds(r.removeFromTop(14)); s.setBounds(r); }
};

// Shows the wave at the current position (morph between two neighbours) and its name.
class WaveView : public juce::Component
{
public:
    explicit WaveView(WhiskerwaveProcessor& p) : proc(p) {}
    void paint(juce::Graphics&) override;
private:
    WhiskerwaveProcessor& proc;
};
}

class WhiskerwaveEditor : public juce::AudioProcessorEditor
{
public:
    explicit WhiskerwaveEditor(WhiskerwaveProcessor&);
    ~WhiskerwaveEditor() override { setLookAndFeel(nullptr); }
    void paint(juce::Graphics&) override;
    void resized() override;
private:
    WhiskerwaveProcessor& proc;
    catui::CatLookAndFeel laf;
    catui::RenderGate gate { *this };
    whisker::WaveView wave;
    std::array<whisker::Knob, 19> knobs;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WhiskerwaveEditor)
};
