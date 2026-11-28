/* ===== preset browser: library, ratings, favorites, tags, editing, saving, random, generate ===== */
const META_K='ww_meta';
const FACT_DEFAULT={'Pulse Sweep Arp':{rating:5,fav:true},'Simple Wonder':{rating:5,fav:true,note:'Init with the wavetable at 26% (a little way from sine toward saw) and 3 unison voices. Simple, warm and wide. A good starting point for leads, pads and chords.'}};
function metaAll(){try{return JSON.parse(store.get(META_K)||'{}');}catch(e){return {};}}
function metaSave(m){store.set(META_K,JSON.stringify(m));}
function userPresets(){try{return JSON.parse(store.get('ww_user')||'[]');}catch(e){return [];}}
function saveUser(list){store.set('ww_user',JSON.stringify(list));}
function autoTags(f){const t=new Set(),p=f.p||{},ch=f.chains||{},all=Object.values(ch).flat().map(n=>n[0]);
  const has=x=>all.includes(x);
  if(p.vmode===1)t.add('Mono');if((p['a.uv']||1)>=5||has('image'))t.add('Wide');
  if((f.slots||[]).some(s=>/^l\d$/.test(s.s)&&/pos|w1a|w2a/.test(s.d)))t.add('Evolving');
  const c=p['f1.cut'];if(c!==undefined){if(c>4000)t.add('Bright');if(c<1500)t.add('Dark');}
  if(has('dist')||has('crush')||/Rawstyle|Dubstep|Hardstyle|Industrial/.test(f.genre))t.add('Aggressive');
  if((p['e1.a']||0)>200)t.add('Soft');if(f.type==='Pluck')t.add('Plucky');if(p['s.sub'])t.add('Sub');
  if(has('tgate')||f.type==='Arp')t.add('Rhythmic');if(has('verb'))t.add('Spacey');if(has('delay'))t.add('Echo');
  if(has('vowel')||/Vocal/.test(f.genre))t.add('Vocal');if(/Lo-Fi|Vintage/.test(f.genre+f.name))t.add('Lo-Fi');
  if(/Ambient|Cinematic/.test(f.genre))t.add('Cinematic');
  return [...t];}
function allPresets(){const M=metaAll();
  const fac=FACT.map((f,i)=>{const m=Object.assign({},FACT_DEFAULT[f.name]||{},M[f.id]||{});return {kind:'f',i,id:f.id,name:f.name,type:m.type||f.type,genre:m.genre||f.genre,tags:m.tags||autoTags(f),rating:m.rating||0,fav:!!m.fav,note:m.note||'',start:f.start,created:0};});
  const usr=userPresets().map((u,i)=>({kind:'u',i,id:'u'+i,name:u.name,type:u.type||'Lead',genre:u.genre||'My preset',tags:u.tags||[],rating:u.rating||0,fav:!!u.fav,note:u.note||'',start:false,created:u.created||0}));
  return fac.concat(usr);}
function setMeta(p,patch){if(!p)return;if(p.kind==='f'){const M=metaAll();M[p.id]=Object.assign(M[p.id]||{},patch);metaSave(M);}
  else{const l=userPresets();if(!l[p.i])return;Object.assign(l[p.i],patch);saveUser(l);}}
const PF={lib:'all',type:null,genre:null,tags:[],minr:0,q:'',sort:'name'};
function visiblePresets(){const q=PF.q.toLowerCase();let l=allPresets().filter(p=>{
    if(PF.lib==='fav'&&!p.fav)return false;if(PF.lib==='start'&&!p.start)return false;if(PF.lib==='user'&&p.kind!=='u')return false;if(PF.lib==='recent'&&!S.hist.includes(p.name))return false;
    if(PF.type&&p.type!==PF.type)return false;if(PF.genre&&p.genre!==PF.genre)return false;if(p.rating<PF.minr)return false;
    for(const t of PF.tags)if(!p.tags.includes(t))return false;
    return !q||(p.name+' '+p.type+' '+p.genre+' '+p.tags.join(' ')+' '+p.note).toLowerCase().includes(q);});
  const by={name:(a,b)=>a.name.localeCompare(b.name),rating:(a,b)=>b.rating-a.rating||a.name.localeCompare(b.name),cat:(a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name),genre:(a,b)=>a.genre.localeCompare(b.genre)||a.name.localeCompare(b.name),recent:(a,b)=>S.hist.indexOf(a.name)-S.hist.indexOf(b.name),newest:(a,b)=>b.created-a.created};
  if(PF.sort==='recent')l=l.filter(p=>S.hist.includes(p.name));
  return l.sort(by[PF.sort]||by.name);}
function curPreset(){return allPresets().find(p=>p.id===S.pid)||null;}
function isUser(){return S.pid&&S.pid[0]==='u';}
function loadPreset(p){if(p.kind==='f')loadFactory(p.i);else{const u=userPresets()[p.i];if(u)loadState(u.state,u.name,p.id);}refreshPresetUI();}
function stepPreset(d){const l=visiblePresets();if(!l.length)return;let i=l.findIndex(p=>p.name===S.name);i=(i+d+l.length)%l.length;loadPreset(l[i]);}
function randomPreset(){const l=visiblePresets();if(!l.length){toast('No presets match the filters');return;}loadPreset(l[Math.floor(Math.random()*l.length)]);}
function toggleFav(){const p=curPreset();if(!p){toast('Save this sound first, then you can favorite it');return;}setMeta(p,{fav:!p.fav});refreshPresetUI();toast(p.fav?'Removed from favorites':'Added to favorites');}
function updateFavBtn(){const b=$('#favbtn');if(!b)return;const p=curPreset();b.textContent=p&&p.fav?'♥':'♡';b.classList.toggle('on',!!(p&&p.fav));}
let buildPresetList=null,buildPresetSide=null,buildPresetDetail=null;
function refreshPresetUI(){updateFavBtn();buildPresetList&&buildPresetList();buildPresetSide&&buildPresetSide();buildPresetDetail&&buildPresetDetail();}
const COMMON_TAGS=['Bright','Dark','Warm','Wide','Mono','Soft','Aggressive','Evolving','Plucky','Sub','Rhythmic','Spacey','Echo','Vocal','Lo-Fi','Cinematic','Vintage','Digital','Metallic','Punchy','Clean','Gritty'];
function stars(val,onset,big){const w=h('span',{class:'stars'+(big?' big':'')});for(let i=1;i<=5;i++)w.appendChild(h('i',{class:i<=val?'on':'',text:i<=val?'★':'☆',onclick:e=>{e.stopPropagation();onset(val===i?0:i);}}));return w;}

/* ---------- save / edit dialogs ---------- */
function newUserEntry(name,type,genre,tags,note){return {name,type,genre,tags,note:note||'',rating:0,fav:false,created:Date.now(),state:presetState()};}
function savePresetDialog(){const cur=curPreset();const nm=h('input',{type:'text',class:'txt',value:S.name==='Init'?'My sound':S.name+' copy',style:'width:100%'}),
    ty=h('select',{class:'sel'},TYPES.slice(1).map(t=>h('option',{value:t,text:t}))),gn=h('input',{type:'text',class:'txt',list:'genrelist',value:cur?cur.genre:'My preset',style:'width:100%'}),
    tg=h('input',{type:'text',class:'txt',value:cur?cur.tags.join(', '):'',placeholder:'dark, wide, plucky',style:'width:100%'});
  if(cur)ty.value=cur.type;
  dialog('Save as a new preset',h('div',{class:'col'},[h('span',{class:'cap',text:'Name'}),nm,h('span',{class:'cap',text:'Category'}),ty,h('span',{class:'cap',text:'Genre'}),gn,h('span',{class:'cap',text:'Tags, separated by commas'}),tg]),
    [['Cancel'],['Save',()=>{const name=nm.value.trim()||'My sound';const l=userPresets();l.push(newUserEntry(name,ty.value,gn.value.trim()||'My preset',tg.value.split(',').map(x=>x.trim()).filter(Boolean)));saveUser(l);S.name=name;S.pid='u'+(l.length-1);$('#pname').textContent=name;refreshPresetUI();toast('Saved: '+name);},1]]);}
function overwriteUser(){if(!isUser()){savePresetDialog();return;}const l=userPresets(),i=+S.pid.slice(1);if(!l[i])return;l[i].state=presetState();saveUser(l);toast('Saved over "'+l[i].name+'"');}
function duplicatePreset(){const l=userPresets();const c=curPreset();const nm=S.name+' copy';l.push(newUserEntry(nm,c?c.type:'Lead',c?c.genre:'My preset',c?c.tags.slice():[],c?c.note:''));saveUser(l);S.name=nm;S.pid='u'+(l.length-1);$('#pname').textContent=nm;refreshPresetUI();toast('Duplicated');}
function deleteDialog(){if(!isUser()){toast('Factory presets cannot be deleted. They can be hidden by rating or tagging only.');return;}const l=userPresets(),i=+S.pid.slice(1);dialog('Delete preset',h('span',{text:'Delete "'+l[i].name+'"? This cannot be undone.'}),[['Cancel'],['Delete',()=>{l.splice(i,1);saveUser(l);S.pid=null;refreshPresetUI();toast('Deleted');},1]]);}
function exportDialog(){const c=curPreset();const txt=JSON.stringify({ww:1,name:S.name,type:c?c.type:'Lead',genre:c?c.genre:'',tags:c?c.tags:[],note:c?c.note:'',state:presetState()});const ta=h('textarea',{readonly:true});ta.value=txt;dialog('Export preset',h('div',{class:'col'},[h('span',{class:'cap',style:'white-space:normal;text-transform:none',text:'Select all and copy. Keep it in a text file to share or back up.'}),ta]),[['Copy',()=>{ta.select();try{document.execCommand('copy');toast('Copied');}catch(e){toast('Press Ctrl+C');}return false;},1],['Close']]);}
function importDialog(){const ta=h('textarea');dialog('Import preset',h('div',{class:'col'},[h('span',{class:'cap',style:'white-space:normal;text-transform:none',text:'Paste an exported preset here.'}),ta]),[['Cancel'],['Import',()=>{try{const o=JSON.parse(ta.value);if(!o.state||!o.state.p)throw 0;loadState(o.state,o.name||'Imported','imp');const l=userPresets();l.push({name:o.name||'Imported',type:o.type||'Lead',genre:o.genre||'Imported',tags:o.tags||[],note:o.note||'',rating:0,fav:false,created:Date.now(),state:o.state});saveUser(l);S.pid='u'+(l.length-1);refreshPresetUI();toast('Imported');}catch(e){toast('That is not a WhiskerWave preset');return false;}},1]]);}

/* ---------- randomize, mutate, generate ---------- */
const RG={osc:()=>['a','b','c','d','e','f'].filter(k=>S.p[k+'.on']).flatMap(k=>['pos','w1a','w2a','sw','sk','ud','ub','usp','ph','fb','ma'].map(x=>k+'.'+x)),
  filter:()=>['f1.cut','f1.res','f1.env','f1.drv','f1.kt'],env:()=>['e1.a','e1.d','e1.s','e1.r','e2.a','e2.d','e2.s','e2.r']};
const GEN={amt:.5,groups:{osc:true,filter:true,env:true,fx:false,mod:false},undo:null};
const GOODF=[2,3,14,15,16,21,22,8,9,23,29,30,43,44,45];
function snap(){GEN.undo={st:presetState(),name:S.name,pid:S.pid};}
function applyAfter(){reindex();markChains();syncAll();refreshAll();tableBinds.forEach(f=>f());renderFx();rebuildMatrix&&rebuildMatrix();updateFavBtn();}
function rndAround(k,amt){const sp=PR[k];if(!sp)return;let n=toN(sp,S.p[k]);n=clamp(n+(Math.random()*2-1)*amt,0,1);let v=fromN(sp,n);if(sp.k==='int'||sp.k==='list')v=Math.round(v);
  if(k==='e1.a'&&v>800&&S.p[k]<=800)v=800;if(k==='e1.r'&&v>3000&&S.p[k]<=3000)v=3000;if(k==='f1.cut'&&v<120)v=120;if(k==='f1.res'&&v>.85)v=.85;if(k==='e1.s'&&v<.05)v=.05;S.p[k]=v;}
function randomizeSound(mode){snap();const amt=mode==='mutate'?Math.min(GEN.amt,.35)*.6:GEN.amt;
  for(const g of ['osc','filter','env'])if(GEN.groups[g])for(const k of RG[g]())rndAround(k,amt);
  if(GEN.groups.filter&&amt>.45)S.p['f1.type']=GOODF[Math.floor(Math.random()*GOODF.length)];
  if(GEN.groups.osc&&amt>.55&&mode!=='mutate'){for(const o of [0,1]){if(S.p['abcdef'[o]+'.on']){loadTable(o,RECIPE_LIST[Math.floor(Math.random()*RECIPE_LIST.length)].name);}}}
  if(GEN.groups.fx&&mode!=='mutate'){const pool=['chorus','delay','verb','phaser','dist','crush','trem','flanger'];S.chains.t0=S.chains.t0.slice(0,1);const n=1+Math.floor(Math.random()*2);for(let i=0;i<n;i++)S.chains.t0.push(D.newNode(pool[Math.floor(Math.random()*pool.length)]));}
  if(GEN.groups.mod&&mode!=='mutate'){S.slots=S.slots.slice(0,6);const srcs=['l1','l2','l3','e3','wheel','vel'],dst=['a.pos','a.w1a','f1.cut','a.sw','a.ud','b.pos','a.w2a'];const n=1+Math.floor(Math.random()*3);for(let i=0;i<n;i++){const s=srcs[Math.floor(Math.random()*srcs.length)],d=dst[Math.floor(Math.random()*dst.length)];if(PR[d]&&!S.slots.some(x=>x.s===s&&x.d===d))S.slots.push({s,d,a:(Math.random()<.5?-1:1)*(.2+Math.random()*.5),u:0});}}
  S.pid=null;S.name=(mode==='mutate'?'Mutation':'Random')+' '+Math.floor(Math.random()*900+100);$('#pname').textContent=S.name;applyAfter();refreshPresetUI();toast(mode==='mutate'?'Mutated. Undo is in the Generate box':'Randomized');}
function undoGen(){if(!GEN.undo){toast('Nothing to undo');return;}const u=GEN.undo;GEN.undo=null;loadState(u.st,u.name,u.pid);refreshPresetUI();toast('Restored');}
const WORDCAT={lead:'Lead',leads:'Lead',pluck:'Pluck',plucks:'Pluck',stab:'Pluck',bass:'Bass',sub:'Bass',keys:'Keys',piano:'Keys',organ:'Keys',pad:'Pad',pads:'Pad',strings:'Pad',arp:'Arp',arpeggio:'Arp',fx:'FX',riser:'FX',impact:'FX',sweep:'FX'};
function generateFromText(txt){const w=txt.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);if(!w.length){toast('Describe the sound first, for example: dark wobble bass');return;}
  snap();let cat=null;for(const x of w)if(WORDCAT[x]){cat=WORDCAT[x];break;}
  const all=allPresets();const gw=all.filter(p=>w.some(x=>p.genre.toLowerCase().includes(x)||p.name.toLowerCase().includes(x)||p.tags.some(t=>t.toLowerCase()===x)));
  let pool=all.filter(p=>p.kind==='f'&&(!cat||p.type===cat));const pg=pool.filter(p=>gw.includes(p));if(pg.length)pool=pg;
  const base=pool[Math.floor(Math.random()*pool.length)]||all[0];loadFactory(base.i);
  const mul=(k,f,lo,hi)=>{S.p[k]=clamp(S.p[k]*f,lo,hi);};const has=x=>w.includes(x);
  if(has('dark')||has('deep')||has('dull'))mul('f1.cut',.4,60,20000);
  if(has('bright')||has('airy')||has('shiny'))mul('f1.cut',2.4,60,18000);
  if(has('warm')){S.p['f1.type']=FT_('Warm Diode');mul('f1.cut',.8,60,20000);}
  if(has('soft')||has('smooth')||has('slow')||has('gentle')){S.p['e1.a']=Math.max(S.p['e1.a'],140);S.p['e1.r']=Math.max(S.p['e1.r'],700);}
  if(has('hard')||has('aggressive')||has('angry')||has('harsh')||has('growl')||has('dirty')){S.chains.t0.push(D.newNode('dist',{drive:12}));S.p['f1.res']=Math.min(.8,S.p['f1.res']+.15);}
  if(has('wobble')||has('wub')||has('dubstep')){S.slots.push({s:'l1',d:'f1.cut',a:.6,u:0});S.p['l1.rate']=2.6;S.p['l1.sync']=0;S.p['f1.res']=Math.max(S.p['f1.res'],.35);}
  if(has('acid')||has('squelch')){S.p['f1.type']=FT_('Acid 18');S.p['f1.res']=.75;S.p['f1.env']=Math.max(S.p['f1.env'],.55);}
  if(has('wide')||has('huge')||has('big')||has('thick')){S.p['a.uv']=Math.max(S.p['a.uv'],6);S.p['a.ud']=Math.max(S.p['a.ud'],.35);S.p['a.us']=1;S.chains.t0.push(D.newNode('image',{width:1.5}));}
  if(has('mono')||has('solo'))S.p.vmode=1;
  if(has('evolving')||has('moving')||has('morph')||has('morphing')){S.slots.push({s:'l3',d:'a.pos',a:.5,u:0});S.p['l3.rate']=.15;}
  if(has('vowel')||has('vocal')||has('choir')||has('voice'))S.p['f1.type']=FT_('Vowel AEIOU');
  if(has('lofi')||has('crunchy')||has('crushed'))S.chains.t0.push(D.newNode('crush'));
  if(has('space')||has('spacey')||has('ambient')||has('huge')||has('reverb'))S.chains.t0.push(D.newNode('verb',{mix:.35}));
  if(has('delay')||has('echo'))S.chains.t0.push(D.newNode('delay'));
  if(has('sub'))S.p['s.sub']=1;if(has('noisy')||has('breath')||has('air')){S.p['s.nz']=1;S.p['s.nl']=.25;}
  for(const x of w){const r=RECIPE_LIST.find(n=>n.name.toLowerCase().includes(x)&&x.length>3&&!WORDCAT[x]);if(r){loadTable(0,r.name);break;}}
  const nm=w.map(x=>x[0].toUpperCase()+x.slice(1)).join(' ').slice(0,28);S.pid=null;S.name=nm;$('#pname').textContent=nm;applyAfter();refreshPresetUI();toast('Generated "'+nm+'" from '+base.name+'. Save it if you like it.');}

/* ---------- page ---------- */
function presetsPage(){const pg=h('div',{class:'page','data-page':'presets',style:'flex-direction:row;gap:8px'});
  const side=h('div',{class:'pn pside'}),mid=h('div',{class:'pn',style:'flex:1;min-width:0'}),right=h('div',{class:'pn pdet'});
  const dl=h('datalist',{id:'genrelist'});
  /* sidebar */
  buildPresetSide=()=>{if(!alive(side))return false;side.innerHTML='';const all=allPresets();
    const lib=[['all','All presets',all.length],['fav','Favorites',all.filter(p=>p.fav).length],['start','Start here',all.filter(p=>p.start).length],['recent','Recent',S.hist.length],['user','My presets',all.filter(p=>p.kind==='u').length]];
    side.append(h('h3',{text:'LIBRARY'}));for(const [id,lb,n] of lib)side.append(h('div',{class:'pli'+(PF.lib===id?' on':''),onclick:()=>{PF.lib=id;refreshPresetUI();}},[h('span',{text:(id==='fav'?'♥ ':'')+lb}),h('b',{text:n})]));
    const cnt=(f)=>{const m={};for(const p of all)for(const v of [].concat(f(p)))m[v]=(m[v]||0)+1;return Object.entries(m).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));};
    side.append(h('h3',{text:'CATEGORY'}),h('div',{class:'row w',style:'gap:3px'},cnt(p=>p.type).map(([v,n])=>h('span',{class:'pbchip'+(PF.type===v?' on':''),text:v+' '+n,onclick:()=>{PF.type=PF.type===v?null:v;refreshPresetUI();}}))));
    side.append(h('h3',{text:'GENRE'}),h('div',{class:'row w',style:'gap:3px'},cnt(p=>p.genre).slice(0,14).map(([v,n])=>h('span',{class:'pbchip'+(PF.genre===v?' on':''),text:v+' '+n,onclick:()=>{PF.genre=PF.genre===v?null:v;refreshPresetUI();}}))));
    side.append(h('h3',{text:'TAGS'}),h('div',{class:'row w',style:'gap:3px'},cnt(p=>p.tags).slice(0,16).map(([v,n])=>h('span',{class:'pbchip'+(PF.tags.includes(v)?' on':''),text:v+' '+n,onclick:()=>{PF.tags=PF.tags.includes(v)?PF.tags.filter(x=>x!==v):PF.tags.concat(v);refreshPresetUI();}}))));
    side.append(h('h3',{text:'MIN RATING'}),h('div',{class:'row',style:'align-items:center'},[stars(PF.minr,v=>{PF.minr=v;refreshPresetUI();}),h('span',{class:'cap',text:PF.minr?PF.minr+'+':'any'})]),
      h('span',{class:'chip sm',style:'margin-top:4px',text:'Clear filters',onclick:()=>{Object.assign(PF,{lib:'all',type:null,genre:null,tags:[],minr:0,q:''});q.value='';refreshPresetUI();}}));
    dl.innerHTML='';for(const [v] of cnt(p=>p.genre))dl.appendChild(h('option',{value:v}));};
  /* list */
  const q=h('input',{type:'text',class:'txt',placeholder:'Search name, genre, tag or note',style:'width:230px'});q.oninput=()=>{PF.q=q.value;buildPresetList();};
  const sortS=h('select',{class:'sel'},[['name','Sort: Name'],['rating','Sort: Rating'],['cat','Sort: Category'],['genre','Sort: Genre'],['recent','Sort: Recently used'],['newest','Sort: Newest saved']].map(x=>h('option',{value:x[0],text:x[1]})));sortS.onchange=()=>{PF.sort=sortS.value;buildPresetList();};
  const count=h('span',{class:'cap',style:'margin-left:auto'});const list=h('div',{class:'plist'});
  buildPresetList=()=>{if(!alive(list))return false;list.innerHTML='';const l=visiblePresets();count.textContent=l.length+' preset'+(l.length===1?'':'s');
    for(const p of l)list.appendChild(h('div',{class:'prow'+(p.id===S.pid?' on':''),onclick:()=>loadPreset(p)},[
      h('span',{class:'hrt'+(p.fav?' on':''),text:p.fav?'♥':'♡','data-tip':'Favorite',onclick:e=>{e.stopPropagation();setMeta(p,{fav:!p.fav});refreshPresetUI();}}),
      h('b',{class:'pn1',text:p.name}),h('span',{class:'pc',text:p.type}),h('span',{class:'pg',text:p.genre}),
      h('span',{class:'ptags'},p.tags.slice(0,3).map(t=>h('i',{text:t}))),
      stars(p.rating,v=>{setMeta(p,{rating:v});refreshPresetUI();})]));
    if(!l.length)list.appendChild(h('div',{class:'cap',style:'padding:20px;text-align:center',text:'Nothing matches. Clear a filter or try Generate on the right.'}));};
  mid.append(h('h3',{text:'PRESETS'}),h('div',{class:'row',style:'align-items:center;gap:8px'},[q,sortS,h('button',{class:'btn sm on',text:'Popup browser','data-tip':'The big browser with type and genre filters and history.',onclick:()=>presetBrowser()}),h('button',{class:'btn sm',text:'Random preset','data-tip':'Loads a random preset from the list as filtered now.',onclick:randomPreset}),count]),list);
  /* details and edit */
  buildPresetDetail=()=>{if(!alive(right))return false;right.innerHTML='';const p=curPreset();
    right.append(h('h3',{text:'DETAILS'}));
    if(!p){right.append(h('span',{class:'cap',style:'white-space:normal;text-transform:none',text:'"'+S.name+'" is not saved yet. Save it to give it a category, genre, tags, rating and notes.'}),h('div',{class:'row'},[h('button',{class:'btn on',text:'Save as new',onclick:savePresetDialog})]));}
    else{const nm=h('input',{type:'text',class:'txt',value:p.name,style:'width:100%',readonly:p.kind==='f'});
      if(p.kind==='u')nm.onchange=()=>{const v=nm.value.trim();if(v){setMeta(p,{name:v});S.name=v;$('#pname').textContent=v;buildPresetList();}};
      const ty=h('select',{class:'sel',style:'flex:1'},TYPES.slice(1).map(t=>h('option',{value:t,text:t})));ty.value=p.type;ty.onchange=()=>{setMeta(p,{type:ty.value});refreshPresetUI();};
      const gn=h('input',{type:'text',class:'txt',list:'genrelist',value:p.genre,style:'flex:1;min-width:0'});gn.onchange=()=>{setMeta(p,{genre:gn.value.trim()||p.genre});refreshPresetUI();};
      const tags=h('div',{class:'row w',style:'gap:3px'},p.tags.map(t=>h('span',{class:'chip sm on',text:t+' ×',onclick:()=>{setMeta(p,{tags:p.tags.filter(x=>x!==t)});refreshPresetUI();}})));
      const ti=h('input',{type:'text',class:'txt',list:'taglist',placeholder:'Add a tag, press Enter',style:'width:100%'});ti.onkeydown=e=>{if(e.key==='Enter'){const v=ti.value.trim();if(v&&!p.tags.includes(v)){setMeta(p,{tags:p.tags.concat(v[0].toUpperCase()+v.slice(1))});refreshPresetUI();}}e.stopPropagation();};
      const tl=h('datalist',{id:'taglist'},COMMON_TAGS.map(t=>h('option',{value:t})));
      const note=h('textarea',{class:'txt',placeholder:'Notes: what it is for, how to play it',style:'width:100%;height:46px;resize:none'});note.value=p.note;note.onchange=()=>setMeta(p,{note:note.value});note.onkeydown=e=>e.stopPropagation();
      right.append(nm,h('div',{class:'row',style:'gap:4px'},[ty,gn]),h('div',{class:'row',style:'align-items:center;gap:8px'},[stars(p.rating,v=>{setMeta(p,{rating:v});refreshPresetUI();},true),h('span',{class:'hrt big'+(p.fav?' on':''),text:p.fav?'♥':'♡',onclick:toggleFav})]),tags,ti,tl,note,
        h('div',{class:'row w',style:'gap:4px'},[h('button',{class:'btn sm on',text:isUser()?'Save sound':'Save as new','data-tip':isUser()?'Overwrite this preset with the sound as it is now.':'Factory presets stay untouched. This saves your version as a new preset.',onclick:overwriteUser}),
          ...(isUser()?[h('button',{class:'btn sm',text:'Save as new',onclick:savePresetDialog})]:[]),h('button',{class:'btn sm',text:'Duplicate',onclick:duplicatePreset}),h('button',{class:'btn sm',text:'Delete',onclick:deleteDialog}),h('button',{class:'btn sm',text:'Export',onclick:exportDialog}),h('button',{class:'btn sm',text:'Import',onclick:importDialog})]));}
    /* generate */
    const amtV=h('span',{class:'mono',text:Math.round(GEN.amt*100)+'%',style:'width:36px'});const rg=h('input',{type:'range',class:'rg',min:5,max:100,value:Math.round(GEN.amt*100),style:'flex:1'});rg.oninput=()=>{GEN.amt=rg.value/100;amtV.textContent=rg.value+'%';};
    const gb=['osc','filter','env','fx','mod'].map(g=>h('button',{class:'btn sm'+(GEN.groups[g]?' on':''),text:{osc:'Oscillators',filter:'Filter',env:'Envelope',fx:'FX',mod:'Modulation'}[g],'data-tip':'Include this section when randomizing.',onclick:function(){GEN.groups[g]=!GEN.groups[g];this.classList.toggle('on',GEN.groups[g]);}}));
    const txt=h('input',{type:'text',class:'txt',placeholder:'Describe it: dark wobble bass',style:'flex:1;min-width:0'});txt.onkeydown=e=>{if(e.key==='Enter')generateFromText(txt.value);e.stopPropagation();};
    right.append(h('h3',{text:'GENERATE',style:'margin-top:6px'}),h('div',{class:'row',style:'align-items:center;gap:6px'},[h('span',{class:'cap',text:'Amount'}),rg,amtV]),h('div',{class:'row w',style:'gap:3px'},gb),
      h('div',{class:'row w',style:'gap:4px'},[h('button',{class:'btn sm on',text:'Randomize','data-tip':'New random sound from the chosen sections. The amount sets how far it travels from the current sound.',onclick:()=>randomizeSound('random')}),h('button',{class:'btn sm',text:'Mutate','data-tip':'Small random changes to the current sound, to find a variation.',onclick:()=>randomizeSound('mutate')}),h('button',{class:'btn sm',text:'Undo',onclick:undoGen})]),
      h('div',{class:'row',style:'gap:4px'},[txt,h('button',{class:'btn sm on',text:'Generate','data-tip':'Builds a sound from words: a category (lead, pluck, bass, keys, pad, arp, fx), a genre, and moods like dark, bright, warm, wide, mono, wobble, acid, growl, evolving, vowel, lofi, spacey.',onclick:()=>generateFromText(txt.value)})]));};
  pg.append(side,mid,right,dl);refreshPresetUI();return pg;}
PAGES.presets=presetsPage;
