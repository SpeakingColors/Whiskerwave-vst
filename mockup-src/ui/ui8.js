/* ---------- shared popup browser (search, chips, favorites, history) used by the preset and FX browsers ---------- */
function browserPopup(c){
  const st={q:'',f:{},fav:false,more:{}};const d=$('#dlg');d.innerHTML='';
  const list=h('div',{class:'pbl'}),right=h('div',{class:'pbrt'}),cnt=h('span',{class:'cap',style:'font-size:12px'});
  const q=h('input',{type:'text',class:'pbq',placeholder:c.placeholder||'name, type, genre or tag',spellcheck:'false'});
  let vis=[];
  const close=()=>{d.classList.remove('on');document.removeEventListener('keydown',esc,true);};
  const esc=e=>{if(e.key==='Escape'&&d.classList.contains('on')){close();e.stopPropagation();}};
  const match=it=>{
    if(st.q){const t=(it.name+' '+(it.sub||'')+' '+Object.values(it.cats||{}).join(' ')+' '+(it.tags||[]).join(' ')).toLowerCase();for(const w of st.q.toLowerCase().split(/\s+/).filter(Boolean))if(!t.includes(w))return false;}
    for(const k in st.f)if(st.f[k]!=null&&![].concat((it.cats||{})[k]||[]).includes(st.f[k]))return false;
    if(st.fav&&!it.fav)return false;return true;};
  const row=it=>{const r=h('div',{class:'pbr'+(it.sel&&it.sel()?' on':''),onclick:()=>{c.pick(it);redraw();}},[]);if(it.tip)r.setAttribute('data-tip',it.tip);
    if(c.setFav)r.appendChild(h('span',{class:'hrt'+(it.fav?' on':''),text:it.fav?'♥':'♡','data-tip':'Favorite',onclick:e=>{e.stopPropagation();c.setFav(it,!it.fav);redraw();}}));
    r.appendChild(h('span',{class:'pbn'},[h('b',{text:it.name}),it.sub?h('i',{text:it.sub}):null].filter(Boolean)));
    if(it.tag)r.appendChild(h('span',{class:'pbt',text:it.tag}));
    if(it.del)r.appendChild(h('span',{class:'pbx',text:'x','data-tip':'Delete this saved preset.',onclick:e=>{e.stopPropagation();it.del();redraw();}}));
    return r;};
  const drawList=()=>{const sc=list.scrollTop;list.innerHTML='';const all=c.items();vis=all.filter(match);cnt.textContent=vis.length+' '+(c.noun||'sounds');
    let g=null;for(const it of vis){if(it.group!==g){g=it.group;list.appendChild(h('div',{class:'pbg',text:g}));}list.appendChild(row(it));}
    if(!vis.length)list.appendChild(h('div',{class:'cap',style:'padding:24px;text-align:center;white-space:normal',text:'Nothing matches. Clear the search or a filter.'}));
    list.scrollTop=sc;return all;};
  const chip=(label,on,fn)=>h('span',{class:'pbchip'+(on?' on':''),text:label,onclick:fn});
  const drawRight=all=>{right.innerHTML='';
    right.append(h('div',{},[h('div',{class:'pbcap',text:'SEARCH'}),q]));
    for(const r of (c.rows||[])){const m={};for(const it of all)for(const v of [].concat((it.cats||{})[r.key]||[]))m[v]=(m[v]||0)+1;
      let vals=Object.keys(m).sort((a,b)=>r.order?(r.order.indexOf(a)<0?99:r.order.indexOf(a))-(r.order.indexOf(b)<0?99:r.order.indexOf(b)):m[b]-m[a]||a.localeCompare(b));
      if(!r.fav&&(!vals.length||(vals.length<2&&!r.always)))continue;const lim=r.max||99,ex=st.more[r.key];const shown=ex?vals:vals.slice(0,lim);
      const chips=shown.map(v=>chip(v,st.f[r.key]===v,()=>{st.f[r.key]=st.f[r.key]===v?null:v;redraw();}));
      if(r.fav&&c.setFav)chips.unshift(chip('♥ Favorites',st.fav,()=>{st.fav=!st.fav;redraw();}));
      if(vals.length>lim)chips.push(chip(ex?'Less':'+'+(vals.length-lim)+' more',false,()=>{st.more[r.key]=!ex;redraw();}));
      right.append(h('div',{},[h('div',{class:'pbcap',text:r.label}),h('div',{class:'pbchips'},chips)]));}
    if(!(c.rows||[]).length&&c.setFav)right.append(h('div',{class:'pbchips'},[chip('♥ Favorites',st.fav,()=>{st.fav=!st.fav;redraw();})]));
    const hs=c.history?c.history():[];if(hs.length)right.append(h('div',{},[h('div',{class:'pbcap',text:'HISTORY (CLICK TO GO BACK)'}),h('div',{class:'pbchips'},hs.map(n=>chip(n,false,()=>{c.histPick(n);redraw();})))]));
    if(c.hint)right.append(h('div',{class:'pbhint',text:c.hint}));
    if(c.extra)right.append(c.extra);};
  const redraw=()=>{const all=drawList();drawRight(all);q.value=st.q;if(document.activeElement!==q&&c.keepFocus!==false)q.focus();};
  q.oninput=()=>{st.q=q.value;const pos=q.selectionStart;const all=drawList();cnt.textContent=cnt.textContent;};
  q.onkeydown=e=>{e.stopPropagation();
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!vis.length)return;let i=vis.findIndex(x=>x.sel&&x.sel());i=e.key==='ArrowDown'?Math.min(vis.length-1,i+1):Math.max(0,i<0?0:i-1);c.pick(vis[i]);drawList();const on=list.querySelector('.pbr.on');if(on)on.scrollIntoView({block:'nearest'});}
    else if(e.key==='Enter')close();};
  const foot=h('div',{class:'pbf'},[cnt,h('span',{class:'sp'}),...(c.footer||[]),h('button',{class:'btn on',text:'Close',onclick:close})]);
  const box=h('div',{class:'pbox'},[h('div',{class:'pbh'},[h('h2',{text:c.title})]),h('div',{class:'pbbody'},[list,right]),foot]);
  d.appendChild(box);d.classList.add('on');d.onclick=e=>{if(e.target===d)close();};document.addEventListener('keydown',esc,true);
  c.redraw=redraw;redraw();setTimeout(()=>{q.focus();const on=list.querySelector('.pbr.on');if(on)on.scrollIntoView({block:'center'});},30);return c;}

/* main preset browser */
let presetPop=null;
function presetBrowser(){
  const TS=['Lead','Pluck','Bass','Keys','Pad','Arp','FX'];
  presetPop=browserPopup({title:'Preset browser',noun:'sounds',placeholder:'name, type, genre or tag',
    hint:'Click a sound to load it, use the arrow keys to step through the list, Enter to close. ♥ marks your favorites. Save, rate, tag and delete live on the Presets tab.',
    items:()=>{const all=allPresets();const out=[];const mk=(p,group)=>({id:p.id,name:p.name,tag:p.type,group,fav:p.fav,sel:()=>p.id===S.pid||(!S.pid&&p.name===S.name),tip:p.note||'',cats:{Type:[p.type],Genre:[p.genre],Show:[p.kind==='u'?'My presets':'Factory']},tags:p.tags,p});
      for(const p of all.filter(x=>x.start).sort((a,b)=>a.name.localeCompare(b.name)))out.push(mk(p,'START HERE'));
      for(const t of TS)for(const p of all.filter(x=>x.type===t&&!x.start).sort((a,b)=>a.name.localeCompare(b.name)))out.push(mk(p,t==='FX'?'FX':t.toUpperCase()+'S'));
      for(const p of all.filter(x=>!x.start&&!TS.includes(x.type)))out.push(mk(p,'OTHER'));
      const mine=all.filter(x=>x.kind==='u').sort((a,b)=>a.name.localeCompare(b.name));for(const p of mine){const i=out.findIndex(o=>o.p===p);if(i>=0)out.splice(i,1);}for(const p of mine)out.unshift(mk(p,'MY PRESETS'));
      return out;},
    rows:[{key:'Type',label:'TYPE',order:TS},{key:'Genre',label:'GENRE',max:14,fav:false},{key:'Show',label:'SHOW',fav:true}],
    pick:it=>loadPreset(it.p),setFav:(it,v)=>{setMeta(it.p,{fav:v});refreshPresetUI();},
    history:()=>S.hist.slice(0,8),histPick:n=>{const p=allPresets().find(x=>x.name===n);if(p)loadPreset(p);},
    footer:[h('button',{class:'btn',text:'Save current','data-tip':'Opens the save box for the sound as it is now.',onclick:()=>{closeDlg();savePresetDialog();}}),h('button',{class:'btn',text:'Library tab','data-tip':'Rate, tag, edit, import and export presets.',onclick:()=>{closeDlg();showPage('presets');}})]});}

/* FX browsers */
const FXU_FAV='whiskerwave.fxfavs.v1',FXU_HIST='whiskerwave.fxhist.v1';
const fxFavGet=k=>!!fxUserGet(FXU_FAV)[k];
function fxFavSet(k,v){const f=fxUserGet(FXU_FAV);if(v)f[k]=1;else delete f[k];fxUserSet(FXU_FAV,f);}
function fxHistGet(s){return (fxUserGet(FXU_HIST)[s]||[]).slice(0,8);}
function fxHistAdd(s,n){const h2=fxUserGet(FXU_HIST);h2[s]=[n].concat((h2[s]||[]).filter(x=>x!==n)).slice(0,8);fxUserSet(FXU_HIST,h2);}
let fxLast='';
function fxBrowser(){
  const specOf=n=>{for(const c in FXCHAINS)if(FXCHAINS[c][n])return FXCHAINS[c][n];const u=fxUserGet(FXU_CH);return u[n];};
  browserPopup({title:'FX presets',noun:'chains',placeholder:'name, category or what it does',
    hint:'Whole effect setups. Loading one replaces every chain (the undo button works). For one effect only, use the Presets button on that effect.',
    items:()=>{const out=[];const u=fxUserGet(FXU_CH);for(const nm in u)out.push({name:nm,sub:u[nm].d||'Your saved chain.',group:'MY CHAINS',cats:{Category:['My chains']},fav:fxFavGet('c:'+nm),sel:()=>fxLast===nm,del:()=>{const x=fxUserGet(FXU_CH);delete x[nm];fxUserSet(FXU_CH,x);}});
      for(const cat in FXCHAINS)for(const nm in FXCHAINS[cat])out.push({name:nm,sub:FXCHAINS[cat][nm].d,group:cat.toUpperCase(),cats:{Category:[cat]},fav:fxFavGet('c:'+nm),sel:()=>fxLast===nm,tip:FXCHAINS[cat][nm].d});return out;},
    rows:[{key:'Category',label:'CATEGORY',fav:true,max:12}],
    pick:it=>{fxLast=it.name;applyFxChain(it.name,specOf(it.name));fxHistAdd('chains',it.name);},
    setFav:(it,v)=>fxFavSet('c:'+it.name,v),history:()=>fxHistGet('chains'),histPick:n=>{fxLast=n;applyFxChain(n,specOf(n));},
    footer:[h('button',{class:'btn','data-tip':'Save every chain and the mixer sends as a new preset in this browser.',text:'+ Save current',onclick:()=>askName('Name for this FX chain','My chain',nm=>{const u=fxUserGet(FXU_CH);const p={};for(const b of ['t0','t1','t2','t3'])for(const s of ['s1','s2'])p['bus.'+b+'.'+s]=S.p['bus.'+b+'.'+s];u[nm]=Object.assign(JSON.parse(JSON.stringify(S.chains)),{p,d:'Saved '+new Date().toLocaleDateString()});fxUserSet(FXU_CH,u);fxBrowser();})})]});}
function fxModBrowser(n){const t=n.type,name=FXDEF[t].name;
  const load=p=>{const d=FXDEF[t];const np={};for(const s of d.order)np[s.key]=s.d;Object.assign(np,p);n.p=np;chainChanged();};
  const user=()=>fxUserGet(FXU_MOD)[t]||{};let last='';
  const find=nm=>{const f=(FXMOD[t]||[]).find(e=>e[0]===nm);return f?f[1]:user()[nm];};
  browserPopup({title:name+' presets',noun:'presets',placeholder:'search '+name+' presets',
    hint:'Loads into this '+name+'; modulation routes stay. Save your own with + Save current.',
    items:()=>{const out=[];const u=user();for(const nm in u)out.push({name:nm,group:'MY PRESETS',fav:fxFavGet('m:'+t+':'+nm),sel:()=>last===nm,del:()=>{const a=fxUserGet(FXU_MOD);delete a[t][nm];fxUserSet(FXU_MOD,a);}});
      for(const e of (FXMOD[t]||[]))out.push({name:e[0],sub:e[2]||'',group:'FACTORY',fav:fxFavGet('m:'+t+':'+e[0]),sel:()=>last===e[0],tip:e[2]||e[0]});return out;},
    rows:[],pick:it=>{last=it.name;load(find(it.name));fxHistAdd('m:'+t,it.name);},setFav:(it,v)=>fxFavSet('m:'+t+':'+it.name,v),
    history:()=>fxHistGet('m:'+t),histPick:nm=>{last=nm;load(find(nm));},
    footer:[h('button',{class:'btn','data-tip':'Save the current settings of this effect as your own preset.',text:'+ Save current',onclick:()=>askName('Name for this '+name+' preset','My '+name,nm=>{const all=fxUserGet(FXU_MOD);(all[t]=all[t]||{})[nm]=Object.assign({},n.p);fxUserSet(FXU_MOD,all);fxModBrowser(n);})})]});}
