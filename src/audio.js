// Synthesised sound effects and a generative score, all Web Audio. No audio files.
import{clamp,pick}from'./utils.js';
let AC=null,master=null,muted=false,musicOn=true,musT=0,step=0,getS=()=>({wave:0,paused:false});
export const bindState=f=>{getS=f;},setMuted=b=>{muted=b;},setMusic=b=>{musicOn=b;},resumeAudio=()=>{if(AC&&AC.state==='suspended')AC.resume();};
export function initAudio(){if(AC)return;try{AC=new(window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=.5;master.connect(AC.destination);musT=AC.currentTime+.2;setInterval(music,120);}catch(e){AC=null;}}
function tone(f,d,type,v,slide,dl){if(!AC||muted)return;const t=AC.currentTime+(dl||0),o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(.0008,t+d);o.connect(g);g.connect(master);o.start(t);o.stop(t+d+.03);}
let nbuf=null;function noise(d,v,fq,dl){if(!AC||muted)return;if(!nbuf){nbuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const a=nbuf.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;}
  const t=AC.currentTime+(dl||0),s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=nbuf;f.type='bandpass';f.frequency.value=fq;f.Q.value=.9;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0008,t+d);s.connect(f);f.connect(g);g.connect(master);s.start(t,Math.random()*.5,d+.03);}
export const sfx={zap:()=>{tone(1800,.12,'square',.06,-1200);noise(.12,.3,4200);},ping:()=>tone(1568,.18,'sine',.12),shoot:p=>{noise(.09,.3,2000);tone(190+p*140,.14,'triangle',.16,-110);},hit:()=>{noise(.07,.35,800);tone(150,.1,'sine',.25,-70);},crit:()=>{tone(880,.25,'sine',.16);tone(1320,.35,'sine',.1,0,.06);},eshoot:()=>noise(.08,.1,1300),
  hurt:()=>{tone(120,.28,'sawtooth',.16,-60);noise(.16,.3,380);},shield:()=>{tone(620,.3,'sine',.14);tone(930,.4,'sine',.08);},deflect:()=>{tone(1040,.2,'triangle',.2);tone(1560,.45,'sine',.14,0,.05);},block:()=>noise(.08,.3,2600),
  boom:()=>{noise(.5,.55,170);tone(70,.45,'sine',.4,-35);},parry:()=>{tone(1250,.09,'square',.05);noise(.05,.2,3200);},perk:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.4,'sine',.13,0,i*.07)),
  spirit:()=>{[392,587,784,1175].forEach((f,i)=>tone(f,.7,'triangle',.12,0,i*.05));noise(.8,.2,900);},die:()=>{tone(180,.9,'sawtooth',.2,-140);},wave:()=>{tone(294,.5,'triangle',.12);tone(440,.7,'triangle',.1,0,.15);}};
const SC=[146.8,174.6,196,220,261.6,293.7,349.2,392,440,523.3];let mi=4;
function music(){const st=getS();if(!AC||muted||!musicOn||st.paused||AC.state!=='running')return;const w=st.wave,bpm=70+Math.min(w,12)*5,sp=60/bpm/2;
  while(musT<AC.currentTime+.3){const dl=Math.max(0,musT-AC.currentTime);
    if(step%16===0)tone(step%32?55:73.4,sp*15,'sine',.11,0,dl);
    if(Math.random()<.5+Math.min(w,8)*.04){mi=clamp(mi+pick([-2,-1,-1,1,1,2]),0,SC.length-1);tone(SC[mi],.9,'triangle',.07,0,dl);if(Math.random()<.25)tone(SC[mi]*2,.5,'sine',.03,0,dl+sp*.5);}
    if(w>0&&(step%8===0||(w>2&&step%8===5)||(w>4&&step%4===2))){if(AC&&!muted){noise(.12,.2+Math.min(w,8)*.02,110,dl);tone(82,.14,'sine',.2,-34,dl);}}
    musT+=sp;step++;}}

