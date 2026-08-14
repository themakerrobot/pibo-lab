// ═══════════════════════════════════════════════════════════
// CAMERA — 웹캠을 실물 파이보 카메라 자리에 끼워 넣는다
// ═══════════════════════════════════════════════════════════
// 실물 openpibo 의 camera.read() 는 numpy 배열을 돌려주지만,
// 시뮬은 JS-Interpreter 안에서 돌기 때문에 캔버스 객체를 그대로 넘길 수 없다.
// 그래서 이미지는 'img#1' 같은 문자열 핸들로만 오가고,
// 실제 픽셀은 아래 store 에 남는다. 블록 JSON 에는 흔적이 없으므로
// 실물로 옮겨도 그대로 동작한다.
//
// 실물과 맞춘 것
//   · vision_read          → camera.read()
//   · vision_imshow_to_ide → camera.imshow_to_ide()
//   · vision_imshow_to_oled→ oled.imshow()
//   · vision_rectangle/circle/line/text → camera.draw_*()
//   · device_get_touch     → device.get_touch()  ('touch' 또는 빈 문자열)

const PiboCam = (function () {
  const W = 640, H = 480;          // 실물 파이보 카메라 해상도
  const store = new Map();
  let seq = 0;

  let stream = null, video = null, ready = false;
  let panel = null, view = null, viewG = null, sel = null, btn = null, src = null;
  // 카메라 소스 — 'webcam' 또는 'pibo'(3D 시야)
  let source = 'webcam';
  try { source = localStorage.getItem('piboLab.camSource') || 'webcam'; } catch (e) { /* 무시 */ }
  let shown = false;   // IDE 화면에 이미지가 떠 있는 상태인지

  // ── 이미지 핸들 ──
  function make(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w || W; cv.height = h || H;
    const id = 'img#' + (++seq);
    store.set(id, cv);
    // 오래된 핸들은 정리 (한 번 실행에 수백 장이 쌓일 수 있다)
    if (store.size > 40) store.delete(store.keys().next().value);
    return id;
  }
  function get(id) { return store.get(String(id)) || null; }

  // ── 뷰어 패널 ──
  function mount() {
    if (panel) return;
    const p = PiboPanels.make('cam', PIBO_T('카메라'));
    if (!p) return;
    panel = p.box;
    panel.id = 'camPanel';

    view = document.createElement('canvas');
    view.width = W; view.height = H;
    view.style.cssText = 'display:block;width:192px;height:144px;border-radius:5px;background:#0C1114';
    viewG = view.getContext('2d');

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:5px;margin-top:5px;width:192px';

    // 소스 선택 — 웹캠 / 파이보 시야.
    // 학습(분류툴)과 추론(개발툴)이 같은 소스여야 하므로 눈에 띄게 위에 둔다.
    src = document.createElement('select');
    src.style.cssText = 'width:192px;margin-top:5px;border:1px solid var(--line,#DDE6EA);' +
      'background:var(--panel2,#F2F7F9);border-radius:5px;font-family:inherit;font-size:10px;' +
      'padding:3px 4px;color:var(--ink,#12232B);cursor:pointer';
    [['webcam', PIBO_T('웹캠')], ['pibo', PIBO_T('파이보 시야')]].forEach(function (p) {
      const o = document.createElement('option');
      o.value = p[0]; o.textContent = PIBO_T('소스') + ': ' + p[1];
      src.appendChild(o);
    });
    src.value = source;
    src.addEventListener('change', function () {
      source = src.value;
      try { localStorage.setItem('piboLab.camSource', source); } catch (e) { /* 무시 */ }
      if (source === 'pibo' && ready) stop();
      applySource();
    });

    btn = document.createElement('button');
    btn.style.cssText = 'flex-shrink:0;border:1px solid var(--line,#DDE6EA);background:var(--panel2,#F2F7F9);' +
      'border-radius:5px;font-family:inherit;font-size:10px;font-weight:600;padding:3px 8px;cursor:pointer;' +
      'color:var(--ink,#12232B)';
    btn.addEventListener('click', () => (ready ? stop() : start()));

    sel = document.createElement('select');
    sel.style.cssText = 'flex:1;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;' +
      'white-space:nowrap;border:1px solid var(--line,#DDE6EA);background:var(--panel2,#F2F7F9);' +
      'border-radius:5px;font-family:inherit;font-size:10px;padding:3px 4px;color:var(--ink,#12232B);cursor:pointer';
    sel.addEventListener('change', () => { setSelTitle(); if (ready) { stop(); start(); } });

    row.appendChild(btn); row.appendChild(sel);
    p.body.appendChild(view); p.body.appendChild(src); p.body.appendChild(row);

    setBtn();
    setSelTitle();
    applySource();
    placeholder();
  }

  // 파이보 시야일 때는 웹캠 조작 UI 가 필요 없다
  function applySource() {
    if (!panel) return;
    const web = (source === 'webcam');
    btn.style.display = web ? '' : 'none';
    sel.style.display = web ? '' : 'none';
    if (!shown) placeholder();
  }

  function setSelTitle() {
    if (!sel) return;
    const o = sel.selectedOptions && sel.selectedOptions[0];
    sel.title = (o && o.title) || PIBO_T('카메라 선택');
  }

  function setBtn() {
    if (!btn) return;
    btn.textContent = ready ? PIBO_T('끄기') : PIBO_T('켜기');
  }

  function placeholder() {
    if (!viewG) return;
    shown = false;
    viewG.fillStyle = '#0C1114';
    viewG.fillRect(0, 0, W, H);
    viewG.fillStyle = '#56646C';
    viewG.font = 'bold 30px sans-serif';
    viewG.textAlign = 'center'; viewG.textBaseline = 'middle';
    viewG.fillText(source === 'pibo' ? PIBO_T('파이보 시야')
      : (ready ? PIBO_T('사진 대기 중') : PIBO_T('카메라 꺼짐')), W / 2, H / 2);
    viewG.textAlign = 'left'; viewG.textBaseline = 'alphabetic';
  }

  // 연결된 웹캠 목록을 채운다 (권한 허용 전에는 이름이 비어 있을 수 있다)
  async function listCams() {
    if (!sel || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devs = (await navigator.mediaDevices.enumerateDevices())
        .filter(d => d.kind === 'videoinput');
      const cur = sel.value;
      sel.innerHTML = '';
      devs.forEach((d, i) => {
        const o = document.createElement('option');
        o.value = d.deviceId;
        // 장치명이 길어 패널 폭을 넘기므로 줄여서 표시하고, 전체 이름은 툴팁으로 남긴다
        //   'HD Pro Webcam C920 (046d:082d)' → 'HD Pro Webcam…'
        const full = d.label || (PIBO_T('카메라') + ' ' + (i + 1));
        const cut = full.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim();
        o.textContent = cut.length > 14 ? cut.slice(0, 13) + '…' : cut;
        o.title = full;
        sel.appendChild(o);
      });
      if (cur && devs.some(d => d.deviceId === cur)) sel.value = cur;
      setSelTitle();
    } catch (e) { /* 무시 */ }
  }

  async function start() {
    mount();
    if (ready) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      log(PIBO_T('이 브라우저에서는 카메라를 쓸 수 없습니다'), 'err');
      return false;
    }
    try {
      const want = { width: { ideal: W }, height: { ideal: H } };
      if (sel && sel.value) want.deviceId = { exact: sel.value };
      stream = await navigator.mediaDevices.getUserMedia({ video: want, audio: false });

      if (!video) {
        video = document.createElement('video');
        video.playsInline = true; video.muted = true;
      }
      video.srcObject = stream;
      await video.play();
      ready = true;
      setBtn();
      await listCams();
      if (!shown) placeholder();
      log(PIBO_T('카메라를 켰습니다'));
      return true;
    } catch (e) {
      // 권한 거부 / 다른 앱이 점유 / HTTPS 아님
      log(PIBO_T('카메라를 열지 못했습니다') + ': ' + (e && e.name ? e.name : e), 'err');
      placeholder();
      return false;
    }
  }

  function stop() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video) video.srcObject = null;
    ready = false;
    setBtn();
    placeholder();
  }

  // 라이브 미리보기는 두지 않는다.
  // 실물 파이보도 IDE 화면에는 imshow_to_ide 를 부른 순간에만 그림이 뜬다.
  // 웹캠 스트림은 켜둔 채 두고(다시 켜는 데 시간이 걸린다) 화면에는 그리지 않는다.

  function log(msg, kind) {
    if (typeof devLog === 'function') devLog(msg, kind);
    else console.log(msg);
  }

  // ── 실물 블록에 대응하는 동작 ──
  async function read() {
    if (source === 'pibo') {
      const shot = PiboView.grab();
      const id = make();
      if (shot) get(id).getContext('2d').drawImage(shot, 0, 0, W, H);
      else log(PIBO_T('파이보 시야를 만들지 못했습니다'), 'err');
      return id;
    }
    if (!ready && !(await start())) return make();   // 실패해도 빈 이미지를 준다 (프로그램은 계속)
    const id = make();
    const cv = get(id);
    if (video && video.videoWidth) cv.getContext('2d').drawImage(video, 0, 0, W, H);
    return id;
  }

  function show(id) {
    mount();
    const cv = get(id);
    if (!cv || !viewG) return;
    viewG.fillStyle = '#0C1114'; viewG.fillRect(0, 0, W, H);
    const s = Math.min(W / cv.width, H / cv.height);
    const w = cv.width * s, h = cv.height * s;
    viewG.drawImage(cv, (W - w) / 2, (H - h) / 2, w, h);
    shown = true;
  }

  function ctx(id) { const cv = get(id); return cv ? cv.getContext('2d') : null; }
  const px = n => Math.max(1, Number(n) || 1);

  function rectangle(id, x1, y1, x2, y2, color, tickness) {
    const c = ctx(id); if (!c) return;
    const x = Math.min(+x1, +x2), y = Math.min(+y1, +y2);
    const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    if (Number(tickness) < 0) { c.fillStyle = color; c.fillRect(x, y, w, h); }
    else { c.strokeStyle = color; c.lineWidth = px(tickness); c.strokeRect(x, y, w, h); }
  }
  function circle(id, x, y, r, color, tickness) {
    const c = ctx(id); if (!c) return;
    c.beginPath(); c.arc(+x, +y, Math.abs(+r), 0, Math.PI * 2);
    if (Number(tickness) < 0) { c.fillStyle = color; c.fill(); }
    else { c.strokeStyle = color; c.lineWidth = px(tickness); c.stroke(); }
  }
  function line(id, x1, y1, x2, y2, color, tickness) {
    const c = ctx(id); if (!c) return;
    c.strokeStyle = color; c.lineWidth = px(tickness);
    c.beginPath(); c.moveTo(+x1, +y1); c.lineTo(+x2, +y2); c.stroke();
  }
  function text(id, str, x, y, size, color) {
    const c = ctx(id); if (!c) return;
    c.fillStyle = color;
    c.font = 'bold ' + Math.max(6, Number(size) || 20) + 'px sans-serif';
    c.textBaseline = 'top';
    c.fillText(String(str), Number(x) || 0, Number(y) || 0);
  }
  function toOled(id) {
    const cv = get(id);
    if (cv && typeof Oled !== 'undefined' && Oled.image) Oled.image(cv);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('devConsole')) return;   // 개발툴에서만
    mount();
    listCams();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', listCams);
    }
  });

  return {
    start, stop, read, show, get, rectangle, circle, line, text, toOled, mount,
    source: function (v) {
      if (v == null) return source;
      source = (v === 'pibo') ? 'pibo' : 'webcam';
      try { localStorage.setItem('piboLab.camSource', source); } catch (e) { /* 무시 */ }
      if (src) src.value = source;
      applySource();
      return source;
    },
  };
})();


// ═══════════════════════════════════════════════════════════
// PIBO VIEW — 로봇 머리에 붙인 3D 카메라
// ═══════════════════════════════════════════════════════════
// 웹캠 대신 이 시야를 vision_read 의 소스로 쓸 수 있다.
// 실물이 없는 학생이 3D 무대(공장 라인) 위 물건을 판정할 수 있게 하는 장치다.
//
// 주의: 학습과 추론의 소스가 같아야 한다.
// 웹캠 사진으로 학습한 모델에 3D 렌더를 넣으면 엉뚱한 답이 나온다.
const PiboView = (function () {
  const W = 640, H = 480;
  let cam = null, target = null, out = null, outG = null, host = null, calibrated = false;
  const _p = new THREE.Vector3();

  // 머리 링크의 로컬 축은 URDF 규약대로 z 가 위쪽이고, 앞쪽이 -y 다.
  //   -y → 월드 앞(+z),  +z → 월드 위
  // 예전에는 "지금 자세를 정면으로 친다"고 한 번 측정해 굳혔는데,
  // 측정 순간 머리가 기울어 있으면 그 각도가 정면으로 박혀 계속 어긋났다.
  // 축을 고정으로 두면 자세와 무관하게 항상 맞고, 고개를 숙이면 시야도 그대로 따라 내려간다.
  const EYE = new THREE.Vector3(0, -0.024, 0.012);   // 머리 중심 기준 눈 위치 (앞으로, 위로)
  function faceForward() {
    if (!cam) return;
    // 카메라는 -z 로 보고 +y 가 위다. 그에 맞는 축을 직접 세운다.
    const x = new THREE.Vector3(-1, 0, 0);   // 카메라 오른쪽
    const y = new THREE.Vector3(0, 0, 1);    // 카메라 위   = 링크 +z
    const z = new THREE.Vector3(0, 1, 0);    // 카메라 뒤   = 링크 +y (앞은 -y)
    cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    cam.position.copy(EYE);
    cam.updateMatrixWorld(true);
  }

  function ready() {
    if (typeof renderer === 'undefined' || typeof scene === 'undefined') return false;
    if (typeof robotRoot === 'undefined' || !robotRoot) return false;

    if (!cam) cam = new THREE.PerspectiveCamera(62, W / H, 0.005, 60);   // 실물 파이보와 비슷한 화각

    if (!host || !host.parent) {
      host = null; calibrated = false;
      // 틸트 관절 아래에 붙어야 고개를 숙일 때 시야도 같이 내려간다.
      // 관절 오브젝트를 먼저 보고, 없으면 링크 이름으로 찾는다.
      if (typeof jointObjs !== 'undefined') {
        host = jointObjs['head_tilt_joint'] || jointObjs['head_pan_joint'] || null;
      }
      if (!host) {
        const want = ['head_link', 'head_tilt_link', 'head'];
        for (let i = 0; i < want.length && !host; i++) {
          robotRoot.traverse(function (o) { if (!host && o.name === want[i]) host = o; });
        }
      }
      if (!host) robotRoot.traverse(function (o) { if (!host && o.name && /head/i.test(o.name)) host = o; });
      if (!host) return false;
      host.add(cam);
    }
    if (!calibrated) { faceForward(); calibrated = true; }

    if (!target) {
      target = new THREE.WebGLRenderTarget(W, H);
      out = document.createElement('canvas');
      out.width = W; out.height = H;
      outG = out.getContext('2d');
    }
    return true;
  }

  // 현재 시야를 캔버스로 뽑는다 (vision_read 가 부른다)
  function grab() {
    if (!ready()) return null;

    // 카메라가 머리 안쪽에 있어 자기 머리 껍데기가 화면을 가린다.
    // 실물도 자기 얼굴은 안 보이므로 찍는 순간만 로봇을 숨긴다.
    const wasVisible = robotRoot.visible;
    robotRoot.visible = false;

    const prevT = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevT);

    robotRoot.visible = wasVisible;

    const buf = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(target, 0, 0, W, H, buf);

    // WebGL 은 아래에서 위로 읽으므로 뒤집어 담는다
    const im = outG.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W * 4, dst = y * W * 4;
      im.data.set(buf.subarray(src, src + W * 4), dst);
    }
    outG.putImageData(im, 0, 0);
    return out;
  }

  // 로봇 초기화(똑바로 선 자세)는 방향을 다시 맞추기 가장 좋은 시점이다.
  // 초기화가 끝난 뒤에 읽어야 하므로 한 박자 늦춘다.
  document.addEventListener('DOMContentLoaded', function () {
    const b = document.getElementById('btnReset');
    if (b) b.addEventListener('click', function () {
      setTimeout(function () { calibrated = false; ready(); }, 300);
    });
  });

  return {
    grab: grab,
    available: function () { return ready(); },
    // 방향이 틀어졌을 때 콘솔에서 PiboView.calibrate()
    calibrate: function () { calibrated = false; ready(); },
    // 머리를 움직여도 시야가 안 바뀔 때: 기울이기 전후로 불러 값이 변하는지 본다
    diag: function () {
      if (typeof robotRoot === 'undefined' || !robotRoot) return '로봇 없음';
      const rows = [];
      const push = function (tag, o) {
        if (!o) { rows.push([tag, '(없음)', '', '']); return; }
        const p = new THREE.Vector3(), q = new THREE.Quaternion();
        o.getWorldPosition(p); o.getWorldQuaternion(q);
        rows.push([tag, o.name || '(이름없음)',
          p.toArray().map(function (n) { return n.toFixed(4); }).join(', '),
          q.toArray().map(function (n) { return n.toFixed(3); }).join(', ')]);
      };
      push('붙어있는 곳', host);
      if (typeof jointObjs !== 'undefined') {
        push('head_pan_joint', jointObjs['head_pan_joint']);
        push('head_tilt_joint', jointObjs['head_tilt_joint']);
      }
      const named = {};
      robotRoot.traverse(function (o) {
        if (o.name && /head/i.test(o.name) && !named[o.name]) { named[o.name] = o; }
      });
      Object.keys(named).forEach(function (n) { push('이름:' + n, named[n]); });
      console.table(rows.map(function (r) {
        return { 대상: r[0], 이름: r[1], 위치: r[2], 회전: r[3] };
      }));
      return rows.length + '개';
    },
  };
})();


// ═══════════════════════════════════════════════════════════
// CLASSIFIER — vision_load_cf / vision_predict_cf
// ═══════════════════════════════════════════════════════════
// 분류툴(classify.html)에서 저장한 모델을 이름으로 찾아 쓴다.
// 실물은 cf.load('/home/pi/mymodel/' + 'my.h5', ...) 처럼 경로를 받지만,
// 웹에는 그 경로가 없으므로 파일명 부분만 이름으로 본다.
// 블록 JSON 은 그대로라 실물로 옮겨도 동작한다.
//
// TF.js 는 1MB가 넘어 개발툴 시작이 느려지므로, 이 블록을 처음 쓸 때만 불러온다.
const PiboCf = (function () {
  let model = null, labels = [], base = null, tfReady = null;

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error(src));
      document.head.appendChild(s);
    });
  }

  function ensureTf() {
    if (tfReady) return tfReady;
    tfReady = (typeof tf !== 'undefined' ? Promise.resolve() : loadScript('lib/tf.min.js?v=16'))
      .then(async () => {
        if (base) return;
        const full = await tf.loadLayersModel('models/mobilenet/model.json');
        base = tf.model({ inputs: full.inputs, outputs: full.getLayer('global_average_pooling2d_1').output });
        tf.tidy(() => base.predict(tf.zeros([1, 224, 224, 3])));
      });
    return tfReady;
  }

  // 경로에서 파일명만 (확장자 제거) — '/home/pi/mymodel/my.h5' → 'my'
  function keyOf(p) {
    const s = String(p == null ? '' : p).trim();
    const f = s.split(/[\\/]/).pop();
    return f.replace(/\.(h5|json|zip|txt|keras|tflite)$/i, '');
  }

  async function load(modelpath) {
    const name = keyOf(modelpath);
    if (!name) { log(PIBO_T('모델 이름이 비어 있습니다'), 'err'); return; }
    try {
      await ensureTf();
      const rec = await CfStore.load(name);
      if (!rec) {
        log(PIBO_T('저장된 모델이 없습니다') + ': ' + name + ' — ' + PIBO_T('분류툴에서 먼저 저장하세요'), 'err');
        return;
      }
      if (model) model.dispose();
      model = await tf.loadLayersModel(tf.io.fromMemory({
        modelTopology: rec.topology, weightSpecs: rec.specs, weightData: rec.weights,
      }));
      labels = rec.labels || [];
      log(PIBO_T('이미지 모델을 불러왔습니다') + ': ' + name);
    } catch (e) {
      log(PIBO_T('이미지 모델을 불러오지 못했습니다') + ': ' + e.message, 'err');
    }
  }

  // 실물 cf.predict(img)[0] 과 같이 라벨 문자열을 돌려준다
  async function predict(handle) {
    if (!model) { log(PIBO_T('이미지 모델을 먼저 설정하세요'), 'err'); return ''; }
    const cv = PiboCam.get(handle);
    if (!cv) return '';
    try {
      await ensureTf();
      const out = tf.tidy(() => {
        const x = tf.browser.fromPixels(cv)
          .resizeNearestNeighbor([224, 224]).toFloat().div(255).expandDims();
        return model.predict(base.predict(x).flatten().expandDims());
      });
      const p = await out.data();
      out.dispose();
      let top = 0;
      for (let i = 1; i < p.length; i++) if (p[i] > p[top]) top = i;
      return labels[top] || String(top);
    } catch (e) {
      log(PIBO_T('분류에 실패했습니다') + ': ' + e.message, 'err');
      return '';
    }
  }

  function log(msg, kind) {
    if (typeof devLog === 'function') devLog(msg, kind);
    else console.log(msg);
  }

  return { load, predict };
})();


// ═══════════════════════════════════════════════════════════
// TOUCH — 실물의 머리 터치 센서를 마우스 클릭으로 대신한다
// ═══════════════════════════════════════════════════════════
// device.get_touch() 는 누르고 있으면 'touch', 아니면 빈 문자열을 돌려준다.
// 시뮬도 같은 값을 돌려주어야 조건 블록의 비교가 어긋나지 않는다.
const PiboTouch = (function () {
  let held = false;
  // 콘솔에서 PiboTouch.debug(true) 로 켜면 클릭할 때마다 맞은 부위를 찍는다
  let DEBUG_TOUCH = false;


  // 클릭한 지점의 메시를 찾고, 그 메시의 조상을 거슬러 올라가며
  // 머리 계통(head_link / head.stl 등)에 속하는지 확인한다.
  // 특정 오브젝트 하나를 미리 골라두는 방식은 이름이 어긋나면 통째로 오작동해서,
  // 실제로 맞은 것이 무엇인지 보고 판정하는 쪽으로 바꿨다.
  function hitHead(ev) {
    if (typeof robotRoot === 'undefined' || !robotRoot) return false;
    const cv = document.getElementById('cv');
    if (!cv) return false;

    const r = cv.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObject(robotRoot, true)
      .filter(h => h.object && h.object.visible && h.object.isMesh);
    if (!hits.length) return false;

    // 맞은 메시부터 로봇 루트까지의 이름들
    const chain = [];
    for (let o = hits[0].object; o && o !== robotRoot.parent; o = o.parent) {
      if (o.name) chain.push(o.name);
    }
    const isHead = chain.some(n => /head/i.test(n));
    if (DEBUG_TOUCH) console.log('[touch]', isHead ? '머리' : '머리 아님', chain.join(' < '));
    return isHead;
  }

  function bind() {
    const cv = document.getElementById('cv');
    if (!cv) return;
    cv.addEventListener('pointerdown', ev => {
      if (hitHead(ev)) {
        held = true;
        cv.style.cursor = 'pointer';
      }
    });
    // 버튼에서 손을 떼면 해제 (뷰포트 밖에서 떼도 풀리도록 window 에 건다)
    window.addEventListener('pointerup', () => {
      if (held) { held = false; cv.style.cursor = ''; }
    });
  }

  document.addEventListener('DOMContentLoaded', bind);

  return {
    value() { return held ? 'touch' : ''; },
    debug(on) { DEBUG_TOUCH = (on !== false); },
  };
})();
