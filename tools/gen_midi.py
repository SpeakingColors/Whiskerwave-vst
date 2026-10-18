#!/usr/bin/env python3
"""Original MIDI test patterns for auditioning waves fast. No external libs.
Usage: python3 tools/gen_midi.py [outdir]
Each file is 4 bars, loops cleanly, channel 1.
"""
import os, struct, sys

PPQ = 480
S = PPQ // 4  # one 16th

def vlq(n):
    b = [n & 0x7F]; n >>= 7
    while n:
        b.append((n & 0x7F) | 0x80); n >>= 7
    return bytes(reversed(b))

def write_mid(path, bpm, notes, name):
    """notes: list of (start_16th, length_16th, pitch, velocity)"""
    ev = []
    for st, ln, p, v in notes:
        ev.append((st * S, 1, p, v))
        ev.append(((st + ln) * S - 1, 0, p, 0))
    ev.sort(key=lambda e: (e[0], e[1]))
    tr = bytearray()
    nm = name.encode()
    tr += b"\x00\xff\x03" + vlq(len(nm)) + nm
    tr += b"\x00\xff\x51\x03" + (60000000 // bpm).to_bytes(3, "big")
    t = 0
    for tick, on, p, v in ev:
        tr += vlq(tick - t) + bytes([0x90 if on else 0x80, p, v]); t = tick
    end = 64 * S
    tr += vlq(max(0, end - t)) + b"\xff\x2f\x00"
    with open(path, "wb") as f:
        f.write(b"MThd" + struct.pack(">IHHH", 6, 0, 1, PPQ))
        f.write(b"MTrk" + struct.pack(">I", len(tr)) + bytes(tr))

def bars(pattern_fn, chords):
    out = []
    for b, root in enumerate(chords):
        for st, ln, off, v in pattern_fn(b):
            out.append((b * 16 + st, ln, root + off, v))
    return out

# Am - F - C - G style progressions, roots in MIDI
A, F, C, G = 0, -4, 3, -2

PATTERNS = {}
# Hardstyle: 150 bpm, rolling kick-gap bass (offbeat 16ths), lead stabs
PATTERNS["hardstyle_bass_150"] = (150, bars(lambda b: [(i, 2, 0, 100) for i in range(16) if i % 4 != 0], [45+A, 45+F, 45+C, 45+G]))
PATTERNS["hardstyle_lead_150"] = (150, bars(lambda b: [(0, 3, 0, 105), (3, 3, 12, 100), (6, 2, 7, 95), (8, 3, 0, 105), (11, 3, 12, 100), (14, 2, 10, 95)], [69+A, 69+F, 69+C, 69+G]))
# Happy hardcore: 170 bpm, bright arps and chord stabs
PATTERNS["happyhc_arp_170"] = (170, bars(lambda b: [(i, 1, [0, 4, 7, 12][i % 4] , 96) for i in range(16)], [72+A, 72+F, 72+C, 72+G]))
PATTERNS["happyhc_stabs_170"] = (170, [n for b, r in enumerate([60+A, 60+F, 60+C, 60+G]) for st in (0, 3, 6, 10) for n in [(b*16+st, 2, r+o, 100) for o in (0, 4, 7)]])
# UK hardcore style rave stabs, 175 bpm
PATTERNS["ukhc_rave_175"] = (175, [n for b, r in enumerate([57+A, 57+F, 57+C, 57+G]) for st in (0, 4, 8, 11, 14) for n in [(b*16+st, 2, r+o, 110) for o in (0, 3, 7, 10)]])
# Rolling bass 140 bpm
PATTERNS["bass_rolling_140"] = (140, bars(lambda b: [(i, 1, 0 if i % 8 else 12, 100) for i in range(16)], [36+A, 36+F, 36+C, 36+G]))
# Funk bass 108 bpm
PATTERNS["funk_bass_108"] = (108, bars(lambda b: [(0, 2, 0, 110), (3, 1, 0, 80), (4, 1, 12, 95), (6, 2, 7, 100), (8, 2, 0, 110), (11, 1, 10, 85), (12, 1, 7, 95), (14, 1, 5, 90)], [38+A, 38+F, 38+C, 38+G]))
# Slow chords to judge a wave's body, 120 bpm
PATTERNS["chords_pad_120"] = (120, [n for b, r in enumerate([57+A, 57+F, 57+C, 57+G]) for n in [(b*16, 16, r+o, 85) for o in (0, 3, 7, 12)]])
# Scale run: every wave should play cleanly across the keyboard
PATTERNS["range_check_120"] = (120, [(i * 2, 2, 24 + i * 2, 90) for i in range(32)])

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "midi"
    os.makedirs(out, exist_ok=True)
    for name, (bpm, notes) in PATTERNS.items():
        write_mid(os.path.join(out, name + ".mid"), bpm, notes, name)
    print(len(PATTERNS), "midi files written to", out)
