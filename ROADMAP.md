# Roadmap: Whiskerwave

## Done
- [x] Python wave generators (38 waves)
- [x] Original MIDI test patterns and a quick audition renderer
- [x] Synth scaffold in C++ (src/Synth.h, WaveBank.h): band-limited wavetable bank, 8 voices, unison, filter, envelopes, LFO morph, editor, CI
- [x] Built-in shimmer delay and reverb (plate, hall, shimmer plate, shimmer hall) from the shared catfx code

## Done (preview)
- [x] Interactive design mockup with full JS sound engine (docs/mockup/index.html), preview release with PDF manual

## Done (VST3, v0.2.0 test build)
- [x] Full engine ported to C++ from the mockup engine and checked against it by parity tests: 729 parameters, 6 oscillators, 47 filters, 16 modulators, 4 LFOs, 64 routes, macros, voice modes, arp, mixer, limiter
- [x] 41 effects in node based chains with band splitting, each usable many times (31 from the mockup plus Vocoder, Talk Box, Autotune, Dynamic EQ, Noise Gate, Tape, Granular, Freeze, Envelope Filter, Fat Cat), also added to the mockup
- [x] 72 factory presets and user presets in the mockup's own format
- [x] Real window drawn natively from the mockup layout (tools/extract_layout.py, tools/gen_layout.py): Sound, Filter, Mod + Matrix (list), FX, Mixer, Arp, Presets
- [x] Installers for Linux, macOS and Windows with PDF tour manual and uninstaller (not tried on real machines yet)

## Next
- [ ] Listening pass: nothing has been judged by ear yet. Test in real DAWs on Linux, Windows and macOS
- [ ] Wave Lab page and user wavetables in the plugin
- [ ] Sample loading for the Sample and Granular oscillator modes
- [ ] Grid view of the modulation matrix, drag and drop of modulators
- [ ] Drawing editor for Draw and LFO modulators
- [ ] Filter curve displays, effect displays
- [ ] Undo and history, favourites, themes, mixer mute and solo, settings page
- [ ] Hardware capture tool: sends MIDI notes to a synth, records audio, trims, loops, pitch-detects and exports wavetables and multisamples
- [ ] Import CC0 packs (AKWF) with credit in the browser

## Rules for every cat plugin
- Free, open source, AGPL-3.0-or-later
- Light on CPU, RAM and GPU; stop drawing when the window is not in front
- Settings page with MIDI filters on by default, selectable preset/backup folders, UI size reset to 100%
