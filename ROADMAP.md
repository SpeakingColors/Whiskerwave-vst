# Roadmap: Whiskerwave

## Done
- [x] Python wave generators (38 waves)
- [x] Original MIDI test patterns and a quick audition renderer
- [x] Synth scaffold in C++ (src/Synth.h, WaveBank.h): band-limited wavetable bank, 8 voices, unison, filter, envelopes, LFO morph, editor, CI
- [x] Built-in shimmer delay and reverb (plate, hall, shimmer plate, shimmer hall) from the shared catfx code

## Done (preview)
- [x] Interactive design mockup with full JS sound engine (docs/mockup/index.html), preview release with PDF manual

## Next
- [ ] Port the mockup engine and window to C++/JUCE (VST3). Done in v0.1.0: engine core (41 wavetables, A/B/C unison, sub, noise, LP/HP/BP/notch/ladder filters, 2 envelopes, reverb, delay) with a parity test against the JS engine. Still to port: warp, FM/AM, feedback, sample and granular engines, 16 modulators and matrix, FX chains, arp, LFOs, macros, the full window and preset browser.
- [ ] Installers for Linux, macOS and Windows with manual and uninstaller
- [ ] Wave generator in C++ (same shapes as `tools/gen_waves.py`, plus FM, formant, spectral drawing, harmonic sliders)
- [ ] MIDI test-drive: a set of original MIDI patterns (hardstyle lead, happy hardcore, bass, funk) to audition any generated wave quickly, with a keep/skip list
- [ ] Hardware capture tool: sends MIDI notes to a synth, records audio, trims, loops, pitch-detects and exports wavetables and multisamples
- [ ] Wavetable oscillator with morphing and unison
- [ ] Mod matrix, filters, built-in FX (use Clawpressor-style MB comp)
- [ ] Import CC0 packs (AKWF) with credit in the browser

## Rules for every cat plugin
- Free, open source, AGPL-3.0-or-later
- Light on CPU, RAM and GPU; stop drawing when the window is not in front
- Settings page with MIDI filters on by default, selectable preset/backup folders, UI size reset to 100%
