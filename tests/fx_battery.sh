#!/bin/sh
# Compares every FX (default and non-default settings) between the C++ port and the JS engine. Passes when peak and rms agree to 5 decimals.
JS=${1:-/home/claude/ww-src/ww-dsp.js}
g++ -O2 -std=c++17 tests/fx_parity.cpp -o /tmp/fx_parity || exit 1
fail=0
run() { a=$(/tmp/fx_parity "$1" "$2" | awk '{printf "%s %.5f %.5f", $1, $3, $5}'); b=$(node tools/fx_parity_js.js "$JS" "$1" "$2" | tail -1 | awk '{printf "%s %.5f %.5f", $1, $3, $5}'); if [ "$a" = "$b" ]; then echo "ok   $a  [$2]"; else echo "DIFF c++ $a | js $b  [$2]"; fail=1; fi; }
for t in eq comp maxi squeeze pump tgate trans dist fat crush folder fshift ring vowel filt chorus flanger phaser trem delay taps pitch verb disp image haas util subx exciter split; do run $t ""; done
run eq "hp=120;lg=6;m1g=-9;m1q=4;m2g=5;hg=-6;lp=6000"
run comp "thr=-30;ratio=8;att=1;rel=40;knee=0;makeup=6;mix=.5"
run maxi "gain=18;ceil=-1;soft=0"; run maxi "gain=12;soft=1;rel=20;mix=.6"
run squeeze "depth=1;time=.3;lowg=6"
run pump "div=4;depth=1;curve=-.8"; run tgate "div=5;swing=.5;smooth=10"
run trans "attack=1;sustain=-1"; run trans "attack=-.7;sustain=.8"
for k in 1 2 3 4 5 6 7 8 9; do run dist "type=$k;drive=24;bias=.4;pre=200;tone=4000"; done
for k in 1 2 3 4 5 6 7; do run fat "mode=$k;drive=20;fat=1;tone=-.5"; done
run crush "bits=4;rate=8;smooth=.6"; run folder "drive=24;stages=4;sym=.6"
run fshift "shift=-240;fb=.6;spread=.4"; run ring "freq=1200;wave=2;mix=1"; run ring "wave=3"; run ring "wave=1"
run vowel "vowel=2.6;shift=.5;res=1;drive=18"
for k in 0 5 9 14 20 27 33 40 46; do run filt "type=$k;cut=900;res=.8;drive=.5;shape=.2;dm=2"; done
for k in 1 2 3; do run chorus "mode=$k;sync=4;depth=1;fb=.5"; done
run flanger "sync=3;depth=1;fb=-.9;spread=1"; run phaser "stages=3;fb=.9;spread=1;depth=1"; run phaser "stages=0;sync=5"
run trem "mode=1;shape=2;stereo=1;depth=1"; run trem "shape=3;sync=5"
run delay "mode=1;syncl=5;fb=.8;sat=.7"; run delay "mode=2;syncl=0;timel=120;wow=1"; run delay "mode=3;syncl=4;syncr=7;lc=400;hc=2000"
run taps "fb=.8;d1=5;x2=1.5;p3=1;lc=300"; run pitch "semi=-12;fine=30;win=100;fb=.6;mix=1"; run pitch "semi=7;win=20"
for k in 0 1 3 4 5 6 7 8 9; do run verb "type=$k;size=.8;decay=6;pre=60;mix=1"; done
run verb "size=0;decay=.2;diff=0;mod=0;early=1;width=0"
run disp "amount=64;freq=300;pinch=1;fb=.7;spread=1"; run disp "amount=1;pinch=-1;range=5"
run image "width=2;bass=200;mid=-6;side=6;pan=.5"; run haas "time=25;side=0;decor=1;mix=1"
run util "gain=-12;pan=-.6;mono=1;invert=1;swap=1;dc=1"; run subx "freq=150;amount=1;harm=1;level=6"; run exciter "freq=2000;drive=24;amount=1.5"
run split "x1=200;x2=1500;g1=-12;g3=6;mix=.7"
[ $fail = 0 ] && echo "ALL OK" || echo "SOME DIFFS"
