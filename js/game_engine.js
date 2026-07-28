// ═══════════════════════════════════════════════════════════
// GAME ENGINE — 테이블 위에서 PIBO 를 움직이는 게임
// ═══════════════════════════════════════════════════════════
// 기존 시뮬 모듈(viewer / physics / backdrop / pibo_api)은 그대로 두고
// 그 위에 '게임 규칙'만 얹는다. 어떤 기존 파일도 수정하지 않는다.
//
// 좌표: 상판 위 월드 좌표(m). PIBO 정면은 월드 +Z (URDF -Y).
//
// ★ 이동 방식 (v3) — 개발툴과 완전히 동일
//   걷기·돌기는 모션을 재생할 뿐, 로봇을 코드로 옮기지도 방향을 보정하지도
//   않는다. 발과 바닥의 마찰로 실제로 걸어간다 (실측: 한 걸음 약 49mm,
//   도는 모션 1회 약 33도). 실물처럼 걸음마다 방향이 조금씩 휘는데,
//   그건 플레이어가 돌기 블록으로 잡는 것이 게임이다.

const WALL_H       = 0.06;    // 벽 높이(m)

const Game = {
  running: false,
  score: 0,
  lives: 3,
  items: [],          // {mesh, x, z, kind, taken}
  goal: null,
  walls: [],
  handlers: {},       // 이벤트 → 콜백 (블록이 등록)
  turnSpeed: 120,     // deg/s (물리 꺼짐 fallback 에서만 사용)
  heading: 0,         // 바라보는 방향(도). 0 = 월드 +Z
  startPos: { x: 0, z: 0 },
  _group: null,
  _lastFall: false,

  // ── 무대 ──
  stage(){
    const s = (typeof STAGE !== 'undefined' && STAGE) ? STAGE : null;
    return s || { w: 1.6, d: 0.8, cz: 0, clearX: 0.46 };
  },

  physOn(){ return typeof PHYS !== 'undefined' && PHYS.on && PHYS.world && PHYS.bodies['base_link']; },

  group(){
    if(!this._group){
      this._group = new THREE.Group();
      this._group.name = 'gameObjects';
      scene.add(this._group);
    }
    return this._group;
  },

  // ── 초기화 ──
  reset(){
    this.stop();
    this.score = 0; this.lives = 3;
    this.heading = 0;
    this._lastFall = false;
    this.clearObjects();
    this.moveRobotTo(this.startPos.x, this.startPos.z);
    if(typeof PHYS !== 'undefined' && PHYS.on) PHYS.reset();
    this.updateHud();
  },

  clearObjects(){
    const g = this.group();
    while(g.children.length){
      const o = g.children.pop();
      if(o.geometry) o.geometry.dispose();
      if(o.material){
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => m.dispose());
      }
      g.remove(o);
    }
    this.items = []; this.goal = null; this.walls = [];
  },

  // ── 로봇 위치 ──
  robotXZ(){
    if(!robotRoot) return { x: 0, z: 0 };
    return { x: robotRoot.position.x, z: robotRoot.position.z };
  },

  // 순간이동 전용. 걸어서 가는 이동은 물리에 맡긴다.
  moveRobotTo(x, z){
    if(!robotRoot) return;
    robotRoot.position.x = x;
    robotRoot.position.z = z;
    if(this.physOn()){
      const t = PHYS.bodies['base_link'].rb.translation();
      const dx = x - t.x, dz = z - t.z;
      for(const k in PHYS.bodies){
        const rb = PHYS.bodies[k].rb, p = rb.translation();
        rb.setTranslation({ x: p.x + dx, y: p.y, z: p.z + dz }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  },

  // 물리 OFF 일 때만 의미 있는 명령값. ON 이면 방향은 물리가 결정한다.
  setHeading(deg){
    this.heading = ((deg % 360) + 360) % 360;
    if(robotRoot && !this.physOn()) robotRoot.rotation.y = this.heading * Math.PI / 180;
  },

  // 게임 로직이 쓰는 '지금 바라보는 방향'
  facing(){ return this.physOn() ? this.actualHeading() : this.heading; },

  // 로봇이 실제로 바라보는 방향(도) — 물리가 결정한 값
  actualHeading(){
    if(!this.physOn()) return this.heading;
    const r = PHYS.bodies['base_link'].rb.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const f = new THREE.Vector3(0, -1, 0).applyQuaternion(q);   // URDF -Y = 로봇 정면
    return Math.atan2(f.x, f.z) * 180 / Math.PI;
  },

  // ── 오브젝트 만들기 ──
  addItem(x, z, kind){
    const colours = { coin: 0xE8B33C, gem: 0x4FA8D8, heart: 0xD8556A, box: 0x8C6B48 };
    const c = colours[kind] || 0xE8B33C;
    let geo;
    if(kind === 'gem')       geo = new THREE.OctahedronGeometry(0.028);
    else if(kind === 'heart')geo = new THREE.SphereGeometry(0.028, 14, 10);
    else if(kind === 'box')  geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    else                     geo = new THREE.CylinderGeometry(0.03, 0.03, 0.010, 20);
    const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      color: c, emissive: c, emissiveIntensity: 0.35, shininess: 60 }));
    m.position.set(x, kind === 'coin' ? 0.006 : 0.03, z);
    if(kind === 'coin') m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    this.group().add(m);
    const it = { mesh: m, x, z, kind, taken: false };
    this.items.push(it);
    return it;
  },

  addGoal(x, z){
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 10, 30),
      new THREE.MeshPhongMaterial({ color: 0x4FBF6A, emissive: 0x2F8F4A, emissiveIntensity: 0.5 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 10),
      new THREE.MeshPhongMaterial({ color: 0xDDDDDD }));
    pole.position.y = 0.06;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03),
      new THREE.MeshPhongMaterial({ color: 0x4FBF6A, side: THREE.DoubleSide }));
    flag.position.set(0.025, 0.10, 0);
    g.add(ring); g.add(pole); g.add(flag);
    g.position.set(x, 0, z);
    this.group().add(g);
    this.goal = { obj: g, x, z };
    return this.goal;
  },

  // 벽 — 물리가 켜져 있으면 진짜로 부딪히는 벽이 된다
  addWall(x, z, w, d){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d),
      new THREE.MeshPhongMaterial({ color: 0x9A6B4F }));
    m.position.set(x, WALL_H / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    this.group().add(m);
    this.walls.push({ mesh: m, x, z, w, d });

    if(this.physOn() && window.RAPIER){
      const R = window.RAPIER;
      const rb = PHYS.world.createRigidBody(
        R.RigidBodyDesc.fixed().setTranslation(x, WALL_H / 2, z));
      const cd = R.ColliderDesc.cuboid(w / 2, WALL_H / 2, d / 2)
        .setFriction(0.8).setRestitution(0);
      cd.setCollisionGroups(0x00010002);          // 바닥과 같은 그룹
      PHYS.world.createCollider(cd, rb);
    }
  },

  // ── 판정 ──
  dist(a, b){ return Math.hypot(a.x - b.x, a.z - b.z); },

  onStage(p){
    const s = this.stage();
    return Math.abs(p.x) <= s.w / 2 && Math.abs(p.z - s.cz) <= s.d / 2;
  },

  hitWall(p){
    return this.walls.some(w =>
      Math.abs(p.x - w.x) < w.w / 2 + 0.05 && Math.abs(p.z - w.z) < w.d / 2 + 0.05);
  },

  fallen(){ return typeof PHYS !== 'undefined' && PHYS.on && PHYS.tilt > 45; },

  // ── 이벤트 ──
  on(evt, fn){ (this.handlers[evt] = this.handlers[evt] || []).push(fn); },
  fire(evt, arg){ (this.handlers[evt] || []).forEach(fn => { try { fn(arg); } catch(e){} }); },

  // ── 점수 / 목숨 ──
  addScore(n){ this.score += Number(n) || 0; this.updateHud(); },
  addLife(n){ this.lives = Math.max(0, this.lives + (Number(n) || 0)); this.updateHud(); },

  updateHud(){
    const s = document.getElementById('gScore'), l = document.getElementById('gLives');
    if(s) s.textContent = this.score;
    if(l) l.textContent = '♥'.repeat(Math.max(0, this.lives)) || '-';
  },

  say(msg){
    const el = document.getElementById('gMsg');
    if(!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => { el.style.display = 'none'; }, 1800);
  },

  // ── 매 프레임 판정 (블록 실행과 별개로 돈다) ──
  tick(){
    if(!this.running || !robotRoot) return;
    const p = this.robotXZ();

    this.items.forEach(it => {
      if(it.taken) return;
      it.mesh.rotation.y += 0.05;
      if(this.dist(p, it) < 0.07){
        it.taken = true;
        it.mesh.visible = false;
        this.fire('item', it.kind);
      }
    });

    if(this.goal && this.dist(p, this.goal) < 0.07) this.fire('goal');
    if(!this.onStage(p)) this.fire('fallOff');

    const f = this.fallen();
    if(f && !this._lastFall) this.fire('fall');
    this._lastFall = f;
  },

  start(){ this.running = true; },
  stop(){ this.running = false; },
};

// 아이템/골인 판정은 20Hz 면 충분하다
setInterval(() => Game.tick(), 50);
