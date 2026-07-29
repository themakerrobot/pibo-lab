// ═══════════════════════════════════════════════════════════
// 꾸미기 저장 — 파트 색·눈 색·LCD 를 localStorage 에 보관해
// 체험툴에서 꾸민 모습이 개발툴·게임툴에도 그대로 적용되게 한다.
// ═══════════════════════════════════════════════════════════
// 세 페이지 모두 viewer.js / pibo_api.js 다음에 이 파일을 로드한다.
// 기존 파일은 수정하지 않고 함수를 감싸기(wrap)만 한다.

(function () {
  const KEY = 'pibo-style-v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save(patch) {
    try {
      const st = Object.assign(load(), patch);
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch (e) {}
  }

  // ── 저장 훅: 색을 바꾸는 함수들을 감싼다 ──
  if (typeof setPartColor === 'function') {
    const _orig = setPartColor;
    setPartColor = function (key, colour) {
      _orig(key, colour);
      const st = load(); st.parts = st.parts || {};
      st.parts[key] = colour; save({ parts: st.parts });
    };
  }
  if (typeof setGlassColor === 'function') {
    const _orig = setGlassColor;
    setGlassColor = function (left, right) {
      _orig(left, right);
      save({ eyeL: left, eyeR: right === undefined ? left : right });
    };
  }
  const lcdIn = document.getElementById('lcdText');
  const lcdCol = document.getElementById('lcdColor');
  if (lcdIn) lcdIn.addEventListener('input', () => save({ lcd: lcdIn.value }));
  if (lcdCol) lcdCol.addEventListener('input', () => save({ lcdColor: lcdCol.value }));

  // 색상 되돌리기 = 저장분도 삭제
  const rst = document.getElementById('partResetBtn');
  if (rst) rst.addEventListener('click', () => save({ parts: {} }));

  // ── 복원: 로봇 로드가 끝나면 한 번 적용 ──
  let applied = false;
  function apply() {
    if (applied) return;
    if (typeof robotRoot === 'undefined' || !robotRoot) return;
    if (typeof allMeshes === 'undefined' || !allMeshes.length) return;
    applied = true;
    const st = load();

    if (st.parts && typeof setPartColor === 'function') {
      for (const k in st.parts) {
        setPartColor(k, st.parts[k]);
        // 체험툴이면 색상 패널의 입력값도 맞춘다
        const inp = document.querySelector('#partColors input[data-key="' + k + '"]');
        if (inp) inp.value = st.parts[k];
      }
    }
    if (st.eyeL && typeof setGlassColor === 'function') {
      setGlassColor(st.eyeL, st.eyeR || st.eyeL);
      const gl = document.getElementById('glassColorL'), gr = document.getElementById('glassColorR');
      if (gl) gl.value = st.eyeL;
      if (gr) gr.value = st.eyeR || st.eyeL;
    }
    if (st.lcdColor) {
      if (typeof lcdTextColor !== 'undefined') lcdTextColor = st.lcdColor;
      if (lcdCol) lcdCol.value = st.lcdColor;
    }
    if (st.lcd !== undefined && typeof Pibo !== 'undefined') {
      Pibo.lcdText(st.lcd);
    }
  }
  // 로드 완료 시점을 특정하기 어려우니 짧게 폴링 (적용되면 멈춤)
  const t = setInterval(() => { apply(); if (applied) clearInterval(t); }, 300);
  setTimeout(() => clearInterval(t), 30000);   // 30초 안에 로드 안 되면 포기
})();

// ═══════════════════════════════════════════════════════════
// 카메라 시점 기억 — 새로고침해도 마지막 확대/축소·각도를 유지
// ═══════════════════════════════════════════════════════════
// 페이지마다 화면 비율이 달라서 키를 페이지별로 나눈다.
(function () {
  const PAGE = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
  const KEY = 'pibo-view-v1:' + PAGE;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
  }
  function snap() {
    if (typeof orbit === 'undefined' || !orbit) return null;
    return { r: orbit.r, phi: orbit.phi, theta: orbit.theta,
             tx: orbit.target.x, ty: orbit.target.y, tz: orbit.target.z };
  }
  const sig = v => v ? [v.r, v.phi, v.theta, v.tx, v.ty, v.tz].map(n => n.toFixed(4)).join(',') : '';

  let restored = false, last = '';

  // 로봇 로드 후 viewer 가 화면 맞추기를 한 번 하므로, 그 뒤에 복원한다
  function tryRestore() {
    if (restored) return;
    if (typeof orbit === 'undefined' || !orbit) return;
    if (typeof robotRoot === 'undefined' || !robotRoot) return;
    if (typeof allMeshes === 'undefined' || !allMeshes.length) return;
    restored = true;
    setTimeout(() => {
      const v = read();
      if (v && isFinite(v.r)) {
        orbit.r = Math.max(0.15, Math.min(60, v.r));
        orbit.phi = v.phi; orbit.theta = v.theta;
        orbit.target.set(v.tx, v.ty, v.tz);
        orbit.update();
      }
      last = sig(snap());
    }, 500);
  }
  const t1 = setInterval(() => { tryRestore(); if (restored) clearInterval(t1); }, 250);
  setTimeout(() => clearInterval(t1), 30000);

  // 바뀌면 저장 (휠·드래그·버튼·화면맞추기 전부 여기서 잡힌다)
  setInterval(() => {
    if (!restored) return;
    const v = snap();
    if (!v) return;
    const s2 = sig(v);
    if (s2 === last) return;
    last = s2;
    write(v);
  }, 600);
})();

// ═══════════════════════════════════════════════════════════
// 안개 시작 거리 — 지금 보고 있는 거리에서 축소 5번 눌러야 뿌옇게
// ═══════════════════════════════════════════════════════════
// 테마의 fog near/far 는 고정값(예: 1.2 ~ 3.6)이라, 카메라가 조금만
// 물러나도 바로 안개에 들어간다. 현재 시점 거리를 기준으로 다시 잡는다.
(function () {
  const FOG_STEPS = 5;        // 축소 몇 번 만에 안개가 시작될지
  const ZOOM_STEP = 1.22;     // 축소 버튼 1회 배율 (dev/index 의 zoomBy 와 동일)

  function adjustFog() {
    if (typeof scene === 'undefined' || !scene || !scene.fog) return;
    if (typeof orbit === 'undefined' || !orbit || !isFinite(orbit.r)) return;
    const ratio = (scene.fog.far / scene.fog.near) || 3;   // 테마가 정한 안개 두께 비율은 유지
    const near = orbit.r * Math.pow(ZOOM_STEP, FOG_STEPS);
    scene.fog.near = near;
    scene.fog.far = near * ratio;
  }
  window.piboAdjustFog = adjustFog;

  // 테마를 바꾸면 안개가 테마 기본값으로 되돌아가므로 다시 잡아준다
  if (typeof setTheme === 'function') {
    const _orig = setTheme;
    setTheme = function (k) { _orig(k); adjustFog(); };
  }

  // 로봇 로드 + 시점 복원이 끝난 뒤 한 번
  const t = setInterval(() => {
    if (typeof orbit === 'undefined' || !orbit) return;
    if (typeof robotRoot === 'undefined' || !robotRoot) return;
    if (typeof allMeshes === 'undefined' || !allMeshes.length) return;
    clearInterval(t);
    setTimeout(adjustFog, 700);      // 시점 복원(500ms) 뒤에
  }, 250);
  setTimeout(() => clearInterval(t), 30000);
})();
