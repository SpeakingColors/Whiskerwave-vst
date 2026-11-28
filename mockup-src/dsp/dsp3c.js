/* part 3c: time, space and tools */

/* ================= Delay ================= */
const dsat=(x,g,nn)=>Math.tanh(x*g)*nn;
class FxDelay{constructor(E){this.E=E;const m=Math.floor(E.sr*4)+16;this.dl=[new Delay(m),new Delay(m)];this.tl=0;this.tr=0;this.init=false;
  this.hp=[new BiS(),new BiS()];this.lp=[new BiS(),new BiS()];this.wp=0;this.y=[0,0];this.os=[new OS2(),new OS2()];}
  proc(L,R,n,P){const E=this.E,sr=E.sr,beat=60000/E.pv.bpm,mode=P('mode'),sl=P('syncl'),srr=P('syncr');
    const msL=sl>0?beat*SYNCDIV[sl]:P('timel'),msR=mode===3?(srr>0?beat*SYNCDIV[srr]:P('timer')):msL;
    const tape=mode===2,fb=Math.min(.98,P('fb')),sat=Math.max(P('sat'),tape?.35:0),wow=Math.max(P('wow'),tape?.3:0),hc=tape?Math.min(P('hc'),5500):P('hc');
    for(let c=0;c<2;c++){this.hp[c].set('hp',P('lc'),.7071,0,sr);this.lp[c].set('lp',hc,.7071,0,sr);}
    const tgL=clamp(msL*sr*.001,8,sr*3.9),tgR=clamp(msR*sr*.001,8,sr*3.9);
    if(!this.init){this.tl=tgL;this.tr=tgR;this.init=true;}
    const k=.0012,satg=1+sat*3,satn=1/(1+sat*1.2);let wp=this.wp;for(const o of this.os)o.prep(sr);
    for(let i=0;i<n;i++){
      this.tl+=(tgL-this.tl)*k;this.tr+=(tgR-this.tr)*k;
      const wl=wow>0?1+wow*.004*Math.sin(TAU*wp):1,wr=wow>0?1+wow*.004*Math.sin(TAU*wp*1.13+1):1;wp+=.6/sr;if(wp>1)wp-=1;
      const yl=this.dl[0].read(this.tl*wl-1),yr=this.dl[1].read(this.tr*wr-1);
      let fl=yl,fr=yr;
      fl=this.lp[0].p(0,this.hp[0].p(0,fl));fr=this.lp[1].p(1,this.hp[1].p(1,fr));
      if(sat>0){fl=this.os[0].p(0,fl,dsat,satg,satn);fr=this.os[1].p(1,fr,dsat,satg,satn);}
      if(mode===1){const m=(L[i]+R[i])*.5;this.dl[0].write(m+fb*fr);this.dl[1].write(fb*fl);}
      else{this.dl[0].write(L[i]+fb*fl);this.dl[1].write(R[i]+fb*fr);}
      L[i]=yl;R[i]=yr;}
    this.wp=wp;}}
fx('delay','Delay','Time','Stereo, ping-pong, tape and dual delay with tempo sync, filtered and saturated repeats.',[
 ['mode','Mode',0,0,0,{list:['Stereo','Ping-Pong','Tape','Dual'],tip:'Stereo uses one time. Ping-Pong bounces left and right. Tape adds wobble and warm repeats. Dual has a different time on each side.'}],
 ['syncl','Time sync',0,12,11,{list:SYNCL,tip:'Hz means use the free time below. Anything else locks the delay to the tempo.'}],['timel','Time',1,2000,350,{k:'exp',u:' ms',tip:'Free delay time. Used when Time sync is Hz.'}],
 ['syncr','Right sync',0,12,11,{list:SYNCL,tip:'Right channel time in Dual mode.'}],['timer','Right time',1,2000,350,{k:'exp',u:' ms',tip:'Free right delay time in Dual mode.'}],
 ['fb','Feedback',0,.98,.4,{tip:'How many repeats. High values go on for a long time.'}],['lc','Low cut',20,2000,80,{k:'exp',u:' Hz',tip:'Removes lows from the repeats so they do not build up.'}],['hc','High cut',500,20000,8000,{k:'exp',u:' Hz',tip:'Darkens each repeat.'}],
 ['sat','Saturation',0,1,0,{tip:'Warm saturation inside the feedback loop.'}],['wow','Wobble',0,1,0,{tip:'Tape speed wobble. Changing the time also glides the pitch, like tape.'}]
],FxDelay,.3);

/* ================= Quad taps ================= */
class FxTaps{constructor(E){this.E=E;this.d=new Delay(Math.floor(E.sr*6)+16);this.lp=new BiS();this.hp=new BiS();this.y=0;this.t=[0,0,0,0];this.init=false;}
  proc(L,R,n,P){const E=this.E,sr=E.sr,beat=60/E.pv.bpm,fb=Math.min(.95,P('fb'));
    this.lp.set('lp',P('hc'),.7071,0,sr);this.hp.set('hp',P('lc'),.7071,0,sr);
    const tg=[],lv=[],pn=[];
    for(let k=1;k<=4;k++){tg.push(clamp(beat*SD(P('d'+k))*sr*P('x'+k),8,sr*5.9));lv.push(P('l'+k));pn.push(P('p'+k));}
    if(!this.init){for(let k=0;k<4;k++)this.t[k]=tg[k];this.init=true;}
    for(let i=0;i<n;i++){let oL=0,oR=0,sum=0;
      for(let k=0;k<4;k++){this.t[k]+=(tg[k]-this.t[k])*.0012;const y=this.d.read(this.t[k]-1)*lv[k];sum+=y;
        const a=(pn[k]*.5+.5)*PI/2;oL+=y*Math.cos(a)*1.414;oR+=y*Math.sin(a)*1.414;}
      const m=(L[i]+R[i])*.5,f=this.lp.p(0,this.hp.p(0,sum));this.d.write(m+fb*Math.tanh(f));L[i]=oL;R[i]=oR;}}}
{const ps=[['fb','Feedback',0,.95,.3,{tip:'Feeds all four taps back in for long rhythms.'}]];
 const dd=[2,3,4,9],ll=[1,.8,.6,.45],pp=[-.8,.8,-.4,.4];
 for(let k=1;k<=4;k++){ps.push(['d'+k,'Tap '+k+' time',0,11,dd[k-1],{list:SYNCN,tip:'Length of tap '+k+' in note values.'}]);
   ps.push(['x'+k,'Tap '+k+' stretch',.5,2,1,{k:'exp',tip:'Fine stretch of tap '+k+'. 1 is exact tempo.'}]);
   ps.push(['l'+k,'Tap '+k+' level',0,1,ll[k-1],{tip:'Volume of tap '+k+'.'}]);ps.push(['p'+k,'Tap '+k+' pan',-1,1,pp[k-1],{tip:'Position of tap '+k+' in the stereo field.'}]);}
 ps.push(['lc','Low cut',20,2000,100,{k:'exp',u:' Hz',tip:'Removes lows from the feedback.'}]);ps.push(['hc','High cut',500,20000,9000,{k:'exp',u:' Hz',tip:'Darkens the feedback.'}]);
 fx('taps','Quad Taps','Time','Four independent delay taps, each with its own note value, level and pan. Rhythmic echoes.',ps,FxTaps,.35);}

/* ================= Pitch shifter ================= */
class PS{constructor(sr){this.W=Math.floor(sr*.05);this.d=new Delay(this.W*2+16);this.ph=0;}
  setW(sr,ms){this.W=Math.max(64,Math.floor(sr*ms*.001));}
  p(x,r){this.d.write(x);this.ph+=(1-r)/this.W;this.ph-=Math.floor(this.ph);
    const p2=(this.ph+.5)%1,s1=Math.sin(PI*this.ph),s2=Math.sin(PI*p2);
    return this.d.read(this.ph*this.W)*s1*s1+this.d.read(p2*this.W)*s2*s2;}}
class FxPitch{constructor(E){this.E=E;this.p=[new PS(E.sr),new PS(E.sr)];this.fb=[0,0];}
  proc(L,R,n,P){const sr=this.E.sr,r=Math.pow(2,(P('semi')+P('fine')/100)/12),w=P('win'),fbk=P('fb');
    for(const p of this.p)p.setW(sr,w);
    for(let i=0;i<n;i++){for(let c=0;c<2;c++){const X=c?R:L,y=this.p[c].p(X[i]+this.fb[c]*fbk,r);this.fb[c]=Math.tanh(y);X[i]=y;}}}}
fx('pitch','Pitch Shift','Time','Shifts the pitch without changing the length. Can build rising or falling echoes with feedback.',[
 ['semi','Semitones',-24,24,12,{k:'int',u:' st',tip:'Shift in semitones. 12 is one octave up.'}],['fine','Fine',-100,100,0,{u:' ct',tip:'Fine tune in cents.'}],
 ['win','Window',20,120,50,{u:' ms',tip:'Grain size. Short is tight but grainy, long is smoother but smears.'}],['fb','Feedback',0,.8,0,{tip:'Feeds the shifted sound back in for endless rising or falling pitch.'}]
],FxPitch,.5);

/* ================= Reverb (FDN with ten characters) ================= */
const VBASE=[1087,1283,1471,1699,1949,2203,2467,2749];
const VTYPES=[ // name, size, diffusion, mod, early reflections
 ['Room',.45,.6,.15,.9],['Plate',.8,.8,.3,0],['Hall',1.4,.7,.3,.4],['Cathedral',2.6,.75,.35,.2],['Chamber',.7,.65,.2,.6],
 ['Spring',.35,.3,.05,0],['Shimmer',1.6,.75,.45,0],['Gated',.8,.7,.2,.3],['Bloom',1.8,.8,.4,0],['Ambient',2.0,.85,.6,0]];
const ERT=[11,17,23,31,43,59],ERG=[.7,.6,.5,.45,.35,.3];
class AP1{constructor(max){this.d=new Delay(max);}
  p(x,D,g){const z=this.d.read(D-1),w=x+g*z;this.d.write(w);return z-g*w;}}
class FxVerb{
  constructor(E){this.E=E;const sr=E.sr,m=Math.floor(16384*sr/44100)+64;
    this.ln=[];for(let i=0;i<8;i++)this.ln.push(new Delay(m));
    this.lps=new Float64Array(8);this.lph=new Float64Array(8);for(let i=0;i<8;i++)this.lph[i]=i*.37;
    this.apl=[0,1,2,3].map(()=>new AP1(2048));this.apr=[0,1,2,3].map(()=>new AP1(2048));
    this.spl=[0,1,2,3,4,5].map(()=>new AP1(512));this.spr=[0,1,2,3,4,5].map(()=>new AP1(512));
    this.pre=[new Delay(Math.floor(sr*.55)),new Delay(Math.floor(sr*.55))];
    this.hp=[new BiS(),new BiS()];this.ps=new PS(sr);this.sh=0;this.gate=0;this.hold=0;this.env=0;this.swell=0;this.mo=new Float64Array(8);
    this.dl=new Float64Array(8);this.o=new Float64Array(8);this.gn=new Float64Array(8);this.ty=-1;}
  proc(L,R,n,P){const E=this.E,sr=E.sr,k=sr/44100,ty=P('type'),T=VTYPES[ty],size=P('size'),rt=P('decay'),pd=P('pre')*.001*sr,diff=clamp(T[2]*(.6+.6*P('diff')),.1,.86),md=T[3]*P('mod'),er=T[4]*P('early'),wid=P('width'),shim=P('shim');
    const scale=T[1]*(.5+size)*k;
    for(let i=0;i<8;i++){this.dl[i]=Math.max(32,Math.floor(VBASE[i]*scale));this.gn[i]=Math.pow(10,-3*this.dl[i]/(sr*rt));}
    const dk=1-Math.exp(-TAU*P('damp')/sr),hpf=P('lc');for(let c=0;c<2;c++)this.hp[c].set('hp',hpf,.7071,0,sr);
    const aps=[142,107,379,277].map(x=>Math.max(8,Math.floor(x*k*(.6+.5*size)))),spd=[37,53,71,89,107,131].map(x=>Math.floor(x*k));
    const lfi=[.11,.17,.23,.29,.13,.19,.31,.37];
    const lm=ty===7,bl=ty===8,sp=ty===5,shm=ty===6;
    const holdS=sr*(.08+size*.4),sq=1/Math.sqrt(8);
    for(let i=0;i<n;i++){
      let xl=L[i],xr=R[i];
      this.pre[0].write(xl);this.pre[1].write(xr);
      let pl=pd>1?this.pre[0].read(pd-1):xl,pr=pd>1?this.pre[1].read(pd-1):xr;
      // level for gate and bloom
      const lv=Math.max(Math.abs(xl),Math.abs(xr));
      if(lm){if(lv>.01)this.hold=holdS;else if(this.hold>0)this.hold--;this.gate+=((this.hold>0?1:0)-this.gate)*(this.hold>0?.01:.0015);}
      if(bl){this.swell+=((lv>.005?1:0)-this.swell)*(lv>.005?.00015:.00006);}
      let er_l=0,er_r=0;
      if(er>0){for(let t=0;t<6;t++){const d=Math.floor(ERT[t]*.001*sr*(.5+size)+Math.max(0,pd));const a=this.pre[t&1].read(d);if(t&1)er_r+=a*ERG[t];else er_l+=a*ERG[t];}
        er_l*=er;er_r*=er;}
      let il=pl,ir=pr;
      if(shm){il+=this.sh*shim*.5;ir+=this.sh*shim*.5;}
      if(sp){for(let s=0;s<6;s++){il=this.spl[s].p(il,spd[s],.62);ir=this.spr[s].p(ir,spd[s]+3,.62);}}
      for(let s=0;s<4;s++){il=this.apl[s].p(il,aps[s],diff);ir=this.apr[s].p(ir,aps[s]+11,diff);}
      if(bl){il*=this.swell;ir*=this.swell;}
      const o=this.o;
      for(let j=0;j<8;j++){
        this.lph[j]+=lfi[j]/sr;if(this.lph[j]>1)this.lph[j]-=1;
        const mod=md>0?Math.sin(TAU*this.lph[j])*md*10*k:0;
        let v=this.ln[j].read(this.dl[j]+mod-1);
        this.lps[j]+=dk*(v-this.lps[j]);o[j]=this.lps[j];}
      // output taps
      let oL=(o[0]+o[2]+o[4]+o[6])*.4,oR=(o[1]+o[3]+o[5]+o[7])*.4;
      // hadamard 8
      let a0=o[0]+o[1],a1=o[0]-o[1],a2=o[2]+o[3],a3=o[2]-o[3],a4=o[4]+o[5],a5=o[4]-o[5],a6=o[6]+o[7],a7=o[6]-o[7];
      let b0=a0+a2,b1=a1+a3,b2=a0-a2,b3=a1-a3,b4=a4+a6,b5=a5+a7,b6=a4-a6,b7=a5-a7;
      const m0=(b0+b4)*sq,m1=(b1+b5)*sq,m2=(b2+b6)*sq,m3=(b3+b7)*sq,m4=(b0-b4)*sq,m5=(b1-b5)*sq,m6=(b2-b6)*sq,m7=(b3-b7)*sq;
      const g=this.gn;
      this.ln[0].write(il*.5+g[0]*m0);this.ln[1].write(ir*.5+g[1]*m1);this.ln[2].write(il*.5+g[2]*m2);this.ln[3].write(ir*.5+g[3]*m3);
      this.ln[4].write(il*.5+g[4]*m4);this.ln[5].write(ir*.5+g[5]*m5);this.ln[6].write(il*.5+g[6]*m6);this.ln[7].write(ir*.5+g[7]*m7);
      let wl=oL+er_l,wr=oR+er_r;
      if(shm)this.sh=this.ps.p((wl+wr)*.5,2);
      if(lm){wl*=this.gate;wr*=this.gate;}
      const mm=(wl+wr)*.5,ss=(wl-wr)*.5*wid*2;wl=mm+ss;wr=mm-ss;
      L[i]=this.hp[0].p(0,wl);R[i]=this.hp[1].p(1,wr);}}}
fx('verb','Reverb','Space','Ten reverb characters on one dense engine: room, plate, hall, cathedral, chamber, spring, shimmer, gated, bloom and ambient.',[
 ['type','Type',0,0,2,{list:VTYPES.map(t=>t[0]),tip:'Room is small and lively. Plate is bright and dense. Hall and Cathedral are big. Chamber is in between. Spring drips. Shimmer adds an octave up. Gated cuts the tail. Bloom swells in. Ambient is a huge soft wash.'}],
 ['size','Size',0,1,.5,{tip:'Size of the space. Larger is more spacious and slower to build.'}],['decay','Decay',.1,30,2.6,{k:'exp',u:' s',tip:'How long the tail lasts.'}],['pre','Pre-delay',0,300,15,{u:' ms',tip:'Gap before the reverb starts. Keeps the sound clear in front.'}],
 ['damp','Damping',800,20000,7000,{k:'exp',u:' Hz',tip:'Darkens the tail. Lower is warmer.'}],['lc','Low cut',20,1000,120,{k:'exp',u:' Hz',tip:'Removes lows from the reverb so the mix stays clean.'}],
 ['diff','Diffusion',0,1,.6,{tip:'Smoothness of the tail. High is a smooth wash, low is grainier.'}],['mod','Modulation',0,1,.5,{tip:'Slow movement that removes metallic ringing and adds shimmer.'}],
 ['early','Early',0,1,.6,{tip:'Level of the first reflections. Adds a sense of room.'}],['width','Width',0,1,1,{tip:'Stereo width of the tail.'}],['shim','Shimmer',0,1,.5,{tip:'Amount of octave-up feedback. Only used by the Shimmer type.'}]
],FxVerb,.3);

/* ================= Disperser ================= */
class FxDisp{constructor(E){this.E=E;this.x1=new Float64Array(128);this.y1=new Float64Array(128);this.a=new Float64Array(128);this.b=new Float64Array(128);this.fb=[0,0];}
  proc(L,R,n,P){const sr=this.E.sr,ns=P('amount'),fc=P('freq'),pin=Math.pow(2,P('pinch')*1.5),spr=P('spread'),fbk=P('fb'),oct=P('range');
    for(let k=0;k<ns;k++){const u=(k+.5)/ns*2-1,w=(u<0?-1:1)*Math.pow(Math.abs(u),pin);
      for(let c=0;c<2;c++){const f=clamp(fc*Math.pow(2,w*oct)*(c?1+spr*.6:1),20,sr*.45),t=Math.tan(PI*f/sr);(c?this.b:this.a)[k]=(t-1)/(t+1);}}
    for(let i=0;i<n;i++)for(let c=0;c<2;c++){const X=c?R:L,A=c?this.b:this.a,o=c*64;let y=X[i]+fbk*this.fb[c];
      for(let k=0;k<ns;k++){const a=A[k],j=o+k,out=a*y+this.x1[j]-a*this.y1[j];this.x1[j]=y;this.y1[j]=out;y=out;}
      this.fb[c]=Math.tanh(y*.9);X[i]=y;}}}
fx('disp','Disperser','Tools','Phase smear: a chain of allpass filters that delays frequencies by different amounts. The level stays flat but transients turn into pitched chirps and zaps.',[
 ['amount','Amount',1,64,24,{k:'int',tip:'Number of allpass stages. More stages smear more and make longer chirps.'}],['freq','Frequency',20,20000,800,{k:'exp',u:' Hz',tip:'Centre of the smear. Sets the pitch of the chirp.'}],
 ['pinch','Pinch',-1,1,0,{tip:'Bunches the stages near the frequency (positive) or spreads them out (negative).'}],['range','Range',.5,5,3,{u:' oct',tip:'How wide the stages are spread around the frequency.'}],
 ['fb','Feedback',0,.8,0,{tip:'Feeds the output back in for a resonant, ringing smear.'}],['spread','Stereo',0,1,.2,{tip:'Different smear on left and right for width.'}]
],FxDisp,1);

/* ================= Imager ================= */
class FxImage{constructor(E){this.E=E;this.hp=new BiS();}
  proc(L,R,n,P){const sr=this.E.sr,w=P('width'),bm=P('bass'),pn=P('pan'),mg=dbv(P('mid')),sg=dbv(P('side')),gl=Math.cos((pn*.5+.5)*PI/2)*1.414,gr=Math.sin((pn*.5+.5)*PI/2)*1.414;
    if(bm>25)this.hp.set('hp',bm,.7071,0,sr);
    for(let i=0;i<n;i++){const m=(L[i]+R[i])*.5;let s=(L[i]-R[i])*.5;
      if(bm>25)s=this.hp.p(0,s);
      s*=w*sg;L[i]=(m*mg+s)*gl;R[i]=(m*mg-s)*gr;}}}
fx('image','Imager','Space','Stereo width, mid and side levels, balance and a bass mono maker.',[
 ['width','Width',0,2,1,{tip:'0 is mono, 1 is unchanged, 2 is extra wide.'}],['bass','Bass mono',20,500,20,{k:'exp',u:' Hz',tip:'Makes everything below this mono. 20 Hz is off.'}],
 ['mid','Mid level',-12,12,0,{u:' dB',tip:'Level of the centre of the sound.'}],['side','Side level',-12,12,0,{u:' dB',tip:'Level of the sides of the sound.'}],['pan','Balance',-1,1,0,{tip:'Moves the whole sound left or right.'}]
],FxImage,1);

/* ================= Haas widener ================= */
class FxHaas{constructor(E){this.E=E;this.d=new Delay(Math.floor(E.sr*.04));this.al=[0,1,2,3].map(()=>new AP1(512));this.ar=[0,1,2,3].map(()=>new AP1(512));}
  proc(L,R,n,P){const sr=this.E.sr,t=P('time')*.001*sr,dec=P('decor'),side=P('side');
    const dl=[23,37,53,71].map(x=>Math.floor(x*sr/44100)),dr=[29,43,61,83].map(x=>Math.floor(x*sr/44100)),g=.5*dec;
    for(let i=0;i<n;i++){let l=L[i],r=R[i];
      if(dec>0){for(let k=0;k<4;k++){l=this.al[k].p(l,dl[k],g);r=this.ar[k].p(r,dr[k],-g);}}
      if(t>1){const X=side===0?l:r;this.d.write(X);const y=this.d.read(t-1);if(side===0)l=y;else r=y;}
      L[i]=l;R[i]=r;}}}
fx('haas','Wide','Space','Widens a sound with a short delay on one side and smearing filters. Check it in mono.',[
 ['time','Haas time',0,30,12,{u:' ms',tip:'Delay on one side. 5 to 20 ms widens without a clear echo.'}],['side','Delayed side',0,0,1,{list:['Left','Right'],tip:'Which side is delayed.'}],['decor','Decorrelate',0,1,.4,{tip:'Smears left and right differently for a wider, softer image.'}]
],FxHaas,.6);

/* ================= Utility ================= */
class FxUtil{constructor(E){this.E=E;this.dc=[0,0];this.g=1;}
  proc(L,R,n,P){const g=P('gain')<=-60?0:dbv(P('gain')),pn=P('pan'),gl=Math.cos((pn*.5+.5)*PI/2)*1.414,gr=Math.sin((pn*.5+.5)*PI/2)*1.414,mono=P('mono'),inv=P('invert'),sw=P('swap'),dcf=P('dc');
    const sm=1-Math.exp(-1/(this.E.sr*.004));let cg=this.g;
    for(let i=0;i<n;i++){let l=L[i],r=R[i];
      if(sw){const t=l;l=r;r=t;}if(inv===1||inv===3)l=-l;if(inv===2||inv===3)r=-r;
      if(mono){l=r=(l+r)*.5;}
      if(dcf){this.dc[0]+=.0008*(l-this.dc[0]);this.dc[1]+=.0008*(r-this.dc[1]);l-=this.dc[0];r-=this.dc[1];}
      cg+=(g-cg)*sm;L[i]=l*cg*gl;R[i]=r*cg*gr;}
    this.g=cg;}}
fx('util','Utility','Tools','Gain, pan, mono, polarity flip, channel swap and DC removal.',[
 ['gain','Gain',-60,24,0,{u:' dB',tip:'Level. -60 is silence.'}],['pan','Pan',-1,1,0,{tip:'Moves the sound left or right.'}],['mono','Mono',0,1,0,{k:'int',tip:'Sums left and right to mono.'}],
 ['invert','Invert',0,3,0,{list:['Off','Left','Right','Both'],tip:'Flips the polarity of a channel.'}],['swap','Swap L/R',0,1,0,{k:'int',tip:'Swaps left and right.'}],['dc','DC filter',0,1,0,{k:'int',tip:'Removes any DC offset.'}]
],FxUtil,-1);

/* ================= Sub / bass enhancer ================= */
const subfn=x=>Math.tanh(x*4)*.6-x*.3;
class FxSubx{constructor(E){this.E=E;this.os=new OS2();this.lp=new BiS();this.lp2=new BiS();this.hp=new BiS();this.dc=0;}
  proc(L,R,n,P){const sr=this.E.sr,f=P('freq'),amt=P('amount'),hm=P('harm'),lv=dbv(P('level'));this.os.prep(sr);
    this.lp.set('lp',f,.7071,0,sr);this.lp2.set('lp',f*2.2,.7071,0,sr);this.hp.set('hp',f*.5,.7071,0,sr);
    for(let i=0;i<n;i++){const m=(L[i]+R[i])*.5,low=this.lp.p(0,m);
      const h=this.lp2.p(0,this.hp.p(0,this.os.p(0,low,subfn)))*hm;
      const add=(low*amt*.5+h*amt)*lv;
      L[i]+=add;R[i]+=add;}}}
fx('subx','Bass Weight','Tools','Adds weight and harmonics to the low end so the bass is heard on small speakers and stays mono.',[
 ['freq','Frequency',30,200,80,{k:'exp',u:' Hz',tip:'Bass range it works on.'}],['amount','Amount',0,1,.5,{tip:'How much weight is added.'}],['harm','Harmonics',0,1,.5,{tip:'Adds overtones so the bass is audible on small speakers.'}],
['level','Level',-12,12,0,{u:' dB',tip:'Level of the added weight.'}]
],FxSubx,1);

/* ================= Exciter ================= */
const EXK=1-Math.tanh(.25)**2,excfn=(x,dr,bias)=>Math.tanh(x*dr+bias)-Math.tanh(bias)-x*dr*EXK; // harmonics only: the linear part is added without delay
class FxExc{constructor(E){this.E=E;this.hp=new BiS();this.lp=new BiS();this.os=[new OS4(),new OS4()];}
  proc(L,R,n,P){const sr=this.E.sr,f=P('freq'),amt=P('amount'),dr=dbv(P('drive')),bias=.25;for(const o of this.os)o.prep(sr);
    this.hp.set('hp',f,.7071,0,sr);this.lp.set('lp',Math.min(sr*.45,f*6),.7071,0,sr);
    for(let i=0;i<n;i++)for(let c=0;c<2;c++){const X=c?R:L,h=this.hp.p(c,X[i]),s=h*dr*EXK+this.os[c].p(c,h,excfn,dr,bias);X[i]+=this.lp.p(c,s)*amt;}}}
fx('exciter','Exciter','Tools','Adds shine: saturates the highs and mixes the new harmonics in.',[
 ['freq','Above',1000,12000,4000,{k:'exp',u:' Hz',tip:'Only frequencies above this are excited.'}],['drive','Drive',0,24,10,{u:' dB',tip:'How hard the highs are saturated.'}],['amount','Amount',0,1.5,.5,{tip:'Level of the added harmonics.'}]
],FxExc,1);

/* ================= Stutter ================= */
class FxStutter{constructor(E){this.E=E;const m=Math.floor(E.sr*2);this.bl=new Float32Array(m);this.br=new Float32Array(m);this.m=m;this.w=0;this.fl=new Float32Array(m);this.fr=new Float32Array(m);this.on=false;this.pos=0;this.len=0;this.last=-1;}
  proc(L,R,n,P){const E=this.E,sr=E.sr,sl=SD(P('div')),pr=P('prob'),slen=SD(P('len')),adv=E.pv.bpm/60/sr;let bp=E.beat;
    const len=Math.max(32,Math.min(this.m-1,Math.floor(slen*60/E.pv.bpm*sr)));
    for(let i=0;i<n;i++){
      this.bl[this.w]=L[i];this.br[this.w]=R[i];this.w=(this.w+1)%this.m;
      const idx=Math.floor(bp/sl);
      if(idx!==this.last){this.last=idx;this.on=Math.random()<pr;
        if(this.on){this.len=len;for(let k=0;k<len;k++){const q=(this.w-len+k+this.m*2)%this.m;this.fl[k]=this.bl[q];this.fr[k]=this.br[q];}this.pos=0;}}
      if(this.on){const f=Math.min(1,this.pos/48,(this.len-this.pos)/48);const g=f<1?f:1;L[i]=this.fl[this.pos]*g+L[i]*(1-g);R[i]=this.fr[this.pos]*g+R[i]*(1-g);this.pos=(this.pos+1)%this.len;}
      bp+=adv;}}}
fx('stutter','Stutter','Time','Repeats a slice of the sound on the beat for glitchy rolls.',[
 ['div','Trigger',0,11,3,{list:SYNCN,tip:'How often a new slice is chosen.'}],['len','Slice',0,11,4,{list:SYNCN,tip:'Length of the repeated slice.'}],['prob','Chance',0,1,.5,{tip:'Chance that a trigger starts a stutter.'}]
],FxStutter,1);
