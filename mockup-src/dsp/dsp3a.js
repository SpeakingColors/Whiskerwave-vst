/* part 3a: FX helpers and the first half of the FX library */
const SYNCL=LISTS.sync;const SYNCN=SYNCL.slice(1);const SD=i=>SYNCDIV[i+1];
const dbv=d=>Math.pow(10,d/20);
const FXDEF={},FXORDER=[];G.FXDEF=FXDEF;G.FXORDER=FXORDER;
const fxN=(s,v)=>s.k==='exp'?Math.log(Math.max(v,s.min)/s.min)/Math.log(s.max/s.min):(v-s.min)/((s.max-s.min)||1);
const fxV=(s,n)=>{n=clamp(n,0,1);if(s.k==='exp')return s.min*Math.pow(s.max/s.min,n);const v=s.min+n*(s.max-s.min);return (s.k==='int'||s.k==='list')?Math.round(v):v;};
G.fxN=fxN;G.fxV=fxV;
/* ps rows: [key,label,min,max,default,{k:'exp'|'int',u,tip,list}] */
function fx(type,name,cat,tip,ps,ctor,mixDef){
  const spec={},arr=[];
  const add=p=>{const o=p[5]||{};const s={key:p[0],l:p[1],min:p[2],max:p[3],d:p[4],k:o.k||'lin',u:o.u||'',tip:o.tip||'',list:o.list||null};
    if(s.list){s.k='list';s.min=0;s.max=s.list.length-1;}spec[s.key]=s;arr.push(s);};
  for(const p of ps)add(p);
  if(mixDef!==-1)add(['mix','Mix',0,1,mixDef===undefined?1:mixDef,{tip:'Dry/wet balance of this effect. 100% is fully processed.'}]);
  FXDEF[type]={type,name,cat,tip,ps:spec,order:arr,ctor};FXORDER.push(type);}
G.fx=fx;

/* ---- helpers ---- */
class BiS{
  constructor(){this.s=new Float64Array(4);this.b0=1;this.b1=0;this.b2=0;this.a1=0;this.a2=0;}
  set(type,f,q,gdb,sr){
    f=clamp(f,10,sr*.49);q=Math.max(q,.05);
    const w=TAU*f/sr,c=Math.cos(w),sn=Math.sin(w),al=sn/(2*q),A=Math.pow(10,(gdb||0)/40);
    let b0=1,b1=0,b2=0,a0=1,a1=0,a2=0;
    switch(type){
      case 'lp':b0=(1-c)/2;b1=1-c;b2=b0;a0=1+al;a1=-2*c;a2=1-al;break;
      case 'hp':b0=(1+c)/2;b1=-(1+c);b2=b0;a0=1+al;a1=-2*c;a2=1-al;break;
      case 'bp':b0=al;b1=0;b2=-al;a0=1+al;a1=-2*c;a2=1-al;break;
      case 'notch':b0=1;b1=-2*c;b2=1;a0=1+al;a1=-2*c;a2=1-al;break;
      case 'ap':b0=1-al;b1=-2*c;b2=1+al;a0=1+al;a1=-2*c;a2=1-al;break;
      case 'peak':b0=1+al*A;b1=-2*c;b2=1-al*A;a0=1+al/A;a1=-2*c;a2=1-al/A;break;
      case 'ls':{const sq=2*Math.sqrt(A)*al;b0=A*((A+1)-(A-1)*c+sq);b1=2*A*((A-1)-(A+1)*c);b2=A*((A+1)-(A-1)*c-sq);a0=(A+1)+(A-1)*c+sq;a1=-2*((A-1)+(A+1)*c);a2=(A+1)+(A-1)*c-sq;break;}
      case 'hs':{const sq=2*Math.sqrt(A)*al;b0=A*((A+1)+(A-1)*c+sq);b1=-2*A*((A-1)+(A+1)*c);b2=A*((A+1)+(A-1)*c-sq);a0=(A+1)-(A-1)*c+sq;a1=2*((A-1)-(A+1)*c);a2=(A+1)-(A-1)*c-sq;break;}
    }
    this.b0=b0/a0;this.b1=b1/a0;this.b2=b2/a0;this.a1=a1/a0;this.a2=a2/a0;}
  p(ch,x){const s=this.s,o=ch*2,y=this.b0*x+s[o];s[o]=this.b1*x-this.a1*y+s[o+1];s[o+1]=this.b2*x-this.a2*y;return y;}
  reset(){this.s.fill(0);}
}
class Delay{
  constructor(max){let n=2;while(n<max+8)n<<=1;this.b=new Float32Array(n);this.m=n-1;this.w=0;}
  write(x){this.b[this.w]=x;this.w=(this.w+1)&this.m;}
  read(d){const p=this.w-1-d,i=Math.floor(p),f=p-i,m=this.m,B=this.b;const xm=B[(i-1)&m],x0=B[i&m],x1=B[(i+1)&m],x2=B[(i+2)&m]; // 4-point cubic Hermite: keeps the highs when the delay time moves (chorus, flanger)
    const c1=.5*(x1-xm),c2=xm-2.5*x0+2*x1-.5*x2,c3=.5*(x2-xm)+1.5*(x0-x1);return ((c3*f+c2)*f+c1)*f+x0;}
  clear(){this.b.fill(0);}
}
class OS2{ // 2x oversampling around a nonlinearity
  constructor(){this.u1=new BiS();this.u2=new BiS();this.d1=new BiS();this.d2=new BiS();this.sr=0;}
  prep(sr){if(this.sr!==sr){this.sr=sr;for(const f of [this.u1,this.d1])f.set('lp',sr*.46,.5412,0,sr*2);for(const f of [this.u2,this.d2])f.set('lp',sr*.46,1.3066,0,sr*2);}}
  p(ch,x,fn,a,b){
    const ya=fn(this.u2.p(ch,this.u1.p(ch,x*2)),a,b),yb=fn(this.u2.p(ch,this.u1.p(ch,0)),a,b);
    const o=this.d2.p(ch,this.d1.p(ch,ya));this.d2.p(ch,this.d1.p(ch,yb));return o;}
  lin(ch,x){if(!this.tw)this.tw=new OS2();this.tw.prep(this.sr);return this.tw.p(ch,x,OSID);}
}
const OSID=x=>x;
const OS4C=[[0.00026000016422421862,0.00035970605427461925,0.00026000016422421862,-1.510402736507739,0.58533362714654935],[1,-0.33272726345019515,0.99999999999999989,-1.49596813049709,0.67490137750001511],[1,-0.98739672516438948,1,-1.4804812904749551,0.79287245548307661],[1,-1.2177490818032131,1.0000000000000002,-1.4768812156355668,0.89218439530409421],[1,-1.2964707096911294,0.99999999999999978,-1.4943179708173511,0.96692050659365281]]; // 10th-order elliptic, 0.05 dB ripple, edge 0.443 x base rate, designed for the 4x rate (same at every sample rate)
class OS4{ // 4x oversampling around a nonlinearity, steep elliptic up and down filters
  constructor(){const mk=()=>OS4C.map(c=>{const f=new BiS();[f.b0,f.b1,f.b2,f.a1,f.a2]=c;return f;});this.u=mk();this.d=mk();this.sr=0;}
  prep(sr){this.sr=sr;}
  p(ch,x,fn,a,b){const U=this.u,Dn=this.d,nU=U.length;let o=0;for(let k=0;k<4;k++){let v=k?0:x*4;for(let i=0;i<nU;i++)v=U[i].p(ch,v);v=fn(v,a,b);for(let i=0;i<nU;i++)v=Dn[i].p(ch,v);if(!k)o=v;}return o;}
  lin(ch,x){if(!this.tw)this.tw=new OS4();return this.tw.p(ch,x,OSID);}
}
G.OS4=OS4;
const wave4=(s,p)=>s===0?Math.sin(TAU*p):s===1?(p<.5?4*p-1:3-4*p):s===2?(p<.5?1:-1):(1-2*p);
const rateOf=(E,P)=>{const sy=P('sync');return sy>0?E.pv.bpm/60/SYNCDIV[sy]:P('rate');};
const RSYNC=['sync','Sync',0,12,0,{list:SYNCL,tip:'Hz uses the Rate knob. Any other value locks the cycle to the tempo.'}];
class XSplit{ // Linkwitz-Riley 4 multiband splitter with allpass phase compensation, stereo
  constructor(nb){this.nb=nb;this.lp=[];this.hp=[];this.ap=[];
    for(let k=0;k<nb-1;k++){this.lp.push([new BiS(),new BiS()]);this.hp.push([new BiS(),new BiS()]);}
    for(let j=0;j<nb;j++){this.ap.push([]);for(let m=0;m<nb-1;m++)this.ap[j].push(new BiS());}}
  set(f,sr){const nb=this.nb;let prev=20;
    for(let k=0;k<nb-1;k++){const fk=clamp(Math.max(f[k],prev*1.05),20,sr*.45);prev=fk;
      for(let s=0;s<2;s++){this.lp[k][s].set('lp',fk,.7071,0,sr);this.hp[k][s].set('hp',fk,.7071,0,sr);}
      for(let j=0;j<=k;j++){}
      for(let j=0;j<k;j++)this.ap[j][k].set('ap',fk,.7071,0,sr);
      this.ap[k][k].set('ap',fk,.7071,0,sr);}}
  split(L,R,n,out){const nb=this.nb;
    for(let i=0;i<n;i++){
      let l=L[i],r=R[i];
      for(let k=0;k<nb-1;k++){
        let bl=this.lp[k][1].p(0,this.lp[k][0].p(0,l)),br=this.lp[k][1].p(1,this.lp[k][0].p(1,r));
        const nl=this.hp[k][1].p(0,this.hp[k][0].p(0,l)),nr=this.hp[k][1].p(1,this.hp[k][0].p(1,r));
        for(let m=k+1;m<nb-1;m++){bl=this.ap[k][m].p(0,bl);br=this.ap[k][m].p(1,br);}
        out[k].l[i]=bl;out[k].r[i]=br;l=nl;r=nr;}
      out[nb-1].l[i]=l;out[nb-1].r[i]=r;}}
}
G.XSplit=XSplit;G.BiS=BiS;

/* ================= EQ ================= */
class FxEq{constructor(E){this.E=E;this.b=[0,1,2,3].map(()=>new BiS());this.h=[new BiS(),new BiS()];this.l=[new BiS(),new BiS()];}
  proc(L,R,n,P){const sr=this.E.sr,b=this.b;
    const g=[P('lg'),P('m1g'),P('m2g'),P('hg')];
    b[0].set('ls',P('lf'),.7,g[0],sr);b[1].set('peak',P('m1f'),P('m1q'),g[1],sr);b[2].set('peak',P('m2f'),P('m2q'),g[2],sr);b[3].set('hs',P('hf'),.7,g[3],sr);
    const hp=P('hp'),lp=P('lp'),uh=hp>22,ul=lp<19000;
    if(uh)for(const f of this.h)f.set('hp',hp,.7071,0,sr);
    if(ul)for(const f of this.l)f.set('lp',lp,.7071,0,sr);
    for(let i=0;i<n;i++){let l=L[i],r=R[i];
      if(uh){l=this.h[1].p(0,this.h[0].p(0,l));r=this.h[1].p(1,this.h[0].p(1,r));}
      for(let k=0;k<4;k++)if(Math.abs(g[k])>.02){l=b[k].p(0,l);r=b[k].p(1,r);}
      if(ul){l=this.l[1].p(0,this.l[0].p(0,l));r=this.l[1].p(1,this.l[0].p(1,r));}
      L[i]=l;R[i]=r;}}}
fx('eq','EQ','Tone','Four band EQ with high-pass and low-pass. Clean and phase-friendly.',[
 ['hp','High-pass',20,500,20,{k:'exp',u:' Hz',tip:'Cuts everything below this. 20 Hz is off.'}],
 ['lf','Low freq',30,400,100,{k:'exp',u:' Hz',tip:'Corner of the low shelf.'}],['lg','Low gain',-18,18,0,{u:' dB',tip:'Low shelf boost or cut.'}],
 ['m1f','Mid 1 freq',100,8000,500,{k:'exp',u:' Hz',tip:'Centre of the first bell.'}],['m1g','Mid 1 gain',-18,18,0,{u:' dB',tip:'Boost or cut of the first bell.'}],['m1q','Mid 1 Q',.2,8,1,{k:'exp',tip:'Width of the first bell. Higher is narrower.'}],
 ['m2f','Mid 2 freq',500,16000,3000,{k:'exp',u:' Hz',tip:'Centre of the second bell.'}],['m2g','Mid 2 gain',-18,18,0,{u:' dB',tip:'Boost or cut of the second bell.'}],['m2q','Mid 2 Q',.2,8,1,{k:'exp',tip:'Width of the second bell. Higher is narrower.'}],
 ['hf','High freq',2000,16000,8000,{k:'exp',u:' Hz',tip:'Corner of the high shelf.'}],['hg','High gain',-18,18,0,{u:' dB',tip:'High shelf boost or cut.'}],
 ['lp','Low-pass',1000,20000,20000,{k:'exp',u:' Hz',tip:'Cuts everything above this. 20 kHz is off.'}]
],FxEq,-1);

/* ================= Compressor ================= */
class FxComp{constructor(E){this.E=E;this.e=-90;this.gr=0;this.hv=-90;this.hc=0;}
  proc(L,R,n,P){const sr=this.E.sr,thr=P('thr'),ra=P('ratio'),kn=Math.max(P('knee'),.01),mk=dbv(P('makeup')),at=Math.exp(-1/(sr*P('att')*.001)),rl=Math.exp(-1/(sr*P('rel')*.001));
    let e=this.e,gmin=0,hv=this.hv,hc=this.hc;const H=Math.round(sr*.015),dec=60/(sr*Math.max(.005,P('rel')*.001)); // peak hold longer than a bass cycle, so the gain does not ride each waveform cycle
    for(let i=0;i<n;i++){const x=Math.max(Math.abs(L[i]),Math.abs(R[i])),xl=20*Math.log10(x+1e-9);
      if(xl>=hv){hv=xl;hc=H;}else if(hc>0)hc--;else hv=Math.max(xl,hv-dec);
      e=hv>e?at*e+(1-at)*hv:rl*e+(1-rl)*hv;
      const ov=e-thr;let gr;
      if(2*ov<-kn)gr=0;else if(2*Math.abs(ov)<=kn){const t=ov+kn/2;gr=(1/ra-1)*t*t/(2*kn);}else gr=(1/ra-1)*ov;
      const g=dbv(gr)*mk;L[i]*=g;R[i]*=g;if(gr<gmin)gmin=gr;}
    this.e=e;this.hv=hv;this.hc=hc;this.gr=gmin;}}
fx('comp','Compressor','Dynamics','Smooth feed-forward compressor with soft knee and parallel mix.',[
 ['thr','Threshold',-60,0,-18,{u:' dB',tip:'Level where compression starts.'}],['ratio','Ratio',1,20,3,{k:'exp',tip:'How hard it squeezes above the threshold.'}],
 ['att','Attack',.1,200,10,{k:'exp',u:' ms',tip:'How fast it reacts. Slow lets the click through.'}],['rel','Release',5,1000,120,{k:'exp',u:' ms',tip:'How fast it lets go.'}],
 ['knee','Knee',0,24,6,{u:' dB',tip:'Softness of the bend around the threshold.'}],['makeup','Makeup',0,24,0,{u:' dB',tip:'Gain added after compression.'}]
],FxComp,1);

/* Smooth lookahead limiter: gain only, no waveshaping. A sliding minimum of the needed gain is smoothed by a box average so the
   gain change is a ramp over the lookahead, and the audio is delayed by the same time, so every peak is already turned down when it arrives. */
class LookLim{
  constructor(sr){this.sr=sr||44100;this.N=Math.max(16,Math.round(this.sr*.005));const M=this.N+1;this.M=M;this.H=Math.round(this.sr*.025);this.hc=0;
    this.dl=new Float32Array(M);this.dr=new Float32Array(M);this.w=0;
    this.tg=new Float64Array(M);this.dq=new Float64Array(M+2);this.qh=0;this.qt=0;this.cnt=0;
    this.bx=new Float64Array(M).fill(1);this.bsum=M;this.bw=0;this.rel=1;this.gr=0;}
  proc(L,R,n,ce,relMs){const M=this.M,Q=M+2,rc=Math.exp(-1/(this.sr*Math.max(5,relMs)*.001)),tg=this.tg,dq=this.dq;let gmin=1;
    for(let i=0;i<n;i++){
      const l=L[i],r=R[i],pk=Math.max(Math.abs(l),Math.abs(r)),x=pk>ce?ce/pk:1,t=this.cnt++;
      tg[t%M]=x;
      while(this.qt>this.qh&&tg[dq[(this.qt-1)%Q]%M]>=x)this.qt--;
      dq[this.qt%Q]=t;this.qt++;
      while(dq[this.qh%Q]<=t-M)this.qh++;
      const wm=tg[dq[this.qh%Q]%M];
      const bi=this.bw;this.bsum+=wm-this.bx[bi];this.bx[bi]=wm;this.bw=(bi+1)%M;
      const g=this.bsum/M;
      if(g<this.rel){this.rel=g;this.hc=this.H;}else if(this.hc>0)this.hc--;else this.rel+=(g-this.rel)*(1-rc); // 25 ms hold: gain does not ride each bass cycle
      const go=this.rel;
      const wi=this.w,dl=this.dl[wi],dr=this.dr[wi];this.dl[wi]=l;this.dr[wi]=r;this.w=(wi+1)%M;
      let ol=dl*go,or_=dr*go;if(ol>ce)ol=ce;else if(ol<-ce)ol=-ce;if(or_>ce)or_=ce;else if(or_<-ce)or_=-ce;
      L[i]=ol;R[i]=or_;if(go<gmin)gmin=go;}
    this.gr=20*Math.log10(gmin);}
}
G.LookLim=LookLim;
/* ================= Maximizer ================= */
const sclip=(x,k,c)=>{const a=Math.abs(x);if(a<=k)return x;return (x<0?-1:1)*(k+(c-k)*Math.tanh((a-k)/(c-k+1e-9)));};
class FxMaxi{constructor(E){this.E=E;this.g=1;this.gr=0;this.ll=new LookLim(E.sr);this.os=new OS4();}
  proc(L,R,n,P){const sr=this.E.sr,gain=dbv(P('gain')),ce=dbv(P('ceil')),soft=P('soft');
    if(this.ll.sr!==sr)this.ll=new LookLim(sr);
    const k=ce*(1-.35*soft);
    if(soft>0){this.os.prep(sr);for(let i=0;i<n;i++){L[i]=this.os.p(0,L[i]*gain,sclip,k,ce*1.15);R[i]=this.os.p(1,R[i]*gain,sclip,k,ce*1.15);}}
    else for(let i=0;i<n;i++){L[i]*=gain;R[i]*=gain;}
    this.ll.proc(L,R,n,ce,P('rel'));this.gr=this.ll.gr;this.soft=soft>0;}
  alignDry(L,R,n){const M=this.ll.M;if(!this.ad||this.ad.l.length!==M)this.ad={l:new Float32Array(M),r:new Float32Array(M),w:0};const d=this.ad;
    for(let i=0;i<n;i++){let l=L[i],r=R[i];if(this.soft){l=this.os.lin(0,l);r=this.os.lin(1,r);}const w=d.w;L[i]=d.l[w];R[i]=d.r[w];d.l[w]=l;d.r[w]=r;d.w=(w+1)%M;}}}
fx('maxi','Maximizer','Dynamics','Loudness maximizer: push the level up against a ceiling with a soft clipper.',[
 ['gain','Gain',0,24,6,{u:' dB',tip:'Drive into the ceiling. More gain is louder and denser.'}],['ceil','Ceiling',-12,0,-.3,{u:' dB',tip:'The level it never goes above.'}],
 ['rel','Release',10,500,80,{k:'exp',u:' ms',tip:'How fast the gain comes back after a peak.'}],['soft','Soft clip',0,1,.5,{tip:'Rounds peaks instead of squashing them. Warmer.'}]
],FxMaxi,1);

/* ================= Squeeze (3 band up/down compressor) ================= */
class FxSqueeze{constructor(E){this.E=E;this.x=new XSplit(3);this.bb=[0,1,2].map(()=>({l:new Float32Array(64),r:new Float32Array(64)}));this.e=[-80,-80,-80];this.g=[0,0,0];this.gr=0;}
  proc(L,R,n,P){const sr=this.E.sr,dep=P('depth'),tm=P('time'),ing=dbv(P('in')),og=dbv(P('out')),bg=[dbv(P('lowg')),dbv(P('midg')),dbv(P('highg'))];
    this.x.set([P('xlo'),P('xhi')],sr);for(let i=0;i<n;i++){L[i]*=ing;R[i]*=ing;}
    this.x.split(L,R,n,this.bb);
    const at=Math.exp(-1/(sr*.003*tm)),rl=Math.exp(-1/(sr*.09*tm)),sm=Math.exp(-1/(sr*.004*tm)),hi=-22,lo=-44;
    let gmin=0;
    for(let i=0;i<n;i++){let ol=0,or=0;
      for(let b=0;b<3;b++){const bl=this.bb[b].l[i],br=this.bb[b].r[i],lv=20*Math.log10(Math.max(Math.abs(bl),Math.abs(br))+1e-9);
        let e=this.e[b];e=lv>e?at*e+(1-at)*lv:rl*e+(1-rl)*lv;this.e[b]=e;
        let tg=0;if(e>hi)tg=-(e-hi)*.75*dep;else if(e<lo)tg=Math.min(20,(lo-e)*.7)*dep;
        this.g[b]=sm*this.g[b]+(1-sm)*tg;const g=dbv(this.g[b])*bg[b]*og;ol+=bl*g;or+=br*g;if(this.g[b]<gmin)gmin=this.g[b];}
      L[i]=ol;R[i]=or;}
    this.gr=gmin;}}
fx('squeeze','Squeeze','Dynamics','Three band up and down compressor. Loud parts go down, quiet parts come up: dense and loud.',[
 ['depth','Depth',0,1,.6,{tip:'How much squeezing. 0 is off.'}],['time','Time',.2,4,1,{k:'exp',tip:'Speed of the squeeze. Lower is faster and grittier.'}],
 ['xlo','Low split',50,500,120,{k:'exp',u:' Hz',tip:'Border between low and mid band.'}],['xhi','High split',1000,10000,2500,{k:'exp',u:' Hz',tip:'Border between mid and high band.'}],
 ['lowg','Low level',-12,12,0,{u:' dB',tip:'Level of the low band after squeezing.'}],['midg','Mid level',-12,12,0,{u:' dB',tip:'Level of the mid band after squeezing.'}],['highg','High level',-12,12,0,{u:' dB',tip:'Level of the high band after squeezing.'}],
 ['in','Input',-12,12,0,{u:' dB',tip:'Gain before the squeeze.'}],['out','Output',-12,12,-3,{u:' dB',tip:'Gain after the squeeze.'}]
],FxSqueeze,1);

/* ================= Pump (tempo ducker) ================= */
class FxPump{constructor(E){this.E=E;this.g=1;}
  proc(L,R,n,P){const E=this.E,sr=E.sr,div=SD(P('div')),dep=P('depth'),atk=P('attack'),rel=P('release'),pw=Math.pow(2,P('curve')*2),adv=E.pv.bpm/60/sr/div;
    let ph=((E.beat/div)%1+1)%1;const sm=1-Math.exp(-1/(sr*.0008));let g=this.g;
    for(let i=0;i<n;i++){let t;
      if(ph<atk)t=1-dep*(ph/Math.max(atk,1e-4));
      else{const x=Math.min(1,(ph-atk)/Math.max(rel,1e-3));t=(1-dep)+dep*Math.pow(x,pw);}
      g+=(t-g)*sm;L[i]*=g;R[i]*=g;ph+=adv;if(ph>=1)ph-=1;}
    this.g=g;this.val=g;}}
fx('pump','Pump','Dynamics','Tempo locked volume pump, like sidechain from a kick. Needs no kick.',[
 ['div','Rate',0,11,2,{list:SYNCN,tip:'How often the pump hits. 1/4 is every kick.'}],['depth','Depth',0,1,.8,{tip:'How far the volume ducks.'}],
 ['attack','Dip time',0,.3,.01,{tip:'How fast it ducks, as a part of the beat.'}],['release','Recover',.05,1,.6,{tip:'How long it takes to come back, as a part of the beat.'}],['curve','Curve',-1,1,0,{tip:'Shape of the recovery. Negative is quick then slow, positive is slow then quick.'}]
],FxPump,1);

/* ================= Trance gate ================= */
class FxTGate{constructor(E){this.E=E;this.g=1;this.step=0;}
  proc(L,R,n,P,node){const E=this.E,sr=E.sr,pat=node.pat||[1,0,1,1,0,1,0,1,1,0,1,1,0,1,1,0],len=pat.length,sl=SD(P('div')),dep=P('depth'),sm=1-Math.exp(-1/(sr*Math.max(.0002,P('smooth')*.001))),sw=P('swing');
    let g=this.g;const adv=E.pv.bpm/60/sr/sl;let pos=E.beat/sl;
    for(let i=0;i<n;i++){let idx=Math.floor(pos)%len;if(idx<0)idx+=len;
      let fr=pos-Math.floor(pos);if(idx%2===1&&sw>0&&fr<sw*.5)idx=(idx+len-1)%len;
      const t=1-dep+dep*pat[idx];g+=(t-g)*sm;L[i]*=g;R[i]*=g;pos+=adv;this.step=idx;}
    this.g=g;}}
fx('tgate','Trance Gate','Dynamics','Step gate for rhythmic chopping. Draw the 16 steps on the page.',[
 ['div','Step',0,11,4,{list:SYNCN,tip:'Length of one step.'}],['depth','Depth',0,1,1,{tip:'How much the closed steps are turned down.'}],
 ['smooth','Smooth',.1,50,2,{k:'exp',u:' ms',tip:'Fade between steps. Low is chopped, high is soft.'}],['swing','Swing',0,1,0,{tip:'Delays every second step.'}]
],FxTGate,1);

/* ================= Transient shaper ================= */
class FxTrans{constructor(E){this.E=E;this.f=0;this.s=0;this.g=1;}
  proc(L,R,n,P){const sr=this.E.sr,at=P('attack'),su=P('sustain'),k=Math.exp(-1/(sr*.001)),k2=Math.exp(-1/(sr*.02)),k3=Math.exp(-1/(sr*.03)),k4=Math.exp(-1/(sr*.25)),sm=1-Math.exp(-1/(sr*.001));
    let f=this.f,s=this.s,g=this.g;
    for(let i=0;i<n;i++){const a=Math.max(Math.abs(L[i]),Math.abs(R[i]));
      f=a>f?k*f+(1-k)*a:k2*f+(1-k2)*a;s=a>s?k3*s+(1-k3)*a:k4*s+(1-k4)*a;
      const r=(f+1e-5)/(s+1e-5);let t=1;if(r>1)t=Math.pow(r,at*.7);else t=Math.pow(r,-su*.5);
      t=clamp(t,.2,5);g+=(t-g)*sm;L[i]*=g;R[i]*=g;}
    this.f=f;this.s=s;this.g=g;}}
fx('trans','Transient','Dynamics','Shape the punch and the tail of a sound separately.',[
 ['attack','Attack',-1,1,0,{tip:'Positive adds punch at the start of notes, negative softens it.'}],['sustain','Sustain',-1,1,0,{tip:'Positive makes the tail longer and fuller, negative makes it tighter.'}]
],FxTrans,1);
