// Renders factory preset <i> with the JS engine and writes the same preset as a flat text file for tests/preset_parity.cpp.
// Usage: node tools/preset_parity_js.js ww-dsp.js data/presets.json <i> <flat out>
const fs = require('fs'); const G = {}; new Function('G', fs.readFileSync(process.argv[2], 'utf8') + ';WWMAKE(G);')(G);
const P = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))[+process.argv[4]]; const TN = fs.readFileSync('src/TableNames.h', 'utf8').split('kTableNames[kNumTables] = {')[1].split('};')[0].match(/"[^"]+"/g).map(s => JSON.parse(s));
const e = new G.Engine(44100); const pv = {}; for (const k in G.PR) pv[k] = G.PR[k].d; Object.assign(pv, P.p);
for (const o of 'abcdef') { pv[o + '.anl'] = 0; pv[o + '.rnd'] = 0; } pv['s.sph'] = pv['s.sph'] || 0;
for (const k in pv) e.setParam(k, pv[k]);
let flat = ''; for (const k in pv) flat += `P ${k} ${pv[k]}\n`;
'abcdef'.split('').forEach((o, i) => { e.setTable(i, P.tabs[o], pv[o + '.sw'], pv[o + '.sk']); flat += `T ${i} ${TN.indexOf(P.tabs[o])}\n`; });
for (const s of P.slots) flat += `S ${s.s} ${s.d} ${s.a} ${s.u ? 1 : 0}\n`;
const walk = (l, where) => { for (const n of l) { flat += `N ${where} ${n.type} ${n.id} ${n.on ? 1 : 0} ${n.n || 3} ${Object.keys(n.p).map(k => k + '=' + n.p[k]).join(',')}\n`; if (n.bands) n.bands.forEach((b, j) => walk(b, n.id + ':' + j)); } };
for (const b of ['t0', 't1', 't2', 't3', 'x1', 'x2', 'mst']) walk(P.chains[b] || [], b);
fs.writeFileSync(process.argv[5], flat);
e.msg({ t: 'chains', c: JSON.parse(JSON.stringify(P.chains)) }); e.msg({ t: 'slots', s: P.slots });
const B = 2048, N = Math.floor(3 * 44100 / B) * B, bl = new Float32Array(B), br = new Float32Array(B); let pk = 0, ss = 0, bad = 0;
for (let b = 0; b < N / B; b++) { if (b === 0) for (const n of [45, 57, 64]) e.msg({ t: 'on', n, v: .8 }); if (b === Math.floor(1.5 * 44100 / B)) for (const n of [45, 57, 64]) e.msg({ t: 'off', n });
  e.process(bl, br, B); for (let i = 0; i < B; i++) { if (!isFinite(bl[i])) bad++; pk = Math.max(pk, Math.abs(bl[i]), Math.abs(br[i])); ss += (bl[i] * bl[i] + br[i] * br[i]) / 2; } }
console.log(`${pk.toFixed(3)} ${(10 * Math.log10(ss / N + 1e-12)).toFixed(2)} ${bad}`);
