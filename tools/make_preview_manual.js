// Builds docs/preview/WhiskerWave_Preview_Manual.pdf and page screenshots from the playable mockup itself.
// Usage: node tools/make_preview_manual.js <path to WhiskerWave.html> <version>
// Needs Playwright with Chromium (npm i playwright; npx playwright install chromium).
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const src=path.resolve(process.argv[2]||'docs/mockup/index.html'),ver=process.argv[3]||'dev';
const out=path.resolve('docs/preview');fs.mkdirSync(out,{recursive:true});
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1500,height:950}});
 await p.goto('file://'+src);await p.waitForTimeout(1200);
 const pages=await p.evaluate(()=>PAGELIST);
 // guide text, straight from the page's own Guide dialog
 const guide=await p.evaluate(()=>{guideDialog();const li=[...document.querySelectorAll('.dlg li, dialog li, li')].map(x=>x.textContent.trim()).filter(Boolean);document.querySelectorAll('.dlg,.dialog,.modal').forEach(x=>x.remove());return li;});
 await p.keyboard.press('Escape');await p.waitForTimeout(200);
 const sections=[];
 for(const [id,label] of pages){await p.evaluate(i=>showPage(i),id);await p.waitForTimeout(500);
  const png='page-'+id+'.png';await p.screenshot({path:path.join(out,png)});
  const ctr=await p.evaluate(i=>{const pg=document.querySelector('.page[data-page="'+i+'"]');const seen=new Set(),rows=[];
   for(const el of [...(pg||document).querySelectorAll('[data-tip]')]){const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
    const tip=el.getAttribute('data-tip')||'';let lab='';const l=el.querySelector(':scope>.l');
    if(l)lab=l.textContent;else if(el.tagName==='SELECT'){const pv=el.previousElementSibling;lab=pv&&pv.textContent.trim().length<24?pv.textContent:'Menu: '+(el.selectedOptions[0]||{}).textContent;}
    else lab=el.getAttribute('aria-label')||el.getAttribute('title')||[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('')||el.textContent||'';
    lab=lab.trim().replace(/\s+/g,' ').slice(0,40);if(!lab)lab=el.classList.contains('pwr')?'Power':'Button';
    const k=lab+'|'+tip;if(!tip||seen.has(k))continue;seen.add(k);rows.push([lab,tip]);}
   return rows;},id);
  sections.push({id,label,png,ctr});}
 // header bar controls
 const head=await p.evaluate(()=>{const hd=document.querySelector('#hdr,header,.hdr,#top');if(!hd)return [];const rows=[],seen=new Set();for(const el of hd.querySelectorAll('[data-tip]')){const t=el.getAttribute('data-tip');if(seen.has(t))continue;seen.add(t);rows.push([(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,40),t]);}return rows;});
 const css=`body{font:11pt/1.45 'Barlow Condensed',Arial,sans-serif;color:#1b1b2e;margin:0}h1{font-size:30pt;margin:0 0 6px;color:#161638}h2{font-size:17pt;color:#0b7f6b;margin:18px 0 6px;page-break-after:avoid}
 .pg{page-break-before:always}img{width:100%;border:1px solid #ccd;border-radius:6px}table{border-collapse:collapse;width:100%;font-size:9.5pt}td{border-bottom:1px solid #e3e3ee;padding:3px 6px;vertical-align:top}td:first-child{width:24%;font-weight:600}
 .note{background:#fff4e0;border-left:4px solid #FFA600;padding:8px 10px;margin:10px 0}.cover{padding-top:40px}`;
 let h=`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="cover"><h1>WhiskerWave ${esc(ver)}</h1><p><b>Studio 87.</b> Free and open source wavetable synth. This manual covers the <b>playable preview</b>: the interactive design mockup that runs in a web browser.</p>
 <div class="note">This is a preview, not the VST3 plugin. The plugin build follows when the C++ port of this exact design is done. The preview runs fully offline and sends nothing anywhere.</div>
 <h2>Quick start</h2><ol><li>Open <b>WhiskerWave.html</b> in Chrome, Edge or Firefox (Linux, macOS or Windows).</li><li>Click anywhere once: browsers only start audio after a click.</li><li>Play with the mouse on the on-screen keys or with your computer keyboard (see the guide below).</li><li>Pick sounds on the PRESETS page; your own presets are saved in this browser only.</li></ol>
 <h2>Guide (from the page itself)</h2><ul>${guide.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
 <h2>Honest limits</h2><ul><li>The sound has been checked with measurements, not by ear yet. Presets are starting points.</li><li>A browser is slower than a native plugin: at high voice counts with many oscillators and unison voices it can crackle. Lower Voices if it does.</li><li>Presets you save live in this browser on this computer. Use Export in the preset browser to keep a copy.</li></ul>`;
 if(head.length)h+=`<h2>Header bar</h2><table>${head.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>`;
 h+='</div>';
 for(const s of sections){h+=`<div class="pg"><h2>${esc(s.label)}</h2><img src="${s.png}"><table>${s.ctr.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table></div>`;}
 h+='</body></html>';fs.writeFileSync(path.join(out,'manual.html'),h);
 const q=await b.newPage();await q.goto('file://'+path.join(out,'manual.html'));await q.waitForTimeout(500);
 await q.pdf({path:path.join(out,'WhiskerWave_Preview_Manual.pdf'),format:'A4',margin:{top:'14mm',bottom:'14mm',left:'14mm',right:'14mm'},printBackground:true});
 console.log('pages',sections.length,'controls',sections.reduce((a,s)=>a+s.ctr.length,0),'guide items',guide.length,'header',head.length);await b.close();})();
