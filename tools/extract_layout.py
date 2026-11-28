# Reads the layout of every page of the mockup (positions, sizes, colours, texts, control keys, tips) into data/layout_raw.json.
# Usage: python3 tools/extract_layout.py /path/to/whiskerwave.html   then   python3 tools/gen_layout.py
import asyncio, json, sys
from playwright.async_api import async_playwright
JS = r"""
()=>{const stage=document.querySelector('#app').getBoundingClientRect();
 const R=e=>{const r=e.getBoundingClientRect();return [Math.round((r.left-stage.left)*10)/10,Math.round((r.top-stage.top)*10)/10,Math.round(r.width*10)/10,Math.round(r.height*10)/10];};
 const vis=e=>{const r=e.getBoundingClientRect();if(r.width<=0||r.height<=0)return false;const cs=getComputedStyle(e);return cs.visibility!=='hidden'&&cs.display!=='none';};
 const items=[];const root=document.querySelector('#app');const pgs=document.querySelector('#pages');const inPg=e=>pgs.contains(e)?1:0;const eid=e=>e.id||(e.parentElement&&e.parentElement.id)||(e.parentElement&&e.parentElement.parentElement&&e.parentElement.parentElement.id)||'';
 const rgb=c=>{const m=c.match(/[\d.]+/g);if(!m)return 'ffffffff';const a=m.length>3?Math.round(+m[3]*255):255;return [a,+m[0],+m[1],+m[2]].map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');};
 const walk=(e,inKnob,op)=>{if(!vis(e))return;const cs=getComputedStyle(e);op*=+cs.opacity;
  const cl=e.classList;
  if(e.id==='dlg'||e.id==='tip'||e.id==='toast'||e.id==='ghost')return;
  if(cl.contains('knob')){const c=e.querySelector('canvas');const le=e.querySelector('.l'),ve=e.querySelector('.v'),lc=getComputedStyle(le),vc=getComputedStyle(ve);items.push({t:'knob',k:e.dataset.p,r:R(e),c:R(c),l:le.textContent,lr:R(le),vr:R(ve),lfs:parseFloat(lc.fontSize),vfs:parseFloat(vc.fontSize),lcol:rgb(lc.color),vcol:rgb(vc.color),sm:cl.contains('sm')?1:0,tip:e.dataset.tip||'',op,pg:inPg(e)});return;}
  if(e.tagName==='SELECT'){items.push({pg:inPg(e),eid:eid(e),t:'sel',k:e.dataset.p||'',r:R(e),tip:e.dataset.tip||'',txt:e.options[e.selectedIndex]?e.options[e.selectedIndex].text:'',opts:e.dataset.p?null:[...e.options].map(o=>o.text),op});return;}
  if(cl.contains('seg')){items.push({pg:inPg(e),eid:eid(e),t:'seg',k:e.dataset.p||'',r:R(e),tip:e.dataset.tip||'',cells:[...e.children].map(b=>({txt:b.textContent,r:R(b),on:b.classList.contains('on')?1:0})),op});return;}
  if(e.tagName==='CANVAS'){items.push({pg:inPg(e),eid:eid(e),t:'canvas',r:R(e),cls:e.className,id:e.id||'',op});return;}
  if(e.tagName==='BUTTON'||cl.contains('btn')){items.push({pg:inPg(e),eid:eid(e),t:'btn',k:e.dataset.p||'',r:R(e),txt:e.textContent.trim(),tip:e.dataset.tip||'',on:cl.contains('on')?1:0,cls:e.className,id:e.id||'',page:e.dataset.page||'',osc:e.dataset.osc||'',op});return;}
  if(e.tagName==='INPUT'){items.push({pg:inPg(e),eid:eid(e),t:'input',r:R(e),ph:e.placeholder||'',op});return;}
  // boxes with a visible background or border
  const bg=cs.backgroundColor,bw=parseFloat(cs.borderTopWidth)||0;
  if((bg&&bg!=='rgba(0, 0, 0, 0)')||bw>0){items.push({pg:inPg(e),eid:eid(e),t:'box',r:R(e),bg:rgb(bg||'rgba(0,0,0,0)'),bc:bw>0?rgb(cs.borderTopColor):'',bw,rad:parseFloat(cs.borderTopLeftRadius)||0,cls:e.className,id:e.id||'',src:e.dataset.src||'',op});}
  for(const n of e.childNodes){if(n.nodeType===3){const tx=n.textContent.trim();if(tx){const rg=document.createRange();rg.selectNodeContents(n);const rr=rg.getBoundingClientRect();
      items.push({pg:inPg(e),eid:eid(e),t:'text',txt:tx,r:[Math.round((rr.left-stage.left)*10)/10,Math.round((rr.top-stage.top)*10)/10,Math.round(rr.width*10)/10,Math.round(rr.height*10)/10],fs:parseFloat(cs.fontSize),fw:+cs.fontWeight||400,col:rgb(cs.color),mono:/Mono/.test(cs.fontFamily)?1:0,ls:parseFloat(cs.letterSpacing)||0,up:cs.textTransform==='uppercase'?1:0,src:e.dataset.src||'',cls:e.className,op});}}
   else if(n.nodeType===1)walk(n,false,op);}};
 walk(root,false,1);return {w:stage.width,h:stage.height,items};}
"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1351,'height':950})
        await pg.goto('file://'+sys.argv[1]); await pg.wait_for_timeout(1200)
        await pg.evaluate("()=>{setV('b.on',1);setV('c.on',1);}"); await pg.wait_for_timeout(200)
        out={}
        tabs=await pg.evaluate("()=>[...document.querySelectorAll('#tabs [data-page]')].map(e=>e.dataset.page)")
        for t in [x for x in tabs if x not in ('wave','presets')]:
            await pg.evaluate("(t)=>document.querySelector('#tabs [data-page=\"'+t+'\"]').click()",t); await pg.wait_for_timeout(350)
            out[t]=await pg.evaluate(JS)
            await pg.screenshot(path=f'/tmp/ref_{t}.png')
        json.dump(out,open('data/layout_raw.json','w'))
        for t in out:
            c={}
            for it in out[t]['items']: c[it['t']]=c.get(it['t'],0)+1
            print(t,out[t]['w'],out[t]['h'],c)
        await b.close()
asyncio.run(main())
