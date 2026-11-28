# Mockup sources

The web mockup (docs/mockup/index.html) is one HTML file built from these parts. The plugin is ported from them, and the tools in tools/ read them.

- dsp/: the sound engine in JavaScript. `sh build_dsp.sh` joins the parts into ww-dsp.js (dsp1, dsp_filt, dsp2, dsp3a, dsp3b, dsp3c, dsp3e, dsp3d, in this order).
- ui/: the page. `python3 build.py` puts fonts, styles, engine and page code into whiskerwave.html.

The two build scripts use fixed folder names from the machine they were written on (/home/claude/ww-src and /home/claude/ww-ui): change the paths at the top when you build somewhere else.

After a change to the engine: run tools/export_params.js, tools/export_fx.js and tools/export_presets.js, then the parity tests (tests/parity_battery.sh, tests/fx_battery.sh). After a change to the page layout: tools/extract_layout.py and tools/gen_layout.py.
