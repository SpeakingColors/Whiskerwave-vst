#!/bin/sh
cd /home/claude/ww-src
cat dsp1.js dsp_filt.js dsp2.js dsp3a.js dsp3b.js dsp3c.js dsp3e.js dsp3d.js > ww-dsp.js
node --check ww-dsp.js && echo syntax-ok
