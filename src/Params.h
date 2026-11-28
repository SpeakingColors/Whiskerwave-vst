// Parameter layout. Ids follow the mockup keys with "." replaced by "_" (a.pos -> a_pos).
#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include "Engine.h"

namespace whisker
{
inline const juce::StringArray kFilterNames { "Off", "LP 12", "LP 24", "HP 12", "HP 24", "BP 12", "Notch", "Ladder 24", "Ladder 12", "Acid 18", "Ladder HP" };
inline const int kFilterJs[] = { 0, 2, 3, 6, 7, 8, 10, 14, 15, 16, 17 }; // mockup filter list indices
inline const juce::StringArray kUnisonNames { "Classic", "Supersaw", "JP Super", "Octaves", "Power", "Minor" };
inline const juce::StringArray kRouteNames { "Dry", "F1", "F2", "F1+F2" };
inline const juce::StringArray kSubNames { "Sine", "Triangle", "Square", "Saw", "Pulse", "Half Sine", "Soft Square", "Organ" };
inline const juce::StringArray kNoiseNames { "White", "Pink", "Brown" };
inline const juce::StringArray kEnvSrcNames { "None", "Env 1", "Env 2" };

inline juce::NormalisableRange<float> expRange(float lo, float hi)
{
    return { lo, hi, [](float a, float b, float n) { return a * std::pow(b / a, n); },
             [](float a, float b, float v) { return std::log(v / a) / std::log(b / a); }, [](float, float, float v) { return v; } };
}

inline juce::AudioProcessorValueTreeState::ParameterLayout makeLayout()
{
    using P = juce::ParameterID;
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> p;
    auto F = [&](const juce::String& id, const juce::String& nm, float lo, float hi, float def, bool exp = false)
    { p.push_back(std::make_unique<juce::AudioParameterFloat>(P{ id, 1 }, nm, exp ? expRange(lo, hi) : juce::NormalisableRange<float>(lo, hi), def)); };
    auto I = [&](const juce::String& id, const juce::String& nm, int lo, int hi, int def)
    { p.push_back(std::make_unique<juce::AudioParameterInt>(P{ id, 1 }, nm, lo, hi, def)); };
    auto B = [&](const juce::String& id, const juce::String& nm, bool def)
    { p.push_back(std::make_unique<juce::AudioParameterBool>(P{ id, 1 }, nm, def)); };
    auto C = [&](const juce::String& id, const juce::String& nm, const juce::StringArray& s, int def)
    { p.push_back(std::make_unique<juce::AudioParameterChoice>(P{ id, 1 }, nm, s, def)); };

    F("master", "Master (dB)", -60.f, 6.f, 3.f);
    I("poly", "Voices", 1, kMaxVoices, 16);
    F("vel", "Velocity", 0.f, 1.f, .6f);
    I("bendr", "Bend range", 0, 24, 2);
    juce::StringArray tabs; for (int i = 0; i < kNumTables; ++i) tabs.add(kTableNames[i]);
    for (const char* o : { "a", "b", "c" })
    {
        const juce::String k(o), n = "OSC " + k.toUpperCase() + " ";
        B(k + "_on", n + "on", k == "a");
        C(k + "_tab", n + "table", tabs, 0);
        F(k + "_pos", n + "wave position", 0.f, 1.f, 0.f);
        I(k + "_oct", n + "octave", -4, 4, 0);
        I(k + "_semi", n + "semi", -48, 48, 0);
        F(k + "_fine", n + "fine (cents)", -100.f, 100.f, 0.f);
        F(k + "_lvl", n + "level", 0.f, 1.f, k == "a" ? .75f : .6f);
        F(k + "_pan", n + "pan", -1.f, 1.f, 0.f);
        F(k + "_ph", n + "start phase", 0.f, 1.f, 0.f);
        F(k + "_rnd", n + "random phase", 0.f, 1.f, 1.f);
        I(k + "_uv", n + "unison voices", 1, 8, 1);
        F(k + "_ud", n + "unison detune", 0.f, 1.f, .25f);
        C(k + "_us", n + "unison style", kUnisonNames, 0);
        F(k + "_ub", n + "unison blend", 0.f, 1.f, .5f);
        F(k + "_usp", n + "unison spread", 0.f, 1.f, .7f);
        F(k + "_anl", n + "analog", 0.f, 1.f, .2f);
        C(k + "_rt", n + "route", kRouteNames, 1);
    }
    B("sub_on", "Sub on", false); C("sub_wave", "Sub wave", kSubNames, 0); I("sub_oct", "Sub octave", -4, 1, -1);
    F("sub_lvl", "Sub level", 0.f, 1.f, .5f); F("sub_pw", "Sub pulse width", .05f, .95f, .5f); F("sub_fine", "Sub fine (cents)", -100.f, 100.f, 0.f);
    F("sub_pan", "Sub pan", -1.f, 1.f, 0.f); C("sub_rt", "Sub route", kRouteNames, 0);
    B("nz_on", "Noise on", false); C("nz_type", "Noise type", kNoiseNames, 0); F("nz_lvl", "Noise level", 0.f, 1.f, .3f);
    F("nz_pan", "Noise pan", -1.f, 1.f, 0.f); C("nz_rt", "Noise route", kRouteNames, 0);
    for (const char* f : { "f1", "f2" })
    {
        const juce::String k(f), n = "Filter " + k.substring(1) + " ";
        C(k + "_type", n + "type", kFilterNames, k == "f1" ? 7 : 0);
        F(k + "_cut", n + "cutoff (Hz)", 20.f, 20000.f, k == "f1" ? 9000.f : 12000.f, true);
        F(k + "_res", n + "resonance", 0.f, 1.f, .2f);
        F(k + "_kt", n + "key track", -1.f, 1.f, .25f);
        F(k + "_env", n + "env amount", -1.f, 1.f, 0.f);
        C(k + "_es", n + "env source", kEnvSrcNames, 2);
    }
    C("frt", "Filter routing", juce::StringArray { "Serial", "Parallel" }, 0);
    for (const char* e : { "e1", "e2" })
    {
        const juce::String k(e), n = "Env " + k.substring(1) + " ";
        const bool one = k == "e1";
        F(k + "_a", n + "attack (ms)", .5f, 10000.f, 2.f, true);
        F(k + "_h", n + "hold (ms)", 0.f, 2000.f, 0.f);
        F(k + "_d", n + "decay (ms)", 1.f, 10000.f, one ? 400.f : 550.f, true);
        F(k + "_s", n + "sustain", 0.f, 1.f, one ? .7f : .35f);
        F(k + "_r", n + "release (ms)", 1.f, 15000.f, one ? 180.f : 200.f, true);
        F(k + "_c", n + "curve", -1.f, 1.f, -.4f);
        F(k + "_ca", n + "attack curve", -1.f, 1.f, 0.f);
    }
    // built-in FX (shared catfx code from cat-ui): shimmer delay then reverb
    C("rvType", "Reverb type", juce::StringArray { "Off", "Plate", "Hall", "Shimmer Plate", "Shimmer Hall" }, 0);
    F("rvDecay", "Reverb decay", 0.f, 1.f, .6f); F("rvDamp", "Reverb damping (Hz)", 500.f, 16000.f, 6000.f, true);
    F("rvMix", "Reverb mix", 0.f, 1.f, .25f); F("rvShift", "Reverb shimmer pitch", -12.f, 12.f, 12.f); F("rvShim", "Reverb shimmer amount", 0.f, 1.f, .5f);
    F("dlMix", "Delay mix (0 = off)", 0.f, 1.f, 0.f); F("dlTime", "Delay time (ms)", 20.f, 2000.f, 400.f, true);
    F("dlFb", "Delay feedback", 0.f, .95f, .5f); F("dlShift", "Delay shimmer pitch", -12.f, 12.f, 12.f); F("dlShim", "Delay shimmer amount", 0.f, 1.f, 1.f);
    return { p.begin(), p.end() };
}

// Factory presets: only values that differ from the defaults above.
struct FactoryPreset { const char* name; std::vector<std::pair<const char*, float>> v; };
inline const std::vector<FactoryPreset>& factoryPresets()
{
    static const std::vector<FactoryPreset> list = {
        { "Init", {} },
        { "Simple Wonder", { { "a_pos", .26f }, { "a_uv", 3.f } } },
    };
    return list;
}
}
