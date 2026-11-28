#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include "Engine.h"
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
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return "Init"; }
    void changeProgramName(int, const juce::String&) override {}
    void getStateInformation(juce::MemoryBlock&) override;
    void setStateInformation(const void*, int) override;

    juce::AudioProcessorValueTreeState apvts;
    whisker::TableCache tables;
    std::atomic<float> outLevel { 0.f };

    // non-parameter engine state (matrix slots, drawn envelopes, custom LFO shapes, arp steps); message thread sets, audio thread picks up
    struct Config
    {
        std::vector<whisker::Slot> slots;
        float custom[20][32] {}; float draw[16][128] {}; int drawN[16] {};
        whisker::ArpSeq seq;
        Config();
    };
    void setConfig(const Config& c);
    Config getConfig() const;
private:
    void timerCallback() override { refreshTables(); }
    void refreshTables();
    void syncParams(bool all);
    void applyPendingConfig();

    std::unique_ptr<whisker::Engine> engine;
    std::vector<std::atomic<float>*> rawP; std::vector<float> lastP;
    std::atomic<float>* rawTab[6] {};
    std::atomic<const whisker::Table*> tabPtr[6] {}; int tabIdx[6] { -1, -1, -1, -1, -1, -1 }; double tabSw[6] {}, tabSk[6] {};
    mutable juce::CriticalSection cfgLock; Config cfg; std::atomic<bool> cfgDirty { false };
    double sampleRate = 44100.0; int lastLatency = -1;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WhiskerwaveProcessor)
};
