// Watercolour primitives: layered washes, bristle strokes, blooms and splatter drawn on a 2D canvas.
import{TAU,rnd,gauss,lerp,rgba,shade}from'./utils.js';
export function deform(p,rounds,v){for(let r=0;r<rounds;r++){const q=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];q.push(a);const L=Math.min(Math.hypot(b[0]-a[0],b[1]-a[1]),60),m=L*v*gauss(),an=Math.random()*TAU;q.push([(a[0]+b[0])/2+Math.cos(an)*m,(a[1]+b[1])/2+Math.sin(an)*m]);}p=q;}return p;}
export function poly(c,p){c.beginPath();c.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)c.lineTo(p[i][0],p[i][1]);c.closePath();}
export function wash(c,pts,col,o={}){const n=o.layers||7,a=o.alpha||.14,v=o.vari===undefined?.3:o.vari;const base=deform(pts,o.br===undefined?1:o.br,v*.6);
  for(let i=0;i<n;i++){c.fillStyle=rgba(o.vary?shade(col,gauss()*o.vary):col,a);poly(c,deform(base,2,v));c.fill();}
  if(o.edge!==0){c.strokeStyle=rgba(shade(col,-.4),o.edge||.2);c.lineWidth=o.ew||1;c.lineJoin='round';poly(c,deform(base,2,v*.3));c.stroke();}}
export function stroke(c,x1,y1,x2,y2,w,col,a=.5,n){n=n||Math.max(3,w*.9|0);const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,bend=gauss()*len*.07;c.lineCap='round';
  for(let i=0;i<n;i++){const t=(i/(n-1||1)-.5)*w+gauss()*w*.07,s=rnd(0,.14),e=1-rnd(0,.14);const ax=x1+dx*s+nx*t,ay=y1+dy*s+ny*t,bx=x1+dx*e+nx*t,by=y1+dy*e+ny*t;
    c.strokeStyle=rgba(col,a*rnd(.3,1));c.lineWidth=rnd(.5,1.7)*(w/n)*1.25;c.beginPath();c.moveTo(ax,ay);c.quadraticCurveTo((ax+bx)/2+nx*bend,(ay+by)/2+ny*bend,bx,by);c.stroke();}}
export function bloom(c,x,y,r,col,a){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(col,a));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
export function splat(c,x,y,r,col,n,a=.4,sz=1.8){for(let i=0;i<n;i++){const an=rnd(TAU),d=Math.pow(Math.random(),.6)*r;c.fillStyle=rgba(col,a*rnd(.3,1));c.beginPath();c.arc(x+Math.cos(an)*d,y+Math.sin(an)*d,rnd(.3,sz),0,TAU);c.fill();}}
export function circ(cx,cy,rx,ry,n=14){const p=[];for(let i=0;i<n;i++){const a=i/n*TAU;p.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]);}return p;}
export function dens(pts,step){const o=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],n=Math.max(1,Math.hypot(b[0]-a[0],b[1]-a[1])/step|0);for(let j=0;j<n;j++)o.push([lerp(a[0],b[0],j/n),lerp(a[1],b[1],j/n)]);}return o;}
export function inkLine(c,p,col,a=.5,w=1){c.lineCap='round';for(let i=0;i<p.length;i++){if(Math.random()<.3)continue;const A=p[i],B=p[(i+1)%p.length];c.strokeStyle=rgba(col,a*rnd(.4,1));c.lineWidth=rnd(.4,1.3)*w;c.beginPath();c.moveTo(A[0]+gauss()*.4,A[1]+gauss()*.4);c.lineTo(B[0]+gauss()*.4,B[1]+gauss()*.4);c.stroke();}}

