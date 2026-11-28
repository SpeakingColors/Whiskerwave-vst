#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "WhiskerBinary.h"

using namespace whisker;
namespace {
const char* const kSrcIds[kNumSrc] = {"e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "e10", "e11", "e12", "e13", "e14", "e15", "e16", "l1", "l2", "l3", "l4", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "vel", "key", "wheel", "bend", "at", "rnd"};
int srcIndex(const juce::String& s) { for (int i = 0; i < kNumSrc; ++i) if (s == kSrcIds[i]) return i; return -1; }
int tableIndex(const juce::String& n) { for (int i = 0; i < kNumTables; ++i) if (n == kTableNames[i]) return i; return 0; }
}

WhiskerwaveProcessor::WhiskerwaveProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "STATE", makeLayout())
{
    tables.setSource(WhiskerBinary::ww_tables_bin, (size_t) WhiskerBinary::ww_tables_binSize);
    engine = std::make_unique<Engine>(44100.0); fx = std::make_unique<FxHost>(*engine);
    rawP.resize((size_t) kNumParams); lastP.assign((size_t) kNumParams, -1.0e9f);
    for (int i = 0; i < kNumParams; ++i) rawP[(size_t) i] = apvts.getRawParameterValue(kParams[i].id);
    for (int o = 0; o < 6; ++o) rawTab[o] = apvts.getRawParameterValue(juce::String("abcdef").substring(o, o + 1) + "_tab");
    factory = juce::JSON::parse(juce::String::fromUTF8(WhiskerBinary::presets_json, WhiskerBinary::presets_jsonSize));
    loadFactory(0);
    startTimerHz(20);
}

// ---------------------------------------------------------------- tables and parameters
void WhiskerwaveProcessor::refreshTables()
{
    const auto& I = idx();
    for (int o = 0; o < 6; ++o)
    {
        const int ti = (int) rawTab[o]->load();
        const double sw = rawP[(size_t) I.osc[o].sw]->load(), sk = rawP[(size_t) I.osc[o].sk]->load();
        if (ti != tabIdx[o] || std::fabs(sw - tabSw[o]) > .001 || std::fabs(sk - tabSk[o]) > .001 || tabPtr[o].load() == nullptr)
        { tabPtr[o].store(tables.get(ti, sw, sk)); tabIdx[o] = ti; tabSw[o] = sw; tabSk[o] = sk; }
    }
}
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
    sampleRate = sr; engine->setSampleRate(sr); engine->panic(); fx->setSampleRate(sr);
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
    applyPendingConfig();
    if (wantPanic.exchange(false)) engine->panic();
    if (wantHard.exchange(false)) { engine->panic(); syncParams(true); } else syncParams(false);
    { const juce::SpinLock::ScopedTryLockType l(uiLock); if (l.isLocked() && !uiNotes.isEmpty()) { midi.addEvents(uiNotes, 0, -1, 0); uiNotes.clear(); } }
    const auto& I = idx();
    if (const int lat = engine->pv(I.lim) != 0 ? engine->mlim->latency() : 0; lat != lastLatency) { lastLatency = lat; setLatencySamples(lat); }
    if (auto* ph = getPlayHead()) if (auto pi = ph->getPosition()) if (auto bpm = pi->getBpm()) if (*bpm > 20) engine->S.pv[I.bpm] = *bpm;
    auto* L = buf.getWritePointer(0); auto* R = buf.getWritePointer(1);
    int pos = 0;
    auto renderTo = [&](int end) { if (end > pos) { engine->process(L + pos, R + pos, end - pos); pos = end; } };
    for (const auto meta : midi)
    {
        renderTo(juce::jmin(num, meta.samplePosition));
        const auto m = meta.getMessage();
        if (m.isNoteOn()) engine->noteOn(m.getNoteNumber(), m.getFloatVelocity());
        else if (m.isNoteOff()) engine->noteOff(m.getNoteNumber());
        else if (m.isAllNotesOff() || m.isAllSoundOff()) engine->panic();
        else if (m.isPitchWheel()) engine->bendT = (m.getPitchWheelValue() - 8192) / 8192.0;
        else if (m.isController() && m.getControllerNumber() == 1) engine->wheelT = m.getControllerValue() / 127.0;
        else if (m.isChannelPressure()) engine->atT = m.getChannelPressureValue() / 127.0;
    }
    renderTo(num);
    outL = juce::jmax(outL.load() * .9f, buf.getMagnitude(0, 0, num)); outR = juce::jmax(outR.load() * .9f, buf.getMagnitude(1, 0, num)); limGr = (float) engine->limGR;
    int vo = 0; for (auto& v : engine->voices) if (v->active) ++vo; voicesOn = vo;
}

// ---------------------------------------------------------------- patches
void WhiskerwaveProcessor::setParamValue(const juce::String& id, float v) { if (auto* p = apvts.getParameter(id)) p->setValueNotifyingHost(p->convertTo0to1(v)); }
juce::String WhiskerwaveProcessor::freshNodeId() { return "n" + juce::String(++nodeCounter) + "_" + juce::String::toHexString(juce::Random::getSystemRandom().nextInt(0xffffff)); }
NodeP WhiskerwaveProcessor::makeNode(const juce::String& type, const juce::String& id)
{
    const int t = fxTypeByName(type.toStdString()); if (t < 0) return {};
    return fx->newNode(t, (id.isNotEmpty() ? id : freshNodeId()).toRawUTF8());
}
NodeP WhiskerwaveProcessor::nodeFromVar(const juce::var& v)
{
    auto base = makeNode(v["type"].toString(), v["id"].toString()); if (!base) return {};
    auto n = std::make_shared<FxNode>(*base); const FxSpec& sp = kFx[n->type]; auto& st = *n->st;
    st.on = !v.hasProperty("on") || (int) v["on"] != 0;
    if (auto* po = v["p"].getDynamicObject()) for (int i = 0; i < sp.np; ++i) if (po->hasProperty(sp.ps[i].key)) st.p[i] = (float) (double) po->getProperty(sp.ps[i].key);
    if (auto* pa = v["pat"].getArray()) for (int i = 0; i < juce::jmin(16, pa->size()); ++i) st.pat[i] = (int) (*pa)[i];
    if (v.hasProperty("n")) st.nb = juce::jlimit(2, 4, (int) v["n"]);
    if (auto* a = v["so"].getArray()) for (int i = 0; i < juce::jmin(4, a->size()); ++i) st.so[i] = (int) (*a)[i] != 0;
    if (auto* a = v["ms"].getArray()) for (int i = 0; i < juce::jmin(4, a->size()); ++i) st.ms[i] = (int) (*a)[i] != 0;
    if (auto* b = v["bands"].getArray()) for (int j = 0; j < juce::jmin(4, b->size()); ++j) if (auto* l = (*b)[j].getArray()) for (auto& c : *l) if (auto cn = nodeFromVar(c)) n->bands[j].push_back(cn);
    return n;
}
juce::var WhiskerwaveProcessor::nodeToVar(const NodeP& n) const
{
    auto* o = new juce::DynamicObject(); juce::var v(o); const FxSpec& sp = kFx[n->type]; const auto& st = *n->st;
    o->setProperty("id", juce::String(n->id)); o->setProperty("type", sp.type); o->setProperty("on", st.on.load() ? 1 : 0);
    auto* p = new juce::DynamicObject(); for (int i = 0; i < sp.np; ++i) p->setProperty(sp.ps[i].key, (double) st.p[i].load()); o->setProperty("p", juce::var(p));
    if (n->type == FX_tgate) { juce::Array<juce::var> a; for (int i = 0; i < 16; ++i) a.add(st.pat[i].load()); o->setProperty("pat", a); }
    if (n->type == FX_split)
    {
        o->setProperty("n", st.nb.load()); juce::Array<juce::var> so, ms, bands;
        for (int j = 0; j < 4; ++j) { so.add(st.so[j].load() ? 1 : 0); ms.add(st.ms[j].load() ? 1 : 0); juce::Array<juce::var> l; for (auto& c : n->bands[j]) l.add(nodeToVar(c)); bands.add(l); }
        o->setProperty("so", so); o->setProperty("ms", ms); o->setProperty("bands", bands);
    }
    return v;
}
void WhiskerwaveProcessor::commitSlots()
{
    Config c; { const juce::ScopedLock l(cfgLock); c = cfg; }
    c.slots.clear();
    for (auto& s : slots)
    {
        if (s.b || s.d.startsWith("fx:")) continue;
        const int src = srcIndex(s.s), dst = pidx(s.d.toStdString()); if (src < 0 || dst < 0) continue;
        Slot q; q.src = src; q.dst = dst; q.amt = s.a; q.uni = s.u; c.slots.push_back(q);
    }
    { const juce::ScopedLock l(cfgLock); cfg.slots = c.slots; } cfgDirty = true;
    commitChains(); // FX routes live in the chain snapshot
}
void WhiskerwaveProcessor::commitChains()
{
    std::vector<FxRouteDesc> routes;
    for (auto& s : slots) if (!s.b && s.d.startsWith("fx:")) { const int src = srcIndex(s.s); if (src < 0) continue; const auto rest = s.d.substring(3); routes.push_back({src, rest.upToFirstOccurrenceOf(":", false, false).toStdString(), rest.fromFirstOccurrenceOf(":", false, false).toStdString(), (float) s.a, s.u}); }
    fx->publish(chains, routes);
}
void WhiskerwaveProcessor::commitShapes()
{
    const juce::ScopedLock l(cfgLock);
    std::memcpy(cfg.custom, custom, sizeof custom);
    for (int j = 0; j < 16; ++j) { const int n = juce::jmin(128, (int) draw[j].size()); cfg.drawN[j] = n; for (int i = 0; i < n; ++i) cfg.draw[j][i] = draw[j][(size_t) i]; }
    cfg.seq = seq; cfgDirty = true;
}

void WhiskerwaveProcessor::applyPatch(const juce::var& st, const juce::String& name)
{
    // parameters: defaults first, then the values the patch holds
    auto* po = st["p"].getDynamicObject();
    for (int i = 0; i < kNumParams; ++i) { const auto& ps = kParams[i]; float v = ps.def; if (po != nullptr && po->hasProperty(ps.key)) v = (float) (double) po->getProperty(ps.key); setParamValue(ps.id, v); }
    for (int o = 0; o < 6; ++o) { const auto k = juce::String("abcdef").substring(o, o + 1); setParamValue(k + "_tab", (float) tableIndex(st["tabs"].getProperty(juce::Identifier(k), "Sine to Saw").toString())); }
    // modulation routes
    slots.clear();
    if (auto* a = st["slots"].getArray()) for (auto& s : *a) { SlotDesc d; d.s = s["s"].toString(); d.d = s["d"].toString(); d.a = (double) s["a"]; d.u = (int) s["u"] != 0; d.b = s.hasProperty("b") && (int) s["b"] != 0; slots.push_back(d); }
    // FX chains
    for (int c = 0; c < 7; ++c) { chains[c].clear(); if (auto* l = st["chains"][busName(c)].getArray()) for (auto& nv : *l) if (auto n = nodeFromVar(nv)) chains[c].push_back(n); }
    if (!st["chains"].isObject()) { if (auto n = makeNode("verb")) { n->st->p[kFx[FX_verb].mixIdx] = 1.f; chains[4].push_back(n); } if (auto n = makeNode("delay")) { n->st->p[kFx[FX_delay].mixIdx] = 1.f; chains[5].push_back(n); } }
    // shapes, drawn envelopes, arp steps, macro names
    for (int j = 0; j < 20; ++j) for (int i = 0; i < 32; ++i) custom[j][i] = (float) std::sin(i / 32.0 * kTau);
    if (auto* a = st["custom"].getArray()) for (int j = 0; j < juce::jmin(20, a->size()); ++j) if (auto* r = (*a)[j].getArray()) for (int i = 0; i < juce::jmin(32, r->size()); ++i) custom[j][i] = (float) (double) (*r)[i];
    for (int j = 0; j < 16; ++j) { draw[j].clear(); for (int i = 0; i < 32; ++i) draw[j].push_back((float) (j == 3 ? i / 31.0 : std::exp(-i / 8.0))); }
    if (auto* a = st["draw"].getArray()) for (int j = 0; j < juce::jmin(16, a->size()); ++j) if (auto* r = (*a)[j].getArray()) { bool any = false; for (auto& x : *r) if ((double) x != 0) any = true; if (r->size() > 0 && any) { draw[j].clear(); for (int i = 0; i < juce::jmin(128, r->size()); ++i) draw[j].push_back((float) (double) (*r)[i]); } }
    seq = ArpSeq();
    if (st["seq"].isObject()) { const auto& q = st["seq"]; seq.len = juce::jlimit(1, 16, (int) q["len"]); auto rd = [&](const char* k, double* dst) { if (auto* a = q[k].getArray()) for (int i = 0; i < juce::jmin(16, a->size()); ++i) dst[i] = (double) (*a)[i]; }; rd("on", seq.on); rd("vel", seq.vel); rd("semi", seq.semi); rd("rat", seq.rat); }
    envpts = st["envpts"];
    macroNames.clear(); for (int i = 0; i < 8; ++i) { juce::String nm = "Macro " + juce::String(i + 1); if (auto* a = st["mnames"].getArray()) if (i < a->size() && (*a)[i].toString().isNotEmpty()) nm = (*a)[i].toString(); macroNames.add(nm); }
    patchName = name; loadedOnce = true;
    refreshTables(); commitShapes(); commitSlots(); wantHard = true;
    patchChanged.sendChangeMessage();
}
juce::var WhiskerwaveProcessor::capturePatch() const
{
    auto* o = new juce::DynamicObject(); juce::var v(o); o->setProperty("v", 5);
    auto* p = new juce::DynamicObject();
    for (int i = 0; i < kNumParams; ++i) { const float val = rawP[(size_t) i]->load(); if (std::fabs(val - kParams[i].def) > 1.0e-7f) p->setProperty(kParams[i].key, (double) val); }
    o->setProperty("p", juce::var(p));
    auto* tb = new juce::DynamicObject(); for (int k = 0; k < 6; ++k) tb->setProperty(juce::Identifier(juce::String("abcdef").substring(k, k + 1)), kTableNames[juce::jlimit(0, kNumTables - 1, (int) rawTab[k]->load())]); o->setProperty("tabs", juce::var(tb));
    juce::Array<juce::var> sl; for (auto& s : slots) { auto* so = new juce::DynamicObject(); so->setProperty("s", s.s); so->setProperty("d", s.d); so->setProperty("a", s.a); so->setProperty("u", s.u ? 1 : 0); if (s.b) so->setProperty("b", 1); sl.add(juce::var(so)); } o->setProperty("slots", sl);
    auto* ch = new juce::DynamicObject(); for (int c = 0; c < 7; ++c) { juce::Array<juce::var> l; for (auto& n : chains[c]) l.add(nodeToVar(n)); ch->setProperty(busName(c), l); } o->setProperty("chains", juce::var(ch));
    juce::Array<juce::var> cu; for (int j = 0; j < 20; ++j) { juce::Array<juce::var> r; for (int i = 0; i < 32; ++i) r.add((double) custom[j][i]); cu.add(r); } o->setProperty("custom", cu);
    juce::Array<juce::var> dr; for (int j = 0; j < 16; ++j) { juce::Array<juce::var> r; for (float x : draw[j]) r.add((double) x); dr.add(r); } o->setProperty("draw", dr);
    auto* sq = new juce::DynamicObject(); sq->setProperty("len", seq.len); auto wr = [&](const char* k, const double* src) { juce::Array<juce::var> a; for (int i = 0; i < 16; ++i) a.add(src[i]); sq->setProperty(k, a); }; wr("on", seq.on); wr("vel", seq.vel); wr("semi", seq.semi); wr("rat", seq.rat); o->setProperty("seq", juce::var(sq));
    juce::Array<juce::var> mn; for (auto& s : macroNames) mn.add(s); o->setProperty("mnames", mn);
    if (!envpts.isVoid()) o->setProperty("envpts", envpts);
    return v;
}
void WhiskerwaveProcessor::loadFactory(int i)
{
    if (numFactory() == 0) { applyPatch(juce::var(new juce::DynamicObject()), "Init"); program = 0; return; }
    program = juce::jlimit(0, numFactory() - 1, i); applyPatch(factory[program], factory[program]["name"].toString());
}
juce::File WhiskerwaveProcessor::userPresetDir() const { return juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory).getChildFile("Studio 87").getChildFile("WhiskerWave").getChildFile("presets"); }
bool WhiskerwaveProcessor::saveUserPreset(const juce::String& name)
{
    const auto dir = userPresetDir(); if (!dir.createDirectory()) return false;
    auto* o = new juce::DynamicObject(); juce::var v(o); o->setProperty("name", name); o->setProperty("state", capturePatch());
    const bool ok = dir.getChildFile(juce::File::createLegalFileName(name) + ".wwpreset").replaceWithText(juce::JSON::toString(v, true));
    if (ok) { patchName = name; patchChanged.sendChangeMessage(); } return ok;
}
bool WhiskerwaveProcessor::loadUserPreset(const juce::File& f)
{
    const auto v = juce::JSON::parse(f.loadFileAsString()); if (!v.isObject()) return false;
    const auto st = v.hasProperty("state") ? v["state"] : v; if (!st.isObject()) return false;
    applyPatch(st, v.getProperty("name", f.getFileNameWithoutExtension()).toString()); return true;
}

juce::AudioProcessorEditor* WhiskerwaveProcessor::createEditor() { return new WhiskerwaveEditor(*this); }
void WhiskerwaveProcessor::getStateInformation(juce::MemoryBlock& d)
{
    auto* o = new juce::DynamicObject(); juce::var v(o); o->setProperty("format", "whiskerwave"); o->setProperty("program", program); o->setProperty("name", patchName); o->setProperty("state", capturePatch());
    juce::MemoryOutputStream os(d, false); os.writeString(juce::JSON::toString(v, true));
}
void WhiskerwaveProcessor::setStateInformation(const void* d, int s)
{
    juce::MemoryInputStream is(d, (size_t) s, false); const auto v = juce::JSON::parse(is.readString());
    if (v.isObject() && v["state"].isObject()) { program = juce::jlimit(0, juce::jmax(0, numFactory() - 1), (int) v["program"]); applyPatch(v["state"], v["name"].toString()); return; }
    // session saved by v0.1.0 (plain parameter tree): keep the knob values, start from Init for everything else
    if (auto xml = getXmlFromBinary(d, s)) { loadFactory(0); apvts.replaceState(juce::ValueTree::fromXml(*xml)); refreshTables(); wantHard = true; }
}
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new WhiskerwaveProcessor(); }
