/* ---------- undo, redo, history ---------- */
var HIST={stack:[],pos:-1,t:null,label:'',busy:false,key:''};
function histState(){const st=presetState();st.frames={};for(const k in S.frames)st.frames[k]=S.frames[k].map(f=>Float32Array.from(f));return st;}
function histKey(st){let c=0;for(const k in st.frames)for(const f of st.frames[k])for(let i=0;i<f.length;i+=7)c+=f[i]*(i+1);return JSON.stringify([st.p,st.slots,st.chains,st.tabs,st.seq,st.draw,st.custom])+'|'+c.toFixed(4);}
function histMark(label){if(HIST.busy)return;HIST.label=label||'Change';clearTimeout(HIST.t);HIST.t=setTimeout(()=>histCommit(HIST.label),380);}
function histCommit(label){clearTimeout(HIST.t);if(HIST.busy)return;const st=histState(),key=histKey(st);if(key===HIST.key)return;
  HIST.stack.length=HIST.pos+1;HIST.stack.push({label,st,t:Date.now()});if(HIST.stack.length>60)HIST.stack.shift();HIST.pos=HIST.stack.length-1;HIST.key=key;histUI();}
function histApply(i){if(i<0||i>=HIST.stack.length)return;clearTimeout(HIST.t);const e=HIST.stack[i],st=e.st,keepHist=S.hist.slice();HIST.busy=true;
  try{loadState(st,S.name,S.pid);S.frames={};for(const k in st.frames){S.frames[k]=st.frames[k].map(f=>Float64Array.from(f));}
    for(let o=0;o<6;o++){const k='abcdef'[o];if(S.frames[k])pushFrames(o);}
    S.hist=keepHist;tableBinds.forEach(f=>f());}finally{HIST.busy=false;}
  HIST.pos=i;HIST.key=histKey(histState());histUI();toast((i<HIST.stack.length?'Restored: ':'')+e.label);}
function undo(){if(HIST.t){histCommit(HIST.label);}if(HIST.pos>0)histApply(HIST.pos-1);else toast('Nothing to undo');}
function redo(){if(HIST.pos<HIST.stack.length-1)histApply(HIST.pos+1);else toast('Nothing to redo');}
function histUI(){const u=$('#undobtn'),r=$('#redobtn');if(u)u.classList.toggle('dim',HIST.pos<=0);if(r)r.classList.toggle('dim',HIST.pos>=HIST.stack.length-1);}
function histDialog(){if(HIST.t)histCommit(HIST.label);const list=h('div',{class:'col',style:'min-width:360px;max-height:340px;overflow:hidden;gap:2px'});
  const n=HIST.stack.length,from=Math.max(0,n-12);
  for(let i=n-1;i>=from;i--){const e=HIST.stack[i],d=new Date(e.t);const hh=d.toTimeString().slice(0,8);
    list.appendChild(h('button',{class:'btn sm'+(i===HIST.pos?' on':''),style:'text-align:left;display:flex;gap:8px',onclick:()=>{histApply(i);closeDlg();histDialog();}},[h('span',{class:'mono',style:'width:62px;opacity:.7',text:hh}),h('span',{text:(i===HIST.pos?'> ':'')+e.label})]));}
  dialog('History',h('div',{class:'col',style:'gap:6px'},[h('span',{class:'cap',style:'text-transform:none;white-space:normal',text:'Newest first. Click a step to go back or forward to it. Ctrl+Z undoes, Ctrl+Shift+Z or Ctrl+Y redoes. Your next change after going back replaces the steps ahead.'}),list]),[['Close']]);}
addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey)return;const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return;const k=e.key.toLowerCase();
  if(k==='z'&&!e.shiftKey){e.preventDefault();undo();}else if((k==='z'&&e.shiftKey)||k==='y'){e.preventDefault();redo();}});
setTimeout(()=>{if(!HIST.stack.length)histCommit('Start');},900);
/* arrow keys step through any dropdown without opening it */
addEventListener('keydown',e=>{const t=e.target;if(!t||t.tagName!=='SELECT'||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;e.preventDefault();
  const d=e.key==='ArrowDown'?1:-1;let i=t.selectedIndex;do{i+=d;}while(i>=0&&i<t.options.length&&t.options[i].disabled);if(i<0||i>=t.options.length)return;t.selectedIndex=i;t.dispatchEvent(new Event('change',{bubbles:true}));},true);
