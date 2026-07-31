// ═══════════════════════════════════════════════════════════
// // 모션 코어 — 키프레임 보간, 포즈 적용
// ═══════════════════════════════════════════════════════════

// TIMELINE CORE
function getCurrentPose(){
  const joints={};
  for(const[jname,sl]of Object.entries(sliderEls))joints[jname]=parseFloat(sl.value);
  return joints;
}
function applyPose(joints){
  for(const[jname,val]of Object.entries(joints)){
    setJointValue(jname,val);
    if(sliderEls[jname])sliderEls[jname].value=val;
    if(valEls[jname])valEls[jname].value=Math.round(val);
  }
}
function applyAtTime(t){
  if(!keyframes.length)return;
  const sorted=[...keyframes].sort((a,b)=>a.time-b.time);
  if(sorted.length===1){applyPose(sorted[0].joints);return;}
  if(t<=sorted[0].time){applyPose(sorted[0].joints);return;}
  if(t>=sorted[sorted.length-1].time){applyPose(sorted[sorted.length-1].joints);return;}
  let prev=sorted[0],next=sorted[1];
  for(let i=0;i<sorted.length-1;i++){
    if(sorted[i].time<=t&&sorted[i+1].time>=t){prev=sorted[i];next=sorted[i+1];break;}
  }
  const alpha=next.time===prev.time?1:(t-prev.time)/(next.time-prev.time);
  const ease=alpha*alpha*(3-2*alpha);
  const merged={};
  const allJ=new Set([...Object.keys(prev.joints),...Object.keys(next.joints)]);
  for(const jn of allJ){const a=prev.joints[jn]??0,b=next.joints[jn]??0;merged[jn]=a+(b-a)*ease;}
  applyPose(merged);
}
function addKeyframe(){
  if(!Object.keys(sliderEls).length){alert(PIBO_T('로봇을 먼저 로드하세요'));return;}
  const SNAP=0.05;
  const existing=keyframes.find(k=>Math.abs(k.time-currentTime)<SNAP);
  if(existing){
    existing.joints=getCurrentPose();
    selectedKfId=existing.id;
  } else {
    const kf={id:kfIdCounter++,time:Math.round(currentTime/0.5)*0.5,joints:getCurrentPose()};
    keyframes.push(kf);selectedKfId=kf.id;
  }
  updateKfCount();
}
function deleteSelectedKf(){
  if(selectedKfId===null)return;
  keyframes=keyframes.filter(k=>k.id!==selectedKfId);
  selectedKfId=null;updateKfCount();
}
function updateKfCount(){
  document.getElementById('tlKfCount').textContent=`${PIBO_T('키프레임')} ${keyframes.length}`;
}

// TIMELINE CANVAS
