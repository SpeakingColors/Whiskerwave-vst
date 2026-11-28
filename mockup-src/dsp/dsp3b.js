/* part 3b: distortion, filters, modulation FX */
const tri=x=>{if(x<=1&&x>=-1)return x;let y=((x+1)%4+4)%4;return y<2?y-1:3-y;};
function shp(t,x){
  switch(t){
    case 0:return Math.tanh(x);
    case 1:return x>1?1:x<-1?-1:x;
    case 2:return x>=0?Math.tanh(x):Math.tanh(x*.6)*1.3;
    case 3:return tri(x);
    case 4:return Math.atan(x*1.5)*.64;
    case 5:return x>=0?1-Math.exp(-x):-(1-Math.exp(x*.7))*.7;
    case 6:return Math.abs(Math.tanh(x))*1.2-.4;
    case 7:return Math.sin(x*1.5);
    case 8:return (x<0?-1:1)*(1-Math.exp(-Math.abs(x)*3));
    default:return x>=0?Math.tanh(x*1.5):x/(1+Math.abs(x)*2);}
}
G.shp=shp;G.tri=tri;
const DCB=.0007;
/* ================= Distortion ================= */
class FxDist{constructor(E){this.E=E;this.os=[new OS4(),new OS4()];this.tl=[new BiS(),new BiS()];this.hp=new BiS();this.dc=[0,0];}
  proc(L,R,n,P){const sr=this.E.sr,t=P('type'),dg=dbv(P('drive')),bias=P('bias')*.5,og=dbv(P('level'));
    this.tl[0].set('lp',P('tone'),.7071,0,sr);this.tl[1].set('lp',P('tone'),.7071,0,sr);this.hp.set('hp',P('pre'),.7071,0,sr);
    for(const o of this.os)o.prep(sr);
    const fn=(x,a,b)=>shp(a,x+b);
    for(let i=0;i<n;i++)for(let c=0;c<2;c++){const X=c?R:L;let x=this.hp.p(c,X[i])*dg;
      let y=this.os[c].p(c,x,fn,t,bias);y=this.tl[c].p(c,y);this.dc[c]+=DCB*(y-this.dc[c]);X[i]=(y-this.dc[c])*og;}}
  alignDry(L,R,n){for(let i=0;i<n;i++){L[i]=this.os[0].lin(0,L[i]);R[i]=this.os[1].lin(1,R[i]);}}}
fx('dist','Distortion','Distort','Ten distortion curves, oversampled so it stays smooth. Tone smooths the top.',[
 ['type','Type',0,0,0,{list:['Soft','Hard','Tube','Fold','Tape','Diode','Rectify','Sine','Fuzz','Asym'],tip:'Shape of the distortion curve.'}],
 ['drive','Drive',0,48,12,{u:' dB',tip:'How hard the signal is pushed into the curve.'}],['bias','Bias',-1,1,0,{tip:'Shifts the curve for even harmonics and a rounder, buzzier edge.'}],
 ['pre','Pre high-pass',20,2000,20,{k:'exp',u:' Hz',tip:'Removes low frequencies before the distortion so the bass stays clean.'}],
 ['tone','Tone',500,20000,12000,{k:'exp',u:' Hz',tip:'Low-pass after the distortion. Lower is darker.'}],['level','Level',-24,12,-6,{u:' dB',tip:'Output level. Distortion is loud, so turn it down.'}]
],FxDist,1);

/* ================= Fat Drive ================= */
class FxFat{constructor(E){this.E=E;this.os=[new OS4(),new OS4()];this.lp=new BiS();this.ls=new BiS();this.hs=new BiS();this.dc=[0,0];}
  proc(L,R,n,P){const sr=this.E.sr,mode=P('mode'),dg=dbv(P('drive')),fat=P('fat'),bias=P('bias')*.4,tone=P('tone'),og=dbv(P('out'));
    const map=[2,4,0,8,6,3,1,9],t=map[mode];
    this.lp.set('lp',260,.7071,0,sr);this.ls.set('ls',400,.7,-tone*6,sr);this.hs.set('hs',3500,.7,tone*6,sr);
    for(const o of this.os)o.prep(sr);
    const fn=(x,a,b)=>shp(a,x+b);
    for(let i=0;i<n;i++)for(let c=0;c<2;c++){const X=c?R:L,x=X[i],low=this.lp.p(c,x);
      let y=this.os[c].p(c,x*dg,fn,t,bias);
      y+=fat*.8*(Math.tanh(low*dg*1.6)-low*Math.min(1,dg*.2));
      y=this.hs.p(c,this.ls.p(c,y));this.dc[c]+=DCB*(y-this.dc[c]);X[i]=(y-this.dc[c])*og;}}
  alignDry(L,R,n){for(let i=0;i<n;i++){L[i]=this.os[0].lin(0,L[i]);R[i]=this.os[1].lin(1,R[i]);}}}
fx('fat','Fat Drive','Distort','Saturator that thickens: eight flavours plus a low band boost for weight. Warm to nasty.',[
 ['mode','Flavour',0,0,0,{list:['Warm Tube','Tape Fat','Crunch','Fuzz','Rectifier','Fold','Digital','Transformer'],tip:'Character of the saturation.'}],
 ['drive','Drive',0,36,12,{u:' dB',tip:'Amount of saturation.'}],['fat','Fat',0,1,.4,{tip:'Extra weight: saturates the low band on its own and adds it back.'}],
 ['bias','Bias',-1,1,0,{tip:'Asymmetry. Adds even harmonics.'}],['tone','Tone',-1,1,0,{tip:'Tilt of the output. Left is darker, right is brighter.'}],['out','Output',-24,12,-3,{u:' dB',tip:'Output level.'}]
],FxFat,1);

/* ================= Bitcrusher ================= */
class FxCrush{constructor(E){this.E=E;this.h=[0,0];this.c=0;this.nx=1;this.lp=[new BiS(),new BiS()];}
  proc(L,R,n,P){const sr=this.E.sr,bits=P('bits'),q=Math.pow(2,bits-1),red=P('rate'),jit=P('jitter'),dith=P('dither'),sm=P('smooth');
    this.lp[0].set('lp',clamp(sr/Math.max(red,1)*.45*(1+(1-sm)*20),200,sr*.45),.7071,0,sr);this.lp[1].set('lp',clamp(sr/Math.max(red,1)*.45*(1+(1-sm)*20),200,sr*.45),.7071,0,sr);
    for(let i=0;i<n;i++){this.c+=1;
      if(this.c>=this.nx){this.c-=this.nx;this.nx=red*(1+jit*(Math.random()*2-1)*.5);
        for(let ch=0;ch<2;ch++){const x=(ch?R:L)[i],d=dith*(Math.random()-Math.random())/q;this.h[ch]=Math.round((x+d)*q)/q;}}
      for(let ch=0;ch<2;ch++){let y=this.h[ch];if(sm>0)y=this.lp[ch].p(ch,y)*sm+y*(1-sm);(ch?R:L)[i]=y;}}}}
fx('crush','Crusher','Distort','Bit depth and sample rate reducer for digital grit. From lo-fi to harsh.',[
 ['bits','Bits',1,16,8,{k:'int',tip:'Bit depth. Lower is rougher.'}],['rate','Downsample',1,64,1,{k:'exp',tip:'Keeps every Nth sample. Higher is more aliasing and grit.'}],
 ['jitter','Jitter',0,1,0,{tip:'Randomises the sample timing for a noisy, broken sound.'}],['dither','Dither',0,1,0,{tip:'Adds noise before crushing so quiet parts stay alive.'}],['smooth','Smooth',0,1,0,{tip:'Low-passes the steps for a softer, tape-like crush.'}]
],FxCrush,1);

/* ================= Wavefolder ================= */
class FxFolder{constructor(E){this.E=E;this.os=[new OS4(),new OS4()];this.tl=[new BiS(),new BiS()];this.dc=[0,0];}
  proc(L,R,n,P){const sr=this.E.sr,dg=dbv(P('drive')),st=P('stages'),sym=P('sym')*.5,og=dbv(P('level'));
    this.tl[0].set('lp',P('tone'),.7071,0,sr);this.tl[1].set('lp',P('tone'),.7071,0,sr);for(const o of this.os)o.prep(sr);
    const fn=(x,a,b)=>{let y=x+b;for(let k=0;k<a;k++)y=tri(y*1.15);return y;};
    for(let i=0;i<n;i++)for(let c=0;c<2;c++){const X=c?R:L;let y=this.os[c].p(c,X[i]*dg,fn,st,sym);y=this.tl[c].p(c,y);this.dc[c]+=DCB*(y-this.dc[c]);X[i]=(y-this.dc[c])*og;}}
  alignDry(L,R,n){for(let i=0;i<n;i++){L[i]=this.os[0].lin(0,L[i]);R[i]=this.os[1].lin(1,R[i]);}}}
fx('folder','Wavefolder','Distort','Folds the wave back on itself: metallic, rich harmonics that move as the level changes.',[
 ['drive','Drive',0,30,10,{u:' dB',tip:'How far the wave is pushed into the fold.'}],['stages','Stages',1,4,1,{k:'int',tip:'Number of folds in a row. More is busier.'}],
 ['sym','Symmetry',-1,1,0,{tip:'Shifts the fold point for uneven harmonics.'}],['tone','Tone',500,20000,14000,{k:'exp',u:' Hz',tip:'Low-pass after folding.'}],['level','Level',-24,6,-6,{u:' dB',tip:'Output level.'}]
],FxFolder,1);

/* ================= Frequency shifter (Hilbert allpass pairs) ================= */
const HA=[.6923878,.9360654322959,.9882295226860,.9987488452737],HB=[.4021921162426,.8561710882420,.9722909545651,.9952884791278];
class Hilb{constructor(){this.sa=new Float64Array(16);this.sb=new Float64Array(16);this.d=0;}
  p(x){let a=x,b=this.d;this.d=x;
    for(let k=0;k<4;k++){const c=HA[k]*HA[k],o=k*4,s=this.sa;const y=c*(a+s[o+3])-s[o+1];s[o+1]=s[o];s[o]=a;s[o+3]=s[o+2];s[o+2]=y;a=y;}
    for(let k=0;k<4;k++){const c=HB[k]*HB[k],o=k*4,s=this.sb;const y=c*(b+s[o+3])-s[o+1];s[o+1]=s[o];s[o]=b;s[o+3]=s[o+2];s[o+2]=y;b=y;}
    this.i=a;this.q=b;}}
class FxFShift{constructor(E){this.E=E;this.h=[new Hilb(),new Hilb()];this.ph=0;this.fb=[0,0];}
  proc(L,R,n,P){const sr=this.E.sr,sh=P('shift'),fbk=P('fb'),w=TAU*sh/sr,sd=P('spread');
    for(let i=0;i<n;i++){const c=Math.cos(this.ph),s=Math.sin(this.ph);
      for(let ch=0;ch<2;ch++){const X=ch?R:L,h=this.h[ch];h.p(X[i]+fbk*this.fb[ch]);
        const sg=ch?1-sd*4:1;const y=h.i*c+h.q*s*sg;this.fb[ch]=Math.tanh(y);X[i]=y;}
      this.ph+=w;if(this.ph>TAU)this.ph-=TAU;else if(this.ph<-TAU)this.ph+=TAU;}}}
fx('fshift','Freq Shifter','Distort','Moves every frequency up or down by a fixed amount in Hz. Metallic, inharmonic and weird.',[
 ['shift','Shift',-1000,1000,0,{u:' Hz',tip:'Positive shifts up, negative shifts down. Small values give a slow phasing swirl.'}],
 ['fb','Feedback',0,.9,0,{tip:'Feeds the output back in for rising or falling spirals.'}],['spread','Stereo',0,.5,0,{tip:'Shifts left and right in opposite directions for width.'}]
],FxFShift,.5);

/* ================= Ring mod ================= */
class FxRing{constructor(E){this.E=E;this.ph=0;this.os=[new OS4(),new OS4()];}
  proc(L,R,n,P){const sr=this.E.sr,f=P('freq'),w=P('wave'),inc=f/sr/4;let ph=this.ph;for(const o of this.os)o.prep(sr);
    const fn=(x)=>{const m=wave4(w,ph);ph+=inc;if(ph>=1)ph-=1;return x*m;};
    for(let i=0;i<n;i++){const p0=ph;const a=this.os[0].p(0,L[i],fn);ph=p0;const b=this.os[1].p(1,R[i],fn);L[i]=a;R[i]=b;}this.ph=ph;}}
fx('ring','Ring Mod','Distort','Multiplies the sound with an oscillator for bell-like and robot tones.',[
 ['freq','Frequency',20,8000,300,{k:'exp',u:' Hz',tip:'Pitch of the modulator oscillator.'}],['wave','Wave',0,0,0,{list:['Sine','Triangle','Square','Saw'],tip:'Shape of the modulator.'}]
],FxRing,.6);

/* ================= Vowel ================= */
const FMT=[[800,1150,2900],[400,1600,2700],[270,2140,2950],[450,830,2830],[325,700,2530]];
const vtanh=(x,dg)=>Math.tanh(x*dg)/Math.sqrt(dg);
class FxVowel{constructor(E){this.E=E;this.os=[new OS4(),new OS4()];this.b=[0,1,2].map(()=>new BiS());}
  proc(L,R,n,P){const sr=this.E.sr;for(const o of this.os)o.prep(sr);const v=clamp(P('vowel'),0,4),i=Math.min(3,Math.floor(v)),f=v-i,sh=Math.pow(2,P('shift')),q=3+P('res')*14,dg=dbv(P('drive')),og=dbv(P('gain'));
    for(let k=0;k<3;k++)this.b[k].set('bp',(FMT[i][k]*(1-f)+FMT[i+1][k]*f)*sh,q*(k===0?.8:1.1),0,sr);
    const w=[1,.65,.4];
    for(let j=0;j<n;j++)for(let c=0;c<2;c++){const X=c?R:L,x=dg>1.01?this.os[c].p(c,X[j],vtanh,dg,0):X[j];let s=0;for(let k=0;k<3;k++)s+=w[k]*this.b[k].p(c,x);X[j]=s*og*1.6;}}}
fx('vowel','Vowel','Filter','Talking filter. Morphs through A, E, I, O, U.',[
 ['vowel','Vowel',0,4,0,{tip:'0 is A, 1 is E, 2 is I, 3 is O, 4 is U. Sweep it for talking.'}],['shift','Formant shift',-1,1,0,{tip:'Moves all formants up or down by up to an octave. Child to giant.'}],
 ['res','Sharpness',0,1,.5,{tip:'Narrower formants sound more vocal and more nasal.'}],['drive','Drive',0,24,0,{u:' dB',tip:'Saturation before the formants for a growling voice.'}],['gain','Gain',-12,12,0,{u:' dB',tip:'Output level.'}]
],FxVowel,1);

/* ================= Filter FX (47 filter types) ================= */
class FxFilt{constructor(E){this.E=E;this.f=new VFilt();this.o=[0,0];}
  proc(L,R,n,P){const sr=this.E.sr,f=this.f;f.set(P('type'),P('cut'),P('res'),P('drive'),1,sr,P('shape'),P('dm'));const o=this.o;
    for(let i=0;i<n;i++){f.proc(L[i],R[i],o);L[i]=o[0];R[i]=o[1];}}}
fx('filt','Filter','Filter','All 47 filters from the synth, usable on any track or band.',[
 ['type','Type',0,FT.length-1,2,{list:FT.map(x=>x[0]),tip:'Filter type. See the Filter page of the synth for what each one does.'}],
 ['cut','Cutoff',20,20000,2000,{k:'exp',u:' Hz',tip:'Cutoff or centre frequency.'}],['res','Resonance',0,1,.3,{tip:'Emphasis at the cutoff. Some types ring or self oscillate.'}],
 ['drive','Drive',0,1,0,{tip:'Saturation in front of the filter.'}],['shape','Shape',0,1,.5,{tip:'Extra control used by some types: morph, damping, stage spread, gap.'}],
 ['dm','Drive mode',0,3,0,{list:LISTS.dmode,tip:'Warm, Clean, Hard or Fold saturation.'}]
],FxFilt,1);

/* ================= Chorus ================= */
class FxChorus{constructor(E){this.E=E;const m=Math.floor(E.sr*.06);this.d=[new Delay(m),new Delay(m)];this.ph=0;this.hp=new BiS();this.fbs=[0,0];}
  proc(L,R,n,P){const E=this.E,sr=E.sr,mode=P('mode'),nv=[1,3,2,1][mode],base=P('delay')*.001*sr,dep=P('depth'),fb=P('fb'),w=P('spread'),inc=rateOf(E,P)/sr;
    this.hp.set('hp',P('hp'),.7071,0,sr);let ph=this.ph;
    for(let i=0;i<n;i++){let oL=0,oR=0;
      for(let c=0;c<2;c++){const X=c?R:L,x=this.hp.p(c,X[i]);this.d[c].write(x+this.fbs[c]*fb);let s=0;
        for(let v=0;v<nv;v++){const p=(ph+v/nv+c*.5)%1,lf=mode===2?Math.sin(TAU*p)*.5+Math.sin(TAU*p*3.1)*.1:Math.sin(TAU*p),d=Math.max(1.5,base*(1+dep*.85*lf));s+=this.d[c].read(d-1);}
        s/=Math.sqrt(nv);this.fbs[c]=s;if(c)oR=s;else oL=s;}
      const m=(oL+oR)*.5,sd=(oL-oR)*.5*w*2;L[i]=m+sd;R[i]=m-sd;ph+=inc;if(ph>=1)ph-=1;}
    this.ph=ph;}}
fx('chorus','Chorus','Modulation','Four chorus modes: classic two voice, wide ensemble, dimension and vibrato.',[
 ['mode','Mode',0,0,0,{list:['Classic','Ensemble','Dimension','Vibrato'],tip:'Classic is two voices. Ensemble is six and lush. Dimension is subtle width. Vibrato is pitch wobble only: use 100% mix.'}],
 ['rate','Rate',.02,10,.6,{k:'exp',u:' Hz',tip:'Speed of the movement.'}],RSYNC,
 ['depth','Depth',0,1,.5,{tip:'Amount of pitch movement.'}],['delay','Delay',2,30,12,{u:' ms',tip:'Base delay. Longer sounds more like a doubler.'}],
 ['fb','Feedback',-.6,.6,0,{tip:'Feeds the chorus back into itself for a flanging edge.'}],['spread','Width',0,1,.8,{tip:'Stereo width of the effect.'}],['hp','Low cut',20,1000,120,{k:'exp',u:' Hz',tip:'Keeps the bass out of the chorus so it stays tight.'}]
],FxChorus,.5);

/* ================= Flanger ================= */
class FxFlanger{constructor(E){this.E=E;const m=Math.floor(E.sr*.02);this.d=[new Delay(m),new Delay(m)];this.ph=0;this.y=[0,0];}
  proc(L,R,n,P){const E=this.E,sr=E.sr,base=P('delay')*.001*sr,dep=P('depth'),fb=P('fb'),inc=rateOf(E,P)/sr,sp=P('spread')*.5;let ph=this.ph;
    for(let i=0;i<n;i++){for(let c=0;c<2;c++){const X=c?R:L,x=X[i],lf=.5-.5*Math.cos(TAU*((ph+c*sp)%1)),d=Math.max(1,base*(.2+1.6*dep*lf)+base*.1);
        this.d[c].write(x+Math.tanh(fb*this.y[c]));const y=this.d[c].read(d-1);this.y[c]=y;X[i]=y;}
      ph+=inc;if(ph>=1)ph-=1;}
    this.ph=ph;}}
fx('flanger','Flanger','Modulation','Short swept delay with feedback. Jet sweeps and metallic ringing.',[
 ['rate','Rate',.02,10,.25,{k:'exp',u:' Hz',tip:'Speed of the sweep.'}],RSYNC,['depth','Depth',0,1,.7,{tip:'Width of the sweep.'}],['delay','Delay',.2,10,2.5,{k:'exp',u:' ms',tip:'Centre of the sweep. Shorter is higher and tighter.'}],
 ['fb','Feedback',-.95,.95,.6,{tip:'Ringing. Negative values give a hollow sound.'}],['spread','Stereo',0,1,.5,{tip:'Offset of the left and right sweeps.'}]
],FxFlanger,.5);

/* ================= Phaser ================= */
class FxPhaser{constructor(E){this.E=E;this.x1=new Float64Array(24);this.y1=new Float64Array(24);this.a=new Float64Array(12);this.ph=0;this.fb=[0,0];}
  proc(L,R,n,P){const E=this.E,sr=E.sr,ns=[4,6,8,12][P('stages')],cf=P('freq'),dep=P('depth'),fbk=P('fb'),sp=P('spread'),inc=rateOf(E,P)/sr;let ph=this.ph;
    const A=this.a;
    for(let i=0;i<n;i++){
      if((i&15)===0){const lf=Math.sin(TAU*ph);for(let k=0;k<ns;k++){const f=clamp(cf*Math.pow(2,dep*2.2*lf)*(1+k*sp*.35),30,sr*.45),t=Math.tan(PI*f/sr);A[k]=(t-1)/(t+1);}}
      for(let c=0;c<2;c++){const X=c?R:L,o=c*12;let y=X[i]+fbk*this.fb[c];
        for(let k=0;k<ns;k++){const a=A[k],o2=o+k,out=a*y+this.x1[o2]-a*this.y1[o2];this.x1[o2]=y;this.y1[o2]=out;y=out;}
        this.fb[c]=Math.tanh(y);X[i]=y;}
      ph+=inc;if(ph>=1)ph-=1;}
    this.ph=ph;}}
fx('phaser','Phaser','Modulation','Swirling notches. Four to twelve stages with feedback.',[
 ['stages','Stages',0,0,1,{list:['4','6','8','12'],tip:'More stages give more notches and a deeper, wetter sweep.'}],['rate','Rate',.02,10,.3,{k:'exp',u:' Hz',tip:'Speed of the sweep.'}],RSYNC,
 ['freq','Center',100,8000,900,{k:'exp',u:' Hz',tip:'Middle of the sweep.'}],['depth','Depth',0,1,.6,{tip:'Width of the sweep in octaves.'}],['fb','Feedback',-.95,.95,.4,{tip:'Sharper notches. Negative values give a different tone.'}],['spread','Spread',0,1,.3,{tip:'Spreads the stage frequencies for a more complex sweep.'}]
],FxPhaser,.5);

/* ================= Tremolo / Autopan ================= */
class FxTrem{constructor(E){this.E=E;this.ph=0;}
  proc(L,R,n,P){const E=this.E,inc=rateOf(E,P)/E.sr,dep=P('depth'),sh=P('shape'),ap=P('mode'),st=P('stereo')*.5;let ph=this.ph;
    for(let i=0;i<n;i++){const a=wave4(sh,ph),b=wave4(sh,(ph+st)%1);
      if(ap===0){L[i]*=1-dep*.5*(1-a);R[i]*=1-dep*.5*(1-b);}
      else{const p=a*dep,gl=Math.cos((p*.5+.5)*PI/2)*1.414,gr=Math.sin((p*.5+.5)*PI/2)*1.414;L[i]*=gl;R[i]*=gr;}
      ph+=inc;if(ph>=1)ph-=1;}
    this.ph=ph;}}
fx('trem','Tremolo / Pan','Modulation','Volume wobble or auto panning.',[
 ['mode','Mode',0,0,0,{list:['Tremolo','Autopan'],tip:'Tremolo changes the volume. Autopan moves the sound left and right.'}],
 ['rate','Rate',.05,30,4,{k:'exp',u:' Hz',tip:'Speed.'}],RSYNC,['depth','Depth',0,1,.6,{tip:'Amount of movement.'}],['shape','Shape',0,3,0,{list:['Sine','Triangle','Square','Saw'],tip:'Shape of the movement.'}],['stereo','Stereo',0,1,0,{tip:'Offsets left from right. At full it is a ping-pong tremolo.'}]
],FxTrem,1);
