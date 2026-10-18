#!/usr/bin/env python3
"""Generate single-cycle waveforms (2048 samples, 16-bit mono WAV) from math.
Original, CC0-style output: made by code, no third-party samples.
Usage: python3 tools/gen_waves.py [outdir]
"""
import math, struct, sys, wave, os

N = 2048

def additive(amp, maxh=None):
    maxh = maxh or N // 2 - 1
    out = [0.0] * N
    for h in range(1, maxh + 1):
        a = amp(h)
        if a == 0:
            continue
        for i in range(N):
            out[i] += a * math.sin(2 * math.pi * h * i / N)
    return out

def norm(x):
    m = max(abs(v) for v in x) or 1.0
    return [v / m for v in x]

def formant(h, centers, bw=1.4):
    return sum(math.exp(-((math.log(h) - math.log(c)) ** 2) / (2 * (bw / 4) ** 2)) for c in centers)

WAVES = {
    "sine": lambda: additive(lambda h: 1 if h == 1 else 0),
    "triangle": lambda: additive(lambda h: (1 / h ** 2) * (1 if (h % 4 == 1) else -1) if h % 2 else 0),
    "saw": lambda: additive(lambda h: 1 / h),
    "square": lambda: additive(lambda h: 1 / h if h % 2 else 0),
    "pulse25": lambda: additive(lambda h: math.sin(math.pi * h * 0.25) / h),
    "pulse10": lambda: additive(lambda h: math.sin(math.pi * h * 0.10) / h),
    "organ": lambda: additive(lambda h: {1: 1, 2: .8, 3: .5, 4: .6, 6: .3, 8: .25}.get(h, 0)),
    "vox_ah": lambda: additive(lambda h: (1 / h) * formant(h, [9, 17, 28])),
    "vox_oo": lambda: additive(lambda h: (1 / h) * formant(h, [4, 9, 28])),
    "hollow": lambda: additive(lambda h: 1 / h if h % 3 else 0),
    "bright_saw": lambda: additive(lambda h: 1 / h ** 0.6),
    "sync_like": lambda: [math.sin(2 * math.pi * 3.7 * (i / N)) * (1 - i / N) for i in range(N)],
}

def write(path, data):
    mean = sum(data) / len(data)
    data = [v - mean for v in data]  # remove DC offset
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(44100)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v)) * 32000)) for v in data))

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "waves"
    os.makedirs(out, exist_ok=True)
    for name, fn in WAVES.items():
        write(os.path.join(out, name + ".wav"), norm(fn()))
        print("wrote", name)
