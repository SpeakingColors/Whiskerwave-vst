#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include "FxFactory.h"
#include "Params.h"

// One modulation route as the mockup stores it: source id, destination (parameter key or "fx:<node id>:<param key>"), amount, unipolar.
struct SlotDesc { juce::String s, d; double a = 0; bool u = false, b = false; };

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
    int getNumPrograms() override { return juce::jmax(1, numFactory()); }
    int getCurrentProgram() override { return program; }
    void setCurrentProgram(int i) override { if (i != program || !loadedOnce) loadFactory(i); }
    const juce::String getProgramName(int i) override { return factoryName(i); }
    void changeProgramName(int, const juce::String&) override {}
    void getStateInformation(juce::MemoryBlock&) override;
    void setStateInformation(const void*, int) override;

    // ---- patches (the mockup's own preset format, so presets move between the web mockup and the plugin)
    int numFactory() const { return factory.isArray() ? factory.size() : 0; }
    juce::String factoryName(int i) const { return i >= 0 && i < numFactory() ? factory[i]["name"].toString() : juce::String("Init"); }
    juce::var factoryInfo(int i) const { return i >= 0 && i < numFactory() ? factory[i] : juce::var(); }
    void loadFactory(int i);
    void applyPatch(const juce::var& st, const juce::String& name);
    juce::var capturePatch() const;
    juce::File userPresetDir() const;
    bool saveUserPreset(const juce::String& name);
    bool loadUserPreset(const juce::File& f);
    juce::String patchName { "Init" };

    // ---- modulation and FX model (message thread). Call commitSlots()/commitChains() after editing.
    std::vector<SlotDesc> slots; std::vector<whisker::NodeP> chains[7]; juce::StringArray macroNames;
    float custom[20][32] {}; std::vector<float> draw[16]; whisker::ArpSeq seq; juce::var envpts;
    void commitSlots(); void commitChains(); void commitShapes();
    whisker::NodeP makeNode(const juce::String& type, const juce::String& id = {});
    whisker::NodeP nodeFromVar(const juce::var&); juce::var nodeToVar(const whisker::NodeP&) const;
    juce::String freshNodeId();
    void noteFromUi(int note, float vel, bool on) { const juce::SpinLock::ScopedLockType l(uiLock); uiNotes.addEvent(on ? juce::MidiMessage::noteOn(1, note, vel) : juce::MidiMessage::noteOff(1, note), 0); }
    void midiFromUi(const juce::MidiMessage& m) { const juce::SpinLock::ScopedLockType l(uiLock); uiNotes.addEvent(m, 0); }
    void panicFromUi() { wantPanic = true; }
    float paramValue(int i) const { return rawP[(size_t) i]->load(); }
    int tableOf(int osc) const { return (int) rawTab[osc]->load(); }

    juce::AudioProcessorValueTreeState apvts;
    whisker::TableCache tables;
    std::unique_ptr<whisker::Engine> engine; std::unique_ptr<whisker::FxHost> fx;
    std::atomic<float> outL { 0.f }, outR { 0.f }, limGr { 0.f }; std::atomic<int> voicesOn { 0 };
    juce::ChangeBroadcaster patchChanged;
    static const char* busName(int c) { static const char* n[7] = {"t0", "t1", "t2", "t3", "x1", "x2", "mst"}; return n[c]; }
private:
    void timerCallback() override { refreshTables(); }
    void refreshTables();
    void syncParams(bool all);
    void applyPendingConfig();
    struct Config { std::vector<whisker::Slot> slots; float custom[20][32] {}; float draw[16][128] {}; int drawN[16] {}; whisker::ArpSeq seq; };
    void setParamValue(const juce::String& id, float v);

    juce::var factory; int program = 0; bool loadedOnce = false; int nodeCounter = 0;
    std::vector<std::atomic<float>*> rawP; std::vector<float> lastP;
    std::atomic<float>* rawTab[6] {};
    std::atomic<const whisker::Table*> tabPtr[6] {}; int tabIdx[6] { -1, -1, -1, -1, -1, -1 }; double tabSw[6] {}, tabSk[6] {};
    juce::CriticalSection cfgLock; Config cfg; std::atomic<bool> cfgDirty { false }, wantHard { false }, wantPanic { false };
    juce::MidiBuffer uiNotes; juce::SpinLock uiLock;
    double sampleRate = 44100.0; int lastLatency = -1;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WhiskerwaveProcessor)
};
