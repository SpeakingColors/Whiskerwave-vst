#!/usr/bin/env python3
"""Render any wave through any test pattern to a WAV, so you can listen fast.
Usage: python3 tools/audition.py waves/fm_growl_1_2.wav hardstyle_lead_150 [out.wav]
List patterns: python3 tools/audition.py --list
Simple on purpose: one wavetable voice per note, linear interpolation, short envelope.
"""
import os, sys, struct, wave, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_midi import PATTERNS

SR = 44100

def load(path):
    with wave.open(path) as w:
        d = struct.unpack("<%dh" % w.getnframes(), w.readframes(w.getnframes()))
    return [x / 32768 for x in d]

def render(table, bpm, notes):
    n = len(table)
    s16 = 60.0 / bpm / 4
    total = int((64 * s16 + 1.0) * SR)
    out = [0.0] * total
    for st, ln, pitch, vel in notes:
        f = 440 * 2 ** ((pitch - 69) / 12)
        t0 = int(st * s16 * SR); dur = int(ln * s16 * SR); rel = int(0.08 * SR)
        ph = 0.0; inc = f * n / SR
        for i in range(dur + rel):
            if t0 + i >= total: break
            a = min(1.0, i / (0.004 * SR))
            if i > dur: a *= 1 - (i - dur) / rel
            k = int(ph); fr = ph - k
            v = table[k % n] * (1 - fr) + table[(k + 1) % n] * fr
            out[t0 + i] += v * a * vel / 127 * 0.25
            ph = (ph + inc) % n
    return out

if __name__ == "__main__":
    if "--list" in sys.argv:
        print("\n".join(PATTERNS)); sys.exit()
    wav, pat = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else os.path.splitext(os.path.basename(wav))[0] + "__" + pat + ".wav"
    bpm, notes = PATTERNS[pat]
    y = render(load(wav), bpm, notes)
    pk = max(abs(v) for v in y) or 1
    g = min(1.0, 0.9 / pk)
    with wave.open(out, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v * g)) * 32767)) for v in y))
    print("wrote", out)
