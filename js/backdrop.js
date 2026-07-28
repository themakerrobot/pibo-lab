// ═══════════════════════════════════════════════════════════
// // 배경 테마 (책상·식탁·작업대) + 미니맵
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// BACKDROP — 테이블 위 (PIBO 실측 키 394mm 기준, 다운로드 파일 없음)
// ═══════════════════════════════════════════════════════════
// · 상판 윗면 = y 0 (로봇이 서는 바닥)
// · 로봇은 상판 '뒤쪽 가장자리에서 16cm' 지점에 서고, 정면(+Z)으로 걸어갈 공간을 비워둠
// · 물건은 전부 좌우 끝(|x| >= 0.50m)에만 배치 → 이동 경로를 막지 않음
const TOP_T = 0.038;
const CLEAR_HALF_X = 0.46;    // 이동 통로 반폭
const BACK_GAP     = 0.16;    // 로봇 ~ 뒤 가장자리 거리 (앞쪽으로 걸어갈 공간 확보)

// ── 그림자 (부드럽게, 세지 않게) ──
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
dl1.castShadow = true;
dl1.shadow.mapSize.set(2048, 2048);
dl1.shadow.bias = -0.0004;
dl1.shadow.normalBias = 0.002;
(function(c){ c.near=0.05; c.far=8; c.left=-0.95; c.right=0.95; c.top=0.95; c.bottom=-0.95; c.updateProjectionMatrix(); })(dl1.shadow.camera);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.14);
rimLight.position.set(-1.6, 1.0, -1.8);
scene.add(rimLight);
const hemiLight = new THREE.HemisphereLight(0xC9CDD2, 0x6E747A, 0.20);
scene.add(hemiLight);

// ── 절차적 텍스처 ──
function cvs(s){ const c=document.createElement('canvas'); c.width=c.height=s; return [c, c.getContext('2d')]; }
function mkTex(canvas, rep){
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if(rep) t.repeat.set(rep[0], rep[1]);
  t.anisotropy = 4;
  return t;
}
function rnd(a,b){ return a + Math.random()*(b-a); }

function texWoodTop(r,g0,b, dark){
  const [c,g] = cvs(512);
  g.fillStyle = 'rgb(' + r + ',' + g0 + ',' + b + ')'; g.fillRect(0,0,512,512);
  for(let i=0;i<170;i++){
    g.strokeStyle = 'rgba(' + ((r-dark)|0) + ',' + ((g0-dark)|0) + ',' + ((b-dark*0.8)|0) + ',' + rnd(.06,.22) + ')';
    g.lineWidth = rnd(.7, 2.6);
    const y = Math.random()*512;
    g.beginPath(); g.moveTo(0, y);
    g.bezierCurveTo(150, y+rnd(-7,7), 340, y+rnd(-7,7), 512, y+rnd(-5,5));
    g.stroke();
  }
  return mkTex(c, [1.6,1.0]);
}
function texLaminate(){
  const [c,g] = cvs(256);
  g.fillStyle = '#BDB6AB'; g.fillRect(0,0,256,256);     // 눈부시지 않은 웜그레이
  for(let i=0;i<7000;i++){
    const a = Math.random()<.5 ? '150,144,136' : '208,202,193';
    g.fillStyle = 'rgba(' + a + ',.14)';
    g.fillRect(Math.random()*256, Math.random()*256, 1.6, 1.6);
  }
  return mkTex(c, [3,2]);
}
function texSteel(){
  const [c,g] = cvs(512);
  g.fillStyle = '#8B9197'; g.fillRect(0,0,512,512);
  for(let i=0;i<2400;i++){
    const a = Math.random()<.5 ? '108,114,120' : '168,174,180';
    g.strokeStyle = 'rgba(' + a + ',' + rnd(.05,.20) + ')';
    g.lineWidth = rnd(.5,1.4);
    const y = Math.random()*512;
    g.beginPath(); g.moveTo(rnd(0,380), y); g.lineTo(rnd(120,512), y+rnd(-1,1)); g.stroke();
  }
  return mkTex(c, [2,1.2]);
}
// 커팅 매트 (1cm 눈금 / 5cm 굵은 선) — 작업대의 '이동 구역'
function texCutMat(){
  const [c,g] = cvs(512);            // 512px = 50cm
  g.fillStyle = '#274E40'; g.fillRect(0,0,512,512);
  for(let i=0;i<800;i++){
    g.strokeStyle = 'rgba(180,205,192,' + rnd(.02,.06) + ')'; g.lineWidth = rnd(.5,1.1);
    const x=Math.random()*512, y=Math.random()*512, a=rnd(0,6.28), l=rnd(8,60);
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*l, y+Math.sin(a)*l); g.stroke();
  }
  for(let i=0;i<=50;i++){
    const p = i*10.24, major = (i%5===0);
    g.strokeStyle = major ? 'rgba(206,220,212,.45)' : 'rgba(206,220,212,.16)';
    g.lineWidth = major ? 1.5 : 0.8;
    g.beginPath(); g.moveTo(p,0); g.lineTo(p,512); g.moveTo(0,p); g.lineTo(512,p); g.stroke();
  }
  return new THREE.CanvasTexture(c);
}
function texPCB(){
  const [c,g] = cvs(256);
  g.fillStyle = '#1A5A3B'; g.fillRect(0,0,256,256);
  g.strokeStyle = 'rgba(190,158,80,.5)'; g.lineWidth = 2;
  for(let i=0;i<24;i++){
    let x = Math.random()*256, y = Math.random()*256;
    g.beginPath(); g.moveTo(x,y);
    for(let k=0;k<3;k++){ x += rnd(-60,60); y += rnd(-60,60); g.lineTo(x,y); }
    g.stroke();
  }
  g.fillStyle = '#C2A054';
  for(let i=0;i<11;i++) for(let k=0;k<2;k++) g.fillRect(28+i*18, 40+k*150, 8, 8);
  return new THREE.CanvasTexture(c);
}
function texLinen(base){
  const [c,g] = cvs(128);
  g.fillStyle = base; g.fillRect(0,0,128,128);
  for(let i=0;i<128;i+=3){
    g.strokeStyle = 'rgba(0,0,0,.06)'; g.beginPath(); g.moveTo(i,0); g.lineTo(i,128); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(0,i); g.lineTo(128,i); g.stroke();
  }
  return mkTex(c, [8,5]);
}
function texPaper(){
  const [c,g] = cvs(256);
  g.fillStyle = '#DEDACF'; g.fillRect(0,0,256,256);
  g.strokeStyle = 'rgba(110,135,168,.30)'; g.lineWidth = 1;
  for(let y=28;y<256;y+=18){ g.beginPath(); g.moveTo(16,y); g.lineTo(240,y); g.stroke(); }
  return new THREE.CanvasTexture(c);
}
// 데스크 매트 (책상의 '이동 구역')
function texDeskMat(){
  const [c,g] = cvs(256);
  g.fillStyle = '#3B4148'; g.fillRect(0,0,256,256);
  for(let i=0;i<6000;i++){
    g.fillStyle = 'rgba(' + (Math.random()<.5?'26,30,34':'90,96,102') + ',.16)';
    g.fillRect(Math.random()*256, Math.random()*256, 1.8, 1.8);
  }
  return mkTex(c, [3,2]);
}

// ── 도형 헬퍼 ── (prop=true 로 표시된 것만 미니맵에 그림)
function mkBox(w,h,d, color, x,y,z, ry, map){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
    new THREE.MeshPhongMaterial({ color: color, map: map||null, shininess: 6, specular: 0x070707 }));
  m.position.set(x,y,z); if(ry) m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true; m.userData.prop = true;
  return m;
}
function mkCyl(rt,rb,h, color, x,y,z, rz){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,22),
    new THREE.MeshPhongMaterial({ color: color, shininess: 14 }));
  m.position.set(x,y,z); if(rz) m.rotation.z = rz;
  m.castShadow = true; m.receiveShadow = true; m.userData.prop = true;
  return m;
}
function mkSphere(r, color, x,y,z){
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14),
    new THREE.MeshPhongMaterial({ color: color, shininess: 18 }));
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; m.userData.prop = true;
  return m;
}
function mkSheet(w,d, mat, x,z, y, rz){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w,d), mat);
  m.rotation.x = -Math.PI/2; if(rz) m.rotation.z = rz;
  m.position.set(x, (y===undefined?0.0012:y), z);
  m.receiveShadow = true;
  return m;
}

// ── 테이블 본체 ──
// 로봇(월드 원점)이 앞 가장자리에서 FRONT_GAP 만큼 떨어지도록 테이블을 뒤로 밀어둠
function buildTable(G, W, D, H, topTex, legColor, floorColor, wallColor){
  const offZ =  (D/2 - BACK_GAP);   // Pibo 정면 = 월드 +Z
  const T = new THREE.Group();
  T.position.z = offZ;

  const topMat = new THREE.MeshPhongMaterial({ map: topTex, shininess: 8, specular: 0x080808 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, TOP_T, D), topMat);
  top.position.y = -TOP_T/2;
  top.castShadow = true; top.receiveShadow = true;
  T.add(top);

  const ap = 0.055;
  T.add(mkBox(W-0.10, ap, 0.022, legColor, 0, -TOP_T-ap/2, -D/2+0.055));
  T.add(mkBox(W-0.10, ap, 0.022, legColor, 0, -TOP_T-ap/2,  D/2-0.055));
  const lx = W/2-0.07, lz = D/2-0.07, lh = H-TOP_T;
  [[-lx,-lz],[lx,-lz],[-lx,lz],[lx,lz]].forEach(function(p){
    T.add(mkBox(0.055, lh, 0.055, legColor, p[0], -TOP_T-lh/2, p[1]));
  });
  T.traverse(function(o){ o.userData.prop = false; });   // 테이블 자체는 미니맵에서 제외

  const fl = new THREE.Mesh(new THREE.PlaneGeometry(8,8),
    new THREE.MeshPhongMaterial({ color: floorColor, shininess: 2 }));
  fl.rotation.x = -Math.PI/2; fl.position.y = -H; fl.receiveShadow = true;
  T.add(fl);
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(8,3.4),
    new THREE.MeshPhongMaterial({ color: wallColor, shininess: 1 }));
  wl.position.set(0, -H+1.7, -2.2);
  T.add(wl);

  G.add(T);
  // 월드 기준 무대 정보 (물리 바닥 · 미니맵이 사용)
  G.userData.stage = { w: W, d: D, cz: offZ, floorY: -H,
                       clearX: CLEAR_HALF_X, back: BACK_GAP };
  return T;
}

// ═══ 책상 ═══
function buildDesk(){
  const G = new THREE.Group();
  const T = buildTable(G, 1.60, 0.78, 0.73, texLaminate(), 0x6E7378, 0x8A857C, 0xA8ABA6);
  const HW = 0.80;

  // 이동 구역 = 데스크 매트
  T.add(mkSheet(0.94, 0.66, new THREE.MeshPhongMaterial({ map: texDeskMat(), shininess: 3 }), 0, 0));

  // ── 좌측 끝 (x -0.80 ~ -0.50) ──
  T.add(mkCyl(0.042,0.040,0.10, 0x4E585F, -0.63, 0.05, -0.16));           // 연필꽂이
  [[0xB2802F,0.02],[0x3A6E9E,-0.015],[0xA34840,0.005]].forEach(function(p,i){
    T.add(mkCyl(0.0045,0.0045,0.17, p[0], -0.63+p[1], 0.13, -0.16+(i-1)*0.012, rnd(-0.09,0.09)));
  });
  T.add(mkCyl(0.038,0.033,0.095, 0xBDB7AC, -0.62, 0.0475, 0.10));         // 머그
  let yy = 0;                                                              // 책 3권
  [[0x8E4436,0.030],[0x315F4C,0.026],[0xA98942,0.022]].forEach(function(p){
    T.add(mkBox(0.145, p[1], 0.21, p[0], -0.63, yy+p[1]/2, 0.24, rnd(-0.05,0.05))); yy += p[1];
  });

  // ── 우측 끝 (x 0.50 ~ 0.80) ──
  T.add(mkSheet(0.21, 0.297, new THREE.MeshPhongMaterial({ map: texPaper(), shininess: 3 }), 0.63, -0.06, 0.0016, 0.04));
  T.add(mkBox(0.215, 0.004, 0.30, 0x3B577F, 0.63, 0.002, -0.06, 0.04));   // 노트
  T.add(mkCyl(0.005,0.005,0.14, 0x24282B, 0.63, 0.008, -0.20, Math.PI/2));// 펜
  const ms = mkSphere(0.032, 0x2F3439, 0.60, 0.018, 0.20);                // 마우스
  ms.scale.set(1, 0.55, 1.45); T.add(ms);
  [[0.66,0.30,0xC2B455],[0.58,0.32,0xC08292]].forEach(function(p){         // 포스트잇
    T.add(mkSheet(0.076,0.076, new THREE.MeshPhongMaterial({ color: p[2], shininess: 2 }), p[0], p[1], 0.0013, rnd(0,0.6)));
  });

  G.userData.light = { key:0xF6F2E8, keyI:0.55, amb:0.32, hemi:0.20, hemiG:0x767B80,
                       sky:['#B9BEC2','#8A9095'], keyPos:[1.1, 1.5, 0.9],
                       fog:['#9BA1A6', 1.2, 3.6] };
  return G;
}

// ═══ 식탁 ═══
function buildDining(){
  const G = new THREE.Group();
  const T = buildTable(G, 1.60, 0.92, 0.74, texWoodTop(126,86,56, 40), 0x5E4028, 0x8B7F6D, 0xA79B8B);

  // 이동 구역 = 리넨 러너
  T.add(mkSheet(0.94, 0.74, new THREE.MeshPhongMaterial({ map: texLinen('#9CAAA2'), shininess: 2 }), 0, 0));

  // ── 좌측 끝 ── 과일 그릇
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.105,22,14,0,6.3,0,1.15),
    new THREE.MeshPhongMaterial({ color: 0xAEB9BD, shininess: 22, side: THREE.DoubleSide }));
  bowl.rotation.x = Math.PI; bowl.position.set(-0.63,0.055,0.02);
  bowl.castShadow = true; bowl.receiveShadow = true; bowl.userData.prop = true; T.add(bowl);
  T.add(mkSphere(0.036, 0x9B372F, -0.66, 0.048, 0.02));
  T.add(mkSphere(0.034, 0xAB8531, -0.59, 0.046, 0.05));
  T.add(mkSphere(0.033, 0x839647, -0.62, 0.045, -0.02));
  T.add(mkCyl(0.028,0.036,0.11, 0x94A6AB, -0.62, 0.055, -0.28));          // 화병
  T.add(mkCyl(0.004,0.004,0.16, 0x59703F, -0.62, 0.18, -0.28));
  T.add(mkSphere(0.022, 0xB05F71, -0.62, 0.265, -0.28));

  // ── 우측 끝 ── 머그 + 냅킨 + 수저
  T.add(mkCyl(0.075,0.075,0.006, 0xBEBAB1, 0.62, 0.003, -0.14));
  T.add(mkCyl(0.040,0.034,0.095, 0xC0BCB3, 0.62, 0.0475, -0.14));
  const hd = new THREE.Mesh(new THREE.TorusGeometry(0.023,0.006,8,18),
    new THREE.MeshPhongMaterial({ color: 0xC0BCB3 }));
  hd.position.set(0.665,0.052,-0.14); hd.castShadow = true; hd.userData.prop = true; T.add(hd);
  T.add(mkSheet(0.17, 0.21, new THREE.MeshPhongMaterial({ map: texLinen('#B4AFA2'), shininess: 2 }), 0.62, 0.16, 0.0014, 0.12));
  T.add(mkBox(0.012, 0.004, 0.17, 0x9CA1A5, 0.62, 0.004, 0.16, 0.12));

  G.userData.light = { key:0xF2E4CE, keyI:0.58, amb:0.30, hemi:0.20, hemiG:0x857A6C,
                       sky:['#B4A895','#877C6D'], keyPos:[1.0, 1.5, 0.8],
                       fog:['#93887A', 1.2, 3.6] };
  return G;
}

// ═══ 작업대 ═══
function buildWorkbench(){
  const G = new THREE.Group();
  const T = buildTable(G, 1.60, 0.86, 0.78, texSteel(), 0x43484D, 0x6E7276, 0x8E9498);

  // 이동 구역 = 커팅 매트
  T.add(mkSheet(0.94, 0.70, new THREE.MeshPhongMaterial({ map: texCutMat(), shininess: 4 }), 0, 0));

  // ── 좌측 끝 ── PCB · 서보 · 드라이버
  T.add(mkBox(0.16, 0.0018, 0.10, 0xffffff, -0.63, 0.001, -0.22, 0.10, texPCB()));
  T.add(mkBox(0.020, 0.0405, 0.040, 0x24282C, -0.63, 0.020, -0.02, 0.0));   // DS3115MG
  [[-0.58,0.16,0xA85824],[-0.68,0.16,0x2F5586]].forEach(function(p){        // 드라이버(세로)
    T.add(mkCyl(0.011,0.013,0.09, p[2], p[0], 0.011, p[1], Math.PI/2));
    T.add(mkCyl(0.0035,0.0035,0.10, 0x9AA0A6, p[0], 0.0035, p[1]+0.095, Math.PI/2));
  });

  // ── 우측 끝 ── 트레이 · 테이프 · 롱노즈
  T.add(mkBox(0.14, 0.028, 0.20, 0x33383D, 0.63, 0.014, -0.18));
  T.add(mkBox(0.125, 0.020, 0.185, 0x454B51, 0.63, 0.020, -0.18));
  [[0.59,-0.23,0xA1832A],[0.67,-0.14,0x8C9297],[0.62,-0.16,0xA1832A]].forEach(function(p){
    T.add(mkBox(0.012,0.010,0.012, p[2], p[0], 0.033, p[1], rnd(0,1.5)));
  });
  const tape = new THREE.Mesh(new THREE.TorusGeometry(0.035,0.014,10,26),
    new THREE.MeshPhongMaterial({ color: 0x1C2024, shininess: 10 }));
  tape.rotation.x = Math.PI/2; tape.position.set(0.62,0.014,0.06);
  tape.castShadow = true; tape.receiveShadow = true; tape.userData.prop = true; T.add(tape);
  T.add(mkBox(0.020, 0.010, 0.15, 0x7C8288, 0.63, 0.005, 0.28, 0.06));
  T.add(mkBox(0.026, 0.014, 0.07, 0x953A30, 0.63, 0.007, 0.33, 0.06));

  G.userData.light = { key:0xE8F0F6, keyI:0.58, amb:0.32, hemi:0.20, hemiG:0x71777C,
                       sky:['#A9B0B6','#7C8388'], keyPos:[0.9, 1.6, 0.7],
                       fog:['#8B9298', 1.2, 3.6] };
  return G;
}


// 주행 매트 (아스팔트 도로 + 중앙선 + 횡단보도 + 5cm 격자)
function texRoadMat(W, D){
  // 1px = 1mm 스케일로 상판 이동구역 전체를 한 장에 그린다
  const pw = Math.round(W*1000), ph = Math.round(D*1000);
  const c = document.createElement('canvas'); c.width = pw; c.height = ph;
  const g = c.getContext('2d');
  // 잔디 바탕
  g.fillStyle = '#4A6B3E'; g.fillRect(0,0,pw,ph);
  for(let i=0;i<pw*ph/90;i++){
    g.fillStyle = 'rgba(' + (Math.random()<.5?'58,88,48':'86,120,70') + ',.25)';
    g.fillRect(Math.random()*pw, Math.random()*ph, 2, 2);
  }
  // 도로: 세로 큰길(중앙) + 가로 큰길(중간) 십자
  const RW = 180;                                  // 도로폭 18cm
  g.fillStyle = '#3E4247';
  g.fillRect(pw/2-RW/2, 0, RW, ph);                // 세로
  g.fillRect(0, ph/2-RW/2, pw, RW);                // 가로
  // 아스팔트 질감
  for(let i=0;i<5000;i++){
    const x=Math.random()*pw, y=Math.random()*ph;
    const onV = Math.abs(x-pw/2)<RW/2, onH = Math.abs(y-ph/2)<RW/2;
    if(!onV && !onH) continue;
    g.fillStyle = 'rgba(' + (Math.random()<.5?'50,54,58':'74,79,84') + ',.4)';
    g.fillRect(x,y,2,2);
  }
  // 도로 경계 흰 실선
  g.strokeStyle = '#C9CDD1'; g.lineWidth = 6;
  [[pw/2-RW/2],[pw/2+RW/2]].forEach(function(p){
    g.beginPath(); g.moveTo(p[0],0); g.lineTo(p[0],ph); g.stroke(); });
  [[ph/2-RW/2],[ph/2+RW/2]].forEach(function(p){
    g.beginPath(); g.moveTo(0,p[0]); g.lineTo(pw,p[0]); g.stroke(); });
  // 중앙 점선 (노란색)
  g.strokeStyle = '#D8B540'; g.lineWidth = 8; g.setLineDash([60,50]);
  g.beginPath(); g.moveTo(pw/2,0); g.lineTo(pw/2,ph); g.stroke();
  g.beginPath(); g.moveTo(0,ph/2); g.lineTo(pw,ph/2); g.stroke();
  g.setLineDash([]);
  // 횡단보도 (교차로 네 방향)
  g.fillStyle = '#C9CDD1';
  const zw = 24, zl = RW - 24;
  for(let i=-3;i<=3;i++){
    const off = i*44;
    g.fillRect(pw/2+off-zw/2, ph/2-RW/2-90, zw, 70);       // 위
    g.fillRect(pw/2+off-zw/2, ph/2+RW/2+20, zw, 70);       // 아래
    g.fillRect(pw/2-RW/2-90, ph/2+off-zw/2, 70, zw);       // 왼
    g.fillRect(pw/2+RW/2+20, ph/2+off-zw/2, 70, zw);       // 오
  }
  // 잔디 위 5cm 보조 격자 (걸음 수 세기용)
  g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1.5;
  for(let x=0;x<=pw;x+=50){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,ph); g.stroke(); }
  for(let y=0;y<=ph;y+=50){ g.beginPath(); g.moveTo(0,y); g.lineTo(pw,y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  return t;
}

// ═══ 주행 매트 ═══
function buildRoadMat(){
  const G = new THREE.Group();
  const T = buildTable(G, 1.60, 0.86, 0.74, texLaminate(), 0x6E7378, 0x8A857C, 0xA8ABA6);
  const MW = 1.10, MD = 0.80;                     // 매트 크기
  T.add(mkSheet(MW, MD, new THREE.MeshPhongMaterial({ map: texRoadMat(MW, MD), shininess: 3 }), 0, 0));
  // 모서리 표지 콘 4개 (매트 밖, 이동엔 지장 없음)
  [[-0.62,-0.30],[-0.62,0.30],[0.62,-0.30],[0.62,0.30]].forEach(function(p){
    T.add(mkCyl(0.004, 0.028, 0.055, 0xC4622E, p[0], 0.0275, p[1]));
    T.add(mkCyl(0.030, 0.033, 0.006, 0xC4622E, p[0], 0.003, p[1]));
  });
  G.userData.light = { key:0xF6F2E8, keyI:0.56, amb:0.32, hemi:0.20, hemiG:0x767B80,
                       sky:['#B9BEC2','#8A9095'], keyPos:[1.1, 1.5, 0.9],
                       fog:['#9BA1A6', 1.2, 3.6] };
  return G;
}

// 스모 링 (원형 도효 + 흰 테두리 + 시작선)
function texSumoRing(size, ringR, W){
  const pw = Math.round(W*1000);
  const c = document.createElement('canvas'); c.width = c.height = pw;
  const g = c.getContext('2d');
  const cx = pw/2, R = ringR*1000;
  // 바깥: 짙은 매트
  g.fillStyle = '#2A2E33'; g.fillRect(0,0,pw,pw);
  for(let i=0;i<8000;i++){
    g.fillStyle = 'rgba(' + (Math.random()<.5?'22,26,30':'46,52,58') + ',.3)';
    g.fillRect(Math.random()*pw, Math.random()*pw, 2, 2);
  }
  // 도효 원판 (모래색)
  g.fillStyle = '#C8A96B';
  g.beginPath(); g.arc(cx,cx,R,0,6.29); g.fill();
  for(let i=0;i<6000;i++){
    const a=Math.random()*6.28, r=Math.sqrt(Math.random())*R;
    g.fillStyle = 'rgba(' + (Math.random()<.5?'176,146,90':'214,186,124') + ',.35)';
    g.fillRect(cx+Math.cos(a)*r, cx+Math.sin(a)*r, 2.4, 2.4);
  }
  // 흰 경계선 (다와라)
  g.strokeStyle = '#E8E4DA'; g.lineWidth = 14;
  g.beginPath(); g.arc(cx,cx,R-10,0,6.29); g.stroke();
  // 시작선 2개 (중앙)
  g.strokeStyle = '#8C4A3E'; g.lineWidth = 10;
  g.beginPath(); g.moveTo(cx-55, cx-R*0.28); g.lineTo(cx+55, cx-R*0.28); g.stroke();
  g.beginPath(); g.moveTo(cx-55, cx+R*0.28); g.lineTo(cx+55, cx+R*0.28); g.stroke();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  return t;
}

// ═══ 스모 링 ═══
function buildSumo(){
  const G = new THREE.Group();
  const T = buildTable(G, 1.60, 0.86, 0.74, texWoodTop(96,74,52, 34), 0x4A3A28, 0x8B7F6D, 0xA79B8B);
  const RING_R = 0.36;                            // 링 반지름 36cm
  T.add(mkSheet(0.80, 0.80, new THREE.MeshPhongMaterial({ map: texSumoRing(0.8, RING_R, 0.8), shininess: 3 }), 0, 0));
  // 관중용 미니 깃발
  [[-0.60,-0.28,0xB05648],[-0.60,0.26,0x3A6E9E],[0.60,-0.26,0xC2A054],[0.60,0.28,0x4F8A5E]].forEach(function(p){
    T.add(mkCyl(0.003,0.003,0.11, 0x8C9297, p[0], 0.055, p[1]));
    T.add(mkBox(0.05, 0.032, 0.002, p[2], p[0]+0.026, 0.092, p[1]));
  });
  // 게임 규칙용: 링 반지름을 STAGE 에 실어 보낸다 (링 밖 = fallOff 판정에 사용 가능)
  G.userData.stage.ringR = RING_R;
  G.userData.light = { key:0xF2E4CE, keyI:0.60, amb:0.30, hemi:0.20, hemiG:0x857A6C,
                       sky:['#9A8F80','#6E6458'], keyPos:[1.0, 1.6, 0.8],
                       fog:['#83786A', 1.2, 3.6] };
  return G;
}

// ═══ 심플 ═══
function buildPlain(){
  const G = new THREE.Group();
  const f = new THREE.Mesh(new THREE.CircleGeometry(6, 64),
    new THREE.MeshPhongMaterial({ color: 0xB6BABE, shininess: 3 }));
  f.rotation.x = -Math.PI/2; f.position.y = -0.0005; f.receiveShadow = true;
  G.add(f);
  G.userData.light = { key:0xFFFFFF, keyI:0.58, amb:0.34, hemi:0.20, hemiG:0x777C81,
                       sky:['#C4C9CD','#93999E'], keyPos:[1.2, 2.0, 1.4], grid:true,
                       fog:['#93999E', 2.5, 7.0] };
  return G;
}

// ── 테마 전환 ──
function gradTex(top, bottom){
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const lg = g.createLinearGradient(0,0,0,256);
  lg.addColorStop(0, top); lg.addColorStop(1, bottom);
  g.fillStyle = lg; g.fillRect(0,0,4,256);
  const t = new THREE.CanvasTexture(c); t.minFilter = t.magFilter = THREE.LinearFilter;
  return t;
}
const THEMES = {
  desk:   { label:'책상',     build: buildDesk },
  dining: { label:'식탁',     build: buildDining },
  bench:  { label:'작업대',   build: buildWorkbench },
  road:   { label:'주행 매트', build: buildRoadMat },
  sumo:   { label:'스모 링',   build: buildSumo },
  plain:  { label:'심플',     build: buildPlain },
};
let themeGroup = null;
let gridOn = true;
let miniProps = [];          // 미니맵용 물건 발자국 (월드 XZ)

function disposeGroup(g){
  g.traverse(function(o){
    if(o.geometry) o.geometry.dispose();
    if(o.material){
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(function(m){ if(m.map) m.map.dispose(); m.dispose(); });
    }
  });
}
function collectProps(g){
  const out = [], bb = new THREE.Box3();
  g.updateMatrixWorld(true);
  g.traverse(function(o){
    if(!o.isMesh || !o.userData.prop) return;
    bb.setFromObject(o);
    if(bb.max.y < 0.004) return;                 // 상판보다 낮으면 무시
    out.push({ x:(bb.min.x+bb.max.x)/2, z:(bb.min.z+bb.max.z)/2,
               w:bb.max.x-bb.min.x, d:bb.max.z-bb.min.z });
  });
  return out;
}
function setTheme(key){
  if(themeGroup){ scene.remove(themeGroup); disposeGroup(themeGroup); themeGroup = null; }
  themeGroup = THEMES[key].build();
  scene.add(themeGroup);
  const L = themeGroup.userData.light;
  dl1.color.set(L.key); dl1.intensity = L.keyI;
  dl1.position.set(L.keyPos[0], L.keyPos[1], L.keyPos[2]);
  ambLight.intensity = L.amb;
  hemiLight.intensity = L.hemi; hemiLight.groundColor.set(L.hemiG);
  scene.background = gradTex(L.sky[0], L.sky[1]);
  scene.fog = L.fog ? new THREE.Fog(new THREE.Color(L.fog[0]), L.fog[1], L.fog[2]) : null;
  window.STAGE = themeGroup.userData.stage || null;
  miniProps = themeGroup.userData.stage ? collectProps(themeGroup) : [];
  miniTrail.length = 0;
  grid.visible = !!L.grid && gridOn;
  uiStyle('gridBtn','opacity', L.grid ? 1 : 0.4);
  const mm = document.getElementById('miniMap');
  if(mm){
    mm.style.display = window.STAGE ? 'block' : 'none';
    const s = window.STAGE;
    if(s) document.getElementById('miniLbl').textContent =
      THEMES[key].label + '  ' + s.w.toFixed(2) + ' × ' + s.d.toFixed(2) + ' m';
  }
}

grid.scale.set(0.35, 1, 0.35);
grid.position.y = 0.0015;
grid.material.vertexColors = false;
grid.material.transparent = true;
grid.material.opacity = 0.30;
grid.material.color.set('#7C858E');
grid.material.needsUpdate = true;

// ═══════════════════════════════════════════════════════════
// MINI MAP — 상판을 위에서 내려다본 평면도. 로봇 위치를 점으로.
// ═══════════════════════════════════════════════════════════
const miniTrail = [];
const MINI_TRAIL_MAX = 260;
function drawMiniMap(){
  const cv = document.getElementById('miniCv');
  const S = window.STAGE;
  if(!cv || !S || !robotRoot) return;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, M = 9;
  const sc = Math.min((W-M*2)/S.w, (H-M*2)/S.d);
  const cx = W/2, cy = H/2;
  // 월드 → 맵 (화면 위쪽 = -Z = 로봇의 정면)
  const px = function(x){ return cx - x*sc; };          // 위에서 본 평면도를 180도 돌려
  const py = function(z){ return cy - (z - S.cz)*sc; };  // 로봇 정면이 화면 위쪽이 되게

  g.clearRect(0,0,W,H);
  // 상판
  g.fillStyle = '#E7E9EB'; g.strokeStyle = '#8D959D'; g.lineWidth = 1;
  g.beginPath(); g.rect(px(-S.w/2), py(S.cz-S.d/2), S.w*sc, S.d*sc); g.fill(); g.stroke();
  // 이동 구역
  g.fillStyle = 'rgba(120,160,190,.20)';
  g.fillRect(px(-S.clearX), py(S.cz-S.d/2)+1, S.clearX*2*sc, S.d*sc-2);
  // 물건
  g.fillStyle = '#B4BAC0';
  miniProps.forEach(function(p){
    g.fillRect(px(p.x-p.w/2), py(p.z-p.d/2), Math.max(2,p.w*sc), Math.max(2,p.d*sc));
  });
  // 이동 궤적
  if(miniTrail.length > 1){
    g.strokeStyle = 'rgba(232,89,12,.45)'; g.lineWidth = 1.4;
    g.beginPath();
    for(let i=0;i<miniTrail.length;i++){
      const t = miniTrail[i];
      if(i===0) g.moveTo(px(t[0]), py(t[1])); else g.lineTo(px(t[0]), py(t[1]));
    }
    g.stroke();
  }
  // 로봇
  const p = robotRoot.position;
  const inside = Math.abs(p.x) <= S.w/2 && Math.abs(p.z - S.cz) <= S.d/2;
  const fw = new THREE.Vector3(0,-1,0).applyQuaternion(robotRoot.quaternion); // URDF -Y = 정면(LCD·눈 쪽)
  g.strokeStyle = inside ? '#E8590C' : '#B33'; g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(px(p.x), py(p.z));
  g.lineTo(px(p.x) - fw.x*11, py(p.z) - fw.z*11); g.stroke();
  g.fillStyle = inside ? '#E8590C' : '#B33';
  g.beginPath(); g.arc(px(p.x), py(p.z), 3.6, 0, 7); g.fill();
  if(!inside){
    g.fillStyle = '#B33'; g.font = 'bold 9px monospace';
    g.fillText('상판 이탈', 6, 11);
  }
}
function pushTrail(){
  if(!window.STAGE || !robotRoot) return;
  const p = robotRoot.position;
  const last = miniTrail[miniTrail.length-1];
  if(!last || Math.hypot(p.x-last[0], p.z-last[1]) > 0.004){
    miniTrail.push([p.x, p.z]);
    if(miniTrail.length > MINI_TRAIL_MAX) miniTrail.shift();
  }
}
setInterval(function(){ pushTrail(); drawMiniMap(); }, 60);
uiOn('miniClear','click', function(){ miniTrail.length = 0; });

uiOn('themeSel','change', function(e){ setTheme(e.target.value); });

// 로봇 로드 후 그림자 켜기
const _loadRobotOrig = loadRobot;
loadRobot = async function(){
  const r = await _loadRobotOrig.apply(this, arguments);
  allMeshes.forEach(function(m){ m.castShadow = true; m.receiveShadow = true; });
  miniTrail.length = 0;
  return r;
};

setTheme('desk');
