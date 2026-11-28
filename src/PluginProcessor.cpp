#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "WhiskerBinary.h"

using namespace whisker;

WhiskerwaveProcessor::Config::Config()
{
    for (int j = 0; j < 20; ++j) for (int i = 0; i < 32; ++i) custom[j][i] = (float) std::sin(i / 32.0 * kTau);
    for (int j = 0; j < 16; ++j) { drawN[j] = 32; for (int i = 0; i < 32; ++i) draw[j][i] = (float) (j == 3 ? i / 31.0 : std::exp(-i / 8.0)); }
}

WhiskerwaveProcessor::WhiskerwaveProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "STATE", makeLayout())
{
    tables.setSource(WhiskerBinary::ww_tables_bin, (size_t) WhiskerBinary::ww_tables_binSize);
    engine = std::make_unique<Engine>(44100.0);
    rawP.resize((size_t) kNumParams); lastP.assign((size_t) kNumParams, -1.0e9f);
    for (int i = 0; i < kNumParams; ++i) rawP[(size_t) i] = apvts.getRawParameterValue(kParams[i].id);
    for (int o = 0; o < 6; ++o) rawTab[o] = apvts.getRawParameterValue(juce::String("abcdef").substring(o, o + 1) + "_tab");
    refreshTables();
    startTimerHz(20);
}

void WhiskerwaveProcessor::refreshTables()
{
    // message thread: build tables when the table choice, warp or smear changed, then publish the pointer for the audio thread
    const auto& I = idx();
    for (int o = 0; o < 6; ++o)
    {
        const int ti = (int) rawTab[o]->load();
        const double sw = rawP[(size_t) I.osc[o].sw]->load(), sk = rawP[(size_t) I.osc[o].sk]->load();
        if (ti != tabIdx[o] || std::fabs(sw - tabSw[o]) > .001 || std::fabs(sk - tabSk[o]) > .001 || tabPtr[o].load() == nullptr)
        { tabPtr[o].store(tables.get(ti, sw, sk)); tabIdx[o] = ti; tabSw[o] = sw; tabSk[o] = sk; }
    }
}

void WhiskerwaveProcessor::setConfig(const Config& c) { { const juce::ScopedLock l(cfgLock); cfg = c; } cfgDirty = true; }
WhiskerwaveProcessor::Config WhiskerwaveProcessor::getConfig() const { const juce::ScopedLock l(cfgLock); return cfg; }
void WhiskerwaveProcessor::applyPendingConfig()
{
    if (!cfgDirty.load()) return;
    const juce::ScopedTryLock l(cfgLock); if (!l.isLocked()) return;
    auto& S = engine->S; S.nSlots = (int) std::min<size_t>(64, cfg.slots.size());
    for (int i = 0; i < S.nSlots; ++i) S.slots[i] = cfg.slots[(size_t) i];
    std::memcpy(S.custom, cfg.custom, sizeof S.custom); std::memcpy(S.draw, cfg.draw, sizeof S.draw); std::memcpy(S.drawN, cfg.drawN, sizeof S.drawN);
    engine->seq = cfg.seq; cfgDirty = false;
}

void WhiskerwaveProcessor::prepareToPlay(double sr, int)
{
    sampleRate = sr; engine->setSampleRate(sr); engine->panic();
    refreshTables(); syncParams(true); cfgDirty = true;
}

void WhiskerwaveProcessor::syncParams(bool all)
{
    for (int i = 0; i < kNumParams; ++i)
    {
        const float v = rawP[(size_t) i]->load();
        if (all) { engine->setParam(i, v); lastP[(size_t) i] = v; }
        else if (v != lastP[(size_t) i]) { engine->setSmooth(i, v); lastP[(size_t) i] = v; }
    }
    for (int o = 0; o < 6; ++o) engine->S.tab[o] = tabPtr[o].load();
}

void WhiskerwaveProcessor::processBlock(juce::AudioBuffer<float>& buf, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals nd;
    const int num = buf.getNumSamples(); buf.clear();
    if (buf.getNumChannels() < 2) return;
    applyPendingConfig(); syncParams(false);
    const auto& I = idx();
    if (const int lat = engine->pv(I.lim) != 0 ? engine->mlim->latency() : 0; lat != lastLatency) { lastLatency = lat; setLatencySamples(lat); }
    if (auto* ph = getPlayHead()) if (auto pi = ph->getPosition()) if (auto bpm = pi->getBpm()) if (*bpm > 20) engine->S.pv[I.bpm] = *bpm;
    auto* L = buf.getWritePointer(0); auto* R = buf.getWritePointer(1);
    int pos = 0;
    auto renderTo = [&](int end) { if (end > pos) { engine->process(L + pos, R + pos, end - pos); pos = end; } };
    for (const auto meta : midi)
    {
        renderTo(meta.samplePosition);
        const auto m = meta.getMessage();
        if (m.isNoteOn()) engine->noteOn(m.getNoteNumber(), m.getFloatVelocity());
        else if (m.isNoteOff()) engine->noteOff(m.getNoteNumber());
        else if (m.isAllNotesOff() || m.isAllSoundOff()) engine->panic();
        else if (m.isPitchWheel()) engine->bendT = (m.getPitchWheelValue() - 8192) / 8192.0;
        else if (m.isController() && m.getControllerNumber() == 1) engine->wheelT = m.getControllerValue() / 127.0;
        else if (m.isChannelPressure()) engine->atT = m.getChannelPressureValue() / 127.0;
    }
    renderTo(num);
    outLevel = buf.getMagnitude(0, num);
}

juce::AudioProcessorEditor* WhiskerwaveProcessor::createEditor() { return new WhiskerwaveEditor(*this); }
void WhiskerwaveProcessor::getStateInformation(juce::MemoryBlock& d)
{
    auto state = apvts.copyState();
    if (auto xml = state.createXml()) copyXmlToBinary(*xml, d);
}
void WhiskerwaveProcessor::setStateInformation(const void* d, int s)
{
    if (auto xml = getXmlFromBinary(d, s)) { apvts.replaceState(juce::ValueTree::fromXml(*xml)); refreshTables(); }
}
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new WhiskerwaveProcessor(); }
