#!/usr/bin/env python3
"""More original single-cycle waves, in the spirit of AKWF (no AKWF data used).
Bandlimited: everything is built from harmonics, so no aliasing at the table level.
Usage: python3 tools/gen_waves2.py [outdir]
"""
import math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_waves import N, additive, norm, write

H = N // 2 - 1
def sinc_lp(h, cut): return 1.0 / (1.0 + (h / cut) ** 4)

def fm(ratio, index):
    # 2-op FM, one cycle; ratio is an integer so the cycle loops cleanly
    return norm([math.sin(2*math.pi*i/N + index*math.sin(2*math.pi*ratio*i/N)) for i in range(N)])

def fold(x, g):
    return norm([math.sin(g*math.sin(2*math.pi*i/N)) for i in range(N)])

def tanh_drive(g):
    return norm([math.tanh(g*math.sin(2*math.pi*i/N)) for i in range(N)])

def saw_stack(offs):
    return norm(additive(lambda h: sum(math.cos(2*math.pi*h*o) for o in offs)/h, 255))

def comb(k):
    return norm(additive(lambda h: (1.0/h) * (1 if h % k == 0 else 0.15), 255))

def random_spec(seed, tilt):
    r = random.Random(seed)
    ph = [r.random()*2*math.pi for _ in range(H+1)]
    out = [0.0]*N
    for h in range(1, 64):
        a = 1.0 / h**tilt
        for i in range(N):
            out[i] += a*math.sin(2*math.pi*h*i/N + ph[h])
    return norm(out)

W = {
 "fm_bell_1_3":   fm(3, 2.2),
 "fm_bell_1_5":   fm(5, 1.6),
 "fm_ep_1_1":     fm(1, 1.4),
 "fm_growl_1_2":  fm(2, 4.0),
 "fm_metal_1_7":  fm(7, 2.8),
 "fold_soft":     fold(None, 2.0),
 "fold_hard":     fold(None, 5.0),
 "fold_wild":     fold(None, 9.0),
 "drive_warm":    tanh_drive(2.5),
 "drive_hard":    tanh_drive(8.0),
 "stack_2":       saw_stack([0, 0.03]),
 "stack_3":       saw_stack([0, 0.02, 0.05]),
 "stack_wide":    saw_stack([0, 0.07, 0.15, 0.31]),
 "comb_2":        comb(2),
 "comb_3":        comb(3),
 "comb_4":        comb(4),
 "odd_soft":      norm(additive(lambda h: (1.0/h**1.5) if h % 2 else 0, 255)),
 "even_only":     norm(additive(lambda h: (1.0/h) if h % 2 == 0 else 0, 255)),
 "reed":          norm(additive(lambda h: (1.0/h) * (1.6 if h in (3,5) else 1.0) * sinc_lp(h, 18), 255)),
 "brass":         norm(additive(lambda h: (1.0/h**0.8) * sinc_lp(h, 12), 255)),
 "hoover_like":   norm(additive(lambda h: (1.0/h) * (1 + 0.9*math.sin(h*1.7)), 255)),
 "screech":       norm(additive(lambda h: (1.0/h**0.6) * (2.2 if 10 <= h <= 14 else 1.0), 255)),
 "reese_base":    norm(additive(lambda h: (1.0/h) * (1 if h % 2 else 0.5), 255)),
 "noise_cycle_a": random_spec(1, 1.0),
 "noise_cycle_b": random_spec(2, 0.7),
 "noise_cycle_c": random_spec(3, 1.5),
}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "waves"
    os.makedirs(out, exist_ok=True)
    for name, data in W.items():
        write(os.path.join(out, name + ".wav"), data)
    print(len(W), "waves written to", out)
