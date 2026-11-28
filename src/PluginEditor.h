#pragma once
#include "PluginProcessor.h"
#include <catui/CatLookAndFeel.h>
#include <catui/RenderGate.h>

// One control for one parameter: knob, drop-down or toggle, chosen from the parameter type.
class ParamControl : public juce::Component
{
public:
    ParamControl(juce::AudioProcessorValueTreeState&, const juce::String& id, const juce::String& label);
    void resized() override;
private:
    juce::Label title;
    juce::Slider slider { juce::Slider::RotaryVerticalDrag, juce::Slider::TextBoxBelow };
    juce::ComboBox combo;
    juce::ToggleButton toggle;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> sa;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> ca;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> ba;
    int kind = 0; // 0 knob, 1 combo, 2 toggle
};

class WaveView : public juce::Component
{
public:
    explicit WaveView(WhiskerwaveProcessor& p) : proc(p) {}
    void paint(juce::Graphics&) override;
private:
    WhiskerwaveProcessor& proc;
};

class WhiskerwaveEditor : public juce::AudioProcessorEditor
{
public:
    explicit WhiskerwaveEditor(WhiskerwaveProcessor&);
    ~WhiskerwaveEditor() override { setLookAndFeel(nullptr); }
    void paint(juce::Graphics&) override;
    void resized() override;
private:
    struct Section { juce::String name; int cols; std::vector<std::unique_ptr<ParamControl>> ctl; juce::Rectangle<int> area; };
    void addSection(const juce::String& name, int cols, std::initializer_list<std::pair<const char*, const char*>> items);
    WhiskerwaveProcessor& proc;
    catui::CatLookAndFeel laf;
    catui::RenderGate gate { *this };
    WaveView wave;
    juce::ComboBox presets;
    std::vector<std::unique_ptr<Section>> sections;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WhiskerwaveEditor)
};
