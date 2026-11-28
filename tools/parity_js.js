// JS reference for tests/parity_render.cpp. Usage: node tools/parity_js.js /path/to/ww-dsp.js init|wonder
const fs = require('fs'); const G = {};
new Function('G', fs.readFileSync(process.argv[2], 'utf8') + ';WWMAKE(G);')(G);
const which = process.argv[3] || 'init';
const e = new G.Engine(44100);
for (const k in G.PR) e.pv[k] = G.PR[k].d;
e.pv.master = 3; e.pv.lim = 0; e.pv['a.anl'] = .2; e.pv['b.anl'] = .2; e.pv['c.anl'] = .2;
if (which === 'wonder') { e.pv['a.pos'] = .26; e.pv['a.uv'] = 3; }
for (const k in e.pv) e.setParam(k, e.pv[k]);
e.msg({ t: 'on', n: 57, v: .8 });
const N = Math.floor(4 * 44100 / 2048) * 2048, L = new Float32Array(N), R = new Float32Array(N), bl = new Float32Array(2048), br = new Float32Array(2048);
for (let b = 0; b < N / 2048; b++) { e.process(bl, br, 2048); L.set(bl, b * 2048); R.set(br, b * 2048); }
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } } for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const u = i + k, v = i + k + len / 2; const tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr; re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } }
let pk = 0, ss = 0; for (let i = 0; i < N; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); ss += (L[i] * L[i] + R[i] * R[i]) / 2; }
const s0 = Math.floor(N * .3), W = 16384, re = new Float64Array(W), im = new Float64Array(W);
for (let i = 0; i < W; i++) { const w = .5 - .5 * Math.cos(2 * Math.PI * i / W); re[i] = (L[s0 + i] + R[s0 + i]) * .5 * w; } fft(re, im);
let tot = 0, cen = 0, b1 = 0, b2 = 0, b3 = 0;
for (let k = 1; k < W / 2; k++) { const f = k * 44100 / W, m = re[k] * re[k] + im[k] * im[k]; tot += m; cen += m * f; if (f < 500) b1 += m; else if (f < 2000) b2 += m; else if (f < 8000) b3 += m; }
const db = x => 10 * Math.log10(x / tot + 1e-12);
console.log(`peak ${pk.toFixed(2)} rms ${(10 * Math.log10(ss / N + 1e-12)).toFixed(1)}dB centroid ${Math.round(cen / tot)}Hz <500 ${db(b1).toFixed(0)} 0.5-2k ${db(b2).toFixed(0)} 2-8k ${db(b3).toFixed(0)}`);
