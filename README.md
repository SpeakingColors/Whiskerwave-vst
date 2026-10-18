# Whiskerwave 🐈🌊

Free, open source wavetable synth for Linux (VST3). Wavetable oscillators with morphing, layered voices, a flexible modulation matrix, built-in effects, and a tool to sample your own hardware into wavetables. Ships with CC0 waveforms and waves made by code. Tuned for dance, house, UK hardcore and hardstyle. AGPL-3.0.

## Status
Planning. A first wave generator script and 12 generated waves are in the repo. Free and open source. Donations welcome (link coming).

## What is in here today
- `tools/gen_waves.py`: makes single-cycle waveforms from math (sine, triangle, saw, square, pulses, organ, vowels and more). Run `python3 tools/gen_waves.py waves`.
- `waves/`: the generated waves (2048 samples, mono, 16-bit WAV).

## Planned
- Wavetable synth plugin on cat-ui
- Wave and shape generator with a MIDI test-drive: audition a new wave instantly against example MIDI patterns (hardstyle leads, happy hardcore, basses, funk) and keep what sounds good
- Hardware capture tool: plays notes through your own synths over MIDI, records them, cuts them into wavetables and samples
- Import of CC0 waveform packs such as AKWF

## Docs
- [Roadmap](ROADMAP.md)
- [Design notes](docs/DESIGN.md)
- [Sources and licensing](docs/SOURCES.md)

## License
AGPL-3.0-or-later, see [LICENSE](LICENSE).

Not affiliated with or endorsed by any other synth or sample maker. Names of other products are used only to describe features. No third-party samples or presets are included.
