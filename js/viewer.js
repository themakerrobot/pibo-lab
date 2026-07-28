// ═══════════════════════════════════════════════════════════
// // 3D 뷰어 — 씬, 조명, 로봇 로드, 조인트 적용, 렌더 루프
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// THREE.JS SETUP
// ═══════════════════════════════════════════════════════════
const cv=document.getElementById('cv'),vp=document.getElementById('vp');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0xDFE2E5);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(45,1,.001,500);
const orbit=new Orbit(camera,cv);
const ambLight=new THREE.AmbientLight(0xffffff,.45);scene.add(ambLight);
const dl1=new THREE.DirectionalLight(0xffffff,.8);dl1.position.set(5,10,5);scene.add(dl1);
const dl2=new THREE.DirectionalLight(0x8899ff,.25);dl2.position.set(-5,5,-5);scene.add(dl2);
const grid=new THREE.GridHelper(14,28,0xB8BEC5,0xCDD2D7);scene.add(grid);
const raycaster=new THREE.Raycaster();const mouse=new THREE.Vector2();

function resize(){const w=vp.clientWidth,h=vp.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
resize();new ResizeObserver(resize).observe(vp);

// ═══════════════════════════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════════════════════════
let robotRoot=null,jointObjs={},baseQs={},basePs={},jointDefs={};
let allMeshes=[],allAxes=[],wireMode=false,axisMode=false;
let selectedMesh=null,selectedOrigColor=null;
let lcdMesh=null,lcdDraw=null,glassesMesh=null,lcdTextColor='#ffffff';
let glassMatL=null,glassMatR=null;
let sliderEls={},valEls={};

// TIMELINE STATE
let keyframes=[];
let kfIdCounter=0;
let currentTime=0;
let duration=5;
let isPlaying=false;
let playSpeed=1;
let loopMode=false;
let selectedKfId=null;
let playLastT=null;
let tlDragging=false,tlDragKfId=null,tlSeeking=false;

// RENDER LOOP
let fps=0,fpsT=performance.now();
function renderLoop(now){
  requestAnimationFrame(renderLoop);
  if(isPlaying){
    if(playLastT!==null){
      currentTime+=(now-playLastT)/1000*playSpeed;
      if(currentTime>=duration){
        if(loopMode){currentTime=currentTime%duration;}
        else{currentTime=duration;isPlaying=false;playLastT=null;document.getElementById('tlPlayPause').textContent='▶';}
      }
    }
    playLastT=now;
    applyAtTime(currentTime);
  }
  if(typeof PHYS!=='undefined' && PHYS.on) PHYS.step(now);
  renderer.render(scene,camera);
  if(typeof drawTimeline==='function') drawTimeline();
  const _td=document.getElementById('tlTimeDisp'); if(_td)_td.textContent=currentTime.toFixed(2)+'s';
  fps++;if(now-fpsT>=1000){const _f=document.getElementById('fpsEl'); if(_f)_f.textContent='FPS: '+fps;fps=0;fpsT=now;}
}
requestAnimationFrame(renderLoop);

// FILE UPLOAD
let urdfFile=null,stlFiles=[];

// data/ 에서 URDF+STL 직접 fetch (업로드 없이)
async function autoLoadFromData(){
  const ov=document.getElementById('loadOv'), title=document.getElementById('loadTitle');
  const ptext=document.getElementById('ptext'), pbar=document.getElementById('pbar'), spin=document.getElementById('spinner');
  const fail=(msg)=>{ spin.style.display='none'; title.textContent='자동 로드 실패 (Auto-load failed)';
    ptext.innerHTML=msg+'<br><span style="color:#B0B7BE">data/ 경로·네트워크 확인 후 새로고침하세요</span>';
    setTimeout(()=>{ ov.style.display='none'; document.getElementById('emptyMsg').style.display='flex'; }, 4000); };
  // 오버레이 켜기
  document.getElementById('emptyMsg').style.display='none';
  ov.style.display='flex'; spin.style.display='block';
  title.textContent='data/ 에서 불러오는 중... (Loading from data/)';
  ptext.textContent='URDF 가져오는 중...'; pbar.style.width='0%';

  let urdfTxt=null, urdfName=null;
  for(const nm of URDF_NAMES){
    try{ const r=await fetch(DATA_DIR+nm); if(r.ok){ urdfTxt=await r.text(); urdfName=nm; break; } }catch(e){}
  }
  if(!urdfTxt){ fail('data/ 에서 URDF('+URDF_NAMES.join(', ')+')를 찾지 못했습니다.'); return; }

  let links;
  try{ links=parseURDF(urdfTxt).links; }catch(e){ fail('URDF 파싱 오류: '+e.message); return; }

  const names=new Set();
  for(const l of Object.values(links)) for(const v of l.visuals){ const b=basename(v.fn); if(b) names.add(b); }
  const arr=[...names]; const files=[]; let i=0;
  for(const n of arr){
    ptext.textContent=`STL 받는 중 ${++i}/${arr.length} — ${n}`;
    pbar.style.width=`${(i/arr.length)*100}%`;
    try{ const r=await fetch(DATA_DIR+n); if(r.ok) files.push(new File([await r.blob()], n)); }catch(e){}
    await sleep(0);
  }
  if(!files.length){ fail('data/ 에서 STL을 받지 못했습니다.'); return; }

  urdfFile=new File([urdfTxt], urdfName);
  stlFiles=files;
  ptext.textContent='모델 구성 중...';
  await loadRobot();   // loadRobot이 오버레이를 닫음
}

// LOAD ROBOT
async function loadRobot(){
  const _lb=document.getElementById('loadBtn'); if(_lb)_lb.disabled=true;
  document.getElementById('loadOv').style.display='flex';
  document.getElementById('emptyMsg').style.display='none';
  isPlaying=false;
  try{
    if(robotRoot){scene.remove(robotRoot);robotRoot=null;}
    jointObjs={};baseQs={};basePs={};allMeshes=[];allAxes=[];sliderEls={};valEls={};lcdMesh=null;lcdDraw=null;glassesMesh=null;glassMatL=null;glassMatR=null;

    const urdfTxt=await readText(urdfFile);
    const{links,joints}=parseURDF(urdfTxt);
    jointDefs=joints;

    const meshMap={};for(const f of stlFiles)meshMap[f.name.toLowerCase()]=f;
    const childSet=new Set(Object.values(joints).map(j=>j.child));
    const rootName=Object.keys(links).find(l=>!childSet.has(l))||Object.keys(links)[0];

    const needed=new Set();
    for(const l of Object.values(links))for(const v of l.visuals){const b=basename(v.fn);if(meshMap[b])needed.add(b);}

    const geos={};const total=needed.size;let loaded=0;
    const pbar=document.getElementById('pbar'),ptext=document.getElementById('ptext');
    for(const b of needed){
      const geo=parseSTL(await readBuf(meshMap[b]));
      geo.computeVertexNormals();
      geos[b]=geo;
      pbar.style.width=`${(++loaded/total)*100}%`;
      ptext.textContent=`${loaded} / ${total} files`;
      await sleep(0);
    }

    function getColor(n){const k=n.toLowerCase();
      if(k.includes('left')||k.startsWith('l_')||k.includes('_l_')||k.endsWith('_l'))return 0x4fc3f7;
      if(k.includes('right')||k.startsWith('r_')||k.includes('_r_')||k.endsWith('_r'))return 0xf48fb1;
      if(k.includes('head')||k.includes('servo'))return 0xffb74d;
      if(k.includes('hand')||k.includes('finger')||k.includes('thumb')||k.includes('index')||k.includes('middle')||k.includes('little')||k.includes('palm'))return 0xce93d8;
      if(k.includes('hip')||k.includes('pelvis')||k.includes('waist')||k.includes('torso'))return 0x90a4ae;
      if(k.includes('foot')||k.includes('ankle')||k.includes('knee'))return 0xa5d6a7;
      return 0x78909c;
    }
    function mkLink(lname){
      const link=links[lname];if(!link)return null;
      const grp=new THREE.Group();grp.name='link:'+lname;
      for(const v of link.visuals){const b=basename(v.fn),geo=geos[b];if(!geo)continue;
        const col=v.rgba?new THREE.Color(v.rgba[0],v.rgba[1],v.rgba[2]).getHex():getColor(lname);
        const mat=new THREE.MeshPhongMaterial({color:col,specular:0x111122,shininess:28});
        const mesh=new THREE.Mesh(geo,mat);mesh.userData={linkName:lname};
        if(b.includes('torso_lcd'))lcdMesh=mesh;
        if(b.includes('head_glasses')){glassesMesh=mesh;splitGlassesLR(mesh);}
        mesh.position.set(...v.origin.xyz);mesh.setRotationFromEuler(new THREE.Euler(...v.origin.rpy,'XYZ'));mesh.scale.set(...v.sc);
        allMeshes.push(mesh);grp.add(mesh);}
      const ax=new THREE.AxesHelper(.08);ax.visible=false;allAxes.push(ax);grp.add(ax);
      for(const jt of Object.values(joints).filter(j=>j.parent===lname)){
        const jg=new THREE.Group();jg.name='joint:'+jt.name;
        jg.position.set(...jt.origin.xyz);jg.setRotationFromEuler(new THREE.Euler(...jt.origin.rpy,'XYZ'));
        jointObjs[jt.name]=jg;baseQs[jt.name]=jg.quaternion.clone();
        basePs[jt.name]=jg.position.clone();
        const child=mkLink(jt.child);if(child)jg.add(child);grp.add(jg);}
      return grp;
    }
    robotRoot=mkLink(rootName);
    if(robotRoot){
      robotRoot.rotation.x=-Math.PI/2;
      scene.add(robotRoot);
      const box=new THREE.Box3().setFromObject(robotRoot);
      robotRoot.position.y=-box.min.y;
      orbit.focusBox(new THREE.Box3().setFromObject(robotRoot));
      setupLCD();
      if(glassesMesh){ setGlassColor('#00e1ff','#00e1ff');
        const _gl=document.getElementById('glassColorL'), _gr=document.getElementById('glassColorR');
        if(_gl)_gl.value='#00e1ff'; if(_gr)_gr.value='#00e1ff'; }
      buildPartColors();
    }
    buildSliders(joints);
    // ★ 로드 직후 슬라이더 0 적용 → 어깨 오프셋(앞으로 나란히) 반영
    for(const jn in sliderEls){ setJointValue(jn, 0); }
    const mv=Object.values(joints).filter(j=>j.type!=='fixed').length;
    document.getElementById('infoSec').style.display='block';
    document.getElementById('infoRows').innerHTML=
      [['링크',Object.keys(links).length],['관절',Object.keys(joints).length],['가동',mv],['메시',allMeshes.length]]
      .map(([k,v])=>`<div class="info-row"><span>${k}</span><span class="info-val">${v}</span></div>`).join('');
    const b=document.getElementById('statusBadge');b.textContent='완료';b.className='badge ok';
  }catch(e){console.error(e);alert('오류 (Error): '+e.message);}
  document.getElementById('loadOv').style.display='none';
  if(_lb)_lb.disabled=false;
}


function setupLCD(){
  lcdDraw=null;
  if(!lcdMesh)return;
  const geo=lcdMesh.geometry; geo.computeBoundingBox();
  const bb=geo.boundingBox; const minX=bb.min.x,maxX=bb.max.x,minZ=bb.min.z,maxZ=bb.max.z;
  const rx=(maxX-minX)||1, rz=(maxZ-minZ)||1;
  // X-Z 평면 투영 UV → LCD 실제 표면에 매핑
  const pos=geo.attributes.position; const uv=new Float32Array(pos.count*2);
  for(let i=0;i<pos.count;i++){
    uv[i*2]   = (pos.getX(i)-minX)/rx;       // u
    uv[i*2+1] = (pos.getZ(i)-minZ)/rz;     // v (상하)
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv,2));
  const cvs=document.createElement('canvas'); cvs.width=512; cvs.height=Math.max(64,Math.round(512*rz/rx));
  const ctx=cvs.getContext('2d');
  const tex=new THREE.CanvasTexture(cvs); tex.anisotropy=4;
  lcdDraw=function(txt){
    ctx.fillStyle='#000'; ctx.fillRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle=lcdTextColor; ctx.textAlign='center'; ctx.textBaseline='middle';
    const t=txt||''; let fs=cvs.height*0.6; ctx.font='bold '+fs+'px sans-serif';
    while(t && ctx.measureText(t).width>cvs.width*0.9 && fs>14){ fs-=3; ctx.font='bold '+fs+'px sans-serif'; }
    ctx.fillText(t, cvs.width/2, cvs.height/2);
    tex.needsUpdate=true;
  };
  // 화면처럼 자체발광 (조명 영향 없이 또렷)
  lcdMesh.material.color.set(0x000000);
  lcdMesh.material.emissive=new THREE.Color(0xffffff);
  lcdMesh.material.emissiveMap=tex;
  lcdMesh.material.needsUpdate=true;
  lcdDraw(document.getElementById('lcdText').value||'');
}
document.getElementById('lcdText').addEventListener('input',function(){ if(lcdDraw) lcdDraw(this.value); });
uiOn('glassColorL','input',function(){ applyEyeColor(glassMatL, this.value); });
uiOn('glassColorR','input',function(){ applyEyeColor(glassMatR, this.value); });
document.getElementById('lcdColor').addEventListener('input',function(){ lcdTextColor=this.value; if(lcdDraw) lcdDraw(document.getElementById('lcdText').value); });

// UTILS
// 안경 메시를 좌/우 두 그룹으로 나눈다.
// head_glasses.stl 은 삼각형 13,406개가 X 부호로 깨끗하게 갈리고(중앙 걸침 4개뿐)
// 좌우 대칭이라, 파일을 나누지 않고 런타임에 머티리얼 2개를 배정할 수 있다.
// 실물 확인 결과 device.eye_on_s([left, right]) 의 left 는 -X 쪽이다.
// → 그룹 0 = left 인자가 칠하는 눈(-X), 그룹 1 = right 인자가 칠하는 눈(+X).
function splitGlassesLR(mesh){
  const geo = mesh.geometry, pos = geo.attributes.position;
  if(!pos || geo.index) return;                 // STL 파서는 비인덱스 지오메트리를 준다
  const nrm = geo.attributes.normal;
  const triCount = pos.count / 3;
  const L = [], R = [];
  for(let t = 0; t < triCount; t++){
    const cx = (pos.getX(t*3) + pos.getX(t*3+1) + pos.getX(t*3+2)) / 3;
    (cx < 0 ? L : R).push(t);                   // -X = left 인자 쪽
  }
  if(!L.length || !R.length) return;            // 한쪽뿐이면 그냥 둔다
  const order = L.concat(R);
  const np = new Float32Array(pos.count * 3);
  const nn = nrm ? new Float32Array(pos.count * 3) : null;
  order.forEach((t, i) => {
    for(let k = 0; k < 3; k++){
      const src = (t*3 + k) * 3, dst = (i*3 + k) * 3;
      np[dst] = pos.array[src]; np[dst+1] = pos.array[src+1]; np[dst+2] = pos.array[src+2];
      if(nn){ nn[dst] = nrm.array[src]; nn[dst+1] = nrm.array[src+1]; nn[dst+2] = nrm.array[src+2]; }
    }
  });
  geo.setAttribute('position', new THREE.BufferAttribute(np, 3));
  if(nn) geo.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  geo.clearGroups();
  geo.addGroup(0, L.length*3, 0);               // 왼쪽 눈
  geo.addGroup(L.length*3, R.length*3, 1);      // 오른쪽 눈
  const base = mesh.material;
  glassMatL = base;
  glassMatR = base.clone();
  mesh.material = [glassMatL, glassMatR];
}

// left / right 는 실물 eye_on_s 인자와 같은 의미. 한쪽만 주면 양쪽 다 같은 색.
// 실물은 네오픽셀(자체발광)이라 (0,0,0) 은 '검은색'이 아니라 '꺼짐' 이다.
// 그래서 색을 diffuse 가 아니라 emissive 에 넣는다 → 0 이면 조명만 받는 렌즈색으로 돌아간다.
const EYE_OFF = 0x5A6068;   // 꺼졌을 때 렌즈 본래 색. 더 밝게/어둡게 하려면 이 값만 조정
function applyEyeColor(mat, colour){
  if(!mat) return;
  const c = new THREE.Color(colour);
  const on = (c.r + c.g + c.b) > 0.004;    // 0,0,0 이면 꺼짐
  if(!mat.emissive) mat.emissive = new THREE.Color(0x000000);
  mat.color.set(EYE_OFF);                  // 몸체는 항상 렌즈색
  mat.emissive.set(on ? c : 0x000000);     // 빛나는 부분만 켜고 끈다
  mat.emissiveIntensity = on ? 1 : 0;
  mat.needsUpdate = true;
}
function setGlassColor(left, right){
  if(right === undefined) right = left;
  if(glassMatL || glassMatR){ applyEyeColor(glassMatL, left); applyEyeColor(glassMatR, right); }
  else if(glassesMesh) applyEyeColor(glassesMesh.material, left);
}

// ═══════════════════════════════════════════════════════════
// 파트(링크)별 색상 — 좌측 패널에서 링크마다 색을 바꾼다
// ═══════════════════════════════════════════════════════════
// LCD 와 눈(안경)은 각각 전용 UI 가 있어서 여기서는 제외한다.
const PART_LABEL = {
  base_link:'몸통', head_pan_link:'목', head_link:'머리',
  shoulder_l_link:'왼쪽 어깨', arm_l_link:'왼팔',
  shoulder_r_link:'오른쪽 어깨', arm_r_link:'오른팔',
  leg_l_link:'왼쪽 다리', foot_l_link:'왼발',
  leg_r_link:'오른쪽 다리', foot_r_link:'오른발',
};
let partOrigColors = {};   // 링크별 원래 색 (되돌리기용)

function buildPartColors(){
  const box = document.getElementById('partColors');
  const sec = document.getElementById('partColorSec');
  if(!box || !sec) return;
  box.innerHTML = ''; partOrigColors = {};

  const byLink = {};
  allMeshes.forEach(m => {
    if(m === lcdMesh || m === glassesMesh) return;
    const ln = m.userData && m.userData.linkName;
    if(!ln) return;
    (byLink[ln] = byLink[ln] || []).push(m);
  });

  const names = Object.keys(PART_LABEL).filter(n => byLink[n])
    .concat(Object.keys(byLink).filter(n => !PART_LABEL[n]));
  if(!names.length) return;

  names.forEach(ln => {
    const hex = '#' + byLink[ln][0].material.color.getHexString();
    partOrigColors[ln] = hex;
    const row = document.createElement('div');
    row.className = 'pc-row';
    const lab = document.createElement('label');
    lab.textContent = PART_LABEL[ln] || ln.replace(/_link$/, '');
    lab.title = ln;
    const inp = document.createElement('input');
    inp.type = 'color'; inp.value = hex;
    inp.dataset.link = ln;
    inp.addEventListener('input', () => setPartColor(ln, inp.value));
    row.appendChild(lab); row.appendChild(inp);
    box.appendChild(row);
  });
  sec.style.display = 'block';
}

function setPartColor(linkName, colour){
  allMeshes.forEach(m => {
    if(m === lcdMesh || m === glassesMesh) return;
    if(!m.userData || m.userData.linkName !== linkName) return;
    const ms = Array.isArray(m.material) ? m.material : [m.material];
    ms.forEach(x => x.color.set(colour));
  });
}

uiOn('partResetBtn','click', () => {
  document.querySelectorAll('#partColors input[type=color]').forEach(inp => {
    const ln = inp.dataset.link;
    if(!ln || !partOrigColors[ln]) return;
    inp.value = partOrigColors[ln];
    setPartColor(ln, partOrigColors[ln]);
  });
});

function readText(f){return new Promise((r,j)=>{const fr=new FileReader();fr.onload=e=>r(e.target.result);fr.onerror=j;fr.readAsText(f);});}
function readBuf(f){return new Promise((r,j)=>{const fr=new FileReader();fr.onload=e=>r(e.target.result);fr.onerror=j;fr.readAsArrayBuffer(f);});}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// 페이지 열리면 data/에서 자동 로드 (실패시 업로드 UI로 폴백)
if(AUTOLOAD) window.addEventListener('load',autoLoadFromData);


// ── 조인트 슬라이더 (sliderEls 가 관절 목표각 저장소이므로 뷰어 소속) ──
function buildSliders(joints){
  const movable=Object.values(joints).filter(j=>j.type!=='fixed');
  document.getElementById('jcount').textContent=movable.length+'개';
  const groups={'머리':[],'오른팔':[],'왼팔':[],'오른다리':[],'왼다리':[],'기타':[]};
  for(const j of movable){const lab=(MOTOR_LABEL[j.name]||'');
    if(lab.includes('Head'))groups['머리'].push(j);
    else if(lab.includes('Right Arm')||lab.includes('Right Hand'))groups['오른팔'].push(j);
    else if(lab.includes('Left Arm')||lab.includes('Left Hand'))groups['왼팔'].push(j);
    else if(lab.includes('Right Leg')||lab.includes('Right Foot'))groups['오른다리'].push(j);
    else if(lab.includes('Left Leg')||lab.includes('Left Foot'))groups['왼다리'].push(j);
    else groups['기타'].push(j);
  }
  // 그룹 내부 순서: Tilt→Pan, 어깨→팔꿈치, 엉덩이→발목
  const within=n=>{n=n.toLowerCase();return n.includes('tilt')?0:n.includes('pan')?1:n.includes('shoulder')?0:n.includes('elbow')?1:n.includes('hip')?0:(n.includes('ankle')||n.includes('foot'))?1:2;};
  for(const k in groups)groups[k].sort((a,b)=>within(a.name)-within(b.name));
  const el=document.getElementById('jointsEl');
  if(!movable.length){el.innerHTML='<div class="no-joint">가동 관절 없음</div>';return;}
  let html='';
  for(const[gname,jlist]of Object.entries(groups)){
    if(!jlist.length)continue;const gid=sid(gname);
    html+=`<div class="group-header" onclick="toggleG('${gid}')"><span class="garr open" id="arr_${gid}">&#x25B6;</span><span>${gname}</span><span style="color:#B0B7BE;margin-left:4px">(${jlist.length})</span></div><div class="group-body" id="gb_${gid}">`;
    for(const j of jlist){
      const isP=j.type==='prismatic';
      const mn=isP?'0':Math.round(j.limit.lower*180/Math.PI).toString();
      const mx=isP?'180':Math.round(j.limit.upper*180/Math.PI).toString();
      const st='1';   // 정수 1도(서보각) 단위
      html+=`<div class="ji" id="ji_${sid(j.name)}" data-joint="${j.name}"><div class="ji-head"><span class="ji-name" title="${j.name}">${MOTOR_LABEL[j.name]||j.name}</span><span class="ji-type">${j.type}</span><input type="number" class="ji-val" id="v_${sid(j.name)}" value="0" min="${mn}" max="${mx}" step="1"></div><input type="range" class="jslider" data-joint="${j.name}" min="${mn}" max="${mx}" step="${st}" value="0" id="s_${sid(j.name)}"></div>`;
    }
    html+='</div>';
  }
  el.innerHTML=html;
  el.querySelectorAll('.jslider').forEach(sl=>{
    const jname=sl.dataset.joint;sliderEls[jname]=sl;valEls[jname]=document.getElementById('v_'+sid(jname));
    sl.addEventListener('input',()=>{const v=parseFloat(sl.value);setJointValue(jname,v);valEls[jname].value=Math.round(v);});
    valEls[jname].addEventListener('change',()=>{
      let v=parseFloat(valEls[jname].value);if(isNaN(v))v=0;
      const mn=parseFloat(sl.min),mx=parseFloat(sl.max);v=Math.max(mn,Math.min(mx,Math.round(v)));
      valEls[jname].value=v;sl.value=v;setJointValue(jname,v);
    });
  });
}
window.toggleG=function(gid){
  const body=document.getElementById('gb_'+gid),arr=document.getElementById('arr_'+gid);
  const open=arr.classList.contains('open');
  body.style.maxHeight=open?'0px':body.scrollHeight+'px';arr.classList.toggle('open',!open);
};

function fmtVal(jname,v){
  const jd=jointDefs[jname];
  if(jd&&jd.type==='prismatic'){
    const d=jd.limit.lower+(v/180)*(jd.limit.upper-jd.limit.lower);
    return v.toFixed(0)+'° ('+(d*1000).toFixed(1)+'mm)';
  }
  return (v*180/Math.PI).toFixed(1)+'°';
}

// ★ 조인트 적용: revolute 회전에 ZERO_OFFSET 추가 (어깨 0=앞으로 나란히)
function setJointValue(jname,v){
  if(typeof PHYS!=='undefined' && PHYS.on) return;   // 물리 모드: 자세는 물리가 결정
  const jobj=jointObjs[jname],jdef=jointDefs[jname];if(!jobj||!jdef)return;
  const ax=new THREE.Vector3(...jdef.axis).normalize();
  if(jdef.type==='prismatic'){
    const d=jdef.limit.lower+(v/180)*(jdef.limit.upper-jdef.limit.lower);
    const off=ax.clone().applyQuaternion(baseQs[jname]).multiplyScalar(d);
    jobj.position.copy(basePs[jname]).add(off);
  }else{
    const a = (VIEWER_SIGN[jname]||1)*(v*Math.PI/180) + (ZERO_OFFSET[jname]||0);   // 度→rad + 오프셋 + 뷰어방향
    jobj.quaternion.copy(baseQs[jname]).multiply(new THREE.Quaternion().setFromAxisAngle(ax,a));
  }
}
