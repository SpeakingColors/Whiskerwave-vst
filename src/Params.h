// APVTS layout generated from the mockup parameter table (729 parameters) plus six table choices.
#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include "ParamTable.h"
#include "TableNames.h"
namespace whisker {
inline juce::String groupOf(const juce::String& key)
{
    const auto head = key.upToFirstOccurrenceOf(".", false, false);
    if (key.startsWith("bus.")) return "Bus " + key.fromFirstOccurrenceOf("bus.", false, false).upToFirstOccurrenceOf(".", false, false).toUpperCase();
    if (key.startsWith("arp.")) return "Arp";
    if (head.length() == 1 && juce::String("abcdef").containsChar(head[0])) return "Osc " + head.toUpperCase();
    if (head == "sub" || head == "nz") return head == "sub" ? "Sub Env" : "Noise Env";
    if (head == "s") return "Sub/Noise";
    if (head[0] == 'e' && head.length() > 1) return "Env " + head.substring(1);
    if (head[0] == 'l' && head.length() > 1) return "LFO " + head.substring(1);
    if (head[0] == 'f' && head.length() > 1) return "Filter " + head.substring(1);
    return "Global";
}
inline const char* const* listItems(const char* name, int& n)
{
    for (int i = 0; i < kNumLists; ++i) if (std::strcmp(kLists[i].name, name) == 0) { n = kLists[i].n; return kLists[i].items; }
    n = 0; return nullptr;
}
inline juce::AudioProcessorValueTreeState::ParameterLayout makeLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout L;
    for (int i = 0; i < kNumParams; ++i)
    {
        const ParamSpec& p = kParams[i]; const juce::ParameterID pid(p.id, 1);
        const juce::String nm = groupOf(p.key) + " " + p.label;
        if (p.kind == PK::List)
        {
            int n = 0; auto* it = listItems(p.list, n); juce::StringArray sa;
            const int count = (int) p.mx + 1;
            for (int k = 0; k < count; ++k) sa.add(it && k < n ? juce::String(it[k]) : juce::String(k));
            L.add(std::make_unique<juce::AudioParameterChoice>(pid, nm, sa, (int) p.def));
        }
        else if (p.kind == PK::Int)
        {
            if (p.mn == 0.f && p.mx == 1.f) L.add(std::make_unique<juce::AudioParameterBool>(pid, nm, p.def > .5f));
            else L.add(std::make_unique<juce::AudioParameterInt>(pid, nm, (int) p.mn, (int) p.mx, (int) p.def));
        }
        else if (p.kind == PK::Exp)
        {
            const double mn = p.mn, mx = p.mx;
            juce::NormalisableRange<float> r((float) mn, (float) mx, [mn, mx](float, float, float n) { return (float) (mn * std::pow(mx / mn, (double) n)); },
                                             [mn, mx](float, float, float v) { return (float) (std::log(std::max((double) v, mn) / mn) / std::log(mx / mn)); });
            L.add(std::make_unique<juce::AudioParameterFloat>(pid, nm, r, p.def, juce::AudioParameterFloatAttributes().withLabel(p.unit)));
        }
        else L.add(std::make_unique<juce::AudioParameterFloat>(pid, nm, juce::NormalisableRange<float>(p.mn, p.mx), p.def, juce::AudioParameterFloatAttributes().withLabel(p.unit)));
    }
    for (int o = 0; o < 6; ++o)
    {
        juce::StringArray names; for (int t = 0; t < kNumTables; ++t) names.add(kTableNames[t]);
        L.add(std::make_unique<juce::AudioParameterChoice>(juce::ParameterID(juce::String("abcdef").substring(o, o + 1) + "_tab", 1), "Osc " + juce::String("ABCDEF").substring(o, o + 1) + " Table", names, 0));
    }
    return L;
}
} // namespace whisker
