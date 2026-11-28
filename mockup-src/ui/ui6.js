/* ---------- drawn envelopes (MSEG): points, grid snap, curves, segment types, loop markers, shape library ---------- */
S.envpts={};let ENVSNAP=true,ENVGX=16,ENVGY=8,EPCLIP=null;
function epDefault(key){const L=key[0]==='l',i=+key.slice(1),a=(L?S.custom:S.draw)[i]||[],n=a.length||1,K=L?16:8,pts=[];for(let k=0;k<=K;k++){const v=a.length?a[Math.min(n-1,Math.round(k/K*n))%n]:(L?0:Math.exp(-k));pts.push({x:k/K,y:L?(v+1)/2:v,c:0});}return pts;}
function epGet(key){return S.envpts[key]||(S.envpts[key]=epDefault(key));}
function epCurve(t,c){return c>=0?Math.pow(t,1+3*c):1-Math.pow(1-t,1-3*c);}
function epSeg(a,b,t){const ty=a.t|0;if(ty===2)return a.y;if(ty===1){const u=epCurve(t,a.c||0);return a.y+(b.y-a.y)*(u*u*(3-2*u));}return a.y+(b.y-a.y)*epCurve(t,a.c||0);}
function epAt(p,x){let s=0;while(s<p.length-2&&x>p[s+1].x)s++;const a=p[s],b=p[s+1],t=b.x>a.x?clamp((x-a.x)/(b.x-a.x),0,1):1;return epSeg(a,b,t);}
function epBake(key,quiet){const p=epGet(key),L=key[0]==='l',i=+key.slice(1),N=L?256:512,out=[];for(let k=0;k<N;k++){const x=k/(L?N:N-1);const y=epAt(p,x);out.push(L?y*2-1:y);}
  if(L){S.custom[i]=out;send({t:'custom',i,pts:out});}else{S.draw[i]=out;send({t:'draw',i,pts:out});}if(!quiet)histMark(L?'LFO shape':'Envelope shape');}
/* shape library: factory categories plus your own (saved in this browser) */
const epGate=(pat,dur)=>{const n=pat.length,p=[];for(let k=0;k<n;k++){const on=pat[k]==='1';p.push([k/n,on?1:0,0,2]);if(on&&dur<1)p.push([(k+dur)/n,0,0,2]);}p.push([1,0,0,0]);return p.filter((q,i)=>i===0||i===p.length-1||q[1]!==p[i-1][1]);};
const epWob=(n,sh)=>{const p=[];for(let k=0;k<=n*2;k++)p.push([k/(2*n),k%2?0:1,sh||0,1]);return p;};
const epStairs=(lv)=>{const n=lv.length,p=lv.map((v,k)=>[k/n,v,0,2]);p.push([1,lv[n-1],0,0]);return p;};
const EPLIB={
 'Basic':{'Ramp up':[[0,0,0],[1,1,0]],'Ramp down':[[0,1,0],[1,0,0]],'Triangle':[[0,0,0],[.5,1,0],[1,0,0]],'Hump':[[0,0,0,1],[.5,1,0,1],[1,0,0]],'Exp decay':[[0,1,-.7],[1,0,0]],'Exp rise':[[0,0,.7],[1,1,0]],'Square':epGate('10',.5),'Flat':[[0,1,0],[1,1,0]]},
 'Plucks':{'Pluck':[[0,0,0],[.02,1,-.6],[1,0,0]],'Short pluck':[[0,0,0],[.01,1,-.8],[.35,0,0],[1,0,0]],'Pluck with tail':[[0,0,0],[.015,1,-.7],[.3,.35,-.3],[1,0,0]],'Snap':[[0,0,0],[.005,1,-.9],[.12,0,0],[1,0,0]],'Bounce':[[0,0,0],[.01,1,-.6],[.2,.05,0],[.21,.6,-.6],[.4,.03,0],[.41,.3,-.6],[.6,0,0],[1,0,0]],'Organ':[[0,0,0],[.01,1,0],[.9,1,0],[1,0,0]]},
 'Swells':{'Swell':[[0,0,.5],[.7,1,-.5],[1,0,0]],'Slow rise':[[0,0,.6],[1,1,0]],'Reverse':[[0,0,.7],[.94,1,0],[1,0,0]],'Breath':[[0,0,.3],[.4,1,-.3],[.6,.8,0],[1,0,0]],'Pad':[[0,0,.4],[.35,1,-.2],[.5,.8,0],[1,.8,0]]},
 'Gates':{'Gate 1/4':epGate('1111',.5),'Gate 1/8':epGate('11111111',.5),'Gate 1/16':epGate('1111111111111111',.5),'Trance 3-3-2':epGate('1001001010010010',.75),'Offbeat':epGate('01010101',.9),'Stutter':epGate('1111000011001010',.6),'Chop':epGate('1011011010110110',.8)},
 'Pump':{'Sidechain':[[0,.05,.6],[.6,1,0],[1,1,0]],'Sidechain hard':[[0,0,0],[.06,0,.5],[.5,1,0],[1,1,0]],'Pump 2x':[[0,.05,.6],[.35,1,0],[.5,1,0],[.5001,.05,.6],[.85,1,0],[1,1,0]],'Pump 4x':[[0,.1,.6],[.2,1,0],[.25,1,0],[.2501,.1,.6],[.45,1,0],[.5,1,0],[.5001,.1,.6],[.7,1,0],[.75,1,0],[.7501,.1,.6],[.95,1,0],[1,1,0]],'Duck and hold':[[0,0,0],[.25,0,.4],[.6,1,0],[1,1,0]]},
 'Steps':{'Up 4':epStairs([0,.25,.5,.75]),'Down 4':epStairs([1,.75,.5,.25]),'Up 8':epStairs([0,1/8,2/8,3/8,4/8,5/8,6/8,7/8]),'Octave jumps (24 st)':epStairs([0,.5,0,.5,0,.5,1,.5]),'Minor arp (24 st)':epStairs([0,3/24,7/24,12/24,7/24,3/24]),'Random 8':null},
 'Wobble':{'Wobble 1':epWob(1),'Wobble 2':epWob(2),'Wobble 4':epWob(4),'Wobble 3 (triplet)':epWob(3),'Growl':[[0,0,0],[.12,1,.6],[.25,.2,-.4],[.37,.9,.5],[.5,0,0],[.62,1,.6],[.75,.3,-.4],[.87,.8,.5],[1,0,0]],'Sharp wob 2':epWob(2,.6)},
 'FX':{'Riser':[[0,0,.8],[1,1,0]],'Downer':[[0,1,-.8],[1,0,0]],'Laser':[[0,1,-.9],[.15,0,0],[1,0,0]],'Tape stop':[[0,1,0],[.6,1,.7],[1,0,0]],'Glitch':epGate('1101001110100110',.4),'Siren':[[0,0,0,1],[.25,1,0,1],[.5,0,0,1],[.75,1,0,1],[1,0,0]]}};
const EPKEY='whiskerwave.shapes.v1';
function epUser(){try{return JSON.parse(localStorage.getItem(EPKEY)||'{}')||{};}catch(e){return S.epUserMem||(S.epUserMem={});}}
function epUserSave(o){S.epUserMem=o;try{localStorage.setItem(EPKEY,JSON.stringify(o));}catch(e){}}
function epFind(name){if(name.startsWith('my:'))return epUser()[name.slice(3)];for(const c in EPLIB)if(name in EPLIB[c])return EPLIB[c][name];return undefined;}
function epLoad(key,arr,name){if(typeof key==='number')key='e'+key;let a=arr;if(!a&&name==='Random 8'){a=[];for(let k=0;k<8;k++)a.push(Math.round(Math.random()*8)/8);a=epStairs(a);}if(!a)return;
  S.envpts[key]=a.map(q=>Array.isArray(q)?{x:q[0],y:q[1],c:q[2]||0,t:q[3]||0}:{x:q.x,y:q.y,c:q.c||0,t:q.t||0});epBake(key);toast('Shape: '+name);}
function epPreset(i,name){epLoad(i,epFind(name),name);}
function epPack(key){return epGet(key).map(q=>[+q.x.toFixed(5),+q.y.toFixed(5),+(q.c||0).toFixed(3),q.t|0]);}
function epThumb(arr,W,H){const c=cv(W,H),g=c.g;g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);if(!arr)return c;const p=arr.map(q=>({x:q[0],y:q[1],c:q[2]||0,t:q[3]||0}));g.beginPath();for(let k=0;k<=W;k++){const y=epAt(p,k/W);const py=H-2-y*(H-4);k?g.lineTo(k,py):g.moveTo(k,py);}g.strokeStyle=cssv('--acc4');g.lineWidth=1.5;g.stroke();return c;}
function shapeBrowser(key,after){const body=h('div',{class:'col',style:'gap:8px'});let cat='Basic';
  const cats=h('div',{class:'seg tight'});const grid=h('div',{class:'shgrid'});
  {const mx=Math.max(Object.keys(epUser()).length,...Object.values(EPLIB).map(o=>Object.keys(o).length),10),rows=Math.ceil(mx/5);grid.style.minHeight=(rows*72+(rows-1)*8)+'px';} // same size on every tab (the tallest tab sets it)
  const draw=()=>{cats.innerHTML='';grid.innerHTML='';[...Object.keys(EPLIB),'My shapes'].forEach(c=>cats.appendChild(h('b',{text:c,class:c===cat?'on':'',onclick:()=>{cat=c;draw();}})));
    const items=cat==='My shapes'?Object.entries(epUser()).map(([n,a])=>['my:'+n,n,a]):Object.entries(EPLIB[cat]).map(([n,a])=>[n,n,a]);
    if(!items.length)grid.appendChild(h('span',{class:'cap',style:'text-transform:none',text:'No saved shapes yet. Draw one, then press Save current shape.'}));
    for(const [id,n,a] of items){const it=h('div',{class:'shit','data-tip':'Load '+n+' (you can undo).',onclick:()=>{epLoad(key,a,n);if(after)after();}},[epThumb(a||epStairs([.2,.9,.4,.7,.1,.6,.3,.8]),100,44),h('span',{text:n})]);
      if(cat==='My shapes')it.appendChild(h('button',{class:'btn sm shx',text:'x','data-tip':'Delete this saved shape.',onclick:e=>{e.stopPropagation();const u=epUser();delete u[n];epUserSave(u);draw();}}));grid.appendChild(it);}};
  const save=h('button',{class:'btn sm on',text:'Save current shape','data-tip':'Save the shape you drew to My shapes (kept in this browser).',onclick:()=>{const n=(prompt('Name for this shape','My shape')||'').trim();if(!n)return;const u=epUser();u[n]=epPack(key);epUserSave(u);cat='My shapes';draw();}});
  const exp=h('button',{class:'btn sm',text:'Export','data-tip':'Copy all your saved shapes as text, to back them up or share them.',onclick:()=>{ta.value=JSON.stringify(epUser());ta.style.display='';ta.select();}});
  const imp=h('button',{class:'btn sm',text:'Import','data-tip':'Paste shapes text from Export into the box, then press Import again.',onclick:()=>{if(ta.style.display==='none'){ta.value='';ta.style.display='';ta.focus();return;}try{const o=JSON.parse(ta.value);const u=epUser();for(const n in o)if(Array.isArray(o[n]))u[n]=o[n];epUserSave(u);ta.style.display='none';cat='My shapes';draw();}catch(e){toast('That text is not a shapes list');}}});
  const ta=h('textarea',{class:'shta',style:'display:none'});
  draw();body.append(cats,grid,h('div',{class:'row',style:'gap:6px;align-items:center'},[save,exp,imp]),ta);dialog('Shapes',body,[['Done',null,1]]);}
function epPop(x,y,items){document.querySelectorAll('.eppop').forEach(e=>e.remove());const m=h('div',{class:'eppop',style:'left:'+x+'px;top:'+y+'px'},items.map(([t,f])=>h('button',{class:'btn sm',text:t,onclick:()=>{m.remove();f();}})));document.body.appendChild(m);setTimeout(()=>addEventListener('pointerdown',function cl(e){if(!m.contains(e.target)){m.remove();removeEventListener('pointerdown',cl);}}),0);}
function envEditor(idx,W,H,big,kind){kind=kind||'e';const KEY=kind+idx,LF=kind==='l',c=cv(W,H),pre='e'+(idx+1)+'.';const PAD=big?12:5,TOP=big?14:PAD;let drag=null,hov=null,info='';
  const X=x=>PAD+x*(W-2*PAD),Y=y=>H-PAD-y*(H-PAD-TOP),iX=px=>clamp((px-PAD)/(W-2*PAD),0,1),iY=py=>clamp((H-PAD-py)/(H-PAD-TOP),0,1);
  const sn=(v,n)=>ENVSNAP?Math.round(v*n)/n:v;
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:epSeg(a,b,.5)});
  const lm=()=>LF?0:(S.p[pre+'loop']|0),mk=()=>({ls:S.p[pre+'ls'],le:S.p[pre+'le']});
  const lenMs=()=>LF?0:(S.p[pre+'sync']?60000/(S.p.bpm||120)*[0,.25,.5,1,2,4,8,16,32][S.p[pre+'sync']]:S.p[pre+'len']);
  const beats=()=>LF?0:[0,.25,.5,1,2,4,8,16,32][S.p[pre+'sync']|0];
  const bbs=b=>{const q=Math.round(b*4)/4,bar=Math.floor(q/4)+1,bt=Math.floor(q%4)+1,st=Math.round((q%1)*4)+1;return bar+'.'+bt+(st>1?'.'+st:'');};
  const tl=x=>beats()?bbs(x*beats()):(x*lenMs()/1000).toFixed(3)+' s';
  const rd=(x,y)=>LF?Math.round(x*100)+'%   '+(y*2-1).toFixed(2):tl(x)+'   '+Math.round(y*100)+'%';
  c.draw=()=>{const g=c.g,p=epGet(KEY),NX=ENVGX,NY=ENVGY;g.clearRect(0,0,W,H);g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);
    g.lineWidth=1;g.strokeStyle=cssv('--grid');const bx=NX%3===0?3:4;for(let k=0;k<=NX;k++){g.globalAlpha=k%bx===0?.9:.35;const x=Math.round(X(k/NX))+.5;g.beginPath();g.moveTo(x,TOP);g.lineTo(x,H-PAD);g.stroke();}
    for(let k=0;k<=NY;k++){g.globalAlpha=k===0||k===NY||k*2===NY?.9:.3;const y=Math.round(Y(k/NY))+.5;g.beginPath();g.moveTo(PAD,y);g.lineTo(W-PAD,y);g.stroke();}g.globalAlpha=1;
    const L=lm();if(L>=2){const m=mk();g.fillStyle=cssv('--acc2');g.globalAlpha=.10;if(L===3)g.fillRect(X(Math.min(m.ls,m.le)),TOP,X(Math.max(m.ls,m.le))-X(Math.min(m.ls,m.le)),H-PAD-TOP);g.globalAlpha=1;
      const mark=(v,col,lab)=>{const x=Math.round(X(v))+.5;g.strokeStyle=col;g.setLineDash([3,3]);g.beginPath();g.moveTo(x,TOP);g.lineTo(x,H-PAD);g.stroke();g.setLineDash([]);g.fillStyle=col;g.beginPath();g.moveTo(x-5,0);g.lineTo(x+5,0);g.lineTo(x,TOP-2);g.closePath();g.fill();if(big){g.font='10px JetBrains Mono,monospace';g.fillText(lab,x+6,10);}};
      if(L===3)mark(m.ls,cssv('--acc'),'loop start');mark(m.le,cssv('--acc2'),L===2?'hold':'loop end');}
    if(big&&!LF){g.fillStyle=cssv('--dim');g.font='10px JetBrains Mono,monospace';g.textAlign='center';for(let k=0;k<=4;k++)g.fillText(beats()?(k<4?bbs(k/4*beats()):'end'):(k/4*lenMs()/1000).toFixed(2)+'s',clamp(X(k/4),22,W-22),H-1);g.textAlign='left';for(const v of [0,.5,1])g.fillText(Math.round(v*100)+'%',1,Y(v)+(v===1?9:v===0?-2:3));}
    const path=()=>{g.beginPath();for(let k=0;k<=W;k++){const x=k/W;const px=X(x),py=Y(epAt(p,x));k?g.lineTo(px,py):g.moveTo(px,py);}};
    path();g.lineTo(X(1),Y(0));g.lineTo(X(0),Y(0));g.closePath();g.globalAlpha=.16;g.fillStyle=cssv('--acc4');g.fill();g.globalAlpha=1;
    path();g.strokeStyle=cssv('--acc4');g.lineWidth=2;g.stroke();
    for(let k=0;k<p.length-1;k++){if((p[k].t|0)===2)continue;const m=mid(p[k],p[k+1]),mx=X(m.x),my=Y(m.y);g.fillStyle=cssv('--disp');g.strokeStyle=cssv('--acc2');g.lineWidth=1.5;g.beginPath();g.moveTo(mx,my-4);g.lineTo(mx+4,my);g.lineTo(mx,my+4);g.lineTo(mx-4,my);g.closePath();g.fill();g.stroke();}
    const R=big?6:4;p.forEach((q,k)=>{g.beginPath();g.arc(X(q.x),Y(q.y),R,0,7);g.fillStyle=(drag&&drag.k===k&&drag.t==='p')||(hov&&hov.t==='p'&&hov.k===k)?cssv('--acc'):cssv('--text');g.fill();g.strokeStyle='#000';g.lineWidth=1;g.stroke();});
    const lv=!LF&&S.V&&S.V.env?S.V.env[idx]:undefined;if(lv!==undefined){g.fillStyle=cssv('--m1');g.fillRect(PAD,Y(lv),W-2*PAD,1);}
    g.fillStyle=cssv('--text');g.font='10px JetBrains Mono,monospace';g.textAlign='right';g.fillText(info||'',W-4,big?24:11);g.textAlign='left';};
  const pos=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height];};
  const hit=e=>{const [px,py]=pos(e),p=epGet(KEY);let best=null,bd=(big?10:8);
    const L=lm();if(L>=2&&py<TOP+4){const m=mk();for(const [n,v] of (L===3?[['ls',m.ls],['le',m.le]]:[['le',m.le]])){const d=Math.abs(X(v)-px);if(d<8&&d<bd){bd=d;best={t:'mk',n};}}if(best)return {best,x:iX(px),y:iY(py)};}
    p.forEach((q,k)=>{const d=Math.hypot(X(q.x)-px,Y(q.y)-py);if(d<bd){bd=d;best={t:'p',k};}});
    if(!best)for(let k=0;k<p.length-1;k++){if((p[k].t|0)===2)continue;const m=mid(p[k],p[k+1]),d=Math.hypot(X(m.x)-px,Y(m.y)-py);if(d<bd){bd=d;best={t:'m',k};}}
    return {best,x:iX(px),y:iY(py)};};
  const move=e=>{const h0=hit(e),p=epGet(KEY);
    if(!drag){hov=h0.best;const q=hov&&hov.t==='p'?p[hov.k]:{x:h0.x,y:h0.y};info=rd(q.x,q.y);c.style.cursor=hov?(hov.t==='p'?'move':hov.t==='mk'?'ew-resize':'ns-resize'):'crosshair';return;}
    if(drag.t==='mk'){let best=0,bd=9;for(const q of p){const d=Math.abs(q.x-h0.x);if(d<bd){bd=d;best=q.x;}}setV(pre+drag.n,best);info=(drag.n==='ls'?'loop start ':'end marker ')+tl(best);return;}
    if(drag.t==='p'){const q=p[drag.k];if(drag.k>0&&drag.k<p.length-1){const lo=p[drag.k-1].x+.0005,hi=p[drag.k+1].x-.0005;q.x=clamp(sn(h0.x,ENVGX),lo,hi);}q.y=clamp(sn(h0.y,ENVGY),0,1);info=rd(q.x,q.y);}
    else{const a=p[drag.k],b=p[drag.k+1];if(Math.abs(b.y-a.y)>.02){const m=clamp((h0.y-a.y)/(b.y-a.y),.02,.98);a.c=clamp(m<=.5?(Math.log(m)/Math.log(.5)-1)/3:(1-Math.log(1-m)/Math.log(.5))/3,-1,1);info='curve '+Math.round(a.c*100)+'%';}}
    epBake(KEY,true);};
  c.addEventListener('pointerdown',e=>{if(e.button)return;const h0=hit(e),p=epGet(KEY);c.setPointerCapture(e.pointerId);
    if(h0.best)drag=h0.best;else{const x=clamp(sn(h0.x,ENVGX),.0005,.9995),y=clamp(sn(h0.y,ENVGY),0,1);let k=0;while(k<p.length&&p[k].x<x)k++;const prev=p[k-1];p.splice(k,0,{x,y,c:0,t:prev?prev.t|0:0});drag={t:'p',k};}
    move(e);e.preventDefault();});
  c.addEventListener('pointermove',move);c.addEventListener('pointerup',()=>{if(drag&&drag.t!=='mk')epBake(KEY);drag=null;});c.addEventListener('pointerleave',()=>{if(!drag){hov=null;info='';}});
  c.addEventListener('dblclick',e=>{e.preventDefault();const h0=hit(e),p=epGet(KEY);if(h0.best&&h0.best.t==='p'&&h0.best.k>0&&h0.best.k<p.length-1){p.splice(h0.best.k,1);drag=null;epBake(KEY);}else if(h0.best&&h0.best.t==='m'){p[h0.best.k].c=0;epBake(KEY);}});
  c.addEventListener('contextmenu',e=>{e.preventDefault();const h0=hit(e),p=epGet(KEY);let k=-1;
    if(h0.best&&h0.best.t==='p'){k=h0.best.k;}else{const x=h0.x;for(let j=0;j<p.length-1;j++)if(x>=p[j].x&&x<=p[j+1].x){k=j;break;}}
    if(k<0)return;const items=[];const setT=t=>()=>{const j=Math.min(k,p.length-2);p[j].t=t;if(t)p[j].c=p[j].c||0;epBake(KEY);};
    if(h0.best&&h0.best.t==='p'&&k>0&&k<p.length-1)items.push(['Delete point',()=>{p.splice(k,1);epBake(KEY);}]);
    items.push(['Curve',setT(0)],['S-curve',setT(1)],['Hold (step)',setT(2)],['Straighten',()=>{p[Math.min(k,p.length-2)].c=0;epBake(KEY);}]);
    epPop(e.clientX,e.clientY,items);});
  c.dataset.tip='Click empty space to add a point. Drag a point to move it, drag a diamond to bend that segment. Right click a point or segment for: delete, Curve, S-curve, Hold (step). Double click deletes a point. Drag the triangles at the top to move the loop markers. Snap uses the grid.';
  return c;}
function epTransform(key,f){const p=epGet(key);f(p);p.sort((a,b)=>a.x-b.x);p[0].x=0;p[p.length-1].x=1;epBake(key);}
function envTools(idx,big,LFKEY){const key=LFKEY||('e'+idx);
  const sn=h('button',{class:'btn sm envsnap'+(ENVSNAP?' on':''),text:'Snap','data-tip':'Lock new and dragged points to the grid so timing and levels are exact. Off: free drawing.',onclick:()=>{ENVSNAP=!ENVSNAP;$$('.btn.envsnap').forEach(b=>b.classList.toggle('on',ENVSNAP));}});
  const sh=h('select',{class:'sel',style:'width:84px','data-tip':'Load a shape (you can undo). Shapes... opens the browser with previews and your saved shapes.'},[h('option',{value:'',text:'Shape...'})]);
  const fill=()=>{sh.innerHTML='';sh.appendChild(h('option',{value:'',text:'Shape...'}));for(const c in EPLIB){const og=h('optgroup',{label:c});for(const n in EPLIB[c])og.appendChild(h('option',{value:n,text:n}));sh.appendChild(og);}const u=epUser(),un=Object.keys(u);if(un.length){const og=h('optgroup',{label:'My shapes'});un.forEach(n=>og.appendChild(h('option',{value:'my:'+n,text:n})));sh.appendChild(og);}};fill();sh.onfocus=fill;
  sh.onchange=()=>{if(sh.value){epLoad(key,epFind(sh.value),sh.value.replace(/^my:/,''));}sh.value='';};
  const br=h('button',{class:'btn sm',text:'Shapes','data-tip':'Open the shape browser: previews by category, plus your own saved shapes.',onclick:()=>shapeBrowser(key)});
  const out=[sn,sh,br];if(!big)out.push(h('button',{class:'btn sm',text:'Big','data-tip':'Open the large editor with grid, loop markers and all tools.',onclick:()=>LFKEY?lfoBigDialog(+LFKEY.slice(1)):envBigDialog(idx)}));return out;}
function gridTools(key){const gx=h('select',{class:'sel',style:'width:74px','data-tip':'Grid across the length. 12, 24 and 48 give triplets. With Sync on, 16 on a 1 bar shape is 1/16 notes.'},[4,8,12,16,24,32,48,64].map(n=>h('option',{value:n,text:'X '+n,selected:n===ENVGX})));gx.onchange=()=>{ENVGX=+gx.value;};
  const gy=h('select',{class:'sel',style:'width:70px','data-tip':'Level grid. Y 24 with a pitch amount of 24 semitones gives one semitone per line.'},[2,4,8,10,12,16,24].map(n=>h('option',{value:n,text:'Y '+n,selected:n===ENVGY})));gy.onchange=()=>{ENVGY=+gy.value;};
  const b=(t,tip,f)=>h('button',{class:'btn sm',text:t,'data-tip':tip,onclick:f});
  return [gx,gy,b('Flip H','Mirror the shape left to right.',()=>epTransform(key,p=>{p.forEach(q=>q.x=1-q.x);p.reverse();})),b('Flip V','Turn the shape upside down.',()=>epTransform(key,p=>p.forEach(q=>{q.y=1-q.y;q.c=-(q.c||0);}))),
    b('Copy','Copy this shape.',()=>{EPCLIP=epPack(key);toast('Shape copied');}),b('Paste','Paste a copied shape here (also between envelopes and LFOs).',()=>{if(EPCLIP)epLoad(key,EPCLIP,'pasted');}),
    b('Clear','Start from a flat line.',()=>epLoad(key,[[0,0,0],[1,0,0]],'clear'))];}
function envBigDialog(idx){const ed=envEditor(idx,760,300,true);const i=idx+1,pre='e'+i+'.',key='e'+idx;
  const body=h('div',{class:'col',style:'gap:6px'},[h('div',{class:'row',style:'align-items:center;gap:6px;flex-wrap:wrap'},[...envTools(idx,true),...gridTools(key)]),ed,
    h('div',{class:'row',style:'align-items:center;gap:8px'},[knob(pre+'len',{sm:true}),h('div',{class:'col',style:'gap:3px'},[h('span',{class:'cap',text:'Sync'}),sel(pre+'sync')]),h('div',{class:'col',style:'gap:3px'},[h('span',{class:'cap',text:'Loop'}),sel(pre+'loop')]),knob(pre+'r',{sm:true,label:'Release'}),knob(pre+'slew',{sm:true,label:'Smooth'}),h('span',{class:'cap',style:'text-transform:none;white-space:normal;max-width:300px',text:'Release is used when the shape has no loop markers, or after it reaches the end. Smooth rounds hard jumps so they never click.'})])]);
  let on=true;const tick=()=>{if(!on||!ed.isConnected)return;ed.draw();requestAnimationFrame(tick);};dialog('Envelope '+i+' editor',body,[['Done',()=>{on=false;return true;},1]]);requestAnimationFrame(tick);}
function lfoBigDialog(idx){const ed=envEditor(idx,760,300,true,'l');const key='l'+idx;const body=h('div',{class:'col',style:'gap:6px'},[h('div',{class:'row',style:'align-items:center;gap:6px;flex-wrap:wrap'},[...envTools(idx,true,key),...gridTools(key)]),ed]);let on=true;const tick=()=>{if(!on||!ed.isConnected)return;ed.draw();requestAnimationFrame(tick);};dialog('LFO '+(idx+1)+' editor',body,[['Done',()=>{on=false;return true;},1]]);requestAnimationFrame(tick);}

/* ---------- filter page extras (v1.7.3) ---------- */
function filterExtras(fi){const k='f'+fi+'.';
  const cap=t=>h('div',{class:'cap',style:'margin-top:8px',text:t});
  const note=t=>h('span',{class:'cap',style:'text-transform:none;white-space:normal',text:t});
  const mc=cv(360,54);mc.dataset.tip='The envelope this filter uses, with its live level while you play.';
  const envSel=sel(k+'es');envSel.style.width='110px';
  const hand=h('span',{});const holder=h('div',{class:'col',style:'gap:4px'});
  const build=()=>{if(!alive(holder))return false;const n=S.p[k+'es'];holder.innerHTML='';hand.innerHTML='';
    if(n>=1){hand.append(src('e'+n,'ENV '+n));holder.append(knobs(['e'+n+'.a','e'+n+'.h','e'+n+'.d','e'+n+'.s','e'+n+'.r'],{sm:true}));}
    else holder.append(note('No envelope on this filter. Pick Env 1 to 8 to attach one. The Env knob above sets how far it opens the cutoff.'));updHandles();};
  bind(k+'es',build);build();
  mc.draw=()=>{const n=S.p[k+'es'];if(n<1){const g=mc.g;g.clearRect(0,0,mc.W,mc.H);g.fillStyle=cssv('--disp');g.fillRect(0,0,mc.W,mc.H);g.fillStyle=cssv('--dim');g.font='10px JetBrains Mono,monospace';g.fillText('No envelope',10,mc.H/2+3);return;}drawEnv(mc,envOf('e'+n+'.'),S.V&&S.V.env?S.V.env[n-1]:undefined);};
  animators.push({draw:()=>{if(S.page==='filter'&&mc.offsetParent)mc.draw();}});
  const edit=h('button',{class:'btn sm',text:'Edit in bank','data-tip':'Open this envelope in the Envelopes panel on the Sound page.',onclick:()=>{const n=S.p[k+'es'];if(n>=1){showPage('sound');if(bank_set)bank_set(n);}}});
  const list=h('div',{class:'col',style:'gap:3px'});let sig=null;
  const rebuild=()=>{const mine=S.slots.filter(x=>String(x.d).startsWith(k));const s2=mine.map(x=>x.s+'>'+x.d).join('|');if(s2===sig)return;sig=s2;list.innerHTML='';
    if(!mine.length){list.append(note('Nothing modulates this filter yet. Drag the circle of an ENV, LFO or Macro from the strip at the bottom onto any knob above.'));return;}
    mine.forEach(s=>{const val=h('span',{class:'mono',style:'width:40px;text-align:right',text:Math.round(s.a*100)+'%'});
      const rg=h('input',{type:'range',class:'rg',min:-100,max:100,value:Math.round(s.a*100),style:'flex:1'});rg.oninput=()=>{s.a=rg.value/100;val.textContent=rg.value+'%';sendSlots();refreshAll();};
      list.append(h('div',{class:'row',style:'align-items:center;gap:6px'},[h('span',{style:'width:150px;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',text:(SRCNAME[s.s]||s.s)+' > '+nameOf(s.d),'data-tip':(SRCNAME[s.s]||s.s)+' > '+nameOf(s.d)}),rg,val,h('button',{class:'btn sm',text:'x','data-tip':'Remove this route.',onclick:()=>{S.slots.splice(S.slots.indexOf(s),1);sendSlots();refreshAll();rebuildMatrix&&rebuildMatrix();sig=null;rebuild();}})]));});};
  animators.push({draw:()=>{if(S.page==='filter'){if(!alive(list))return;rebuild();}}});rebuild();
  return [cap('Envelope'),h('div',{class:'row',style:'align-items:center;gap:6px'},[envSel,hand,h('span',{class:'sp'}),edit]),mc,holder,cap('Modulating this filter'),list];}
function filterCopy(a,b,swap){for(const x of Object.keys(PR).filter(x=>x.startsWith('f'+a+'.'))){const y='f'+b+'.'+x.slice(3);if(!PR[y])continue;const va=S.p[x],vb=S.p[y];setV(y,va);if(swap)setV(x,vb);}refreshAll();}
function filterReset(){for(const x of Object.keys(PR).filter(x=>/^f[12]\./.test(x)))setV(x,PR[x].d);refreshAll();}
function filterXY(){const pad=cv(380,150);let drag=false,which=0;pad.dataset.tip='Drag to set cutoff (left to right) and resonance (bottom to top) in one move. Pick which filter it moves.';
  const sg=h('div',{class:'seg tight'},['Filter 1','Filter 2','Both'].map((t,i)=>h('b',{text:t,class:i===0?'on':'',onclick:()=>{which=i;$$('b',sg).forEach((b,j)=>b.classList.toggle('on',j===i));}})));
  const fromPtr=e=>{const r=pad.getBoundingClientRect(),x=clamp((e.clientX-r.left)/r.width,0,1),y=clamp(1-(e.clientY-r.top)/r.height,0,1);const cut=20*Math.pow(1000,x);for(const f of which===2?[1,2]:[which+1]){setV('f'+f+'.cut',cut);setV('f'+f+'.res',y);}};
  pad.addEventListener('pointerdown',e=>{drag=true;pad.setPointerCapture(e.pointerId);fromPtr(e);});pad.addEventListener('pointermove',e=>{if(drag)fromPtr(e);});pad.addEventListener('pointerup',()=>drag=false);
  pad.draw=()=>{const g=pad.g,W=pad.W,H=pad.H;g.clearRect(0,0,W,H);g.fillStyle=cssv('--disp');g.fillRect(0,0,W,H);g.strokeStyle=cssv('--grid');g.fillStyle=cssv('--dim');g.font='9px JetBrains Mono,monospace';
    for(const f of [100,1000,10000]){const x=Math.log(f/20)/Math.log(1000)*W;g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();g.fillText(fmtHz(f),x+3,H-3);}
    for(const r of [.25,.5,.75]){const y=H-r*H;g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}g.fillText('Resonance',4,10);g.fillText('Cutoff',W-34,H-14);
    [[1,'--acc4'],[2,'--m1']].forEach(([f,c])=>{const x=Math.log(S.p['f'+f+'.cut']/20)/Math.log(1000)*W,y=H-S.p['f'+f+'.res']*H,on=S.p['f'+f+'.type']!==0;g.globalAlpha=on?1:.35;g.fillStyle=cssv(c);g.beginPath();g.arc(x,y,on?7:5,0,7);g.fill();g.fillStyle='#111';g.font='bold 9px JetBrains Mono,monospace';g.fillText(f,x-3,y+3);g.globalAlpha=1;});};
  animators.push({draw:()=>{if(S.page==='filter')pad.draw();}});
  const tools=h('div',{class:'row',style:'gap:4px;flex-wrap:wrap'},[['Copy 1 to 2',()=>filterCopy(1,2,false),'Copy every Filter 1 setting to Filter 2.'],['Copy 2 to 1',()=>filterCopy(2,1,false),'Copy every Filter 2 setting to Filter 1.'],['Swap',()=>filterCopy(1,2,true),'Swap Filter 1 and Filter 2.'],['Reset both',filterReset,'Put both filters back to their default values.']].map(x=>h('button',{class:'btn sm',text:x[0],'data-tip':x[2],onclick:x[1]})));
  return [h('div',{class:'row',style:'align-items:center;gap:6px'},[h('span',{class:'cap',text:'Cutoff and resonance pad'}),h('span',{class:'sp'}),sg]),pad,h('span',{class:'cap',text:'Tools'}),tools];}

/* Oscillator power button: round power icon, glows green when the oscillator is on, plain ON / OFF text next to it. */
function oscPower(key){
  const b=h('button',{class:'pwr','aria-label':'Oscillator on or off','data-tip':'Click to turn this oscillator on or off. Green: on. Red: off (silent, uses no CPU).',onclick:()=>setV(key,getV(key)?0:1)});
  const upd=()=>{if(!alive(b))return false;const on=!!getV(key);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');};
  bind(key,upd);upd();return b;}
