// ═══════════════════════════════════════════════════════════
// // 물리 (Rapier3D) — 넘어짐 / 보행
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// PHYSICS (Rapier3D)  ★ 질량/충돌박스는 아래 표 하나만 고치면 됨 ★
// ═══════════════════════════════════════════════════════════
// m = 질량(kg) | c = 박스 중심(링크 좌표계, m) | s = 박스 크기(m) | fr = 마찰
// ★ c 와 s 는 data/*.stl 의 실제 경계상자를 측정한 값 (추정치 아님)
//   전체 키 394mm · 발바닥 접지면 73 x 106mm · 양발 바깥폭 164mm · 무게중심 지면에서 179mm
// 질량만 추정: 총 2.0kg 을 DS3115MG 서보 60g x10 의 장착 위치 기준으로 배분
const PHYS_LINKS = {
  // 몸통은 부품별로 나눠 무게중심을 실제에 맞춤 (배터리 아래-앞, PCB 그 뒤에 깔림)
  base_link:       {parts:[
    {m:0.43, c:[ 0.0000,-0.0050, 0.1830], s:[0.1350,0.1258,0.1200], fr:0.5},  // 외피
    {m:0.17, c:[ 0.0000,-0.0350, 0.1220], s:[0.0680,0.0560,0.0200], fr:0.5},  // 배터리 18650 3S1P
    {m:0.12, c:[ 0.0000, 0.0200, 0.1215], s:[0.0850,0.0560,0.0190], fr:0.5},  // PCB
    {m:0.06, c:[ 0.0000, 0.0000, 0.2250], s:[0.0400,0.0200,0.0405], fr:0.5},  // 서보 head_pan
    {m:0.06, c:[ 0.0645, 0.0000, 0.2027], s:[0.0200,0.0400,0.0405], fr:0.5},  // 서보 shoulder_l
    {m:0.06, c:[-0.0645, 0.0000, 0.2027], s:[0.0200,0.0400,0.0405], fr:0.5},  // 서보 shoulder_r
    {m:0.06, c:[ 0.0330, 0.0000, 0.1120], s:[0.0200,0.0400,0.0405], fr:0.5},  // 서보 hip_l
    {m:0.06, c:[-0.0330, 0.0000, 0.1120], s:[0.0200,0.0400,0.0405], fr:0.5},  // 서보 hip_r
  ]},
  head_pan_link:   {m:0.10, c:[-0.0000,-0.0001, 0.0270], s:[0.0573,0.0656,0.0590], fr:0.5},
  head_link:       {m:0.20, c:[-0.0007,-0.0001, 0.0352], s:[0.1061,0.0960,0.1326], fr:0.5},
  shoulder_l_link: {m:0.10, c:[ 0.0253,-0.0001,-0.0082], s:[0.0720,0.0753,0.0776], fr:0.5},
  arm_l_link:      {m:0.05, c:[ 0.0139,-0.0002,-0.0227], s:[0.0691,0.0611,0.0847], fr:0.5},
  shoulder_r_link: {m:0.10, c:[-0.0287,-0.0001,-0.0085], s:[0.0654,0.0753,0.0776], fr:0.5},
  arm_r_link:      {m:0.05, c:[-0.0139, 0.0005,-0.0227], s:[0.0691,0.0611,0.0847], fr:0.5},
  leg_l_link:      {m:0.11, c:[ 0.0021,-0.0056,-0.0353], s:[0.0436,0.0772,0.0847], fr:0.5},
  leg_r_link:      {m:0.11, c:[-0.0018,-0.0074,-0.0359], s:[0.0436,0.0772,0.0859], fr:0.5},
  foot_l_link:     {m:0.08, c:[ 0.0097, 0.0004,-0.0173], s:[0.0732,0.1061,0.0549], fr:1.1},
  foot_r_link:     {m:0.08, c:[-0.0097, 0.0001,-0.0176], s:[0.0732,0.1061,0.0549], fr:1.1},
};
// 서보 모델: 강성 30 N·m/rad → 약 2.8도 오차에서 1.47N·m (DS3115MG 스톨)에 도달
const MOTOR_STIFFNESS = 30;
const MOTOR_DAMPING   = 1.5;
const SOLVER_ITERS    = 8;
const LENGTH_UNIT     = 0.1;   // 40cm급 로봇임을 Rapier에 알림 (접촉 안정성 ↑)
// 접촉 강성. 기본값이면 2kg 무게에 발이 4.7mm 파묻힌다.
//   60  → 1.25mm, backward 기울기 16.1°  ← 채택 (파묻힘·흔들림 둘 다 개선)
//   120 → 0.30mm 지만 backward 가 25.1° 로 위태로워짐
//   180+ → 접촉이 튀어서 살짝만 밀어도 넘어짐
const CONTACT_FREQ    = 60;
const ALLOWED_ERR     = 0.0001;
const FALL_TILT_DEG   = 45;
const GROUND_FRICTION = 1.1;
const PHYS_DT         = 1/240;

window.PHYS = {
  on:false, ready:false, world:null,
  bodies:{}, joints:{}, acc:0, tilt:0, fallen:false,
  startXZ:null, rest:null, _tmpQ1:null, _tmpQ2:null, _last:undefined,

  init(){
    this._tmpQ1=new THREE.Quaternion(); this._tmpQ2=new THREE.Quaternion();
    this.ready=true;
    uiSet('physBtn','disabled',false);
    uiText('physEngine','Rapier');
    tryAutoPhysics();
  },

  build(){
    if(!robotRoot){alert(PIBO_T('로봇을 먼저 로드하세요'));return false;}
    const R=window.RAPIER;
    this.world=new R.World({x:0,y:-9.81,z:0});
    this.world.timestep=PHYS_DT;
    try{
      const ip=this.world.integrationParameters;
      ip.numSolverIterations=SOLVER_ITERS;
      ip.lengthUnit=LENGTH_UNIT;
      ip.contact_natural_frequency=CONTACT_FREQ;
      ip.normalizedAllowedLinearError=ALLOWED_ERR;
    }catch(e){ console.warn('integrationParameters',e); }

    // 바닥 — 테마가 테이블이면 상판 크기만큼만 (가장자리를 넘으면 실제로 떨어짐)
    const st = (typeof STAGE!=='undefined' && STAGE) ? STAGE : null;
    const tw = st ? st.w/2 : 10, td = st ? st.d/2 : 10;
    const gb=this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,-0.5, st ? st.cz : 0));
    const gc=R.ColliderDesc.cuboid(tw,0.5,td).setFriction(GROUND_FRICTION).setRestitution(0);
    gc.setCollisionGroups(0x00010002);
    this.world.createCollider(gc,gb);
    if(st && st.floorY!=null){                       // 테이블 아래 방바닥
      const fb=this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,st.floorY-0.5,0));
      const fc=R.ColliderDesc.cuboid(6,0.5,6).setFriction(GROUND_FRICTION).setRestitution(0);
      fc.setCollisionGroups(0x00010002);
      this.world.createCollider(fc,fb);
    }

    this.rest={pos:robotRoot.position.clone(), quat:robotRoot.quaternion.clone()};
    robotRoot.updateWorldMatrix(true,true);
    this.bodies={}; this.joints={};

    for(const lname in PHYS_LINKS){
      const g=robotRoot.getObjectByName('link:'+lname);
      if(!g){ console.warn('link group 없음:',lname); continue; }
      const P=PHYS_LINKS[lname];
      const p=new THREE.Vector3(), q=new THREE.Quaternion();
      g.getWorldPosition(p); g.getWorldQuaternion(q);
      const rb=this.world.createRigidBody(
        R.RigidBodyDesc.dynamic()
         .setTranslation(p.x,p.y,p.z)
         .setRotation({x:q.x,y:q.y,z:q.z,w:q.w})
         .setLinearDamping(0.05).setAngularDamping(0.15)
         .setCanSleep(false)   // ★ 슬립 금지: 잠들면 모터 목표를 바꿔도 반응하지 않음
      );
      const parts = P.parts || [P];
      for(const q of parts){
        const vol=q.s[0]*q.s[1]*q.s[2];
        const cd=R.ColliderDesc.cuboid(q.s[0]/2,q.s[1]/2,q.s[2]/2)
          .setTranslation(q.c[0],q.c[1],q.c[2])
          .setDensity(q.m/vol).setFriction(q.fr).setRestitution(0);
        cd.setCollisionGroups(0x00020001);  // 자기 몸끼리는 충돌 안 함
        this.world.createCollider(cd,rb);
      }
      this.bodies[lname]={rb, obj:g};
    }

    for(const jn in jointDefs){
      const jd=jointDefs[jn];
      if(jd.type==='fixed') continue;
      const pb=this.bodies[jd.parent], cb=this.bodies[jd.child];
      if(!pb||!cb) continue;
      const o=jd.origin.xyz, ax=new THREE.Vector3(...jd.axis).normalize();
      const params=R.JointData.revolute(
        {x:o[0],y:o[1],z:o[2]}, {x:0,y:0,z:0}, {x:ax.x,y:ax.y,z:ax.z});
      const j=this.world.createImpulseJoint(params,pb.rb,cb.rb,true);
      try{ j.setContactsEnabled(false); }catch(e){}
      try{ j.configureMotorModel(R.MotorModel.ForceBased); }catch(e){ console.warn('motor model',e); }
      this.joints[jn]={j, ax, pb, cb, jobj:jointObjs[jn], last:undefined};
    }

    const base=this.bodies['base_link'].rb.translation();
    this.startXZ={x:base.x, z:base.z};
    this.acc=0; this.fallen=false; this._last=undefined;
    return true;
  },

  enable(){
    if(!this.ready){alert(PIBO_T('물리 엔진 로딩 중입니다'));return;}
    if(this.on) return;
    if(!this.build()){ if(this.world){this.world.free();this.world=null;} return; }
    this.on=true;
    uiClass('physBtn','on',true);
    uiText('physState','ON');
  },

  disable(){
    if(!this.on) return;
    this.on=false;
    if(this.world){ this.world.free(); this.world=null; }
    this.bodies={}; this.joints={};
    if(robotRoot && this.rest){
      robotRoot.position.copy(this.rest.pos);
      robotRoot.quaternion.copy(this.rest.quat);
    }
    for(const jn in sliderEls) setJointValue(jn, parseFloat(sliderEls[jn].value));
    uiClass('physBtn','on',false);
    uiText('physState','OFF');
    uiText('physTilt','-');
    uiText('physDist','-');
    uiStyle('fallBanner','display','none');
  },

  reset(){ const was=this.on; this.disable(); if(was) this.enable(); },

  step(now){
    if(!this.world) return;

    // 1) 슬라이더(목표각) → 모터
    for(const jn in this.joints){
      const J=this.joints[jn];
      const sl=sliderEls[jn]; if(!sl) continue;
      const deg=parseFloat(sl.value)||0;
      const target=(VIEWER_SIGN[jn]||1)*(deg*Math.PI/180)+(ZERO_OFFSET[jn]||0);
      if(J.last===undefined || Math.abs(target-J.last)>1e-6){  // 목표가 바뀌면 확실히 깨움
        J.last=target; J.pb.rb.wakeUp(); J.cb.rb.wakeUp();
      }
      try{ J.j.configureMotorPosition(target, MOTOR_STIFFNESS, MOTOR_DAMPING); }catch(e){}
    }

    // 2) 물리 진행
    if(this._last===undefined) this._last=now;
    let dt=(now-this._last)/1000; this._last=now;
    if(dt>0.1) dt=0.1;
    this.acc+=dt;
    let n=0;
    while(this.acc>=PHYS_DT && n<8){ this.world.step(); this.acc-=PHYS_DT; n++; }
    if(n===8) this.acc=0;

    // 3) 물리 → 화면
    const bb=this.bodies['base_link'];
    const t=bb.rb.translation(), r=bb.rb.rotation();
    robotRoot.position.set(t.x,t.y,t.z);
    robotRoot.quaternion.set(r.x,r.y,r.z,r.w);

    for(const jn in this.joints){
      const J=this.joints[jn];
      const rp=J.pb.rb.rotation(), rc=J.cb.rb.rotation();
      this._tmpQ1.set(rp.x,rp.y,rp.z,rp.w).invert();
      this._tmpQ2.set(rc.x,rc.y,rc.z,rc.w);
      const qrel=this._tmpQ1.multiply(this._tmpQ2);
      const sdot=qrel.x*J.ax.x+qrel.y*J.ax.y+qrel.z*J.ax.z;
      const ang=2*Math.atan2(sdot, qrel.w);
      if(J.jobj) J.jobj.quaternion.copy(baseQs[jn])
        .multiply(new THREE.Quaternion().setFromAxisAngle(J.ax,ang));
    }

    // 4) 넘어짐 판정 (로봇 로컬 +Z 가 월드 up)
    const up=new THREE.Vector3(0,0,1).applyQuaternion(robotRoot.quaternion);
    this.tilt=Math.acos(Math.max(-1,Math.min(1,up.y)))*180/Math.PI;
    const fell=this.tilt>FALL_TILT_DEG;
    if(fell!==this.fallen){
      this.fallen=fell;
      uiStyle('fallBanner','display',fell?'block':'none');
      uiText('physState',fell?PIBO_T('넘어짐'):'ON');
    }
    uiText('physTilt',this.tilt.toFixed(1)+'°');
    const dx=t.x-this.startXZ.x, dz=t.z-this.startXZ.z;
    uiText('physDist',(Math.hypot(dx,dz)*1000).toFixed(0)+'mm');
  },
};

// 기본값은 물리 ON. Rapier 준비와 로봇 로드가 모두 끝나면 자동으로 켜진다.
let PHYS_AUTO = true;
function tryAutoPhysics(){
  if(PHYS_AUTO && PHYS.ready && !PHYS.on && typeof robotRoot!=='undefined' && robotRoot)
    requestAnimationFrame(()=>PHYS.enable());   // 로드 마무리 후에 켜지도록 한 프레임 양보
}
const _loadRobotForPhys = loadRobot;
loadRobot = async function(){
  const r = await _loadRobotForPhys.apply(this, arguments);
  tryAutoPhysics();
  return r;
};
uiOn('physBtn','click',()=>{
  if(PHYS.on){ PHYS_AUTO=false; PHYS.disable(); } else { PHYS_AUTO=true; PHYS.enable(); }
});
window.addEventListener('rapier-ready',()=>PHYS.init());
window.addEventListener('rapier-fail',()=>{
  uiText('physEngine',PIBO_T('실패'));
  uiSet('physBtn','title',PIBO_T('Rapier 로드 실패 — 콘솔(F12) 확인'));
});
