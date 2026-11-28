const JPOFF=[-0.11002313,-0.06288439,-0.01952356,0.01991221,0.06216538,0.10745242];
const JPC=[10028.7312891634,-50818.8652045924,111363.4808729368,-138150.6761080548,106649.6679158292,-53046.9642751875,17019.9518580080,-3425.0836591318,404.2703938388,-24.1878824391,0.6717417634,0.0030115596];
function jpCurve(x){let y=0;for(const c of JPC)y=y*x+c;return Math.max(0,y);}
function jpCen(m){return -0.55366*m+0.99785;}function jpSide(m){return -0.73764*m*m+1.2841*m+0.044372;}
const SQ2=Math.SQRT2;
/* part 2: modulation sources, filters, voice */
const BLK=32;
G.BLK=BLK;
// extra params: pitch mod, attack curve, per-source envelopes, draw envelopes
const OSK='abcdef',SLOT=[0,1,2,5,6,7],MSL=[0,1,2,3,5,6,7],TKOF=[0,1,2,3,3,0,1,2];
for(const o of OSK)def(o+'.pit','Pitch',-48,48,0,{u:' st',vo:true,tip:'Pitch offset in semitones. Modulate it with an envelope for pitch drops and bends.'});
for(const x of ['a','b','c','sub','nz','d','e','f']){
  const nm={a:'OSC A',b:'OSC B',c:'OSC C',sub:'Sub',nz:'Noise',d:'OSC D',e:'OSC E',f:'OSC F'}[x];
  def(x+'.ea','Attack',0.5,10000,0.5,{k:'exp',u:' ms',vo:true,tip:nm+' own envelope attack.'});
  def(x+'.ed','Decay',1,10000,10000,{k:'exp',u:' ms',vo:true,tip:nm+' own envelope decay.'});
  def(x+'.es','Sustain',0,1,1,{vo:true,tip:nm+' own envelope sustain.'});
  def(x+'.er','Release',1,15000,15000,{k:'exp',u:' ms',vo:true,tip:nm+' own envelope release.'});
  def(x+'.env','Envelope',0,15,0,{k:'list',list:'envsel',tip:'Which envelope shapes the volume of '+nm+'. Env 1 is the main amp envelope. Pick another to give this source its own attack and tail, then edit it in the envelope bank.'});
  def(x+'.eo','Own env',0,1,0,{k:'int',tip:'On: this source ignores envelope 1 and uses its own envelope, so it can have a different attack and tail than the rest.'});
}
for(let i=1;i<=16;i++)def('e'+i+'.ca','Atk curve',-1,1,0,{vo:true,tip:'Attack curve: positive is fast at the start, negative is slow at the start.'});
for(let i=1;i<=16;i++){
  def('e'+i+'.mode','Type',0,3,0,{k:'list',list:'emode',tip:'What this modulator slot is: ADSR envelope, a drawn shape, an LFO, or a random source. All of them run per voice and start with each note.'});
  def('e'+i+'.lr','Rate',0.02,40,2,{k:'exp',u:' Hz',tip:'Speed of the LFO or random source in Hz (when Sync is Hz).'});
  def('e'+i+'.lsy','Sync',0,12,0,{k:'list',list:'sync',tip:'Tempo sync for the LFO or random source. Hz uses the Rate knob.'});
  def('e'+i+'.lsh','Shape',0,14,0,{k:'list',list:'lshape',tip:'LFO shape.'});
  def('e'+i+'.rsh','Random',0,8,1,{k:'list',list:'rshape',tip:'Random type: S&H holds steps, Smooth glides, Steps 4 and 8 repeat a pattern, Slew and Walk drift, Noise is fast, Gate jumps on and off, Ramp picks random slopes.'});
  def('e'+i+'.lph','Phase',0,1,0,{tip:'Start phase of the LFO at each note.'});
  def('e'+i+'.lsm','Smooth',0,1,0,{tip:'Smooths the LFO or random output.'});
  def('e'+i+'.lfd','Fade in',0,3000,0,{u:' ms',tip:'Time for the LFO or random source to fade in after the note starts.'});
  def('e'+i+'.len','Length',20,16000,1000,{k:'exp',u:' ms',tip:'Length of the drawn shape when Sync is off.'});
  def('e'+i+'.sync','Sync',0,8,5,{k:'list',list:'esync',tip:'Length of the drawn shape in bars and beats, locked to the tempo (default 1 bar). Off uses the Length knob in milliseconds.'});
  def('e'+i+'.loop','Loop',0,3,0,{k:'list',list:'eloop',tip:'Off: play once and stay at the end. Loop: repeat the whole shape while the key is held. Hold: stop at the end marker while the key is held, then play the rest on release. Markers: repeat between the two markers while held, then play the rest on release.'});
  def('e'+i+'.ls','Loop start',0,1,0,{tip:'Start marker (snaps to a point).'});
  def('e'+i+'.le','Loop end',0,1,1,{tip:'End marker (snaps to a point).'});
  def('e'+i+'.slew','Smooth',0.05,100,2,{k:'exp',u:' ms',tip:'Rounds off hard jumps in the drawn shape so they do not click. 0.5 to 2 ms keeps edges sharp but clean; more makes the shape softer.'});
}
LISTS.emode=['ADSR','Draw','LFO','Random'];LISTS.rshape=['S&H','Smooth','Steps 4','Steps 8','Slew','Walk','Noise','Gate','Ramp'];G.RSHAPE=[5,6,8,9,10,11,12,13,14];LISTS.esync=['Off','1/16','1/8','1/4','1/2','1 bar','2 bars','4 bars','8 bars'];LISTS.eloop=['Off','Loop','Hold','Markers'];G.ESYNCB=[0,.25,.5,1,2,4,8,16,32];LISTS.envsel=[];for(let i=1;i<=16;i++)LISTS.envsel.push('Env '+i);LISTS.fenvsel=['None'].concat(LISTS.envsel);
for(const k in PR){if(/^(e(1[0-6]|[1-9])|l[1-4])\.(a|h|d|s|r|c|ca|rate|ph|fade|sm|len|lr|lph|lsm|lfd)$/.test(k))PR[k].vo=true;}
for(const k of ['glide'])PR[k].vo=false;
const SRCS=['e1','e2','e3','e4','e5','e6','e7','e8','e9','e10','e11','e12','e13','e14','e15','e16','l1','l2','l3','l4','m1','m2','m3','m4','m5','m6','m7','m8','vel','key','wheel','bend','at','rnd'];
const SRCNAME={e9:'Env 9',e10:'Env 10',e11:'Env 11',e12:'Env 12',e13:'Env 13',e14:'Env 14',e15:'Env 15',e16:'Env 16',e1:'Env 1',e2:'Env 2',e3:'Env 3',e4:'Env 4',e5:'Env 5',e6:'Env 6',e7:'Env 7',e8:'Env 8',l1:'LFO 1',l2:'LFO 2',l3:'LFO 3',l4:'LFO 4',m1:'Macro 1',m2:'Macro 2',m3:'Macro 3',m4:'Macro 4',m5:'Macro 5',m6:'Macro 6',m7:'Macro 7',m8:'Macro 8',vel:'Velocity',key:'Key',wheel:'Mod Wheel',bend:'Pitch Bend',at:'Aftertouch',rnd:'Random'};
const SRCGLOBAL={l1:1,l2:1,l3:1,l4:1,m1:1,m2:1,m3:1,m4:1,m5:1,m6:1,m7:1,m8:1,vel:1,key:1,wheel:1,bend:1,at:1};
G.SRCS=SRCS;G.SRCNAME=SRCNAME;G.SRCGLOBAL=SRCGLOBAL;

const g_=(x,k)=>Math.abs(k)<1e-3?x:(1-Math.exp(-k*x))/(1-Math.exp(-k));

/* envelope: delay-less DAHDSR with curves, or drawn shape */
function pblep(t,dt){if(t<dt){t/=dt;return t+t-t*t-1;}if(t>1-dt){t=(t-1)/dt;return t*t+t+t+1;}return 0;}
function subWave(w,p,dt,pw){dt=Math.min(.45,Math.max(1e-6,dt));
  switch(w){
    case 0:return Math.sin(TAU*p);
    case 1:return p<.5?4*p-1:3-4*p;
    case 2:case 4:return ((p<pw?1:-1)+pblep(p,dt)-pblep((p-pw+1)%1,dt))*.7;
    case 3:return ((2*p-1)-pblep(p,dt))*.7;
    case 5:{const s=Math.sin(TAU*p);return (s>0?s:0)*1.6-.5;}
    case 6:return Math.tanh(Math.sin(TAU*p)*3)*.9;
    case 7:return (Math.sin(TAU*p)+.5*Math.sin(TAU*2*p)+.25*Math.sin(TAU*3*p))*.62;
    default:return p<.5?1-16*(p-.25)*(p-.25):-(1-16*(p-.75)*(p-.75));}}
class Env{
  constructor(){this.st=0;this.v=0;this.x=0;this.v0=0;this.t=0;this.a0=0;this.y=0;}
  on(){this.a0=this.st===0?0:this.v;this.st=1;this.x=0;this.t=0;} // retrigger starts the attack from the current level (no drop to zero, no click)
  off(){if(this.st!==0&&this.st!==5){this.st=5;this.x=0;this.v0=this.v;}}
  tick(dt,a,h,d,s,r,ca,c){ // dt seconds, times in ms
    switch(this.st){
      case 1:this.x+=dt*1000/a;if(this.x>=1){this.x=0;this.v=1;this.st=h>0?2:3;}else this.v=this.a0+(1-this.a0)*g_(this.x,ca*5);break;
      case 2:this.x+=dt*1000/h;this.v=1;if(this.x>=1){this.x=0;this.st=3;}break;
      case 3:this.x+=dt*1000/d;if(this.x>=1){this.x=1;this.st=4;this.v=s;}else this.v=s+(1-s)*(1-g_(this.x,-c*5));break;
      case 4:this.v=s;break;
      case 5:this.x+=dt*1000/r;if(this.x>=1){this.v=0;this.st=0;}else this.v=this.v0*(1-g_(this.x,-c*5));break;
      default:this.v=0;}
    return this.v;}
  drawTick(dt,len,lm,ls,le,pts,rel,slew){ // drawn shape; lm 0 off, 1 loop all, 2 hold at end marker, 3 loop markers
    const n=pts.length,at=u=>{const p=clamp(u,0,1)*(n-1),i=Math.min(n-2,Math.floor(p)),f=p-i;return pts[i]*(1-f)+pts[i+1]*f;};
    if(le<ls+.001){const q=ls;ls=le;le=q;}
    let y;
    if(this.st>=1&&this.st<=4){this.t+=dt*1000;let u=this.t/len;
      if(lm===1){if(u>=1){this.t%=len;u=this.t/len;}}
      else if(lm===2){if(u>=le){u=le;this.t=le*len;}}
      else if(lm===3&&le-ls>.002){if(u>=le){u=ls+((u-ls)%(le-ls));this.t=u*len;}}
      else if(u>=1){u=1;this.st=4;}
      this.u=u;y=at(u);this.y=y;}
    else if(this.st===5){
      if((lm===2||lm===3)&&this.u<1&&!this.rf){this.t+=dt*1000;this.u=this.t/len;if(this.u>=1){this.u=1;this.rf=1;this.x=0;this.v0=this.v;}y=at(this.u);}
      else{if(!this.rf){this.rf=1;this.x=0;this.v0=this.v;}this.x+=dt*1000/Math.max(1,rel);if(this.x>=1){this.st=0;this.v=0;this.rf=0;return 0;}y=this.v0*(1-this.x);}
    }else{this.v=0;this.rf=0;return 0;}
    if(this.st===1&&this.x===0&&this.t<=dt*1000+1e-9&&this.a0===0)this.v=y; // fresh voice: no slew from zero, start exactly on the shape
    const k=1-Math.exp(-dt*1000/Math.max(.05,slew));this.v+=(y-this.v)*k;
    if(this.st!==5)this.rf=0;
    return this.v;}
}
G.Env=Env;

/* LFO value: shape at phase, with S&H memory */
class Lfo{
  constructor(){this.ph=0;this.sh=0;this.sh2=0;this.sm=0;this.fade=0;this.rt=0;this.si=-1;this.sv=0;this.sa=0;this.wk=0;this.dir=1;this.amp=1;}
  start(ph,rnd){this.ph=ph;this.si=-1;this.wk=0;this.dir=1;this.amp=1;this.fade=0;this.sh2=Math.random()*2-1;this.sh=Math.random()*2-1;this.sm=0;}
  tick(dt,rate,shape,smooth,fadeMs,custom){
    this.ph+=rate*dt;let wrapped=false;if(this.ph>=1){this.ph-=Math.floor(this.ph);wrapped=true;}
    if(wrapped){this.sh=this.sh2;this.sh2=Math.random()*2-1;this.dir=Math.random()<.5?1:-1;this.amp=.4+Math.random()*.6;}
    const p=this.ph;let v=0;
    switch(shape){
      case 0:v=Math.sin(TAU*p);break;
      case 1:v=p<.5?4*p-1:3-4*p;break;
      case 2:v=2*p-1;break;
      case 3:v=1-2*p;break;
      case 4:v=p<.5?1:-1;break;
      case 5:v=this.sh;break;
      case 6:{const t=(1-Math.cos(PI*p))*.5;v=this.sh*(1-t)+this.sh2*t;break;}
      case 7:{const q=p*custom.length,i=Math.floor(q)%custom.length,f=q-Math.floor(q);v=custom[i]*(1-f)+custom[(i+1)%custom.length]*f;break;}
      case 8:case 9:case 13:{const n=shape===8?4:8,idx=Math.floor(p*n);if(idx!==this.si){this.si=idx;this.sv=shape===13?(Math.random()<.5?1:-1):Math.random()*2-1;}v=this.sv;break;}
      case 10:{const q=p*4,idx=Math.floor(q);if(idx!==this.si){this.si=idx;this.sa=this.sv;this.sv=Math.random()*2-1;}const f=q-idx;v=this.sa*(1-f)+this.sv*f;break;}
      case 11:{this.wk+=(Math.random()*2-1)*Math.sqrt(Math.max(rate,.05)*dt)*1.6;if(this.wk>1)this.wk=2-this.wk;if(this.wk<-1)this.wk=-2-this.wk;this.wk=clamp(this.wk,-1,1);v=this.wk;break;}
      case 12:v=Math.random()*2-1;break;
      case 14:v=(this.dir>0?2*p-1:1-2*p)*this.amp;break;
    }
    if(smooth>0){const a=1-Math.exp(-dt/(0.0005+smooth*0.2));this.sm+=(v-this.sm)*a;v=this.sm;}
    if(fadeMs>0){this.fade=Math.min(1,this.fade+dt*1000/fadeMs);v*=this.fade;}
    return v;}
}
G.Lfo=Lfo;
const hs=i=>{const x=Math.sin(i*12.9898+1.7)*43758.5453;return (x-Math.floor(x))*2-1;};
G.lfoShape=function(shape,p,custom){const l=new Lfo();l.ph=p;l.sh=0.3;l.sh2=-0.5;
  switch(shape){case 0:return Math.sin(TAU*p);case 1:return p<.5?4*p-1:3-4*p;case 2:return 2*p-1;case 3:return 1-2*p;case 4:return p<.5?1:-1;
  case 8:return hs(Math.floor(p*4));case 9:return hs(Math.floor(p*8)+10);case 10:{const q=p*4,i=Math.floor(q),f=q-i;return hs(i+20)*(1-f)+hs(i+21)*f;}
  case 11:return Math.sin(TAU*p*2+.4)*.5+Math.sin(TAU*p*5+2)*.3+Math.sin(TAU*p*9+1)*.2;case 12:return hs(Math.floor(p*64)*7+3);case 13:return hs(Math.floor(p*8)+30)>0?1:-1;case 14:return (1-2*p)*.6;
  case 5:return (Math.floor(p*8)%2?0.6:-0.7)*(1-(Math.floor(p*8)%3)*.3);case 6:return Math.sin(TAU*p)*.7+Math.sin(TAU*p*3+1)*.3;
  case 7:{const q=p*custom.length,i=Math.floor(q)%custom.length,f=q-Math.floor(q);return custom[i]*(1-f)+custom[(i+1)%custom.length]*f;}}return 0;};

/* ---------- Voice ---------- */
const UCIDX=[0,1,2,3,4,5,6,7];
const FIR4=(()=>{const k=new Float64Array(31);let sm=0;for(let j=0;j<31;j++){const x=j-15,sinc=x===0?.25*2:Math.sin(Math.PI*x*.25*2*.5*2)/(Math.PI*x);
  const w=.42-.5*Math.cos(2*Math.PI*j/30)+.08*Math.cos(4*Math.PI*j/30);k[j]=(x===0?.25:Math.sin(Math.PI*x*.25)/(Math.PI*x))*w;sm+=k[j];}
  for(let j=0;j<31;j++)k[j]/=sm;return k;})();
class Voice{
  constructor(E,idx){
    this.E=E;this.idx=idx;this.s1=new Float64Array(8);this.s2=new Float64Array(8);this.ks=1-Math.exp(-1/(E.sr*.00035));this.active=false;this.gate=false;this.note=60;this.noteCur=60;this.vel=1;this.age=0;this.serial=0;
    this.env=[];this.elfo=[];for(let i=0;i<16;i++){this.env.push(new Env());this.elfo.push(new Lfo());}this.lfo=[new Lfo(),new Lfo(),new Lfo(),new Lfo()];
    this.sen=[0,1,2,3,4,5,6,7].map(()=>new Env());this.senV=new Float64Array(8);this.senP=new Float64Array(8);
    this.sv={};for(const s of SRCS)this.sv[s]=0;
    this.acc={};
    const S6=[0,1,2,3,4,5];this.ph=S6.map(()=>new Float64Array(8));this.inc=S6.map(()=>new Float64Array(8));
    this.gl=S6.map(()=>new Float64Array(8));this.gr=S6.map(()=>new Float64Array(8));
    this.nU=[1,1,1,1,1,1];this.last=new Float64Array(8);this.fbs=new Float64Array(6);this.oh=[];this.ow=[];for(let o=0;o<6;o++){this.oh.push(new Float64Array(8*32));this.ow.push(new Int32Array(8));}
    this.diveT=[0,0,0,0,0,0];this.dive=[0,0,0,0,0,0];
    this.spos=S6.map(()=>new Float64Array(8));
    this.grains=S6.map(()=>[]);this.gacc=[0,0,0,0,0,0];
    this.subph=0;this.subph2=.31;this.subph3=.67;this.nzs=[0,0,0];this.nzp=0;this.punch=0;this.nzS=[{a:0,b:0,c:0,pw:0,pd:0,sh:0,cnt:0,gp:0,lp1:0,lp2:0,hp1:0,hp2:0,v1:0,v2:0},{a:0,b:0,c:0,pw:0,pd:0,sh:0,cnt:0,gp:0,lp1:0,lp2:0,hp1:0,hp2:0,v1:0,v2:0}];
    this.flt=[0,1,2,3,4,5,6,7].map(()=>[new VFilt(),new VFilt()]);
    this.ev=0;this.evP=0;this.fo=[0,0];this.tmp=[0,0];
    this.pc=null; // resolved params for this block
    this.rnd=0;this.fade=1;
  }
  start(note,vel,retrig){
    const E=this.E;this.active=true;this.gate=true;this.note=note;this.vel=vel;this.age=0;this.serial=++E.serial;
    if(retrig){
      this.noteCur=E.glideFrom!==null&&E.pv.glide>0?E.glideFrom:note;
      if(this.env[0].st===0){this.s1.fill(0);this.s2.fill(0);}
      for(const e of this.env)e.on();for(const e of this.sen)e.on();
      for(let i=0;i<4;i++)this.lfo[i].start(E.pv['l'+(i+1)+'.ph'],0);
      for(let i=0;i<16;i++)this.elfo[i].start(E.pv['e'+(i+1)+'.lph']||0,0);
      {const A=this.an||(this.an={p:new Float64Array(48),c:[0,0],e:0,dr:new Float64Array(6),dt:new Float64Array(6)});for(let j=0;j<48;j++)A.p[j]=Math.random()*2-1;A.c[0]=Math.random()*2-1;A.c[1]=Math.random()*2-1;A.e=Math.random()*2-1;for(let j=0;j<6;j++){A.dt[j]=Math.random()*2-1;A.dr[j]=A.dt[j];}} // analog: fixed per-voice offsets, new on each note
      this.rnd=Math.random()*2-1;this.punch=1;if(E.pv['s.srs']){this.subph=0;this.subph2=.31;this.subph3=.67;}
      for(let o=0;o<6;o++){const k=OSK[o];const rnd=E.pv[k+'.rnd'],ph=E.pv[k+'.ph'];
        for(let u=0;u<8;u++){this.ph[o][u]=(ph+Math.random()*rnd)%1;this.spos[o][u]=0;}
        this.diveT[o]=0;this.grains[o].length=0;}
    }else{for(const e of this.env){if(e.st===5)e.on();}}
    this.fade=0;this.pfresh=true;this.kf=1;this.kfd=0;}
  sg(q,x){const a=this.s1,b=this.s2,k=this.ks;a[q]+=(x-a[q])*k;b[q]+=(a[q]-b[q])*k;return b[q];} // two one-pole stages at about 0.35 ms: the envelopes run at block rate, so this rounds the corners of very short attacks (click)
  fadeKill(ms){if(!this.active)return;this.kfd=1/Math.max(1,this.E.sr*(ms||6)/1000);if(!this.kf)this.kf=1;}
  release(){this.gate=false;for(const e of this.env)e.off();for(const e of this.sen)e.off();}
  kill(){if(this.jps)this.jps.fill(0);this.active=false;this.gate=false;this.kfd=0;this.kf=1;for(const e of this.env){e.st=0;e.v=0;e.rf=0;}for(const e of this.sen){e.st=0;e.v=0;}
    for(const f of this.flt){f[0].reset();f[1].reset();}this.last.fill(0);}
  /* one oscillator sample at phase p including FM, feedback, warp and AM/ring (used by the 2x path) */
  oscS(o,c,p,msrc){let q=p;
    if(c.mm===1)q+=c.mai*msrc*.8;
    if(c.fb>0)q+=c.fbi*this.fbs[o]*.5;
    q-=Math.floor(q);
    if(c.w1>=1&&c.w1<=8)q=wph(c.w1,c.a1i,q);
    if(c.w2>=1&&c.w2<=8)q=wph(c.w2,c.a2i,q);
    let s=this.tableRead(o,q);
    if(c.w1>=9)s=wamp(c.w1,c.a1i,s,q);
    if(c.w2>=9)s=wamp(c.w2,c.a2i,s,q);
    if(c.mm===2)s*=(1-c.mai)+c.mai*(msrc*.5+.5);else if(c.mm===3)s*=(1-c.ma)+c.mai*msrc;
    return s;}
  /* block control: modulation accumulation then params, sources */
  control(n){
    const E=this.E,pv=E.pv,bn=E.bn,dt=n/E.sr,acc=this.acc;
    for(const k in acc)delete acc[k];
    const sl=E.slots;
    for(let i=0;i<sl.length;i++){const s=sl[i];if(!s.d||s.d.charCodeAt(0)===102&&s.d.charCodeAt(1)===120&&s.d.charCodeAt(2)===58)continue;if(!PR[s.d])continue;
      let v=SRCGLOBAL[s.s]&&s.s[0]==='l'&&pv[s.s+'.mode']===1?E.gl[+s.s[1]-1]:SRCGLOBAL[s.s]&&s.s[0]!=='l'?E.gsrc(s.s,this):this.sv[s.s];
      if(s.u)v=(v+1)*.5;
      acc[s.d]=(acc[s.d]||0)+v*s.a;}
    const R=k=>{const a=acc[k];return a===undefined?pv[k]:fromN(k,bn[k]+a);};
    this.R=R;
    // glide
    const gl=pv.glide;if(gl>0){this.noteCur+=(this.note-this.noteCur)*(1-Math.exp(-dt*1000/gl));}else this.noteCur=this.note;
    // analog life: slow per-voice pitch drift (new target now and then, glides there)
    let anl=0;const AN=this.an;for(let j=0;j<6;j++){const kk=OSK[j];if(pv[kk+'.on']&&pv[kk+'.anl']>anl)anl=pv[kk+'.anl'];}const aef=AN&&anl>0?1+anl*.05*AN.e:1;
    if(AN&&anl>0){const k1=Math.min(1,dt/.7),pn=Math.min(1,dt/1.1);for(let j=0;j<6;j++){if(Math.random()<pn)AN.dt[j]=Math.random()*2-1;AN.dr[j]+=(AN.dt[j]-AN.dr[j])*k1;}}
    // envelopes
    for(let i=0;i<16;i++){const e=this.env[i],k='e'+(i+1)+'.',md=pv[k+'mode']|0;
      if(md>=2&&i>0){const sy=pv[k+'lsy']|0;const rate=sy>0?pv.bpm/60/SYNCDIV[sy]:R(k+'lr');const sh=md===2?pv[k+'lsh']|0:G.RSHAPE[pv[k+'rsh']|0];
        this.sv['e'+(i+1)]=(this.elfo[i].tick(dt,rate,sh,R(k+'lsm'),R(k+'lfd'),E.custom[3+i+1]||E.custom[0])+1)*.5;continue;} // LFO or random in a modulator slot: 0..1, restarts with the note
      this.sv['e'+(i+1)]=(md===1&&E.draw[i]&&E.draw[i].length>1)?e.drawTick(dt,pv[k+'sync']?60000/Math.max(20,pv.bpm||120)*G.ESYNCB[pv[k+'sync']|0]:R(k+'len'),pv[k+'loop']|0,R(k+'ls'),R(k+'le'),E.draw[i],R(k+'r'),R(k+'slew')):e.tick(dt,R(k+'a')*aef,R(k+'h'),R(k+'d')*aef,R(k+'s'),R(k+'r')*aef,R(k+'ca'),R(k+'c'));}
    // per-source envelopes
    const SK=['a','b','c','sub','nz','d','e','f'];
    for(let i=0;i<8;i++){const x=SK[i],e=this.sen[i];this.senP[i]=this.senV[i];
      this.senV[i]=e.tick(dt,R(x+'.ea'),0,R(x+'.ed'),R(x+'.es'),R(x+'.er'),0,-.4);}
    // lfos
    for(let i=0;i<4;i++){const k='l'+(i+1)+'.',sync=R(k+'sync');
      let rate=R(k+'rate');if(sync>0)rate=pv.bpm/60/SYNCDIV[sync];
      if(pv[k+'mode']===1){this.sv['l'+(i+1)]=E.gl[i];}
      else this.sv['l'+(i+1)]=this.lfo[i].tick(dt,rate,R(k+'shape'),R(k+'sm'),R(k+'fade'),E.custom[i]);}
    for(let i=1;i<=8;i++)this.sv['m'+i]=R('m'+i);
    this.sv.vel=this.vel;this.sv.key=clamp((this.note-36)/60,0,1);this.sv.wheel=E.wheel;this.sv.bend=E.bend;this.sv.at=E.at;this.sv.rnd=this.rnd;
    this.evP=this.ev;this.ev=this.env[0].v;
    if(!this.envV){this.envV=new Float64Array(16);this.envP=new Float64Array(16);}
    for(let i=0;i<16;i++){this.envP[i]=this.envV[i];this.envV[i]=this.sv['e'+(i+1)];}
    // liveness
    let alive=false;
    const e1on=this.env[0].st!==0;
    for(let i=0;i<8;i++){const x=SK[i];
      const on=(i<3||i>4)?pv[x+'.on']:(i===3?pv['s.sub']:pv['s.nz']);if(!on)continue;
      if(pv[x+'.eo']){if(this.sen[i].st!==0)alive=true;}else if(this.env[pv[x+'.env']|0].st!==0)alive=true;}
    if(!alive){this.kill();return false;}
    // oscillator control
    const bend=E.bend*pv.bendr;
    for(let o=0;o<6;o++){const k=OSK[o];if(!pv[k+'.on']){this.nU[o]=0;continue;}
      const dv=R(k+'.dv'),dtm=R(k+'.dt');this.diveT[o]+=dt*1000;
      const diveSt=dv*Math.exp(-this.diveT[o]/dtm*3);
      const eng=pv[k+'.eng'];
      const base=this.noteCur+R(k+'.oct')*12+R(k+'.semi')+R(k+'.fine')/100+R(k+'.pit')+bend+diveSt;
      let nU=eng===2?1:pv[k+'.uv'];nU=Math.max(1,nU);this.nU[o]=nU;
      const ud=R(k+'.ud'),us=pv[k+'.us'],ub=R(k+'.ub'),usp=R(k+'.usp');
      const maxc=Math.pow(ud,1.6)*120;
      let gsum=0;const g=this.gl[o],gr=this.gr[o],gg=new Float64Array(8);
      for(let u=0;u<nU;u++){
        const x=nU>1?(u/(nU-1))*2-1:0;let cents=0,semi=0,gain=1;
        if(us===0)cents=x*maxc;
        else if(us===1){cents=Math.sign(x)*Math.pow(Math.abs(x),1.35)*maxc;const side=Math.abs(x)>.01;gain=side?.15+.85*ub:1;}
        else if(us===3){semi=[0,-12,12,0,12,-12,0,12][u];cents=(u%2?-1:1)*maxc*.12;}
        else if(us===4){semi=[0,7,12,0,7,12,0,7][u];cents=(u%2?-1:1)*maxc*.12;}
        else if(us===2){ // JP-8000 curves (Szabo 2010 thesis): voice 0 is the centre, the rest use the measured side offsets
          if(u>0&&nU>1){const sx=nU>2?(u-1)/(nU-2)*5:2.5,i=Math.min(4,sx|0),f=sx-i,off=JPOFF[i]+(JPOFF[i+1]-JPOFF[i])*f;
            cents=1200*Math.log2(Math.max(.5,1+jpCurve(ud)*off));gain=jpSide(ub)/jpCen(ub);}
          }
        else {semi=[0,3,7,12,0,3,7,12][u];cents=(u%2?-1:1)*maxc*.12;}
        {const oa=pv[OSK[o]+'.anl'];if(oa>0&&AN)cents+=oa*(5*AN.p[o*8+u]+3*AN.dr[o]);}
        this.inc[o][u]=mtof(base+semi+cents/100)/E.sr;
        gg[u]=gain;gsum+=gain*gain;
        const xp=us===2?(u===0||nU<2?0:(nU>2?((u-1)/(nU-2))*2-1:0)):x;
        const pan=clamp(xp*usp,-1,1)*.5+.5+0; // 0..1
        const pp=clamp(R(k+'.pan')*.5+.5+(pan-.5)*0.999,0,1);
        g[u]=Math.cos(pp*PI/2);gr[u]=Math.sin(pp*PI/2);}
      const nrm=1/Math.sqrt(gsum||1);
      for(let u=0;u<nU;u++){g[u]*=gg[u]*nrm;gr[u]*=gg[u]*nrm;}
      const pc=this.pcache||(this.pcache=[{},{},{},{},{},{}]);const c=pc[o];
      c.posP=c.pos;c.w1aP=c.w1a;c.w2aP=c.w2a;c.maP=c.ma;c.fbP=c.fb;c.lvlP=c.lvl;
      c.pos=R(k+'.pos');c.w1=pv[k+'.w1'];c.w1a=R(k+'.w1a');c.w2=pv[k+'.w2'];c.w2a=R(k+'.w2a');c.lvl=R(k+'.lvl');
      c.mm=pv[k+'.mm'];c.ms=pv[k+'.ms'];c.ma=R(k+'.ma');c.fb=R(k+'.fb');c.eng=eng;c.os=eng===0&&((c.w1>0&&c.w1a>0)||(c.w2>0&&c.w2a>0)||(c.mm>0&&c.ma>0)||c.fb>0);c.fmax=this.inc[o][0]*E.sr;
      if(c.posP===undefined||this.pfresh){c.posP=c.pos;c.w1aP=c.w1a;c.w2aP=c.w2a;c.maP=c.ma;c.fbP=c.fb;c.lvlP=c.lvl;}
      let fm=0;for(let u=0;u<nU;u++)fm=Math.max(fm,this.inc[o][u]*E.sr);c.fmax=fm;
      c.jp=eng===0&&us===2&&nU>1;if(c.jp){const fh=Math.min(.45*E.sr,mtof(base));c.jg=Math.tan(PI*fh/E.sr);}
      c.gp=R(k+'.gp');c.gs=R(k+'.gs');c.gd=R(k+'.gd');c.gj=pv[k+'.gj'];c.root=pv[k+'.sroot'];c.loop=pv[k+'.sloop'];c.pr=Math.pow(2,(base-c.root)/12);
    }
    // filters
    const keyOct=(this.note-60)/12;
    for(let f=0;f<2;f++){const k='f'+(f+1)+'.';const es=pv[k+'es']|0,envv=es?this.sv['e'+es]:0;
      const type=pv[k+'type'];
      let fc=Math.min(20000,R(k+'cut')*Math.pow(2,keyOct*pv[k+'kt']+5*R(k+'env')*envv)*(anl>0&&AN?1+anl*.03*AN.c[f]:1));
      for(let s=0;s<8;s++)this.flt[s][f].set(type,fc,R(k+'res'),R(k+'drv'),R(k+'mix'),E.sr,R(k+'sh'),pv[k+'dm'],n);}
    // sub / noise
    {const kt=pv['s.skt'],th=R('s.sth');const f0=kt?mtof(this.noteCur+pv['s.so']*12+bend+R('s.sfn')/100):R('s.sfh')*Math.pow(2,R('s.sfn')/1200);
      const nlp=R('s.nlp'),nhp=R('s.nhp'),sr_=E.sr,nf=Math.min(.45,mtof(this.noteCur+bend)/sr_);
      this.pcs={sl:R('s.sl'),nl:R('s.nl'),sf:f0/sr_,sf2:f0*Math.pow(2,th*25/1200)/sr_,sf3:f0*Math.pow(2,-th*25/1200)/sr_,th,
        spn:R('s.spn'),sph:R('s.sph'),spw:R('s.spw'),sfm:R('s.sfm'),sdr:R('s.sdr'),
        npn:R('s.npn'),nw:R('s.nw'),lpc:nlp>=19000?0:1-Math.exp(-TAU*nlp/sr_),hpc:nhp<=25?0:1-Math.exp(-TAU*nhp/sr_),
        ntn:R('s.ntn'),ng:2*Math.sin(Math.PI*nf),tc:.25/Math.sqrt(Math.max(1e-5,2*Math.sin(Math.PI*nf)*.04)),nd:R('s.nd'),nrp:sr_/R('s.nr')};}
    return true;
  }
  nzGen(S,nt,pcs,sr){const w=Math.random()*2-1;let x=0;
    switch(nt){
      case 0:x=w;break;
      case 1:S.a=.97*S.a+.03*w;S.b=.9*S.b+.1*S.a;x=(S.a+S.b)*3;break;
      case 2:S.c=(S.c+.02*w)/1.02;x=S.c*14;break;
      case 3:x=Math.random()<.002+.04*pcs.nd?w*2:0;break;
      case 4:x=(w-S.pw)*.7;S.pw=w;break;
      case 5:{const d=w-S.pw;x=(d-S.pd)*.5;S.pd=d;S.pw=w;break;}
      case 6:x=Math.random()<.001+.03*pcs.nd?(Math.random()<.5?-1:1)*(1+Math.random())*1.5:0;break;
      case 7:if(--S.cnt<=0){S.sh=w;S.cnt=Math.max(1,pcs.nrp);}x=S.sh;break;
      case 8:S.a=.97*S.a+.03*w;x=S.a*1.2+(Math.random()<.0008+.02*pcs.nd?w*3:0);break;
      default:S.a=.97*S.a+.03*w;S.b=.9*S.b+.1*S.a;S.gp+=TAU*.31/sr;if(S.gp>TAU)S.gp-=TAU;x=(S.a+S.b)*3*(.45+.55*Math.sin(S.gp)*Math.sin(S.gp*.37+1));}
    if(pcs.lpc>0){S.lp1+=pcs.lpc*(x-S.lp1);S.lp2+=pcs.lpc*(S.lp1-S.lp2);x=S.lp2;}
    if(pcs.hpc>0){S.hp1+=pcs.hpc*(x-S.hp1);S.hp2+=pcs.hpc*(x-S.hp1-S.hp2);x=x-S.hp1-S.hp2;}
    if(pcs.ntn>0.001){const g=pcs.ng,q=.04;S.v1+=g*S.v2;const hi=x-S.v1-q*S.v2;S.v2+=g*hi;if(!isFinite(S.v2)){S.v1=0;S.v2=0;}x=x*(1-pcs.ntn)+S.v2*pcs.tc*pcs.ntn;}
    return x;}
  tableRead(o,p){const c=this.pcache[o],T=this.E.tab[o];if(!T)return 0;
    const lv=T.lv;if(!lv)return 0;
    const maxH=Math.max(1,Math.floor(this.E.sr*.5/c.fmax));let m=0;if(maxH<1024)m=Math.min(10,Math.ceil(Math.log2(1024/maxH)));
    const fr=lv[m],fi=(c.pi!==undefined?c.pi:c.pos)*(T.nf-1),f0=Math.min(T.nf-1,fi|0),f1=Math.min(T.nf-1,f0+1),ff=fi-f0;
    const idx=p*2048,i0=idx|0,fq=idx-i0;
    const A=fr[f0],B=fr[f1];
    const a=A[i0]+(A[i0+1]-A[i0])*fq,b=B[i0]+(B[i0+1]-B[i0])*fq;return a+(b-a)*ff;}
  render(n){this.pfresh=false;if(this.kfd&&this.kf<=0){this.kill();return;}
    const E=this.E,pv=E.pv,sr=E.sr,pcs=this.pcs,R=this.R;
    const velg=(1-pv.vel)+pv.vel*this.vel;
    const rt=[pv['a.rt'],pv['b.rt'],pv['c.rt'],pv['s.srt'],pv['s.rt'],pv['d.rt'],pv['e.rt'],pv['f.rt']];
    const eo=[pv['a.eo'],pv['b.eo'],pv['c.eo'],pv['sub.eo'],pv['nz.eo'],pv['d.eo'],pv['e.eo'],pv['f.eo']];
    const serial=pv.frt===0,out=this.tmp,o2=[0,0];
    const e1a=this.evP,e1b=this.ev,sA=this.senP,sB=this.senV;
    const sl=this.fo;
    const eIdx=[pv['a.env'],pv['b.env'],pv['c.env'],pv['sub.env'],pv['nz.env'],pv['d.env'],pv['e.env'],pv['f.env']].map(x=>x|0),evS=[0,0,0,0,0,0,0,0],envP=this.envP,envV=this.envV;
    for(let i=0;i<n;i++){
      const t=i/n;
      const evi=(e1a+(e1b-e1a)*t)*velg;
      for(let q=0;q<8;q++){const ix=eIdx[q];evS[q]=(envP[ix]+(envV[ix]-envP[ix])*t)*velg;}
      const outL=[0,0,0,0,0,0,0,0],outR=[0,0,0,0,0,0,0,0];
      // oscillators
      for(let o=0;o<6;o++){
        const nU=this.nU[o];if(nU===0)continue;const sl_=SLOT[o];const c=this.pcache[o];
        c.pi=c.posP+(c.pos-c.posP)*t;c.a1i=c.w1aP+(c.w1a-c.w1aP)*t;c.a2i=c.w2aP+(c.w2a-c.w2aP)*t;c.mai=c.maP+(c.ma-c.maP)*t;c.fbi=c.fbP+(c.fb-c.fbP)*t;c.lvi=c.lvlP+(c.lvl-c.lvlP)*t;
        let sumL=0,sumR=0;const ph=this.ph[o],inc=this.inc[o],gL=this.gl[o],gR=this.gr[o];
        const msrc=c.mm>0?this.last[MSL[c.ms]]:0;
        if(c.eng===0&&c.os){
          // warp, FM, AM, ring or feedback make harmonics above Nyquist: render at 4x and decimate with a 31-tap windowed-sinc low-pass
          const H=this.oh[o],W=this.ow[o];
          for(let u=0;u<nU;u++){
            let p=ph[u]+inc[u];if(p>=1)p-=1;ph[u]=p;
            const b=u*32;let w=W[u];
            for(let k=3;k>=0;k--){let pk=p-inc[u]*k*.25;if(pk<0)pk+=1;H[b+w]=this.oscS(o,c,pk,msrc);w=(w+1)&31;}
            W[u]=w;let sm=0;for(let j=0;j<31;j++)sm+=FIR4[j]*H[b+((w-1-j)&31)];
            sumL+=sm*gL[u];sumR+=sm*gR[u];}
          this.fbs[o]=(sumL+sumR)*.5;
        }else if(c.eng===0){
          for(let u=0;u<nU;u++){
            let p=ph[u]+inc[u];if(p>=1)p-=1;ph[u]=p;
            let q=p;
            if(c.mm===1)q+=c.mai*msrc*.8;
            if(c.fb>0)q+=c.fbi*this.fbs[o]*.5;
            q-=Math.floor(q);
            if(c.w1>=1&&c.w1<=8)q=wph(c.w1,c.a1i,q);
            if(c.w2>=1&&c.w2<=8)q=wph(c.w2,c.a2i,q);
            let s=this.tableRead(o,q);
            if(c.w1>=9)s=wamp(c.w1,c.a1i,s,q);
            if(c.w2>=9)s=wamp(c.w2,c.a2i,s,q);
            if(c.mm===2)s*=(1-c.mai)+c.mai*(msrc*.5+.5);else if(c.mm===3)s*=(1-c.ma)+c.mai*msrc;
            sumL+=s*gL[u];sumR+=s*gR[u];}
          this.fbs[o]=(sumL+sumR)*.5;
        }else if(c.eng===1){
          const buf=E.smp[o];
          if(buf){const bl=buf.d.length,rate=buf.sr/sr;
            for(let u=0;u<nU;u++){
              let pos=this.spos[o][u];const stepR=(inc[u]*sr/mtof(c.root))*rate;
              pos+=stepR;if(c.loop&&pos>=bl)pos-=bl*Math.floor(pos/bl);else if(pos>=bl-1){pos=bl-1;}
              this.spos[o][u]=pos;const i0=pos|0,fq=pos-i0,s=buf.d[i0]*(1-fq)+buf.d[Math.min(bl-1,i0+1)]*fq;
              sumL+=s*gL[u];sumR+=s*gR[u];}}
        }else{
          const buf=E.smp[o];
          if(buf){const bl=buf.d.length,G_=this.grains[o];
            this.gacc[o]+=c.gd/sr;
            while(this.gacc[o]>=1&&G_.length<24){this.gacc[o]-=1;
              G_.push({pos:clamp(c.gp+(Math.random()*2-1)*c.gj*.5,0,1)*(bl-1),age:0,len:c.gs*.001*sr,pan:Math.random()*2-1,rate:c.pr*buf.sr/sr});}
            if(this.gacc[o]>=1)this.gacc[o]=0;
            for(let g=G_.length-1;g>=0;g--){const gr=G_[g];if(gr.age>=gr.len){G_.splice(g,1);continue;}
              const w=.5-.5*Math.cos(TAU*gr.age/gr.len);gr.pos+=gr.rate;if(gr.pos>=bl-1)gr.pos-=bl-1;
              const i0=gr.pos|0,fq=gr.pos-i0,s=(buf.d[i0]*(1-fq)+buf.d[i0+1]*fq)*w*.5;gr.age++;
              const pp=gr.pan*.5+.5;sumL+=s*Math.cos(pp*PI/2)*1.4;sumR+=s*Math.sin(pp*PI/2)*1.4;}}
        }
        if(c.jp){const S=this.jps||(this.jps=new Float64Array(24)),b=o*4,g=c.jg,dn=1/(1+SQ2*g+g*g);
          let hp=(sumL-(SQ2+g)*S[b]-S[b+1])*dn,bp=g*hp+S[b];S[b]=g*hp+bp;S[b+1]+=2*g*bp;sumL=hp; // 2-pole high-pass at the note (JP-8000 style)
          hp=(sumR-(SQ2+g)*S[b+2]-S[b+3])*dn;bp=g*hp+S[b+2];S[b+2]=g*hp+bp;S[b+3]+=2*g*bp;sumR=hp;}
        const lv=c.lvi*.5;let amp=lv;
        const own=sA[sl_]+(sB[sl_]-sA[sl_])*t;
        amp*=this.sg(sl_,eo[sl_]?own:own*evS[sl_]);
        if(eo[sl_])amp*=velg;
        outL[sl_]=sumL*amp;outR[sl_]=sumR*amp;
        this.last[sl_]=(sumL+sumR)*.5;
      }
      // sub
      if(pv['s.sub']){const dt1=pcs.sf;this.subph+=dt1;if(this.subph>=1)this.subph-=1;
        const w=pv['s.sw'],th=pcs.th,fmv=pcs.sfm*this.last[0]*.3,pwv=w===2?.5:pcs.spw;
        let s1=subWave(w,(this.subph+pcs.sph+fmv+4)%1,dt1,pwv),sL=s1,sR=s1;
        if(th>0.001){this.subph2+=pcs.sf2;if(this.subph2>=1)this.subph2-=1;this.subph3+=pcs.sf3;if(this.subph3>=1)this.subph3-=1;
          const g=th*.7,nm=1/(1+g);sL=(s1+g*subWave(w,(this.subph2+pcs.sph+fmv+4)%1,pcs.sf2,pwv))*nm;sR=(s1+g*subWave(w,(this.subph3+pcs.sph+fmv+4)%1,pcs.sf3,pwv))*nm;}
        if(pcs.sdr>0.001){const k=1+pcs.sdr*6,nk=1/Math.tanh(k);sL=Math.tanh(sL*k)*nk;sR=Math.tanh(sR*k)*nk;}
        const own=sA[3]+(sB[3]-sA[3])*t;let amp=pcs.sl*.7*(eo[3]?own*velg:this.sg(3,own*evS[3]));
        const pn=pcs.spn,gl=pn>0?1-pn:1,gr=pn<0?1+pn:1;
        outL[3]=sL*amp*gl;outR[3]=sR*amp*gr;this.last[3]=(sL+sR)*.5;}
      if(pv['s.nz']){const nt=pv['s.nt'];let xl=this.nzGen(this.nzS[0],nt,pcs,sr),xr=xl;
        if(pcs.nw>0.001){const x2=this.nzGen(this.nzS[1],nt,pcs,sr);xr=xl*(1-pcs.nw)+x2*pcs.nw;}
        if(this.punch>0){const pk=Math.sin(TAU*this.punch*40)*pv['s.pk']*this.punch*1.5;xl+=pk;xr+=pk;this.punch=Math.max(0,this.punch-1/(sr*.012));}
        const own=sA[4]+(sB[4]-sA[4])*t;let amp=pcs.nl*.5*(eo[4]?own*velg:this.sg(4,own*evS[4]));
        const pn=pcs.npn,gl=pn>0?1-pn:1,gr=pn<0?1+pn:1;
        outL[4]=xl*amp*gl;outR[4]=xr*amp*gr;}
      // filters and routing
      let tl=0,tr=0,kg=1;if(this.kfd){this.kf=Math.max(0,this.kf-this.kfd);kg=this.kf*this.kf;}
      for(let s=0;s<8;s++){
        let l=outL[s],r=outR[s];
        if(l===0&&r===0&&s>=3)continue;
        const rr=rt[s];
        if(rr!==0&&this.flt[s][0]&&(l!==0||r!==0||true)){
          const f1=this.flt[s][0],f2=this.flt[s][1];
          if(rr===1){f1.proc(l,r,out);l=out[0];r=out[1];}
          else if(rr===2){f2.proc(l,r,out);l=out[0];r=out[1];}
          else if(serial){f1.proc(l,r,out);f2.proc(out[0],out[1],o2);l=o2[0];r=o2[1];}
          else{f1.proc(l,r,out);const a=out[0],b=out[1];f2.proc(l,r,out);l=(a+out[0])*.707;r=(b+out[1])*.707;}
        }
        const T=E.tk[TKOF[s]];T.l[i]+=l*kg;T.r[i]+=r*kg;
      }
    }
  }
}
function wph(id,a,p){
  switch(id){
    case 1:{const r=1+a*7;return (p*r)%1;}
    case 2:return Math.pow(p,1+a*3);
    case 3:return 1-Math.pow(1-p,1+a*3);
    case 4:return p<.5?.5*Math.pow(2*p,1+a*3):1-.5*Math.pow(2*(1-p),1+a*3);
    case 5:{const w=.5-a*.45;return p<w?p*.5/w:.5+(p-w)*.5/(1-w);}
    case 6:return p*(1-a)+(p<.5?2*p:2-2*p)*a;
    case 7:return p+a*.25*Math.sin(TAU*p)/PI*2;
    case 8:{const st=Math.max(2,Math.round(66-a*64));return p+(Math.floor(p*st)/st-p)*Math.min(1,a*3);}
  }return p;}
function wamp(id,a,s,p){
  switch(id){
    case 9:{let y=s*(1+a*6);let n=0;while((y>1||y<-1)&&n++<8)y=y>1?2-y:-2-y;return y;}
    case 10:{const g=1+a*8;return clamp(s*g,-1,1)*(1-.3*a);}
    case 11:{const q=Math.pow(2,1+(1-a)*10);return Math.round(s*q)/q;}
    case 12:return p<.5?s:s*(1-2*a);
  }return s;}
G.Voice=Voice;
