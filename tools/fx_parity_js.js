// JS side of the FX parity check. Usage: node tools/fx_parity_js.js ww-dsp.js <type> "key=value;..." [seconds]
const fs = require('fs'); const G = {}; new Function('G', fs.readFileSync(process.argv[2], 'utf8') + ';WWMAKE(G);')(G);
const type = process.argv[3], def = G.FXDEF[type]; const E = new G.Engine(44100); E.pv.bpm = 120;
const node = G.newNode(type); for (const kv of (process.argv[4] || '').split(';')) { const [k, v] = kv.split('='); if (k) node.p[k] = +v; }
const secs = +(process.argv[5] || 2), total = Math.floor(secs * 44100), B = 32; const L = new Float32Array(B), R = new Float32Array(B); let pk = 0, sum = 0, chk = 0, lcg = 12345, beat = 0;
for (let t = 0; t < total; t += B) {
  for (let i = 0; i < B; i++) { const k = t + i, tt = k / 44100, m = tt % .5, env = m < .25 ? Math.exp(-m * 8) : 0;
    lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0; const nz = ((lcg >>> 8) & 0xFFFF) / 32768 - 1;
    L[i] = env * (.5 * Math.sin(2 * Math.PI * 110 * tt) + .3 * Math.sin(2 * Math.PI * 1760 * tt) + .1 * nz); R[i] = env * (.5 * Math.sin(2 * Math.PI * 110 * tt + .5) + .3 * Math.sin(2 * Math.PI * 2640 * tt) - .1 * nz); }
  E.beat = beat; E.runChain([node], L, R, B, 0); beat += B * 120 / 60 / 44100;
  for (let i = 0; i < B; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); sum += L[i] * L[i] + R[i] * R[i]; chk += L[i] * Math.sin((t + i) * .0137) + R[i] * Math.cos((t + i) * .0071); }
}
console.log(`${type} peak ${pk.toFixed(6)} rms ${Math.sqrt(sum / (2 * total)).toFixed(6)} chk ${chk.toFixed(6)}`);
