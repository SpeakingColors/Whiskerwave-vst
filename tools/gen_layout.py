# Turns data/layout_raw.json (read from the mockup by tools/extract_layout.py) into src/Layout.h for the native window.
import json, re
L = json.load(open('data/layout_raw.json'))
PAGES = ['sound', 'filter', 'mod', 'fx', 'mixer', 'arp', 'wave', 'presets']
TABLES = re.findall(r'"([^"]+)"', open('src/TableNames.h').read().split('kTableNames[kNumTables] = {')[1].split('};')[0])
BUS = ['t0', 't1', 't2', 't3', 'x1', 'x2', 'fx', 'mst']
SKIP_BTN_ID = {'audiobtn', 'favbtn', 'undobtn', 'redobtn', 'demobtn'}
SKIP_BTN_TXT = {'Theme', 'Guide', 'Settings', 'History', 'Mute', 'Solo', 'Edit in bank', 'Copy 1 to 2', 'Copy 2 to 1', 'Swap', 'Reset both', 'Add', 'Clear all'}
boxes, texts, ctls, cells, keys = [], [], [], [], []
def esc(s): return json.dumps(s, ensure_ascii=False)
def col(c): return '0x' + (c if c else '00000000')
def inside(r, p): return p[0] <= r[0] + r[2] / 2 <= p[0] + p[2] and p[1] <= r[1] + r[3] / 2 <= p[1] + p[3]
def ctl(page, typ, key, r, c=None, label='', tip='', grp=0, a=0, b=0, lfs=9, vfs=9):
    c = c or [0, 0, 0, 0]
    ctls.append('{%d, \'%s\', %s, %.1ff, %.1ff, %.1ff, %.1ff, %.1ff, %.1ff, %.1ff, %.1ff, %s, %s, %d, %d, %d, %.1ff, %.1ff}' % (page, typ, esc(key), r[0], r[1], r[2], r[3], c[0], c[1], c[2], c[3], esc(label), esc(tip), grp, a, b, lfs, vfs))

def emit(page, items, glob):
    pidx = -1 if glob else PAGES.index(page)
    its = [i for i in items if (i.get('pg', 0) == 0) == glob]
    if not glob and page == 'fx': return
    if not glob and page == 'mod': its = [i for i in its if not (265 <= i['r'][1] < 745)]
    pns = sorted([i['r'] for i in its if i['t'] == 'box' and i['cls'].split(' ')[0] == 'pn'], key=lambda r: (round(r[1] / 50), r[0]))
    oscp = pns[:3] if page == 'sound' and not glob else []
    modp = next((i['r'] for i in its if i['t'] == 'box' and i['cls'].startswith('pn') and any(t['t'] == 'text' and t['txt'] == 'MODULATORS' and inside(t['r'], i['r']) for t in its)), None) if page == 'sound' and not glob else None
    def grp(r):
        for k, p in enumerate(oscp):
            if inside(r, p): return k + 1
        if modp and inside(r, modp): return 4
        return 0
    strips = sorted([i['r'] for i in its if i['t'] == 'box' and i['cls'].startswith('strip')], key=lambda r: r[0])
    def bus(r):
        for k, p in enumerate(strips):
            if inside(r, p): return k
        return -1
    tabboxes = sorted([i for i in its if glob and i['t'] == 'box' and i.get('eid') == 'tabs' and i.get('id') != 'tabs'], key=lambda i: i['r'][0])
    for k, tb in enumerate(tabboxes): ctl(-1, 'b', '', tb['r'], a=k, label=PAGES[k])
    ncanvas = 0; nq = {}
    wkeys = sorted([i['r'] for i in its if i['t'] == 'box' and i['cls'] == 'wk'], key=lambda r: r[0]); bkeys = sorted([i['r'] for i in its if i['t'] == 'box' and i['cls'] == 'bk'], key=lambda r: r[0])
    if wkeys:
        note = 36; wi = 0
        for w in wkeys:
            keys.append((w, 0, note)); nx = wkeys[wi + 1] if wi + 1 < len(wkeys) else None
            has_black = any(abs((b[0] + b[2] / 2) - (w[0] + w[2])) < w[2] * .4 for b in bkeys)
            if has_black:
                b = next(b for b in bkeys if abs((b[0] + b[2] / 2) - (w[0] + w[2])) < w[2] * .4); keys.append((b, 1, note + 1)); note += 2
            else: note += 1
            wi += 1
    for i in its:
        t = i['t']; r = i['r']; g = grp(r)
        if t == 'box':
            c = i['cls']
            if i.get('eid') == 'tabs' and i.get('id') != 'tabs': continue
            if c in ('wk', 'bk', 'fh', 'fill') or c.startswith('mgc'): continue
            if c == 'wheel': ctl(pidx, 'w', '', r, a=sum(1 for x in ctls if "'w'" in x)); continue
            if c == 'ft': ctl(pidx, 'f', 'bus.%s.vol' % BUS[bus(r)], [r[0] - 14, r[1], r[2] + 28, r[3]], a=bus(r)); continue
            if c.startswith('scell'):
                row = ['on', 'vel', 'semi', 'rat'].index(c.split(' ')[1]); nq[row] = nq.get(row, 0) + 1; ctl(pidx, 'q', '', r, a=row, b=nq[row] - 1); continue
            if i.get('id') == 'pname': ctl(pidx, 'n', '', r); continue
            boxes.append('{%d, %.1ff, %.1ff, %.1ff, %.1ff, %s, %s, %.1ff, %.1ff, %.2ff, %d}' % (pidx, r[0], r[1], r[2], r[3], col(i['bg']), col(i['bc']), i['bw'], min(i['rad'], min(r[2], r[3]) / 2), i['op'], g))
        elif t == 'text':
            if i.get('eid') in ('tabs', 'zoomread', 'pname') or i['cls'] in ('wk', 'bk'): continue
            dyn = 0; s = i['txt']
            if 'limgr' in i['cls']: dyn = 2
            elif i.get('eid') == 'nvoices' and i['mono']: dyn = 3
            elif i.get('eid', '').startswith('vol_'): dyn = 10 + BUS.index(i['eid'][4:])
            if s.startswith('Studio 87') and 'mockup' in s: s = 'Studio 87 · WhiskerWave'
            if re.fullmatch(r'C\d', s) and i['fs'] <= 9 and glob: continue
            texts.append('{%d, %.1ff, %.1ff, %.1ff, %.1ff, %s, %.1ff, %d, %s, %d, %d, %.1ff, %.2ff, %d, %d}' % (pidx, r[0], r[1], r[2], r[3], esc(s), i['fs'], i['fw'], col(i['col']), i['mono'], i['up'], i['ls'], i['op'], g, dyn))
        elif t == 'knob':
            ctl(pidx, 'k', i['k'], r, i['c'], i['l'], i['tip'], g, int(round((i['lr'][1] - r[1]) * 10)), int(round((i['vr'][1] - r[1]) * 10)), i['lfs'], i['vfs'])
        elif t == 'sel':
            if i['k']: ctl(pidx, 's', i['k'], r, tip=i['tip'], grp=g)
            elif i['txt'] in TABLES and page == 'sound': ctl(pidx, 'T', '', r, tip='Wavetable of this oscillator.', grp=g)
            elif page == 'mixer' and bus(r) >= 0: ctl(pidx, 's', 'bus.%s.dest' % BUS[bus(r)], r, tip='Where this track goes: Master, an FX bus or a later track.')
        elif t == 'seg':
            tx = [c['txt'] for c in i['cells']]; a = len(cells)
            for c in i['cells']: cells.append('{%.1ff, %.1ff, %.1ff, %.1ff, %s}' % (c['r'][0], c['r'][1], c['r'][2], c['r'][3], esc(c['txt'])))
            typ = 'g' if i['k'] else 'G' if tx in (['A', 'D'], ['B', 'E'], ['C', 'F']) else 'N' if tx[:2] == ['AMP', 'FLT'] else 'L' if tx == ['4', '8', '12', '16'] else ''
            if typ: ctl(pidx, typ, i['k'], r, tip=i['tip'], grp=g, a=a, b=len(cells))
            else: del cells[a:]
        elif t == 'btn':
            tx = i['txt']
            if i.get('id') in SKIP_BTN_ID or tx in SKIP_BTN_TXT: continue
            if i['k']: ctl(pidx, 't', i['k'], r, label=tx, tip=i['tip'], grp=g); continue
            act = 0
            if tx == '' and r[2] < 14 and g: ctl(pidx, 'l', 'abc'[g - 1] + '.on', r, tip='Switches this oscillator on or off.', grp=g); continue
            if tx in ('<', '>'):
                if glob: act = 1 if tx == '<' else 2
                elif g and r[1] < 300: act = 6 if tx == '<' else 7
                elif g: act = 8 if tx == '<' else 9
            elif tx == 'Save': act = 3
            elif tx == 'About': act = 4
            elif tx == 'Panic': act = 5
            elif tx == 'Random': act = 10
            elif tx == 'Reset': act = 11
            elif tx == 'ADSR' and g == 4: ctl(pidx, 's', 'e1.mode', r, tip='How this modulator works: ADSR envelope, drawn shape or LFO.', grp=4); continue
            if act: ctl(pidx, 'a', '', r, label=tx, tip=i['tip'], grp=g, a=act)
        elif t == 'canvas':
            kind = 0; idx = 0
            if glob: kind = [1, 2, 3][min(ncanvas, 2)]
            elif page == 'sound': kind = 4 if g in (1, 2, 3) else 5
            elif page == 'filter': kind = 6; idx = ncanvas
            elif page == 'mixer': kind = 7; idx = bus(r)
            ncanvas += 1
            ctl(pidx, 'c', '', r, grp=g, a=kind, b=idx)

emit('sound', L['sound']['items'], True)
for p in PAGES:
    if p in L: emit(p, L[p]['items'], False)
W = L['sound']['w']; H = L['sound']['h']
h = '// Generated by tools/gen_layout.py from the mockup itself (tools/extract_layout.py). Do not edit by hand.\n#pragma once\n#include <cstdint>\nnamespace wwl {\n'
h += 'constexpr float kW = %.1ff, kH = %.1ff;\n' % (W, H)
h += 'struct Box { int page; float x, y, w, h; uint32_t bg, bc; float bw, rad, op; int grp; };\n'
h += 'struct Text { int page; float x, y, w, h; const char* s; float fs; int fw; uint32_t col; int mono, up; float ls, op; int grp, dyn; };\n'
h += 'struct Ctl { int page; char type; const char* key; float x, y, w, h, cx, cy, cw, ch; const char* label; const char* tip; int grp, a, b; float lfs, vfs; };\n'
h += 'struct Cell { float x, y, w, h; const char* s; };\nstruct Key { float x, y, w, h; int black, note; };\n'
h += 'inline const Box kBoxes[] = {\n  ' + ',\n  '.join(boxes) + '\n};\n'
h += 'inline const Text kTexts[] = {\n  ' + ',\n  '.join(texts) + '\n};\n'
h += 'inline const Ctl kCtls[] = {\n  ' + ',\n  '.join(ctls) + '\n};\n'
h += 'inline const Cell kCells[] = {\n  ' + ',\n  '.join(cells) + '\n};\n'
h += 'inline const Key kKeys[] = {\n  ' + ',\n  '.join('{%.1ff, %.1ff, %.1ff, %.1ff, %d, %d}' % (k[0][0], k[0][1], k[0][2], k[0][3], k[1], k[2]) for k in keys) + '\n};\n'
h += 'constexpr int kNumBoxes = %d, kNumTexts = %d, kNumCtls = %d, kNumCells = %d, kNumKeys = %d;\n}\n' % (len(boxes), len(texts), len(ctls), len(cells), len(keys))
open('src/Layout.h', 'w').write(h)
import collections
print(len(boxes), 'boxes', len(texts), 'texts', len(ctls), 'ctls', len(cells), 'cells', len(keys), 'keys')
print(collections.Counter(re.search(r"'(.)'", c).group(1) for c in ctls))
