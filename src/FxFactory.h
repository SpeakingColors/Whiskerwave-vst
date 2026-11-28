// Creates the instance for an FX type. Include this once (after all FX headers).
#pragma once
#include "FxDyn.h"
#include "FxDist.h"
#include "FxTime.h"
#include "FxNew.h"
namespace whisker {
inline std::unique_ptr<FxInst> makeFxInst(int type, FxEnv* env) {
  std::unique_ptr<FxInst> p;
  switch (type) {
    case FX_eq: p.reset(new FxEq()); break; case FX_comp: p.reset(new FxComp()); break; case FX_maxi: p.reset(new FxMaxi()); break; case FX_squeeze: p.reset(new FxSqueeze()); break;
    case FX_pump: p.reset(new FxPump()); break; case FX_tgate: p.reset(new FxTGate()); break; case FX_trans: p.reset(new FxTrans()); break;
    case FX_dist: p.reset(new FxDistI()); break; case FX_fat: p.reset(new FxFatI()); break; case FX_crush: p.reset(new FxCrushI()); break; case FX_folder: p.reset(new FxFolderI()); break;
    case FX_fshift: p.reset(new FxFShiftI()); break; case FX_ring: p.reset(new FxRingI()); break; case FX_vowel: p.reset(new FxVowelI()); break; case FX_filt: p.reset(new FxFiltI()); break;
    case FX_chorus: p.reset(new FxChorusI()); break; case FX_flanger: p.reset(new FxFlangerI()); break; case FX_phaser: p.reset(new FxPhaserI()); break; case FX_trem: p.reset(new FxTremI()); break;
    case FX_delay: p.reset(new FxDelayI()); break; case FX_taps: p.reset(new FxTapsI()); break; case FX_pitch: p.reset(new FxPitchI()); break; case FX_verb: p.reset(new FxVerbI()); break;
    case FX_disp: p.reset(new FxDispI()); break; case FX_image: p.reset(new FxImageI()); break; case FX_haas: p.reset(new FxHaasI()); break; case FX_util: p.reset(new FxUtilI()); break;
    case FX_subx: p.reset(new FxSubxI()); break; case FX_exciter: p.reset(new FxExcI()); break; case FX_stutter: p.reset(new FxStutterI()); break; case FX_split: p.reset(new FxSplitI()); break;
    case FX_gate: p.reset(new FxGateI()); break; case FX_deq: p.reset(new FxDeqI()); break; case FX_tape: p.reset(new FxTapeI()); break; case FX_gran: p.reset(new FxGranI()); break; case FX_freeze: p.reset(new FxFreezeI()); break;
    case FX_envf: p.reset(new FxEnvFI()); break; case FX_voc: p.reset(new FxVocI()); break; case FX_talk: p.reset(new FxTalkI()); break; case FX_tune: p.reset(new FxTuneI()); break; case FX_fatcat: p.reset(new FxFatCatI()); break;
    default: break;
  }
  if (p) p->E = env;
  return p;
}
inline int fxTypeByName(const std::string& t) { for (int i = 0; i < kNumFxTypes; i++) if (t == kFx[i].type) return i; return -1; }
} // namespace whisker
