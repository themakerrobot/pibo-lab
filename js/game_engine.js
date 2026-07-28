// ═══════════════════════════════════════════════════════════
// GAME ENGINE — 테이블 위에서 PIBO 를 움직이는 게임
// ═══════════════════════════════════════════════════════════
// 기존 시뮬 모듈(viewer / physics / backdrop / pibo_api)은 그대로 두고
// 그 위에 '게임 규칙'만 얹는다. 어떤 기존 파일도 수정하지 않는다.
//
// 좌표: 상판 위 월드 좌표(m). PIBO 정면은 월드 +Z (URDF -Y).
// 이동은 물리로 걷게 하지 않고 로봇 전체를 직접 옮긴다.
//  · 걸음 모션은 보여주되 위치는 코드가 결정 → 블록으로 만든 게임이 예측 가능해진다
//  · 물리 ON 상태로 두면 넘어짐이 그대로 게임 요소가 된다

const Game = {
  running: false,
  score: 0,
  lives: 3,
  items: [],          // {mesh, x, z, kind, taken}
  goal: null,
  walls: [],
  handlers: {},       // 이벤트 → 콜백 (블록이 등록)
  speed: 0.12,        // m/s
  turnSpeed: 120,     // deg/s
  heading: 0,         // 바라보는 방향(도). 0 = 월드 +Z
  startPos: { x: 0, z: 0 },
  _group: null,
  _lastFall: false,

  // ── 무대 ──
  stage(){
    const s = (typeof STAGE !== 'undefined' && STAGE) ? STAGE : null;
    return s || { w: 1.6, d: 0.8, cz: 0, clearX: 0.46 };
  },

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

  moveRobotTo(x, z){
    if(!robotRoot) return;
    robotRoot.position.x = x;
    robotRoot.position.z = z;
    // 물리가 켜져 있으면 강체도 같이 옮겨야 다음 프레임에 되돌아가지 않는다
    if(typeof PHYS !== 'undefined' && PHYS.on && PHYS.bodies){
      const base = PHYS.bodies['base_link'];
      if(base){
        const t = base.rb.translation();
        const dx = x - t.x, dz = z - t.z;
        for(const k in PHYS.bodies){
          const rb = PHYS.bodies[k].rb, p = rb.translation();
          rb.setTranslation({ x: p.x + dx, y: p.y, z: p.z + dz }, true);
          rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
    }
  },

  setHeading(deg){
    this.heading = ((deg % 360) + 360) % 360;
    if(robotRoot){
      // 로봇 기본 자세(Z-up URDF → Y-up 씬)에 heading 회전을 얹는다
      robotRoot.rotation.y = this.heading * Math.PI / 180;
    }
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

  addWall(x, z, w, d){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d),
      new THREE.MeshPhongMaterial({ color: 0x9A6B4F }));
    m.position.set(x, 0.03, z);
    m.castShadow = true; m.receiveShadow = true;
    this.group().add(m);
    this.walls.push({ mesh: m, x, z, w, d });
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

// 렌더 루프에 얹는다 (기존 renderLoop 를 감싸지 않고 별도 타이머로)
setInterval(() => Game.tick(), 50);
