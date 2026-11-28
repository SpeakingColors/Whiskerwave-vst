/* Whiskerwave DSP core, part 1: utils, FFT, parameter registry, wavetables.
   Pure JS. Wrapped in WWMAKE(G) so the same source runs in the page, the AudioWorklet and node tests.
   Mockup engine: preview quality. The C++ plugin oversamples and uses ADAA on nonlinear stages. */
function WWMAKE(G){
'use strict';
const TAU=Math.PI*2, PI=Math.PI;
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const db2lin=d=>Math.pow(10,d/20), lin2db=x=>20*Math.log10(Math.max(x,1e-9));
const mtof=n=>440*Math.pow(2,(n-69)/12);
const lerp=(a,b,t)=>a+(b-a)*t;
G.util={clamp,db2lin,lin2db,mtof,lerp};

/* ---------- FFT (radix 2, in place, forward) ---------- */
function fft(re,im){
  const n=re.length;
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
  for(let len=2;len<=n;len<<=1){
    const ang=-TAU/len,wr=Math.cos(ang),wi=Math.sin(ang),h=len>>1;
    for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<h;k++){
      const a=i+k,b=a+h,xr=re[b]*cr-im[b]*ci,xi=re[b]*ci+im[b]*cr;
      re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi;
      const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t;}}
  }
}
function ifft(re,im){const n=re.length;fft(im,re);for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
G.fft=fft;G.ifft=ifft;

/* ---------- parameter registry ---------- */
const PR={};
function def(key,label,min,max,d,o){PR[key]=Object.assign({key,l:label,min,max,d,k:'lin',u:'',vo:false,tip:''},o||{});return PR[key];}
const toN=(key,v)=>{const p=PR[key];if(!p)return 0;
  if(p.k==='exp')return Math.log(Math.max(v,p.min)/p.min)/Math.log(p.max/p.min);
  return (v-p.min)/((p.max-p.min)||1);};
const fromN=(key,n)=>{const p=PR[key];n=clamp(n,0,1);
  if(p.k==='exp')return p.min*Math.pow(p.max/p.min,n);
  const v=p.min+n*(p.max-p.min);
  return (p.k==='int'||p.k==='list')?Math.round(v):v;};
G.PR=PR;G.toN=toN;G.fromN=fromN;G.def=def;

const LISTS={
 eng:['Wavetable','Sample','Granular'],
 warp:['Off','Sync','Bend +','Bend -','Bend +/-','PWM','Mirror','Asym','Quantize','Fold','Clip','Crush','Flip'],
 ustyle:['Classic','Supersaw','JP Super','Octaves','Power','Minor'],
 rt:['Dry','F1','F2','F1+F2'],
 msrc:['A','B','C','Sub','D','E','F'],
 mmode:['None','FM','AM','Ring'],
 ftype:['Off','LP 12','LP 24 Ladder','LP 18 Acid','HP 12','HP 24','BP','Notch','Peak','Comb +','Comb -','Formant','Phaser'],
 frt:['Serial','Parallel'],
 lshape:['Sine','Triangle','Saw Up','Saw Down','Square','S&H','Smooth Rnd','Custom','Rnd Steps 4','Rnd Steps 8','Rnd Slew','Rnd Walk','Rnd Noise','Rnd Gate','Rnd Ramp'],
 lmode:['Retrigger','Free (global)'],
 sync:['Hz','1/1','1/2','1/4','1/8','1/16','1/32','1/4T','1/8T','1/16T','1/4.','1/8.','1/16.'],
 vmode:['Poly','Mono','Legato'],
 subw:['Sine','Triangle','Square','Saw','Pulse','Half Sine','Soft Square','Organ','Parabola'],
 nzt:['White','Pink','Brown','Crackle','Blue','Violet','Dust','Sample and Hold','Vinyl','Wind'],
 arpm:['Up','Down','Up/Down','Random','As Played','Chord'],
 arpr:['1/4','1/8','1/16','1/32','1/8T','1/16T'],
 dest:['Master','Aux 1','Aux 2'],
 tdest:['Master','FX 1','FX 2','Track B','Track C','Sub/Noise'],xdest:['FX Out','Into FX 2'],
};
G.LISTS=LISTS;
const SYNCDIV=[0,4,2,1,.5,.25,.125,4/3,2/3,1/3,6,3,1.5]; // beats per cycle for sync list (index 1 = 4 beats)
SYNCDIV[1]=4;SYNCDIV[2]=2;SYNCDIV[3]=1;SYNCDIV[4]=.5;SYNCDIV[5]=.25;SYNCDIV[6]=.125;SYNCDIV[7]=2/3;SYNCDIV[8]=1/3;SYNCDIV[9]=1/6;SYNCDIV[10]=1.5;SYNCDIV[11]=.75;SYNCDIV[12]=.375;
G.SYNCDIV=SYNCDIV;

// global
def('master','Master',-60,6,-6,{u:' dB',tip:'Master output level before the limiter.'});
def('poly','Voices',1,32,16,{k:'int',tip:'Maximum number of notes playing at once, up to 32. Releasing notes are stolen first. More voices use more CPU only while they are playing.'});
def('vmode','Voice mode',0,2,0,{k:'list',list:'vmode',tip:'Poly plays chords. Mono plays one note with retrigger. Legato glides without retriggering envelopes.'});
def('glide','Glide',0,2000,0,{u:' ms',tip:'Portamento time between notes.',vo:true});
def('bendr','Bend range',0,24,2,{k:'int',u:' st',tip:'Pitch wheel range in semitones.'});
def('bpm','Tempo',40,220,140,{k:'int',u:' BPM',tip:'Tempo for synced LFOs, arp and delays. In the plugin it follows the host.'});
def('vel','Velocity',0,1,.6,{tip:'How much key velocity changes the volume.'});
def('lim','Limiter',0,1,1,{k:'int',tip:'Safety limiter on the output (on or off).'});
def('ceil','Ceiling',-12,0,-0.3,{u:' dB',tip:'Output limiter ceiling.'});
// oscillators A B C
for(const o of ['a','b','c','d','e','f']){
  const nm=o.toUpperCase();
  def(o+'.on','OSC '+nm,0,1,o==='a'?1:0,{k:'int',tip:'Turn this oscillator on or off.'});
  def(o+'.eng','Engine',0,2,0,{k:'list',list:'eng',tip:'Wavetable plays a morphing wavetable. Sample plays a loaded sound across the keys. Granular plays grains from the loaded sound.'});
  def(o+'.pos','Wave Position',0,1,0,{vo:true,tip:'Scans through the frames of the wavetable. Modulate it for movement.'});
  def(o+'.w1','Warp 1',0,12,0,{k:'list',list:'warp',tip:'First warp mode. Reshapes the wave in time.'});
  def(o+'.w1a','Warp 1 amt',0,1,0,{vo:true,tip:'Amount of warp 1.'});
  def(o+'.w2','Warp 2',0,12,0,{k:'list',list:'warp',tip:'Second warp mode, applied after warp 1.'});
  def(o+'.w2a','Warp 2 amt',0,1,0,{vo:true,tip:'Amount of warp 2.'});
  def(o+'.sw','Spectral',-1,1,0,{tip:'Spectral warp of the whole table: negative stretches harmonics, positive shifts them. Static knob in this mockup.'});
  def(o+'.sk','Smear',0,1,0,{tip:'Spectral smear: blurs the harmonics together for a vocal, metallic or washed sound. Static knob in this mockup.'});
  def(o+'.oct','Octave',-4,4,0,{k:'int',tip:'Octave shift.'});
  def(o+'.semi','Semi',-48,48,0,{k:'int',tip:'Pitch shift in semitones, 0 in the centre, up to 4 octaves up or down. The < and > buttons next to it move by a whole octave; Ctrl, Cmd or Alt while dragging or scrolling the knob does the same.'});
  def(o+'.fine','Fine',-100,100,0,{u:' ct',vo:true,tip:'Fine tune in cents.'});
  def(o+'.lvl','Level',0,1,o==='a'?.75:.6,{vo:true,tip:'Oscillator level.'});
  def(o+'.pan','Pan',-1,1,0,{vo:true,tip:'Oscillator pan.'});
  def(o+'.ph','Phase',0,1,0,{tip:'Start phase.'});
  def(o+'.rnd','Rand',0,1,1,{tip:'Random start phase. 0 gives the same attack every note.'});
  def(o+'.uv','Unison',1,8,1,{k:'int',tip:'Number of stacked voices per note.'});
  def(o+'.ud','Detune',0,1,.25,{vo:true,tip:'Unison detune. The curve is slow at first and steep at the end.'});
  def(o+'.us','Style',0,5,0,{k:'list',list:'ustyle',tip:'Classic spreads evenly. Supersaw uses a centre voice plus detuned sides. Octaves, Power and Minor stack intervals. JP Super follows the measured JP-8000 curves: narrow detune until near the top, Blend trades the centre against the sides, and a high-pass at the note removes low rumble. Best with 7 voices.'});
  def(o+'.ub','Blend',0,1,.5,{vo:true,tip:'Centre voice against side voices.'});
  def(o+'.usp','Spread',0,1,.7,{vo:true,tip:'Stereo spread of the unison voices.'});
  def(o+'.anl','Analog',0,1,0,{tip:'Analog life for this oscillator. Each voice and unison voice gets a tiny fixed pitch offset plus a slow drift, like a real analog poly; filter cutoff and envelope times of the voice get a small spread too (the highest Analog of the playing oscillators sets that part). Chords and unison breathe and sound wider and warmer. At 100%: about 5 cents fixed, 3 cents drift, 3% cutoff, 5% envelope times. 0% is exact and digital.'});
  def(o+'.mm','Mod',0,3,0,{k:'list',list:'mmode',tip:'Let another oscillator modulate this one: FM, AM or ring.'});
  def(o+'.ms','Source',0,6,o==='a'?1:0,{k:'list',list:'msrc',tip:'Which oscillator is the modulator.'});
  def(o+'.ma','Mod amt',0,1,0,{vo:true,tip:'Amount of FM, AM or ring modulation.'});
  def(o+'.dv','Dive',-24,24,0,{u:' st',tip:'Pitch dive at note start. The note starts this far off and falls into tune. Used for hoover sounds.'});
  def(o+'.dt','Dive time',5,2000,120,{k:'exp',u:' ms',tip:'How long the dive takes.'});
  def(o+'.fb','Feedback',0,1,0,{vo:true,tip:'Feeds the oscillator output back into its own phase. Adds screech and growl.'});
  def(o+'.rt','Route',0,3,o==='a'?1:1,{k:'list',list:'rt',tip:'Send this oscillator to filter 1, filter 2, both or neither (dry).'});
  def(o+'.sroot','Root',24,96,60,{k:'int',tip:'Root key of the loaded sample.'});
  def(o+'.sloop','Loop',0,1,1,{k:'int',tip:'Loop the sample while the key is held.'});
  def(o+'.gp','Grain pos',0,1,0,{vo:true,tip:'Where in the sample the grains are read.'});
  def(o+'.gs','Grain size',5,500,80,{k:'exp',u:' ms',tip:'Length of each grain.'});
  def(o+'.gd','Density',1,60,16,{k:'exp',u:' /s',tip:'Grains per second.'});
  def(o+'.gj','Jitter',0,1,.2,{tip:'Random position spread of grains.'});
}
// sub and noise
def('s.sub','Sub',0,1,0,{k:'int',tip:'Turn the sub oscillator on or off.'});
def('s.sw','Sub wave',0,8,0,{k:'list',list:'subw',tip:'Sub oscillator waveform.'});
def('s.so','Sub oct',-4,1,-1,{k:'int',tip:'Sub octave below the key.'});
def('s.sl','Sub level',0,1,.5,{vo:true,tip:'Sub oscillator level.'});
def('s.nz','Noise',0,1,0,{k:'int',tip:'Turn the noise generator on or off.'});
def('s.nt','Noise type',0,9,0,{k:'list',list:'nzt',tip:'Ten noise colours and textures: white, pink, brown, crackle, blue, violet, dust, sample and hold, vinyl and wind.'});
def('s.nl','Noise level',0,1,.3,{vo:true,tip:'Noise level.'});
def('s.pk','Punch',0,1,0,{tip:'Short click at the start of each note.'});
def('s.rt','Route',0,3,0,{k:'list',list:'rt',tip:'Send sub and noise to filter 1, filter 2, both or neither.'});

def('s.sfn','Sub fine',-100,100,0,{u:' ct',vo:true,tip:'Fine tune of the sub in cents.'});
def('s.spn','Sub pan',-1,1,0,{vo:true,tip:'Sub position left or right.'});
def('s.sph','Sub phase',0,1,0,{vo:true,tip:'Start phase offset of the sub wave.'});
def('s.spw','Sub PW',.05,.95,.5,{vo:true,tip:'Pulse width, used by the Pulse wave.'});
def('s.sth','Sub thick',0,1,0,{vo:true,tip:'Adds two slightly detuned copies of the sub, one left and one right, for a wide fat low end. Keep it low for a clean mono sub.'});
def('s.sfm','Sub FM A',0,1,0,{vo:true,tip:'Oscillator A frequency-modulates the sub for growl and metallic lows.'});
def('s.sdr','Sub drive',0,1,0,{vo:true,tip:'Soft saturation adds harmonics so the sub is heard on small speakers.'});
def('s.skt','Key track',0,1,1,{k:'int',tip:'On: the sub follows the keyboard. Off: the sub stays at the fixed frequency.'});
def('s.sfh','Fixed Hz',20,200,55,{k:'exp',u:' Hz',vo:true,tip:'Sub frequency when key track is off.'});
def('s.srs','Retrig',0,1,0,{k:'int',tip:'On: the sub wave restarts at every note so every hit has the same punch.'});
def('s.srt','Sub route',0,3,0,{k:'list',list:'rt',tip:'Send the sub to filter 1, filter 2, both or neither.'});
def('s.npn','Noise pan',-1,1,0,{vo:true,tip:'Noise position left or right.'});
def('s.nw','Noise width',0,1,0,{vo:true,tip:'0 is mono noise. Higher values use different noise in each ear for a wide wash.'});
def('s.nhp','Noise HP',20,20000,20,{k:'exp',u:' Hz',vo:true,tip:'High-pass: removes low rumble from the noise.'});
def('s.nlp','Noise LP',20,20000,20000,{k:'exp',u:' Hz',vo:true,tip:'Low-pass: darkens the noise.'});
def('s.ntn','Noise tone',0,1,0,{vo:true,tip:'Turns the noise into a pitched whistle that follows the key, like breath or wind over a bottle.'});
def('s.nd','Density',0,1,.25,{vo:true,tip:'How many crackles, dust specks or pops per second.'});
def('s.nr','S&H rate',50,20000,4000,{k:'exp',u:' Hz',vo:true,tip:'Step rate of the Sample and Hold noise.'});
// filters
for(const f of ['f1','f2']){
  const n=f==='f1'?1:2;
  def(f+'.type','Filter '+n,0,12,f==='f1'?2:0,{k:'list',list:'ftype',tip:'Filter '+n+' type.'});
  def(f+'.cut','Cutoff',20,20000,f==='f1'?9000:12000,{k:'exp',u:' Hz',vo:true,tip:'Cutoff frequency (or comb pitch, formant vowel position).'});
  def(f+'.res','Reso',0,1,.2,{vo:true,tip:'Resonance. Ladder and acid types can self oscillate near the top.'});
  def(f+'.drv','Drive',0,1,0,{vo:true,tip:'Filter drive. Level is compensated so louder does not fool you.'});
  def(f+'.kt','Key track',-1,1,.25,{tip:'How much the cutoff follows the key. 100% follows exactly. Higher opens the filter more on high notes.'});
  def(f+'.env','Env amt',-1,1,0,{vo:true,tip:'How far the chosen envelope opens the cutoff, up to 5 octaves.'});
  def(f+'.es','Envelope',0,16,2,{k:'list',list:'fenvsel',tip:'Which envelope moves this filter. None means no envelope on this filter. Pick Env 1 to 16 to attach one; edit it in the envelope bank.'});
  def(f+'.mix','Mix',0,1,1,{vo:true,tip:'Dry and filtered mix.'});
}
def('frt','Routing',0,1,0,{k:'list',list:'frt',tip:'Serial runs filter 1 into filter 2. Parallel runs both and adds them.'});
// envelopes
for(let i=1;i<=16;i++){
  const d=[[2,0,400,.7,180],[2,0,550,.35,200],[5,0,300,0,300],[2,0,120,0,100],[3,0,350,.5,300],[3,0,250,0,250],[40,0,600,.6,500],[1,0,80,0,80]][i-1]||[5,0,300,0,300];
  def('e'+i+'.a','Attack',0.5,10000,d[0],{k:'exp',u:' ms',tip:'Envelope '+i+' attack time.'});
  def('e'+i+'.h','Hold',0,2000,d[1],{u:' ms',tip:'Hold time at the peak.'});
  def('e'+i+'.d','Decay',1,10000,d[2],{k:'exp',u:' ms',tip:'Decay time.'});
  def('e'+i+'.s','Sustain',0,1,d[3],{tip:'Sustain level.'});
  def('e'+i+'.r','Release',1,15000,d[4],{k:'exp',u:' ms',tip:'Release time.'});
  def('e'+i+'.c','Curve',-1,1,-0.4,{tip:'Bends decay and release: negative is exponential, positive is bowed out.'});
}
// LFOs
for(let i=1;i<=4;i++){
  def('l'+i+'.shape','Shape',0,14,0,{k:'list',list:'lshape',tip:'LFO '+i+' shape. The Rnd shapes are random: steps hold a new random value, Slew glides between random values, Walk drifts, Noise is fast random, Gate jumps between high and low, Ramp picks a random slope each cycle.'});
  def('l'+i+'.rate','Rate',0.02,40,[4,1,.3,6][i-1],{k:'exp',u:' Hz',tip:'LFO '+i+' rate in Hz.'});
  def('l'+i+'.sync','Sync',0,12,0,{k:'list',list:'sync',tip:'Tempo sync. Hz means free rate.'});
  def('l'+i+'.ph','Phase',0,1,0,{tip:'Start phase.'});
  def('l'+i+'.fade','Fade in',0,3000,0,{u:' ms',tip:'Time for the LFO to fade in after a note starts.'});
  def('l'+i+'.mode','Mode',0,1,0,{k:'list',list:'lmode',tip:'Retrigger restarts per note. Free is one global LFO, which can also move FX.'});
  def('l'+i+'.sm','Smooth',0,1,0,{tip:'Smooths the LFO output.'});
}
for(let i=1;i<=8;i++)def('m'+i,'Macro '+i,0,1,0,{vo:true,tip:'Macro '+i+': a fast control. Drag its circle onto any knobs, then turn this one knob to move them all.'});
// arp
def('arp.on','Arp',0,1,0,{k:'int',tip:'Turn the arpeggiator on or off.'});
def('arp.mode','Mode',0,5,0,{k:'list',list:'arpm',tip:'Arp note order.'});
def('arp.rate','Rate',0,5,2,{k:'list',list:'arpr',tip:'Arp step length.'});
def('arp.oct','Octaves',1,4,1,{k:'int',tip:'Octave range.'});
def('arp.gate','Gate',0.05,1,.6,{tip:'Note length inside the step.'});
def('arp.swing','Swing',0,.5,0,{tip:'Delays every second step.'});
def('arp.hold','Hold',0,1,0,{k:'int',tip:'Keep playing after keys are released.'});
// mixer buses
for(const b of ['t0','t1','t2','t3','x1','x2','fx','mst']){
  const nm={t0:'OSC A',t1:'OSC B',t2:'OSC C',t3:'Sub/Noise',x1:'FX 1',x2:'FX 2',fx:'FX Out',mst:'Master'}[b];
  def('bus.'+b+'.vol',nm+' vol',-60,6,0,{u:' dB',tip:'Level of '+nm+'.'});
  def('bus.'+b+'.pan',nm+' pan',-1,1,0,{tip:'Pan of '+nm+'.'});
  if(b[0]==='t'){
    def('bus.'+b+'.s1','Send 1',0,1,0,{tip:'Send to FX 1.'});
    def('bus.'+b+'.s2','Send 2',0,1,0,{tip:'Send to FX 2.'});
    def('bus.'+b+'.dest','Output',0,5,0,{k:'list',list:'tdest',tip:'Where this track goes: master, an FX bus, or into a later track.'});
  }
  if(b==='x1')def('bus.x1.dest','Output',0,1,0,{k:'list',list:'xdest',tip:'Where FX 1 goes: FX Out (then master) or into FX 2, so FX 2 can process FX 1.'});
}
G.SYNCDIV=SYNCDIV;

/* ---------- wavetable ---------- */
const N=2048;
class WT{
  constructor(name,cat,frames){this.name=name;this.cat=cat;this.src=frames;this.nf=frames.length;this.lv=null;this.sw=0;this.sk=0;}
  spectra(){ // forward FFT of every frame, cached
    if(this._sp)return this._sp;
    const sp=[];for(const fr of this.src){const re=new Float64Array(N),im=new Float64Array(N);for(let i=0;i<N;i++)re[i]=fr[i];fft(re,im);sp.push([re,im]);}
    return this._sp=sp;}
  build(sw,sk){
    sw=sw||0;sk=sk||0;this.sw=sw;this.sk=sk;
    const sp=this.spectra(),H=N/2,lv=[];
    // spectral warp: stretch (<0) or shift (>0) harmonics; smear blurs magnitudes
    const warped=sp.map(([re,im])=>{
      if(!sw&&!sk)return [re,im];
      const r2=new Float64Array(N),i2=new Float64Array(N);
      for(let k=1;k<H;k++){
        let src;
        if(sw<0)src=k*(1+sw*0.9); else src=k-sw*24;
        if(src<1||src>=H-1)continue;
        const a=Math.floor(src),f=src-a;
        r2[k]=re[a]*(1-f)+re[a+1]*f;i2[k]=im[a]*(1-f)+im[a+1]*f;}
      if(sk>0){const w=Math.max(1,Math.round(sk*5));
        for(let k=1;k<H;k++){let sr=0,si=0,c=0;for(let j=-w;j<=w;j++){const q=k+j;if(q<1||q>=H)continue;sr+=r2[q];si+=i2[q];c++;}
          r2[k]=r2[k]*(1-sk)+sk*sr/c;i2[k]=i2[k]*(1-sk)+sk*si/c;}}
      for(let k=1;k<H;k++){r2[N-k]=r2[k];i2[N-k]=-i2[k];}
      return [r2,i2];});
    for(let m=0;m<11;m++){
      const maxH=Math.max(1,H>>m),fr=[],taper=this.cat==='FM'||this.cat==='Bell',t0=Math.floor(maxH*.7);
      for(let f=0;f<this.nf;f++){
        const [re,im]=warped[f],r=new Float64Array(N),i=new Float64Array(N);
        for(let k=1;k<=maxH&&k<H;k++){const g=taper&&m>0&&k>t0?.5+.5*Math.cos(Math.PI*(k-t0)/(maxH+1-t0)):1;r[k]=re[k]*g;i[k]=im[k]*g;r[N-k]=re[N-k]*g;i[N-k]=im[N-k]*g;}
        ifft(r,i);const o=new Float32Array(N+1);for(let j=0;j<N;j++)o[j]=r[j];o[N]=o[0];fr.push(o);}
      lv.push(fr);}
    this.lv=lv;return this;}
}
G.WT=WT;

/* ---------- table recipes (our own formulas) ---------- */
const NF=32;
function norm(fr){let m=0;for(let i=0;i<N;i++){const a=Math.abs(fr[i]);if(a>m)m=a;}if(m>0)for(let i=0;i<N;i++)fr[i]/=m;return fr;}
function dcrm(fr){let s=0;for(let i=0;i<N;i++)s+=fr[i];s/=N;for(let i=0;i<N;i++)fr[i]-=s;return fr;}
function add(fn,H){ // additive frame: amplitude of harmonic k via fn(k)
  const fr=new Float64Array(N);const hh=H||256;
  for(let k=1;k<=hh;k++){const a=fn(k);if(!a)continue;const w=TAU*k/N;for(let i=0;i<N;i++)fr[i]+=a*Math.sin(w*i);}
  return fr;}
function td(fn){const fr=new Float64Array(N);for(let i=0;i<N;i++)fr[i]=fn(i/N);return fr;}
const saw=x=>{let s=0;for(let k=1;k<=60;k++)s+=Math.sin(TAU*k*x)/k;return s*.62;};
const FORM={a:[800,1150,2900],e:[400,1600,2700],i:[270,2140,2950],o:[450,830,2830],u:[325,700,2530]};
function vowelFrame(f1,f2,f3,f0){ // harmonic amplitudes shaped by 3 formants for a fundamental of f0 Hz
  return add(k=>{const f=k*f0;let a=0;for(const [fc,g] of [[f1,1],[f2,.6],[f3,.35]]){a+=g/(1+Math.pow((f-fc)/(fc*.12+60),2));}return a/k*.9;},120);}
const RECIPES=[
 ['Sine to Saw','Basic',t=>{const c=Math.pow(1024,t)-1;return norm(add(k=>k===1?1:c<=0?0:(1/k)/Math.sqrt(1+Math.pow((k-1)/c,4))));}], // frame 1 pure sine, harmonics fade in from the bottom, last frame a saw
 ['Soft to Buzz','Basic',t=>norm(add(k=>Math.pow(1/k,2-1.9*t)))], // the old Sine to Saw (before v1.7.7), kept so older saves sound the same
 ['Saw to Square','Basic',t=>norm(add(k=>(k%2?1/k:(1-t)/k)))],
 ['Pulse Sweep','Basic',t=>{const w=.5-t*.45;return norm(dcrm(td(x=>(x<w?1:-1))));}],
 ['Triangle to Saw','Basic',t=>norm(add(k=>(k%2?1/(k*k):0)*(1-t)+t/k))],
 ['Harmonic Stack','Additive',t=>norm(add(k=>k<=1+Math.round(t*30)?1/Math.sqrt(k):0))],
 ['Odd Grow','Additive',t=>norm(add(k=>k%2&&k<=1+Math.round(t*40)?1/k:0))],
 ['Even Only','Additive',t=>norm(add(k=>k===1?1-t*.7:(k%2===0?t*.9/k:0)))],
 ['Organ Drawbars','Additive',t=>norm(add(k=>[1,2,3,4,6,8].indexOf(k)>=0?(.4+.6*Math.sin(PI*(t+[1,2,3,4,6,8].indexOf(k)*.17)))**2:0))],
 ['Spectral Tilt','Additive',t=>norm(add(k=>k<=2+t*70?1/k:Math.exp(-(k-2-t*70)/3)/k))],
 ['Comb Sweep','Additive',t=>norm(add(k=>{const p=2+t*14;return (1/k)*(.2+.8*Math.pow(Math.sin(PI*k/p),2));}))],
 ['Vowel Choir','Vocal',t=>{const v=['a','e','i','o','u'],p=t*4,i0=Math.floor(Math.min(p,3.999)),f=p-i0,A=FORM[v[i0]],B=FORM[v[i0+1]];
   return norm(vowelFrame(lerp(A[0],B[0],f),lerp(A[1],B[1],f),lerp(A[2],B[2],f),110));}],
 ['Formant Sweep','Vocal',t=>norm(vowelFrame(300+t*600,900+t*1700,2500+t*500,110))],
 ['Throat','Vocal',t=>norm(vowelFrame(500,1000+t*800,2400,90))],
 ['FM Bell 1:3','FM',t=>norm(td(x=>Math.sin(TAU*x+t*7*Math.sin(TAU*3*x))))],
 ['FM Growl 1:2','FM',t=>norm(td(x=>Math.sin(TAU*x+t*9*Math.sin(TAU*2*x)+t*3*Math.sin(TAU*x))))],
 ['FM EP 1:1','FM',t=>norm(td(x=>Math.sin(TAU*x+t*4*Math.sin(TAU*x))))],
 ['FM Metal 1:7','FM',t=>norm(td(x=>Math.sin(TAU*x+t*5*Math.sin(TAU*7*x))))],
 ['FM Ratio Walk','FM',t=>norm(td(x=>Math.sin(TAU*x+4*Math.sin(TAU*(1+Math.round(t*7))*x))))],
 ['Fold Soft','Distort',t=>norm(td(x=>Math.sin((1+t*5)*Math.sin(TAU*x))))],
 ['Fold Hard','Distort',t=>norm(td(x=>{let y=Math.sin(TAU*x)*(1+t*8);while(Math.abs(y)>1)y=y>1?2-y:-2-y;return y;}))],
 ['Drive Stack','Distort',t=>norm(td(x=>Math.tanh((1+t*14)*saw(x)*1.6)))],
 ['Rectify','Distort',t=>norm(dcrm(td(x=>{const s=Math.sin(TAU*x);return lerp(s,Math.abs(s)*2-1,t);})))],
 ['Bit Crunch','Digital',t=>{const q=2+Math.round((1-t)*30);return norm(td(x=>Math.round(saw(x)*q)/q));}],
 ['Digital Steps','Digital',t=>{const st=Math.max(2,Math.round(64-t*58));return norm(td(x=>Math.sin(TAU*Math.floor(x*st)/st)));}],
 ['Sync Sweep','Sync',t=>{const r=1+t*7;return norm(dcrm(td(x=>saw((x*r)%1))));}],
 ['Screech','Sync',t=>{const r=1.5+t*5;return norm(dcrm(td(x=>Math.tanh(2.2*saw((x*r)%1)+Math.sin(TAU*x)*.6))));}],
 ['Hardstyle Screech','Hard Dance',t=>{const r=2+t*4;return norm(dcrm(td(x=>{const s=saw((x*r)%1);return Math.sin(TAU*x*(1+t))*.5+Math.tanh(3*s)*.8;})));}],
 ['Hoover PWM','Hard Dance',t=>norm(dcrm(td(x=>saw(x)-saw((x+.1+t*.75)%1))))],
 ['Reese Base','Hard Dance',t=>norm(td(x=>saw(x)+saw((x*(1+.012+t*.02))%1)+saw((x*(1-.012-t*.02)+1)%1)))],
 ['Trance Pluck','Hard Dance',t=>norm(add(k=>Math.exp(-k*(.5-t*.45))/k))],
 ['Brass Swell','Analog',t=>norm(add(k=>Math.pow(1/k,1.1)*Math.exp(-Math.pow(k/(3+t*22),2))))],
 ['Reed','Analog',t=>norm(add(k=>(k%2?1:.3+t*.5)/k))],
 ['Glass Bell','Bell',t=>norm(add(k=>[1,3,5,7,9,11,13].indexOf(k)>=0?Math.exp(-k*(.18-.15*t)):0))],
 ['Wide Saw Stack','Hard Dance',t=>norm(td(x=>{let s=0;for(let j=-3;j<=3;j++)s+=saw((x*(1+j*(.003+t*.01))+j*.13)%1);return s;}))],
 ['Ring Pair','Digital',t=>norm(td(x=>Math.sin(TAU*x)*Math.sin(TAU*x*(1+Math.round(t*9))*1.0)))],
 ['Noise Bands','Digital',t=>{let seed=7;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-.5;};const ph=[];for(let k=0;k<256;k++)ph.push(r()*TAU);const w=1+t*40;return norm(add(k=>Math.exp(-k/w)*(.6+.4*Math.sin(k*1.7)),256).map((_,i)=>0)&&td(x=>{let s=0;for(let k=1;k<200;k++)s+=Math.exp(-k/w)*Math.sin(TAU*k*x+ph[k]);return s;}));}],
 ['Wobble Harmonics','Movement',t=>norm(add(k=>(1/k)*(.4+.6*Math.pow(Math.sin(PI*(k*.11+t*2)),2))))],
 ['Sub Heavy','Bass',t=>norm(add(k=>k===1?1:k===2?t*.7:k===3?t*.4:0))],
 ['Growl Bass','Bass',t=>norm(td(x=>Math.tanh((1+t*7)*(Math.sin(TAU*x)+.6*Math.sin(TAU*2*x+t*3)))))],
 ['Basic Shapes Morph','Basic',t=>{const sq=td(x=>x<.5?1:-1),tr=td(x=>1-4*Math.abs(x-.5)),sw=td(x=>2*x-1),sn=td(x=>Math.sin(TAU*x));const A=[sn,tr,sq,sw],p=t*3,i=Math.min(2,Math.floor(p)),f=p-i;return norm(td(()=>0).map((_,j)=>lerp(A[i][j],A[i+1][j],f)));}],
];
G.RECIPES=RECIPES;
G.recipeNames=()=>RECIPES.map(r=>({name:r[0],cat:r[1]}));
G.makeTable=function(name,nf){
  const r=RECIPES.find(x=>x[0]===name);if(!r)return null;
  const frames=[];nf=nf||NF;for(let f=0;f<nf;f++)frames.push(r[2](f/(nf-1)));
  return new WT(name,r[1],frames);};
G.WTfromFrames=function(name,cat,frames2048){return new WT(name,cat,frames2048);};
/* frame splitting for imports: Float32Array samples -> frames of length fl, resampled to 2048 */
G.splitFrames=function(data,fl){
  const nf=Math.max(1,Math.min(256,Math.floor(data.length/fl))),frames=[];
  for(let f=0;f<nf;f++){const fr=new Float64Array(N);for(let i=0;i<N;i++){const p=i/N*fl,a=Math.floor(p),b=(a+1)%fl,fq=p-a;fr[i]=data[f*fl+a]*(1-fq)+data[f*fl+b]*fq;}frames.push(dcrm(norm(fr)));}
  return frames;};
/* text to wave: each letter becomes a frame from vowel formants or a noise band (offline, our own) */
G.textFrames=function(text){
  const frames=[];const s=(text||'meow').toLowerCase().replace(/[^a-z]/g,'');
  for(const ch of (s||'meow')){
    let fr;
    if(FORM[ch]){const F=FORM[ch];fr=vowelFrame(F[0],F[1],F[2],110);}
    else{const c=ch.charCodeAt(0)-97,fc=500+c*180,bw=200+(c%5)*120;let seed=c*977+13;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
      const ph=[];for(let k=0;k<200;k++)ph.push(r()*TAU);
      fr=td(x=>{let a=0;for(let k=1;k<150;k++){const f=k*110;a+=Math.sin(TAU*k*x+ph[k])*Math.exp(-Math.pow((f-fc)/bw,2))/Math.sqrt(k);}return a;});}
    frames.push(dcrm(norm(fr)));}
  while(frames.length<4){frames.push(frames[frames.length-1]);}
  return frames;};
/* image to wave: columns are frames, rows are harmonics (brightness = amplitude) */
G.imageFrames=function(px,w,h){ // px: Uint8ClampedArray RGBA
  const nf=Math.min(w,64),frames=[];
  for(let f=0;f<nf;f++){const cx=Math.floor(f/(nf-1||1)*(w-1));
    const fr=add(k=>{const y=Math.floor((1-Math.min(k,128)/128)*(h-1));const o=(y*w+cx)*4;const v=(px[o]+px[o+1]+px[o+2])/765;return v*v/Math.sqrt(k);},128);
    frames.push(dcrm(norm(fr)));}
  return frames;};
/* morph two tables: linear spectral magnitude interpolation per frame position */
G.morphFrames=function(A,B,nf){
  const sa=A.spectra(),sb=B.spectra(),out=[];nf=nf||32;
  for(let f=0;f<nf;f++){const t=f/(nf-1),ia=Math.round(t*(A.nf-1)),ib=Math.round(t*(B.nf-1));
    const re=new Float64Array(N),im=new Float64Array(N);
    for(let k=1;k<N/2;k++){
      const ma=Math.hypot(sa[ia][0][k],sa[ia][1][k]),mb=Math.hypot(sb[ib][0][k],sb[ib][1][k]);
      const pa=Math.atan2(sa[ia][1][k],sa[ia][0][k]),pb=Math.atan2(sb[ib][1][k],sb[ib][0][k]);
      const m=ma*(1-t)+mb*t,p=t<.5?pa:pb;
      re[k]=m*Math.cos(p);im[k]=m*Math.sin(p);re[N-k]=re[k];im[N-k]=-im[k];}
    ifft(re,im);out.push(dcrm(norm(re)));}
  return out;};
G.N=N;G.norm=norm;G.dcrm=dcrm;
