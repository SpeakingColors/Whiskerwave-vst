#pragma once
#include "Ui.h"
#include "Layout.h"
#include <catui/CatLookAndFeel.h>

// The real window: the approved mockup, drawn natively from the layout read out of the mockup itself (src/Layout.h).
class WhiskerwaveEditor : public juce::AudioProcessorEditor, private juce::Timer, private juce::ChangeListener
{
public:
    explicit WhiskerwaveEditor(WhiskerwaveProcessor&);
    ~WhiskerwaveEditor() override;
    void paint(juce::Graphics&) override;
    void resized() override;
    struct Stage; struct Widget; struct FxPage; struct MatrixPage; struct PresetPage; struct WavePage; struct Keyboard;
    WhiskerwaveProcessor& proc;
    int page = 0, oscSel[3] = {0, 0, 0}, envSel = 1;
    void setPage(int p); void rebindAll(); void action(int id, int grp);
    juce::String keyFor(const char* key, int grp) const;
    int oscOf(int grp) const { return grp >= 1 && grp <= 3 ? (grp - 1) + (oscSel[grp - 1] ? 3 : 0) : 0; }
    void showPresetMenu(juce::Component* at);
private:
    void timerCallback() override; void changeListenerCallback(juce::ChangeBroadcaster*) override;
    catui::CatLookAndFeel laf; std::unique_ptr<Stage> stage; juce::TooltipWindow tip { this, 500 };
    juce::ComponentBoundsConstrainer limits;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WhiskerwaveEditor)
};
