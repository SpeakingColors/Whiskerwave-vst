#!/bin/sh
# Compares C++ and JS renders over many scenarios. Usage: sh tests/parity_battery.sh /path/to/ww-dsp.js
JS=${1:-/home/claude/ww-src/ww-dsp.js}
run() { # name scenario
  c=$(/tmp/parity_render data/ww_tables.bin "$2"); j=$(node tools/parity_js.js "$JS" "$2")
  node -e '
const p=s=>{const m=s.match(/peak ([\d.]+) rms (-?[\d.]+)dB centroid (\d+)Hz/);return m?[+m[1],+m[2],+m[3]]:null};
const c=p(process.argv[2]),j=p(process.argv[3]);
if(!c||!j){console.log("FAIL",process.argv[1],process.argv[2],"|",process.argv[3]);process.exit()}
const dr=Math.abs(c[1]-j[1]),dc=Math.abs(c[2]-j[2])/Math.max(50,j[2]);
const bad=dr>1.5||dc>.25;console.log((bad?"DIFF ":"ok   ")+process.argv[1].padEnd(22)+"C++ "+c.join(" ")+" | JS "+j.join(" "))' "$1" "$c" "$j"
}
for t in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46; do
  run "filter $t" "a.rt=1;f1.type=$t;f1.cut=1500;f1.res=.4;f1.sh=.5;a.uv=2"; done
run "lfo>pos" "slot=l1>a.pos:.5;l1.rate=3"
run "env2>cut" "a.rt=1;f1.type=2;f1.cut=500;slot=e2>f1.cut:.6;e2.a=300;e2.d=900;e2.s=.3"
run "env3 lfo mode" "e3.mode=2;e3.lr=5;slot=e3>a.pos:.4"
run "env4 random" "e4.mode=3;e4.lr=6;slot=e4>a.pos:.4"
run "vel>lvl" "slot=vel>a.lvl:-.3"
run "key>cut" "a.rt=1;f1.type=2;f1.cut=800;slot=key>f1.cut:.4;note=72"
run "macro" "m1=.7;slot=m1>a.pos:.8"
run "unison classic" "a.uv=5;a.us=0;a.ud=.5"
run "unison super" "a.uv=7;a.us=1;a.ud=.6"
run "unison jp" "a.uv=7;a.us=2;a.ud=.5"
run "unison oct" "a.uv=4;a.us=3"
run "unison power" "a.uv=4;a.us=4"
run "unison minor" "a.uv=4;a.us=5"
run "sub saw" "s.sub=1;s.sw=3;s.sl=.6"
run "noise pink" "s.nz=1;s.nt=1;s.nl=.5"
run "noise brown" "s.nz=1;s.nt=2;s.nl=.5"
run "noise vinyl" "s.nz=1;s.nt=8;s.nl=.5"
run "oscB+C" "b.on=1;c.on=1;b.semi=7;c.semi=12;b.lvl=.5;c.lvl=.4"
run "osc D,E,F" "d.on=1;e.on=1;f.on=1;d.semi=-12;e.semi=7;f.semi=12;d.lvl=.5;e.lvl=.4;f.lvl=.3"
run "warp+fm" "a.w1=2;a.w1a=.6;a.w2=10;a.w2a=.5;a.mm=1;a.ms=1;a.ma=.3;b.on=1;b.lvl=0"
run "ring" "a.mm=3;a.ms=1;a.ma=.7;b.on=1;b.lvl=0;b.semi=5"
run "glide mono" "vmode=1;glide=200"
run "tablesw" "a.sw=-.5;a.sk=.3"
