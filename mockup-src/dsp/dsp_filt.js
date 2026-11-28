/* filter library: 47 types, stereo, all our own implementations */
const FT=[
 ['Off','-'],
 ['LP 6','Clean'],['LP 12','Clean'],['LP 24','Clean'],['LP 48','Clean'],
 ['HP 6','Clean'],['HP 12','Clean'],['HP 24','Clean'],
 ['BP 12','Clean'],['BP 24','Clean'],['Notch','Clean'],['Peak','Clean'],['Low Shelf','Clean'],['High Shelf','Clean'],
 ['Ladder 24','Analog'],['Ladder 12','Analog'],['Acid 18','Analog'],['Ladder HP','Analog'],['Ladder BP','Analog'],
 ['Dirty 12','Analog'],['Morph LP-N-HP','Analog'],['Smooth 24','Analog'],['Warm Diode','Analog'],
 ['Comb +','Comb'],['Comb -','Comb'],['Flange Comb','Comb'],['Resonator','Comb'],['Harmonic Comb','Comb'],['Metal Comb','Comb'],
 ['Vowel AEIOU','Voice'],['Choir','Voice'],['Throat','Voice'],['Telephone','Voice'],
 ['Phaser 4','Phase'],['Phaser 8','Phase'],['Phaser 12','Phase'],['Disperser','Phase'],
 ['Dual Peak','Creative'],['Dual Notch','Creative'],['Harmonic Bank','Creative'],['Odd Bank','Creative'],['DJ Filter','Creative'],
 ['Rate Crush','Creative'],['Fold LP','Creative'],['Scream','Creative'],['Wah','Creative'],['Tilt','Creative']
];
G.FT=FT;LISTS.ftype=FT.map(f=>f[0]);LISTS.dmode=['Warm','Clean','Hard','Fold'];
const FTIP=[
 'Filter off.',
 'One pole low-pass, 6 dB per octave. Gentle and natural.','Two pole low-pass, 12 dB per octave, clean.','Four pole low-pass, 24 dB per octave, clean.','Eight pole low-pass, 48 dB per octave. Steep wall.',
 'One pole high-pass, 6 dB per octave.','Two pole high-pass, 12 dB per octave.','Four pole high-pass, 24 dB per octave.',
 'Band-pass 12 dB per octave. Reso narrows it.','Band-pass 24 dB per octave, steeper sides.','Notch that removes a band at the cutoff.','Bell that boosts at the cutoff. Reso is the boost.','Low shelf. Reso below the middle cuts, above boosts.','High shelf. Reso below the middle cuts, above boosts.',
 'Moog-style four pole ladder, 24 dB. Fat, self oscillates.','Ladder tapped at two poles, 12 dB. Looser and brighter.','Ladder tapped at three poles, 18 dB, acid-style squelch.','High-pass built from the ladder. Thin and aggressive.','Band-pass built from the ladder. Reso narrows it.',
 'Two pole filter with clipped feedback. Dirty and screaming at high reso.','Morphs low-pass to notch to high-pass with Shape.','Four linear poles with no saturation. Very clean and smooth.','Three pole filter with uneven saturation. Warm and slightly lopsided.',
 'Comb filter with positive feedback. Cutoff sets the pitch. Metallic ringing.','Comb filter with negative feedback. Hollow, odd harmonic ringing.','Feed-forward comb, no ringing. Reso sets depth and polarity. Flanger-like.','Damped comb that rings like a plucked string. Shape sets damping.','Two combs an octave apart for a thicker, harmonic ring.','Comb with a smearing allpass in the loop. Shape adds bell and metal.',
 'Three formant peaks. Cutoff walks through A, E, I, O, U.','Four formants for a choir-like body.','Two low formants plus body for a throaty growl.','Telephone band, moves with the cutoff.',
 'Four stage phaser. Shape spreads the stages.','Eight stage phaser, deeper notches.','Twelve stage phaser, jet-like.','Allpass cascade: flat level but smears time. Shape spreads the stages. Reso adds stages.',
 'Two peaks either side of the cutoff. Shape sets the gap. Reso sets the boost.','Two notches either side of the cutoff. Shape sets the gap.','Four peaks at 1x, 2x, 3x, 4x the cutoff. Shape tilts the balance. Reso narrows them.','Four peaks at odd multiples (1, 3, 5, 7). Hollow, square-ish.',
 'One knob DJ filter: below the middle is low-pass, above is high-pass, the middle is flat.','Sample rate reducer at the cutoff rate. Reso smooths the steps.','Wavefolds the input then low-passes it. Reso sets the fold amount.','Band-pass into hard saturation for a screaming, vocal edge.','Wah pedal band-pass, narrower toward the low end.','Tilts the spectrum around the cutoff: reso below the middle darkens, above brightens.'
];
G.FTIP=FTIP;
const fastTanh=x=>{if(x>3)return 1;if(x<-3)return -1;const x2=x*x;return x*(27+x2)/(27+9*x2);};
for(const f of ['f1','f2']){
  PR[f+'.type'].max=FT.length-1;PR[f+'.type'].d=f==='f1'?14:0;
  def(f+'.sh','Shape',0,1,.5,{vo:true,tip:'Extra control used by some filter types: morph position, comb damping, stage spread, peak gap, harmonic tilt.'});
  def(f+'.dm','Drive mode',0,3,0,{k:'list',list:'dmode',tip:'Warm saturates softly. Clean keeps the level steady with gentle limiting. Hard clips. Fold wavefolds.'});
}
const FORMANTS=[[800,1150,2900],[400,1600,2700],[270,2140,2950],[450,830,2830],[325,700,2530]];
class VFilt{
  o4(){if(!this.ov4){this.ov4=new OS4();}this.ov4.prep(this.sr);return this.ov4;}
  static sh32(x){return fastTanh(x*1.5)*.8;}
  static sh44(x){return fastTanh(x*6)*.7;}
  static fold(x,fg){let y=x*fg,n=0;while((y>1||y<-1)&&n++<8)y=y>1?2-y:-2-y;return y;}
  constructor(){this.s=new Float64Array(48);this.c=new Float64Array(32);this.cb=[new Float32Array(2048),new Float32Array(2048)];this.ci=0;
    this.type=0;this.sr=44100;this.mix=1;this.res=0;this.sh=.5;this.dm=0;this.dg=1;this.mk=1;this.gg=0;this.kfb=0;this.a=0;this.G=0;this.D=100;this.fb=0;this.damp=.5;this.cap=0;
    this.ap=new Float64Array(12);this.n=4;this.w=new Float64Array([1,1,1,1]);this.bn=4;this.djm=0;this.rate=.5;this.fg=1;this.r=[0,0,0];
    this.fresh=true;this.rs=0;this.nc=0;this.nap=0;this.nw=0;const ns=VFilt.SC.length;this.oc=new Float64Array(32);this.tc=new Float64Array(32);this.dc=new Float64Array(32);this.os=new Float64Array(ns);this.ts=new Float64Array(ns);this.ds=new Float64Array(ns);
    this.oap=new Float64Array(12);this.tap=new Float64Array(12);this.dap=new Float64Array(12);this.ow=new Float64Array(4);this.tw=new Float64Array(4);this.dw=new Float64Array(4);}
  su(i,f,k){const sr=this.sr;f=clamp(f,20,sr*.47);const g=Math.tan(PI*f/sr),a1=1/(1+g*(g+k)),c=this.c,j=i*4;c[j]=a1;c[j+1]=g*a1;c[j+2]=g*g*a1;c[j+3]=k;}
  /* coefficient smoothing: new values are reached by a per-sample linear ramp over the block, so cutoff and resonance moves have no 1.4 kHz stepping */
  set(type,fc,res,drv,mix,sr,sh,dm,nb){
    const same=!this.fresh&&type===this.type&&sr===this.sr,SC=VFilt.SC,ns=SC.length;
    if(same){this.oc.set(this.c);for(let i=0;i<ns;i++)this.os[i]=this[SC[i]];this.oap.set(this.ap);this.ow.set(this.w);}
    this.set0(type,fc,res,drv,mix,sr,sh,dm);this.fresh=false;
    if(!same){this.rs=0;return;}
    nb=nb||32;const inv=1/nb;
    const t=type;this.nc=(t>=2&&t<=4)||t===6||t===7||t===8||t===9||t===10||t===11||t===12||t===13||t===19||(t>=29&&t<=32)||(t>=37&&t<=41)||t>=43&&t<=45||t===20?16:0;
    this.nap=(t>=33&&t<=36)?12:0;this.nw=(t===39||t===40)?4:0;
    for(let i=0;i<this.nc;i++){this.tc[i]=this.c[i];this.dc[i]=(this.c[i]-this.oc[i])*inv;this.c[i]=this.oc[i];}
    for(let i=0;i<ns;i++){this.ts[i]=this[SC[i]];this.ds[i]=(this.ts[i]-this.os[i])*inv;this[SC[i]]=this.os[i];}
    for(let i=0;i<this.nap;i++){this.tap[i]=this.ap[i];this.dap[i]=(this.ap[i]-this.oap[i])*inv;this.ap[i]=this.oap[i];}
    for(let i=0;i<this.nw;i++){this.tw[i]=this.w[i];this.dw[i]=(this.w[i]-this.ow[i])*inv;this.w[i]=this.ow[i];}
    this.rs=nb;}
  ramp(){const SC=VFilt.SC,ns=SC.length;
    if(--this.rs<=0){this.rs=0;for(let i=0;i<this.nc;i++)this.c[i]=this.tc[i];for(let i=0;i<ns;i++)this[SC[i]]=this.ts[i];for(let i=0;i<this.nap;i++)this.ap[i]=this.tap[i];for(let i=0;i<this.nw;i++)this.w[i]=this.tw[i];return;}
    for(let i=0;i<this.nc;i++)this.c[i]+=this.dc[i];for(let i=0;i<ns;i++)this[SC[i]]+=this.ds[i];
    for(let i=0;i<this.nap;i++)this.ap[i]+=this.dap[i];for(let i=0;i<this.nw;i++)this.w[i]+=this.dw[i];}
  set0(type,fc,res,drv,mix,sr,sh,dm){
    this.type=type;this.sr=sr;this.mix=mix;this.res=res;this.sh=sh;this.dm=dm;this.dg=1+drv*7;this.mk=1/Math.sqrt(this.dg);
    fc=clamp(fc,20,sr*.45);this.fc=fc;const q=2-1.96*res,t=type;
    if(t===1||t===5||t===46){this.a=1-Math.exp(-TAU*fc/sr);this.G=res*2-1;}
    else if(t===2||t===6||t===8||t===10||t===20)this.su(0,fc,q);
    else if(t===3||t===7){this.su(0,fc,1.4);this.su(1,fc,q);}
    else if(t===4){this.su(0,fc,1.5);this.su(1,fc,1.5);this.su(2,fc,1.5);this.su(3,fc,q);}
    else if(t===9){this.su(0,fc,q);this.su(1,fc,q);}
    else if(t===11){this.su(0,fc,1.0);this.G=res*10;}
    else if(t===12||t===13){this.su(0,fc,1.0);this.G=(res*2-1)*3;}
    else if(t>=14&&t<=18){const g=Math.tan(Math.PI*fc/sr);this.gg=g/(1+g);this.kfb=res*4;}
    else if(t===19){this.su(0,fc,1.0);}
    else if(t===21){const g=Math.tan(Math.PI*fc/sr);this.gg=g/(1+g);this.kfb=res*3.7;}
    else if(t===22){const g=Math.tan(Math.PI*fc/sr);this.gg=g/(1+g);this.kfb=res*3.5;}
    else if(t>=23&&t<=28){this.D=clamp(sr/fc,4,2040);
      this.fb=t===23?res*.93:t===24?-res*.93:t===25?(res*2-1):t===26?.8+.199*res:res*.9;
      this.damp=.1+.85*(1-sh);this.cap=sh*.8;}
    else if(t===29||t===30){const p=clamp(Math.log(fc/20)/Math.log(1000),0,1)*4,i=Math.min(3,Math.floor(p)),f=p-i,k=2-1.7*res;
      for(let j=0;j<3;j++)this.su(j,FORMANTS[i][j]*(1-f)+FORMANTS[i+1][j]*f,k);
      if(t===30)this.su(3,3400,k);}
    else if(t===31){const k=2-1.7*res;this.su(0,fc*.6,k);this.su(1,fc*1.5,k);this.su(2,fc*2.2,1.2);}
    else if(t===32){this.su(0,fc*.35,1.2);this.su(1,fc*1.8,1.2);}
    else if(t>=33&&t<=36){const n=t===33?4:t===34?8:t===35?12:Math.min(12,4+Math.round(res*8));this.n=n;this.fb=t===36?0:res*.85;
      for(let i=0;i<n;i++){const f=clamp(fc*Math.pow(2,(i-n/2)*(sh*.5+.02)),20,sr*.45),tn=Math.tan(PI*f/sr);this.ap[i]=(1-tn)/(1+tn);}}
    else if(t===37){const sp=1+sh*1.5;this.su(0,fc/sp,.6);this.su(1,fc*sp,.6);this.G=res*8;}
    else if(t===38){const sp=1+sh*1.5;this.su(0,fc/sp,q);this.su(1,fc*sp,q);}
    else if(t===39||t===40){const k=Math.max(.06,q);const m=t===39?[1,2,3,4]:[1,3,5,7];
      for(let i=0;i<4;i++){this.su(i,fc*m[i],k);this.w[i]=Math.pow(1/(i+1),sh*2);}}
    else if(t===41){const p=clamp(Math.log(fc/20)/Math.log(1000),0,1);this.djm=p<.5?0:2;this.su(0,20*Math.pow(1000,this.djm===0?p*2:(p-.5)*2),q);}
    else if(t===42){this.rate=clamp(fc/sr*2,.0005,1);}
    else if(t===43){this.su(0,fc,1.2);this.fg=1+res*6;}
    else if(t===44||t===45){this.su(0,fc,t===44?1.2:Math.max(q,.25));}
    else if(t===46){}
  }
  uu(ch,i,x){const c=this.c,s=this.s,j=i*4,so=ch*24+i*2,a1=c[j],a2=c[j+1],a3=c[j+2],k=c[j+3];
    const v3=x-s[so+1],v1=a1*s[so]+a2*v3,v2=s[so+1]+a2*s[so]+a3*v3;s[so]=2*v1-s[so];s[so+1]=2*v2-s[so+1];
    const r=this.r;r[0]=v2;r[1]=v1;r[2]=x-k*v1-v2;return k;}
  u(ch,i,x,m){const k=this.uu(ch,i,x),r=this.r;
    return m===0?r[0]:m===1?r[1]:m===2?r[2]:m===3?r[0]+r[2]:r[1]*k;}
  /* zero-delay (trapezoidal) 4-pole ladder: exact bilinear poles, so the top end rolls off at the true 24 dB per octave and stays stable at any cutoff. */
  lad(ch,xi,sat){const s=this.s,o=ch*24,G=this.gg,k=this.kfb,G2=G*G,G3=G2*G,G4=G2*G2,c=1-G;
    const z1=s[o+20],z2=s[o+21],z3=s[o+22],z4=s[o+23];
    let u=(xi-k*c*(G3*z1+G2*z2+G*z3+z4))/(1+k*G4);if(sat)u=fastTanh(u*.3)*3.333333; // gentle: about 3 percent squash at full level, so chords and sub stay clean; the Drive knob adds the grit
    let v=(u-z1)*G;const y1=v+z1;s[o+20]=y1+v;
    v=(y1-z2)*G;const y2=v+z2;s[o+21]=y2+v;
    v=(y2-z3)*G;const y3=v+z3;s[o+22]=y3+v;
    v=(y3-z4)*G;const y4=v+z4;s[o+23]=y4+v;
    s[o+16]=y1;s[o+17]=y2;s[o+18]=y3;s[o+19]=y4;}
  rd(ch,d){const cb=this.cb[ch],rp=this.ci-d,ri=Math.floor(rp),fr=rp-ri;
    return cb[((ri%2048)+2048)&2047]*(1-fr)+cb[((ri+1)%2048+2048)&2047]*fr;}
  pre(x,ch){const dg=this.dg;if(dg<1.0001)return x;
    if(!this.ovs)this.ovs=new OS2();this.ovs.prep(this.sr);
    return this.ovs.p(ch|0,x,VFilt.shape,dg,this.dm);}
  one(ch,x){
    const t=this.type,s=this.s,o=ch*24,res=this.res,xi=this.pre(x,ch);
    switch(t){
      case 1:s[o+20]+=this.a*(xi-s[o+20]);return s[o+20];
      case 5:s[o+20]+=this.a*(xi-s[o+20]);return xi-s[o+20];
      case 2:return this.u(ch,0,xi,0);
      case 3:return this.u(ch,1,this.u(ch,0,xi,0),0);
      case 4:return this.u(ch,3,this.u(ch,2,this.u(ch,1,this.u(ch,0,xi,0),0),0),0);
      case 6:return this.u(ch,0,xi,2);
      case 7:return this.u(ch,1,this.u(ch,0,xi,2),2);
      case 8:return this.u(ch,0,xi,4);
      case 9:return this.u(ch,1,this.u(ch,0,xi,4),4);
      case 10:return this.u(ch,0,xi,3);
      case 11:return xi+this.G*this.u(ch,0,xi,4);
      case 12:return xi+this.G*this.u(ch,0,xi,0);
      case 13:return xi+this.G*this.u(ch,0,xi,2);
      case 14:{this.lad(ch,xi,true);return s[o+19]*(1+.5*res);}
      case 15:{this.lad(ch,xi,true);return s[o+17]*(1+.6*res);}
      case 16:{this.lad(ch,xi,true);return s[o+18]*1.4*(1+.5*res);}
      case 17:{this.lad(ch,xi,true);return xi-4*s[o+16]+6*s[o+17]-4*s[o+18]+s[o+19];}
      case 18:{this.lad(ch,xi,true);return 4*(s[o+17]-2*s[o+18]+s[o+19])*(1+res);}
      case 19:{const xin=xi-res*2.2*fastTanh(s[o]*2);return this.u(ch,0,xin,0)*(1+.5*res);}
      case 20:{this.uu(ch,0,xi);const r=this.r,lp=r[0],hp=r[2],sh=this.sh;
        return sh<.5?lp*(1-2*sh)+(lp+hp)*2*sh:(lp+hp)*(2-2*sh)+hp*(2*sh-1);}
      case 21:{this.lad(ch,xi,false);return s[o+19]*(1+.4*res);}
      case 22:{const G=this.gg,k=this.kfb,G2=G*G,G3=G2*G,c=1-G,z1=s[o+21],z2=s[o+22],z3=s[o+23];
        let u=(xi-k*c*(G2*z1+G*z2+z3))/(1+k*G3);u=u>0?fastTanh(u):fastTanh(u*.7)*1.2;
        let v=(u-z1)*G;const y1=v+z1;s[o+21]=y1+v;v=(y1-z2)*G;const y2=v+z2;s[o+22]=y2+v;v=(y2-z3)*G;const y3=v+z3;s[o+23]=y3+v;
        const y=y3*(1+.5*res);s[o+20]+=.002*(y-s[o+20]);return y-s[o+20];}
      case 23:case 24:{const d=this.rd(ch,this.D),y=xi+this.fb*d;this.cb[ch][this.ci&2047]=y;return (y+xi)*.5;}
      case 25:{const d=this.rd(ch,this.D);this.cb[ch][this.ci&2047]=xi;return xi+this.fb*d;}
      case 26:{const d=this.rd(ch,this.D);s[o+20]+=this.damp*(d-s[o+20]);const y=xi*.4+this.fb*s[o+20];this.cb[ch][this.ci&2047]=y;return y*(1-this.fb)*3;}
      case 27:{const d1=this.rd(ch,this.D),d2=this.rd(ch,this.D*.5),y=xi+this.fb*(d1+d2)*.5;this.cb[ch][this.ci&2047]=y;return (y+xi)*.5;}
      case 28:{const d=this.rd(ch,this.D),c=this.cap,z=-c*d+s[o+20];s[o+20]=d+c*z;const y=xi+this.fb*z;this.cb[ch][this.ci&2047]=y;return (y+xi)*.5;}
      case 29:return (this.u(ch,0,xi,4)+.7*this.u(ch,1,xi,4)+.45*this.u(ch,2,xi,4))*.6;
      case 30:return (this.u(ch,0,xi,4)+.8*this.u(ch,1,xi,4)+.5*this.u(ch,2,xi,4)+.3*this.u(ch,3,xi,4))*.5;
      case 31:return this.u(ch,0,xi,4)+.8*this.u(ch,1,xi,4)+.4*this.u(ch,2,xi,0);
      case 32:{const y=this.u(ch,1,this.u(ch,0,xi,2),0);return this.o4().p(ch|0,y,VFilt.sh32,0,0);}
      case 33:case 34:case 35:{let y=xi+this.fb*s[o+23];const n=this.n;for(let i=0;i<n;i++){const a=this.ap[i],z=-a*y+s[o+i];s[o+i]=y+a*z;y=z;}s[o+23]=y;return (xi+y)*.5;}
      case 36:{let y=xi;const n=this.n;for(let i=0;i<n;i++){const a=this.ap[i],z=-a*y+s[o+i];s[o+i]=y+a*z;y=z;}return y;}
      case 37:return xi+this.G*(this.u(ch,0,xi,4)+this.u(ch,1,xi,4))*.7;
      case 38:return this.u(ch,1,this.u(ch,0,xi,3),3);
      case 39:case 40:{let sum=0;for(let i=0;i<4;i++)sum+=this.w[i]*this.u(ch,i,xi,4);return sum*.9;}
      case 41:return this.u(ch,0,xi,this.djm);
      case 42:{s[o+20]+=this.rate;if(s[o+20]>=1){s[o+20]-=1;s[o+21]=xi;}s[o+22]+=(1-res*.95)*(s[o+21]-s[o+22]);return s[o+22];}
      case 43:{const y=this.o4().p(ch|0,xi,VFilt.fold,this.fg,0);return this.u(ch,0,y,0);}
      case 44:return this.o4().p(ch|0,this.u(ch,0,xi,4),VFilt.sh44,0,0);
      case 45:return this.u(ch,0,xi,4)*1.3;
      case 46:{s[o+20]+=this.a*(xi-s[o+20]);const lp=s[o+20],hp=xi-lp,tl=this.G;return lp*(1+tl)+hp*(1-tl);}
    }
    return xi;}
  proc(l,r,out){
    if(this.type===0){out[0]=l;out[1]=r;return;}
    if(this.rs>0)this.ramp();
    const yl=this.one(0,l),yr=this.one(1,r);
    if(this.type>=23&&this.type<=28)this.ci=(this.ci+1)&2047;
    const m=this.mix;out[0]=l+(yl-l)*m;out[1]=r+(yr-r)*m;}
  reset(){this.fresh=true;this.rs=0;this.s.fill(0);this.cb[0].fill(0);this.cb[1].fill(0);}
}
VFilt.shape=(x,dg,dm)=>{const mk=1/Math.sqrt(dg);switch(dm){
  case 0:return fastTanh(x*dg)*mk*1.15;
  case 1:return x/(1+Math.abs(x*(dg-1)));
  case 2:return clamp(x*dg,-1,1)*mk;
  default:{let y=x*dg*.7,n=0;while((y>1||y<-1)&&n++<8)y=y>1?2-y:-2-y;return y*mk*1.1;}}};
VFilt.SC=['gg','a','kfb','G','fg','rate','D','fb','damp','cap','dg','mk','mix','res','sh'];
G.VFilt=VFilt;
