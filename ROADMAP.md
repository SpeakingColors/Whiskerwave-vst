# Roadmap: Whiskerwave

## Done
- [x] Python wave generators (38 waves)
- [x] Original MIDI test patterns and a quick audition renderer

## Next
- [ ] Wave generator in C++ (same shapes as `tools/gen_waves.py`, plus FM, formant, spectral drawing, harmonic sliders)
- [ ] MIDI test-drive: a set of original MIDI patterns (hardstyle lead, happy hardcore, bass, funk) to audition any generated wave quickly, with a keep/skip list
- [ ] Hardware capture tool: sends MIDI notes to a synth, records audio, trims, loops, pitch-detects and exports wavetables and multisamples
- [ ] Wavetable oscillator with morphing and unison
- [ ] Mod matrix, filters, built-in FX (use Clawpressor-style MB comp)
- [ ] Mockup page on cat-ui look, then JUCE VST3 shell, RenderGate for drawing
- [ ] Import CC0 packs (AKWF) with credit in the browser

## Rules for every cat plugin
- Free, open source, AGPL-3.0-or-later
- Light on CPU, RAM and GPU; stop drawing when the window is not in front
- Settings page with MIDI filters on by default, selectable preset/backup folders, UI size reset to 100%
