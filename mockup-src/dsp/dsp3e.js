/* part 3e: gate, dynamic EQ, tape, granular, freeze, envelope filter, vocoder, talk box, autotune, Fat Cat.
   The voice FX need no microphone and no side input: they work on the synth's own sound. */

/* ================= Noise gate ================= */
class FxGate{constructor(E){this.E=E;this.e=0;this.g=1;this.open=true;this.hc=0;this.gr=0;}
  proc(L,R,n,P){const sr=this.E.sr,thr=dbv(P('thr')),lo=dbv(P('thr')-P('hyst')),rng=P('range')<=-79.5?0:dbv(P('range')),at=1-Math.exp(-1/(sr*P('att')*.001)),rl=1-Math.exp(-1/(sr*P('rel')*.001)),H=Math.round(sr*P('hold')*.001),ek=Math.exp(-1/(sr*.004));
    let e=this.e,g=this.g,gmin=1;
    for(let i=0;i<n;i++){const x=Math.max(Math.abs(L[i]),Math.abs(R[i]));
      e=x>e?x:ek*e+(1-ek)*x;
      if(e>thr){this.open=true;this.hc=H;}else if(e<lo){if(this.hc>0)this.hc--;else this.open=false;}
      const t=this.open?1:rng;g+=(t-g)*(t>g?at:rl);L[i]*=g;R[i]*=g;if(g<gmin)gmin=g;}
    this.e=e;this.g=g;this.gr=Math.max(-80,20*Math.log10(gmin+1e-9));}}
fx('gate','Noise Gate','Dynamics','Turns the sound down when it falls below a level. Cleans tails and noise, or chops a sound short.',[
 ['thr','Threshold',-80,0,-40,{u:' dB',tip:'The gate opens when the sound is louder than this.'}],['range','Range',-80,0,-80,{u:' dB',tip:'How far the sound is turned down when the gate is closed. -80 is silence.'}],
 ['att','Attack',.1,50,1,{k:'exp',u:' ms',tip:'How fast the gate opens.'}],['hold','Hold',0,500,30,{u:' ms',tip:'How long the gate stays open after the sound drops below the threshold.'}],
 ['rel','Release',5,2000,120,{k:'exp',u:' ms',tip:'How fast the gate closes.'}],['hyst','Hysteresis',0,12,4,{u:' dB',tip:'The gate closes this much below the threshold, so it does not flutter.'}]
],FxGate,1);

/* ================= Dynamic EQ ================= */
class FxDeq{constructor(E){this.E=E;this.d=[0,1,2].map(()=>new BiS());this.f=[0,1,2].map(()=>new BiS());this.e=[0,0,0];this.gr=0;}
  proc(L,R,n,P){const sr=this.E.sr,at=Math.exp(-1/(sr*P('att')*.001)),rl=Math.exp(-1/(sr*P('rel')*.001));let gm=0;
    for(let b=0;b<3;b++){const k=b+1,rg=P('r'+k);if(Math.abs(rg)<.05)continue;
      const f=P('f'+k),q=P('q'+k),thr=P('t'+k),D=this.d[b],F=this.f[b];D.set('bp',f,q,0,sr);let e=this.e[b];
      for(let i=0;i<n;i++){const y=Math.abs(D.p(0,(L[i]+R[i])*.5));e=y>e?at*e+(1-at)*y:rl*e+(1-rl)*y;}
      this.e[b]=e;const g=rg*clamp((20*Math.log10(e+1e-9)-thr)/12,0,1);
      F.set('peak',f,q,g,sr);for(let i=0;i<n;i++){L[i]=F.p(0,L[i]);R[i]=F.p(1,R[i]);}
      if(g<gm)gm=g;}
    this.gr=gm;}}
{const ps=[],ff=[150,1200,6000];
 for(let k=1;k<=3;k++){ps.push(['f'+k,'Band '+k+' freq',20,18000,ff[k-1],{k:'exp',u:' Hz',tip:'Centre of band '+k+'.'}]);ps.push(['q'+k,'Band '+k+' Q',.3,8,1.2,{k:'exp',tip:'Width of band '+k+'. Higher is narrower.'}]);
   ps.push(['t'+k,'Band '+k+' threshold',-60,0,-24,{u:' dB',tip:'Band '+k+' starts to move when its own level passes this. The full range is reached 12 dB above it.'}]);
   ps.push(['r'+k,'Band '+k+' range',-18,18,0,{u:' dB',tip:'How far band '+k+' moves when it is loud. Negative cuts (tames harshness or boom), positive boosts. 0 is off.'}]);}
 ps.push(['att','Attack',.5,200,10,{k:'exp',u:' ms',tip:'How fast the bands react.'}]);ps.push(['rel','Release',10,2000,150,{k:'exp',u:' ms',tip:'How fast the bands let go.'}]);
 fx('deq','Dynamic EQ','Tone','Three EQ bands that only move when their own frequency range gets loud. Tames harsh or boomy moments and leaves the rest alone.',ps,FxDeq,-1);}

/* ================= Tape ================= */
const tapefn=(x,d,b)=>(Math.tanh(x*d+b)-Math.tanh(b))/Math.sqrt(d);
class FxTape{constructor(E){this.E=E;const m=Math.floor(E.sr*.05)+16;this.d=[new Delay(m),new Delay(m)];this.ad=[new Delay(m),new Delay(m)];this.os=[new OS4(),new OS4()];this.lp=[new BiS(),new BiS()];this.ls=[new BiS(),new BiS()];this.w=0;this.f=0;this.dc=[0,0];this.base=64;}
  proc(L,R,n,P){const sr=this.E.sr,dg=dbv(P('drive')),bias=P('bias')*.35,wow=P('wow'),fl=P('flutter'),og=dbv(P('level')),hiss=P('hiss')*.004;
    for(let c=0;c<2;c++){this.lp[c].set('lp',P('hf'),.62,0,sr);this.ls[c].set('ls',95,.7,P('bump'),sr);}
    const base=Math.round(sr*.008);this.base=base;let w=this.w,f=this.f;const wd=wow*sr*.0022,fd=fl*sr*.00022;
    for(let i=0;i<n;i++){const mod=wd*Math.sin(TAU*w)+fd*(Math.sin(TAU*f)+.5*Math.sin(TAU*f*2.37+1));w+=.55/sr;if(w>=1)w-=1;f+=6.3/sr;if(f>=100)f-=100;
      for(let c=0;c<2;c++){const X=c?R:L;let y=this.os[c].p(c,X[i],tapefn,dg,bias);if(hiss>0)y+=(Math.random()*2-1)*hiss;
        y=this.ls[c].p(c,this.lp[c].p(c,y));this.dc[c]+=DCB*(y-this.dc[c]);this.d[c].write(y-this.dc[c]);X[i]=this.d[c].read(base+mod*(c?1.04:1)-1)*og;}}
    this.w=w;this.f=f;}
  alignDry(L,R,n){const b=this.base;for(let i=0;i<n;i++){this.ad[0].write(this.os[0].lin(0,L[i]));this.ad[1].write(this.os[1].lin(1,R[i]));L[i]=this.ad[0].read(b-1);R[i]=this.ad[1].read(b-1);}}}
fx('tape','Tape','Distort','Tape machine: soft saturation, a low end bump, rolled off highs, slow wow and fast flutter. Warm and slightly unsteady.',[
 ['drive','Drive',0,24,6,{u:' dB',tip:'How hard the tape is hit. More is thicker and more squashed.'}],['bias','Bias',-1,1,.2,{tip:'Shifts the tape curve for even harmonics and a warmer tone.'}],
 ['bump','Head bump',0,9,2,{u:' dB',tip:'The low end lift of a tape head, around 95 Hz.'}],['hf','High roll-off',2000,20000,13000,{k:'exp',u:' Hz',tip:'Tape loses highs. Lower is darker and older.'}],
 ['wow','Wow',0,1,.15,{tip:'Slow pitch drift, like an uneven reel.'}],['flutter','Flutter',0,1,.1,{tip:'Fast pitch shake, like a worn tape path.'}],['hiss','Hiss',0,1,0,{tip:'Tape noise.'}],['level','Level',-24,12,0,{u:' dB',tip:'Output level.'}]
],FxTape,1);

/* ================= Granular ================= */
class FxGran{constructor(E){this.E=E;let n=2;while(n<E.sr*4.2)n<<=1;this.bl=new Float32Array(n);this.br=new Float32Array(n);this.m=n-1;this.w=0;this.t=0;this.fb=[0,0];
    this.gs=[];for(let i=0;i<24;i++)this.gs.push({on:false,pos:0,inc:1,len:1,age:0,gl:1,gr:1});}
  proc(L,R,n,P){const sr=this.E.sr,size=Math.max(64,P('size')*.001*sr),dens=P('density'),spray=P('spray')*sr,pit=P('pitch'),prnd=P('prand'),rev=P('rev'),spr=P('spread'),fb=P('fb');
    const m=this.m,bl=this.bl,br=this.br,gs=this.gs,norm=1/Math.sqrt(Math.max(1,dens*size/sr*.5)),maxOff=m-size*4.2-64;
    for(let i=0;i<n;i++){
      bl[this.w]=L[i]+fb*this.fb[0];br[this.w]=R[i]+fb*this.fb[1];
      this.t-=1;
      if(this.t<=0){this.t+=sr/dens*(.7+.6*Math.random());
        let g=null;for(const q of gs)if(!q.on){g=q;break;}
        if(g){const r=Math.pow(2,(pit+(Math.random()*2-1)*prnd)/12),back=Math.random()<rev,pan=(Math.random()*2-1)*spr,a=(pan*.5+.5)*PI/2;
          g.on=true;g.len=size;g.age=0;g.inc=back?-r:r;g.gl=Math.cos(a)*1.414;g.gr=Math.sin(a)*1.414;
          const off=Math.min(Math.max(64,maxOff),64+(back?0:Math.max(0,(r-1)*size))+Math.random()*spray);g.pos=this.w-off+(back?0:0);if(back)g.pos=this.w-64-Math.random()*spray;}}
      let oL=0,oR=0;
      for(const g of gs){if(!g.on)continue;const s=Math.sin(PI*g.age/g.len),wn=s*s,p=g.pos,ip=Math.floor(p),f=p-ip,a=ip&m,b=(ip+1)&m;
        oL+=(bl[a]+(bl[b]-bl[a])*f)*wn*g.gl;oR+=(br[a]+(br[b]-br[a])*f)*wn*g.gr;g.pos+=g.inc;g.age++;if(g.age>=g.len)g.on=false;}
      this.w=(this.w+1)&m;oL*=norm;oR*=norm;this.fb[0]=Math.tanh(oL);this.fb[1]=Math.tanh(oR);L[i]=oL;R[i]=oR;}}}
fx('gran','Granular','Time','Cuts the sound into small grains and scatters them in time, pitch and space. Clouds, shimmer, glitches and frozen-like textures.',[
 ['size','Grain size',10,500,120,{k:'exp',u:' ms',tip:'Length of one grain. Short is buzzy and glitchy, long is smooth.'}],['density','Density',1,80,14,{k:'exp',u:' /s',tip:'Grains per second. More is a thicker cloud.'}],
 ['spray','Spray',0,2,.12,{u:' s',tip:'How far back in time the grains are picked from, at random. More smears the rhythm.'}],['pitch','Pitch',-24,24,0,{u:' st',tip:'Pitch of the grains in semitones.'}],
 ['prand','Pitch random',0,12,0,{u:' st',tip:'Random pitch per grain. Small values shimmer, large values scatter.'}],['rev','Reverse',0,1,0,{tip:'Chance that a grain plays backwards.'}],
 ['spread','Stereo',0,1,.7,{tip:'Random position of each grain between left and right.'}],['fb','Feedback',0,.9,0,{tip:'Feeds the grains back in. With pitch it climbs or falls.'}]
],FxGran,.5);

/* ================= Freeze ================= */
class FxFreeze{constructor(E){this.E=E;let n=2;while(n<E.sr*3.2)n<<=1;this.bl=new Float32Array(n);this.br=new Float32Array(n);this.fl=new Float32Array(n);this.fr=new Float32Array(n);this.m=n-1;this.w=0;this.on=false;this.g=0;this.pos=0;this.len=0;}
  proc(L,R,n,P){const sr=this.E.sr,want=P('on')>=.5,size=clamp(Math.floor(P('size')*.001*sr),256,this.m-1),thru=P('thru'),lvl=dbv(P('level')),r=Math.pow(2,P('pitch')/12),sm=1-Math.exp(-1/(sr*P('fade')*.001));
    const m=this.m,fl=this.fl,fr=this.fr;
    for(let i=0;i<n;i++){
      this.bl[this.w]=L[i];this.br[this.w]=R[i];this.w=(this.w+1)&m;
      if(want&&!this.on&&this.g<.001){this.len=size;for(let k=0;k<size;k++){const q=(this.w-size+k)&m;fl[k]=this.bl[q];fr[k]=this.br[q];}this.pos=0;this.on=true;}
      if(!want)this.on=false;
      this.g+=((this.on?1:0)-this.g)*sm;const g=this.g;
      if(g>1e-4&&this.len>0){const len=this.len,p1=this.pos,p2=(p1+len*.5)%len,w1=Math.sin(PI*p1/len),w2=Math.sin(PI*p2/len);
        const a1=Math.floor(p1),f1=p1-a1,b1=(a1+1)%len,a2=Math.floor(p2),f2=p2-a2,b2=(a2+1)%len;
        const zl=(fl[a1]+(fl[b1]-fl[a1])*f1)*w1+(fl[a2]+(fl[b2]-fl[a2])*f2)*w2,zr=(fr[a1]+(fr[b1]-fr[a1])*f1)*w1+(fr[a2]+(fr[b2]-fr[a2])*f2)*w2;
        this.pos+=r;if(this.pos>=len)this.pos-=len;
        const dg=1-g*(1-thru);L[i]=L[i]*dg+zl*g*lvl;R[i]=R[i]*dg+zr*g*lvl;}}}}
fx('freeze','Freeze','Time','Holds the last moment of the sound as an endless loop without clicks. Switch it on by hand, or move On with an LFO, a macro or the mod wheel.',[
 ['on','On',0,1,0,{k:'int',tip:'1 freezes the sound, 0 lets it go. Route a macro, the wheel or a square LFO here to play it.'}],['size','Size',50,3000,400,{k:'exp',u:' ms',tip:'Length of the held moment. Short is a tone, long keeps the movement.'}],
 ['pitch','Pitch',-24,24,0,{u:' st',tip:'Pitch of the frozen sound.'}],['fade','Fade',5,2000,30,{k:'exp',u:' ms',tip:'How fast the frozen sound comes in and goes out.'}],
 ['thru','Play over',0,1,1,{tip:'How much of the live sound still passes while frozen. 0 is only the frozen sound.'}],['level','Level',-24,12,0,{u:' dB',tip:'Level of the frozen sound.'}]
],FxFreeze,1);

/* ================= Envelope filter ================= */
class FxEnvF{constructor(E){this.E=E;this.e=0;this.s=new Float64Array(4);this.g=.05;}
  proc(L,R,n,P){const sr=this.E.sr,type=P('type'),base=P('freq'),rng=P('range'),res=P('res'),k=2*Math.pow(.02,res),sens=dbv(P('sens')),at=Math.exp(-1/(sr*P('att')*.001)),rl=Math.exp(-1/(sr*P('rel')*.001));
    let e=this.e,g=this.g;const s=this.s,cp=.45+.55*Math.min(1,k),bg=k*(1+3*res);
    for(let i=0;i<n;i++){const a=Math.max(Math.abs(L[i]),Math.abs(R[i]))*sens;e=a>e?at*e+(1-at)*a:rl*e+(1-rl)*a;
      if((i&7)===0)g=Math.tan(PI*clamp(base*Math.pow(2,rng*Math.min(1,e)),20,sr*.45)/sr);
      const a1=1/(1+g*(g+k)),a2=g*a1,a3=g*a2;
      for(let c=0;c<2;c++){const X=c?R:L,x=X[i],o=c*2,v3=x-s[o+1],v1=a1*s[o]+a2*v3,v2=s[o+1]+a2*s[o]+a3*v3;s[o]=2*v1-s[o];s[o+1]=2*v2-s[o+1];
        X[i]=type===0?v2*cp:type===1?v1*bg:type===2?(x-k*v1-v2)*cp:x-k*v1;}}
    this.e=e;this.g=g;this.val=Math.min(1,e);}}
fx('envf','Envelope Filter','Filter','Auto-wah: the filter opens with the loudness of the sound itself. Funky quacks, plucky sweeps and talking basses.',[
 ['type','Type',0,0,0,{list:['Low-pass','Band-pass','High-pass','Notch'],tip:'Which part of the sound the filter lets through.'}],['freq','Frequency',40,8000,250,{k:'exp',u:' Hz',tip:'Where the filter rests when the sound is quiet.'}],
 ['range','Range',-5,5,3.5,{u:' oct',tip:'How far the filter moves when the sound is loud. Negative moves down.'}],['res','Resonance',0,1,.6,{tip:'Sharpness of the filter. High values quack.'}],
 ['sens','Sensitivity',-12,36,12,{u:' dB',tip:'How easily the sound opens the filter.'}],['att','Attack',.5,200,8,{k:'exp',u:' ms',tip:'How fast the filter opens.'}],['rel','Release',10,2000,180,{k:'exp',u:' ms',tip:'How fast the filter falls back.'}]
],FxEnvF,1);

/* ================= Vocoder (no microphone: the track itself is the voice) ================= */
const VOCN=[8,12,16,24],VOCG=[1,.55,1.6,.65,.3,1,1,1,1];
class FxVoc{constructor(E){this.E=E;this.an=[];this.s1=[];this.s2=[];for(let i=0;i<24;i++){this.an.push(new BiS());this.s1.push(new BiS());this.s2.push(new BiS());}
    this.env=new Float64Array(24);this.ok=new Uint8Array(24);this.ph=new Float64Array(8);this.key='';this.pit=60;this.hp=new BiS();this.he=0;}
  proc(L,R,n,P){const E=this.E,sr=E.sr,nb=VOCN[P('bands')],car=P('carrier'),shift=Math.pow(2,P('shift')/12),at=1-Math.exp(-1/(sr*P('att')*.001)),rl=1-Math.exp(-1/(sr*P('rel')*.001)),tune=P('tune'),wide=P('spread'),unv=P('unvoiced'),og=dbv(P('gain'))*10.5*Math.pow(nb/8,.7)*VOCG[car],hold=P('hold')>=.5;
    const lo=90,hi=Math.min(11000,sr*.4),ratio=Math.pow(hi/lo,1/(nb-1)),q=1.15/(Math.sqrt(ratio)-1/Math.sqrt(ratio)),key=nb+'|'+shift.toFixed(4)+'|'+sr;
    if(key!==this.key){this.key=key;for(let b=0;b<nb;b++){const f=lo*Math.pow(ratio,b),fs=f*shift;this.an[b].set('bp',f,q,0,sr);this.ok[b]=fs>30&&fs<sr*.45?1:0;if(this.ok[b]){this.s1[b].set('bp',fs,q,0,sr);this.s2[b].set('bp',fs,q,0,sr);}}
      this.hp.set('hp',5000,.7071,0,sr);}
    const tgt=(E.curPitch===undefined?60:E.curPitch)+tune;this.pit+=(tgt-this.pit)*.35;const f0=mtof(this.pit),det=wide*.006,ph=this.ph,env=this.env;
    const tk=car>=5&&E.tk?E.tk[car-5]:null,top=Math.floor(nb*.7);
    for(let i=0;i<n;i++){const md=(L[i]+R[i])*.5;let cl=0,cr=0;
      if(car===0||car===1){for(let c=0;c<2;c++){const dt=Math.min(.45,f0*(c?1-det:1+det)/sr);let p=ph[c]+dt;if(p>=1)p-=1;ph[c]=p;
          let v;if(car===0)v=2*p-1-pblep(p,dt);else{let p2=p+.5;if(p2>=1)p2-=1;v=(p<.5?1:-1)+pblep(p,dt)-pblep(p2,dt);}
          if(c)cr=v;else cl=v;}}
      else if(car===2){cl=Math.random()*2-1;cr=Math.random()*2-1;}
      else if(car===3){const st=[0,7,12,-12,19,24];for(let k=0;k<6;k++){const dt=Math.min(.45,f0*Math.pow(2,st[k]/12)*(1+(k&1?-det:det))/sr);let p=ph[k]+dt;if(p>=1)p-=1;ph[k]=p;const v=(2*p-1-pblep(p,dt))*.45;if(k&1)cr+=v;else cl+=v;}
        const mm=(cl+cr)*.5,sd=(cl-cr)*.5*(.3+.7*wide);cl=mm+sd;cr=mm-sd;}
      else if(car===4){cl=Math.tanh(L[i]*6);cr=Math.tanh(R[i]*6);}
      else if(tk){cl=tk.l[i];cr=tk.r[i];}
      let oL=0,oR=0,hs=0;
      for(let b=0;b<nb;b++){if(!hold){const y=Math.abs(this.an[b].p(0,md));let e=env[b];e+=(y-e)*(y>e?at:rl);env[b]=e;}
        const e=env[b];if(b>=top)hs+=e;if(this.ok[b]){oL+=this.s2[b].p(0,this.s1[b].p(0,cl))*e;oR+=this.s2[b].p(1,this.s1[b].p(1,cr))*e;}}
      if(unv>0){const z=this.hp.p(0,Math.random()*2-1)*hs*unv*.12;oL+=z;oR+=z;}
      L[i]=oL*og;R[i]=oR*og;}}}
fx('voc','Vocoder','Voice','Robot voice without a microphone. The sound on this track shapes a carrier: a built-in oscillator that follows your notes, the track itself, or another track of the synth.',[
 ['carrier','Carrier',0,0,0,{list:['Saw','Pulse','Noise','Chord','Self','Track 1','Track 2','Track 3','Track 4'],tip:'What gets shaped. Saw, Pulse and Chord follow the notes you play. Noise whispers. Self reshapes the track with its own tone (use Formant shift). Track 1 to 4 use the sound of another track of this synth.'}],
 ['bands','Bands',0,0,2,{list:['8','12','16','24'],tip:'Number of bands. Few is rough and robotic, many is clearer.'}],['shift','Formant shift',-12,12,0,{u:' st',tip:'Moves the shape up or down against the carrier. Small to giant.'}],
 ['att','Attack',.5,100,4,{k:'exp',u:' ms',tip:'How fast the bands follow the sound.'}],['rel','Release',5,1000,60,{k:'exp',u:' ms',tip:'How fast the bands fall. Long values smear into a pad.'}],
 ['tune','Carrier tune',-24,24,0,{k:'int',u:' st',tip:'Pitch of the built-in carrier against the played note.'}],['spread','Stereo',0,1,.5,{tip:'Detunes the carrier left and right for width.'}],
 ['unvoiced','Breath',0,1,0,{tip:'Adds noise where the sound has bright, hissy parts, so it stays clear.'}],['hold','Hold',0,1,0,{k:'int',tip:'1 holds the current shape, like a frozen vowel. Route a macro or LFO here.'}],['gain','Gain',-24,24,0,{u:' dB',tip:'Output level.'}]
],FxVoc,1);

/* ================= Talk box (vowel steps, no microphone) ================= */
const TBF=[[650,1080,2650,2900],[400,1700,2600,3200],[290,1870,2800,3250],[400,800,2600,2800],[350,600,2700,2900]]; // A E I O U, textbook tenor formants (approximate)
const TBG=[[1,.5,.45,.4],[1,.2,.25,.2],[1,.18,.13,.1],[1,.32,.25,.25],[1,.1,.14,.2]];
class FxTalk{constructor(E){this.E=E;this.os=[new OS4(),new OS4()];this.b=[0,1,2,3].map(()=>new BiS());this.ph=0;this.e=0;this.gn=[1,0,0,0];this.x=0;}
  proc(L,R,n,P){const E=this.E,sr=E.sr,mode=P('mode'),steps=P('steps'),glide=P('glide'),sh=Math.pow(2,P('shift')),q=4+P('res')*16,dg=dbv(P('drive')),og=dbv(P('gain'))*4,sens=dbv(P('sens')),pos=P('pos');
    const inc=rateOf(E,P)/sr/(mode===1?steps:1),ek=Math.exp(-1/(sr*.03)),ea=Math.exp(-1/(sr*.004));for(const o of this.os)o.prep(sr);
    const sv=[];for(let k=1;k<=8;k++)sv.push(clamp(P('s'+k),0,4));
    let ph=this.ph,e=this.e;
    for(let i=0;i<n;i++){const a=Math.max(Math.abs(L[i]),Math.abs(R[i]))*sens;e=a>e?ea*e+(1-ea)*a:ek*e+(1-ek)*a;
      if((i&15)===0){let x;
        if(mode===0)x=(.5-.5*Math.cos(TAU*ph))*(steps-1)+pos*(steps-1);else if(mode===1)x=ph*steps+pos*steps;else if(mode===2)x=Math.min(1,e)*(steps-1)+pos*(steps-1);else x=pos*(steps-1);
        let i0,i1,fr;
        if(mode===1){x=((x%steps)+steps)%steps;i0=Math.floor(x);fr=x-i0;i1=(i0+1)%steps;fr=glide<=.001?0:clamp((fr-(1-glide))/glide,0,1);}
        else{x=clamp(x,0,steps-1);i0=Math.min(steps-1,Math.floor(x));fr=x-i0;i1=Math.min(steps-1,i0+1);}
        fr=fr*fr*(3-2*fr);const A=sv[i0],B=sv[i1];
        for(let k=0;k<4;k++){const fa=(v=>{const j=Math.min(3,Math.floor(v)),t=v-j;return [TBF[j][k]*(1-t)+TBF[j+1][k]*t,TBG[j][k]*(1-t)+TBG[j+1][k]*t];}),pa=fa(A),pb=fa(B);
          this.b[k].set('bp',clamp((pa[0]*(1-fr)+pb[0]*fr)*sh,40,sr*.45),q*(k===0?.7:1),0,sr);this.gn[k]=pa[1]*(1-fr)+pb[1]*fr;}
        this.x=x;}
      for(let c=0;c<2;c++){const X=c?R:L,x=dg>1.01?this.os[c].p(c,X[i],vtanh,dg,0):X[i];let s=0;for(let k=0;k<4;k++)s+=this.gn[k]*this.b[k].p(c,x);X[i]=s*og;}
      ph+=inc;if(ph>=1)ph-=1;}
    this.ph=ph;this.e=e;}}
{const VW=['A','E','I','O','U'],dv=[0,1,2,3,4,0,3,1];
 const ps=[['mode','Mode',0,0,1,{list:['LFO','Steps','Envelope','Manual'],tip:'How the mouth moves. LFO sweeps back and forth through the vowels. Steps says them one after the other in time. Envelope opens with the loudness of the sound (wow, yoy). Manual uses the Position knob only.'}],
  ['rate','Rate',.05,20,2,{k:'exp',u:' Hz',tip:'Speed of the sweep, or vowels per second in Steps mode.'}],RSYNC,['steps','Vowels',2,8,4,{k:'int',tip:'How many of the vowel slots are used.'}]];
 for(let k=1;k<=8;k++)ps.push(['s'+k,'Vowel '+k,0,4,dv[k-1],{list:VW,tip:'Vowel in slot '+k+'.'}]);
 ps.push(['glide','Glide',0,1,.6,{tip:'How smoothly the mouth moves from one vowel to the next in Steps mode. 0 jumps.'}],['shift','Formant shift',-1,1,0,{tip:'Size of the mouth: up to an octave smaller or larger.'}],
  ['res','Sharpness',0,1,.5,{tip:'Narrower formants sound more like a real voice.'}],['drive','Drive',0,24,12,{u:' dB',tip:'Saturation before the mouth, like the driver of a talk box. Makes the vowels speak.'}],
  ['sens','Sensitivity',0,36,12,{u:' dB',tip:'How easily the sound moves the mouth in Envelope mode.'}],['pos','Position',0,1,0,{tip:'Moves the mouth by hand. Route a macro, the wheel or an envelope here.'}],['gain','Gain',-12,12,0,{u:' dB',tip:'Output level.'}]);
 fx('talk','Talk Box','Voice','Makes the synth say vowels, with no microphone: up to eight vowel slots moved by an LFO, by steps in time, by the loudness of the sound or by hand.',ps,FxTalk,1);}

/* ================= Autotune (uses the notes you play, so there is no detection and no delay) ================= */
const TSC=[['Chromatic',[0,1,2,3,4,5,6,7,8,9,10,11]],['Major',[0,2,4,5,7,9,11]],['Minor',[0,2,3,5,7,8,10]],['Harmonic minor',[0,2,3,5,7,8,11]],['Major pentatonic',[0,2,4,7,9]],['Minor pentatonic',[0,3,5,7,10]],['Blues',[0,3,5,6,7,10]],['Dorian',[0,2,3,5,7,9,10]],['Mixolydian',[0,2,4,5,7,9,10]],['Phrygian',[0,1,3,5,7,8,10]],['Whole tone',[0,2,4,6,8,10]],['Fifths',[0,7]],['Octaves',[0]]];
const tuneSnap=(p,key,sc)=>{let best=p,bd=1e9;const b=Math.floor(p);for(let nn=b-12;nn<=b+13;nn++){const pc=(((nn-key)%12)+12)%12;if(sc.indexOf(pc)<0)continue;const d=Math.abs(nn-p);if(d<bd-1e-9){bd=d;best=nn;}}return best;};
class FxTune{constructor(E){this.E=E;this.p=[new PS(E.sr),new PS(E.sr)];this.cur=0;this.x=0;this.ad=null;}
  proc(L,R,n,P){const E=this.E,sr=E.sr,pit=E.curPitch===undefined?60:E.curPitch,sc=TSC[P('scale')][1],tg=(tuneSnap(pit,P('key'),sc)-pit)*P('amount')+P('shift')+P('fine')/100,sp=P('speed');
    this.cur+=(tg-this.cur)*(sp<=1?1:1-Math.exp(-n/(sr*sp*.001)));const r=Math.pow(2,this.cur/12),want=Math.abs(this.cur)>.004?1:0,sm=1-Math.exp(-1/(sr*.004));
    for(const p of this.p)p.setW(sr,P('win'));
    for(let i=0;i<n;i++){this.x+=(want-this.x)*sm;const x=this.x;
      for(let c=0;c<2;c++){const X=c?R:L,y=this.p[c].p(X[i],r);X[i]=X[i]*(1-x)+y*x;}}
    this.val=this.cur;}}
fx('tune','Autotune','Voice','Pulls what you play onto a key and scale. It knows the notes from the synth itself, so there is no detection and no delay. With glide or pitch bend it gives the stepped, hard-tuned sound. Best on single lines.',[
 ['key','Key',0,0,0,{list:['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],tip:'Root note of the scale.'}],['scale','Scale',0,0,1,{list:TSC.map(s=>s[0]),tip:'Notes that are allowed. Notes outside the scale are moved to the nearest one. Chromatic only steps glides and bends.'}],
 ['speed','Retune speed',0,400,0,{u:' ms',tip:'0 jumps to the note at once: the robotic, stepped sound. Slower is more natural.'}],['amount','Amount',0,1,1,{tip:'How far the pitch is pulled to the scale.'}],
 ['shift','Shift',-12,12,0,{k:'int',u:' st',tip:'Extra shift after tuning, for a harmony voice. Use Mix to blend it with the original.'}],['fine','Fine',-100,100,0,{u:' ct',tip:'Fine tune in cents.'}],['win','Window',20,80,35,{u:' ms',tip:'Grain size of the pitch shifter. Short is tight, long is smoother.'}]
],FxTune,1);

/* ================= Fat Cat (the Studio 87 Fat Cat saturator inside the synth) ================= */
const fcSs=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const fcAt=(u,nl)=>u>=0?Math.tanh(u):nl*Math.tanh(u/nl);
function fcPurr(x,drive,xs,fuzz){const dn=fcSs((drive-.8)*5),xn=fcSs((xs-.8)*5),fn=fcSs((fuzz-.8)*5);let y=x;
  if(drive>.001){y=Math.tanh(x*(1+drive*5+dn*30));if(dn>0)y+=dn*(Math.tanh(y*(2+10*dn))-y);}
  if(xs>.001){const nl=Math.max(.25,1-.3*xs-.25*xn),u=y*(1+xs*5+xn*30);y=fcAt(u,nl);y+=(.3*xs+.25*xn)*y*y;if(xn>0){const y2=fcAt(y*(2+10*xn)+.15*xn,nl);y+=xn*(y2-y);}}
  if(fuzz>.001){const fz=1+fuzz*14+fn*70,bf=.5*Math.min(1,fuzz);y=Math.tanh(y*fz+bf)-Math.tanh(bf);if(fn>0){const r=Math.sqrt(y*y+.02)-.1414;y+=fn*.7*(r-.3);y=Math.tanh(y*(1+.8*fn));}}
  return y;}
function fcMake(drive,xs,fuzz,ref){let a=0,b=0;for(let i=0;i<64;i++){const x=ref*Math.sin(TAU*i/64),y=fcPurr(x,drive,xs,fuzz);a+=x*x;b+=y*y;}return clamp(b>1e-9?Math.sqrt(a/b):1,.25,4);}
const fcClip=v=>{const m=Math.abs(v);return m<=.7?v:(v<0?-1:1)*(.7+.27*Math.tanh((m-.7)/.27));};
class FxFatCat{constructor(E){this.E=E;this.os=[new OS4(),new OS4()];this.of=[new OS4(),new OS4()];this.oc=[new OS2(),new OS2()];this.band=new BiS();this.fhp=new BiS();this.nlp=new BiS();this.env=0;this.er=new Float32Array(8);this.ew=0;this.dc=[0,0];
    this.tr=new Float32Array(4096);this.tp=0;this.sh={pur:false,st2:false,g:1,p:1.6,nm:1,d:0,x:0,z:0,x1:0,z1:0,mk:1};this.key='';}
  proc(L,R,n,P){const sr=this.E.sr,drive=P('drive')*.01,xs=P('xs')*.01,gz=P('grit')*.01,fuzz=P('fuzz')*.01,color=P('color'),pur=P('char')===1,og=dbv(P('out')),S=this.sh;
    const key=drive.toFixed(4)+'|'+xs.toFixed(4)+'|'+gz.toFixed(4)+'|'+pur;
    if(key!==this.key){this.key=key;S.pur=pur;S.d=drive;S.x=xs;S.z=gz;
      if(pur){S.mk=fcMake(drive,xs,gz,.7);S.st2=false;}
      else{const b=1.4,t=clamp((drive-.75)/.25,0,1),sm=t*t*(3-2*t);S.g=1+22*drive*b;S.p=1.6+4.4*sm;S.nm=Math.pow(1+Math.pow(S.g,S.p),1/S.p)/S.g;S.x1=Math.min(2,xs*1.4);S.z1=Math.min(2,gz*1.4);S.st2=xs>0||gz>0;S.mk=S.st2?fcMake(0,S.x1,S.z1,.95):1;}}
    const shape=v=>{v=v>8?8:v<-8?-8:v;if(S.pur)return fcPurr(v,S.d,S.x,S.z)*S.mk;const u=v*S.g,b=u/Math.pow(1+Math.pow(Math.abs(u),S.p),1/S.p)*S.nm;return S.st2?fcPurr(b,0,S.x1,S.z1)*S.mk:b;};
    const nast=pur?Math.max(fcSs((drive-.8)*5),fcSs((xs-.8)*5),fcSs((gz-.8)*5)):0,ck=color*.01*1.6*1.4;
    this.band.set('bp',150*Math.pow(40,color*.01),1.4,0,sr);this.fhp.set('hp',1500,.7071,0,sr);if(nast>0)this.nlp.set('lp',Math.max(3000,14000-10000*nast),.7071,0,sr);
    const aA=Math.exp(-1/(.001*sr)),aR=Math.exp(-1/(.05*sr)),fzg=4+24*fuzz,dl=Math.min(4094,P('turbo')*.01*.012*sr),th=x=>Math.tanh(x);
    for(const o of this.oc)o.prep(sr);
    for(let i=0;i<n;i++){let yl=L[i],yr=R[i];
      if(ck>0){yl+=ck*this.band.p(0,yl);yr+=ck*this.band.p(1,yr);}
      const pk=Math.max(Math.abs(yl),Math.abs(yr));this.env=(pk>this.env?aA:aR)*this.env+(1-(pk>this.env?aA:aR))*pk;
      const inv=1/(this.env+1e-5);this.er[this.ew]=this.env;const ev=this.er[(this.ew+3)&7];this.ew=(this.ew+1)&7; // envelope delayed 5 samples, the delay of the oversampler
      for(let c=0;c<2;c++){let w=this.os[c].p(c,(c?yr:yl)*inv,shape);
        if(nast>0)w=this.nlp.p(c,w);
        w*=ev;this.dc[c]+=.0005*(w-this.dc[c]);w-=this.dc[c];
        if(fuzz>0){const a=this.fhp.p(c,w)/(ev+1e-5)*fzg;w+=fuzz*.5*this.of[c].p(c,a,th)*ev;}
        w=this.oc[c].p(c,w,fcClip)*og;
        if(c){this.tr[this.tp]=w;let rp=this.tp-dl;if(rp<0)rp+=4096;const i0=Math.floor(rp),fr=rp-i0;w=this.tr[i0&4095]*(1-fr)+this.tr[(i0+1)&4095]*fr;this.tp=(this.tp+1)&4095;R[i]=w;}else L[i]=w;}}}
  alignDry(L,R,n){for(let i=0;i<n;i++){L[i]=this.oc[0].lin(0,this.os[0].lin(0,L[i]));R[i]=this.oc[1].lin(1,this.os[1].lin(1,R[i]));}}}
fx('fatcat','Fat Cat','Distort','The Studio 87 Fat Cat saturator: thick, smooth saturation that keeps the dynamics at any level, with Transistor, Grit and Fuzz stages on top.',[
 ['drive','Drive',0,100,40,{u:' %',tip:'How hard the sound is saturated. Smooth and thick up to about 75%, harsher only at the very end. Dynamics are kept at any input level.'}],
 ['xs','Transistor',0,100,0,{u:' %',tip:'Asymmetric soft clip with even harmonics: warm and thick, not buzzy.'}],['grit','Grit',0,100,0,{u:' %',tip:'Lopsided fuzz-style clip. Above 80% it adds a smooth octave-up growl.'}],
 ['fuzz','Fuzz',0,100,0,{u:' %',tip:'Adds clipped highs above about 1.5 kHz for a buzzy, raw top end.'}],['color','Color',0,100,0,{u:' %',tip:'Emphasises one band before the saturation. Low is bass and warmth, high is bite and air.'}],
 ['turbo','Stereo Turbo',0,100,0,{u:' %',tip:'Delays the right side by a few milliseconds for width. Check it in mono.'}],
 ['char','Character',0,0,0,{list:['Shipped','PurrOne stack'],tip:'Shipped is the plain saturation with Transistor and Grit on top. PurrOne stack is the three stage colour shaper of the PurrOne synth.'}],['out','Output',-24,12,0,{u:' dB',tip:'Output level.'}]
],FxFatCat,1);
