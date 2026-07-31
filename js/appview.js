// ═══════════════════════════════════════════════════════════
// // 체험 툴 UI — 조인트 슬라이더, 타임라인, 툴바
// ═══════════════════════════════════════════════════════════

// JOINT SLIDERS
setTimeout(()=>document.querySelectorAll('.group-body').forEach(b=>b.style.maxHeight=b.scrollHeight+'px'),60);

document.getElementById('searchBox').addEventListener('input',function(){
  const q=this.value.toLowerCase().trim();
  document.querySelectorAll('.ji').forEach(el=>el.style.display=(!q||el.dataset.joint?.toLowerCase().includes(q))?'':'none');
});

const setAngle=setJointValue;


const tlCanvas=document.getElementById('tlCanvas');
const tlWrap=document.getElementById('tlWrap');
const HAS_TIMELINE = !!(tlCanvas && tlWrap);
function resizeTlCanvas(){ if(!HAS_TIMELINE) return; tlCanvas.width=tlWrap.clientWidth;tlCanvas.height=tlWrap.clientHeight;}
if(HAS_TIMELINE){ resizeTlCanvas(); new ResizeObserver(resizeTlCanvas).observe(tlWrap); }
function timeToX(t){return Math.round((t/duration)*tlCanvas.width);}
const TL_SNAP=0.1;   // 키프레임이 붙는 최소 단위 (눈금선 간격과는 별개)
function xToTime(x){let t=(x/tlCanvas.width)*duration; t=Math.round(t/TL_SNAP)*TL_SNAP;
  t=Math.round(t*1000)/1000;   // 0.30000000000000004 같은 부동소수 오차 제거
  return Math.max(0,Math.min(duration,t));}
function drawTimeline(){
  if(!HAS_TIMELINE) return;
  const canvas=tlCanvas,ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;
  if(W<10||H<10)return;
  const TRACK_Y=0,TRACK_H=H-20;
  ctx.fillStyle='#F7F8F9';ctx.fillRect(0,0,W,H);
  const step=duration<=10?0.5:duration<=30?1:2;
  for(let t=0;t<=duration;t+=step){
    const x=timeToX(t);const isWhole=Math.abs(t%1)<.01;
    ctx.strokeStyle=isWhole?'#C9CED4':'#E2E5E8';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,TRACK_Y);ctx.lineTo(x,TRACK_H);ctx.stroke();
    if(isWhole||duration<=5){ctx.fillStyle='#8B95A1';ctx.font='9px IBM Plex Mono,monospace';ctx.fillText(t.toFixed(1)+'s',x+2,H-5);}
  }
  const endX=timeToX(duration);
  ctx.strokeStyle='#8B95A1';ctx.lineWidth=2;ctx.setLineDash([4,3]);
  ctx.beginPath();ctx.moveTo(endX,TRACK_Y);ctx.lineTo(endX,TRACK_H);ctx.stroke();
  ctx.setLineDash([]);
  const sorted=[...keyframes].sort((a,b)=>a.time-b.time);
  if(sorted.length>=2){
    ctx.strokeStyle='#1C253022';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(timeToX(sorted[0].time),TRACK_H/2);
    for(const kf of sorted.slice(1))ctx.lineTo(timeToX(kf.time),TRACK_H/2);
    ctx.stroke();
  }
  for(const kf of sorted){
    const x=timeToX(kf.time);const sel=kf.id===selectedKfId;const R=sel?9:7;
    ctx.shadowBlur=0;
    ctx.fillStyle=sel?'#E8590C':'#1C2530';
    ctx.beginPath();ctx.moveTo(x,TRACK_H/2-R);ctx.lineTo(x+R,TRACK_H/2);ctx.lineTo(x,TRACK_H/2+R);ctx.lineTo(x-R,TRACK_H/2);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle=sel?'#E8590C66':'#1C253033';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,TRACK_Y);ctx.lineTo(x,TRACK_H);ctx.stroke();
    ctx.fillStyle=sel?'#E8590C':'#5A6572';ctx.font='9px IBM Plex Mono,monospace';ctx.fillText(kf.time.toFixed(2),x+4,TRACK_H/2-12);
  }
  const px=timeToX(currentTime);
  ctx.shadowBlur=0;
  ctx.strokeStyle='#E8590C';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(px,TRACK_Y);ctx.lineTo(px,TRACK_H);ctx.stroke();
  ctx.shadowBlur=0;
  ctx.fillStyle='#E8590C';
  ctx.beginPath();ctx.moveTo(px-6,TRACK_Y);ctx.lineTo(px+6,TRACK_Y);ctx.lineTo(px,TRACK_Y+10);ctx.closePath();ctx.fill();
}
function getKfAtX(x){return keyframes.find(kf=>Math.abs(timeToX(kf.time)-x)<7)||null;}
tlCanvas.addEventListener('mousedown',e=>{
  const rect=tlCanvas.getBoundingClientRect();const x=e.clientX-rect.left;
  const kf=getKfAtX(x);
  if(kf){selectedKfId=kf.id;tlDragging=true;tlDragKfId=kf.id;applyAtTime(kf.time);currentTime=kf.time;}
  else{tlSeeking=true;currentTime=xToTime(x);if(!isPlaying)applyAtTime(currentTime);}
});
window.addEventListener('mousemove',e=>{
  if(tlDragging&&tlDragKfId!==null){
    const rect=tlCanvas.getBoundingClientRect();const x=e.clientX-rect.left;
    const kf=keyframes.find(k=>k.id===tlDragKfId);
    if(kf){kf.time=parseFloat(xToTime(x).toFixed(3));currentTime=kf.time;if(!isPlaying)applyAtTime(kf.time);}
  } else if(tlSeeking){
    const rect=tlCanvas.getBoundingClientRect();currentTime=xToTime(e.clientX-rect.left);
    if(!isPlaying)applyAtTime(currentTime);
  }
});
window.addEventListener('mouseup',()=>{tlDragging=false;tlDragKfId=null;tlSeeking=false;});
tlCanvas.addEventListener('dblclick',e=>{
  const rect=tlCanvas.getBoundingClientRect();currentTime=xToTime(e.clientX-rect.left);addKeyframe();
});

// TIMELINE CONTROLS
document.getElementById('tlToStart').addEventListener('click',()=>{
  currentTime=0;isPlaying=false;playLastT=null;document.getElementById('tlPlayPause').textContent='▶';applyAtTime(0);
});
document.getElementById('tlPlayPause').addEventListener('click',function(){
  if(!keyframes.length){alert(PIBO_T('키프레임을 먼저 추가하세요'));return;}
  isPlaying=!isPlaying;this.textContent=isPlaying?'⏸':'▶';
  if(isPlaying){playLastT=null;if(currentTime>=duration)currentTime=0;}
});
document.getElementById('tlStop').addEventListener('click',()=>{
  isPlaying=false;playLastT=null;currentTime=0;document.getElementById('tlPlayPause').textContent='▶';applyAtTime(0);
});
document.getElementById('tlAddKf').addEventListener('click',addKeyframe);
document.getElementById('tlDelKf').addEventListener('click',deleteSelectedKf);
document.getElementById('tlDurInput').addEventListener('change',function(){
  duration=Math.max(1,parseFloat(this.value)||5);this.value=duration;if(currentTime>duration)currentTime=duration;
});
document.getElementById('tlSpeedSel').addEventListener('change',function(){playSpeed=parseFloat(this.value);});
document.getElementById('tlLoopBtn').addEventListener('click',function(){loopMode=!loopMode;this.classList.toggle('on',loopMode);});

// ★ 모션 저장 → 실물 PIBO 포맷 {name:{init_def,init,pos:[{d,seq}]}} (도 단위)
document.getElementById('tlSaveMotion').addEventListener('click',()=>{
  if(!keyframes.length){alert(PIBO_T('키프레임을 먼저 추가하세요'));return;}
  const R2D=180/Math.PI;
  const sorted=[...keyframes].sort((a,b)=>a.time-b.time);
  const toD=kf=>PIBO_MAP.map(m=>Math.round(m.s*(kf.joints[m.j]??0))); // 슬라이더(度)=모터값
  const hasZero = sorted.length && sorted[0].time<0.01;
  const init = sorted.length ? toD(sorted[0]) : PIBO_DEFAULT_INIT.slice();
  const posFrames = hasZero ? sorted.slice(1) : sorted;  // 0초 키프레임은 init으로만, pos에서 제외
  const pos = posFrames.map(kf=>({ d:toD(kf), seq:Math.round(kf.time*1000) }));
  const name=(prompt(PIBO_T('모션 이름'),'motion')||'motion').trim()||'motion';
  const data={[name]:{init_def:1, init, pos}};
  const a=document.createElement('a');a.download=name+'.json';
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.click();
});
document.getElementById('tlLoadMotion').addEventListener('click',()=>document.getElementById('motionFileIn').click());
// ★ 불러오기 → 실물 포맷 / 기존 뷰어 포맷 둘 다 지원
// 모션 JSON(실물 포맷 / 뷰어 포맷 / 배열) 을 타임라인에 올린다
function loadMotionData(raw){
  const D2R=Math.PI/180;
  let frames=null, initArr=null;
  if(Array.isArray(raw)){ frames=raw; }
  else if(raw.keyframes){ // 기존 뷰어 포맷
    duration=raw.duration||5;keyframes=raw.keyframes||[];
    kfIdCounter=keyframes.reduce((m,k)=>Math.max(m,k.id+1),0);
    document.getElementById('tlDurInput').value=duration;updateKfCount();currentTime=0;applyAtTime(0);return;
  } else { // 실물 포맷 {name:{init,pos}}
    const key=Object.keys(raw)[0]; const m=raw[key]||{}; frames=m.pos||m.table||[]; initArr=m.init||null;
  }
  if(frames){
    const last=PIBO_MAP.map((m,i)=> initArr?initArr[i]:0);
    const kfs=[];
    if(initArr){ const j={}; PIBO_MAP.forEach((m,i)=>{ j[m.j]=m.s*(initArr[i]||0); }); kfs.push({id:0,time:0,joints:j}); }
    frames.forEach((fr)=>{
      const d=(fr.d||[]).map((v,i)=> v===999 ? last[i] : v);
      d.forEach((v,i)=>last[i]=v);
      const joints={};
      PIBO_MAP.forEach((m,i)=>{ joints[m.j]=m.s*(d[i]||0); }); // 모터(度)=슬라이더값
      kfs.push({id:kfs.length, time:(fr.seq||0)/1000, joints});
    });
    keyframes=kfs;
    const _endT=Math.max.apply(null, keyframes.map(k=>k.time));
    duration=Math.max(0.5, Math.round(_endT*100)/100);   // 모션 종료 시각 = 타임라인 길이
    kfIdCounter=keyframes.length;
    document.getElementById('tlDurInput').value=duration;
    updateKfCount();currentTime=0;applyAtTime(0);
  }
}

// motions/ 목록을 드롭다운에 채운다 (js/motion_names.js 의 MOTION_NAMES)
(function(){
  const sel=document.getElementById('motionPick');
  if(!sel || typeof MOTION_NAMES==='undefined') return;
  MOTION_NAMES.forEach(n=>{ const o=document.createElement('option'); o.value=o.textContent=n; sel.appendChild(o); });
  sel.addEventListener('change', async function(){
    const n=this.value; if(!n) return;
    try{
      const r=await fetch('motions/'+n+'.json');
      if(!r.ok) throw new Error(r.status);
      loadMotionData(await r.json());
    }catch(err){ alert(PIBO_T('모션을 불러오지 못했습니다')+': '+n+' ('+err.message+')'); }
  });
})();

document.getElementById('motionFileIn').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  try{ loadMotionData(JSON.parse(await readText(f))); }
  catch(err){ alert(PIBO_T('모션 파일을 읽지 못했습니다')+': '+err.message); }
  e.target.value='';
});

// OTHER TOOLS
document.getElementById('gridBtn').addEventListener('click',function(){gridOn=!gridOn;grid.visible=gridOn&&!!(themeGroup&&themeGroup.userData.light.grid);this.classList.toggle('on',gridOn);});
document.getElementById('ssBtn').addEventListener('click',()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download='urdf_sim.png';a.href=cv.toDataURL('image/png');a.click();});
document.getElementById('resetBtn').addEventListener('click',()=>{
  isPlaying=false;document.getElementById('tlPlayPause').textContent='▶';
  document.querySelectorAll('.jslider').forEach(sl=>{sl.value=0;sl.dispatchEvent(new Event('input'));});
  if(typeof PHYS!=='undefined' && PHYS.on) PHYS.reset();   // 위치·기울기까지 원위치
});

cv.addEventListener('click',e=>{
  if(!allMeshes.length)return;
  const rect=cv.getBoundingClientRect();
  mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
  mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(allMeshes);
  if(selectedMesh){const ms=Array.isArray(selectedMesh.material)?selectedMesh.material:[selectedMesh.material];
    ms.forEach((x,i)=>x.color.set(selectedOrigColor[i]??selectedOrigColor[0])); selectedMesh=null;}
  document.querySelectorAll('.ji.highlight').forEach(el=>el.classList.remove('highlight'));
  if(!hits.length)return;
  selectedMesh=hits[0].object;
  {const ms=Array.isArray(selectedMesh.material)?selectedMesh.material:[selectedMesh.material];
   selectedOrigColor=ms.map(x=>x.color.getHex()); ms.forEach(x=>x.color.set(0xE8590C));}
  const lname=selectedMesh.userData.linkName;
  Object.values(jointDefs).forEach(j=>{
    if(j.child===lname||j.parent===lname){const el=document.getElementById('ji_'+sid(j.name));if(el){el.classList.add('highlight');el.scrollIntoView({block:'nearest',behavior:'smooth'});}}
  });
  const tt=document.getElementById('tt');tt.textContent=lname;tt.style.display='block';
  tt.style.left=(e.clientX-rect.left+10)+'px';tt.style.top=(e.clientY-rect.top+8)+'px';
  setTimeout(()=>tt.style.display='none',2000);
});

// LCD 화면 (가슴 torso_lcd 표면에 캔버스 텍스처)


// ── 확대 / 축소 / 맞추기 ──
uiOn('zoomIn','click',  ()=>{ orbit.r=Math.max(.15,Math.min(60,orbit.r*0.82)); orbit.update(); });
uiOn('zoomOut','click', ()=>{ orbit.r=Math.max(.15,Math.min(60,orbit.r*1.22)); orbit.update(); });
uiOn('zoomFit','click', ()=>{ if(robotRoot) orbit.focusBox(new THREE.Box3().setFromObject(robotRoot)); });
