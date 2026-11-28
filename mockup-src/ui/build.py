import re,sys
d='/home/claude/ww-ui/'
t=open(d+'template.html').read()
css=open(d+'style.css').read()+'\n'+open(d+'style2.css').read()
dsp=open('/home/claude/ww-src/ww-dsp.js').read().replace('</script','<\\/script')
ui='\n'.join(open(d+f).read().replace("'use strict';\n","",1) if f=='ui1.js' else open(d+f).read() for f in ['ui1.js','ui5.js','ui6.js','ui2.js','ui3.js','ui7.js','ui8.js','ui9.js','ui4b.js','ui4.js']).replace('</script','<\\/script')
import base64
fd=d+'fonts/';ff=''
for fam,w,fn in [('Barlow Condensed',400,'barlow-condensed-latin-400-normal'),('Barlow Condensed',600,'barlow-condensed-latin-600-normal'),('Barlow Condensed',700,'barlow-condensed-latin-700-normal'),('JetBrains Mono',400,'jetbrains-mono-latin-400-normal'),('JetBrains Mono',600,'jetbrains-mono-latin-600-normal')]:
    ff+="@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2');}\n"%(fam,w,base64.b64encode(open(fd+fn+'.woff2','rb').read()).decode())
ff='/* Fonts: Barlow Condensed and JetBrains Mono, SIL Open Font License 1.1, embedded so the page works offline */\n'+ff
out=t.replace('/*FONTS*/',ff).replace('/*CSS*/',css).replace('/*DSP*/',dsp).replace('/*UI*/',ui)
open(d+'whiskerwave.html','w').write(out)
print(len(out)//1024,'KB')
