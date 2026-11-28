// Exports the factory presets of the mockup (ui4.js) as data/presets.json, fully resolved the way loadFactory()/loadState() do it.
// Usage: node tools/export_presets.js /path/to/ww-dsp.js /path/to/ui4.js
const fs = require('fs');
const G = {}; new Function('G', fs.readFileSync(process.argv[2], 'utf8') + ';WWMAKE(G);')(G);
const ui = fs.readFileSync(process.argv[3], 'utf8');
const a = ui.indexOf('const FT_='), b = ui.indexOf('const TYPES=');
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const FACT = new Function('D', 'clamp', ui.slice(a, b) + ';return FACT;')(G, clamp);
const PR = G.PR;
const mkNode = spec => { const n = G.newNode(spec[0], spec[1]); if (spec[2] && n.type === 'split') { n.n = spec[2].n; spec[2].b.forEach((bb, j) => { n.bands[j] = bb.map(mkNode); }); } return n; };
const out = [];
for (const f of FACT) {
  const p = {}; for (const k in PR) p[k] = PR[k].d;
  if (f.name !== 'Init') for (const k of ['f1.kt', 'f2.kt']) p[k] = .5;
  for (const k in f.p) { if (PR[k]) p[k] = f.p[k]; else console.warn('missing key', f.name, k); }
  for (const o of 'abcdef') { const ko = o + '.oct'; if (p[ko]) { p[o + '.semi'] = clamp(p[o + '.semi'] + 12 * p[ko], -48, 48); p[ko] = 0; } }
  for (let i = 2; i <= 16; i++) { const k = 'e' + i + '.'; if (p[k + 'mode'] === 3) { p[k + 'mode'] = 2; p[k + 'lsh'] = G.RSHAPE[p[k + 'rsh'] | 0]; } }
  let chains = G.defaultChains(); const spec = f.chains || {};
  if (Object.keys(spec).length) for (const bus in spec) chains[bus] = spec[bus].map(mkNode);
  const tabs = Object.assign({ a: 'Sine to Saw', b: 'Sine to Saw', c: 'Sine to Saw', d: 'Sine to Saw', e: 'Sine to Saw', f: 'Sine to Saw' }, f.tabs || {});
  const pd = {}; for (const k in p) if (p[k] !== PR[k].d) pd[k] = p[k];
  // stable node ids so presets are the same on every export
  let nid = 0; const walk = l => { for (const n of l) { n.id = 'p' + (++nid); if (n.bands) n.bands.forEach(walk); } }; for (const bus in chains) walk(chains[bus]);
  out.push({ name: f.name, type: f.type, genre: f.genre, start: !!f.start, v: 5, p: pd, slots: (f.slots || []).map(s => ({ s: s.s, d: s.d, a: s.a, u: s.u || 0 })), chains, tabs });
}
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/presets.json', JSON.stringify(out));
const tn = new Set(); for (const o of out) for (const k in o.tabs) tn.add(o.tabs[k]);
console.log(out.length, 'presets,', fs.statSync('data/presets.json').size, 'bytes; tables used:', tn.size);
fs.writeFileSync('/tmp/preset_tables.txt', [...tn].join('\n'));
