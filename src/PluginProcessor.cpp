#include "PluginProcessor.h"
#include "PluginEditor.h"

using APVTS = juce::AudioProcessorValueTreeState;

APVTS::ParameterLayout WhiskerwaveProcessor::layout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> p;
    auto f = [&](const char* id, const char* name, float lo, float hi, float def, float centre = 0.f)
    {
        juce::NormalisableRange<float> r(lo, hi);
        if (centre > 0.f) r.setSkewForCentre(centre);
        p.push_back(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{id, 1}, name, r, def));
    };
    f("pos", "Wave position", 0.f, (float) whisker::kNumWaves - 1.f, 2.f);
    p.push_back(std::make_unique<juce::AudioParameterInt>(juce::ParameterID{"uni", 1}, "Unison voices", 1, 7, 1));
    f("det", "Unison detune (cents)", 0.f, 100.f, 20.f);
    f("spread", "Stereo spread", 0.f, 1.f, 0.7f);
    f("aA", "Amp attack", 0.001f, 5.f, 0.005f, 0.2f);
    f("aD", "Amp decay", 0.001f, 5.f, 0.3f, 0.5f);
    f("aS", "Amp sustain", 0.f, 1.f, 0.8f);
    f("aR", "Amp release", 0.001f, 8.f, 0.25f, 0.5f);
    f("fc", "Filter cutoff", 20.f, 18000.f, 8000.f, 1000.f);
    f("fr", "Filter resonance", 0.f, 1.f, 0.1f);
    f("fe", "Filter env amount", -1.f, 1.f, 0.3f);
    f("fA", "Filter attack", 0.001f, 5.f, 0.005f, 0.2f);
    f("fD", "Filter decay", 0.001f, 5.f, 0.4f, 0.5f);
    f("fS", "Filter sustain", 0.f, 1.f, 0.3f);
    f("fR", "Filter release", 0.001f, 8.f, 0.3f, 0.5f);
    f("lfoRate", "LFO rate", 0.05f, 20.f, 2.f, 2.f);
    f("lfoAmt", "LFO to wave position", 0.f, 1.f, 0.f);
    f("vol", "Volume", 0.f, 1.f, 0.6f);
    f("bend", "Pitch bend range (semitones)", 0.f, 24.f, 2.f);
    // Built-in FX (shared catfx code): shimmer delay then reverb
    p.push_back(std::make_unique<juce::AudioParameterChoice>(juce::ParameterID{"rvType", 1}, "Reverb type",
                juce::StringArray{ "Off", "Plate", "Hall", "Shimmer Plate", "Shimmer Hall" }, 0));
    f("rvDecay", "Reverb decay", 0.f, 1.f, 0.6f);
    f("rvDamp", "Reverb damping (Hz)", 500.f, 16000.f, 6000.f, 3000.f);
    f("rvMix", "Reverb mix", 0.f, 1.f, 0.25f);
    f("rvShift", "Reverb shimmer pitch", -12.f, 12.f, 12.f);
    f("rvShim", "Reverb shimmer amount", 0.f, 1.f, 0.5f);
    f("dlMix", "Delay mix (0 = off)", 0.f, 1.f, 0.f);
    f("dlTime", "Delay time (ms)", 20.f, 2000.f, 400.f, 400.f);
    f("dlFb", "Delay feedback", 0.f, 0.95f, 0.5f);
    f("dlShift", "Delay shimmer pitch", -12.f, 12.f, 12.f);
    f("dlShim", "Delay shimmer amount", 0.f, 1.f, 1.f);
    return { p.begin(), p.end() };
}

WhiskerwaveProcessor::WhiskerwaveProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "STATE", layout())
{
    auto g = [&](const char* id) { return apvts.getRawParameterValue(id); };
    params = { g("pos"), g("uni"), g("det"), g("spread"), g("aA"), g("aD"), g("aS"), g("aR"),
               g("fc"), g("fr"), g("fe"), g("fA"), g("fD"), g("fS"), g("fR"), g("lfoRate"), g("lfoAmt"), g("vol"), g("bend") };
    synth.addSound(new whisker::Sound());
    for (int i = 0; i < 8; ++i) synth.addVoice(new whisker::Voice(bank, params));
}

void WhiskerwaveProcessor::processBlock(juce::AudioBuffer<float>& buf, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals nd;
    buf.clear();
    synth.renderNextBlock(buf, midi, 0, buf.getNumSamples());
    if (buf.getNumChannels() >= 2)
    {
        auto v = [&](const char* id) { return apvts.getRawParameterValue(id)->load(); };
        catfx::FxRackParams fp;
        const int type = (int) v("rvType");
        fp.reverbOn = type > 0;
        fp.reverb.type = catfx::ReverbType(std::max(0, type - 1));
        fp.reverb.p.decay = v("rvDecay"); fp.reverb.p.dampHz = v("rvDamp"); fp.reverb.mix = v("rvMix");
        fp.reverb.shimmerSemis = v("rvShift"); fp.reverb.shimmerAmount = v("rvShim");
        fp.delayOn = v("dlMix") > 0.001f;
        fp.delay.mix = v("dlMix"); fp.delay.timeMs = v("dlTime"); fp.delay.feedback = v("dlFb");
        fp.delay.shiftSemis = v("dlShift"); fp.delay.shimmerAmount = v("dlShim");
        fx.process(buf.getWritePointer(0), buf.getWritePointer(1), buf.getNumSamples(), fp);
    }
    outLevel = buf.getMagnitude(0, buf.getNumSamples());
}

juce::AudioProcessorEditor* WhiskerwaveProcessor::createEditor() { return new WhiskerwaveEditor(*this); }
void WhiskerwaveProcessor::getStateInformation(juce::MemoryBlock& d)
{ if (auto xml = apvts.copyState().createXml()) copyXmlToBinary(*xml, d); }
void WhiskerwaveProcessor::setStateInformation(const void* d, int s)
{ if (auto xml = getXmlFromBinary(d, s)) apvts.replaceState(juce::ValueTree::fromXml(*xml)); }
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new WhiskerwaveProcessor(); }
