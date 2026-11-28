/* part 3d: band splitter node, chains, mixer, engine, worklet source */

/* ================= Band splitter node ================= */
class SplitInst{
  constructor(E){this.E=E;this.xs=null;this.nb=0;this.bf=[];this.pk=[0,0,0,0];this.pm=undefined;}
  proc(L,R,n,P,node,depth){const E=this.E,nb=node.n||3;
    if(this.nb!==nb){this.nb=nb;this.xs=new XSplit(nb);this.bf=[];for(let j=0;j<nb;j++)this.bf.push({l:new Float32Array(64),r:new Float32Array(64)});}
    const f=[P('x1'),P('x2'),P('x3')].slice(0,nb-1);this.xs.set(f,E.sr);this.xs.split(L,R,n,this.bf);
    const so=node.so||[],ms=node.ms||[],solo=so.some(Boolean);
    for(let j=0;j<nb;j++){const b=this.bf[j];const ch=node.bands&&node.bands[j];if(ch&&ch.length)E.runChain(ch,b.l,b.r,n,depth+1);}
    for(let i=0;i<n;i++){L[i]=0;R[i]=0;}
    for(let j=0;j<nb;j++){const b=this.bf[j];let pk=0;
      const mute=ms[j]||(solo&&!so[j]),g=mute?0:dbv(P('g'+(j+1)));
      for(let i=0;i<n;i++){const l=b.l[i]*g,r=b.r[i]*g;L[i]+=l;R[i]+=r;const a=Math.abs(l)>Math.abs(r)?Math.abs(l):Math.abs(r);if(a>pk)pk=a;}
      this.pk[j]=Math.max(this.pk[j]*.9,pk);}
    E.bandMeter[node.id]=this.pk;}}
fx('split','Band Split','Routing','Splits the sound into 2 to 4 bands. Each band gets its own effect chain. Bands can hold more band splitters.',[
 ['x1','Split 1',40,1000,150,{k:'exp',u:' Hz',tip:'First crossover. Modulate it to sweep the band edge.'}],['x2','Split 2',200,8000,1800,{k:'exp',u:' Hz',tip:'Second crossover.'}],['x3','Split 3',1000,16000,6000,{k:'exp',u:' Hz',tip:'Third crossover.'}],
 ['g1','Band 1 level',-60,12,0,{u:' dB',tip:'Level of band 1 after its chain.'}],['g2','Band 2 level',-60,12,0,{u:' dB',tip:'Level of band 2 after its chain.'}],['g3','Band 3 level',-60,12,0,{u:' dB',tip:'Level of band 3 after its chain.'}],['g4','Band 4 level',-60,12,0,{u:' dB',tip:'Level of band 4 after its chain.'}]
],SplitInst,1);
FXORDER.pop();FXDEF.split.special=true;

let NID=0;
G.newNode=function(type,over){
  const d=FXDEF[type];if(!d)return null;const p={};for(const s of d.order)p[s.key]=s.d;
  const node={id:'n'+(++NID)+'_'+Math.floor(Math.random()*1e6).toString(36),type,on:1,p};
  if(type==='tgate')node.pat=[1,0,1,1,0,1,0,1,1,0,1,1,0,1,1,0];
  if(type==='split'){node.n=3;node.bands=[[],[],[],[]];node.so=[0,0,0,0];node.ms=[0,0,0,0];}
  if(over)Object.assign(p,over);return node;};
G.defaultChains=()=>({t0:[],t1:[],t2:[],t3:[],x1:[G.newNode('verb',{mix:1})],x2:[G.newNode('delay',{mix:1})],mst:[]});
G.FXCATS=['Dynamics','Tone','Filter','Voice','Distort','Modulation','Time','Space','Tools','Routing'];

/* ================= Engine ================= */
const TNAMES=['t0','t1','t2','t3'];
class Engine{
  constructor(sr){
    this.sr=sr;this.pv={};this.bn={};for(const k in PR){this.pv[k]=PR[k].d;this.bn[k]=toN(k,PR[k].d);}
    this.slots=[];this.fxSlots=[];this.gl=[0,0,0,0];this.glfo=[new Lfo(),new Lfo(),new Lfo(),new Lfo()];
    this.custom=Array.from({length:20},(_, _i)=>_i).map(()=>{const a=[];for(let i=0;i<32;i++)a.push(Math.sin(i/32*TAU));return a;});
    this.draw=[];for(let j=0;j<16;j++)this.draw.push([]);for(let i=0;i<32;i++){for(let j=0;j<16;j++)if(j!==2&&j!==3)this.draw[j].push(Math.exp(-i/8));this.draw[2].push(Math.exp(-i/8));this.draw[3].push(i/31);}
    this.wheelT=0;this.bendT=0;this.atT=0;this.psm={};
    this.tab=[null,null,null,null,null,null];this.smp=[null,null,null,null,null,null];
    this.wheel=0;this.bend=0;this.at=0;this.serial=0;this.glideFrom=null;this.beat=0;
    this.voices=[];for(let i=0;i<32;i++)this.voices.push(new Voice(this,i));
    this.tk=[0,1,2,3].map(()=>({l:new Float32Array(BLK),r:new Float32Array(BLK)}));
    this.aux=[0,1].map(()=>({l:new Float32Array(BLK),r:new Float32Array(BLK)}));this.mst={l:new Float32Array(BLK),r:new Float32Array(BLK)};this.fxo={l:new Float32Array(BLK),r:new Float32Array(BLK)};
    this.dry=[];for(let i=0;i<6;i++)this.dry.push({l:new Float32Array(BLK),r:new Float32Array(BLK)});
    this.chains={t0:[],t1:[],t2:[],t3:[],x1:[],x2:[],mst:[]};this.rt={};this.nodeById={};this.nodeMeter={};this.bandMeter={};
    this.meter={};for(const b of [...TNAMES,'x1','x2','fx','mst'])this.meter[b]={l:0,r:0};
    this.bg={};for(const b of [...TNAMES,'x1','x2','fx','mst'])this.bg[b]={l:0,r:0,init:false};
    this.held=[];this.mstack=[];this.down=0;this.evq=[];this.nextStep=0;this.si=0;this.arpWas=false;this.lastVel=.6;this.lastKey=.5;this.lastRnd=0;this.lastNote=60;this.curPitch=60;
    this.seq={len:16,on:[],vel:[],semi:[],rat:[]};for(let i=0;i<16;i++){this.seq.on.push(1);this.seq.vel.push(1);this.seq.semi.push(0);this.seq.rat.push(1);}
    this.scope=new Float32Array(2048);this.sp=0;
    this.ml=new Float32Array(BLK);this.mr=new Float32Array(BLK);
    const r=G.RECIPES&&G.RECIPES[0];if(r){const t=G.makeTable(r[0],32);if(t){t.build(0,0);this.tab=[t,t,t,t,t,t];}}
  }
  gsrc(name,v){return v.sv[name]||0;}
  /* ---- parameters ---- */
  setParam(k,v){const p=PR[k];if(!p)return;this.pv[k]=v;this.bn[k]=toN(k,v);}
  setTable(o,name,sw,sk){const t=G.makeTable(name,32);if(!t)return;t.build(sw||0,sk||0);this.tab[o]=t;}
  setFrames(o,name,frames,sw,sk){const fr=frames.map(f=>f instanceof Float32Array?f:Float32Array.from(f));const t=new WT(name,'User',fr);t.build(sw||0,sk||0);this.tab[o]=t;}
  setSlots(s){this.slots=(s||[]).filter(x=>x&&!x.b); // bypassed routes are ignored
   this.fxSlots=[];for(const x of this.slots){if(x&&x.d&&x.d.slice(0,3)==='fx:'){const q=x.d.split(':');this.fxSlots.push({s:x,id:q[1],key:q[2]});}}}
  setChains(c){this.chains=Object.assign({t0:[],t1:[],t2:[],t3:[],x1:[],x2:[],mst:[]},c);
    const map={};const walk=list=>{for(const nd of list){map[nd.id]=nd;if(nd.bands)for(const b of nd.bands)walk(b);}};
    for(const k in this.chains)walk(this.chains[k]);this.nodeById=map;
    for(const id in this.rt)if(!map[id])delete this.rt[id];}
  /* ---- FX chain running ---- */
  mkP(node){const def=FXDEF[node.type];return k=>{const s=def.ps[k];if(!s)return k==='mix'?1:0;const v=node.p[k]===undefined?s.d:node.p[k],m=node.m&&node.m[k];if(!m)return v;return fxV(s,fxN(s,v)+m);};}
  runChain(list,L,R,n,depth){
    for(let q=0;q<list.length;q++){const node=list[q];if(!node.on)continue;
      const def=FXDEF[node.type];if(!def)continue;
      let inst=this.rt[node.id];if(!inst||inst.type!==node.type){inst=new def.ctor(this);inst.type=node.type;this.rt[node.id]=inst;}
      const P=node._P||(Object.defineProperty(node,'_P',{value:this.mkP(node),enumerable:false,writable:true}),node._P);
      const mix=P('mix'),pm=inst.pm===undefined?mix:inst.pm,wet=mix<.999||pm<.999,dry=this.dry[depth];
      if(wet){for(let i=0;i<n;i++){dry.l[i]=L[i];dry.r[i]=R[i];}}
      inst.proc(L,R,n,P,node,depth);
      if(wet&&inst.alignDry)inst.alignDry(dry.l,dry.r,n);
      if(wet){for(let i=0;i<n;i++){const a=pm+(mix-pm)*(i+1)/n;L[i]=dry.l[i]*(1-a)+L[i]*a;R[i]=dry.r[i]*(1-a)+R[i]*a;}}
      inst.pm=mix;
      if(inst.gr!==undefined)this.nodeMeter[node.id]=inst.gr;
      for(let i=0;i<n;i++){const l=L[i],r=R[i];if(!(l>-8&&l<8)||!(r>-8&&r<8)){for(let j=0;j<n;j++){L[j]=0;R[j]=0;}if(inst.reset)inst.reset();break;}}}}
  applyFxMod(){
    for(const id in this.nodeById){const m=this.nodeById[id].m;if(m)for(const k in m)m[k]=0;}
    for(const f of this.fxSlots){const nd=this.nodeById[f.id];if(!nd||!FXDEF[nd.type]||!FXDEF[nd.type].ps[f.key])continue;
      const s=f.s;let v=0;
      switch(s.s){case 'l1':case 'l2':case 'l3':case 'l4':v=this.gl[+s.s[1]-1];break;
        case 'm1':case 'm2':case 'm3':case 'm4':case 'm5':case 'm6':case 'm7':case 'm8':v=this.pv[s.s];break;case 'wheel':v=this.wheel;break;case 'bend':v=this.bend;break;case 'at':v=this.at;break;
        case 'vel':v=this.lastVel;break;case 'key':v=this.lastKey;break;case 'rnd':v=this.lastRnd;break;
        case 'e1':case 'e2':case 'e3':case 'e4':case 'e5':case 'e6':case 'e7':case 'e8':case 'e9':case 'e10':case 'e11':case 'e12':case 'e13':case 'e14':case 'e15':case 'e16':{let mx=0;for(const vo of this.voices)if(vo.active&&vo.sv[s.s]>mx)mx=vo.sv[s.s];v=mx;break;}}
      if(s.u)v=(v+1)*.5;
      nd.m=nd.m||{};nd.m[f.key]=(nd.m[f.key]||0)+v*s.a;}}
  /* ---- notes, voices, arp ---- */
  alloc(poly){const vs=this.voices;let live=0;for(const v of vs)if(v.active&&!v.kfd)live++;
    const free=()=>{for(const v of vs)if(!v.active)return v;return null;};
    if(live<poly){const f=free();if(f)return f;}
    let best=null;for(const v of vs){if(!v.active||v.kfd)continue;if(!v.gate&&(!best||v.serial<best.serial))best=v;}
    if(!best)for(const v of vs){if(!v.active||v.kfd)continue;if(!best||v.serial<best.serial)best=v;}
    if(best)best.fadeKill(6); // stolen voice fades out over 6 ms on a spare voice slot instead of being cut
    const f=free();if(f)return f;
    let o=null;for(const v of vs)if(v.kfd&&(!o||v.kf<o.kf))o=v;if(o){o.kill();return o;}
    if(best){best.kill();return best;}return vs[0];}
  trigger(note,vel){const pv=this.pv,mode=pv.vmode;
    this.lastVel=vel;this.lastKey=clamp((note-36)/60,0,1);this.lastNote=note;this.lastRnd=Math.random()*2-1;
    if(mode===0){const same=this.voices.find(x=>x.active&&x.gate&&x.note===note);
      if(same){same.fadeKill(6);same.gate=false;} // same note again: new voice, old one fades (no phase jump)
      const v=this.alloc(pv.poly);if(v.active)v.kill();this.glideFrom=null;v.start(note,vel,true);}
    else{const v=this.voices[0];const leg=mode===2&&v.active&&v.gate;this.glideFrom=v.active?v.noteCur:null;
      this.mstack=this.mstack.filter(x=>x.n!==note);this.mstack.push({n:note,v:vel});v.start(note,vel,!leg);}}
  untrigger(note){const pv=this.pv;
    if(pv.vmode===0){for(const v of this.voices)if(v.active&&v.gate&&v.note===note)v.release();}
    else{this.mstack=this.mstack.filter(x=>x.n!==note);const v=this.voices[0];
      if(!v.active||!v.gate||v.note!==note)return;
      if(this.mstack.length){const b=this.mstack[this.mstack.length-1];this.glideFrom=v.noteCur;v.start(b.n,b.v,pv.vmode===1);}else v.release();}}
  noteOn(note,vel){vel=vel===undefined?.8:vel;
    if(this.pv['arp.on']){if(this.pv['arp.hold']&&this.down===0)this.held=[];this.down++;this.held=this.held.filter(x=>x.n!==note);this.held.push({n:note,v:vel});return;}
    this.trigger(note,vel);}
  noteOff(note){
    if(this.pv['arp.on']){this.down=Math.max(0,this.down-1);if(!this.pv['arp.hold'])this.held=this.held.filter(x=>x.n!==note);return;}
    this.untrigger(note);}
  panic(){for(const v of this.voices)v.kill();this.held=[];this.mstack=[];this.evq=[];this.down=0;}
  arpNotes(){const pv=this.pv,oc=pv['arp.oct'];let base=this.held.map(x=>x.n);const vel={};for(const x of this.held)vel[x.n]=x.v;
    if(pv['arp.mode']!==4)base=base.slice().sort((a,b)=>a-b);
    const out=[];for(let o=0;o<oc;o++)for(const n of base)out.push({n:n+12*o,v:vel[n]});return out;}
  tickArp(bb){const pv=this.pv,div=[1,.5,.25,.125,1/3,1/6][pv['arp.rate']],end=this.beat+bb;
    if(!this.arpWas){this.arpWas=true;this.si=Math.ceil(this.beat/div);this.nextStep=this.si*div;}
    while(this.nextStep<end){
      const t=this.nextStep,list=this.arpNotes();
      if(list.length){const L=this.seq.len,i=this.si%L,mode=pv['arp.mode'];
        if(this.seq.on[i]){const swing=(this.si%2)?pv['arp.swing']*div:0;let notes=[];
          if(mode===5)notes=list;
          else{const len=list.length;let idx=this.si;
            if(mode===0||mode===4)idx=idx%len;else if(mode===1)idx=len-1-(idx%len);
            else if(mode===2){const per=Math.max(1,2*len-2),p=idx%per;idx=p<len?p:per-p;}else idx=Math.floor(Math.random()*len);
            notes=[list[idx]];}
          const r=this.seq.rat[i]||1,sub=div/r,gl=sub*pv['arp.gate'];
          for(let k=0;k<r;k++)for(const nt of notes){const n=nt.n+this.seq.semi[i],v=clamp(nt.v*this.seq.vel[i],.05,1),t0=t+swing+k*sub;
            this.evq.push({t:t0,on:1,n,v});this.evq.push({t:t0+gl,on:0,n,v:0});}}}
      this.si++;this.nextStep=this.si*div;}
    this.evq.sort((a,b)=>a.t-b.t);
    while(this.evq.length&&this.evq[0].t<end){const e=this.evq.shift();if(e.on)this.trigger(e.n,e.v);else this.untrigger(e.n);}}
  /* ---- blocks ---- */
  setSmooth(k,v){const p=PR[k];if(!p)return;if(p.k==='list'||p.k==='int'||typeof v!=='number'||!(k in this.pv)){delete this.psm[k];this.setParam(k,v);return;}
    const n0=this.bn[k],n1=toN(k,v),steps=Math.max(1,Math.round(this.sr*.015/BLK)); // knob moves glide over about 15 ms (linear, in the knob's own scale)
    if(Math.abs(n1-n0)<1e-9){this.setParam(k,v);delete this.psm[k];return;}this.psm[k]={n:n1,d:(n1-n0)/steps,left:steps,v};}
  block(m){const pv=this.pv,sr=this.sr,dt=m/sr,bb=m*pv.bpm/60/sr;
    for(const k in this.psm){const q=this.psm[k];q.left--;if(q.left<=0){this.setParam(k,q.v);delete this.psm[k];}else{const nn=this.bn[k]+q.d;this.bn[k]=nn;this.pv[k]=fromN(k,nn);}}
    {const kk=1-Math.exp(-dt/.008);this.wheel+=(this.wheelT-this.wheel)*kk;this.bend+=(this.bendT-this.bend)*kk;this.at+=(this.atT-this.at)*kk;} // 8 ms smoothing on wheel, bend and aftertouch
    if(pv['arp.on'])this.tickArp(bb);else if(this.arpWas){this.arpWas=false;for(const e of this.evq)if(!e.on)this.untrigger(e.n);this.evq=[];for(const v of this.voices)if(v.active&&v.gate)v.release();this.held=[];this.down=0;}
    for(let i=0;i<4;i++){const k='l'+(i+1)+'.',sy=pv[k+'sync'];const rate=sy>0?pv.bpm/60/SYNCDIV[sy]:pv[k+'rate'];
      this.gl[i]=this.glfo[i].tick(dt,rate,pv[k+'shape'],pv[k+'sm'],pv[k+'fade'],this.custom[i]);}
    {let b=null;for(const v of this.voices)if(v.active&&!v.kfd&&(!b||v.serial>b.serial))b=v;this.curPitch=(b?b.noteCur:this.lastNote)+this.bend*pv.bendr;} // pitch of the newest voice, for the Autotune and Vocoder FX
    this.applyFxMod();
    for(let t=0;t<4;t++){this.tk[t].l.fill(0,0,m);this.tk[t].r.fill(0,0,m);}
    for(let i=0;i<this.voices.length;i++){const v=this.voices[i];if(v.active){if(v.control(m))v.render(m);}}
    this.mixdown(m);this.beat+=bb;}
  swap(name,tl,tr){const g=this.bg[name];if(!g.init){g.l=tl;g.r=tr;g.init=true;}const o=[g.l,g.r];g.l=tl;g.r=tr;return o;}
  mixdown(m){const pv=this.pv,mt=this.mst;mt.l.fill(0,0,m);mt.r.fill(0,0,m);this.fxo.l.fill(0,0,m);this.fxo.r.fill(0,0,m);for(const a of this.aux){a.l.fill(0,0,m);a.r.fill(0,0,m);}
    const peak=(name,L,R)=>{let pl=0,pr=0;for(let i=0;i<m;i++){const a=L[i]<0?-L[i]:L[i],b=R[i]<0?-R[i]:R[i];if(a>pl)pl=a;if(b>pr)pr=b;}
      const me=this.meter[name];me.l=Math.max(me.l*.92,pl);me.r=Math.max(me.r*.92,pr);};
    for(let t=0;t<4;t++){const tk=this.tk[t],nm=TNAMES[t],P='bus.'+nm+'.';
      this.runChain(this.chains[nm],tk.l,tk.r,m,0);
      const s1=pv[P+'s1'],s2=pv[P+'s2'];
      const v=pv[P+'vol'],pn=pv[P+'pan'],tv=v<=-59.9?0:dbv(v),tl=tv*Math.cos((pn*.5+.5)*PI/2)*1.414,tr=tv*Math.sin((pn*.5+.5)*PI/2)*1.414;
      const [pl,pr]=this.swap(nm,tl,tr);
      let dest=pv[P+'dest'];let target=null;if(dest>=3){const tt=dest-2;if(tt>t)target=this.tk[tt];else dest=0;}
      const a1=this.aux[0],a2=this.aux[1];
      for(let i=0;i<m;i++){const w=(i+1)/m,gl=pl+(tl-pl)*w,gr=pr+(tr-pr)*w,l=tk.l[i]*gl,r=tk.r[i]*gr;tk.l[i]=l;tk.r[i]=r;
        if(s1>0){a1.l[i]+=l*s1;a1.r[i]+=r*s1;}if(s2>0){a2.l[i]+=l*s2;a2.r[i]+=r*s2;}
        if(target){target.l[i]+=l;target.r[i]+=r;}else if(dest===1){a1.l[i]+=l;a1.r[i]+=r;}else if(dest===2){a2.l[i]+=l;a2.r[i]+=r;}else{mt.l[i]+=l;mt.r[i]+=r;}}
      peak(nm,tk.l,tk.r);}
    for(let x=0;x<2;x++){const a=this.aux[x],nm='x'+(x+1),P='bus.'+nm+'.';
      this.runChain(this.chains[nm],a.l,a.r,m,0);
      const v=pv[P+'vol'],pn=pv[P+'pan'],tv=v<=-59.9?0:dbv(v),tl=tv*Math.cos((pn*.5+.5)*PI/2)*1.414,tr=tv*Math.sin((pn*.5+.5)*PI/2)*1.414;
      const [pl,pr]=this.swap(nm,tl,tr);
      for(let i=0;i<m;i++){const w=(i+1)/m,l=a.l[i]*(pl+(tl-pl)*w),r=a.r[i]*(pr+(tr-pr)*w);a.l[i]=l;a.r[i]=r;if(x===0&&pv['bus.x1.dest']===1){this.aux[1].l[i]+=l;this.aux[1].r[i]+=r;}else{this.fxo.l[i]+=l;this.fxo.r[i]+=r;}}
      peak(nm,a.l,a.r);}
    {const fo=this.fxo,v=pv['bus.fx.vol'],pn=pv['bus.fx.pan'],tv=v<=-59.9?0:dbv(v),tl=tv*Math.cos((pn*.5+.5)*PI/2)*1.414,tr=tv*Math.sin((pn*.5+.5)*PI/2)*1.414;const [pl,pr]=this.swap('fx',tl,tr);
      for(let i=0;i<m;i++){const w=(i+1)/m,l=fo.l[i]*(pl+(tl-pl)*w),r=fo.r[i]*(pr+(tr-pr)*w);fo.l[i]=l;fo.r[i]=r;mt.l[i]+=l;mt.r[i]+=r;}
      peak('fx',fo.l,fo.r);}
    this.runChain(this.chains.mst,mt.l,mt.r,m,0);
    {const v=pv['bus.mst.vol']+pv.master,pn=pv['bus.mst.pan'],tv=v<=-59.9?0:dbv(v),tl=tv*Math.cos((pn*.5+.5)*PI/2)*1.414,tr=tv*Math.sin((pn*.5+.5)*PI/2)*1.414;
      const [pl,pr]=this.swap('mst',tl,tr);
      const lim=pv.lim,ce=dbv(pv.ceil);
      for(let i=0;i<m;i++){const w=(i+1)/m;let l=mt.l[i]*(pl+(tl-pl)*w),r=mt.r[i]*(pr+(tr-pr)*w);
        if(!(l>-40&&l<40))l=0;if(!(r>-40&&r<40))r=0;mt.l[i]=l;mt.r[i]=r;}
      if(!this.mlim||this.mlim.sr!==this.sr)this.mlim=new G.LookLim(this.sr);
      if(lim)this.mlim.proc(mt.l,mt.r,m,ce,140);
      this.limGR=this.mlim.gr;
      for(let i=0;i<m;i++){let l=mt.l[i],r=mt.r[i];if(l>ce)l=ce;else if(l<-ce)l=-ce;if(r>ce)r=ce;else if(r<-ce)r=-ce;if(!lim){if(l>1)l=1;else if(l<-1)l=-1;if(r>1)r=1;else if(r<-1)r=-1;}
        mt.l[i]=l;mt.r[i]=r;this.ml[i]=l;this.mr[i]=r;this.scope[this.sp]=(l+r)*.5;this.sp=(this.sp+1)&2047;}
      peak('mst',mt.l,mt.r);}}
  process(oL,oR,n){let pos=0;
    while(pos<n){const m=Math.min(BLK,n-pos);this.block(m);for(let i=0;i<m;i++){oL[pos+i]=this.ml[i];oR[pos+i]=this.mr[i];}pos+=m;}}
  vis(){let nv=0,nw=null;for(const x of this.voices)if(x.active){nv++;if(!nw||x.serial>nw.serial)nw=x;}
    const sc=new Float32Array(2048);for(let i=0;i<2048;i++)sc[i]=this.scope[(this.sp+i)&2047];
    return {meter:this.meter,lgr:this.limGR||0,nodes:this.nodeMeter,bands:this.bandMeter,gl:this.gl.slice(),nv,
      env:(()=>{const a=[];for(let i=1;i<=16;i++)a.push(nw?nw.sv['e'+i]:0);return a;})(),lfo:nw?[nw.sv.l1,nw.sv.l2,nw.sv.l3,nw.sv.l4]:this.gl.slice(),
      sen:nw?Array.from(nw.senV):[0,0,0,0,0,0,0,0],pos:nw&&nw.pcache?nw.pcache.map(c=>c.pos):[0,0,0,0,0,0],steps:this.si%(this.seq.len||16),scope:sc};}
  msg(m){switch(m.t){
    case 'on':this.noteOn(m.n,m.v);break;case 'off':this.noteOff(m.n);break;case 'panic':this.panic();break;
    case 'set':this.setSmooth(m.k,m.v);break;case 'setm':for(const k in m.p)this.setParam(k,m.p[k]);break;
    case 'slots':this.setSlots(m.s);break;case 'chains':this.setChains(m.c);break;
    case 'wheel':this.wheelT=m.v;break;case 'bend':this.bendT=m.v;break;case 'at':this.atT=m.v;break;
    case 'table':this.setTable(m.o,m.name,m.sw,m.sk);break;case 'frames':this.setFrames(m.o,m.name,m.frames,m.sw,m.sk);break;
    case 'sample':this.smp[m.o]={d:m.d instanceof Float32Array?m.d:Float32Array.from(m.d),sr:m.sr};break;
    case 'draw':this.draw[m.i]=m.pts;break;case 'custom':this.custom[m.i]=m.pts;break;case 'seq':Object.assign(this.seq,m.seq);break;
    case 'beat':this.beat=m.v;break;}}
}
G.Engine=Engine;

/* source of the AudioWorklet module (the whole DSP is sent along so it runs on the audio thread) */
G.workletSource=function(){
  return "const WWMAKE="+WWMAKE.toString()+";\n"+
  "class WWP extends AudioWorkletProcessor{constructor(){super();const G={};WWMAKE(G);this.E=new G.Engine(sampleRate);this.t=0;this.bad=false;\n"+
  " this.port.onmessage=e=>{try{this.E.msg(e.data);}catch(x){this.port.postMessage({t:'err',m:String(x&&x.stack||x)});}};\n"+
  " this.port.postMessage({t:'ready'});}\n"+
  " process(i,o){const c=o[0],L=c[0],R=c[1]||c[0];\n"+
  "  if(!this.bad){try{this.E.process(L,R,L.length);}catch(x){this.bad=true;this.port.postMessage({t:'err',m:String(x&&x.stack||x)});}}\n"+
  "  this.t+=L.length;if(this.t>=2048){this.t=0;try{this.port.postMessage(Object.assign({t:'vis'},this.E.vis()));}catch(x){}}\n"+
  "  return true;}}\n"+
  "registerProcessor('ww',WWP);";};
} // end WWMAKE
