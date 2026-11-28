# Builds docs/WhiskerWave-manual.pdf: install, quick start, a numbered tour of every page of the real window, the FX reference and the technical notes.
# Pictures come from the compiled plugin (docs/tour/*.png, taken by CI). Control names, ranges and tips come from the engine data (data/params.json, data/fx.json).
# Usage: python3 tools/make_plugin_manual.py <version>
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak, KeepTogether
ver = sys.argv[1] if len(sys.argv) > 1 else 'dev'
L = json.load(open('data/layout_raw.json')); PR = {p['key']: p for p in json.load(open('data/params.json'))}; FX = json.load(open('data/fx.json'))
INK = colors.HexColor('#1b1c22'); DIM = colors.HexColor('#5b6070'); PINK = colors.HexColor('#FF1383'); TEAL = colors.HexColor('#009572')
H1 = ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=INK, spaceAfter=8)
H2 = ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=INK, spaceBefore=8, spaceAfter=5)
H3 = ParagraphStyle('h3', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=TEAL, spaceBefore=6, spaceAfter=3)
P = ParagraphStyle('p', fontName='Helvetica', fontSize=9.5, leading=13, textColor=INK, spaceAfter=4)
S = ParagraphStyle('s', fontName='Helvetica', fontSize=7.6, leading=9.6, textColor=INK)
SB = ParagraphStyle('sb', parent=S, fontName='Helvetica-Bold')
def esc(s): return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def rng(p):
    if p.get('list'): return ', '.join(map(str, p['list'][:9])) + (' ...' if len(p['list']) > 9 else '')
    f = lambda v: ('%g' % v)
    return '%s to %s%s' % (f(p['min']), f(p['max']), p.get('u', ''))
def dflt(p):
    if p.get('list'): i = int(round(p['d'])); return str(p['list'][i]) if 0 <= i < len(p['list']) else str(p['d'])
    return ('%g' % p['d']) + p.get('u', '')
def table(rows, widths):
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e9e4f3')), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('GRID', (0, 0), (-1, -1), .3, colors.HexColor('#c9c9d2')), ('LEFTPADDING', (0, 0), (-1, -1), 3), ('RIGHTPADDING', (0, 0), (-1, -1), 3), ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    return t
story = []
W = landscape(A4)[0] - 24 * mm
story += [Paragraph('WhiskerWave', H1), Paragraph('Wavetable synth by Studio 87. Manual for version %s (test build).' % esc(ver), P), Spacer(1, 4)]
if os.path.exists('docs/tour/sound.png'): story.append(RLImage('docs/tour/sound.png', width=W * .78, height=W * .78 * 950 / 1351))
story += [Paragraph('What this build is', H2),
  Paragraph('WhiskerWave is free and open source (AGPL-3.0-or-later). It collects nothing: no telemetry, no accounts, no network use. Everything is inside the installer and works offline.', P),
  Paragraph('<b>Honest status.</b> The sound engine of the plugin is complete and matches the web mockup in automated comparisons: 6 wavetable oscillators with unison, warp, FM and ring modulation, sub and noise, 47 filter types, 16 modulators, 4 LFOs, 64 modulation routes, 8 macros, arpeggiator with step sequencer, 41 effects in freely built chains with band splitting, mixer with two effect buses, lookahead limiter and 72 factory presets. It has <b>not been judged by ear and not been tested in a real DAW or on a real Mac or Windows PC by a person yet</b>. It passes the automatic plugin checks (pluginval) on Linux. Treat it as a test build.', P),
  Paragraph('<b>Not in the plugin window yet</b> (they exist in the web mockup): the Wave Lab page (own wavetables), loading samples for the Sample and Granular oscillator modes, the grid view of the modulation matrix (the plugin has a list), the drawing editor for Draw and LFO modulators (presets that use them play correctly), the filter curve displays, undo and history, favourites, themes, mixer mute and solo, and drag and drop of modulators (right click a knob instead).', P),
  PageBreak(), Paragraph('Install', H1),
  Paragraph('<b>Windows:</b> run the .exe installer. The VST3 goes to C:\\Program Files\\Common Files\\VST3, the standalone app and the uninstaller to Program Files\\Studio 87\\WhiskerWave. Windows may show a SmartScreen notice because the installer is not code signed: choose More info, then Run anyway.', P),
  Paragraph('<b>macOS:</b> open the .pkg. It installs the VST3 for all users, the standalone app and an Uninstall WhiskerWave app. The package is not notarized: right click it and choose Open the first time.', P),
  Paragraph('<b>Linux:</b> for a Flatpak DAW, install the Flatpak extension that matches your DAW runtime. For a normal DAW, copy the WhiskerWave.vst3 folder from the tarball to ~/.vst3. To remove it, delete that folder or uninstall the Flatpak extension.', P),
  Paragraph('<b>Your presets</b> are saved as .wwpreset files in the Studio 87/WhiskerWave/presets folder of your user data folder (Windows: %APPDATA%, macOS: ~/Library/Application Support, Linux: ~/.config or the XDG data folder). The uninstallers keep them unless you choose to delete them. Presets use the same format as the web mockup.', P),
  Paragraph('Quick start', H1),
  Paragraph('1. Load WhiskerWave on an instrument track. 2. Click the preset name at the top, or the arrows beside it, to pick a preset. The Presets page shows all of them by type. 3. Play. The keyboard at the bottom also plays with the mouse. 4. Sound page: pick a wavetable per oscillator and move Wave Pos. 5. Right click any knob and choose Modulate with to route an envelope, LFO, macro, velocity and so on to it. Routes are listed on the Mod + Matrix page. 6. FX page: pick a track at the top, then + Add effect. Every effect can be added as often as you like, in any order. 7. Save keeps your sound as your own preset.', P),
  Paragraph('Drag a knob up or down to turn it. Hold Shift for fine steps. Double click resets it. The mouse wheel also works. Hover over any control for its info bubble.', P), PageBreak()]
PAGES = [('sound', 'Sound'), ('filter', 'Filter'), ('mod', 'Mod + Matrix'), ('fx', 'FX'), ('mixer', 'Mixer'), ('arp', 'Arp'), ('presets', 'Presets')]
NOTE = {'sound': 'Three oscillator panels. Each holds two oscillators (A and D, B and E, C and F): the small switch beside OSC chooses which one you see. Sub, Noise, the two filters and the modulators are below. The display shows every frame of the wavetable, with the playing frame in front.',
        'filter': 'Both filters with all their controls. The curve displays of the mockup are not drawn in the plugin yet.', 'mod': 'The four global LFOs at the top. Below them the modulation matrix as a list: source, destination, amount (drag the bar), one way or two way, bypass and remove.',
        'fx': 'Pick the track at the top (Main is the master, FX 1 and FX 2 are the send buses). The list on the left is the chain, top to bottom. The Band Split effect holds its own chains per band: click a band to go inside.',
        'mixer': 'One strip per track with sends to FX 1 and FX 2, pan, fader and meter. The meters show dB on the same scale as the faders: blue is low, purple is hot, pink from -1 dB up is close to clipping.',
        'arp': 'Arpeggiator and its 16 step grid: on or off, velocity, transpose and ratchet per step.', 'presets': 'All 72 factory presets by type, and your own under My presets.'}
os.makedirs('/tmp/wwtour', exist_ok=True)
try: fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
except Exception: fnt = ImageFont.load_default()
for pg, title in PAGES:
    src = 'docs/tour/%s.png' % pg
    if not os.path.exists(src): continue
    im = Image.open(src).convert('RGB'); dr = ImageDraw.Draw(im); rows = [[Paragraph('#', SB), Paragraph('Control', SB), Paragraph('Range', SB), Paragraph('Default', SB), Paragraph('What it does', SB)]]
    items = []
    if pg in L and pg != 'fx':
        for it in L[pg]['items']:
            if it['t'] not in ('knob', 'sel', 'seg', 'btn') or not it.get('k') or it['k'] not in PR: continue
            if pg == 'mod' and it.get('pg') and 265 <= it['r'][1] < 745: continue
            if pg != 'sound' and not it.get('pg'): continue
            if pg == 'sound' and it['k'][:2] in ('b.', 'c.'): continue
            items.append(it)
    items.sort(key=lambda it: (round(it['r'][1] / 46), it['r'][0])); seen = set(); n = 0
    for it in items:
        if it['k'] in seen: continue
        seen.add(it['k']); n += 1; x = it['r'][0] + 36; y = it['r'][1]; dr.ellipse([x - 7, y - 7, x + 9, y + 9], fill=(255, 19, 131)); tx = str(n); tw = dr.textlength(tx, font=fnt); dr.text((x + 1 - tw / 2, y - 6), tx, fill=(255, 255, 255), font=fnt)
        p = PR[it['k']]; rows.append([Paragraph(str(n), S), Paragraph(esc(p['l']) + ' <font color="#5b6070">(' + esc(it['k']) + ')</font>', S), Paragraph(esc(rng(p)), S), Paragraph(esc(dflt(p)), S), Paragraph(esc(p['tip']), S)])
    out = '/tmp/wwtour/%s.jpg' % pg; im.save(out, quality=88)
    story += [Paragraph(title + ' page', H1), Paragraph(NOTE[pg], P), RLImage(out, width=W * .74, height=W * .74 * im.height / im.width), PageBreak()]
    if len(rows) > 1: story += [Paragraph(title + ': controls', H2), table(rows, [8 * mm, 46 * mm, 44 * mm, 22 * mm, W - 120 * mm]), PageBreak()]
story += [Paragraph('Effects', H1), Paragraph('41 effects. Each can be used on any track, on the send buses, on the master or inside a band of a Band Split, as many times as you like. Every effect knob can be a modulation destination. Vocoder, Talk Box and Autotune need no microphone: they work on the sound of the synth itself.', P)]
cats = []
for f in FX:
    if f['cat'] not in cats: cats.append(f['cat'])
for c in cats:
    story.append(Paragraph(esc(c), H2))
    for f in [x for x in FX if x['cat'] == c]:
        rows = [[Paragraph('Control', SB), Paragraph('Range', SB), Paragraph('Default', SB), Paragraph('What it does', SB)]]
        for p in f['ps']: rows.append([Paragraph(esc(p['l']), S), Paragraph(esc(rng(p)), S), Paragraph(esc(dflt(p)), S), Paragraph(esc(p['tip']), S)])
        story.append(KeepTogether([Paragraph(esc(f['name']), H3), Paragraph(esc(f['tip']), P), table(rows, [38 * mm, 52 * mm, 24 * mm, W - 114 * mm]), Spacer(1, 4)]))
story += [PageBreak(), Paragraph('Under the hood', H1)]
for t in ['Engine: up to 32 voices, each with 6 wavetable oscillators (41 factory tables, 32 frames, 11 band limited levels), a sub oscillator, noise, 2 filters with 47 types and 16 modulators. Control values are computed every 32 samples and ramped in between.',
          'Smoothing: knob moves glide over about 15 ms. Wheel, pitch bend and aftertouch are smoothed over 8 ms. A stolen voice fades out over 6 ms.',
          'Oversampling: warp, FM and feedback run at 4 times the sample rate. Distortion, Fat Drive, Wavefolder, Ring Mod, Vowel, Talk Box, Exciter, Maximizer, Tape and Fat Cat run their curve at 4 times the sample rate with steep filters. The delay saturation and the Bass Weight run at 2 times.',
          'Latency: the master limiter looks 5 ms ahead. The plugin reports this delay to the host, so tracks stay lined up. With the limiter off the plugin reports 0. Effects with their own look-ahead or delay inside a chain (Maximizer 5 ms, Tape 8 ms, the pitch based effects) delay only their own path and line their dry signal up for the Mix knob.',
          'Autotune and Vocoder read the pitch of the newest note from the synth itself, including glide and pitch bend. There is no pitch detection and no added delay. On chords they follow the newest note.',
          'Testing: the C++ engine is compared against the engine of the web mockup with the same notes and settings: about 75 synth scenarios and about 150 effect scenarios must give the same peak and level to five decimals (effects that use random values are compared by level). Every effect is also run three times in a row, inside nested band splits and while chains are swapped, with memory and undefined behaviour checkers on. These are measurements. Nothing has been judged by ear yet.']:
    story.append(Paragraph(esc(t), P))
doc = SimpleDocTemplate('docs/WhiskerWave-manual.pdf', pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm, topMargin=11 * mm, bottomMargin=11 * mm, title='WhiskerWave manual', author='Studio 87')
doc.build(story); print('ok', os.path.getsize('docs/WhiskerWave-manual.pdf'))
