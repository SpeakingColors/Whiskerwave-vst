#!/bin/sh
# Every factory preset, whole signal path (oscillators, filters, modulation, FX chains, mixer, limiter): C++ against the JS engine.
# Random parts (noise, unison phases, drift, random FX) differ between runs, so the level may differ a little: the limit is 1.5 dB.
JS=${1:-/home/claude/ww-src/ww-dsp.js}
g++ -O2 -std=c++17 tests/preset_parity.cpp -o /tmp/preset_parity || exit 1
n=$(node -e "console.log(require('./data/presets.json').length)"); fail=0; i=0
while [ $i -lt $n ]; do
  a=$(node tools/preset_parity_js.js "$JS" data/presets.json $i /tmp/preset_flat.txt | tail -1); b=$(/tmp/preset_parity data/ww_tables.bin /tmp/preset_flat.txt)
  name=$(node -e "console.log(require('./data/presets.json')[$i].name)")
  res=$(echo "$a $b" | awk '{d=$2-$5; if(d<0)d=-d; if(d>1.5||$3>0||$6>0) print "DIFF"; else print "ok"}')
  [ "$res" = ok ] || fail=1; echo "$res  $i $name  js[$a] c++[$b]"; i=$((i+1))
done
[ $fail = 0 ] && echo "ALL PRESETS OK" || echo "SOME PRESETS DIFFER"
