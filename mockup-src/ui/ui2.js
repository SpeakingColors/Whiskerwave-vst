/* ===== pages 1: Sound, Filter, Mod ===== */
const PAGES={};
const OSCN={a:'OSC A',b:'OSC B',c:'OSC C',d:'OSC D',e:'OSC E',f:'OSC F'};
const RECIPE_LIST=D.recipeNames();
const RCATS=[];for(const r of RECIPE_LIST)if(!RCATS.includes(r.cat))RCATS.push(r.cat);
function tableSelect(o){const k='abcdef'[o];const s=h('select',{class:'sel',style:'width:128px','data-tip':'Wavetable of this oscillator. Open the Wave Lab to draw, import, morph or make your own.'});
  for(const c of RCATS){const g=h('optgroup',{label:c});for(const r of RECIPE_LIST)if(r.cat===c)g.appendChild(h('option',{value:r.name,text:r.name}));s.appendChild(g);}
  const upd=()=>{if(!alive(s))return false;if(S.frames[k]){if(!s.querySelector('option[data-user]'))s.insertBefore(h('option',{value:'__user',text:'User wave','data-user':1}),s.firstChild);s.value='__user';}else s.value=S.tabs[k];};
  s.onchange=()=>{if(s.value==='__user')return;loadTable(o,s.value);};tableBinds.push(upd);upd();return s;}
const tableBinds=[];
function loadTable(o,name){const k='abcdef'[o];S.tabs[k]=name;delete S.frames[k];send({t:'table',o,name,sw:S.p[k+'.sw'],sk:S.p[k+'.sk']});tableCache[k]=null;tableBinds.forEach(f=>f());}
const tableCache={};
function framesOf(k){if(S.frames[k])return S.frames[k];if(!tableCache[k]||tableCache[k].name!==S.tabs[k]){const t=D.makeTable(S.tabs[k],32);tableCache[k]={name:S.tabs[k],fr:t.src};}return tableCache[k].fr;}
const WFS={};
function drawWaterfall(c,k){const g=c.g,W=c.W,H=c.H,fr=framesOf(k),nf=fr.length;g.clearRect(0,0,W,H);g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);
  const t=performance.now()/1000,st=WFS[k]||(WFS[k]={p:S.p[k+'.pos'],l:0,ph:0});
  const pos=S.p[k+'.pos'],live=S.V&&S.V.nv>0&&S.V.pos&&S.V.pos['abcdef'.indexOf(k)]!==undefined;
  const tgt=live?S.V.pos['abcdef'.indexOf(k)]:pos;st.p+=(tgt-st.p)*.22;st.l+=((live?1:0)-st.l)*.08;st.ph+=.02+.05*st.l;
  const fp=Math.max(0,Math.min(1,st.p))*(nf-1),f0=Math.floor(fp),f1=Math.min(nf-1,f0+1),fx=fp-f0;
  const A=H*.2,base=H-6-A-3,rise=H-12-2*A-8,w=W*.78,sx=W*.18,cs=cssv('--selbd'),ca=cssv('--acc'),amp=.5+2.2*st.l,drift=Math.sin(t*.45)*2.5;
  const trace=(wave,ox,oy,ph,a,fam)=>{g.beginPath();for(let i=0;i<=128;i++){const v=wave(i);const x=ox+i/128*w,y=oy-v*A+Math.sin(ph+i*.11)*a+Math.sin(ph*.7-i*.05)*a*.5;i?g.lineTo(x,y):g.moveTo(x,y);}};
  for(let f=nf-1;f>=0;f--){const d=f-fp,near=Math.exp(-d*d/5),ox=8+drift*(f/nf)+(f/nf)*sx,oy=base-(f/nf)*rise;
    trace(i=>fr[f][Math.floor(i/128*2047)],ox,oy,st.ph*3+f*.4,amp*(.35+near),0);
    g.strokeStyle=cs;g.globalAlpha=Math.min(1,.2+.35*(f/nf)+.55*near*(.5+.5*st.l));g.lineWidth=1;g.stroke();}
  /* the live morphed frame: glows, travels through the stack as the position moves */
  const ox=8+drift*(fp/nf)+(fp/nf)*sx,oy=base-(fp/nf)*rise;
  const wv=i=>{const q=Math.floor(i/128*2047);return fr[f0][q]*(1-fx)+fr[f1][q]*fx;};
  trace(wv,ox,oy,st.ph*3+fp*.4,amp*1.3,1);g.shadowColor=ca;g.shadowBlur=6+8*st.l;g.strokeStyle=ca;g.globalAlpha=1;g.lineWidth=1.8;g.stroke();g.shadowBlur=0;
  /* a soft light that sweeps along the live trace */
  const sw=((t*(.35+.5*st.l))%1);const sxp=ox+sw*w;g.globalAlpha=.55;const gr=g.createRadialGradient(sxp,oy,0,sxp,oy,16);gr.addColorStop(0,ca);gr.addColorStop(1,'transparent');g.fillStyle=gr;g.fillRect(sxp-16,oy-18,32,36);
  g.globalAlpha=1;g.fillStyle=cssv('--dim');g.font='9px JetBrains Mono,monospace';g.fillText(S.frames[k]?'User wave':S.tabs[k],5,10);
  g.fillText('frame '+(fp+1).toFixed(1)+'/'+nf,W-76,10);}
function drawSmallFrame(c,k){/* live single frame */}
function oscPanel(o){const k='abcdef'[o],p=k+'.';
  const disp=cv(365,105);disp.dataset.osc=k;
  const L=(arr)=>h('div',{class:'row',style:'gap:2px'},arr.map(x=>knob(p+x[0],{sm:true,label:x[1]})));
  const kn=(x)=>knob(p+x[0],{sm:true,label:x[1]});
  const stepSel=(key)=>{const e=sel(key);e.style.width='70px';const mk=(t,d,tip)=>h('button',{class:'btn sm stp',text:t,'data-tip':tip,onclick:()=>{const n=listOf(specOf(key)).length;setV(key,(getV(key)+d+n)%n);}});return h('div',{class:'row',style:'gap:1px;align-items:center;flex:none'},[mk('<',-1,'Previous warp mode.'),e,mk('>',1,'Next warp mode.')]);};
  const tsel=tableSelect(o);tsel.style.width='92px';
  // compact layout: each segment = a header line (menus or caption) right above its knobs; no boxes
  const SG=(head,ks,slots,cls)=>h('div',{class:'sg'+(cls?' '+cls:''),style:'width:'+(slots*46)+'px'},[h('div',{class:'sgh'},head.map(x=>typeof x==='string'?h('span',{class:'cap gc',text:x}):x)),h('div',{class:'row',style:'gap:0'},ks.map(kn))]);
  const msel=(key,w,o)=>{const e=sel(key,o);e.style.width=w+'px';return e;};
  const engSel=msel(p+'eng',84);engSel.classList.add('engsel');
  const tbar=h('div',{class:'row',style:'gap:1px;align-items:center;flex:none'},[tsel,h('button',{class:'btn sm stp',text:'<','data-tip':'Previous wavetable.',onclick:()=>stepTable(o,-1)}),h('button',{class:'btn sm stp',text:'>','data-tip':'Next wavetable.',onclick:()=>stepTable(o,1)})]);
  const C1=(key,w,kk,lab,o2)=>h('div',{class:'sg sgc',style:'width:'+w+'px'},[h('div',{class:'sgh'},[msel(key,w-4,o2)]),h('div',{class:'row',style:'gap:0;justify-content:center'},[kn([kk,lab])])]); // one menu with its own knob right under it
  const wtRow=h('div',{class:'sgrow'},[SG([tbar],[['pos','Wave Pos'],['sw','Spec'],['sk','Smear']],3),C1(p+'w1',58,'w1a','Warp 1'),C1(p+'w2',58,'w2a','Warp 2')]);
  const smpRow=h('div',{class:'sgrow',style:'display:none'},[SG(['Sample',h('span',{class:'sp'}),tog(p+'sloop','Loop')],[['sroot','Root'],['gp','G.pos'],['gs','G.size'],['gd','Dens.'],['gj','Jitter']],5)]);
  const engUpd=()=>{if(!alive(wtRow))return false;const e=S.p[p+'eng'];wtRow.style.display=e===0?'':'none';smpRow.style.display=e===0?'none':'';};bind(p+'eng',engUpd);engUpd();
  const semiStep=d=>h('button',{class:'btn sm stp',text:d<0?'<':'>','data-tip':(d<0?'Down':'Up')+' one octave (12 semitones). Tip: hold Ctrl, Cmd or Alt while dragging or scrolling the Semi knob to do the same.',onclick:()=>{const sp=specOf(p+'semi');setV(p+'semi',clamp(S.p[p+'semi']+12*d,sp.min,sp.max));}});
  const pitchSG=h('div',{class:'sg',style:'width:184px'},[h('div',{class:'sgh'},[h('span',{class:'cap gc',text:'Pitch'})]),h('div',{class:'row',style:'gap:0;align-items:flex-start'},[h('span',{style:'margin-top:10px'},[semiStep(-1)]),knob(p+'semi',{sm:true,label:'Semi',coarse:true}),h('span',{style:'margin-top:10px'},[semiStep(1)]),kn(['fine','Fine']),kn(['pit','Pitch'])])]);
  const pn=panel(null,[
    h('div',{class:'row',style:'align-items:center'},[oscPower(p+'on'),h('h3',{text:'OSC',style:'margin:0;font-size:14px'}),oscSwitch(o%3),engSel,h('span',{class:'sp'}),h('span',{class:'cap',text:'To'}),sel(p+'rt')]),
    disp,
    h('div',{class:'row',style:'gap:0;align-items:flex-start'},[h('div',{class:'col',style:'gap:0'},[wtRow,smpRow]),C1(p+'mm',58,'ma','Mod amt'),C1(p+'ms',64,'fb','Fdbk',{prefix:'from '})]),
    h('div',{class:'sgrow'},[SG(['Unison',msel(p+'us',84)],[['uv','Voices'],['ud','Detune'],['ub','Blend'],['usp','Spread']],4),pitchSG]),
    h('div',{class:'sgrow'},[SG(['Start'],[['ph','Phase'],['rnd','Rand']],2),SG(['Dive'],[['dv','Dive'],['dt','Time']],2),SG(['Analog'],[['anl','Analog']],1),h('span',{class:'sp'}),SG(['Out',msel(p+'env',52)],[['lvl','Level'],['pan','Pan']],2)])],'width:388px');
  const ubUpd=()=>{if(!alive(pn))return false;const sp=S.p[p+'us']===1||S.p[p+'us']===2,kb=pn.querySelector('[data-p="'+p+'ub"]');if(kb){kb.style.opacity=sp?1:.35;const l=kb.querySelector('.l');if(l)l.textContent=sp?'Side mix':'Blend';kb.dataset.tip=sp?'Supersaw only: level of the detuned side voices against the centre voice. Raise Voices (7 is the classic) and Detune to hear it.':'Blend only works in the Supersaw style. Set Style to Supersaw to use it.';}};bind(p+'us',ubUpd);setTimeout(ubUpd,0);
  const offUpd=()=>{if(!alive(pn))return false;pn.classList.toggle('oscoff',!S.p[p+'on']);};bind(p+'on',offUpd);offUpd();
  return pn;}
const oscPg=[0,0,0],oscWrap=[];
function oscSwitch(slot){const L='abcdef',sw=h('div',{class:'seg oscsw','data-tip':'Each oscillator slot has two pages. Switch between OSC '+L[slot].toUpperCase()+' and OSC '+L[slot+3].toUpperCase()+'. A dot means the other page is on.'});
  [0,1].forEach(pgi=>{const k=L[slot+3*pgi];const b=h('b',{text:k.toUpperCase(),onclick:()=>setOscPg(slot,pgi)});sw.appendChild(b);
    bind(k+'.on',()=>{if(!alive(b))return false;const cur=oscPg[slot];b.classList.toggle('lit',!!S.p[k+'.on']&&cur!==pgi);});});
  const upd=()=>{if(!alive(sw))return false;$$('b',sw).forEach((b,i)=>{b.classList.toggle('on',i===oscPg[slot]);b.classList.toggle('lit',!!S.p[L[slot+3*i]+'.on']&&i!==oscPg[slot]);});};
  sw._upd=upd;(oscSwitch.all=oscSwitch.all||[]).push(sw);upd();return sw;}
function setOscPg(slot,pgi){oscPg[slot]=pgi;if(oscWrap[slot])[...oscWrap[slot].children].forEach((c,i)=>c.style.display=i===pgi?'':'none');(oscSwitch.all||[]).forEach(w=>w._upd&&w._upd());}
function oscPair(slot){const w=h('div',{class:'col',style:'gap:0'},[oscPanel(slot),oscPanel(slot+3)]);oscWrap[slot]=w;w.children[1].style.display='none';return w;}
function stepTable(o,d){const k='abcdef'[o],i=RECIPE_LIST.findIndex(r=>r.name===S.tabs[k]);loadTable(o,RECIPE_LIST[(i+d+RECIPE_LIST.length)%RECIPE_LIST.length].name);}
/* envelope preview using the real envelope code */
function envPoints(o,w){const a=o.a,hd=o.h||0,d=o.d,sv=o.s,r=o.r,ca=o.ca||0,c=o.c===undefined?-.4:o.c;
  const ea=Math.min(a,4000),ed=Math.min(d,4000),er=Math.min(r,4000),eh=Math.min(hd,2000),sus=Math.max(120,(ea+eh+ed)*.35),T=ea+eh+ed+sus+er;const e=new D.Env();e.on();const out=[];let off=false;
  for(let i=0;i<w;i++){const t=i/(w-1)*T;if(!off&&t>=ea+eh+ed+sus){e.off();off=true;}out.push(e.tick(T/w/1000,a,hd,d,sv,r,ca,c));}return out;}
function envOf(pre){const g=k=>S.p[pre+k];return {a:g('a'),h:g('h'),d:g('d'),s:g('s'),r:g('r'),ca:g('ca'),c:g('c')};}
function drawEnv(cvs,o,live){const g=cvs.g,W=cvs.W,H=cvs.H;g.clearRect(0,0,W,H);g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);
  g.strokeStyle=cssv('--grid');g.lineWidth=1;for(let i=1;i<4;i++){g.beginPath();g.moveTo(0,H*i/4);g.lineTo(W,H*i/4);g.stroke();}
  const pts=envPoints(o,W);g.beginPath();pts.forEach((v,i)=>{const y=H-4-v*(H-8);i?g.lineTo(i,y):g.moveTo(i,y);});g.strokeStyle=cssv('--acc4');g.lineWidth=2;g.stroke();
  g.lineTo(W,H);g.lineTo(0,H);g.fillStyle=cssv('--acc4');g.globalAlpha=.12;g.fill();g.globalAlpha=1;
  if(live!==undefined&&live>0){g.fillStyle=cssv('--text');g.fillRect(2,H-4-live*(H-8)-1,W-4,1);}}
const SRCK=['a','b','c','sub','nz','d','e','f'],SRCSHOW=['a','b','c','d','e','f','sub','nz'],SRCLBL={a:'A',b:'B',c:'C',d:'D',e:'E',f:'F',sub:'Sub',nz:'Noise'};
function sourceEnvPanel(){let cur='sub';const ed=cv(146,54),sv=h('div',{class:'seg'}),body=h('div',{class:'col'});
  const build=()=>{body.innerHTML='';body.append(h('div',{class:'row'},[ed,h('div',{class:'col',style:'gap:3px'},[tog(cur+'.eo','Own envelope'),h('span',{class:'cap',style:'max-width:150px;white-space:normal;text-transform:none',text:'Off: follows Env 1. On: this source has its own attack and tail.'})])]),knobs([cur+'.ea',cur+'.ed',cur+'.es',cur+'.er'],{sm:true}));
    $$('b',sv).forEach((b,i)=>b.classList.toggle('on',SRCSHOW[i]===cur));};
  SRCSHOW.forEach(x=>sv.appendChild(h('b',{text:SRCLBL[x],onclick:()=>{cur=x;build();}})));
  ed.draw=()=>drawEnv(ed,{a:S.p[cur+'.ea'],d:S.p[cur+'.ed'],s:S.p[cur+'.es'],r:S.p[cur+'.er'],h:0,ca:0,c:-.4},S.V&&S.V.sen?S.V.sen[SRCK.indexOf(cur)]:undefined);
  build();animators.push({draw:()=>{if(S.page==='mod')ed.draw();}});return panel('SOURCE ENVELOPES',[sv,body],'width:316px');}
const animators=[];
function filterStrip(){const row=fi=>{const k='f'+fi+'.';const s0=sel(k+'type',{groups:filterGroups()});s0.style.width='96px';
    return h('div',{class:'row',style:'align-items:flex-start;gap:1px'},[h('div',{class:'col',style:'gap:2px;width:100px'},[h('span',{class:'cap',text:'Filter '+fi}),s0,(()=>{const e=sel(k+'es');e.style.width='100px';e.addEventListener('change',()=>{const v=S.p[k+'es'];if(v>=1&&bank_set)bank_set(v);updHandles();});return e;})()]),...[['cut','Cut'],['res','Res'],['env','Env'],['drv','Drive']].map(x=>knob(k+x[0],{sm:true,label:x[1]}))]);};
  return panel('FILTERS',[h('div',{class:'row',style:'align-items:center'},[seg('frt',{short:['Serial','Parallel']}),h('span',{class:'cap',style:'text-transform:none',text:'More on the Filter tab'})]),row(1),row(2)],'width:316px');}
function soundPage(){const pg=h('div',{class:'page on','data-page':'sound',style:'flex-direction:column'});
  const top=h('div',{class:'row',style:'gap:8px'},[oscPair(0),oscPair(1),oscPair(2)]);
  const kr=(pre,l)=>h('div',{class:'row',style:'gap:1px;align-items:flex-start'},l.map(x=>knob(pre+x[0],{sm:true,label:x[1]})));
  const ns=(k,w)=>{const e=sel(k);e.style.width=w+'px';return e;};
  const sub=panel('SUB',[h('div',{class:'row',style:'align-items:center;gap:4px'},[tog('s.sub','On'),ns('s.sw',84),ns('s.srt',56),ns('sub.env',58)]),
    kr('s.',[['so','Oct'],['sfn','Fine'],['sl','Level'],['spn','Pan'],['sph','Phase'],['spw','PW']]),
    h('div',{class:'row',style:'gap:1px;align-items:flex-start'},[knob('s.sth',{sm:true,label:'Thick'}),knob('s.sfm',{sm:true,label:'FM A'}),knob('s.sdr',{sm:true,label:'Drive'}),knob('s.sfh',{sm:true,label:'Fixed'}),h('div',{class:'col',style:'gap:3px;margin-left:6px'},[tog('s.skt','Key track'),tog('s.srs','Retrig')])])],'width:274px');
  const nz=panel('NOISE',[h('div',{class:'row',style:'align-items:center;gap:4px'},[tog('s.nz','On'),ns('s.nt',100),ns('s.rt',56),ns('nz.env',58)]),
    kr('s.',[['nl','Level'],['npn','Pan'],['nw','Width'],['nhp','HP'],['nlp','LP'],['pk','Punch']]),
    kr('s.',[['ntn','Tone'],['nd','Density'],['nr','S&H rate']])],'width:274px');
  const glob=panel('VOICES AND MASTER',[h('div',{class:'row',style:'align-items:center'},[seg('vmode',{short:['Poly','Mono','Legato']}),tog('lim','Limiter')]),h('div',{class:'row w'},[...[['poly','Voices'],['glide','Glide'],['bendr','Bend'],['vel','Vel'],['anlg','Analog'],['bpm','Tempo'],['master','Master'],['ceil','Ceil']].map(x=>knob(x[0],{sm:true,label:x[1]})),h('button',{class:'btn sm','data-tip':'Sets every active oscillator to Supersaw style: 7 voices, a centre voice plus detuned sides, wide spread, free phase. Works with any wavetable, not only saws. Fine tune with each oscillator\'s Detune, Blend and Spread.',text:'Supersaw all',style:'align-self:center;margin-left:6px;width:120px',onclick:supersawAll})])],'width:296px');
  pg.append(top,h('div',{class:'row',style:'gap:8px'},[sub,nz,filterStrip(),envBank()]));window.GLOBPANEL=glob;
  animators.push({draw:()=>{if(S.page!=='sound')return;$$('canvas[data-osc]',pg).forEach(c=>{if(c.offsetParent)drawWaterfall(c,c.dataset.osc);});}});
  return pg;}
/* ---------- filter page ---------- */
const FT=D.FT;const FCATS=[];for(const f of FT)if(!FCATS.includes(f[1]))FCATS.push(f[1]);
function filterGroups(){return FCATS.map(c=>[c==='-'?'Off':c,FT.map((f,i)=>f[1]===c?i:-1).filter(i=>i>=0)]);}
const fresp=new Map();
function filterResponse(type,cut,res,sh,W){const key=type+'|'+cut.toFixed(1)+'|'+res.toFixed(3)+'|'+sh.toFixed(2)+'|'+W;if(fresp.has(key))return fresp.get(key);
  const sr=44100,N=4096,f=new D.VFilt();f.set(type,cut,res,0,1,sr,sh,0);const x=new Float64Array(N),im=new Float64Array(N),o=[0,0];
  for(let i=0;i<N;i++){f.proc(i===0?.01:0,0,o);x[i]=o[0]*100;}D.fft(x,im);const out=[];
  for(let i=0;i<W;i++){const fr=20*Math.pow(1000,i/(W-1)),b=fr/sr*N,b0=Math.floor(b),a=Math.hypot(x[b0],im[b0]);out.push(20*Math.log10(a+1e-6));}
  if(fresp.size>200)fresp.clear();fresp.set(key,out);return out;}
function drawFilter(c,fi){const g=c.g,W=c.W,H=c.H,k='f'+fi+'.';g.clearRect(0,0,W,H);g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);
  g.font='9px JetBrains Mono,monospace';g.fillStyle=cssv('--dim');g.strokeStyle=cssv('--grid');g.lineWidth=1;
  for(const db of [-48,-36,-24,-12,0,12,24]){const y=H-(db+60)/96*H;g.beginPath();g.moveTo(24,y);g.lineTo(W,y);g.stroke();g.fillText(db,2,y+3);}
  for(const f of [50,100,200,500,1000,2000,5000,10000]){const x=24+Math.log(f/20)/Math.log(1000)*(W-24);g.beginPath();g.moveTo(x,0);g.lineTo(x,H-10);g.stroke();g.fillText(fmtHz(f),x-8,H-1);}
  const r=filterResponse(S.p[k+'type'],S.p[k+'cut'],S.p[k+'res'],S.p[k+'sh'],W-24);g.beginPath();r.forEach((v,i)=>{const y=clamp(H-(v+60)/96*H,0,H),x=24+i;i?g.lineTo(x,y):g.moveTo(x,y);});
  g.strokeStyle=cssv('--acc');g.lineWidth=2;g.stroke();
  const cx=24+Math.log(S.p[k+'cut']/20)/Math.log(1000)*(W-24);g.strokeStyle=cssv('--acc2');g.lineWidth=1;g.setLineDash([3,3]);g.beginPath();g.moveTo(cx,0);g.lineTo(cx,H-10);g.stroke();g.setLineDash([]);
  g.fillStyle=cssv('--acc4');g.fillText(D.FT[S.p[k+'type']][0]+'  '+fmtHz(S.p[k+'cut'])+'Hz',30,11);}
function filterPanel(fi){const k='f'+fi+'.',c=cv(360,170);c.dataset.f=fi;let drag=false;
  const tipLine=h('div',{class:'cap',style:'height:26px;white-space:normal;text-transform:none;color:var(--dim)'});
  const updTip=()=>{if(!alive(tipLine))return false;tipLine.textContent=D.FTIP[S.p[k+'type']];};bind(k+'type',updTip);updTip();
  const fromPtr=e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*c.W;setV(k+'cut',20*Math.pow(1000,clamp((x-24)/(c.W-24),0,1)));};
  c.addEventListener('pointerdown',e=>{drag=true;c.setPointerCapture(e.pointerId);fromPtr(e);});c.addEventListener('pointermove',e=>{if(drag)fromPtr(e);});c.addEventListener('pointerup',()=>drag=false);
  c.dataset.tip='Drag left and right to move the cutoff. The curve is measured from the real filter code.';
  return panel('FILTER '+fi,[h('div',{class:'row',style:'align-items:center'},[sel(k+'type',{groups:filterGroups()}),sel(k+'dm')]),c,tipLine,knobs([k+'cut',k+'res',k+'drv',k+'sh',k+'kt',k+'env',k+'mix']),...filterExtras(fi)],'width:392px');}
function filterPage(){const pg=h('div',{class:'page','data-page':'filter'});
  const comb=cv(380,200);comb.dataset.tip='Both filters together as set on this page, in the routing you picked.';comb.draw=()=>{const g=comb.g,W=comb.W,H=comb.H;g.clearRect(0,0,W,H);g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);g.font='9px JetBrains Mono,monospace';g.fillStyle=cssv('--dim');g.strokeStyle=cssv('--grid');
    for(const db of [-48,-36,-24,-12,0,12,24]){const y=H-(db+60)/96*H;g.beginPath();g.moveTo(24,y);g.lineTo(W,y);g.stroke();g.fillText(db,2,y+3);}
    for(const f of [50,100,200,500,1000,2000,5000,10000]){const x=24+Math.log(f/20)/Math.log(1000)*(W-24);g.beginPath();g.moveTo(x,0);g.lineTo(x,H-10);g.stroke();g.fillText(fmtHz(f),x-8,H-1);}
    const r1=filterResponse(S.p['f1.type'],S.p['f1.cut'],S.p['f1.res'],S.p['f1.sh'],W-24),r2=filterResponse(S.p['f2.type'],S.p['f2.cut'],S.p['f2.res'],S.p['f2.sh'],W-24),ser=S.p.frt===0;g.beginPath();
    for(let i=0;i<W-24;i++){const a=Math.pow(10,r1[i]/20),b=Math.pow(10,r2[i]/20);const m=S.p['f1.type']===0&&S.p['f2.type']===0?1:ser?a*b:(S.p['f2.type']===0?a:S.p['f1.type']===0?b:(a+b)*.5);const y=clamp(H-(20*Math.log10(m+1e-6)+60)/96*H,0,H);i?g.lineTo(24+i,y):g.moveTo(24,y);}g.strokeStyle=cssv('--acc4');g.lineWidth=2;g.stroke();g.fillStyle=cssv('--acc4');g.fillText('Combined, '+(ser?'serial':'parallel'),30,11);};
  animators.push({draw:()=>{if(S.page==='filter')comb.draw();}});
  const mid=panel('ROUTING',[seg('frt'),comb,h('span',{class:'cap',style:'white-space:normal;text-transform:none',text:'Serial runs filter 1 into filter 2. Parallel runs both and blends them. Each oscillator picks which filter it goes through in the Sound page (To).'}),
...filterXY(),h('span',{class:'cap',style:'white-space:normal;text-transform:none;margin-top:6px',text:'Each filter has its own Envelope menu: None, or Env 1 to 8. The Env knob sets how far it opens the cutoff. The same envelope can also drive anything else.'}),h('span',{class:'cap',style:'white-space:normal;text-transform:none',text:'47 filter types: clean, analog, comb, voice, phase and creative. Try Disperser, Dual Peak, Harmonic Bank, Rate Crush and Fold LP.'})],'flex:1');
  pg.append(filterPanel(1),mid,filterPanel(2));
  animators.push({draw:()=>{if(S.page!=='filter')return;$$('canvas[data-f]',pg).forEach(c=>drawFilter(c,+c.dataset.f));}});return pg;}
/* ---------- mod page ---------- */
function envBody(i,bank){const pre='e'+i+'.',c=cv(274,bank?46:48);let draw=true;const CH=bank?44:48;
  const dcv=draw?envEditor(i-1,274,bank?46:80,false):cv(274,46);dcv.style.display='none';if(!dcv.draw)dcv.draw=()=>{};
  const getMode=()=>draw?S.p[pre+'mode']:0;
  const row1=h('div',{class:'row envk',style:'gap:0'},[pre+'a',pre+'h',pre+'d',pre+'s',pre+'r',pre+'ca',pre+'c'].map((k,j)=>knob(k,{sm:true,label:['Att','Hold','Dec','Sus','Rel','A.crv','Curve'][j]}))),row2=draw?h('div',{class:'row envk',style:'align-items:center;gap:0'},[knob(pre+'len',{sm:true,label:'Length'}),knob(pre+'r',{sm:true,label:'Release'}),knob(pre+'slew',{sm:true,label:'Smooth'}),h('div',{class:'col',style:'gap:3px;margin-left:2px'},[(()=>{const e=sel(pre+'sync');e.style.width='62px';return e;})(),(()=>{const e=sel(pre+'loop');e.style.width='62px';return e;})()]),h('div',{class:'col',style:'gap:3px;margin-left:3px'},[h('button',{class:'btn sm',text:'Shapes','data-tip':'Open the shape browser: previews by category, plus your own saved shapes.',onclick:()=>shapeBrowser('e'+(i-1))}),h('button',{class:'btn sm',text:'Edit','data-tip':'Open the large editor with grid, loop markers and all tools.',onclick:()=>envBigDialog(i-1)})])]):h('div');
  const lc=cv(274,bank?46:48);lc.dataset.tip='Preview of the LFO or random shape over two cycles. Each note restarts it.';
  const ss=(key,w)=>{const e=sel(key);e.style.width=(w||66)+'px';return e;};
  const row3=h('div',{class:'row envk',style:'align-items:center;gap:0'},[knob(pre+'lr',{sm:true,label:'Rate'}),knob(pre+'lph',{sm:true,label:'Phase'}),knob(pre+'lsm',{sm:true,label:'Smooth'}),knob(pre+'lfd',{sm:true,label:'Fade in'}),h('div',{class:'col',style:'gap:3px;margin-left:4px'},[ss(pre+'lsh',84),ss(pre+'lsy',84)])]);
  const row4=h('div',{class:'row envk',style:'align-items:center;gap:0'},[knob(pre+'lr',{sm:true,label:'Rate'}),knob(pre+'lsm',{sm:true,label:'Smooth'}),knob(pre+'lfd',{sm:true,label:'Fade in'}),h('div',{class:'col',style:'gap:3px;margin-left:4px'},[ss(pre+'rsh',84),ss(pre+'lsy',84)])]);
  lc.draw=()=>{const g=lc.g,W=lc.W,H=lc.H,md=S.p[pre+'mode'];g.clearRect(0,0,W,H);g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);g.strokeStyle=cssv('--grid');g.beginPath();g.moveTo(0,H/2);g.lineTo(W,H/2);g.stroke();g.beginPath();
    if(md===2){for(let x=0;x<W;x++){const ph=(x/W*2+S.p[pre+'lph'])%1;const v=D.lfoShape(S.p[pre+'lsh'],ph,S.custom[3+i]||[0]);const y=H/2-v*(H/2-5);x?g.lineTo(x,y):g.moveTo(x,y);}}
    else{let sd=7+(S.p[pre+'rsh']|0)*13;const rn=()=>{sd=(sd*16807)%2147483647;return sd/2147483647*2-1;};let a=rn(),b=rn();const n=12,sm=S.p[pre+'rsh']!==0&&S.p[pre+'rsh']!==2&&S.p[pre+'rsh']!==3&&S.p[pre+'rsh']!==7;
      for(let x=0;x<W;x++){const q=x/W*n,f=q-Math.floor(q);if(x&&Math.floor(q)!==Math.floor((x-1)/W*n)){a=b;b=rn();}const v=sm?a+(b-a)*(f*f*(3-2*f)):(S.p[pre+'rsh']===7?(a>0?.9:-.9):a);const y=H/2-v*(H/2-5);x?g.lineTo(x,y):g.moveTo(x,y);}}
    g.strokeStyle=srcColor('e'+i);g.lineWidth=2;g.stroke();};
  const CI=3+i,led=envEditor(CI,274,bank?46:48,false,'l');led.style.display='none';const ltools=h('div',{class:'row ltl',style:'gap:3px;align-items:center;display:none'},envTools(CI,false,'l'+CI).filter((x,j)=>j===1).concat([h('button',{class:'btn sm',text:'Big',onclick:()=>lfoBigDialog(CI)})]));const lw=h('div',{class:'ledwrap'},[led,ltools]);animators.push({draw:()=>{if(led.offsetParent)led.draw();}});
  const upd=()=>{if(!alive(row1))return false;const md=draw?(S.p[pre+'mode']|0):0,m=md===1;c.style.display=md===0?'':'none';dcv.style.display=m?'':'none';const cu=md===2&&(S.p[pre+'lsh']|0)===7;lc.style.display=(md>=2&&!cu)?'':'none';led.style.display=cu?'':'none';ltools.style.display=cu?'flex':'none';lw.style.display=cu?'block':'none';row1.style.display=md===0?'':'none';row2.style.display=m?'':'none';row3.style.display=md===2?'':'none';row4.style.display=md===3?'':'none';if(md>=2)lc.draw();};
  ['lsh','lph','rsh'].forEach(x=>bind(pre+x,()=>{if(!alive(lc))return false;if(lc.style.display!=='none')lc.draw();upd();}));
  if(draw)bind(pre+'mode',upd);
  const ROLE=i===1?'Main amp envelope, shapes the volume of every source by default (ADSR or Draw)':i===2?'Filter envelope, raise Env on a filter to use it':'Free modulator: ADSR, drawn shape, LFO or random';
  const modeSeg=draw?seg(pre+'mode',{short:['ADSR','Draw']}):null;if(modeSeg)modeSeg.classList.add('tight');
  const header=bank?null:h('div',{class:'row',style:'align-items:center'},[src('e'+i),h('span',{class:'sp'}),draw?seg(pre+'mode',{short:['ADSR','Draw']}):null]);
  c.draw=()=>{const live=S.V&&S.V.env?S.V.env[i-1]:undefined;drawEnv(c,envOf(pre),live);};
  animators.push({draw:()=>{if(S.page!==(bank?'sound':'mod')||!c.offsetParent&&!dcv.offsetParent)return;c.draw();dcv.draw();}});upd();
  const out=[header,c,dcv,lc,lw,row1,row2,row3,row4].filter(Boolean);out.modeSeg=modeSeg;out.role=ROLE;return out;}
function envPanel(i){return panel('ENVELOPE '+i,envBody(i),'width:292px');}
const MODTYPE=['ADSR','Draw','LFO','LFO'];
function envBank(){let cur=1;const N=16;const parts=[];for(let i=1;i<=N;i++)parts.push(envBody(i,true));const bodies=parts.map((p,i)=>h('div',{class:'col',style:'gap:2px;display:'+(i===0?'':'none')},p));
  const names=['AMP','FLT'];for(let i=3;i<=N;i++)names.push(String(i));
  const tabs=h('div',{class:'seg tight mtabs'},names.map((n,j)=>h('b',{text:n,'data-tip':'Modulator '+(j+1)+': '+parts[j].role,onclick:()=>{cur=j+1;upd();}})));
  const asel=h('select',{class:'sel',style:'width:104px','data-tip':'Assign this modulator to any parameter. It is added to the modulation matrix, where you can set the amount.'});
  asel.appendChild(h('option',{value:'',text:'Assign to...'}));for(const [g,list] of destOptions()){const og=h('optgroup',{label:g});list.forEach(([k,l])=>og.appendChild(h('option',{value:k,text:l.replace(/ \(.*\)$/,'')})));asel.appendChild(og);}
  asel.onchange=()=>{if(asel.value){addSlot('e'+cur,asel.value);asel.value='';upd();}};
  const tbtn=h('button',{class:'btn sm on mtype','data-tip':'Type of this slot. Click to cycle: ADSR, Draw (your own shape), LFO. An LFO slot has every wave and random shape in its Shape menu. Slot 1 (amp) can be ADSR or Draw.',onclick:()=>{const k='e'+cur+'.mode',n=cur===1?2:3;setV(k,((S.p[k]|0)+1)%n);upd();}});
  const holder=h('span',{});
  const upd=()=>{$$('b',tabs).forEach((b,j)=>{b.classList.toggle('on',j+1===cur);b.classList.toggle('lfo',(S.p['e'+(j+1)+'.mode']|0)>=2);});bodies.forEach((b,j)=>b.style.display=j+1===cur?'':'none');holder.innerHTML='';holder.appendChild(src('e'+cur,(cur===1?'AMP':cur===2?'FILT':'ENV '+cur)));tbtn.textContent=MODTYPE[S.p['e'+cur+'.mode']|0];updHandles();};
  for(let i=1;i<=N;i++)bind('e'+i+'.mode',()=>{if(!alive(tbtn))return false;upd();});
  upd();bank_upd=upd;bank_set=n=>{cur=n;upd();};
  const pn=panel('MODULATORS',[tabs,...bodies,h('div',{class:'row',style:'align-items:center;gap:4px'},[holder,h('span',{class:'sp'}),asel,tbtn])],'width:296px;position:relative');return pn;}
let bank_upd=null,bank_set=null;
function lfoPanel(i){const k='l'+i+'.',c=cv(274,48);c.classList.add('lfoprev');
  c.draw=()=>{const g=c.g,W=c.W,H=c.H;g.clearRect(0,0,W,H);g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);g.strokeStyle=cssv('--grid');g.beginPath();g.moveTo(0,H/2);g.lineTo(W,H/2);g.stroke();
    g.beginPath();for(let x=0;x<W;x++){const p=(x/W*2+S.p[k+'ph'])%1;const v=D.lfoShape(S.p[k+'shape'],p,S.custom[i-1]);const y=H/2-v*(H/2-5);x?g.lineTo(x,y):g.moveTo(x,y);}g.strokeStyle=cssv('--m1');g.lineWidth=2;g.stroke();
    const lv=S.V&&S.V.lfo?S.V.lfo[i-1]:0;g.fillStyle=cssv('--acc2');g.beginPath();g.arc(W-8,H/2-lv*(H/2-5),4,0,7);g.fill();};
  let dr=false;const edit=e=>{if(S.p[k+'shape']!==7)return;const r=c.getBoundingClientRect(),x=((e.clientX-r.left)/r.width*2)%1,y=clamp(1-(e.clientY-r.top)/r.height,0,1)*2-1;S.custom[i-1][Math.round(clamp(x,0,.999)*32)%32]=y;send({t:'custom',i:i-1,pts:S.custom[i-1]});};
  c.addEventListener('pointerdown',e=>{dr=true;c.setPointerCapture(e.pointerId);edit(e);});c.addEventListener('pointermove',e=>{if(dr)edit(e);});c.addEventListener('pointerup',()=>dr=false);
  c.dataset.tip='Shows two cycles of the LFO shape.';animators.push({draw:()=>{if(S.page==='mod')c.draw();}});
  const led=envEditor(i-1,274,72,false,'l');led.style.display='none';const ltools=h('div',{class:'row',style:'gap:4px;align-items:center;display:none'},envTools(i-1,false,'l'+(i-1)).filter((x,j)=>j<2).concat([h('button',{class:'btn sm',text:'Big',onclick:()=>lfoBigDialog(i-1)})]));
  const lupd=()=>{if(!alive(c))return false;const cu=S.p[k+'shape']===7;c.style.display=cu?'none':'';led.style.display=cu?'':'none';ltools.style.display=cu?'flex':'none';};bind(k+'shape',lupd);setTimeout(lupd,0);animators.push({draw:()=>{if(S.page==='mod'&&led.offsetParent)led.draw();}});
  return panel('LFO '+i,[h('div',{class:'row',style:'align-items:center'},[src('l'+i),sel(k+'shape'),seg(k+'mode',{short:['Retrig','Free']})]),c,led,ltools,h('div',{class:'row',style:'align-items:center'},[sel(k+'sync')]),knobs([[k+'rate','Rate'],[k+'ph','Phase'],[k+'fade','Fade in'],[k+'sm','Smooth']],{sm:true})],'width:292px');}
function destOptions(sel0){const opts=[];const add=(grp,list)=>{if(list.length)opts.push([grp,list]);};
  const pk=Object.keys(PR).filter(k=>modulatable(k));const gr=(re)=>pk.filter(k=>re.test(k)).map(k=>[k,PR[k].l+' ('+k+')']);
  add('OSC A',gr(/^a\./).filter(x=>!/^a\.(ea|ed|es|er)$/.test(x[0])));add('OSC B',gr(/^b\./).filter(x=>!/^b\.(ea|ed|es|er)$/.test(x[0])));add('OSC C',gr(/^c\./).filter(x=>!/^c\.(ea|ed|es|er)$/.test(x[0])));for(const q of 'def')add('OSC '+q.toUpperCase(),gr(new RegExp('^'+q+'\\.')).filter(x=>!/\.(ea|ed|es|er)$/.test(x[0])));
  add('Sub and Noise',gr(/^(s|sub|nz)\./).filter(x=>!/^(sub|nz)\.(ea|ed|es|er)$/.test(x[0])));add('Source envelopes',gr(/^(a|b|c|d|e|f|sub|nz)\.(ea|ed|es|er)$/));
  add('Filter 1',gr(/^f1\./));add('Filter 2',gr(/^f2\./));for(let i=1;i<=16;i++)add('Envelope '+i,gr(new RegExp('^e'+i+'\\.')));for(let i=1;i<=4;i++)add('LFO '+i,gr(new RegExp('^l'+i+'\\.')));add('Macros',gr(/^m[1-4]$/));add('Voice, Arp, Master',gr(/^(glide|vel|master|ceil|arp\.(gate|swing|rate))$/));add('Mixer',gr(/^bus\./));
  const fxo=[];const walk=(l,pfx)=>{for(const n of l){const d=FXDEF[n.type];for(const s of d.order)if(s.k!=='list')fxo.push(['fx:'+n.id+':'+s.key,pfx+d.name+': '+s.l]);if(n.bands)n.bands.forEach((b,j)=>walk(b,pfx+d.name+' band '+(j+1)+' > '));}};
  const BN={t0:'OSC A',t1:'OSC B',t2:'OSC C',t3:'Sub/Noise',x1:'FX 1',x2:'FX 2',mst:'Master'};for(const b in BN)walk(S.chains[b],BN[b]+' > ');add('Effects',fxo);return opts;}
function matrixRow(s){const row=h('div',{class:'row',style:'align-items:center;gap:4px;width:100%'});
  const ss=h('select',{class:'sel',style:'width:84px'});for(const id of D.SRCS)ss.appendChild(h('option',{value:id,text:SRCNAME[id]}));ss.value=s.s;ss.onchange=()=>{s.s=ss.value;sendSlots();refreshAll();};
  const ds=h('select',{class:'sel',style:'width:190px'});for(const g of destOptions()){const og=h('optgroup',{label:g[0]});for(const o of g[1])og.appendChild(h('option',{value:o[0],text:o[1]}));ds.appendChild(og);}
  if(!ds.querySelector('option[value="'+s.d+'"]'))ds.appendChild(h('option',{value:s.d,text:s.d}));ds.value=s.d;ds.onchange=()=>{s.d=ds.value;sendSlots();refreshAll();};
  const val=h('span',{class:'mono',style:'width:36px;text-align:right',text:Math.round(s.a*100)+'%'});const rg=h('input',{type:'range',class:'rg',min:-100,max:100,value:Math.round(s.a*100),style:'flex:1;min-width:50px'});
  rg.oninput=()=>{s.a=rg.value/100;val.textContent=rg.value+'%';sendSlots();refreshAll();};
  row.append(ss,h('span',{class:'cap',text:'>'}),ds,rg,val,h('button',{class:'btn sm','data-tip':'Remove this route.',text:'x',onclick:()=>{S.slots.splice(S.slots.indexOf(s),1);sendSlots();refreshAll();buildMatrix();}}));return row;}
let matrixEl=null;
function buildMatrix(){if(!matrixEl)return;matrixEl.innerHTML='';const a=h('div',{class:'col',style:'flex:1;gap:3px'}),b=h('div',{class:'col',style:'flex:1;gap:3px'});
  S.slots.forEach((s,i)=>(i<16?a:b).appendChild(matrixRow(s)));if(!S.slots.length)a.appendChild(h('span',{class:'cap',style:'text-transform:none',text:'Empty. Drag any modulator above onto any knob, or press Add.'}));
  matrixEl.append(a,b);const cnt=$('#slotcount');if(cnt)cnt.textContent=S.slots.length+' / 64';buildGrid();}
setRebuildMatrix(buildMatrix);
function modPage(){const pg=h('div',{class:'page','data-page':'mod',style:'flex-direction:column'});
  const lfos=h('div',{class:'row lfostrip',style:'gap:8px'},[lfoPanel(1),lfoPanel(2),lfoPanel(3),lfoPanel(4)]);
  const grp=(t,ids)=>h('div',{class:'col',style:'gap:3px'},[h('span',{class:'cap gc',text:t}),h('div',{class:'row w',style:'gap:4px'},ids.map(id=>src(id)))]);
  const envs=[];for(let i=1;i<=16;i++)envs.push('e'+i);
  const srcs=panel('SOURCES',[grp('Modulators (Sound page)',envs),grp('Global LFOs',['l1','l2','l3','l4']),grp('Fast controls',['m1','m2','m3','m4','m5','m6','m7','m8']),grp('Playing',['vel','key','wheel','bend','at','rnd']),
    h('span',{class:'cap',style:'text-transform:none;white-space:normal',text:'Drag any circle onto any knob. Right click a knob to bypass, remove or route modulation. In the grid, scroll a cell to change the amount.'})],'width:296px');
  const left=h('div',{class:'col',style:'gap:8px'},[srcs]);
  const mat=matrixPanel();mat.style.flex='1';
  pg.append(lfos,h('div',{class:'row',style:'gap:8px;align-items:stretch;flex:1;min-height:0'},[left,mat]));return pg;}
const MGROUPS=['OSC A','OSC B','OSC C','OSC D','OSC E','OSC F','Sub + Noise','Filter 1','Filter 2','Envelopes','LFOs','Macros','Effects','Mixer','Voice + Arp'];
function groupOf(k){if(k.startsWith('fx:'))return 'Effects';let m;if((m=/^([a-f])\./.exec(k)))return 'OSC '+m[1].toUpperCase();if(/^(s|sub|nz)\./.test(k))return 'Sub + Noise';if(/^f1\./.test(k))return 'Filter 1';if(/^f2\./.test(k))return 'Filter 2';if(/^e\d\./.test(k))return 'Envelopes';if(/^l\d\./.test(k))return 'LFOs';if(/^m\d$/.test(k))return 'Macros';if(/^bus\./.test(k))return 'Mixer';return 'Voice + Arp';}
function srcShort(id){return /^[elm]\d$/.test(id)?id.toUpperCase():({vel:'VEL',key:'KEY',wheel:'WHL',bend:'BND',at:'AT',rnd:'RND'}[id]||id.toUpperCase().slice(0,4));}
let matrixMode='grid',gridEl=null;
function cellDialog(src,grp){const body=h('div',{class:'col',style:'min-width:520px;gap:5px'});
  const opts=[];for(const g of destOptions())for(const o of g[1])if(groupOf(o[0])===grp)opts.push(o);
  const draw=()=>{body.innerHTML='';const mine=S.slots.filter(x=>x.s===src&&groupOf(x.d)===grp);
    if(!mine.length)body.appendChild(h('span',{class:'cap',style:'text-transform:none',text:'No routes yet. Press Add route.'}));
    for(const sl of mine){const row=h('div',{class:'row',style:'align-items:center;gap:6px'});
      const ds=h('select',{class:'sel',style:'width:230px'});for(const o of opts)ds.appendChild(h('option',{value:o[0],text:o[1]}));if(!opts.some(o=>o[0]===sl.d))ds.appendChild(h('option',{value:sl.d,text:nameOf(sl.d)}));ds.value=sl.d;ds.onchange=()=>{sl.d=ds.value;sendSlots();refreshAll();buildMatrix();};
      const val=h('span',{class:'mono',style:'width:40px;text-align:right',text:Math.round(sl.a*100)+'%'});const rg=h('input',{type:'range',class:'rg',min:-100,max:100,value:Math.round(sl.a*100),style:'flex:1'});rg.oninput=()=>{sl.a=rg.value/100;val.textContent=rg.value+'%';sendSlots();refreshAll();buildMatrix();};
      row.append(ds,rg,val,h('button',{class:'btn sm',text:'x','data-tip':'Remove this route.',onclick:()=>{S.slots.splice(S.slots.indexOf(sl),1);sendSlots();refreshAll();buildMatrix();draw();}}));body.appendChild(row);}
    body.appendChild(h('button',{class:'btn sm on',text:'+ Add route',onclick:()=>{if(S.slots.length>=64){toast('Matrix is full');return;}const used=new Set(mine.map(x=>x.d)),d=(opts.find(o=>!used.has(o[0]))||opts[0]);if(!d)return;S.slots.push({s:src,d:d[0],a:.5,u:0});sendSlots();refreshAll();buildMatrix();draw();}}));};
  draw();dialog(SRCNAME[src]+' to '+grp,body,[['Done',null,true]]);}
function buildGrid(){if(!gridEl)return;gridEl.innerHTML='';const srcs=D.SRCS,n=srcs.length;
  gridEl.style.gridTemplateColumns='104px repeat('+n+',minmax(0,1fr))';
  gridEl.appendChild(h('div',{}));for(const id of srcs){const hd=h('div',{class:'mgh','data-tip':SRCNAME[id]+': click a cell below to route it.',text:srcShort(id)});hd.style.color=srcColor(id);gridEl.appendChild(hd);}
  for(const grp of MGROUPS){gridEl.appendChild(h('div',{class:'mgl',text:grp}));
    for(const id of srcs){const mine=S.slots.filter(x=>x.s===id&&groupOf(x.d)===grp);const cell=h('div',{class:'mgc'+(mine.length?' on':'')});
      const paint=()=>{if(mine.length){const mx=Math.max(...mine.map(x=>Math.abs(x.a)));cell.style.background=srcColor(id);cell.style.opacity=mine.every(x=>x.b)?.15:.35+.65*mx;cell.textContent=mine.length>1?mine.length+'x':(mine[0].a>0?'+':'')+Math.round(mine[0].a*100);cell.dataset.tip=mine.map(x=>SRCNAME[id]+' > '+nameOf(x.d)+' '+Math.round(x.a*100)+'%').join('\n')+'\nScroll to change the amount (Shift = fine). Right click or click to edit.';}
        else{cell.dataset.tip=SRCNAME[id]+' to '+grp+': click to add a route.';}};paint();
      cell.addEventListener('wheel',e=>{if(!mine.length)return;e.preventDefault();const st=(e.shiftKey?.01:.05)*-Math.sign(e.deltaY);for(const x of mine)x.a=Math.round(clamp(x.a+st,-1,1)*100)/100;sendSlots();refreshAll();paint();},{passive:false});
      cell.addEventListener('contextmenu',e=>{e.preventDefault();cellDialog(id,grp);});
      cell.onclick=()=>cellDialog(id,grp);gridEl.appendChild(cell);}}}
function matrixPanel(){matrixEl=h('div',{class:'row',style:'gap:10px;align-items:flex-start'});gridEl=h('div',{class:'mgrid'});
  const body=h('div',{class:'col',style:'gap:6px;width:100%'},[gridEl,matrixEl]);const mat=panel('MODULATION MATRIX',[body],'flex:1');
  const setMode=m=>{matrixMode=m;gridEl.style.display=m==='grid'?'':'none';matrixEl.style.display=m==='list'?'':'none';$$('b',seg0).forEach((b,i)=>b.classList.toggle('on',['grid','list'][i]===m));};
  const seg0=h('div',{class:'seg','data-tip':'Grid shows every possible route: a source on top, a target group on the left. Colored cells are in use. List shows every route as a row.'},[h('b',{text:'Grid',onclick:()=>setMode('grid')}),h('b',{text:'List',onclick:()=>setMode('list')})]);
  mat.firstChild.append(h('span',{class:'sp'}),seg0,h('span',{id:'slotcount',class:'mono cap',text:'0 / 32'}),h('button',{class:'btn sm',text:'Add','data-tip':'Add a route in the list view.',onclick:()=>{if(S.slots.length>=64){toast('Matrix is full');return;}S.slots.push({s:'l1',d:'f1.cut',a:.5,u:0});sendSlots();refreshAll();buildMatrix();setMode('list');}}),h('button',{class:'btn sm',text:'Clear all','data-tip':'Remove every modulation route.',onclick:()=>{S.slots=[];sendSlots();refreshAll();buildMatrix();}}));
  buildMatrix();setMode(matrixMode);return mat;}
function matrixPage(){const pg=h('div',{class:'page','data-page':'matrix'});pg.append(matrixPanel());return pg;}
PAGES.sound=soundPage;PAGES.matrix=matrixPage;PAGES.filter=filterPage;PAGES.mod=modPage;PAGES._modExtras={srcs:()=>0};

function supersawAll(){let n=0;for(const k of 'abcdef'){if(!S.p[k+'.on'])continue;S.p[k+'.us']=1;S.p[k+'.uv']=Math.max(S.p[k+'.uv'],7);if(S.p[k+'.ud']<.3)S.p[k+'.ud']=.38;S.p[k+'.ub']=.55;S.p[k+'.usp']=.85;S.p[k+'.rnd']=1;n++;}
  syncAll();refreshAll();toast(n?'Supersaw on '+n+' oscillator'+(n>1?'s':'')+'. Shape it with Detune, Blend and Spread':'Turn an oscillator on first');}
