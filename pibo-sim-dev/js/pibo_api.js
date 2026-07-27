// ═══════════════════════════════════════════════════════════
// PIBO API — 체험툴과 개발툴이 공유하는 로봇 제어 진입점
// ═══════════════════════════════════════════════════════════
// 실물 openpibo 와 이름을 맞춰둠. Blockly 제너레이터는 이 함수들만 호출한다.
const Pibo = {
  // 모터 1개 (no: 0~9, deg: 도)
  setMotor(no, deg){
    const m = PIBO_MAP[no]; if(!m) return;
    const v = m.s * Number(deg || 0);
    if(sliderEls[m.j]) sliderEls[m.j].value = v;
    if(valEls[m.j])    valEls[m.j].value = Math.round(v);
    setJointValue(m.j, v);
  },

  // 모터 10개를 ms 밀리초에 걸쳐 이동
  setMotors(list, ms){
    const target = (typeof list === 'string' ? list.split(',') : list).map(Number);
    const from = PIBO_MAP.map(m => parseFloat(sliderEls[m.j] ? sliderEls[m.j].value : 0) || 0);
    const dur = Math.max(1, Number(ms) || 0);
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => {
        const a = Math.min(1, (now - t0) / dur);
        const e = a*a*(3-2*a);
        target.forEach((d, i) => { if(d !== 999) Pibo.setMotor(i, from[i] + (d - from[i]) * e); });
        a < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
  },

  // 기본 자세
  initMotion(){ return Pibo.setMotors(PIBO_DEFAULT_INIT, 800); },

  // motions/<name>.json 을 불러와 cycle 회 재생
  async playMotion(name, cycle){
    const kfs = await loadMotionByName(name);
    if(!kfs) { console.warn('모션 없음:', name); return; }
    for(let i = 0; i < Math.max(1, Number(cycle) || 1); i++) await playKeyframes(kfs);
  },

  // 눈 색 — 실물 device.eye_on_s([left, right]) 와 같은 순서. URDF 기준 +X = 로봇 왼쪽.
  setEye(left, right){
    if(typeof setGlassColor === 'function') setGlassColor(left, right === undefined ? left : right);
  },

  // 실물 device.eye_on(r,g,b, r,g,b) — 앞 3개가 왼쪽, 뒤 3개가 오른쪽
  setEyeRGB(r1, g1, b1, r2, g2, b2){
    const hx = n => Math.max(0, Math.min(255, Math.round(Number(n) || 0))).toString(16).padStart(2, '0');
    Pibo.setEye('#' + hx(r1) + hx(g1) + hx(b1), '#' + hx(r2) + hx(g2) + hx(b2));
  },

  // 몸통 LCD 글자
  lcdText(text){
    const el = document.getElementById('lcdText');
    if(el){ el.value = text; el.dispatchEvent(new Event('input')); }
    else if(typeof lcdDraw === 'function') lcdDraw(String(text));
  },

  // 물리 on/off · 리셋
  physics(on){ if(typeof PHYS === 'undefined') return; on ? PHYS.enable() : PHYS.disable(); },
  reset(){ if(typeof PHYS !== 'undefined' && PHYS.on) PHYS.reset(); },

  sleep(sec){ return new Promise(r => setTimeout(r, Number(sec) * 1000)); },
};

// motions/ 폴더에서 모션 파일을 읽어 키프레임으로 변환 (실물 포맷)
const _motionCache = {};
async function loadMotionByName(name){
  if(_motionCache[name]) return _motionCache[name];
  let raw;
  try{
    const r = await fetch('motions/' + name + '.json');
    if(!r.ok) return null;
    raw = await r.json();
  }catch(e){ return null; }
  const m = raw[Object.keys(raw)[0]] || {};
  const init = m.init || new Array(10).fill(0);
  let last = init.slice();
  const kfs = [{ t: 0, d: init.slice() }];
  for(const fr of (m.pos || [])){
    const d = (fr.d || []).map((v, i) => v === 999 ? last[i] : v);
    last = d.slice();
    kfs.push({ t: (fr.seq || 0) / 1000, d });
  }
  return (_motionCache[name] = kfs);
}

// 키프레임을 실시간으로 재생 (물리 ON 이면 모터 목표각이 되어 물리가 결과를 결정)
function playKeyframes(kfs){
  const dur = kfs[kfs.length - 1].t;
  return new Promise(res => {
    const t0 = performance.now();
    const step = now => {
      const t = (now - t0) / 1000;
      const pose = poseAtTime(kfs, Math.min(t, dur));
      pose.forEach((d, i) => Pibo.setMotor(i, d));
      t < dur ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
}

// 뷰어 타임라인과 동일한 smoothstep 보간
function poseAtTime(kfs, t){
  if(t <= kfs[0].t) return kfs[0].d;
  if(t >= kfs[kfs.length - 1].t) return kfs[kfs.length - 1].d;
  let a = kfs[0], b = kfs[1];
  for(let i = 0; i < kfs.length - 1; i++)
    if(kfs[i].t <= t && kfs[i + 1].t >= t){ a = kfs[i]; b = kfs[i + 1]; break; }
  const al = (b.t === a.t) ? 1 : (t - a.t) / (b.t - a.t);
  const e = al * al * (3 - 2 * al);
  return a.d.map((v, i) => v + (b.d[i] - v) * e);
}
