/* ===== WhiskerWave UI core ===== */
'use strict';
const D={};WWMAKE(D);
const PR=D.PR,LISTS=D.LISTS,FXDEF=D.FXDEF,SRCNAME=D.SRCNAME;
const $=(s,r)=>(r||document).querySelector(s),$$=(s,r)=>Array.from((r||document).querySelectorAll(s));
function h(tag,attrs,kids){const e=document.createElement(tag);if(attrs)for(const k in attrs){const v=attrs[k];if(k==='class')e.className=v;else if(k==='style')e.style.cssText=v;else if(k==='text')e.textContent=v;else if(k==='html')e.innerHTML=v;else if(k.slice(0,2)==='on')e.addEventListener(k.slice(2),v);else if(v!==false&&v!==null&&v!==undefined)e.setAttribute(k,v===true?'':v);}
  if(kids)for(const c of [].concat(kids)){if(c==null)continue;e.appendChild(typeof c==='string'?document.createTextNode(c):c);}return e;}
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
const mem={}; // fallback when storage is blocked
/* ---------- state ---------- */
const S={p:{},slots:[],chains:D.defaultChains(),tabs:{a:'Sine to Saw',b:'Sine to Saw',c:'Sine to Saw',d:'Sine to Saw',e:'Sine to Saw',f:'Sine to Saw'},user:{},frames:{},seq:{len:16,on:[],vel:[],semi:[],rat:[]},draw:{0:[],1:[],2:[],3:[],4:[],5:[],6:[],7:[],8:[],9:[],10:[],11:[],12:[],13:[],14:[],15:[]},mnames:['Macro 1','Macro 2','Macro 3','Macro 4','Macro 5','Macro 6','Macro 7','Macro 8'],custom:[],page:'sound',theme:'b',tips:true,sel:{bus:'t0',node:null},idx:{},knobs:new Set(),binds:{},muted:{},solo:{},V:null,name:'Init',pid:null,hist:[]};
for(const k in PR)S.p[k]=PR[k].d;
for(let i=0;i<16;i++){S.seq.on.push(1);S.seq.vel.push(1);S.seq.semi.push(0);S.seq.rat.push(1);}
for(let i=0;i<32;i++){for(const j of [0,1,2,4,5,6,7])S.draw[j].push(Math.exp(-i/8));S.draw[3].push(i/31);}
for(let j=0;j<20;j++){const a=[];for(let i=0;i<32;i++)a.push(Math.sin(i/32*Math.PI*2));S.custom.push(a);} // 0-3 LFO 1-4, 4+n custom shape of modulator slot n (slots 2 to 16 use 5 to 19)
function reindex(){S.idx={};const w=l=>{for(const n of l){S.idx[n.id]=n;if(n.bands)for(const b of n.bands)w(b);}};for(const k in S.chains)w(S.chains[k]);}
reindex();
/* ---------- specs ---------- */
function parseKey(key){if(key.slice(0,3)==='fx:'){const q=key.split(':');return {id:q[1],pk:q[2]};}return null;}
function specOf(key){const f=parseKey(key);if(f){const n=S.idx[f.id];return n?FXDEF[n.type].ps[f.pk]:null;}return PR[key];}
function getV(key){const f=parseKey(key);if(f){const n=S.idx[f.id];if(!n)return 0;const s=specOf(key);return n.p[f.pk]!==undefined?n.p[f.pk]:(s?s.d:0);}return S.p[key];}
function listOf(sp){return Array.isArray(sp.list)?sp.list:LISTS[sp.list];}
function toN(sp,v){if(sp.k==='exp')return Math.log(Math.max(v,sp.min)/sp.min)/Math.log(sp.max/sp.min);return (v-sp.min)/((sp.max-sp.min)||1);}
function fromN(sp,n){n=clamp(n,0,1);if(sp.k==='exp')return sp.min*Math.pow(sp.max/sp.min,n);const v=sp.min+n*(sp.max-sp.min);return (sp.k==='int'||sp.k==='list')?Math.round(v):v;}
function fmt(sp,v){if(sp.k==='list'){const l=listOf(sp);return l[clamp(Math.round(v),0,l.length-1)];}
  let u=sp.u||'',a=Math.abs(v);if(u===' Hz'&&a>=1000){return (v/1000).toFixed(a>=10000?1:2)+' kHz';}if(u===' ms'&&a>=1000){return (v/1000).toFixed(2)+' s';}
  if(sp.k==='int')return Math.round(v)+u;if(sp.max-sp.min<=2&&u===''){return Math.round(v*100)+'%';}return (a>=100?v.toFixed(0):a>=10?v.toFixed(1):v.toFixed(2))+u;}
function slotsFor(key){return S.slots.filter(x=>x.d===key);}
function modulatable(key){const f=parseKey(key);if(f){const sp=specOf(key);return !!sp&&sp.k!=='list';}const sp=PR[key];return !!sp&&sp.k!=='list'&&!/^(bpm|poly|vmode|lim|bus\.[a-z0-9]+\.dest)$/.test(key);}
function nameOf(key){const f=parseKey(key);if(f){const n=S.idx[f.id];return n?FXDEF[n.type].name+' '+specOf(key).l:key;}return PR[key]?PR[key].l+' ('+key.split('.')[0]+')':key;}
/* ---------- binding ---------- */
function bind(key,fn){(S.binds[key]=S.binds[key]||[]).push(fn);}
function refresh(key){const l=S.binds[key];if(!l)return;for(let i=l.length-1;i>=0;i--){if(l[i]()===false)l.splice(i,1);}}
function refreshAll(){updHandles();for(const k in S.binds)refresh(k);for(const k of S.knobs)if(k.isConnected)k.draw();else S.knobs.delete(k);}
let chainsDirty=false;function markChains(){chainsDirty=true;}
function setV(key,v,quiet){const f=parseKey(key),sp=specOf(key);if(!sp)return;v=clamp(v,sp.min,sp.max);if(sp.k==='int'||sp.k==='list')v=Math.round(v);
  if(f){const n=S.idx[f.id];if(!n)return;n.p[f.pk]=v;markChains();}else{S.p[key]=v;send({t:'set',k:key,v});}
  if(!quiet)refresh(key);for(const k of S.knobs)if(k.dataset.p===key&&k.isConnected)k.draw();histMark('Changed '+(sp.l||key));}
function sendSlots(){histMark('Modulation changed');send({t:'slots',s:S.slots.map(x=>({s:x.s,d:x.d,a:x.a,u:x.u,b:x.b?1:0}))});}
function sendChains(){histMark('FX changed');send({t:'chains',c:JSON.parse(JSON.stringify(S.chains))});}
/* ---------- engine link ---------- */
let eng=null,actx=null,vlocal=null;const queue=[];
function send(m){if(eng)eng.post(m);}
function syncAll(){send({t:'setm',p:S.p});sendSlots();sendChains();for(const o of [0,1,2,3,4,5]){const k='abcdef'[o],fr=S.frames[k];if(fr)send({t:'frames',o,name:S.tabs[k],frames:fr.map(f=>Array.from(f)),sw:S.p[k+'.sw'],sk:S.p[k+'.sk']});else send({t:'table',o,name:S.tabs[k],sw:S.p[k+'.sw'],sk:S.p[k+'.sk']});}
  for(let i=0;i<16;i++)if(S.draw[i]&&S.draw[i].length)send({t:'draw',i,pts:S.draw[i]});for(let i=0;i<20;i++)send({t:'custom',i,pts:S.custom[i]});send({t:'seq',seq:S.seq});
  if(S.samples)for(const o in S.samples)send({t:'sample',o:+o,d:S.samples[o].d,sr:S.samples[o].sr});}
let startP=null;function startAudio(){if(!startP)startP=startAudio_();return startP;}
async function startAudio_(){
  if(eng)return true;
  try{actx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});}catch(e){toast('Audio is not available here');return false;}
  let ok=false;
  try{const url=URL.createObjectURL(new Blob([D.workletSource()],{type:'text/javascript'}));await actx.audioWorklet.addModule(url);
    const node=new AudioWorkletNode(actx,'ww',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
    node.port.onmessage=e=>{const m=e.data;if(m.t==='vis')S.V=m;else if(m.t==='err')console.error('engine',m.m);};node.connect(actx.destination);
    eng={post:m=>node.port.postMessage(m),mode:'worklet'};ok=true;}
  catch(err){console.warn('worklet unavailable, using fallback',err&&err.message);}
  if(!ok){const E=new D.Engine(actx.sampleRate);const sp=actx.createScriptProcessor(1024,0,2);
    sp.onaudioprocess=e=>{E.process(e.outputBuffer.getChannelData(0),e.outputBuffer.getChannelData(1),1024);};sp.connect(actx.destination);
    eng={post:m=>E.msg(m),mode:'script'};vlocal=E;}
  syncAll();$('#audiobtn').classList.remove('pulse');$('#audiobtn').textContent='Audio on';$('#audiobtn').classList.add('on');
  if(actx.state==='suspended')actx.resume();return true;}
function noteOn(n,v){S.lastVel=v||.8;S.lastNote=n;if(!eng){startAudio().then(()=>{send({t:'on',n,v:v||.8});});return;}send({t:'on',n,v:v||.8});}
function noteOff(n){send({t:'off',n});}
/* ---------- tooltips, toast, dialogs ---------- */
let tipT=null;const tipEl=()=>$('#tip');
document.addEventListener('pointerover',e=>{const t=e.target.closest&&e.target.closest('[data-tip]');clearTimeout(tipT);tipEl().style.display='none';if(!t||!S.tips)return;
  tipT=setTimeout(()=>{const el=tipEl();el.textContent=t.dataset.tip;el.style.display='block';const r=t.getBoundingClientRect();let x=r.left,y=r.bottom+6;const w=el.offsetWidth,hh=el.offsetHeight;if(x+w>innerWidth-4)x=innerWidth-w-4;if(y+hh>innerHeight-4)y=r.top-hh-6;el.style.left=Math.max(4,x)+'px';el.style.top=Math.max(4,y)+'px';},900);});
document.addEventListener('pointerdown',()=>{clearTimeout(tipT);tipEl().style.display='none';},true);
document.addEventListener('pointerout',e=>{if(e.target.closest&&e.target.closest('[data-tip]')){clearTimeout(tipT);tipEl().style.display='none';}});
let toastT=null;function toast(msg){const t=$('#toast');t.textContent=msg;t.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',1800);}
function dialog(title,body,buttons){const d=$('#dlg');d.innerHTML='';const box=h('div',null,[h('h2',{text:title}),body,h('div',{class:'row',style:'justify-content:flex-end'},(buttons||[['Close']]).map(b=>h('button',{class:'btn'+(b[2]?' on':''),text:b[0],onclick:()=>{const r=b[1]?b[1]():true;if(r!==false)d.classList.remove('on');}})))]);
  d.appendChild(box);d.classList.add('on');d.onclick=e=>{if(e.target===d)d.classList.remove('on');};return box;}
function closeDlg(){$('#dlg').classList.remove('on');}
/* ---------- canvases ---------- */
function cv(w,hh,cls){const c=h('canvas',{class:'disp '+(cls||'')});c.width=w*2;c.height=hh*2;c.style.width=w+'px';c.style.height=hh+'px';const g=c.getContext('2d');g.scale(2,2);c.g=g;c.W=w;c.H=hh;return c;}
const cssv=n=>getComputedStyle(document.body).getPropertyValue(n).trim();
const CAT={e:'--acc4',l:'--m1',m:'--acc2'};
function srcColor(s){return cssv(CAT[s[0]]&&/^[elm]\d+$/.test(s)?CAT[s[0]]:'--dim')||'#999';}
/* ---------- knob ---------- */
function knob(key,o){o=o||{};const sp=specOf(key);if(!sp)return h('div');
  const el=h('div',{class:'knob'+(o.sm?' sm':''),'data-p':key,'data-tip':sp.tip+(modulatable(key)?' Drag a modulator onto it.':'')});
  const c=h('canvas');const S0=o.sm?32:40;c.width=S0*2;c.height=S0*2;c.style.width=S0+'px';c.style.height=S0+'px';const g=c.getContext('2d');g.scale(2,2);
  const lab=h('div',{class:'l',text:o.label||sp.l}),val=h('div',{class:'v',text:''});el.append(c,lab,val);
  el.draw=()=>{const v=getV(key),n=toN(sp,v),cx=S0/2,r=S0/2-3,a0=Math.PI*.75,a1=Math.PI*2.25;g.clearRect(0,0,S0,S0);
    g.lineWidth=3;g.lineCap='round';g.strokeStyle=cssv('--line');g.beginPath();g.arc(cx,cx,r,a0,a1);g.stroke();
    const bip=sp.min<0&&sp.max>0&&Math.abs(sp.min)===Math.abs(sp.max),z=bip?.5:0;g.strokeStyle=cssv('--acc');g.beginPath();g.arc(cx,cx,r,a0+(a1-a0)*Math.min(z,n),a0+(a1-a0)*Math.max(z,n));g.stroke();
    const an=a0+(a1-a0)*n;g.strokeStyle=cssv('--text');g.lineWidth=2;g.beginPath();g.moveTo(cx+Math.cos(an)*(r-8),cx+Math.sin(an)*(r-8));g.lineTo(cx+Math.cos(an)*(r-1),cx+Math.sin(an)*(r-1));g.stroke();
    const sl=slotsFor(key);let k=0;for(const s of sl){if(s.b){k++;continue;}const lo=clamp(n,0,1),hi=clamp(n+s.a,0,1);g.strokeStyle=srcColor(s.s);g.lineWidth=2;g.beginPath();g.arc(cx,cx,r-4-k*0+0,a0+(a1-a0)*Math.min(lo,hi),a0+(a1-a0)*Math.max(lo,hi));g.stroke();
      const lv=liveSrc(s.s),uni=(s.s[0]==='l'&&s.s.length===2)||s.s==='bend'||s.s==='rnd',lvv=(uni&&!s.u)?lv:(uni?(lv+1)*.5:lv),dn=clamp(n+lvv*s.a,0,1),da=a0+(a1-a0)*dn;g.fillStyle=cssv('--text');g.beginPath();g.arc(cx+Math.cos(da)*(r-4),cx+Math.sin(da)*(r-4),1.8,0,7);g.fill();k++;}
    el.dataset.mod=sl.length?'1':'';
    val.textContent=o.sm?fmt(sp,v).replace(/ /g,''):fmt(sp,v);};
  let drag=null;
  el.addEventListener('pointerdown',e=>{if(e.button===2)return;el.setPointerCapture(e.pointerId);drag={y:e.clientY,n:toN(sp,getV(key))};e.preventDefault();});
  const coarse=e=>o.coarse&&(e.ctrlKey||e.metaKey||e.altKey),cK=o.coarse===true?key:o.coarse,cS=o.coarse===true?12:1; // coarse:true = the same knob moves by 12 (octaves)
  el.addEventListener('pointermove',e=>{if(!drag)return;if(coarse(e)){const st=Math.round((drag.y-e.clientY)/24);if(st!==drag.cs){const cs=specOf(cK);setV(cK,clamp(getV(cK)+(st-(drag.cs||0))*cS,cs.min,cs.max));drag.cs=st;}return;}drag.cs=0;const f=e.shiftKey?900:180;let n=drag.n+(drag.y-e.clientY)/f;setV(key,fromN(sp,n));});
  el.addEventListener('pointerup',e=>{drag=null;});
  el.addEventListener('dblclick',()=>setV(key,sp.d));
  el.addEventListener('wheel',e=>{e.preventDefault();if(coarse(e)){const cs=specOf(cK);setV(cK,clamp(getV(cK)-Math.sign(e.deltaY)*cS,cs.min,cs.max));return;}setV(key,fromN(sp,toN(sp,getV(key))-Math.sign(e.deltaY)*(sp.k==='int'?1/(sp.max-sp.min):.02)));},{passive:false});
  el.addEventListener('contextmenu',e=>{e.preventDefault();knobMenu(key,e.clientX,e.clientY,el);});
  S.knobs.add(el);el.draw();return el;}
function alive(el){if(el.isConnected){el.__seen=1;return true;}return !el.__seen;}
/* ---------- simple controls ---------- */
function sel(key,o){o=o||{};const sp=specOf(key),l=listOf(sp);const s=h('select',{class:'sel','data-p':key,'data-tip':sp.tip});
  if(o.groups){for(const g of o.groups){const og=h('optgroup',{label:g[0]});for(const i of g[1])og.appendChild(h('option',{value:i,text:l[i]}));s.appendChild(og);}}
  else l.forEach((t,i)=>s.appendChild(h('option',{value:i,text:(o.prefix||'')+t})));
  s.value=getV(key);s.addEventListener('change',()=>setV(key,+s.value));bind(key,()=>{if(!alive(s))return false;s.value=getV(key);});return s;}
function seg(key,o){o=o||{};const sp=specOf(key),l=listOf(sp);const w=h('div',{class:'seg','data-p':key,'data-tip':sp.tip});
  const bs=l.map((t,i)=>{const b=h('b',{text:(o.short&&o.short[i])||t,onclick:()=>setV(key,i)});w.appendChild(b);return b;});
  const upd=()=>{if(!alive(w))return false;bs.forEach((b,i)=>b.classList.toggle('on',i===getV(key)));};bind(key,upd);upd();return w;}
function tog(key,label,o){const sp=specOf(key);const b=h('button',{class:'btn sm','data-p':key,'data-tip':sp.tip,text:label||sp.l,onclick:()=>setV(key,getV(key)?0:1)});
  const upd=()=>{if(!alive(b))return false;b.classList.toggle('on',!!getV(key));};bind(key,upd);upd();return b;}
function panel(title,kids,style){return h('div',{class:'pn',style:style||''},[title?h('h3',{text:title}):null].concat(kids));}
function knobs(keys,o){return h('div',{class:'row w'},keys.map(k=>Array.isArray(k)?knob(k[0],Object.assign({},o,{label:k[1]})):knob(k,o)));}

/* live value of a modulation source, 0..1 (bipolar sources -1..1), for the rings and the source bar */
function liveSrc(id){const V=S.V;const i=+id.slice(1)-1;
  if(id[0]==='e')return V&&V.env?V.env[i]||0:0;
  if(id[0]==='l'&&id.length===2)return V&&V.lfo?V.lfo[i]||0:0;
  if(id[0]==='m')return S.p[id]||0;
  if(id==='vel')return S.lastVel||0;if(id==='key')return (S.lastNote||60)/127;
  if(id==='wheel')return S.wheelV||0;if(id==='bend')return S.bendV||0;if(id==='at')return 0;
  if(id==='rnd')return V&&V.rnd!==undefined?V.rnd:0;return 0;}
function srcRoutes(id){return S.slots.filter(x=>x.s===id);}
function srcPop(id){const sl=srcRoutes(id);const fu=/^e\d+$/.test(id)?filtEnvUsers(+id.slice(1)):[];if(!sl.length&&!fu.length){toast('Drag the circle of '+SRCNAME[id]+' onto any knob');return;}
  const uniOk=(id[0]==='l'&&id.length===2)||id==='bend'||id==='rnd';
  const frows=fu.map(f=>h('div',{class:'row',style:'align-items:center;gap:8px'},[h('span',{style:'width:150px;font-size:12px',text:'Filter '+f+' cutoff (Envelope select)'}),h('span',{style:'flex:1;font-size:12px;opacity:.7',text:'Amount is the Env knob on the filter'}),h('button',{class:'btn sm',text:'Detach',onclick:()=>{setV('f'+f+'.es',0);refreshAll();closeDlg();srcPop(id);}})]));
  const body=h('div',{class:'col',style:'min-width:380px;gap:5px'},frows.concat(sl.map(s=>{const row=h('div',{class:'row',style:'align-items:center;gap:8px'});
    const val=h('span',{class:'mono',style:'width:44px',text:Math.round(s.a*100)+'%'});
    const rg=h('input',{type:'range',class:'rg',min:-100,max:100,value:Math.round(s.a*100),style:'flex:1'});rg.oninput=()=>{s.a=rg.value/100;val.textContent=rg.value+'%';sendSlots();refreshAll();};
    row.append(h('span',{style:'width:150px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',text:nameOf(s.d),'data-tip':nameOf(s.d)}),rg,val);
    if(uniOk)row.appendChild(h('button',{class:'btn sm'+(s.u?' on':''),text:'Uni',onclick:function(){s.u=s.u?0:1;this.classList.toggle('on',!!s.u);sendSlots();}}));
    row.appendChild(h('button',{class:'btn sm',text:'Remove',onclick:()=>{S.slots.splice(S.slots.indexOf(s),1);sendSlots();refreshAll();rebuildMatrix&&rebuildMatrix();closeDlg();srcPop(id);}}));return row;})));
  const tot=sl.length+fu.length;dialog(SRCNAME[id]+' goes to '+tot+' place'+(tot>1?'s':''),body,[['Done',null,1]]);}
function filtEnvUsers(n){return [1,2].filter(f=>S.p['f'+f+'.es']===n);}
function updHandles(){const n={};for(const x of S.slots)n[x.s]=(n[x.s]||0)+1;for(const f of [1,2]){const e=S.p['f'+f+'.es'];if(e>=1)n['e'+e]=(n['e'+e]||0)+1;}document.querySelectorAll('.src[data-src]').forEach(e=>{const c=n[e.dataset.src]||0;e.classList.toggle('used',c>0);if(e.classList.contains('hg')){const b=e.querySelector('b');if(b)b.textContent=c?c:'';}});}
function src(id,label){return h('span',{class:'src hg '+id[0],'data-src':id,text:label||SRCNAME[id],'data-tip':'Drag the circle onto any knob to modulate it (+ means nothing attached yet, filled means it is in use). Right click to see its routes.'},[h('i',{class:'gl'}),h('b',{})]);}
/* ---------- modulation drag and drop ---------- */
let drag=null;
document.addEventListener('pointerdown',e=>{const s=e.target.closest&&e.target.closest('.src');if(!s||e.button)return;drag={src:s.dataset.src,hot:null};const g=$('#ghost');g.textContent=SRCNAME[drag.src];g.style.display='block';g.style.left=e.clientX+8+'px';g.style.top=e.clientY+8+'px';e.preventDefault();});
document.addEventListener('pointermove',e=>{if(!drag)return;const g=$('#ghost');g.style.left=e.clientX+8+'px';g.style.top=e.clientY+8+'px';
  const t=document.elementFromPoint(e.clientX,e.clientY),k=t&&t.closest('[data-p]');const hot=k&&modulatable(k.dataset.p)?k:null;if(drag.hot!==hot){if(drag.hot)drag.hot.classList.remove('hot');if(hot)hot.classList.add('hot');drag.hot=hot;}});
document.addEventListener('pointerup',e=>{if(!drag)return;$('#ghost').style.display='none';if(drag.hot){drag.hot.classList.remove('hot');addSlot(drag.src,drag.hot.dataset.p);}else{const t=document.elementFromPoint(e.clientX,e.clientY),k=t&&t.closest('[data-p]');if(k)toast('This control cannot be modulated');}drag=null;});
function addSlot(srcId,key){let s=S.slots.find(x=>x.s===srcId&&x.d===key);
  if(!s){if(S.slots.length>=64){toast('Modulation matrix is full (64 slots)');return;}s={s:srcId,d:key,a:.5,u:0};S.slots.push(s);sendSlots();}
  refreshAll();rebuildMatrix&&rebuildMatrix();toast(SRCNAME[srcId]+' > '+nameOf(key));const k=$$('[data-p="'+key+'"]').find(x=>x.offsetParent);if(k)modBubble(key,k);return s;}

/* quick amount bubble: no dialog, closes when you click elsewhere */
function modBubble(key,el){const old=$('#mbub');if(old)old.remove();const sl=slotsFor(key);if(!sl.length)return;
  const b=h('div',{id:'mbub'});const stage=$('#stage')||document.body;
  sl.forEach(s=>{const val=h('span',{class:'mono',style:'width:40px;text-align:right',text:Math.round(s.a*100)+'%'});
    const rg=h('input',{type:'range',class:'rg',min:-100,max:100,value:Math.round(s.a*100),style:'width:120px'});
    rg.oninput=()=>{s.a=rg.value/100;val.textContent=rg.value+'%';sendSlots();refreshAll();};
    b.appendChild(h('div',{class:'row',style:'align-items:center;gap:6px'},[h('span',{class:'mbs '+s.s[0],text:SRCNAME[s.s]}),rg,val,h('button',{class:'btn sm',text:'x','data-tip':'Remove this route',onclick:()=>{S.slots.splice(S.slots.indexOf(s),1);sendSlots();refreshAll();rebuildMatrix&&rebuildMatrix();b.remove();}})]));});
  document.body.appendChild(b);const r=el.getBoundingClientRect(),w=b.offsetWidth,hh=b.offsetHeight;
  b.style.left=Math.max(4,Math.min(innerWidth-w-4,r.left+r.width/2-w/2))+'px';b.style.top=(r.bottom+hh+8>innerHeight?Math.max(4,r.top-hh-8):r.bottom+6)+'px';
  const off=ev=>{if(!b.contains(ev.target)){b.remove();document.removeEventListener('pointerdown',off,true);}};setTimeout(()=>document.addEventListener('pointerdown',off,true),50);
  clearTimeout(modBubble.t);modBubble.t=setTimeout(()=>{if(b.isConnected&&!b.matches(':hover')){b.remove();document.removeEventListener('pointerdown',off,true);}},6000);}
function modPopSoon(key,el){const r=el.getBoundingClientRect();modPop(key,r.right,r.top);}
let rebuildMatrix=null;function setRebuildMatrix(f){rebuildMatrix=f;}
function modPop(key,x,y){const sl=slotsFor(key);if(!sl.length){toast('Drag a modulator onto this control first');return;}
  const body=h('div',{class:'col',style:'min-width:320px'},sl.map(s=>{const uni=(s.s[0]==='l'&&s.s.length===2)||s.s==='bend'||s.s==='rnd';
    const row=h('div',{class:'row',style:'align-items:center;gap:8px'});const val=h('span',{class:'mono',style:'width:48px',text:Math.round(s.a*100)+'%'});
    const rg=h('input',{type:'range',class:'rg',min:-100,max:100,value:Math.round(s.a*100),style:'flex:1'});rg.oninput=()=>{s.a=rg.value/100;val.textContent=rg.value+'%';sendSlots();refreshAll();};
    row.append(h('span',{class:'src '+s.s[0],text:SRCNAME[s.s]}),rg,val);
    if(uni)row.appendChild(h('button',{class:'btn sm'+(s.u?' on':''),text:'Uni','data-tip':'Unipolar: the bipolar source only pushes up (0 to 1).',onclick:function(){s.u=s.u?0:1;this.classList.toggle('on',!!s.u);sendSlots();}}));
    row.appendChild(h('button',{class:'btn sm',text:'Remove',onclick:()=>{S.slots.splice(S.slots.indexOf(s),1);sendSlots();refreshAll();rebuildMatrix&&rebuildMatrix();closeDlg();}}));return row;}));
  dialog('Modulation of '+nameOf(key),body,[['Done',null,1]]);}
/* ---------- meters ---------- */
const DBMIN=-60,DBMAX=6;
function dbpos(db){return clamp((db-DBMIN)/(DBMAX-DBMIN),0,1);}
function toDb(x){return 20*Math.log10(Math.max(x,1e-6));}
/* meter colours = JPurrr-8000 / cat-ui SodaPop: popOcean 398BC4 at the bottom, popSky 6CC9F5 at -34, periwinkle 774BF9 at -22, orchid A43DFF at -8, hotPink FF1383 from -1 dB up */
const METER_STOPS=[[-60,'#398BC4'],[-34,'#6CC9F5'],[-22,'#774BF9'],[-8,'#A43DFF'],[-1,'#FF1383'],[6,'#FF1383']];
function meterGrad(g,x0,y0,x1,y1){const gr=g.createLinearGradient(x0,y0,x1,y1);for(const [db,c] of METER_STOPS)gr.addColorStop(dbpos(db),c);return gr;}
const peakCol=db=>db>=-1?'#FF1383':db>-12?'#A43DFF':'#6CC9F5';
function drawMeter(c,l,r,vertical,pk){const g=c.g,W=c.W,H=c.H;g.clearRect(0,0,W,H);g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);
  const hold=c._pk||(c._pk=[{v:DBMIN,t:0},{v:DBMIN,t:0}]),now=performance.now(),bars=[l,r];
  for(let i=0;i<2;i++){const db=toDb(bars[i]),p=dbpos(db),pkk=hold[i];if(db>=pkk.v||now-pkk.t>1500){if(db>=pkk.v)pkk.t=now;pkk.v=db>=pkk.v?db:Math.max(db,pkk.v-.6);}
    const pp=dbpos(pkk.v);
    if(vertical){const bw=(W-14)/2-1,bx=14+i*(bw+2);g.fillStyle='rgba(255,255,255,.05)';g.fillRect(bx,0,bw,H);g.save();g.beginPath();g.rect(bx,H-p*H,bw,p*H);g.clip();g.fillStyle=meterGrad(g,0,H,0,0);g.fillRect(bx,0,bw,H);g.restore();
      if(pkk.v>DBMIN+1){g.fillStyle=peakCol(pkk.v);g.fillRect(bx,Math.min(H-2,H-pp*H),bw,2);}}
    else{const bh=(H-12)/2-1,by=i*(bh+2);g.fillStyle='rgba(255,255,255,.05)';g.fillRect(0,by,W,bh);g.save();g.beginPath();g.rect(0,by,p*W,bh);g.clip();g.fillStyle=meterGrad(g,0,0,W,0);g.fillRect(0,by,W,bh);g.restore();
      if(pkk.v>DBMIN+1){g.fillStyle=peakCol(pkk.v);g.fillRect(Math.min(W-2,pp*W),by,2,bh);}}}
  g.fillStyle=cssv('--dim');g.font='8px JetBrains Mono,monospace';g.textAlign='left';
  for(const t of [-48,-36,-24,-12,-6,0]){const p=dbpos(t);if(vertical){g.fillRect(10,H-p*H,3,1);g.fillText(t,0,H-p*H+3);}else{g.fillRect(p*W,H-5,1,3);g.fillText(t,p*W-6,H-1);}}}
/* ---------- view scale and handles ---------- */
const VIEW={zoom:1,base:1,W:1280,H:900};
function fit(){const vw=innerWidth,vh=innerHeight;VIEW.base=Math.min(vw/VIEW.W,vh/VIEW.H);const s=VIEW.base*VIEW.zoom;const st=$('#stage');st.style.transform='translate('+(-VIEW.W*s/2)+'px,'+(-VIEW.H*s/2)+'px) scale('+s+')';
  const z=$('#zoomread');if(z)z.textContent=Math.round(VIEW.zoom*100)+'%  '+Math.round(VIEW.W*s)+' x '+Math.round(VIEW.H*s);}
function makeHandles(){const defs=[['l',0,0,10,100,'ew-resize'],['r',0,0,10,100,'ew-resize'],['t',0,0,100,10,'ns-resize'],['b',0,0,100,10,'ns-resize'],['tl',0,0,14,14,'nwse-resize'],['tr',0,0,14,14,'nesw-resize'],['bl',0,0,14,14,'nesw-resize'],['br',0,0,14,14,'nwse-resize']];
  const els=[];for(const d of defs){const e=h('div',{class:'hnd','data-h':d[0],style:'cursor:'+d[5]+';width:'+d[3]+(d[3]===100?'%':'px')+';height:'+d[4]+(d[4]===100?'%':'px')});
    const pos={l:'left:0;top:0;height:100%',r:'right:0;top:0;height:100%',t:'left:0;top:0;width:100%',b:'left:0;bottom:0;width:100%',tl:'left:0;top:0',tr:'right:0;top:0',bl:'left:0;bottom:0',br:'right:0;bottom:0'}[d[0]];
    e.style.cssText+=';'+pos;if(d[0]==='l'||d[0]==='r')e.style.width='8px';if(d[0]==='t'||d[0]==='b')e.style.height='8px';
    let st=null;e.addEventListener('pointerdown',ev=>{e.setPointerCapture(ev.pointerId);st={x:ev.clientX,y:ev.clientY,z:VIEW.zoom};ev.preventDefault();});
    e.addEventListener('pointermove',ev=>{if(!st)return;const k=d[0];let f=1;const hw=VIEW.W*VIEW.base*st.z/2,hh=VIEW.H*VIEW.base*st.z/2;
      const dx=ev.clientX-st.x,dy=ev.clientY-st.y;let fx=1,fy=1;
      if(k.includes('r'))fx=(hw+dx/2)/hw;if(k.includes('l'))fx=(hw-dx/2)/hw;if(k.includes('b'))fy=(hh+dy/2)/hh;if(k.includes('t'))fy=(hh-dy/2)/hh;
      f=k.length===2?Math.max(fx,fy):(k==='l'||k==='r'?fx:fy);VIEW.zoom=clamp(st.z*f,.3,3);fit();});
    e.addEventListener('pointerup',()=>{st=null;});els.push(e);document.body.appendChild(e);}
}
addEventListener('resize',fit);
/* helpers used by pages */
function fmtHz(f){return f>=1000?(f/1000).toFixed(f>=10000?0:1)+'k':Math.round(f)+'';}
function dbstr(x){return (x>-99?x.toFixed(1):'-inf')+' dB';}

/* ---------- right click menu on any knob ---------- */
function knobMenu(key,x,y,el){const old=$('#kmenu');if(old)old.remove();const sp=specOf(key),sl=slotsFor(key);const m=h('div',{id:'kmenu'});
  const close=()=>{m.remove();document.removeEventListener('pointerdown',off,true);};const off=ev=>{if(!m.contains(ev.target))close();};
  const item=(t,fn,tip)=>h('div',{class:'kmi','data-tip':tip||'',onclick:()=>{fn();close();}},[h('span',{text:t})]);
  m.appendChild(h('div',{class:'kmh',text:nameOf(key)+'  '+fmt(sp,getV(key))}));
  for(const r of sl){const val=h('span',{class:'mono',style:'width:38px;text-align:right',text:Math.round(r.a*100)+'%'});
    const rg=h('input',{type:'range',class:'rg',min:-100,max:100,value:Math.round(r.a*100),style:'width:110px'});rg.oninput=()=>{r.a=rg.value/100;val.textContent=rg.value+'%';sendSlots();refreshAll();};
    const by=h('button',{class:'btn sm'+(r.b?'':' on'),text:r.b?'Off':'On','data-tip':'Bypass this route without removing it.',onclick:()=>{r.b=r.b?0:1;by.textContent=r.b?'Off':'On';by.classList.toggle('on',!r.b);sendSlots();refreshAll();rebuildMatrix&&rebuildMatrix();}});
    m.appendChild(h('div',{class:'row kmr',style:'align-items:center;gap:6px'},[h('span',{class:'mbs '+r.s[0],text:SRCNAME[r.s]}),rg,val,by,h('button',{class:'btn sm',text:'x','data-tip':'Remove this route.',onclick:()=>{S.slots.splice(S.slots.indexOf(r),1);sendSlots();refreshAll();rebuildMatrix&&rebuildMatrix();close();knobMenu(key,x,y,el);}})]));}
  if(sl.length){const allOff=sl.every(r=>r.b);
    m.appendChild(item(allOff?'Turn all modulation back on':'Bypass all modulation',()=>{for(const r of sl)r.b=allOff?0:1;sendSlots();refreshAll();rebuildMatrix&&rebuildMatrix();},'Keeps the routes but stops them moving this control.'));
    m.appendChild(item('Remove all modulation',()=>{S.slots=S.slots.filter(r=>r.d!==key);sendSlots();refreshAll();rebuildMatrix&&rebuildMatrix();}));}
  if(modulatable(key)){const rs=h('select',{class:'sel',style:'width:100%','data-tip':'Pick a source to route to this control. You can also drag a source circle onto the knob.'},[h('option',{value:'',text:'Route a source here...'})].concat(D.SRCS.filter(id=>!sl.some(r=>r.s===id)).map(id=>h('option',{value:id,text:SRCNAME[id]}))));
    rs.onchange=()=>{if(!rs.value)return;close();addSlot(rs.value,key);};m.appendChild(h('div',{class:'kmi',style:'padding:4px 8px'},[rs]));}
  m.appendChild(item('Reset to default ('+fmt(sp,sp.d)+')',()=>setV(key,sp.d)));
  document.body.appendChild(m);const w=m.offsetWidth,hh=m.offsetHeight;m.style.left=Math.max(4,Math.min(innerWidth-w-4,x))+'px';m.style.top=Math.max(4,Math.min(innerHeight-hh-4,y))+'px';
  setTimeout(()=>document.addEventListener('pointerdown',off,true),30);}
