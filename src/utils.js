// Small maths and colour helpers shared by every module.
export const TAU=Math.PI*2;
export const rnd=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
export const gauss=()=>(Math.random()+Math.random()+Math.random()+Math.random()-2)/2;
export const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,pick=a=>a[Math.random()*a.length|0];
export const hex=h=>{const n=parseInt(h.slice(1),16);return[n>>16,(n>>8)&255,n&255]};
export const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
export const mix=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
export const shade=(c,f)=>f<0?mix(c,[0,0,0],-f):mix(c,[255,255,255],f);
