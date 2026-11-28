/* ===== pages 2: FX, Mixer, Arp ===== */
const BUSES=[['t0','OSC A + D'],['t1','OSC B + E'],['t2','OSC C + F'],['t3','Sub + Noise'],['x1','FX 1'],['x2','FX 2'],['mst','Master']];
const nodeEls={};
function findList(id,list){list=list||null;const lists=list?[list]:Object.values(S.chains);
  const walk=l=>{if(l.some(n=>n.id===id))return l;for(const n of l)if(n.bands)for(const b of n.bands){const r=walk(b);if(r)return r;}return null;};
  for(const l of lists){const r=walk(l);if(r)return r;}return null;}
function chainChanged(){reindex();sendChains();renderFx();}
function addFx(list,type){const n=D.newNode(type);list.push(n);S.sel.node=n.id;chainChanged();}
function removeFx(id){const l=findList(id);if(!l)return;l.splice(l.findIndex(n=>n.id===id),1);S.slots=S.slots.filter(s=>!s.d.startsWith('fx:'+id+':'));sendSlots();if(S.sel.node===id)S.sel.node=null;chainChanged();rebuildMatrix&&rebuildMatrix();}
function moveFx(id,d){const l=findList(id);if(!l)return;const i=l.findIndex(n=>n.id===id),j=i+d;if(j<0||j>=l.length)return;[l[i],l[j]]=[l[j],l[i]];chainChanged();}
function pickFx(list){const body=h('div',{class:'col',style:'width:640px;gap:8px'});
  for(const cat of D.FXCATS){const types=Object.keys(FXDEF).filter(t=>FXDEF[t].cat===cat);if(!types.length)continue;
    body.appendChild(h('div',{class:'row',style:'align-items:flex-start;gap:6px'},[h('span',{class:'cap',style:'width:80px;padding-top:6px',text:cat}),h('div',{class:'row w',style:'flex:1'},types.map(t=>h('button',{class:'btn','data-tip':FXDEF[t].tip,text:FXDEF[t].name,onclick:()=>{closeDlg();addFx(list,t);}})))]));}
  dialog('Add an effect',body,[['Cancel']]);}
function nodeCard(n,list,i){const d=FXDEF[n.type];const el=h('div',{class:'node'+(S.sel.node===n.id?' sel':'')+(n.on?'':' off'),'data-tip':d.tip,onclick:e=>{if(e.target.closest('button'))return;S.sel.node=n.id;renderFx();}});
  const led=h('i',{class:'led'+(n.on?' on':''),onclick:e=>{e.stopPropagation();n.on=n.on?0:1;chainChanged();}});
  const gr=h('div',{class:'grbar'});nodeEls[n.id]=gr;
  el.append(led,h('b',{text:d.name}),h('button',{class:'mini',text:'<','data-tip':'Move earlier in the chain.',onclick:()=>moveFx(n.id,-1)}),h('button',{class:'mini',text:'>','data-tip':'Move later in the chain.',onclick:()=>moveFx(n.id,1)}),h('button',{class:'mini',text:'x','data-tip':'Remove this effect.',onclick:()=>removeFx(n.id)}),gr);return el;}
function laneBlock(n){const d=FXDEF.split;const blk=h('div',{class:'node split'+(S.sel.node===n.id?' sel':'')+(n.on?'':' off'),onclick:e=>{if(e.target.closest('button,.lane'))return;S.sel.node=n.id;renderFx();}});
  const list=findList(n.id);
  const head=h('div',{class:'row',style:'align-items:center;gap:6px'},[h('i',{class:'led'+(n.on?' on':''),onclick:e=>{e.stopPropagation();n.on=n.on?0:1;chainChanged();}}),h('b',{text:'Band Split'}),h('span',{class:'cap',text:n.n+' bands'}),
    h('div',{class:'seg','data-tip':'Number of bands. Each band has its own effect chain, and bands can contain more splitters.'},[2,3,4].map(k=>h('b',{class:n.n===k?'on':'',text:k,onclick:()=>{n.n=k;chainChanged();}}))),h('span',{class:'sp'}),
    h('button',{class:'mini',text:'<',onclick:()=>moveFx(n.id,-1)}),h('button',{class:'mini',text:'>',onclick:()=>moveFx(n.id,1)}),h('button',{class:'mini',text:'x','data-tip':'Remove the split and everything inside it.',onclick:()=>removeFx(n.id)})]);
  blk.appendChild(head);
  const edges=[20,n.p.x1,n.p.x2,n.p.x3,20000];
  for(let j=0;j<n.n;j++){const lo=j===0?20:n.p['x'+j],hi=j===n.n-1?20000:n.p['x'+(j+1)];
    const lane=h('div',{class:'lane'},[h('div',{class:'lh'},[h('b',{text:'Band '+(j+1)}),h('span',{class:'cap',text:fmtHz(lo)+' to '+fmtHz(hi)+' Hz'}),h('div',{class:'bm'},[h('div',{id:'bm_'+n.id+'_'+j})]),
        h('button',{class:'mini'+(n.so[j]?' on':''),text:'S','data-tip':'Solo this band.',onclick:()=>{n.so[j]=n.so[j]?0:1;chainChanged();}}),h('button',{class:'mini'+(n.ms[j]?' on':''),text:'M','data-tip':'Mute this band.',onclick:()=>{n.ms[j]=n.ms[j]?0:1;chainChanged();}})]),renderChain(n.bands[j],true)]);
    blk.appendChild(lane);}
  return blk;}
function renderChain(list,inner){const wrap=h('div',{class:'chain'+(inner?' inner':'')});
  list.forEach((n,i)=>{wrap.appendChild(n.type==='split'?laneBlock(n):nodeCard(n,list,i));});
  wrap.appendChild(h('button',{class:'btn sm add','data-tip':'Add an effect here.',text:'+ Add',onclick:()=>pickFx(list)}));return wrap;}
/* ---- live displays for selected node ---- */
function fxDisplay(n){const t=n.type,c=cv(400,150);c.dataset.fx=n.id;c.dataset.tip='Live display of this effect.';
  const g=c.g,W=c.W,H=c.H,P=k=>n.p[k]===undefined?FXDEF[t].ps[k].d:n.p[k];
  const grid=()=>{g.clearRect(0,0,W,H);g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);g.strokeStyle=cssv('--grid');g.lineWidth=1;g.fillStyle=cssv('--dim');g.font='9px JetBrains Mono,monospace';};
  const fx=f=>30+Math.log(f/20)/Math.log(1000)*(W-36);
  const logGrid=(dbs,toY)=>{for(const f of [50,100,200,500,1000,2000,5000,10000]){const x=fx(f);g.beginPath();g.moveTo(x,0);g.lineTo(x,H-10);g.stroke();g.fillText(fmtHz(f),x-8,H-1);}for(const db of dbs){const y=toY(db);g.beginPath();g.moveTo(30,y);g.lineTo(W,y);g.stroke();g.fillText(db,2,y+3);}};
  if(t==='eq'||t==='filt'||t==='disp'||t==='vowel'){
    c.draw=()=>{grid();
      if(t==='eq'){const sr=44100,N=2048;const bq=new D.BiS(),res=[];const bands=[['hs',P('hf'),P('hg'),.7],['peak',P('m2f'),P('m2g'),P('m2q')],['peak',P('m1f'),P('m1g'),P('m1q')],['ls',P('lf'),P('lg'),.7]];
        const mag=(type,fc,gdb,q,f)=>{const A=Math.pow(10,gdb/40),w0=2*Math.PI*fc/sr,cs=Math.cos(w0),sn=Math.sin(w0),al=sn/(2*q);let b0,b1,b2,a0,a1,a2;
          if(type==='peak'){b0=1+al*A;b1=-2*cs;b2=1-al*A;a0=1+al/A;a1=-2*cs;a2=1-al/A;}
          else{const sa=2*Math.sqrt(A)*al;if(type==='ls'){b0=A*((A+1)-(A-1)*cs+sa);b1=2*A*((A-1)-(A+1)*cs);b2=A*((A+1)-(A-1)*cs-sa);a0=(A+1)+(A-1)*cs+sa;a1=-2*((A-1)+(A+1)*cs);a2=(A+1)+(A-1)*cs-sa;}else{b0=A*((A+1)+(A-1)*cs+sa);b1=-2*A*((A-1)+(A+1)*cs);b2=A*((A+1)+(A-1)*cs-sa);a0=(A+1)-(A-1)*cs+sa;a1=2*((A-1)-(A+1)*cs);a2=(A+1)-(A-1)*cs-sa;}}
          const w=2*Math.PI*f/sr,c1=Math.cos(w),s1=Math.sin(w),c2=Math.cos(2*w),s2=Math.sin(2*w);const nr=b0+b1*c1+b2*c2,ni=-(b1*s1+b2*s2),dr=a0+a1*c1+a2*c2,di=-(a1*s1+a2*s2);return 10*Math.log10((nr*nr+ni*ni)/(dr*dr+di*di));};
        const hpw=(f)=>{const r=f/P('hp');return 10*Math.log10(Math.pow(r,4)/(1+Math.pow(r,4)));},lpw=f=>{const r=f/P('lp');return -10*Math.log10(1+Math.pow(r,4));};
        const toY=db=>H/2-db/18*(H/2-14);logGrid([-12,-6,0,6,12],toY);g.beginPath();for(let x=30;x<W;x++){const f=20*Math.pow(1000,(x-30)/(W-36));let db=0;for(const b of bands)db+=mag(b[0],b[1],b[2],b[3],f);db+=hpw(f)+lpw(f);const y=clamp(toY(db),2,H-12);x===30?g.moveTo(x,y):g.lineTo(x,y);}
        g.strokeStyle=cssv('--acc');g.lineWidth=2;g.stroke();
        for(const [k,gk] of [['lf','lg'],['m1f','m1g'],['m2f','m2g'],['hf','hg']]){g.fillStyle=cssv('--acc2');g.beginPath();g.arc(fx(P(k)),clamp(toY(P(gk)),4,H-14),5,0,7);g.fill();}}
      else if(t==='filt'){const r=filterResponse(P('type'),P('cut'),P('res'),P('shape'),W-36);const toY=db=>H-(db+60)/96*H;logGrid([-48,-24,0,12,24],toY);g.beginPath();r.forEach((v,i)=>{const y=clamp(toY(v),0,H);i?g.lineTo(30+i,y):g.moveTo(30,y);});g.strokeStyle=cssv('--acc');g.lineWidth=2;g.stroke();}
      else if(t==='disp'){logGrid([],()=>0);const A=P('amount'),f0=P('freq'),pinch=P('pinch'),range=P('range');g.beginPath();for(let x=30;x<W;x++){const f=20*Math.pow(1000,(x-30)/(W-36));const r=Math.log2(f/f0);const ph=A*(Math.atan(Math.pow(f/f0,1+pinch*.5)*range/3)/Math.PI);const y=H-12-clamp(ph/Math.max(A,1),0,1)*(H-24);x===30?g.moveTo(x,y):g.lineTo(x,y);}g.strokeStyle=cssv('--acc4');g.lineWidth=2;g.stroke();g.fillStyle=cssv('--dim');g.fillText('delay vs frequency, '+A+' stages',36,12);}
      else{logGrid([],()=>0);g.fillStyle=cssv('--dim');g.fillText('Formant filter: vowel '+P('vowel').toFixed(1),36,12);const v=P('vowel');g.beginPath();for(let x=30;x<W;x++){const f=20*Math.pow(1000,(x-30)/(W-36));const f1=300+v*120,f2=900+v*350;const y=H-14-(Math.exp(-Math.pow(Math.log(f/f1)/.28,2))*.8+Math.exp(-Math.pow(Math.log(f/f2)/.22,2))*.6)*(H-28);x===30?g.moveTo(x,y):g.lineTo(x,y);}g.strokeStyle=cssv('--acc');g.lineWidth=2;g.stroke();}};
  }else if(t==='comp'||t==='maxi'){
    c.draw=()=>{grid();const toX=db=>20+(db+60)/60*(W-30),toY=db=>H-12-(db+60)/60*(H-22);for(const db of [-48,-36,-24,-12,0]){g.beginPath();g.moveTo(toX(db),0);g.lineTo(toX(db),H-10);g.stroke();g.beginPath();g.moveTo(20,toY(db));g.lineTo(W,toY(db));g.stroke();g.fillText(db,toX(db)-6,H-1);}
      const thr=t==='comp'?P('thr'):-P('gain'),ratio=t==='comp'?P('ratio'):20,knee=t==='comp'?P('knee'):2,mk=t==='comp'?P('makeup'):P('gain'),ceil=t==='maxi'?P('ceil'):99;
      g.beginPath();for(let i=-60;i<=0;i+=.5){let o=i;const d=i-thr;if(2*d<-knee)o=i;else if(2*Math.abs(d)<=knee)o=i+(1/ratio-1)*Math.pow(d+knee/2,2)/(2*knee);else o=thr+d/ratio;o+=mk;if(t==='maxi')o=Math.min(i+mk,ceil);const x=toX(i),y=clamp(toY(Math.min(o,6)),0,H-10);i===-60?g.moveTo(x,y):g.lineTo(x,y);}
      g.strokeStyle=cssv('--acc');g.lineWidth=2;g.stroke();const gr=S.V&&S.V.nodes?S.V.nodes[n.id]:0;if(gr){g.fillStyle=cssv('--acc2');g.fillRect(W-12,0,6,Math.min(H,Math.abs(gr)/24*H));g.fillStyle=cssv('--dim');g.fillText('GR '+gr.toFixed(1),W-52,H-12);}};
  }else if(['dist','fat','folder','crush','exciter'].includes(t)){
    c.draw=()=>{grid();const cx=W/2,cy=H/2;g.beginPath();g.moveTo(cx,6);g.lineTo(cx,H-6);g.moveTo(8,cy);g.lineTo(W-8,cy);g.stroke();g.beginPath();
      const drv=t==='dist'?P('drive'):t==='fat'?P('drive'):t==='folder'?P('drive'):t==='exciter'?P('drive'):12,gain=Math.pow(10,drv/20);
      for(let i=0;i<=200;i++){const x=(i/100-1),a=x*gain;let y;
        if(t==='dist')y=D.shp(Math.round(P('type')),a+P('bias')*.3);else if(t==='fat')y=Math.tanh(a*(1+P('fat')))+P('bias')*.1;else if(t==='folder')y=Math.sin(a*1.57*P('stages'));else if(t==='crush'){const q=Math.pow(2,P('bits')-1);y=Math.round(x*q)/q;}else y=Math.tanh(a);
        const X=8+i/200*(W-16),Y=cy-clamp(y,-1.2,1.2)*(H/2-10);i?g.lineTo(X,Y):g.moveTo(X,Y);}g.strokeStyle=cssv('--acc');g.lineWidth=2;g.stroke();g.fillStyle=cssv('--dim');g.fillText('transfer curve, input to output',12,12);};
  }else if(t==='tgate'||t==='pump'){
    c.draw=()=>{grid();const steps=16,pat=n.pat||[];g.beginPath();
      if(t==='tgate'){const sw=W/steps;for(let i=0;i<steps;i++){const on=pat[i]?1:0;g.fillStyle=on?cssv('--acc'):cssv('--selbd');g.globalAlpha=on?1:.35;g.fillRect(i*sw+2,on?14:H-26,sw-4,on?H-30:12);}g.globalAlpha=1;const st=S.V?S.V.steps:0;if(st>=0){g.fillStyle=cssv('--acc2');g.fillRect((st%16)*sw+2,H-10,sw-4,4);}}
      else{for(let x=0;x<W;x++){const p=(x/W*2)%1,d=P('depth'),a=P('attack'),r=P('release');const v=p<a?1-d*(1-p/Math.max(a,1e-3)):1-d*Math.pow(Math.max(0,1-(p-a)/Math.max(r,.05)),2)*0+(-d)*Math.pow(1-Math.min(1,(p-a)/Math.max(r,.05)),1+P('curve')*1.5+1)*-1;
        const vv=clamp(1-d*Math.pow(clamp(1-p/Math.max(r,.05),0,1),1.5),0,1);const y=H-10-vv*(H-20);x?g.lineTo(x,y):g.moveTo(x,y);}g.strokeStyle=cssv('--acc4');g.lineWidth=2;g.stroke();g.fillStyle=cssv('--dim');g.fillText('gain over one beat, 2 beats shown',10,12);}};
    if(t==='tgate'){let dr=false,val=1;const ed=e=>{const r=c.getBoundingClientRect(),i=clamp(Math.floor((e.clientX-r.left)/r.width*16),0,15);if(e.type==='pointerdown')val=n.pat[i]?0:1;n.pat[i]=val;chainChangedLite();};
      c.addEventListener('pointerdown',e=>{dr=true;c.setPointerCapture(e.pointerId);ed(e);});c.addEventListener('pointermove',e=>{if(dr)ed(e);});c.addEventListener('pointerup',()=>dr=false);c.dataset.tip='Click or drag to draw the 16 step gate pattern.';}
  }else if(t==='split'){
    c.draw=()=>{grid();const edges=[20,n.p.x1,n.p.x2,n.p.x3,20000],nb=n.n;for(let j=0;j<nb;j++){const lo=j===0?20:n.p['x'+j],hi=j===nb-1?20000:n.p['x'+(j+1)],x0=fx(lo),x1=fx(hi);const lv=S.V&&S.V.bands&&S.V.bands[n.id]?S.V.bands[n.id][j]:0;const gdb=n.p['g'+(j+1)];
      g.fillStyle=cssv('--m'+(1+(j%3)));g.globalAlpha=.25;g.fillRect(x0,6,x1-x0,H-18);g.globalAlpha=1;const hgt=clamp((toDb(lv||0)+60)/60,0,1)*(H-24);g.fillStyle=cssv('--m'+(1+(j%3)));g.fillRect(x0+2,H-12-hgt,Math.max(1,x1-x0-4),hgt);g.fillStyle=cssv('--text');g.fillText('B'+(j+1)+' '+(gdb>-59?gdb.toFixed(0)+'dB':'off'),x0+4,16);}
      for(const f of [100,1000,10000]){g.fillStyle=cssv('--dim');g.fillText(fmtHz(f),fx(f)-8,H-1);}};
  }else{
    c.draw=()=>{grid();const sc=S.V&&S.V.scope;const gr=S.V&&S.V.nodes?S.V.nodes[n.id]:0;g.fillStyle=cssv('--dim');g.fillText(FXDEF[t].name+': play a note to see the signal after the master',10,12);
      if(sc){g.beginPath();for(let x=0;x<W;x++){const v=sc[Math.floor(x/W*1024)*2]||0;const y=H/2-v*(H/2-8);x?g.lineTo(x,y):g.moveTo(x,y);}g.strokeStyle=cssv('--m1');g.lineWidth=1.5;g.stroke();}};}
  return c;}
function chainChangedLite(){sendChains();}
let fxPanelEl=null,fxChainEl=null,fxTabsEl=null;
function paramPanel(){const n=S.idx[S.sel.node];const box=h('div',{class:'col',style:'gap:6px'});
  if(!n){box.append(h('span',{class:'cap',style:'text-transform:none;white-space:normal',text:'Click an effect in the chain to edit it. Every effect parameter can be modulated: drag any envelope, LFO or macro onto its knob.'}));return box;}
  const d=FXDEF[n.type];box.append(h('div',{class:'row',style:'align-items:center'},[h('h3',{text:d.name,style:'margin:0;font-size:14px'}),h('span',{class:'cap',text:d.cat}),h('span',{class:'sp'}),h('button',{class:'btn sm'+(n.on?' on':''),text:n.on?'On':'Bypassed',onclick:()=>{n.on=n.on?0:1;chainChanged();}})]),h('div',{class:'cap',style:'text-transform:none;white-space:normal;height:30px',text:d.tip}),fxDisplay(n));
  const rows=h('div',{class:'row w',style:'gap:6px 4px'});
  for(const s of d.order){const key='fx:'+n.id+':'+s.key;if(s.k==='list'){rows.appendChild(h('div',{class:'col',style:'gap:2px;width:92px'},[h('span',{class:'cap',text:s.l}),listSel(key)]));}else rows.appendChild(knob(key,{sm:true}));}
  box.append(rows);return box;}
function listSel(key){const sp=specOf(key),l=listOf(sp);const s=h('select',{class:'sel',style:'width:92px','data-tip':sp.tip});l.forEach((t,i)=>s.appendChild(h('option',{value:i,text:t})));s.value=getV(key);s.onchange=()=>{setV(key,+s.value);if(parseKey(key)&&S.idx[parseKey(key).id].type==='tgate')renderFx();};return s;}
const FXPRESETS={
 'Hard Dance Master':{mst:[['eq',{hp:28,lf:60,lg:1.5,m1f:350,m1g:-1.5,hf:9000,hg:1.5}],['squeeze',{depth:.4,out:-1}],['exciter',{freq:5000,drive:6,amount:.25,mix:.5}],['maxi',{gain:5,ceil:-.3,soft:.6}]]},
 'Wide Pluck':{t0:[['chorus',{mix:.4}],['delay',{mix:.25,syncl:4}],['image',{width:1.4}]],x1:[['verb',{type:1,decay:1.8,mix:1}]]},
 'Hoover Space':{t0:[['chorus',{mode:2,mix:.6}],['dist',{drive:14,type:2,mix:.7}],['phaser',{mix:.4}]],x1:[['verb',{type:2,decay:3.5,mix:1}]],mst:[['maxi',{gain:3}]]},
 'Band-split Bass':{t3:[['split',{},{n:3,b:[[['util',{mono:1}]],[['dist',{drive:10}],['comp',{}]],[['chorus',{mix:.3}],['verb',{mix:.2,decay:1.2}]]]}]]},
 'Trance Gate Dream':{t0:[['tgate',{div:4,depth:1}],['delay',{syncl:11,fb:.5,mix:.35}]],x1:[['verb',{type:2,decay:4,mix:1}],['pump',{depth:.6,div:2}]]},
 'Lo-Fi Crush':{t0:[['crush',{bits:9,rate:3,mix:.5}],['filt',{type:15,cut:3500}],['disp',{amount:20,freq:600}]]},
 'Clear all':{}};
function mkNode(spec){const n=D.newNode(spec[0],spec[1]);if(spec[2]&&n.type==='split'){n.n=spec[2].n;spec[2].b.forEach((b,j)=>{n.bands[j]=b.map(mkNode);});}return n;}
function applyFxPreset(name){const p=FXPRESETS[name];S.chains=D.defaultChains();if(name==='Clear all'){S.chains.x1=[];S.chains.x2=[];}
  for(const b in p){S.chains[b]=p[b].map(mkNode);}S.sel.node=null;S.slots=S.slots.filter(s=>!s.d.startsWith('fx:'));sendSlots();chainChanged();rebuildMatrix&&rebuildMatrix();toast('FX preset: '+name);}
const FXHINT={mst:'Main: the whole sound. Effects here hear everything after all tracks and both FX buses.',x1:'FX 1: only the sound you send here with Send 1 on the Mixer. Good for a reverb you share.',x2:'FX 2: only the sound you send here with Send 2 on the Mixer. Good for a delay you share.',t0:'OSC A + D: only these two oscillators.',t1:'OSC B + E: only these two oscillators.',t2:'OSC C + F: only these two oscillators.',t3:'Sub and Noise only.'};
const BUSTABS=[['mst','Main'],['x1','FX 1'],['x2','FX 2'],['t0','A + D'],['t1','B + E'],['t2','C + F'],['t3','Sub + Noise']];
function topOf(list,id){for(const n of list){if(n.id===id)return n;if(n.bands){const w=l=>l.some(m=>m.id===id||(m.bands&&m.bands.some(w)));if(n.bands.some(w))return n;}}return null;}
function fxListRow(n,list,i){const d=FXDEF[n.type];const row=h('div',{class:'fxrow'+(S.sel.node===n.id||(topOf([n],S.sel.node))?' sel':'')+(n.on?'':' off'),'data-tip':d.tip,onclick:e=>{if(e.target.closest('button,i'))return;S.sel.node=n.id;renderFx();}});
  const gr=h('div',{class:'grbar'});nodeEls[n.id]=gr;
  row.append(h('i',{class:'led'+(n.on?' on':''),'data-tip':n.on?'On. Click to bypass.':'Bypassed. Click to turn on.',onclick:e=>{e.stopPropagation();n.on=n.on?0:1;chainChanged();}}),h('b',{text:(i+1)+'. '+d.name}),h('span',{class:'sp'}),
    h('button',{class:'mini',text:'↑','data-tip':'Move earlier in the chain.',onclick:()=>moveFx(n.id,-1)}),h('button',{class:'mini',text:'↓','data-tip':'Move later in the chain.',onclick:()=>moveFx(n.id,1)}),h('button',{class:'mini',text:'x','data-tip':'Remove this effect.',onclick:()=>removeFx(n.id)}),gr);return row;}
function fxStrip(n){const d=FXDEF[n.type];const el=h('div',{class:'fxstrip'+(n.on?'':' off')});
  const nm=h('div',{class:'fxname'},[h('div',{class:'row',style:'align-items:center;gap:6px'},[h('i',{class:'led'+(n.on?' on':''),onclick:()=>{n.on=n.on?0:1;chainChanged();}}),h('h3',{text:d.name,style:'margin:0;font-size:15px'})]),h('span',{class:'cap',text:d.cat}),
    h('div',{class:'row',style:'gap:4px'},[h('button',{class:'btn sm'+(n.on?' on':''),text:n.on?'On':'Bypassed','data-tip':'Turn this effect on or bypass it.',onclick:()=>{n.on=n.on?0:1;chainChanged();}}),h('button',{class:'btn sm','data-tip':'Presets for this effect: load one, or save your own.',text:'Presets',onclick:()=>fxModBrowser(n)})]),h('span',{class:'cap',style:'text-transform:none;white-space:normal;line-height:11px',text:d.tip})]);
  const disp=fxDisplay(n);disp.style.flex='none';
  const hasMix=d.order.some(x=>x.key==='mix');const rows=h('div',{class:'row w',style:'gap:6px 4px;flex:1;align-content:flex-start'});
  for(const sp of d.order){if(sp.key==='mix')continue;const key='fx:'+n.id+':'+sp.key;if(sp.k==='list')rows.appendChild(h('div',{class:'col',style:'gap:2px;width:92px'},[h('span',{class:'cap',text:sp.l}),listSel(key)]));else rows.appendChild(knob(key,{sm:true}));}
  el.append(nm,disp,rows);if(hasMix)el.append(h('div',{class:'fxmix'},[knob('fx:'+n.id+':mix',{label:'MIX'})]));return el;}
function renderFx(){if(!fxChainEl)return;for(const k in nodeEls)delete nodeEls[k];const list=S.chains[S.sel.bus];
  if(S.sel.node&&(!S.idx[S.sel.node]||!findList(S.sel.node,list)))S.sel.node=null;if(!S.sel.node&&list.length)S.sel.node=list[0].id;
  $$('b',fxTabsEl).forEach((b,i)=>b.classList.toggle('on',BUSTABS[i][0]===S.sel.bus));
  fxChainEl.innerHTML='';fxChainEl.append(h('span',{class:'cap',style:'text-transform:none;white-space:normal;line-height:12px',text:FXHINT[S.sel.bus]}));
  list.forEach((n,i)=>fxChainEl.appendChild(fxListRow(n,list,i)));
  if(!list.length)fxChainEl.appendChild(h('span',{class:'cap',style:'text-transform:none;white-space:normal',text:'No effects here yet.'}));
  fxChainEl.appendChild(h('button',{class:'btn sm add','data-tip':'Add an effect to the end of this chain.',text:'+ Add effect',onclick:()=>pickFx(list)}));
  fxPanelEl.innerHTML='';const n=S.sel.node?S.idx[S.sel.node]:null;
  if(!n){fxPanelEl.appendChild(h('div',{class:'cap',style:'text-transform:none;white-space:normal;padding:20px',text:'Add an effect with the + Add effect button. Every effect knob can be modulated: drag an envelope, LFO or macro onto it.'}));return;}
  const top=topOf(list,n.id);if(top&&top.type==='split')fxPanelEl.appendChild(laneBlock(top));
  fxPanelEl.appendChild(fxStrip(n));}
function fxPage(){const pg=h('div',{class:'page','data-page':'fx'});
  fxTabsEl=h('div',{class:'seg'},BUSTABS.map(b=>h('b',{text:b[1],'data-tip':FXHINT[b[0]],onclick:()=>{S.sel.bus=b[0];S.sel.node=null;renderFx();}})));
  const pre=h('button',{class:'btn on','data-tip':'Open the FX preset browser: whole effect setups for leads, basses, chords, plucks, master and creative sounds, plus your own saved chains.',text:'FX presets',onclick:fxBrowser});
  const bar=h('div',{class:'row',style:'align-items:center;gap:10px;width:100%'},[h('span',{class:'cap',text:'Apply effects to'}),fxTabsEl,h('span',{class:'sp'}),pre]);
  fxChainEl=h('div',{class:'col',style:'gap:4px'});fxPanelEl=h('div',{class:'col',style:'gap:8px;flex:1;min-width:0'});
  const left=panel('EFFECTS',[fxChainEl],'width:210px');const mid=panel('MODULE',[fxPanelEl],'flex:1;min-width:0');
  pg.append(h('div',{class:'col',style:'width:100%;gap:8px'},[panel(null,[bar],'width:100%'),h('div',{class:'row',style:'gap:8px;align-items:flex-start;width:100%'},[left,mid])]));renderFx();
  animators.push({draw:()=>{if(S.page!=='fx')return;const c=$('canvas[data-fx]',pg);if(c&&c.draw)c.draw();
    if(S.V){for(const id in nodeEls){const gr=S.V.nodes&&S.V.nodes[id]||0;nodeEls[id].style.width=clamp(Math.abs(gr)/18,0,1)*100+'%';}
      if(S.V.bands)for(const id in S.V.bands){const b=S.V.bands[id];for(let j=0;j<b.length;j++){const e=document.getElementById('bm_'+id+'_'+j);if(e)e.style.width=clamp((toDb(b[j])+60)/60,0,1)*100+'%';}}}}});
  return pg;}
/* ---------- mixer ---------- */
const STRIPS=[['t0','A + D'],['t1','B + E'],['t2','C + F'],['t3','Sub+Noise'],['x1','FX 1'],['x2','FX 2'],['fx','FX Out'],['mst','Master']];
const meterEls={};
function faderEl(key){const sp=specOf(key),el=h('div',{class:'fader','data-p':key,'data-tip':sp.tip+' Double click to reset.'});const tr=h('div',{class:'ft'}),th=h('div',{class:'fh'});
  for(const db of [6,0,-6,-12,-24,-36,-48,-60]){const y=(1-(db-sp.min)/(sp.max-sp.min))*100;tr.appendChild(h('i',{style:'top:'+y+'%'},[h('s',{text:db})]));}
  tr.appendChild(th);el.appendChild(tr);const upd=()=>{if(!alive(el))return false;th.style.top=(1-(getV(key)-sp.min)/(sp.max-sp.min))*100+'%';};bind(key,upd);upd();
  let d=false;const ed=e=>{const r=tr.getBoundingClientRect();setV(key,sp.min+(1-clamp((e.clientY-r.top)/r.height,0,1))*(sp.max-sp.min));};
  el.addEventListener('pointerdown',e=>{d=true;el.setPointerCapture(e.pointerId);ed(e);});el.addEventListener('pointermove',e=>{if(d)ed(e);});el.addEventListener('pointerup',()=>d=false);el.addEventListener('dblclick',()=>setV(key,0));return el;}
function anySolo(){return Object.values(S.solo).some(Boolean);}
function busSilent(b){return !!S.muted[b]||(anySolo()&&b[0]==='t'&&!S.solo[b]);}
function applyMix(){for(const b of ['t0','t1','t2','t3','x1','x2','fx'])send({t:'set',k:'bus.'+b+'.vol',v:busSilent(b)?-60:S.p['bus.'+b+'.vol']});
  document.querySelectorAll('[data-mute]').forEach(e=>e.classList.toggle('on',!!S.muted[e.dataset.mute]));document.querySelectorAll('[data-solo]').forEach(e=>e.classList.toggle('on',!!S.solo[e.dataset.solo]));
  document.querySelectorAll('.strip[data-bus]').forEach(e=>e.classList.toggle('dim',busSilent(e.dataset.bus)&&e.dataset.bus!=='mst'));}
function muteBtn(b,tip){return h('button',{class:'btn sm'+(S.muted[b]?' on':''),text:'Mute','data-mute':b,'data-tip':tip,onclick:()=>{S.muted[b]=!S.muted[b];applyMix();}});}
function soloBtn(b){return h('button',{class:'btn sm solo'+(S.solo[b]?' on':''),text:'Solo','data-solo':b,'data-tip':'Hear only this track. Sends are post-fader, so only the soloed track feeds the FX buses. Click again to release. Several tracks can be soloed together. A track routed into another track is cut with it, so solo the last track in the chain.',onclick:()=>{S.solo[b]=!S.solo[b];applyMix();}});}
function mixerPage(){const pg=h('div',{class:'page','data-page':'mixer'});
  for(const [b,nm] of STRIPS){const strip=h('div',{class:'strip'+(b==='mst'?' mst':''),'data-bus':b});const mc=cv(36,300,'meter');meterEls[b]=mc;
    strip.append(h('h3',{text:nm}));
    if(b[0]==='t'){strip.append(h('div',{class:'row'},[knob('bus.'+b+'.s1',{sm:true,label:'Send 1'}),knob('bus.'+b+'.s2',{sm:true,label:'Send 2'})]));}else strip.append(h('div',{style:'height:62px'}));
    strip.append(knob('bus.'+b+'.pan',{sm:true,label:'Pan'}));
    strip.append(h('div',{class:'row',style:'gap:6px;flex:1'},[faderEl('bus.'+b+'.vol'),mc]));
    strip.append(h('div',{class:'mono vol',id:'vol_'+b,text:'0.0 dB'}));
    if(b[0]==='t'){const dest=h('select',{class:'sel','data-tip':sp0('bus.'+b+'.dest').tip});const sp=specOf('bus.'+b+'.dest');const l=listOf(sp);const idx=+b[1];
      l.forEach((t,i)=>{if(i>=3&&(i-3)<=idx-0&&false)return;dest.appendChild(h('option',{value:i,text:t}));});dest.value=getV('bus.'+b+'.dest');dest.onchange=()=>setV('bus.'+b+'.dest',+dest.value);bind('bus.'+b+'.dest',()=>{if(!alive(dest))return false;dest.value=getV('bus.'+b+'.dest');});strip.append(h('span',{class:'cap',text:'Output'}),dest);
      strip.append(h('div',{class:'row',style:'gap:4px'},[muteBtn(b,'Silence this track.'),soloBtn(b)]));}
    else if(b==='x1'||b==='x2'||b==='fx'){let top=null;
      if(b==='x1'){const dest=h('select',{class:'sel','data-tip':specOf('bus.x1.dest').tip});listOf(specOf('bus.x1.dest')).forEach((t,i)=>dest.appendChild(h('option',{value:i,text:t})));dest.value=getV('bus.x1.dest');dest.onchange=()=>setV('bus.x1.dest',+dest.value);bind('bus.x1.dest',()=>{if(!alive(dest))return false;dest.value=getV('bus.x1.dest');});top=[h('span',{class:'cap',text:'Output'}),dest];}
      else strip.append(h('span',{class:'cap',text:b==='fx'?'Output':'Output'}),h('div',{class:'mono',style:'font-size:11px;height:24px;line-height:24px',text:b==='fx'?'Master':'FX Out'}));
      if(top)strip.append(...top);
      strip.append(h('div',{class:'row'},[muteBtn(b,b==='fx'?'Silence every effect return at once.':'Silence this FX bus.')]));}
    else strip.append(h('div',{style:'height:58px'}));
    pg.append(strip);bind('bus.'+b+'.vol',()=>{const e=document.getElementById('vol_'+b);if(!e)return false;e.textContent=S.p['bus.'+b+'.vol'].toFixed(1)+' dB';if(b!=='mst'&&busSilent(b))send({t:'set',k:'bus.'+b+'.vol',v:-60});});refresh('bus.'+b+'.vol');}
  const info=panel('ROUTING',[h('span',{class:'cap',style:'white-space:normal;text-transform:none',text:'Each track can go to Master, to an FX bus, or into a later track (B, C or Sub+Noise), so you can build chains of tracks. Sends feed FX 1 and FX 2, which each have their own effect chain on the FX page. FX 1 can also feed FX 2. FX Out is one fader for all effect returns together, then it goes to Master. Send levels are post-fader.'}),
    h('span',{class:'cap',style:'white-space:normal;text-transform:none',text:'Oscillators go to a track with the To menu on the Sound page, and to filters with Route.'}),
    h('span',{class:'cap',style:'white-space:normal;text-transform:none',text:'Meters show level in dB with a peak marker: blue is low, purple is hot, pink from -1 dB up is close to clipping.'})],'width:200px');pg.append(info);
  animators.push({draw:()=>{if(S.page!=='mixer'||!S.V)return;for(const b in meterEls){const m=S.V.meter[b]||{l:0,r:0};drawMeter(meterEls[b],m.l,m.r,true);}}});return pg;}
function sp0(key){return specOf(key);}
/* ---------- arp ---------- */
function arpPage(){const pg=h('div',{class:'page','data-page':'arp',style:'flex-direction:column'});
  const top=panel('ARPEGGIATOR',[h('div',{class:'row',style:'align-items:center;gap:8px'},[tog('arp.on','On'),sel('arp.mode'),sel('arp.rate'),tog('arp.hold','Hold'),h('span',{class:'sp'}),knobs(['arp.oct','arp.gate','arp.swing','bpm'],{sm:true})]),
    h('span',{class:'cap',style:'white-space:normal;text-transform:none',text:'Hold some keys and the arp steps through them. The 16 step grid below shapes each step: on or off, velocity, transpose and ratchets (repeats inside a step).'})]);
  const grid=h('div',{class:'seqgrid'});const rows=[['on','On'],['vel','Velocity'],['semi','Semitones'],['rat','Ratchet']];const cells={};
  const SQ=S.seq;const commit=()=>send({t:'seq',seq:S.seq});
  for(const [k,lbl] of rows){const row=h('div',{class:'srow'},[h('span',{class:'cap',text:lbl})]);cells[k]=[];
    for(let i=0;i<16;i++){const c=h('div',{class:'scell '+k,'data-tip':lbl+' of step '+(i+1)+'. '+(k==='on'?'Click to toggle.':k==='vel'?'Drag up and down.':k==='semi'?'Drag up and down: -12 to +12 semitones.':'Drag up and down: 1 to 4 repeats.')});const f=h('div',{class:'fill'}),t=h('span',{class:'t'});c.append(f,t);
      const upd=()=>{const v=SQ[k][i];if(k==='on'){c.classList.toggle('on',!!v);t.textContent='';f.style.height='0';}else if(k==='vel'){f.style.height=v*100+'%';t.textContent=Math.round(v*127);}else if(k==='semi'){f.style.height=Math.abs(v)/12*50+'%';f.style.top=v>=0?'auto':'50%';f.style.bottom=v>=0?'50%':'auto';t.textContent=(v>0?'+':'')+v;}else{f.style.height=v/4*100+'%';t.textContent=v+'x';}};
      c.upd=upd;upd();let dr=null;
      c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);dr={y:e.clientY,v:SQ[k][i]};if(k==='on'){SQ.on[i]=SQ.on[i]?0:1;upd();commit();}});
      c.addEventListener('pointermove',e=>{if(!dr||k==='on')return;const d=(dr.y-e.clientY);if(k==='vel')SQ.vel[i]=clamp(dr.v+d/60,0,1);else if(k==='semi')SQ.semi[i]=clamp(Math.round(dr.v+d/6),-12,12);else SQ.rat[i]=clamp(Math.round(dr.v+d/20),1,4);upd();commit();});
      c.addEventListener('pointerup',()=>dr=null);row.appendChild(c);cells[k].push(c);}
    grid.appendChild(row);}
  const lenRow=h('div',{class:'row',style:'align-items:center'},[h('span',{class:'cap',text:'Pattern length'}),h('div',{class:'seg'},[4,8,12,16].map(n=>h('b',{text:n,class:SQ.len===n?'on':'',onclick:function(){SQ.len=n;$$('b',this.parentNode).forEach(b=>b.classList.toggle('on',+b.textContent===n));commit();}}))),
    h('button',{class:'btn sm',text:'Random','data-tip':'Fill the grid with a random pattern.',onclick:()=>{for(let i=0;i<16;i++){SQ.on[i]=Math.random()<.8?1:0;SQ.vel[i]=.5+Math.random()*.5;SQ.semi[i]=Math.random()<.3?[-12,-5,0,7,12][Math.floor(Math.random()*5)]:0;SQ.rat[i]=Math.random()<.15?2:1;}for(const k in cells)cells[k].forEach(c=>c.upd());commit();}}),
    h('button',{class:'btn sm',text:'Reset','data-tip':'Back to a plain pattern.',onclick:()=>{for(let i=0;i<16;i++){SQ.on[i]=1;SQ.vel[i]=1;SQ.semi[i]=0;SQ.rat[i]=1;}for(const k in cells)cells[k].forEach(c=>c.upd());commit();}})]);
  pg.append(top,panel('STEP SEQUENCER',[lenRow,grid]));
  animators.push({draw:()=>{if(S.page!=='arp')return;const st=S.V?S.V.steps:-1;for(const k in cells)cells[k].forEach((c,i)=>c.classList.toggle('play',i===st%Math.max(1,S.seq.len)&&st>=0));}});return pg;}
PAGES.fx=fxPage;PAGES.mixer=mixerPage;PAGES.arp=arpPage;
