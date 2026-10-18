# Design notes

## Sound sources
1. Waves made by code (this repo, `tools/gen_waves.py`).
2. CC0 packs, for example AKWF (see SOURCES.md).
3. The user's own hardware, captured with the capture tool (MODX M6, Cobalt8M, UltraNova, Peak, minilogue xd, drumlogue, Behringer synths and others the user owns).

## Wave and shape generator
- Build a wave from harmonic sliders, formant shapes, FM, sync, waveshaping or by drawing.
- Instantly audition it with a built-in MIDI pattern, then keep or discard it.
- Kept waves go into the wavetable browser as a table (morph between waves).

## Capture tool (plan)
1. Pick a MIDI port and a synth patch.
2. Play notes at set velocities and lengths over MIDI while recording the audio.
3. Trim silence, find the pitch, make a clean loop or single cycle.
4. Export WAVs and a wavetable file with notes on what was captured.

## Test-drive MIDI patterns
Original patterns written for this project (no copied tracks): hardstyle lead, happy hardcore lead, rolling bass, funk bass, plucks, chords.
