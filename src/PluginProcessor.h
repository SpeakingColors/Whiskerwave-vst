#pragma once
#include "Synth.h"
#include <catfx/Fx.h>

class WhiskerwaveProcessor : public juce::AudioProcessor
{
public:
    WhiskerwaveProcessor();
    void prepareToPlay(double sr, int bs) override { synth.setCurrentPlaybackSampleRate(sr); fx.prepare((float) sr); juce::ignoreUnused(bs); }
    void releaseResources() override {}
    bool isBusesLayoutSupported(const BusesLayout& l) const override { return l.getMainOutputChannelSet() == juce::AudioChannelSet::stereo(); }
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }
    const juce::String getName() const override { return "Whiskerwave"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    double getTailLengthSeconds() const override { return 12.0; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}
    void getStateInformation(juce::MemoryBlock&) override;
    void setStateInformation(const void*, int) override;

    juce::AudioProcessorValueTreeState apvts;
    whisker::WaveBank bank;
    std::atomic<float> outLevel { 0.f };
private:
    static juce::AudioProcessorValueTreeState::ParameterLayout layout();
    whisker::Params params;
    juce::Synthesiser synth;
    catfx::FxRack fx;   // built-in shimmer delay and reverb (shared catfx code from cat-ui)
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WhiskerwaveProcessor)
};
