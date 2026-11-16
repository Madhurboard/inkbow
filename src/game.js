// Inkbow: game state, scene painting, simulation, rendering and input.
import{TAU,rnd,gauss,clamp,lerp,pick,hex,rgba,mix,shade}from'./utils.js';
import{deform,poly,wash,stroke,bloom,splat,circ,dens,inkLine}from'./paint.js';
import{PALS,INK,HERO,KD,AT,WK,TIERS,SK,BOSS,SPC}from'./data.js';
import{initAudio,resumeAudio,bindState,setMuted,setMusic,sfx}from'./audio.js';
const $=id=>document.getElementById(id);
const cv=$('c'),ctx=cv.getContext('2d');
const OV=26,PC=matchMedia('(hover:hover) and (pointer:fine)').matches;if(PC)document.body.classList.add('pc');
let W=0,H=0,DPR=1,S=1,GY=0,PH=0,AX=0,AY=0,perches=[];
/* ---------- scene painting ---------- */
let L=[],clouds=[],mistSpr,paperPat,vig,sprCache={},heroSpr,splatCache={};
function skyAt(p,t){const s=p.sky,f=clamp(t,0,.999)*(s.length-1),i=f|0;return mix(s[i],s[i+1],f-i);}
function ridgePts(y0,amp,step){const p=[],k1=TAU/(W*rnd(.5,.9)),k2=TAU/(W*rnd(.2,.35)),k3=TAU/(W*rnd(.07,.12)),a=rnd(TAU),b=rnd(TAU),c=rnd(TAU);
  for(let x=-OV-10;x<=W+OV+10;x+=step)p.push([x,y0-amp*(.55*(1-Math.abs(Math.sin(x*k1+a)))+.3*(1-Math.abs(Math.sin(x*k2+b)))+.15*Math.sin(x*k3+c))+gauss()*amp*.02]);return p;}
function island(x,cx,y,w,p,far){const rock=far?mix(p.far,p.mist,.25):p.rock,a=far?.1:.2;
  const pts=dens([[cx-w/2,y],[cx+w/2,y],[cx+w*.4,y+w*.2],[cx+w*.16,y+w*.5],[cx-w*.02,y+w*.82],[cx-w*.17,y+w*.44],[cx-w*.4,y+w*.2]],w/9);
  wash(x,pts,rock,{layers:7,alpha:a,vari:.35});
  if(!far){for(let i=0;i<7;i++)stroke(x,cx+rnd(-w*.35,w*.3),y+rnd(4,w*.25),cx+rnd(-w*.1,w*.1),y+rnd(w*.3,w*.7),rnd(2,5)*S,i%2?p.lit:shade(p.rock,-.3),.22);
    for(let i=0;i<4;i++){const rx=cx+rnd(-w*.3,w*.3);stroke(x,rx,y+w*.2,rx+gauss()*4,y+w*rnd(.5,1),1.2*S,shade(p.rock,-.2),.4,2);}}
  wash(x,dens([[cx-w/2-2,y-2*S],[cx+w/2+2,y-2*S],[cx+w/2,y+5*S],[cx-w/2,y+5*S]],8),p.grass,{layers:5,alpha:far?.1:.24,vari:.4});
  if(!far){for(let i=0;i<16;i++){const gx=cx+rnd(-w/2,w/2);stroke(x,gx,y+1,gx+gauss()*3*S,y-rnd(3,8)*S,1.2*S,p.grass,.7,2);}
    const wx=cx-w*.44;for(let i=0;i<4;i++)stroke(x,wx+i*1.5,y+3,wx+i*1.5+gauss()*2,y+w*rnd(.9,1.5),2*S,[255,255,255],.3,3);bloom(x,wx,y+w*1.3,14*S,[255,255,255],.25);
    const tx=cx+w*.36;stroke(x,tx,y,tx+2*S,y-16*S,2*S,shade(p.rock,-.3),.8,3);for(let i=0;i<3;i++)wash(x,circ(tx+gauss()*5*S,y-(18+i*5)*S,rnd(7,11)*S,rnd(6,9)*S,10),p.tree,{layers:5,alpha:.16,vari:.5,vary:.15});}
  else{stroke(x,cx-w*.3,y+2,cx-w*.3,y+w*1.2,1.5*S,[255,255,255],.25,3);}}
function buildScene(){
  const p=PALS[G.pal%PALS.length],bs=Math.min(DPR,1.5);
  const mk=()=>{const c=document.createElement('canvas');c.width=(W+OV*2)*bs|0;c.height=H*bs|0;const x=c.getContext('2d');x.scale(bs,bs);x.translate(OV,0);return[c,x];};
  /* sky */
  let[c0,x]=mk();const g=x.createLinearGradient(0,0,0,GY);p.sky.forEach((h,i)=>g.addColorStop(i/(p.sky.length-1),rgba(h,1)));x.fillStyle=g;x.fillRect(-OV,0,W+OV*2,H);
  for(let i=0;i<14;i++){const cy=rnd(0,GY);wash(x,circ(rnd(-OV,W),cy,rnd(60,170)*S,rnd(26,70)*S,12),shade(skyAt(p,cy/GY),gauss()*.3),{layers:5,alpha:.05,vari:.6,edge:0});}
  for(let i=0;i<80;i++){const y=rnd(0,GY),w=rnd(W*.3,W),x0=rnd(-OV,W)-w*.3;stroke(x,x0,y,x0+w,y+gauss()*10,rnd(8,44)*S,shade(skyAt(p,y/GY),gauss()*.22),.075,12);}
  if(p.stars)for(let i=0;i<170;i++){x.fillStyle=`rgba(255,255,255,${rnd(.2,.95)})`;x.beginPath();x.arc(rnd(-OV,W+OV),Math.pow(Math.random(),1.6)*GY*.75,rnd(.3,1.3),0,TAU);x.fill();}
  const ox=W*p.ox,oy=H*p.oy,or=p.or*Math.min(W,H)*(H>W?1.25:1);
  bloom(x,ox,oy,or*4,p.glow,.5);bloom(x,ox,oy,or*2,p.orb,.55);
  if(p.ring){x.save();x.translate(ox,oy);x.rotate(-.35);for(let i=0;i<5;i++){x.strokeStyle=rgba(p.orb,.14);x.lineWidth=rnd(2,6)*S;x.beginPath();x.ellipse(0,0,or*(1.7+i*.06),or*(.42+i*.02),0,0,TAU);x.stroke();}x.restore();}
  wash(x,circ(ox,oy,or,or,26),p.orb,{layers:9,alpha:.2,vari:.12,edge:.08});
  if(p.moon)for(let i=0;i<7;i++){const a=rnd(TAU),d=rnd(or*.75);wash(x,circ(ox+Math.cos(a)*d,oy+Math.sin(a)*d,rnd(or*.1,or*.3),rnd(or*.08,or*.22),9),shade(p.glow,-.25),{layers:4,alpha:.045,vari:.5,edge:0});}
  for(let i=0;i<6;i++){const cx=rnd(0,W),cy=rnd(GY*.12,GY*.62),w=rnd(90,190)*S;for(let j=0;j<6;j++)wash(x,circ(cx+gauss()*w*.45,cy+gauss()*w*.07,w*rnd(.25,.5),w*rnd(.06,.12),11),j<4?p.cloud:shade(p.cloud,-.25),{layers:4,alpha:.05,vari:.5,edge:0});}
  splat(x,rnd(W),rnd(GY*.5),W*.5,shade(p.sky[1],.3),40,.25,1.6);
  /* mountains */
  let[c1,m]=mk();
  for(let i=0;i<3;i++){const t=i/2,col=mix(p.far,p.near,t),y0=GY-H*lerp(.17,.02,t),amp=H*lerp(.2,.12,t),rp=ridgePts(y0,amp,13*S);
    if(i===1){island(m,W*.22,H*.33,58*S,p,1);island(m,W*.56,H*.4,40*S,p,1);}
    wash(m,rp.concat([[W+OV+10,H+80],[-OV-10,H+80]]),col,{layers:7,alpha:.17,vari:.5,br:0,edge:.14});
    for(let j=2;j<rp.length-2;j++)if(rp[j][1]<rp[j-2][1]-2&&rp[j][1]<rp[j+2][1]-2&&Math.random()<.6){stroke(m,rp[j][0],rp[j][1]+2,rp[j][0]-amp*rnd(.15,.3),rp[j][1]+amp*rnd(.25,.5),rnd(8,16)*S,mix(p.lit,p.mist,.4),.14);stroke(m,rp[j][0]+3,rp[j][1]+3,rp[j][0]+amp*rnd(.1,.25),rp[j][1]+amp*rnd(.3,.5),rnd(8,14)*S,shade(col,-.3),.12);}
    if(i===2)for(let j=0;j<22;j++){const q=pick(rp),r=rnd(10,24)*S;wash(m,circ(q[0],q[1]+r*.2,r,r*.8,10),p.tree,{layers:4,alpha:.11,vari:.6,vary:.2,edge:.1});}
    if(i===1){for(const ax of[.3,.5]){const bx=W*ax,by=y0+amp*.1,cl=mix(col,p.mist,.2),hh=rnd(44,64)*S;stroke(m,bx,by,bx,by-hh,8*S,cl,.5);stroke(m,bx+30*S,by,bx+30*S,by-hh*.7,8*S,cl,.5);stroke(m,bx,by-hh,bx+14*S,by-hh-10*S,6*S,cl,.45);stroke(m,bx+14*S,by-hh-10*S,bx+24*S,by-hh-4*S,5*S,cl,.4);}}
    const mg=m.createLinearGradient(0,y0-amp*.25,0,GY+10);mg.addColorStop(0,rgba(p.mist,0));mg.addColorStop(1,rgba(p.mist,lerp(.75,.4,t)));m.fillStyle=mg;m.fillRect(-OV,y0-amp*.25,W+OV*2,GY-y0+amp*.25+12);}
  /* near: perches, shore, platform */
  let[c2,n]=mk();
  const l1=perches[0],l2=perches[1];
  const cl=dens([[W+OV+8,H+20],[l1.x-44*S,GY+8],[l1.x-36*S,(GY+l1.y)/2],[l1.x-26*S,l1.y],[l1.x+22*S,l1.y],[l1.x+28*S,(l1.y+l2.y)/2],[l2.x-24*S,l2.y],[l2.x+26*S,l2.y],[l2.x+30*S,l2.y-70*S],[W+OV+8,l2.y-110*S]],11*S);
  wash(n,cl,p.rock,{layers:8,alpha:.2,vari:.3,br:0});
  for(let i=0;i<34;i++){const yy=rnd(l2.y-60*S,GY),xx=rnd(l1.x-30*S,W+OV);stroke(n,xx,yy,xx+rnd(14,44)*S,yy+gauss()*8*S,rnd(3,9)*S,i%3?shade(p.rock,-.35):p.lit,.2);}
  for(const q of[l1,l2]){wash(n,dens([[q.x-28*S,q.y-2*S],[q.x+26*S,q.y-2*S],[q.x+24*S,q.y+5*S],[q.x-27*S,q.y+5*S]],8),p.grass,{layers:5,alpha:.22,vari:.4});for(let i=0;i<10;i++){const gx=q.x+rnd(-26,24)*S;stroke(n,gx,q.y+1,gx+gauss()*3*S,q.y-rnd(3,8)*S,1.2*S,p.grass,.7,2);}}
  const tw=perches[2];
  wash(n,dens([[tw.x-14*S,GY+6],[tw.x-13*S,tw.y+9*S],[tw.x-22*S,tw.y+9*S],[tw.x-22*S,tw.y],[tw.x+22*S,tw.y],[tw.x+22*S,tw.y+9*S],[tw.x+13*S,tw.y+9*S],[tw.x+15*S,GY+6]],9*S),p.stone,{layers:8,alpha:.2,vari:.22,br:0});
  for(let yy=tw.y+16*S;yy<GY;yy+=9*S)stroke(n,tw.x-12*S,yy,tw.x+12*S,yy+gauss()*2,1.4*S,shade(p.stone,-.45),.35,2);
  stroke(n,tw.x-9*S,tw.y+12*S,tw.x-9*S,GY,6*S,shade(p.stone,.35),.2);stroke(n,tw.x+9*S,tw.y+12*S,tw.x+9*S,GY,6*S,shade(p.stone,-.5),.25);
  for(let i=0;i<5;i++){const vx=tw.x+rnd(-18,18)*S;stroke(n,vx,tw.y+4*S,vx+gauss()*5*S,tw.y+rnd(14,40)*S,1.3*S,p.grass,.6,2);}
  stroke(n,tw.x-5*S,tw.y+20*S,tw.x+5*S,tw.y+20*S,1.6*S,[255,215,120],.9,2);stroke(n,tw.x,tw.y+15*S,tw.x,tw.y+26*S,1.6*S,[255,215,120],.9,2);bloom(n,tw.x,tw.y+20*S,14*S,[255,215,120],.3);
  for(let i=3;i<perches.length;i++)island(n,perches[i].x,perches[i].y,(i===3?84:70)*S,p,0);
  /* shore + water */
  const sh=GY+Math.min(44*S,(H-GY)*.3);
  const wg=n.createLinearGradient(0,sh-6,0,H);wg.addColorStop(0,rgba(mix(p.sky[3],p.mist,.3),1));wg.addColorStop(.5,rgba(mix(p.sky[2],p.gd,.25),1));wg.addColorStop(1,rgba(mix(p.sky[0],p.gd,.6),1));n.fillStyle=wg;n.fillRect(-OV,sh-6,W+OV*2,H-sh+8);
  for(let i=0;i<70;i++){const y=rnd(sh,H),t=(y-sh)/(H-sh),w=rnd(40,180)*S,x0=rnd(-OV,W);stroke(n,x0,y,x0+w,y+gauss()*2,rnd(2,7)*S,shade(skyAt(p,1-t*.8),gauss()*.25),.16,5);}
  for(let i=0;i<16;i++){const y=sh+ (H-sh)*i/16;stroke(n,ox-or*rnd(.3,1)-i,y,ox+or*rnd(.3,1)+i,y,rnd(3,6)*S,p.orb,.22,4);}
  bloom(n,ox,sh+(H-sh)*.3,or*2.4,p.glow,.22);
  const gp=[];for(let xx=-OV-8;xx<=W+OV+8;xx+=10*S)gp.push([xx,GY+gauss()*1.2]);for(let xx=W+OV+8;xx>=-OV-8;xx-=12*S)gp.push([xx,sh+Math.sin(xx*.02)*5*S+gauss()*3*S]);
  wash(n,gp,p.ground,{layers:8,alpha:.24,vari:.3,br:0});
  for(let i=0;i<40;i++){const xx=rnd(-OV,W+OV),yy=rnd(GY+3,sh-3);stroke(n,xx,yy,xx+rnd(20,70)*S,yy+gauss()*2,rnd(2,6)*S,i%2?p.gd:shade(p.ground,.2),.2);}
  splat(n,W/2,(GY+sh)/2,W*.6,p.gd,90,.5,1.5);
  for(let i=0;i<130;i++){const gx=rnd(-OV,W+OV),gy=GY+rnd(-1,3);stroke(n,gx,gy,gx+gauss()*4*S,gy-rnd(3,10)*S,1.3*S,Math.random()<.3?p.lit:p.grass,.65,2);}
  for(let i=0;i<34;i++){n.fillStyle=rgba(p.flower,rnd(.6,1));n.beginPath();n.arc(rnd(-OV,W+OV),GY+rnd(-6,4)*S,rnd(.8,1.9)*S,0,TAU);n.fill();}
  /* platform */
  const pt=GY-PH,pr=AX+30*S;
  wash(n,dens([[-OV-8,H*.5+GY*.5],[-OV-8,pt],[pr,pt],[pr+3*S,pt+PH*.5],[pr+20*S,pt+PH*.5],[pr+23*S,GY+10*S],[pr+10*S,sh+8*S],[-OV-8,sh+14*S]],10*S),p.stone,{layers:9,alpha:.22,vari:.2,br:0});
  for(let yy=pt+10*S;yy<GY+6*S;yy+=11*S){stroke(n,-OV,yy,pr+(yy>pt+PH*.5?20*S:0),yy+gauss(),1.3*S,shade(p.stone,-.5),.4,2);for(let xx=rnd(8,22)*S;xx<pr;xx+=rnd(18,30)*S)stroke(n,xx,yy,xx+gauss(),yy+11*S,1.1*S,shade(p.stone,-.5),.3,2);}
  stroke(n,-OV,pt+2*S,pr,pt+2*S,4*S,shade(p.stone,.45),.4);
  for(let i=0;i<10;i++){const gx=rnd(-OV,pr);stroke(n,gx,pt+1,gx+gauss()*3*S,pt+rnd(6,18)*S,1.4*S,p.grass,.55,2);}
  const rx=AX+2*S,ry=pt+PH*.55;bloom(n,rx,ry,20*S,[255,215,120],.35);for(let i=0;i<6;i++){const a=i/6*TAU;stroke(n,rx,ry,rx+Math.cos(a)*8*S,ry+Math.sin(a)*8*S,1.5*S,[255,225,140],.95,2);}
  /* foreground rocks + reeds */
  for(const fx of[-.02,.2,.94,.72]){const cx=W*fx,r=rnd(34,62)*S,cy=H+r*.25;wash(n,circ(cx,cy,r*1.35,r,12),p.gd,{layers:8,alpha:.24,vari:.5});stroke(n,cx-r*.8,cy-r*.75,cx+r*.5,cy-r*.85,5*S,p.lit,.22);
    for(let i=0;i<12;i++){const gx=cx+rnd(-r*1.3,r*1.3);stroke(n,gx,H-rnd(0,r*.6),gx+gauss()*12*S,H-r-rnd(10,48)*S,1.8*S,i%3?p.gd:p.grass,.75,3);}}
  L=[c0,c1,c2];
  /* drifting clouds + mist */
  clouds=[];for(let i=0;i<4;i++){const w=rnd(150,260)*S,h=w*.34,c=document.createElement('canvas');c.width=w*bs|0;c.height=h*bs|0;const q=c.getContext('2d');q.scale(bs,bs);
    for(let j=0;j<8;j++)wash(q,circ(w/2+gauss()*w*.24,h*.55+gauss()*h*.1,w*rnd(.14,.24),h*rnd(.14,.24),11),j<5?p.cloud:shade(p.cloud,-.2),{layers:4,alpha:.06,vari:.5,edge:0});
    clouds.push({c,w,h,x:rnd(W),y:rnd(GY*.1,GY*.55),v:rnd(3,9)*S});}
  mistSpr=document.createElement('canvas');mistSpr.width=256;mistSpr.height=64;const q=mistSpr.getContext('2d');q.scale(1,.25);bloom(q,128,128,128,p.mist,.5);
  initWx(p);
}
function makePaper(){const t=document.createElement('canvas');t.width=t.height=256;const x=t.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,256,256);
  for(let i=0;i<50;i++)bloom(x,rnd(30,226),rnd(30,226),rnd(14,50),[190,170,140],rnd(.03,.08));
  const im=x.getImageData(0,0,256,256),d=im.data;for(let i=0;i<d.length;i+=4){const k=(Math.random()-.5)*26+(Math.random()<.03?-22:0);d[i]=clamp(d[i]+k-5,0,255);d[i+1]=clamp(d[i+1]+k-8,0,255);d[i+2]=clamp(d[i+2]+k-14,0,255);}x.putImageData(im,0,0);
  for(let i=0;i<90;i++){x.strokeStyle=`rgba(110,90,70,${rnd(.04,.1)})`;x.lineWidth=.7;x.beginPath();const a=rnd(256),b=rnd(256);x.moveTo(a,b);x.lineTo(a+rnd(-16,16),b+rnd(-16,16));x.stroke();}
  paperPat=ctx.createPattern(t,'repeat');
  vig=document.createElement('canvas');vig.width=64;vig.height=64;const v=vig.getContext('2d'),g=v.createRadialGradient(32,32,16,32,32,46);g.addColorStop(0,'rgba(60,30,50,0)');g.addColorStop(1,'rgba(50,24,44,.5)');v.fillStyle=g;v.fillRect(0,0,64,64);}
function mkSprite(w,h,ox,oy,fn){const k=S*2,c=document.createElement('canvas');c.width=w*k|0;c.height=h*k|0;const x=c.getContext('2d');x.scale(k,k);x.translate(ox,oy);fn(x);return{c,w,h,ox,oy};}
function drawSpr(s,x,y,sc=1,a=1){ctx.globalAlpha=a;ctx.drawImage(s.c,x-s.ox*S*sc,y-s.oy*S*sc,s.w*S*sc,s.h*S*sc);ctx.globalAlpha=1;}
function paintHero(){heroSpr=mkSprite(64,86,32,80,x=>{const o={layers:7,alpha:.3,vari:.16};
  bloom(x,0,-34,34,[255,240,200],.22);
  wash(x,[[-8,-30],[-1,-31],[-2,-14],[-3,0],[-10,0],[-8,-14]],HERO.hood,o);wash(x,[[0,-31],[7,-30],[8,-14],[10,0],[3,0],[2,-14]],HERO.hood,o);
  wash(x,[[-11,-3],[-2,-3],[-1,0],[-11,0]],HERO.boot,o);wash(x,[[2,-3],[11,-3],[13,0],[2,0]],HERO.boot,o);
  stroke(x,-13,-34,-7,-56,5,HERO.wood,.85,5);for(let i=0;i<3;i++)stroke(x,-8+i*1.5,-56,-9+i*2.5,-63,1.4,[255,255,255],.9,2);
  wash(x,[[-9,-54],[-2,-56],[7,-54],[9,-42],[10,-28],[4,-23],[-4,-23],[-11,-28],[-10,-42]],HERO.tunic,{layers:8,alpha:.3,vari:.14});
  stroke(x,-7,-50,6,-30,2.2,HERO.cloak,.8,3);stroke(x,-10,-30,10,-30,3,HERO.gold,.9,3);
  for(let i=0;i<4;i++)stroke(x,rnd(-6,6),-50,rnd(-7,7),-26,1.4,shade(HERO.tunic,-.3),.25,2);
  wash(x,circ(2,-61,5.6,5.8,11),HERO.skin,{layers:7,alpha:.34,vari:.08});
  wash(x,[[-6,-58],[-5,-66],[1,-70],[8,-67],[9,-63],[4,-65],[-1,-63],[-2,-56]],HERO.hood,{layers:8,alpha:.3,vari:.12});
  x.fillStyle=rgba(INK,.9);x.beginPath();x.arc(5,-61,.8,0,TAU);x.fill();});}
function enemySpr(kind,acc){const key=kind+acc;if(sprCache[key])return sprCache[key];const[bw,h,hr]=KD[kind],a=hex(acc),o={layers:8,alpha:.27,vari:.16,edge:.3};
  return sprCache[key]=mkSprite(bw*4+44,h+40,bw*2+22,h+30,x=>{const top=-h+12,hy=-h+5;
    bloom(x,0,-h*.5,h*.62,a,.26);
    if(kind==='archer'||kind==='boss'){wash(x,[[-bw*.7,top],[bw*.7,top],[bw*1.05,-h*.4],[bw*1.3,-2],[bw*.5,-5],[0,-1],[-bw*.6,-5],[-bw*1.25,-2],[-bw,-h*.4]],INK,o);
      for(let i=0;i<5;i++)stroke(x,rnd(-bw,bw),-3,rnd(-bw,bw)*1.3,rnd(2,6),1.6,INK,.5,2);}
    else if(kind==='rider'){wash(x,[[-bw*.7,top],[bw*.7,top],[bw*.8,-4],[-bw*.8,-4]],INK,o);wash(x,circ(2,0,19,7,12),shade(INK,.14),o);stroke(x,-16,-2,-26,-7,3,INK,.8,3);stroke(x,-26,-7,-31,-5,1.6,a,.9,2);}
    else wash(x,[[-bw*.85,top],[bw*.8,top],[bw*.95,-h*.4],[0,-h*.34],[-bw*.9,-h*.4]],INK,o);
    stroke(x,bw*.7,top+2,-bw*.8,-h*.42,3.2,a,.85,4);stroke(x,bw*.6,top+1,bw*1.2,top+rnd(10,16),2.6,a,.6,3);
    wash(x,circ(-1,hy,hr,hr,11),INK,{layers:8,alpha:.3,vari:.08,edge:.3});
    if(kind==='giant'||kind==='brute'||kind==='boss'){const n=kind==='boss'?3:1;for(let i=0;i<n;i++){stroke(x,-hr+1,hy-3,-hr-5-i*3,hy-12-i*5,2.2,[236,226,200],.9,3);stroke(x,hr-3,hy-3,hr+3+i*3,hy-12-i*5,2.2,[236,226,200],.9,3);}}
    else wash(x,[[-hr,hy-1],[-1,hy-hr-2],[hr+5,hy-hr-5],[hr,hy+1]],INK,{layers:6,alpha:.3,vari:.14});
    bloom(x,-3,hy,6,a,.95);x.fillStyle='#fff';for(const ex of[-4.2,-1])  {x.beginPath();x.arc(ex,hy-.3,1,0,TAU);x.fill();}
    if(kind==='brute'){wash(x,circ(-bw-2,-h*.47,8,14,14),shade(INK,.22),{layers:8,alpha:.3,vari:.06});x.strokeStyle=rgba(a,.9);x.lineWidth=1.6;x.beginPath();x.ellipse(-bw-2,-h*.47,7,13,0,0,TAU);x.stroke();bloom(x,-bw-2,-h*.47,5,a,.9);}
    if(kind==='boss'){for(let i=0;i<7;i++)stroke(x,rnd(-bw,bw),top+rnd(6,30),rnd(-bw,bw)*1.2,-rnd(4,20),1.3,a,.5,2);}
  });}
function splatSpr(acc){if(splatCache[acc])return splatCache[acc];const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),a=hex(acc),p=[];
  for(let i=0;i<18;i++){const an=i/18*TAU,r=i%2?rnd(34,58):rnd(14,26);p.push([64+Math.cos(an)*r,64+Math.sin(an)*r]);}
  wash(x,p,a,{layers:6,alpha:.13,vari:.5,edge:.12});wash(x,circ(64,64,20,20,10),INK,{layers:4,alpha:.09,vari:.6,edge:0});splat(x,64,64,60,a,40,.6,2.6);splat(x,64,64,56,INK,14,.4,1.8);return splatCache[acc]=c;}

/* ---------- state ---------- */
const fresh=()=>({best:0,bestE:0,kills:0,ink:0,sk:{},stars:[0,0,0,0,0],unlock:1,endless:false,set:{sound:true,music:true,haptics:true}});
let save=fresh();try{const s=JSON.parse(localStorage.getItem('inkbow1'));if(s)save=Object.assign(save,s);}catch(e){}
const buzz=ms=>{if(save.set.haptics&&navigator.vibrate)try{navigator.vibrate(ms);}catch(e){}};
const persist=()=>{try{localStorage.setItem('inkbow1',JSON.stringify(save));}catch(e){}};
const sk=id=>save.sk[id]||0;
let bonus=null;
const tier=()=>{let t=0;TIERS.forEach((x,i)=>{if(save.kills>=x.k)t=i;});return t;};
const G={state:'menu',pal:0,t:0,paused:false};let PS={};
let enemies=[],arrows=[],earrows=[],parts=[],texts=[],decals=[],wx=[],birds=[],aim=null,queued=null,seen={};
function reset(){Object.assign(G,{t:G.t,wave:0,score:0,combo:0,comboT:0,kills:0,xp:0,lvl:1,need:40,hp:100,maxHp:100,spirit:0,shT:0,shAge:9,shCd:0,reload:0,burn:0,poison:0,frost:0,queue:[],spawnT:0,clearT:0,slow:0,stop:0,shake:0,flash:0,hurtT:0,shots:0,bossT:0,pal:0,draw:0,sel:null,charge:0,pending:0,inkRun:0,bonusT:16,won:false,lastStars:0});
  PS={dmg:10*(1+.08*sk('o1')),multi:1+sk('o4'),pierce:0,burn:0,crit:2.5+.35*sk('o2'),reload:.42*(1-.07*sk('o3')),vamp:0,rico:0,shCd:6*(1-.08*sk('d2')),spirit:1+.12*sk('s1')};G.maxHp=100+15*sk('d1');G.hp=G.maxHp;G.spirit=25*sk('s2');G.revive=sk('d4');G.cost=25-3*sk('s3');bonus=null;
  enemies=[];arrows=[];earrows=[];parts=[];texts=[];decals=[];seen={};perches.forEach(p=>p.occ=null);}

/* ---------- helpers ---------- */
function banner(a,b,ms=2000){const el=$('banner');el.firstChild.textContent=a;el.lastChild.textContent=b||'';el.style.opacity=1;clearTimeout(banner.t);banner.t=setTimeout(()=>el.style.opacity=0,ms);}
function hint(s,ms=3600){const el=$('hint');el.textContent=s;el.style.opacity=1;clearTimeout(hint.t);hint.t=setTimeout(()=>el.style.opacity=0,ms);}
function ftext(s,x,y,c,sz=18){texts.push({s,x,y,c,sz:sz*S,t:0,vx:gauss()*14*S});}
function burst(x,y,col,n,sp=1,kind='petal'){const c=typeof col==='string'?hex(col):col;for(let i=0;i<n&&parts.length<420;i++){const a=rnd(TAU),v=rnd(30,190)*S*sp;parts.push({k:kind,x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50*S*sp,t:0,max:rnd(.5,1.2),s:rnd(2,5.5)*S,c:Math.random()<.25?INK:shade(c,gauss()*.2),r:rnd(TAU),vr:gauss()*8});}}
function decal(x,y,acc,sz=1){decals.push({x,y,c:splatSpr(acc),t:0,s:rnd(.8,1.15)*sz,r:rnd(TAU)});}
function addSpirit(v){G.spirit=Math.min(100,G.spirit+v*PS.spirit);}
function addXp(v){G.xp+=v;while(G.xp>=G.need){G.xp-=G.need;G.need=Math.round(G.need*1.32);G.lvl++;G.pending++;}if(G.pending>0&&$('perks').style.display!=='flex')openPerks();}
function addInk(v){G.inkRun+=v;save.ink+=v;}
function comboUp(){G.combo++;G.comboT=4.5;const el=$('combo');el.textContent=G.combo>1?`${G.combo} combo  ×${mult().toFixed(1)}`:'';el.style.opacity=G.combo>1?1:0;}
const mult=()=>Math.min(3,1+G.combo*.1),dm=()=>G.wave<6?.6+G.wave*.07:1+(G.wave-5)*.04;

/* ---------- waves + spawning ---------- */
function allowed(){const n=G.wave;return n<=1?[0,2]:n===2?[0,2,3]:n===3?[0,1,2,3,4]:[0,1,2,3,4,5];}
function buildWave(n){const q=[],A=(t,d)=>q.push({type:t,delay:d});
  const c=G.mode==='camp';if(c&&n===1)[['normal',.6],['normal',3],['sword',3],['normal',2.5],['sword',3],['normal',2]].forEach(a=>A(...a));
  else if(c&&n===2)[['fire',.6],['normal',2],['sprinter',2.4],['fire',2],['sword',2],['normal',1.6],['sprinter',2],['fire',1.6]].forEach(a=>A(...a));
  else if(c&&n===3)[['poison',.6],['ice',2],['brute',2],['normal',1.6],['rider',2],['fire',1.6],['sprinter',1.6],['poison',1.6],['ice',1.4]].forEach(a=>A(...a));
  else if(c&&n===4)[['boom',.6],['fan',1.8],['homing',1.8],['giant',2],['rider',1.6],['shadow',1.6],['brute',1.6],['fire',1.4],['boom',1.4],['homing',1.4]].forEach(a=>A(...a));
  else if(n%5===0)A('boss',1);
  else{const cnt=8+n,ar=Object.keys(AT),wk=['sword','sword','sprinter','sprinter','brute','giant'];for(let i=0;i<cnt;i++)A(Math.random()<.7?(Math.random()<.18?'rider':pick(ar)):pick(wk),rnd(1,2.2)*Math.max(.5,1-n*.03));}
  return q;}
function startWave(n){G.wave=n;G.queue=buildWave(n);G.spawnT=1.4;const p=PALS[G.pal%PALS.length];banner(n%5===0?BOSS[G.pal%5].n:`Wave ${n}`,n%5===0?'Strike it down':G.mode==='endless'?`Endless · ${p.name}`:p.name);sfx.wave();$('wave').textContent='Wave '+n;}
function introduce(type){if(seen[type])return;seen[type]=1;const d=AT[type]||WK[type];if(d&&type!=='normal')hint(`${d.n}: ${d.d}`);}
function spawn(type){const n=G.wave,hs=1+(n-1)*.13;introduce(type);
  const e={type,x:0,y:GY,hp:1,sc:1,flash:0,t:0,cd:rnd(.8,1.8),appear:0,state:'idle',shots:0,burn:0,wt:rnd(6),perch:null,ph:rnd(TAU),kb:0};
  if(AT[type]){e.kind='archer';e.arrow=type;e.acc=AT[type].c;e.hp=14*hs;const fr=allowed().filter(i=>!perches[i].occ);
    if(fr.length&&Math.random()<.75){const i=pick(fr);perches[i].occ=e;e.perch=i;e.x=perches[i].x;e.y=perches[i].y;}
    else{e.x=W+30*S;e.stopX=rnd(W*.52,W*.78);e.state='walk';e.sp=40*S;e.appear=1;}}
  else if(type==='rider'){e.kind='rider';e.arrow=pick(n<4?['normal','fire']:['normal','fire','ice','poison','fan','boom']);e.acc=AT[e.arrow].c;e.hp=16*hs;e.x=W+40*S;e.by=rnd(H*.2,H*.4);e.y=e.by;e.appear=1;e.cd=rnd(1.6,2.4);}
  else if(type==='boss'){e.kind='boss';e.arrow='fan';e.acc=BOSS[G.pal%5].c;e.hp=360*hs;e.sc=1.45;e.sumT=6;const i=1;if(perches[i].occ){const o=perches[i].occ;o.perch=null;o.hp=0;}perches[i].occ=e;e.perch=i;e.x=perches[i].x;e.y=perches[i].y;$('boss').style.display='block';$('boss').firstElementChild.textContent=BOSS[G.pal%5].n;}
  else{const d=WK[type];e.kind='walker';e.acc=d.c;e.hp=d.hp*hs;e.sp=d.sp*S*Math.min(1.5,1+n*.02);e.dmg=d.dmg;e.sc=d.sc||1;e.x=W+30*S;e.state='walk';e.appear=1;}
  e.max=e.hp;const k=e.kind==='walker'?type:e.kind,d=KD[k];e.bw=d[0];e.h=d[1];e.hr=d[2];e.spr=enemySpr(k,e.acc);
  if(e.perch!==null)burst(e.x,e.y-20*S,INK,10,.5,'dot');
  enemies.push(e);return e;}
function relocate(e,list){const fr=(list||allowed()).filter(i=>!perches[i].occ);if(!fr.length)return;burst(e.x,e.y-e.h*.5*S,e.acc,12,.6);decal(e.x,e.y-e.h*.5*S,e.acc,.8);perches[e.perch].occ=null;const i=pick(fr);perches[i].occ=e;e.perch=i;e.x=perches[i].x;e.y=perches[i].y;e.appear=0;}
const EG=()=>520*S;
function eArrow(e,type,Tm=1,spread=0){const sx=e.x-10*S*e.sc,sy=e.y-e.h*.62*S*e.sc,tx=AX+gauss()*20*S,ty=AY-2*S+gauss()*24*S+(type==='boom'?24*S:0);
  const dx=tx-sx,dy=ty-sy,dist=Math.hypot(dx,dy),a={type,x:sx,y:sy,owner:e,trail:[],c:AT[type].c,t:0};
  if(type==='homing'){const an=Math.atan2(dy,dx)+gauss()*.9+spread;a.sp=(120+Math.min(G.wave,12)*5)*S;a.vx=Math.cos(an)*a.sp;a.vy=Math.sin(an)*a.sp;}
  else{const T=clamp(dist/((235+Math.min(G.wave,14)*9)*S),.9,2.5)*Tm*(type==='boom'?1.35:1);a.vx=dx/T;a.vy=dy/T-.5*EG()*T;}
  earrows.push(a);}
function fire(e,type){type=type||e.arrow;if(type==='fan')[-.17,0,.17].forEach(k=>eArrow(e,'fan',1+k));else eArrow(e,type);sfx.eshoot();if(!seen._ea){seen._ea=1;setTimeout(()=>hint('Shoot their arrows out of the air, or tap the shield'),500);}}

/* ---------- combat ---------- */
function hurt(d,type){if(G.state!=='play')return;G.hp-=d;G.hurtT=.35;buzz(40);G.shake=Math.max(G.shake,7);G.combo=0;$('combo').style.opacity=0;sfx.hurt();ftext('-'+Math.round(d),AX+10*S,AY-44*S,'#ff8a7a',20);burst(AX,AY,'#d63a31',8,.7);
  if(type==='fire'){G.burn=4;}if(type==='poison'){G.poison=6;}if(type==='ice'){G.frost=4.5;ftext('Chilled',AX+20*S,AY-64*S,'#bfeeff',16);}
  if(G.hp<=0)gameOver();}
function heroHit(a){const col=a.c;
  if(G.shT>0){if(G.shAge<.36){sfx.deflect();ftext('Perfect deflect!',AX+50*S,AY-60*S,'#ffe9a8',22);G.slow=.35;comboUp();addSpirit(8);addXp(4);
      const o=a.owner&&enemies.includes(a.owner)?a.owner:enemies[0];const ang=o?Math.atan2(o.y-o.h*.5*S*o.sc-a.y,o.x-a.x):-0.5;arrows.push({x:a.x,y:a.y,vx:Math.cos(ang)*1000*S,vy:Math.sin(ang)*1000*S,trail:[],dmg:PS.dmg*4*TIERS[tier()].m,pierce:0,rico:0,hit:new Set(),spirit:1,home:o,t:0});}
    else{sfx.block();burst(a.x,a.y,col,8,.6);ftext('Blocked',AX+40*S,AY-50*S,'#cfeaff',15);}return;}
  if(a.type==='boom'){explode(a);return;}hurt(AT[a.type].dmg*dm(),a.type);decal(a.x,a.y,col,.7);}
function explode(a){sfx.boom();G.shake=Math.max(G.shake,12);burst(a.x,a.y,a.c,26,1.5);decal(a.x,a.y,a.c,1.8);parts.push({k:'ring',x:a.x,y:a.y,t:0,max:.4,s:78*S,c:hex(a.c)});
  const d=Math.hypot(a.x-AX,a.y-AY);if(d<80*S){if(G.shT>0){sfx.block();ftext('Blocked',AX+40*S,AY-50*S,'#cfeaff',15);}else hurt(AT.boom.dmg*(1-d/(80*S)*.6)*dm(),'boom');}}
function hitEnemy(e,ar,head){const bow=TIERS[tier()].m;let d=ar.dmg*(head?PS.crit:1);e.hp-=d;e.flash=.16;e.kb=5*S;if(PS.burn)e.burn=3;if(ar.sp==='gale'&&e.kind==='walker'&&e.type!=='giant'){e.x+=46*S;e.state='walk';}if(head&&e.x-AX>W*.55&&!ar.spirit){ftext('Deadeye!',e.x,e.y-(e.h+26)*S*e.sc,'#ffe9a8',17);G.score+=20;}
  const hx=ar.x,hy=ar.y;decal(hx,hy,e.acc,head?1.2:.8);burst(hx,hy,e.acc,head?12:6,head?1:.7);ftext(head?`${Math.round(d)}!`:Math.round(d),hx,hy-12*S,head?'#ffe07a':'#fff',head?24:17);
  G.stop=head?.07:.035;if(head){G.slow=Math.max(G.slow,.22);G.shake=Math.max(G.shake,5);sfx.crit();buzz(12);if(!seen._hs){seen._hs=1;}}sfx.hit();
  if(e.hp<=0)kill(e);}
function kill(e){if(e.dead)return;e.dead=true;if(e.perch!==null)perches[e.perch].occ=null;const cx=e.x,cy=e.y-e.h*.5*S*e.sc,boss=e.kind==='boss';
  G.kills++;save.kills++;addInk(boss?25:e.type==='giant'?4:1);const t0=tier();const val=boss?500:e.type==='giant'?80:e.kind==='rider'?30:20;G.score+=Math.round(val*mult());comboUp();if(G.combo%5===0)ftext(G.combo+' streak!',cx,cy-40*S,'#ffe9a8',22);else if(e.kind==='rider')ftext('Skyshot!',cx,cy-26*S,'#bfeeff',17);
  burst(cx,cy,e.acc,boss?70:18,boss?1.8:1);decal(cx,cy,e.acc,boss?3:1.5);
  for(let i=0;i<(boss?24:6);i++)parts.push({k:'wisp',x:cx+gauss()*14*S,y:cy+gauss()*14*S,vx:gauss()*130*S,vy:-rnd(40,170)*S,t:0,max:1.5,s:rnd(2.5,4.5)*S,c:hex(e.acc),sp:(boss?40:15)/(boss?24:6)*(1+G.combo*.04)});
  addXp(boss?90:e.type==='giant'?40:e.type==='brute'?18:e.kind==='rider'?16:12);if(PS.vamp)G.hp=Math.min(G.maxHp,G.hp+PS.vamp);
  if(boss){buzz(120);G.slow=1.2;G.shake=16;$('boss').style.display='none';enemies.forEach(o=>{if(o!==e&&!o.dead)setTimeout(()=>kill(o),200);});earrows.length=0;sfx.spirit();bossDown();}
  if(tier()>t0){banner(TIERS[tier()].n,'Your bow awakens',2600);sfx.perk();}persist();}
function bossDown(){save.endless=true;if(G.mode!=='camp')return;const r=G.wave/5|0,f=G.hp/G.maxHp,st=f>=.7?3:f>=.35?2:1;save.stars[r-1]=Math.max(save.stars[r-1]||0,st);save.unlock=Math.max(save.unlock,Math.min(5,r+1));G.lastStars=st;if(r>=5)G.won=true;}
function pExplode(a){const bow=TIERS[tier()].m,R=78*S;sfx.boom();G.shake=Math.max(G.shake,9);burst(a.x,a.y,'#ff8a3c',24,1.4);decal(a.x,a.y,'#ff7a2e',1.9);parts.push({k:'ring',x:a.x,y:a.y,t:0,max:.4,s:R,c:[255,150,70]});
  for(const e of enemies){if(e.dead||a.hit.has(e))continue;const cy=e.y-e.h*.5*S*e.sc;if(Math.hypot(e.x-a.x,cy-a.y)<R+e.bw*S){e.hp-=24*bow;e.burn=3;e.flash=.16;ftext(Math.round(24*bow),e.x,cy-14*S,'#ffb070',17);if(e.hp<=0)kill(e);}}
  for(const b of earrows)if(!b.dead&&Math.hypot(b.x-a.x,b.y-a.y)<R){b.dead=true;burst(b.x,b.y,b.c,5,.5);}}
function chain(e){const bow=TIERS[tier()].m;let from=e,n=0;const used=new Set([e]),D=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
  while(n<4){const f=from,o=enemies.filter(q=>!q.dead&&!used.has(q)&&D(q,f)<300*S).sort((p,q)=>D(p,f)-D(q,f))[0];if(!o)break;used.add(o);
    const x1=f.x,y1=f.y-f.h*.5*S*f.sc,x2=o.x,y2=o.y-o.h*.5*S*o.sc,pts=[];for(let i=0;i<=6;i++)pts.push(lerp(x1,x2,i/6)+(i%6?gauss()*14*S:0),lerp(y1,y2,i/6)+(i%6?gauss()*14*S:0));
    parts.push({k:'bolt',pts,t:0,max:.25});o.hp-=16*bow;o.flash=.16;ftext(Math.round(16*bow),x2,y2-14*S,'#bfe0ff',17);burst(x2,y2,'#9fd0ff',5,.6,'dot');if(o.hp<=0)kill(o);from=o;n++;}
  if(n)sfx.zap();}
function grabBonus(){const b=bonus;bonus=null;addInk(8);G.hp=Math.min(G.maxHp,G.hp+15);addSpirit(25);G.score+=50;burst(b.x,b.y,'#ffd76a',22,1.1);decal(b.x,b.y,'#ffd76a',1.2);ftext('+8 ink',b.x,b.y-14*S,'#ffe9a8',20);sfx.perk();}
function selArrow(a){if(G.state!=='play'||G.paused)return;if(G.spirit<G.cost){ftext('Need spirit',AX+34*S,AY-62*S,'#ffe9a8',15);return;}G.sel=G.sel===a?null:a;if(!seen['_'+a]){seen['_'+a]=1;hint({ember:'Ember arrow: explodes on impact',storm:'Storm arrow: lightning leaps between foes',gale:'Gale volley: five piercing arrows that push walkers back'}[a]);}}
function shootArrow(ang,pow,ch){let sp=G.sel;if(sp&&G.spirit<G.cost)sp=G.sel=null;if(sp){G.spirit-=G.cost;if(G.spirit<G.cost)G.sel=null;if(sp==='storm')sfx.zap();}if(ch)sfx.ping();G.charge=0;G.reload=PS.reload*(G.frost>0?2.1:1);G.shots++;const n=PS.multi+(sp==='gale'?4:0),v=(430+800*pow)*S*(sp==='gale'?1.1:1),bow=TIERS[tier()].m;
  for(let i=0;i<n;i++){const a=ang+(i-(n-1)/2)*.075;arrows.push({x:AX+Math.cos(a)*20*S,y:AY+Math.sin(a)*20*S,vx:Math.cos(a)*v,vy:Math.sin(a)*v,trail:[],dmg:PS.dmg*bow*(.75+pow*.35)*(ch?1.6:1),pierce:PS.pierce+(sp==='gale'?3:0)+(ch?1:0),rico:PS.rico,hit:new Set(),t:0,sp,ch});}
  sfx.shoot(pow);G.draw=-.12;}
function starfall(){if(G.spirit<100||G.state!=='play'||G.paused)return;G.spirit=0;sfx.spirit();G.slow=.6;G.flash=.5;G.shake=8;banner('Starfall','',900);
  earrows.forEach(a=>{burst(a.x,a.y,a.c,6,.6);});earrows.length=0;const bow=TIERS[tier()].m;
  enemies.forEach((e,i)=>{const n=(e.kind==='boss'?5:e.type==='giant'?3:1)*(1+sk('s4'));for(let j=0;j<n;j++){const sx=e.x+gauss()*60*S-80*S,sy=-30-i*40-j*70;const ty=e.y-e.h*.6*S*e.sc,an=Math.atan2(ty-sy,e.x-sx);arrows.push({x:sx,y:sy,vx:Math.cos(an)*1100*S,vy:Math.sin(an)*1100*S,trail:[],dmg:34*bow,pierce:0,rico:0,hit:new Set(),spirit:1,home:e,t:0});}});}
function shield(){if(G.shCd>0||G.state!=='play'||G.paused)return;G.shT=1.25;G.shAge=0;G.shCd=PS.shCd;sfx.shield();}
function gameOver(win){if(!win&&G.revive>0){G.revive--;G.hp=G.maxHp*.5;G.burn=G.poison=G.frost=0;earrows.length=0;G.shT=2.2;G.shAge=9;G.flash=.5;G.slow=.6;banner('Second Wind','You rise again',1600);sfx.spirit();burst(AX,AY,'#ffd76a',30,1.3);return;}
  G.state='over';if(win)sfx.spirit();else sfx.die();const E=G.mode==='endless';if(E){if(G.score>save.bestE)save.bestE=G.score;}else if(G.score>save.best)save.best=G.score;persist();aim=null;
  setTimeout(()=>{$('hud').style.display='none';$('tint').style.opacity=0;const t=tier(),nx=TIERS[t+1];$('oTitle').textContent=win?'The kingdom endures':'The light fades';
    $('oStats').innerHTML=`Score <b>${G.score}</b> · Best ${E?save.bestE:save.best}<br>${E?'Endless':'Campaign'} wave ${G.wave} · ${G.kills} foes felled<br>+${G.inkRun} ink earned · ${save.ink} to spend`;
    $('oBow').textContent=nx?`${TIERS[t].n}. ${nx.k-save.kills} more kills awaken the ${nx.n}.`:`${TIERS[t].n}, fully awakened.`;$('over').style.display='flex';},win?1700:900);}

/* ---------- perks ---------- */
const PERKS=[{n:'Twin Shot',d:'Loose one more arrow with every shot.',c:'#e0863a',f:()=>PS.multi++,max:3},{n:'Piercing Wind',d:'Arrows pass through one more foe.',c:'#6fb8d9',f:()=>PS.pierce++,max:3},{n:'Ember Tip',d:'Your hits set enemies burning.',c:'#e2543a',f:()=>PS.burn++,max:1},
 {n:'Keen Eye',d:'Headshots deal far more damage.',c:'#d9b23a',f:()=>PS.crit+=.9},{n:'Swift Nock',d:'Ready your next arrow 25% faster.',c:'#8fc46a',f:()=>PS.reload*=.75,max:4},{n:'Heartwood',d:'+25 max health and heal 40.',c:'#c8506a',f:()=>{G.maxHp+=25;G.hp=Math.min(G.maxHp,G.hp+40);}},
 {n:'Spirit Drinker',d:'Each kill restores 3 health.',c:'#b56ad0',f:()=>PS.vamp+=3},{n:'Ricochet',d:'Arrows leap to one more nearby foe.',c:'#4fb0a0',f:()=>PS.rico++,max:3},{n:'Quick Aegis',d:'Shield recharges 25% faster.',c:'#6f9ae0',f:()=>PS.shCd*=.75,max:3},
 {n:'Spirit Well',d:'Starfall charges 40% faster.',c:'#e0c04a',f:()=>PS.spirit*=1.4,max:3},{n:'Heavy Draw',d:'+30% arrow damage.',c:'#a05a3a',f:()=>PS.dmg*=1.3}];
function openPerks(){G.paused=true;aim=null;sfx.perk();const pool=PERKS.filter(p=>!p.max||(p.cnt||0)<p.max),ch=[];while(ch.length<3&&pool.length)ch.push(pool.splice(Math.random()*pool.length|0,1)[0]);
  $('perks').firstElementChild.textContent=G.pending>1?`Choose a blessing (${G.pending} left)`:'Choose a blessing';const pc=$('pc');pc.innerHTML='';ch.forEach(p=>{const b=document.createElement('button');b.className='pk';b.style.setProperty('--c',p.c);b.innerHTML=`<b class="k">${p.n}</b><span>${p.d}</span>`;b.onclick=()=>{p.cnt=(p.cnt||0)+1;p.f();G.pending=Math.max(0,G.pending-1);if(G.pending>0){openPerks();return;}$('perks').style.display='none';G.paused=false;last=performance.now();};pc.appendChild(b);});
  $('perks').style.display='flex';}

/* ---------- update ---------- */
function update(dt){G.t+=dt;
  clouds.forEach(c=>{c.x+=c.v*dt;if(c.x>W+OV)c.x=-c.w-OV;});
  updWx(dt);
  if(G.state!=='play'){updParts(dt);return;}
  if(G.stop>0){G.stop-=dt;return;}
  if(G.slow>0){G.slow-=dt;dt*=.3;}
  G.reload-=dt;G.shCd-=dt;G.shT-=dt;G.shAge+=dt;G.hurtT-=dt;G.flash-=dt;G.shake*=Math.pow(.02,dt);G.draw=lerp(G.draw,aim?clamp(aim.pull/(110*S),0,1):0,.4);
  if(G.comboT>0){G.comboT-=dt;if(G.comboT<=0){G.combo=0;$('combo').style.opacity=0;}}
  if(G.burn>0){G.burn-=dt;G.hp-=2.5*dt;if(Math.random()<dt*14)burst(AX+gauss()*8*S,AY+gauss()*20*S,'#ff7a2e',1,.3,'dot');}
  if(G.poison>0){G.poison-=dt;G.hp-=2*dt;if(Math.random()<dt*10)burst(AX+gauss()*8*S,AY+gauss()*20*S,'#86d94c',1,.3,'dot');}
  if(G.frost>0)G.frost-=dt;
  if(G.hp<=0){gameOver();return;}
  if(queued&&G.reload<=0){shootArrow(queued.a,queued.p,queued.ch);queued=null;}
  if(aim&&aim.pull>=108*S){const c0=G.charge;G.charge+=dt;if(c0<.55&&G.charge>=.55){sfx.ping();if(!seen._ch){seen._ch=1;hint('Power Shot: hold a full draw for a moment');}}}else G.charge=0;
  G.bonusT-=dt;if(G.bonusT<=0&&!bonus&&enemies.length){G.bonusT=rnd(24,34);bonus={x:W+30,y0:rnd(H*.17,H*.33),y:0,t:0,ph:rnd(TAU)};bonus.y=bonus.y0;if(!seen._bn){seen._bn=1;hint('A lantern spirit! Shoot it for ink, health and spirit');}}
  if(bonus){bonus.t+=dt;bonus.x-=48*S*dt;bonus.y=bonus.y0+Math.sin(bonus.t*2+bonus.ph)*14*S;if(bonus.x<-40)bonus=null;}
  /* waves */
  const cap=Math.min(3+(G.wave>>1),7);
  if(G.queue.length){G.spawnT-=dt;if(G.spawnT<=0&&enemies.length<cap){spawn(G.queue.shift().type);G.spawnT=G.queue.length?G.queue[0].delay:0;}}
  else if(!enemies.length&&G.clearT<=0&&G.wave>0){G.clearT=2.4;G.hp=Math.min(G.maxHp,G.hp+12+6*sk('d3'));addInk(5);const st=G.lastStars||1;banner(G.won?'Victory':G.wave%5===0?'Realm cleansed':'Wave cleared',G.wave%5===0?(G.mode==='camp'?'★'.repeat(st)+'☆'.repeat(3-st):'A new sky opens'):'',1500);}
  if(G.clearT>0){G.clearT-=dt;if(G.clearT<=0){G.clearT=0;if(G.won){gameOver(true);}else if(G.wave%5===0){const nw=G.wave+1;G.wave=-1;$('fade').style.opacity=1;setTimeout(()=>{G.pal++;buildScene();$('fade').style.opacity=0;startWave(nw);},700);}else startWave(G.wave+1);}}
  /* enemies */
  const n=G.wave,tele=n<3?.9:.75,fcd=()=>rnd(2.6,3.8)*Math.max(.6,1-n*.025);
  for(const e of enemies){e.t+=dt;e.flash-=dt;e.appear=Math.min(1,e.appear+dt*2.2);e.kb*=Math.pow(.001,dt);
    if(e.burn>0){e.burn-=dt;e.hp-=5*dt;if(Math.random()<dt*10)burst(e.x,e.y-e.h*.5*S,'#ff7a2e',1,.3,'dot');if(e.hp<=0){kill(e);continue;}}
    if(e.kind==='walker'){const sx=AX+(38+e.bw*e.sc)*S;if(e.state==='walk'){e.x-=e.sp*dt;e.wt+=dt*e.sp/(5*S);if(e.x<=sx){e.x=sx;e.state='atk';e.cd=.5;}}
      else{e.cd-=dt;if(e.cd<=0){e.cd=1.3;e.lunge=.25;if(G.shT>0){sfx.block();e.x+=26*S;e.state='walk';ftext('Blocked',AX+40*S,AY-50*S,'#cfeaff',15);}else hurt(e.dmg*dm());}}
      if(e.lunge>0)e.lunge-=dt;continue;}
    if(e.kind==='rider'){e.x+=((W*(.68+.2*Math.sin(e.t*.45+e.ph)))-e.x)*dt*.9;e.y=e.by+Math.sin(e.t*1.3+e.ph)*20*S;}
    if(e.state==='walk'){e.x-=e.sp*dt;e.wt+=dt*8;if(e.x<=e.stopX){e.state='idle';e.cd=rnd(.5,1.2);}continue;}
    if(e.kind==='boss'){e.sumT-=dt;if(e.sumT<=0&&enemies.length<4){e.sumT=9;spawn(pick(e.hp<e.max*.5?['shadow','boom','ice','homing']:['fire','poison','normal']));}
      $('boss').querySelector('i').style.width=clamp(e.hp/e.max*100,0,100)+'%';}
    if(e.appear<1)continue;
    if(e.state==='idle'){e.cd-=dt;if(e.cd<=0){e.state='aim';e.tt=e.kind==='boss'&&e.hp<e.max*.5?.55:tele;e.t2=e.tt;}}
    else if(e.state==='aim'){e.t2-=dt;if(e.t2<=0){e.shots++;e.state='idle';
        if(e.kind==='boss'){const ph2=e.hp<e.max*.5,k=e.shots%3,B=BOSS[G.pal%5];if(k===0){[-.2,-.1,0,.1,.2].forEach(q=>eArrow(e,ph2?B.a[1]:B.a[0],1+q));}else if(k===1){eArrow(e,'homing',1,-.5);eArrow(e,'homing',1,.5);if(ph2)eArrow(e,'homing');}else{eArrow(e,'boom',.9);eArrow(e,'boom',1.15);if(ph2)eArrow(e,B.a[2],1.3);}
          sfx.eshoot();e.cd=ph2?1.5:2.1;if(e.shots%2===0)relocate(e,[1,3,4,5]);}
        else{fire(e);e.cd=fcd();if(e.kind==='archer'){if(e.perch===null){if(e.shots%2===0&&e.stopX>W*.46){e.stopX-=rnd(30,56)*S;e.state='walk';}}else if(e.shots%3===0)relocate(e);}}}}
  }
  enemies=enemies.filter(e=>!e.dead);
  /* player arrows */
  const gr=950*S;
  for(const a of arrows){a.t+=dt;if(a.stuck){a.stuck-=dt;continue;}
    for(let s=0;s<3&&!a.dead&&!a.stuck;s++){const h=dt/3;if(a.home&&!a.home.dead){const o=a.home,an=Math.atan2(o.y-o.h*.55*S*o.sc-a.y,o.x-a.x),v=Math.hypot(a.vx,a.vy);a.vx=Math.cos(an)*v;a.vy=Math.sin(an)*v;}else if(!a.spirit)a.vy+=gr*h;
      a.x+=a.vx*h;a.y+=a.vy*h;
      for(const e of enemies){if(e.dead||a.hit.has(e)||e.appear<.5)continue;const sc=e.sc*S,hx=e.x-1*sc,hy=e.y-(e.h-5)*sc,hr=(e.hr+3)*sc;let head=(a.x-hx)**2+(a.y-hy)**2<hr*hr,body=false;
        if(!head){const bx=(a.x-e.x)/((e.bw+5)*sc),by=(a.y-(e.y-e.h*.42*sc))/(e.h*.44*sc);body=bx*bx+by*by<1;}
        if(!head&&!body)continue;
        if(body&&e.type==='brute'&&!a.spirit&&a.vx>0&&a.vy<Math.abs(a.vx)*1.1&&a.x<e.x){sfx.block();ftext('Shield!',a.x,a.y-10*S,'#cfd8e6',15);burst(a.x,a.y,'#cfd8e6',5,.5,'dot');a.vx*=-.25;a.vy=-120*S;a.hit.add(e);a.pierce=0;a.rico=0;a.dmg=0;if(!seen._br){seen._br=1;hint('Shield Brute: aim for the head, or lob an arrow over the shield');}break;}
        if(a.dmg<=0)continue;a.hit.add(e);hitEnemy(e,a,head);if(a.sp==='ember'){pExplode(a);a.dead=true;break;}if(a.sp==='storm')chain(e);
        if(a.rico>0){const o=enemies.filter(q=>!q.dead&&!a.hit.has(q)).sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y))[0];if(o){a.rico--;const an=Math.atan2(o.y-o.h*.55*S*o.sc-a.y,o.x-a.x);a.vx=Math.cos(an)*820*S;a.vy=Math.sin(an)*820*S-60*S;continue;}}
        if(a.pierce>0)a.pierce--;else a.dead=true;break;}
      if(a.dead)break;
      for(const b of earrows){if(b.dead)continue;if((a.x-b.x)**2+(a.y-b.y)**2<(17*S)**2){b.dead=true;sfx.parry();burst(b.x,b.y,b.c,10,.8);decal(b.x,b.y,b.c,.6);ftext('Intercept!',b.x,b.y-10*S,'#ffe9a8',15);comboUp();addXp(3);addSpirit(4);G.score+=Math.round(5*mult());G.slow=Math.max(G.slow,.08);if(b.type==='boom'){b.x=a.x;explode(b);}}}
      if(bonus&&(a.x-bonus.x)**2+(a.y-bonus.y)**2<(24*S)**2)grabBonus();
      if(a.y>=GY&&a.vy>0){a.y=GY;a.stuck=1.6;if(a.spirit)a.dead=true;if(a.sp==='ember'){pExplode(a);a.dead=true;}}
      if(a.x>W+60||a.x<-60||a.y>H+40||a.t>6)a.dead=true;}
    a.trail.push(a.x,a.y);if(a.trail.length>18)a.trail.splice(0,2);if(a.stuck<=0&&a.stuck!==undefined)a.dead=true;}
  arrows=arrows.filter(a=>!a.dead);
  /* enemy arrows */
  for(const a of earrows){a.t+=dt;if(a.type==='homing'){const want=Math.atan2(AY-a.y,AX-a.x);let cur=Math.atan2(a.vy,a.vx),d=((want-cur+Math.PI*3)%TAU)-Math.PI;cur+=clamp(d,-1.7*dt,1.7*dt)+Math.sin(a.t*5)*dt*.8;a.vx=Math.cos(cur)*a.sp;a.vy=Math.sin(cur)*a.sp;if(a.t>10)a.dead=true;}else a.vy+=EG()*dt;
    a.x+=a.vx*dt;a.y+=a.vy*dt;a.trail.push(a.x,a.y);if(a.trail.length>14)a.trail.splice(0,2);
    const ex=(a.x-AX)/(15*S),ey=(a.y-(AY-4*S))/(34*S);
    if(G.shT>0&&(a.x-AX)**2+(a.y-AY)**2<(46*S)**2){a.dead=true;heroHit(a);}
    else if(ex*ex+ey*ey<1){a.dead=true;heroHit(a);}
    else if(a.y>=GY||(a.x<AX+30*S&&a.y>=GY-PH)){a.dead=true;if(a.type==='boom')explode(a);else burst(a.x,a.y,a.c,3,.3,'dot');}
    else if(a.x<-40||a.y>H)a.dead=true;}
  earrows=earrows.filter(a=>!a.dead);
  updParts(dt);
  for(const t of texts){t.t+=dt;t.y-=38*S*dt;t.x+=t.vx*dt;}texts=texts.filter(t=>t.t<.9);
  for(const d of decals)d.t+=dt;decals=decals.filter(d=>d.t<1.3);
}
function updParts(dt){for(const p of parts){p.t+=dt;if(p.k==='ring'||p.k==='bolt')continue;
    if(p.k==='wisp'){if(p.t>.35){const dx=AX-p.x,dy=AY-p.y,d=Math.hypot(dx,dy)||1;p.vx=lerp(p.vx,dx/d*620*S,.12);p.vy=lerp(p.vy,dy/d*620*S,.12);if(d<16*S){p.t=p.max;addSpirit(p.sp||0);}}else{p.vx*=.94;p.vy*=.94;}}
    else{p.vy+=(p.k==='dot'?-40:240)*S*dt;p.vx*=.985;p.r+=p.vr*dt;}
    p.x+=p.vx*dt;p.y+=p.vy*dt;}
  parts=parts.filter(p=>p.t<p.max);}
function initWx(p){const n=p.wx==='rain'?90:46;wx=[];for(let i=0;i<n;i++)wx.push({x:rnd(W),y:rnd(H),s:rnd(.6,1.5),ph:rnd(TAU),k:p.wx});
  birds=[];if(p.wx!=='rain'&&p.wx!=='wisp')for(let i=0;i<4;i++)birds.push({x:rnd(W),y:rnd(GY*.15,GY*.5),v:rnd(14,30)*S,ph:rnd(TAU),s:rnd(.7,1.2)});G.light=rnd(4,9);}
function updWx(dt){for(const w of wx){const k=w.k;if(k==='ember'){w.y-=22*w.s*S*dt;w.x+=Math.sin(G.t+w.ph)*10*dt;}else if(k==='snow'){w.y+=34*w.s*S*dt;w.x+=Math.sin(G.t*.8+w.ph)*14*dt-6*dt;}
    else if(k==='leaf'){w.y+=30*w.s*S*dt;w.x-=(26+Math.sin(G.t*1.5+w.ph)*22)*S*dt;}else if(k==='rain'){w.y+=620*w.s*S*dt;w.x-=150*S*dt;}else{w.y-=12*w.s*S*dt;w.x+=Math.sin(G.t*.6+w.ph)*8*dt;}
    if(w.y<-10){w.y=H+5;w.x=rnd(W);}if(w.y>H+10){w.y=-5;w.x=rnd(W+60);}if(w.x<-20)w.x=W+10;}
  birds.forEach(b=>{b.x-=b.v*dt;if(b.x<-30){b.x=W+30;b.y=rnd(GY*.15,GY*.5);}});
  if(wx.length&&wx[0].k==='rain'){G.light-=dt;if(G.light<=0){G.light=rnd(5,11);G.bolt=.3;}}if(G.bolt>0)G.bolt-=dt;}

/* ---------- draw ---------- */
function drawBow(x,y,ang,pull,sz,col,glow){ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.lineCap='round';const bx=sz*(.62-pull*.18);
  if(glow){ctx.strokeStyle=rgba(col,.25);ctx.lineWidth=sz*.42;ctx.beginPath();ctx.moveTo(0,-sz);ctx.quadraticCurveTo(bx,0,0,sz);ctx.stroke();}
  ctx.strokeStyle=rgba(shade(col,-.45),.9);ctx.lineWidth=sz*.17;ctx.beginPath();ctx.moveTo(0,-sz);ctx.quadraticCurveTo(bx,0,0,sz);ctx.stroke();
  ctx.strokeStyle=rgba(col,.95);ctx.lineWidth=sz*.1;ctx.beginPath();ctx.moveTo(0,-sz);ctx.quadraticCurveTo(bx,0,0,sz);ctx.stroke();
  ctx.strokeStyle='rgba(255,250,235,.85)';ctx.lineWidth=Math.max(.7,sz*.035);ctx.beginPath();ctx.moveTo(0,-sz);ctx.lineTo(-pull*sz*.75,0);ctx.lineTo(0,sz);ctx.stroke();ctx.restore();}
function drawArrow(x,y,ang,len,shaft,tip,a=1){const c=Math.cos(ang),s=Math.sin(ang),tx=x-c*len,ty=y-s*len;ctx.globalAlpha=a;ctx.lineCap='round';
  ctx.strokeStyle=shaft;ctx.lineWidth=1.7*S;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(x,y);ctx.stroke();
  ctx.fillStyle=tip;ctx.beginPath();ctx.moveTo(x+c*5*S,y+s*5*S);ctx.lineTo(x-c*3*S-s*2.6*S,y-s*3*S+c*2.6*S);ctx.lineTo(x-c*3*S+s*2.6*S,y-s*3*S-c*2.6*S);ctx.fill();
  ctx.strokeStyle=tip;ctx.lineWidth=1.2*S;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx-c*4*S-s*3*S,ty-s*4*S+c*3*S);ctx.moveTo(tx,ty);ctx.lineTo(tx-c*4*S+s*3*S,ty-s*4*S-c*3*S);ctx.stroke();ctx.globalAlpha=1;}
function trail(t,col,w,al){const n=t.length/2;if(n<2)return;ctx.lineCap='round';for(let i=1;i<n;i++){const f=i/n;ctx.strokeStyle=rgba(col,al*f*f);ctx.lineWidth=w*f;ctx.beginPath();ctx.moveTo(t[i*2-2],t[i*2-1]);ctx.lineTo(t[i*2],t[i*2+1]);ctx.stroke();
    if(i%2){ctx.strokeStyle=rgba(col,al*f*.5);ctx.lineWidth=w*f*.4;ctx.beginPath();ctx.moveTo(t[i*2-2]+2*S,t[i*2-1]-2.5*S);ctx.lineTo(t[i*2]+2*S,t[i*2+1]-2.5*S);ctx.stroke();}}}
function glowDot(x,y,r,col,a){ctx.fillStyle=rgba(col,a*.22);ctx.beginPath();ctx.arc(x,y,r*2.4,0,TAU);ctx.fill();ctx.fillStyle=rgba(col,a*.5);ctx.beginPath();ctx.arc(x,y,r*1.4,0,TAU);ctx.fill();ctx.fillStyle=rgba(shade(col,.6),a);ctx.beginPath();ctx.arc(x,y,r*.7,0,TAU);ctx.fill();}
function aimVec(){if(!aim)return null;const dx=aim.sx-aim.x,dy=aim.sy-aim.y,pull=Math.hypot(dx,dy);aim.pull=pull;if(pull<10*S)return null;return{a:Math.atan2(dy,dx),p:clamp(pull/(110*S),.05,1)*(G.frost>0?.85:1)};}
function drawHero(){const p=PALS[G.pal%PALS.length],fy=GY-PH,bob=Math.sin(G.t*2)*1.2*S,av=aimVec(),ang=av?av.a:-.22+Math.sin(G.t*1.1)*.04,pull=clamp(G.draw,0,1),tr=TIERS[tier()],bc=hex(tr.c);
  /* cloak */
  const sx=AX-5*S,sy=fy-52*S+bob,pts=[],pts2=[];for(let i=0;i<=7;i++){const f=i/7,wv=Math.sin(G.t*3.2-i*.75)*f*7*S+Math.sin(G.t*5.1-i*1.3)*f*2*S,x=sx-f*40*S,y=sy+f*f*30*S+wv;pts.push([x,y-f*9*S]);pts2.unshift([x+2*S,y+(6+f*12)*S]);}
  ctx.fillStyle=rgba(HERO.cloak,.82);poly(ctx,pts.concat(pts2));ctx.fill();ctx.fillStyle=rgba(shade(HERO.cloak,-.35),.4);poly(ctx,pts.slice(2).concat(pts2.slice(0,-2).map(q=>[q[0],q[1]-4*S])));ctx.fill();
  ctx.strokeStyle=rgba(shade(HERO.cloak,.4),.6);ctx.lineWidth=1.2*S;ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.stroke();
  drawSpr(heroSpr,AX,fy+bob*.4);
  if(G.frost>0){ctx.fillStyle='rgba(170,230,255,.22)';ctx.beginPath();ctx.ellipse(AX,AY,20*S,40*S,0,0,TAU);ctx.fill();}
  const bx=AX+Math.cos(ang)*15*S,by=AY+bob+Math.sin(ang)*15*S,sz=25*S;
  const sp=G.spirit/100;if(sp>.05)glowDot(bx,by,(5+sp*9)*S,[255,222,140],.15+sp*.5);
  ctx.strokeStyle=rgba(HERO.skin,1);ctx.lineWidth=3.2*S;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(AX+3*S,AY-9*S+bob);ctx.lineTo(bx,by);ctx.stroke();
  drawBow(bx,by,ang,pull,sz,bc,tier()>0);
  const px=bx-Math.cos(ang)*pull*sz*.75,py=by-Math.sin(ang)*pull*sz*.75;
  ctx.strokeStyle=rgba(HERO.skin,1);ctx.lineWidth=3*S;ctx.beginPath();ctx.moveTo(AX-2*S,AY-9*S+bob);ctx.lineTo(px,py);ctx.stroke();
  if(G.reload<=.06&&G.state!=='over'){const tx=px+Math.cos(ang)*27*S,ty=py+Math.sin(ang)*27*S;drawArrow(tx,ty,ang,27*S,'#f6ecd2',rgba(bc,1));if(G.sel&&G.state==='play')glowDot(tx,ty,5*S,SPC[G.sel],.9);if(G.charge>=.55)glowDot(tx,ty,(6+Math.sin(G.t*18)*1.5)*S,[255,240,170],1);}
  if(G.shT>0){const a=clamp(G.shT/.3,0,1),r=46*S+Math.sin(G.t*20)*1.5*S;ctx.strokeStyle=`rgba(170,225,255,${.75*a})`;ctx.lineWidth=3*S;ctx.beginPath();ctx.arc(AX,AY,r,0,TAU);ctx.stroke();ctx.fillStyle=`rgba(170,225,255,${.16*a})`;ctx.fill();
    if(G.shAge<.36){ctx.strokeStyle=`rgba(255,240,180,${.9*a})`;ctx.lineWidth=2*S;ctx.beginPath();ctx.arc(AX,AY,r+5*S,0,TAU);ctx.stroke();}}
  /* aim preview */
  if(av&&G.state==='play'){const v=(430+800*av.p)*S,vx=Math.cos(av.a)*v,vy=Math.sin(av.a)*v,ox=AX+Math.cos(av.a)*20*S,oy=AY+Math.sin(av.a)*20*S;
    for(let i=1;i<=18;i++){const t=i*.042,x=ox+vx*t,y=oy+vy*t+.5*950*S*t*t;if(y>GY)break;const f=1-i/19;ctx.fillStyle=`rgba(255,250,230,${.85*f})`;ctx.beginPath();ctx.arc(x,y,(1.2+2.4*f)*S,0,TAU);ctx.fill();}
    ctx.strokeStyle='rgba(255,250,230,.35)';ctx.lineWidth=1.5*S;ctx.setLineDash([4*S,5*S]);ctx.beginPath();ctx.moveTo(aim.sx,aim.sy);ctx.lineTo(aim.x,aim.y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(255,250,230,.3)';ctx.beginPath();ctx.arc(aim.x,aim.y,9*S,0,TAU);ctx.fill();}
}
function drawEnemy(e){const sc=e.sc,k=sc*S,a=e.appear,ac=hex(e.acc),bob=e.kind==='walker'?Math.abs(Math.sin(e.wt))*2*k:Math.sin(e.t*2+e.ph)*1*k,x=e.x+e.kb,y=e.y-bob+(e.kind==='rider'?0:0);
  ctx.globalAlpha=a;
  if(e.kind==='walker'||(e.kind==='archer'&&e.perch===null)){const sw=e.state==='walk'?Math.sin(e.wt):0,hip=y-e.h*.38*k;ctx.strokeStyle=rgba(INK,.92);ctx.lineWidth=(e.kind==='walker'?4:0)*k+.01;ctx.lineCap='round';
    if(e.kind==='walker'){ctx.beginPath();ctx.moveTo(x-2*k,hip);ctx.lineTo(x-2*k+sw*7*k,e.y);ctx.moveTo(x+2*k,hip);ctx.lineTo(x+2*k-sw*7*k,e.y);ctx.stroke();}}
  if(e.kind==='rider'){const fl=Math.sin(e.t*9)*.7;ctx.fillStyle=rgba(INK,.78);for(const s of[-1,1]){ctx.beginPath();ctx.moveTo(x+2*k,y-4*k);ctx.lineTo(x+(6+s*4)*k,y-(4+26*fl*s*(s>0?1:.8)+ (s>0?10:14))*k*(fl>0?1:.45)-6*k);ctx.lineTo(x+22*k,y-2*k);ctx.fill();}}
  const lx=e.lunge>0?-8*k*Math.sin(e.lunge/.25*Math.PI):0;
  drawSpr(e.spr,x+lx,y,sc,a);
  if(e.flash>0){ctx.globalAlpha=e.flash*4;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x,y-e.h*.5*k,(e.bw+6)*k,e.h*.5*k,0,0,TAU);ctx.fill();}
  ctx.globalAlpha=a;
  if(e.kind==='walker'){const hx=x-(e.bw+2)*k+lx,hy=y-e.h*.5*k;ctx.lineCap='round';if(e.type==='giant'){ctx.strokeStyle=rgba(INK,.95);ctx.lineWidth=5*k;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(hx-12*k,hy-20*k+lx);ctx.stroke();ctx.fillStyle=rgba(ac,.9);ctx.beginPath();ctx.arc(hx-13*k,hy-22*k+lx,5*k,0,TAU);ctx.fill();}
    else if(e.type!=='brute'){ctx.strokeStyle='rgba(235,240,250,.95)';ctx.lineWidth=2*k;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(hx-13*k,hy-13*k-lx);ctx.stroke();}}
  else{const bx=x-10*k,by=y-e.h*.6*k,an=Math.atan2(AY-by,AX-bx)-(e.kind==='boss'?.25:.35),pl=e.state==='aim'?1-e.t2/e.tt:0;drawBow(bx,by,an,pl,(e.kind==='boss'?17:13)*k,ac,false);
    if(e.state==='aim'){const f=e.t2/e.tt,r=lerp(7,30,f)*k;ctx.strokeStyle=rgba(ac,.9*(1-f*.5));ctx.lineWidth=2.4*S;ctx.beginPath();ctx.arc(bx,by,r,0,TAU);ctx.stroke();glowDot(bx,by,(3+4*(1-f))*S,ac,.9);
      const d=Math.atan2(AY-by,AX-bx);ctx.strokeStyle=rgba(ac,.5*(1-f));ctx.lineWidth=1.4*S;ctx.setLineDash([3*S,6*S]);ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(d)*(1-f)*70*S,by+Math.sin(d)*(1-f)*70*S);ctx.stroke();ctx.setLineDash([]);}}
  if(e.hp<e.max&&e.kind!=='boss'){const w=24*k,f=clamp(e.hp/e.max,0,1),yy=y-(e.h+10)*k;ctx.lineCap='round';ctx.strokeStyle='rgba(20,14,40,.55)';ctx.lineWidth=3.4*S;ctx.beginPath();ctx.moveTo(x-w/2,yy);ctx.lineTo(x+w/2,yy);ctx.stroke();ctx.strokeStyle=rgba(ac,1);ctx.lineWidth=2*S;ctx.beginPath();ctx.moveTo(x-w/2,yy);ctx.lineTo(x-w/2+w*f,yy);ctx.stroke();}
  ctx.globalAlpha=1;}
function draw(){const p=PALS[G.pal%PALS.length];ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle=rgba(p.sky[1],1);ctx.fillRect(0,0,W,H);
  const sw=Math.sin(G.t*.22)*6,shx=G.state==='play'?gauss()*G.shake:0,shy=G.state==='play'?gauss()*G.shake*.6:0,FW=W+OV*2;
  ctx.drawImage(L[0],-OV+sw*.25+shx*.3,shy*.3,FW,H);
  for(const c of clouds)ctx.drawImage(c.c,c.x+sw*.3,c.y,c.w,c.h);
  if(G.bolt>0){ctx.fillStyle=`rgba(235,245,255,${G.bolt*1.6})`;ctx.fillRect(0,0,W,H);}
  for(const b of birds){const f=Math.sin(G.t*7+b.ph)*4*b.s*S;ctx.strokeStyle=rgba(INK,.6);ctx.lineWidth=1.3*S;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(b.x-6*b.s*S,b.y-f);ctx.quadraticCurveTo(b.x-2*S,b.y-1*S,b.x,b.y+1*S);ctx.quadraticCurveTo(b.x+2*S,b.y-1*S,b.x+6*b.s*S,b.y-f);ctx.stroke();}
  ctx.drawImage(L[1],-OV+sw*.55+shx*.6,shy*.6,FW,H);
  for(let i=0;i<3;i++){const mx=((G.t*(6+i*3)+i*W*.4)%(W*1.6))-W*.5;ctx.globalAlpha=.55;ctx.drawImage(mistSpr,mx,GY-H*(.1+i*.035),W*.9,54*S);}ctx.globalAlpha=1;
  ctx.save();ctx.translate(sw+shx,shy);
  ctx.drawImage(L[2],-OV,0,FW,H);
  /* water shimmer */
  const sh=GY+Math.min(44*S,(H-GY)*.3);ctx.lineCap='round';for(let i=0;i<9;i++){const y=sh+10*S+(H-sh-14*S)*((i*.618)%1),x=((i*137+G.t*(8+i%3*5))%(W+120))-60,w=(20+i%4*12)*S;ctx.strokeStyle=rgba(p.orb,.16+.1*Math.sin(G.t*2+i));ctx.lineWidth=1.6*S;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();}
  for(const d of decals){const f=d.t/1.3,s=96*S*d.s*(.55+.5*Math.min(1,d.t*6));ctx.globalAlpha=(1-f)*.85;ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.r);ctx.drawImage(d.c,-s/2,-s/2,s,s);ctx.restore();}ctx.globalAlpha=1;
  enemies.slice().sort((a,b)=>a.y-b.y).forEach(drawEnemy);
  drawHero();
  if(bonus){const b=bonus,fl=Math.sin(G.t*14);glowDot(b.x,b.y,9*S,[255,215,110],.95);ctx.fillStyle='rgba(255,244,210,.85)';for(const d of[-1,1]){ctx.beginPath();ctx.ellipse(b.x+d*7*S,b.y-(4+fl*3)*S,7*S,3*S,d*(.5+fl*.25),0,TAU);ctx.fill();}}
  for(const a of arrows){const an=Math.atan2(a.vy,a.vx),sp=a.spirit,tc=a.sp?SPC[a.sp]:a.ch?[255,236,150]:null;if(!a.stuck)trail(a.trail,tc||(sp?[255,225,140]:[255,248,225]),(sp||tc?7:4.5)*S,sp||tc?.85:.6);if(sp)glowDot(a.x,a.y,5*S,[255,220,130],.9);if(tc&&!a.stuck)glowDot(a.x,a.y,4.5*S,tc,.9);drawArrow(a.x,a.y,an,24*S,'#f6ecd2',sp?'#ffd76a':'#e8b84a',a.stuck?clamp(a.stuck,0,1):1);}
  for(const a of earrows){const an=Math.atan2(a.vy,a.vx),c=hex(a.c);let al=1;if(a.type==='shadow'){const d=Math.hypot(a.x-AX,a.y-AY);al=d<150*S?1:.16;}
    trail(a.trail,c,(a.type==='homing'?6:4)*S,.7*al);if(a.type!=='shadow'||al===1)glowDot(a.x,a.y,(a.type==='boom'?6:a.type==='homing'?5.5:3.6)*S,c,.85*al);if(a.type!=='homing')drawArrow(a.x,a.y,an,20*S,rgba(INK,.9),a.c,al);}
  for(const q of parts){const f=1-q.t/q.max;if(q.k==='bolt'){ctx.lineCap=ctx.lineJoin='round';for(const[w,c]of[[7,`rgba(140,190,255,${f*.45})`],[2.4,`rgba(240,250,255,${f})`]]){ctx.strokeStyle=c;ctx.lineWidth=w*S;ctx.beginPath();for(let i=0;i<q.pts.length;i+=2)i?ctx.lineTo(q.pts[i],q.pts[i+1]):ctx.moveTo(q.pts[i],q.pts[i+1]);ctx.stroke();}continue;}if(q.k==='ring'){ctx.strokeStyle=rgba(q.c,f*.8);ctx.lineWidth=5*S*f;ctx.beginPath();ctx.arc(q.x,q.y,q.s*(1-f*f),0,TAU);ctx.stroke();}
    else if(q.k==='wisp'){glowDot(q.x,q.y,q.s,q.c,Math.min(1,f*2));}
    else if(q.k==='petal'){ctx.fillStyle=rgba(q.c,f*.85);ctx.beginPath();ctx.ellipse(q.x,q.y,q.s,q.s*.45,q.r,0,TAU);ctx.fill();}
    else{ctx.fillStyle=rgba(q.c,f*.8);ctx.beginPath();ctx.arc(q.x,q.y,q.s*.5,0,TAU);ctx.fill();}}
  ctx.textAlign='center';for(const t of texts){const f=1-t.t/.9;ctx.globalAlpha=Math.min(1,f*2.2);ctx.font=`${t.sz*(1+.25*Math.max(0,1-t.t*8))}px "Kaushan Script","Brush Script MT",cursive`;ctx.lineWidth=3*S;ctx.strokeStyle='rgba(26,20,46,.7)';ctx.strokeText(t.s,t.x,t.y);ctx.fillStyle=t.c;ctx.fillText(t.s,t.x,t.y);}ctx.globalAlpha=1;
  /* swaying foreground grass */
  ctx.lineCap='round';for(let i=0;i<16;i++){const gx=(i*71%100)/100*W,gy=i%3===0?GY+2:H+2,ht=(i%3===0?12:44+i%5*9)*S,s=Math.sin(G.t*1.6+i)*ht*.22;ctx.strokeStyle=rgba(i%3===0?p.grass:p.gd,i%3===0?.8:.9);ctx.lineWidth=(i%3===0?1.3:2.2)*S;for(let j=-1;j<=1;j++){ctx.beginPath();ctx.moveTo(gx+j*3*S,gy);ctx.quadraticCurveTo(gx+j*5*S,gy-ht*.6,gx+j*8*S+s,gy-ht*(1-.12*Math.abs(j)));ctx.stroke();}}
  ctx.restore();
  ctx.globalAlpha=.5;const mx=((G.t*9)%(W*1.8))-W*.6;ctx.drawImage(mistSpr,mx,GY-18*S,W*1.1,60*S);ctx.globalAlpha=1;
  /* weather */
  for(const w of wx){const k=w.k;if(k==='rain'){ctx.strokeStyle='rgba(220,235,245,.3)';ctx.lineWidth=1*S;ctx.beginPath();ctx.moveTo(w.x,w.y);ctx.lineTo(w.x-4*S,w.y+16*w.s*S);ctx.stroke();}
    else if(k==='snow'){ctx.fillStyle=`rgba(255,255,255,${.55+.3*Math.sin(w.ph)})`;ctx.beginPath();ctx.arc(w.x,w.y,1.6*w.s*S,0,TAU);ctx.fill();}
    else if(k==='leaf'){ctx.fillStyle=rgba(w.ph>3?p.tree:p.grass,.8);ctx.beginPath();ctx.ellipse(w.x,w.y,3.4*w.s*S,1.5*w.s*S,G.t*2+w.ph,0,TAU);ctx.fill();}
    else glowDot(w.x,w.y,1.2*w.s*S,k==='ember'?[255,190,110]:p.grass,.45+.3*Math.sin(G.t*3+w.ph));}
  if(G.flash>0){ctx.fillStyle=`rgba(255,244,210,${clamp(G.flash,0,.5)})`;ctx.fillRect(0,0,W,H);}
  /* paper */
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='multiply';ctx.fillStyle=paperPat;ctx.fillRect(0,0,cv.width,cv.height);ctx.globalCompositeOperation='source-over';ctx.drawImage(vig,0,0,cv.width,cv.height);
}
function hud(){if(G.state!=='play')return;$('score').textContent=G.score;$('hp').firstChild.style.width=clamp(G.hp/G.maxHp*100,0,100)+'%';$('xp').firstChild.style.width=clamp(G.xp/G.need*100,0,100)+'%';
  $('ink').textContent='✦ '+save.ink+' ink';ABS.forEach(b=>{b.classList.toggle('off',G.spirit<G.cost);b.classList.toggle('sel',G.sel===b.dataset.a);});if(G.spirit>=G.cost&&!seen._sp&&G.shots>3){seen._sp=1;hint(PC?'Spirit arrows ready: press 1, 2 or 3':'Spirit arrows ready: pick one at the bottom left');}
  const sb=$('bSpirit'),sp=G.spirit|0;sb.style.setProperty('--p',sp);sb.classList.toggle('off',sp<100);sb.classList.toggle('ready',sp>=100);
  const hb=$('bShield'),r=clamp(1-G.shCd/PS.shCd,0,1);hb.style.setProperty('--p',r*100);hb.classList.toggle('off',r<1);
  const t=$('tint'),st=G.hurtT>0?'radial-gradient(ellipse at center,rgba(214,58,49,0) 45%,rgba(214,58,49,.55))':G.frost>0?'radial-gradient(ellipse at center,rgba(143,227,255,0) 50%,rgba(143,227,255,.4))':G.poison>0?'radial-gradient(ellipse at center,rgba(134,217,76,0) 55%,rgba(134,217,76,.32))':G.burn>0?'radial-gradient(ellipse at center,rgba(255,122,46,0) 55%,rgba(255,122,46,.32))':'';
  if(st){if(t._s!==st){t.style.background=st;t._s=st;}t.style.opacity=1;}else t.style.opacity=0;}

/* ---------- loop + input ---------- */
let last=performance.now();
function frame(now){const dt=Math.min(.034,(now-last)/1000);last=now;if(!G.paused)update(dt);draw();hud();requestAnimationFrame(frame);}
function layout(){DPR=Math.min(window.devicePixelRatio||1,2);W=window.innerWidth;H=window.innerHeight;cv.width=W*DPR|0;cv.height=H*DPR|0;S=clamp(Math.min(W,H)/390,.75,1.7);const port=H>W;GY=H*(port?.77:.8);PH=46*S;AX=Math.max(W*.14,50*S);AY=GY-PH-40*S;
  const occ=perches.map(p=>p.occ);perches=[{x:W*.83,y:GY-H*(port?.15:.2)},{x:W*.93,y:GY-H*(port?.33:.42)},{x:W*.6,y:GY-H*(port?.1:.14)},{x:W*.7,y:H*(port?.37:.34)},{x:W*.43,y:H*(port?.27:.26)},{x:W*.87,y:H*(port?.21:.2)}];
  perches.forEach((p,i)=>{p.occ=occ[i]||null;if(p.occ){p.occ.x=p.x;p.occ.y=p.y;}});
  sprCache={};paintHero();makePaper();buildScene();enemies.forEach(e=>{e.spr=enemySpr(e.kind==='walker'?e.type:e.kind,e.acc);if(e.perch===null&&e.kind!=='rider')e.y=GY;});}
let rz;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(layout,200);});
cv.addEventListener('pointerdown',e=>{if(e.button===2){shield();return;}if(G.state!=='play'||G.paused||aim)return;aim={id:e.pointerId,sx:e.clientX,sy:e.clientY,x:e.clientX,y:e.clientY,pull:0};try{cv.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();});
cv.addEventListener('pointermove',e=>{if(aim&&e.pointerId===aim.id){aim.x=e.clientX;aim.y=e.clientY;}});
const rel=e=>{if(!aim||e.pointerId!==aim.id)return;const v=aimVec();if(v)v.ch=G.charge>=.55;aim=null;if(v&&e.type==='pointerup'){if(G.reload<=0)shootArrow(v.a,v.p,v.ch);else queued=v;}};
cv.addEventListener('pointerup',rel);cv.addEventListener('pointercancel',rel);
document.addEventListener('contextmenu',e=>e.preventDefault());
const tap=(id,f)=>$(id).addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();f();});
tap('bShield',shield);tap('bSpirit',starfall);
const ABS=[...document.querySelectorAll('.ab')];ABS.forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();selArrow(b.dataset.a);}));
let selRealm=1,lastMode='camp',lastRealm=1;
function begin(mode,realm){initAudio();resumeAudio();mode=mode||lastMode;realm=realm||lastRealm;lastMode=mode;lastRealm=realm;PERKS.forEach(p=>p.cnt=0);const had=G.pal;reset();G.mode=mode;G.pal=mode==='camp'?realm-1:Math.random()*5|0;if(G.pal!==had)buildScene();
  ['menu','over','pause','tree','perks'].forEach(i=>$(i).style.display='none');$('boss').style.display='none';$('hud').style.display='block';$('combo').style.opacity=0;G.state='play';G.paused=false;last=performance.now();
  startWave(mode==='camp'?(realm-1)*5+1:1);if(mode==='camp'&&realm===1)hint(PC?'Click and drag anywhere, pull back and release to shoot':'Drag anywhere, pull back and release to shoot',5000);
  if(mode==='camp'&&realm>1){G.pending=(realm-1)*3;G.lvl+=G.pending;openPerks();}}
function goMenu(){G.state='menu';G.paused=false;enemies=[];earrows=[];arrows=[];bonus=null;aim=null;perches.forEach(p=>p.occ=null);['over','pause','tree','perks'].forEach(i=>$(i).style.display='none');$('hud').style.display='none';$('tint').style.opacity=0;renderMenu();$('menu').style.display='flex';}
function renderMenu(){const t=tier(),nx=TIERS[t+1];selRealm=Math.min(selRealm,save.unlock);
  $('mHelp').innerHTML=PC?'Click and drag to aim, release to shoot.<br><b>Space</b> or right-click: shield · <b>1 2 3</b>: spirit arrows · <b>E</b>: Starfall · <b>Esc</b>: pause':'Drag anywhere, pull back, release to shoot.<br>Shoot arrows out of the air. Tap the shield at the last moment to deflect.';
  const r=$('mRealms');r.innerHTML='';PALS.forEach((p,i)=>{const b=document.createElement('button');b.className='rl'+(selRealm===i+1?' sel':'');b.disabled=i+1>save.unlock;const st=save.stars[i]||0;b.innerHTML=`<b class="k">${i+1}</b><i>${'★'.repeat(st)+'☆'.repeat(3-st)}</i>`;b.title=p.name;b.onclick=()=>{selRealm=i+1;renderMenu();};r.appendChild(b);});
  $('mBow').textContent=`${PALS[selRealm-1].name} · ${TIERS[t].n}${nx?` (${Math.max(0,nx.k-save.kills)} kills to ${nx.n})`:''}`;
  $('bPlay').textContent=selRealm>1?'Begin realm '+selRealm:'Begin';$('bEndless').disabled=!save.endless;$('bEndless').textContent=save.endless?`Endless${save.bestE?' · best '+save.bestE:''}`:'Endless (beat realm 1)';$('bTree').textContent=`Skill Tree · ✦ ${save.ink}`;$('mVer').textContent='v'+__APP_VERSION__;}
function renderTree(){$('tInk').innerHTML=`<b>✦ ${save.ink} ink</b> · earned from kills, waves and lantern spirits`;const body=$('tBody');body.innerHTML='';
  [['Offense',0],['Defense',4],['Spirit',8]].forEach(([nm,o])=>{const h=document.createElement('div');h.className='br k';h.textContent=nm;body.appendChild(h);const g=document.createElement('div');g.className='nodes';
    for(let i=o;i<o+4;i++){const[id,n,d,mx,cs]=SK[i],lv=sk(id),lock=i>o&&!sk(SK[i-1][0]),b=document.createElement('button');b.className='nd'+(lv>=mx?' max':'');b.disabled=lock||(lv<mx&&save.ink<cs[lv]);
      b.innerHTML=`<b class="k">${n}</b><span>${d}</span><em>${lv>=mx?'Mastered':lock?'Locked':`Lv ${lv}/${mx} · ${cs[lv]} ink`}</em>`;b.onclick=()=>{if(lv>=mx||save.ink<cs[lv])return;save.ink-=cs[lv];save.sk[id]=lv+1;persist();initAudio();sfx.perk();renderTree();};g.appendChild(b);}
    body.appendChild(g);});}
$('bPlay').onclick=()=>begin('camp',selRealm);$('bEndless').onclick=()=>begin('endless',1);$('bRetry').onclick=()=>begin();$('bMenu').onclick=goMenu;$('bQuit').onclick=goMenu;
$('bTree').onclick=()=>{$('menu').style.display='none';renderTree();$('tree').style.display='flex';};$('bBack').onclick=()=>{$('tree').style.display='none';renderMenu();$('menu').style.display='flex';};
$('bRespec').onclick=()=>{SK.forEach(([id,,,,cs])=>{for(let i=0;i<sk(id);i++)save.ink+=cs[i];});save.sk={};persist();renderTree();};
function renderSet(){const s=save.set,inPlay=G.state==='play';setMuted(!s.sound);setMusic(s.music);$('pTitle').textContent=inPlay?'Paused':'Settings';$('bResume').textContent=inPlay?'Resume':'Close';
  $('bMute').textContent='Sound: '+(s.sound?'on':'off');$('bMusic').textContent='Music: '+(s.music?'on':'off');$('bHap').textContent='Vibration: '+(s.haptics?'on':'off');$('bHap').style.display=navigator.vibrate?'':'none';
  $('bFull').style.display=document.documentElement.requestFullscreen?'':'none';$('bFull').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';$('bQuit').style.display=inPlay?'':'none';$('bWipe').style.display=inPlay?'none':'';$('bWipe').textContent='Reset progress';wipeArm=false;}
let wipeArm=false;
const tog=k=>()=>{save.set[k]=!save.set[k];persist();if(k==='sound'&&save.set.sound){initAudio();resumeAudio();}renderSet();};
$('bMusic').onclick=tog('music');$('bHap').onclick=tog('haptics');
$('bFull').onclick=()=>{try{(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).then(renderSet,()=>{});}catch(e){}};
$('bWipe').onclick=()=>{if(!wipeArm){wipeArm=true;$('bWipe').textContent='Tap again to erase everything';return;}const set=save.set;save=fresh();save.set=set;persist();selRealm=1;renderSet();};
$('bSet').onclick=()=>{$('menu').style.display='none';renderSet();$('pause').style.display='flex';};
$('bPause').onclick=()=>{if(G.state!=='play'||$('perks').style.display==='flex')return;G.paused=true;aim=null;renderSet();$('pause').style.display='flex';};
$('bResume').onclick=()=>{G.paused=false;last=performance.now();$('pause').style.display='none';if(G.state!=='play'){renderMenu();$('menu').style.display='flex';}};
$('bMute').onclick=tog('sound');
document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.state==='play'&&!G.paused&&$('perks').style.display!=='flex')$('bPause').onclick();});
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase(),on=i=>$(i).style.display==='flex';
  if(e.code==='Space'){e.preventDefault();if(on('menu'))begin('camp',selRealm);else shield();}
  else if(k==='q')shield();else if(k==='e'||k==='f')starfall();
  else if(k==='1'||k==='2'||k==='3'){if(on('perks')){const b=$('pc').children[k-1];if(b)b.click();}else selArrow(['ember','storm','gale'][k-1]);}
  else if(k==='escape'||k==='p'){if(on('pause'))$('bResume').onclick();else $('bPause').onclick();}
  else if(k==='enter'){if(on('menu'))begin('camp',selRealm);else if(on('over'))begin();}});
bindState(()=>({wave:G.state==='play'?G.wave:0,paused:G.paused}));setMuted(!save.set.sound);setMusic(save.set.music);
reset();layout();
renderMenu();
if(new URLSearchParams(location.search).has('debug'))window.__dbg={G,get save(){return save;},begin,spawn,startWave,setPal:i=>{G.pal=i;buildScene();},get enemies(){return enemies;},perches:()=>perches,pos:()=>({AX,AY,GY,W,H,S})};
requestAnimationFrame(frame);
