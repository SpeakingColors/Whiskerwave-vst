#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "WhiskerBinary.h"

using namespace whisker;

WhiskerwaveProcessor::WhiskerwaveProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "STATE", makeLayout())
{
    tables.setSource(WhiskerBinary::ww_tables_bin, (size_t) WhiskerBinary::ww_tables_binSize);
    refreshTables();
    startTimerHz(20);
}

void WhiskerwaveProcessor::refreshTables()
{
    // message thread: build tables when the table choice changed, then publish the pointer for the audio thread
    for (int o = 0; o < 3; ++o)
    {
        const int idx = (int) raw(juce::String("abc").substring(o, o + 1) + "_tab")->load();
        if (idx != tabIdx[o] || tabPtr[o].load() == nullptr) { tabPtr[o].store(tables.get(idx)); tabIdx[o] = idx; }
    }
}

void WhiskerwaveProcessor::prepareToPlay(double sr, int bs)
{
    sampleRate = sr;
    engine.prepare(sr);
    fx.prepare((float) sr);
    limiter.prepare({ sr, (juce::uint32) std::max(bs, 1), 2 });
    limiter.setThreshold(-0.3f); limiter.setRelease(100.f);
    bufL.assign((size_t) std::max(bs, 4096), 0.0); bufR = bufL;
    refreshTables();
}

void WhiskerwaveProcessor::fillPatch(Patch& P)
{
    auto v = [&](const juce::String& id) { return raw(id)->load(); };
    P.master = v("master"); P.poly = (int) v("poly"); P.vel = v("vel"); P.bendr = v("bendr");
    for (int o = 0; o < 3; ++o)
    {
        const juce::String k = juce::String("abc").substring(o, o + 1) + "_";
        OscP& c = P.o[o];
        c.on = v(k + "on") > .5f; c.tab = tabPtr[o].load(); c.pos = v(k + "pos"); c.oct = (int) v(k + "oct"); c.semi = (int) v(k + "semi");
        c.fine = v(k + "fine"); c.lvl = v(k + "lvl"); c.pan = v(k + "pan"); c.ph = v(k + "ph"); c.rnd = v(k + "rnd");
        c.uv = (int) v(k + "uv"); c.ud = v(k + "ud"); c.us = (int) v(k + "us"); c.ub = v(k + "ub"); c.usp = v(k + "usp"); c.anl = v(k + "anl");
        c.rt = (int) v(k + "rt");
        c.w1 = (int) v(k + "w1"); c.w1a = v(k + "w1a"); c.w2 = (int) v(k + "w2"); c.w2a = v(k + "w2a");
        c.mm = (int) v(k + "mm"); c.ms = (int) v(k + "ms"); c.ma = v(k + "ma"); c.fb = v(k + "fb");
    }
    for (int f = 0; f < 2; ++f)
    {
        const juce::String k = f == 0 ? "f1_" : "f2_";
        FiltP& c = P.f[f];
        c.type = kFilterJs[juce::jlimit(0, (int) kFilterNames.size() - 1, (int) v(k + "type"))];
        c.cut = v(k + "cut"); c.res = v(k + "res"); c.kt = v(k + "kt"); c.env = v(k + "env"); c.es = (int) v(k + "es");
    }
    P.serial = (int) v("frt") == 0;
    for (int e = 0; e < 2; ++e)
    {
        const juce::String k = e == 0 ? "e1_" : "e2_";
        EnvP& c = P.e[e];
        c.a = v(k + "a"); c.h = v(k + "h"); c.d = v(k + "d"); c.s = v(k + "s"); c.r = v(k + "r"); c.c = v(k + "c"); c.ca = v(k + "ca");
    }
    P.sub = v("sub_on") > .5f; P.subw = (int) v("sub_wave"); P.subo = (int) v("sub_oct"); P.subl = v("sub_lvl"); P.subpw = v("sub_pw");
    P.subfn = v("sub_fine"); P.subpn = v("sub_pan"); P.subrt = (int) v("sub_rt");
    P.nz = v("nz_on") > .5f; P.nzt = (int) v("nz_type"); P.nzl = v("nz_lvl"); P.nzpn = v("nz_pan"); P.nzrt = (int) v("nz_rt");
}

void WhiskerwaveProcessor::processBlock(juce::AudioBuffer<float>& buf, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals nd;
    const int num = buf.getNumSamples();
    buf.clear();
    if ((int) bufL.size() < num) { bufL.assign((size_t) num, 0.0); bufR = bufL; } // only if the host exceeds the announced block size
    std::fill(bufL.begin(), bufL.begin() + num, 0.0); std::fill(bufR.begin(), bufR.begin() + num, 0.0);
    fillPatch(patch);
    int pos = 0;
    auto renderTo = [&](int end)
    { if (end > pos) { engine.render(patch, bufL.data() + pos, bufR.data() + pos, end - pos); pos = end; } };
    for (const auto meta : midi)
    {
        renderTo(meta.samplePosition);
        const auto m = meta.getMessage();
        if (m.isNoteOn()) engine.noteOn(m.getNoteNumber(), m.getFloatVelocity(), patch);
        else if (m.isNoteOff()) engine.noteOff(m.getNoteNumber());
        else if (m.isAllNotesOff() || m.isAllSoundOff()) engine.allOff();
        else if (m.isPitchWheel()) engine.setBend((m.getPitchWheelValue() - 8192) / 8192.0);
    }
    renderTo(num);
    const float gain = std::pow(10.f, patch.master / 20.f);
    auto* L = buf.getWritePointer(0); auto* R = buf.getWritePointer(1);
    for (int i = 0; i < num; ++i) { L[i] = (float) bufL[(size_t) i] * gain; R[i] = (float) bufR[(size_t) i] * gain; }
    // built-in FX (shared catfx code)
    {
        auto v = [&](const char* id) { return raw(id)->load(); };
        catfx::FxRackParams fp;
        const int type = (int) v("rvType");
        fp.reverbOn = type > 0; fp.reverb.type = catfx::ReverbType(std::max(0, type - 1));
        fp.reverb.p.decay = v("rvDecay"); fp.reverb.p.dampHz = v("rvDamp"); fp.reverb.mix = v("rvMix");
        fp.reverb.shimmerSemis = v("rvShift"); fp.reverb.shimmerAmount = v("rvShim");
        fp.delayOn = v("dlMix") > .001f; fp.delay.mix = v("dlMix"); fp.delay.timeMs = v("dlTime"); fp.delay.feedback = v("dlFb");
        fp.delay.shiftSemis = v("dlShift"); fp.delay.shimmerAmount = v("dlShim");
        fx.process(L, R, num, fp);
    }
    // safety limiter, then a hard ceiling so nothing above 0 dBFS leaves the plugin
    juce::dsp::AudioBlock<float> block(buf);
    limiter.process(juce::dsp::ProcessContextReplacing<float>(block));
    for (int i = 0; i < num; ++i) { L[i] = juce::jlimit(-.966f, .966f, L[i]); R[i] = juce::jlimit(-.966f, .966f, R[i]); }
    outLevel = buf.getMagnitude(0, num);
}

void WhiskerwaveProcessor::setCurrentProgram(int i)
{
    program = juce::jlimit(0, getNumPrograms() - 1, i);
    for (auto* p : getParameters())
        if (auto* rp = dynamic_cast<juce::RangedAudioParameter*>(p)) rp->setValueNotifyingHost(rp->getDefaultValue());
    for (auto& kv : factoryPresets()[(size_t) program].v)
        if (auto* rp = apvts.getParameter(kv.first)) rp->setValueNotifyingHost(rp->convertTo0to1(kv.second));
    engine.allOff();
}

juce::AudioProcessorEditor* WhiskerwaveProcessor::createEditor() { return new WhiskerwaveEditor(*this); }
void WhiskerwaveProcessor::getStateInformation(juce::MemoryBlock& d)
{
    auto state = apvts.copyState(); state.setProperty("program", program, nullptr);
    if (auto xml = state.createXml()) copyXmlToBinary(*xml, d);
}
void WhiskerwaveProcessor::setStateInformation(const void* d, int s)
{
    if (auto xml = getXmlFromBinary(d, s))
    {
        auto vt = juce::ValueTree::fromXml(*xml);
        program = juce::jlimit(0, getNumPrograms() - 1, (int) vt.getProperty("program", 0));
        apvts.replaceState(vt);
        refreshTables();
    }
}
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new WhiskerwaveProcessor(); }
