#pragma once
#include <juce_audio_utils/juce_audio_utils.h>
#include <catui/CatLookAndFeel.h>
#include "PluginProcessor.h"

// Temporary development window generated from the parameter table. The mockup window replaces it before release.
class WhiskerwaveEditor : public juce::AudioProcessorEditor
{
public:
    explicit WhiskerwaveEditor(WhiskerwaveProcessor&);
    ~WhiskerwaveEditor() override;
    void paint(juce::Graphics&) override;
    void resized() override;
private:
    struct Page;
    WhiskerwaveProcessor& proc;
    catui::CatLookAndFeel laf;
    juce::TabbedComponent tabs { juce::TabbedButtonBar::TabsAtTop };
    juce::TooltipWindow tip { this, 400 };
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WhiskerwaveEditor)
};
