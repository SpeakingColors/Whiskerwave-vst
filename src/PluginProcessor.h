#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>
#include <catfx/Fx.h>
#include "Voice.h"
#include "Params.h"

class WhiskerwaveProcessor : public juce::AudioProcessor, private juce::Timer
{
public:
    WhiskerwaveProcessor();
    ~WhiskerwaveProcessor() override { stopTimer(); }
    void prepareToPlay(double sr, int bs) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported(const BusesLayout& l) const override { return l.getMainOutputChannelSet() == juce::AudioChannelSet::stereo(); }
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }
    const juce::String getName() const override { return "WhiskerWave"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    double getTailLengthSeconds() const override { return 12.0; }
    int getNumPrograms() override { return (int) whisker::factoryPresets().size(); }
    int getCurrentProgram() override { return program; }
    void setCurrentProgram(int i) override;
    const juce::String getProgramName(int i) override { return whisker::factoryPresets()[(size_t) juce::jlimit(0, getNumPrograms() - 1, i)].name; }
    void changeProgramName(int, const juce::String&) override {}
    void getStateInformation(juce::MemoryBlock&) override;
    void setStateInformation(const void*, int) override;

    juce::AudioProcessorValueTreeState apvts;
    whisker::TableCache tables;
    std::atomic<float> outLevel { 0.f };
    const whisker::Table* tableFor(int osc) const { return tabPtr[osc].load(); }
private:
    void timerCallback() override { refreshTables(); }
    void refreshTables();
    void fillPatch(whisker::Patch&);
    std::atomic<float>* raw(const juce::String& id) { return apvts.getRawParameterValue(id); }

    whisker::Engine engine;
    whisker::Patch patch;
    std::atomic<const whisker::Table*> tabPtr[3] {};
    int tabIdx[3] { -1, -1, -1 };
    int program = 0;
    double sampleRate = 44100.0;
    float bendNorm = 0.f;
    juce::dsp::Limiter<float> limiter;
    std::vector<double> bufL, bufR;
    catfx::FxRack fx;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WhiskerwaveProcessor)
};
