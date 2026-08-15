// ═══════════════════════════════════════════════════════════
// 분류툴 — 브라우저에서 이미지 분류 모델을 만든다
// ═══════════════════════════════════════════════════════════
// 실물 파이보의 분류기(openpibo-os.pibo/classifier)와 같은 방식이다.
//   MobileNetV2 로 특징(1280차원)만 뽑고, 그 위에 작은 분류층만 학습한다.
//   → 샘플 수십 장, 학습 몇 초로 끝난다.
// 내보내는 zip 도 실물과 같은 구성이라 tfjs_to_keras.py 로 변환해 실물에 넣을 수 있다.
//
// 실물과 다른 점은 카메라뿐이다. 실물은 파이카메라, 여기는 웹캠.

(function () {
  'use strict';

  const IN_W = 224, IN_H = 224, FEAT = 1280;
  const MOBILENET_URL = 'models/mobilenet/model.json';
  const LAYER = 'global_average_pooling2d_1';

  let mobilenet = null;
  let model = null;
  let classes = [];            // [{ name, feats: [tensor], thumbs: [dataURL] }]
  let selected = -1;
  let stream = null, capturing = false, capTimer = null;
  let source = 'webcam';        // 'webcam' 또는 'pibo'(3D 파이보 뷰)
  let waitTimer = null;
  let inferring = false, inferTimer = null;
  let lastAcc = 0;

  const $ = id => document.getElementById(id);
  const T = s => (typeof PIBO_T === 'function' ? PIBO_T(s) : s);

  // ── 알림 ──
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }

  // ── 단계 표시 ──
  function steps() {
    const has = classes.length > 0;
    const shot = classes.some(c => c.feats.length > 0);
    const done = !!model;
    const st = [has, shot, done, done && inferring];
    [1, 2, 3, 4].forEach((n, i) => {
      const el = $('s' + n);
      el.classList.toggle('done', st[i]);
      // 아직 못 넘은 첫 단계를 현재 단계로 표시
      el.classList.toggle('on', !st[i] && (i === 0 || st[i - 1]));
    });
  }

  // ── MobileNet 준비 ──
  async function loadBase() {
    try {
      const full = await tf.loadLayersModel(MOBILENET_URL);
      mobilenet = tf.model({ inputs: full.inputs, outputs: full.getLayer(LAYER).output });
      tf.tidy(() => mobilenet.predict(tf.zeros([1, IN_H, IN_W, 3])));   // 첫 추론 미리 돌려 예열
      $('engine').textContent = T('준비 완료');
      progress(T('준비 완료'), '');
      refreshUI();
    } catch (e) {
      // 대부분 models/mobilenet/ 에 파일을 아직 안 넣은 경우다.
      // 토스트는 금방 사라지니 화면에 남는 안내를 띄운다.
      $('engine').textContent = T('모델 파일 없음');
      progress(T('모델 파일이 없습니다'), '', 0);
      const box = $('clsHint');
      box.style.display = '';
      box.innerHTML = '<b style="color:var(--warn,#E2574C)">' + T('모델 파일이 없습니다') + '</b><br>' +
        T('아래 5개 파일을 models/mobilenet/ 에 넣어 주세요') +
        '<br><code style="font-size:10.5px">model.json<br>mobilenetv2-1of4.bin … 4of4.bin</code>';
      console.error(e);
    }
  }

  function progress(label, pct, ratio) {
    $('prgLabel').textContent = label;
    $('prgPct').textContent = pct == null ? '' : pct;
    if (ratio != null) $('prgFill').style.width = Math.round(ratio * 100) + '%';
  }

  // ── 프레임 소스 ──
  // 학습과 추론이 같은 소스여야 한다. 웹캠 사진으로 배운 모델에 3D 렌더를 넣으면 엉뚱한 답이 나온다.
  function frame() {
    if (source === 'pibo') return (typeof PiboView !== 'undefined') ? PiboView.grab() : null;
    return (stream && $('camVid').videoWidth) ? $('camVid') : null;
  }
  function frameReady() { return !!frame(); }

  // ── 카메라 ──
  async function listCams() {
    const sel = $('camSel');
    try {
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      const cur = sel.value;
      sel.innerHTML = '';
      devs.forEach((d, i) => {
        const o = document.createElement('option');
        o.value = d.deviceId;
        const full = d.label || (T('카메라') + ' ' + (i + 1));
        const cut = full.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim();
        o.textContent = cut.length > 22 ? cut.slice(0, 21) + '…' : cut;
        o.title = full;
        sel.appendChild(o);
      });
      if (cur && devs.some(d => d.deviceId === cur)) sel.value = cur;
    } catch (e) { /* 무시 */ }
  }

  async function camOn() {
    if (stream) return true;
    try {
      const want = { width: { ideal: 640 }, height: { ideal: 480 } };
      if ($('camSel').value) want.deviceId = { exact: $('camSel').value };
      stream = await navigator.mediaDevices.getUserMedia({ video: want, audio: false });
      $('camVid').srcObject = stream;
      await $('camVid').play();
      $('camOff').style.display = 'none';
      $('camBtn').innerHTML = '<i class="fa-solid fa-video-slash"></i> ' + T('카메라 끄기');
      await listCams();
      refreshUI();
      return true;
    } catch (e) {
      toast(T('카메라를 열지 못했습니다'));
      return false;
    }
  }

  function stopCam() {
    stopInfer();
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    $('camVid').srcObject = null;
    $('camOff').style.display = '';
    $('camBtn').innerHTML = '<i class="fa-solid fa-video"></i> ' + T('카메라 켜기');
    refreshUI();
  }

  // ── 클래스 ──
  function addClass() {
    const name = $('clsName').value.trim();
    if (!name) return;
    if (classes.some(c => c.name === name)) { toast(T('같은 이름이 이미 있습니다')); return; }
    classes.push({ name: name, feats: [], thumbs: [] });
    $('clsName').value = '';
    selected = classes.length - 1;
    renderClasses(); refreshUI(); steps();
  }

  function delClass(i) {
    classes[i].feats.forEach(t => t.dispose());
    classes.splice(i, 1);
    if (selected >= classes.length) selected = classes.length - 1;
    // 클래스 구성이 바뀌면 기존 모델은 더 이상 맞지 않는다
    if (model) { model.dispose(); model = null; stopInfer(); $('bars').innerHTML = ''; }
    renderClasses(); refreshUI(); steps();
  }

  function renderClasses() {
    const box = $('clsList');
    box.innerHTML = '';
    classes.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'cls' + (i === selected ? ' on' : '');
      el.addEventListener('click', ev => {
        if (ev.target.closest('.del')) return;
        selected = i; renderClasses(); refreshUI();
      });

      const top = document.createElement('div');
      top.className = 'top';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = c.name;
      const ct = document.createElement('span'); ct.className = 'ct'; ct.textContent = c.feats.length + '장';
      const del = document.createElement('button');
      del.className = 'del'; del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      del.title = T('삭제');
      del.addEventListener('click', () => delClass(i));
      top.appendChild(nm); top.appendChild(ct); top.appendChild(del);
      el.appendChild(top);

      if (c.thumbs.length) {
        const th = document.createElement('div'); th.className = 'thumbs';
        c.thumbs.forEach((src, si) => {
          const im = document.createElement('img');
          im.src = src;
          im.title = T('클릭하면 이 샘플을 지웁니다');
          im.addEventListener('click', ev => { ev.stopPropagation(); delSample(i, si); });
          th.appendChild(im);
        });
        el.appendChild(th);
      }
      box.appendChild(el);
    });
    $('clsHint').style.display = classes.length ? 'none' : '';
  }

  // ── 샘플 수집 ──
  // src 는 웹캠 <video> 이거나 파이보 뷰 캔버스다. 둘 다 fromPixels 로 읽을 수 있다.
  function feature(src) {
    return tf.tidy(() => {
      const img = tf.browser.fromPixels(src)
        .resizeNearestNeighbor([IN_H, IN_W]).toFloat().div(255).expandDims();
      return mobilenet.predict(img).flatten();
    });
  }

  // 마우스를 올리면 확대해서 보므로 표시 크기(32px)보다 크게 만든다
  function thumb(src) {
    const cv = document.createElement('canvas');
    cv.width = 96; cv.height = 96;
    cv.getContext('2d').drawImage(src, 0, 0, 96, 96);
    return cv.toDataURL('image/jpeg', 0.7);
  }

  function shoot() {
    if (!mobilenet || selected < 0) return;
    const src = frame();
    if (!src) return;
    const c = classes[selected];
    c.feats.push(feature(src));
    c.thumbs.push(thumb(src));       // 특징과 썸네일의 인덱스를 맞춰 둔다 (개별 삭제에 필요)
    renderClasses(); refreshUI(); steps();
  }

  // 잘못 찍힌 샘플 한 장 지우기
  function delSample(ci, si) {
    const c = classes[ci];
    if (!c || !c.feats[si]) return;
    c.feats[si].dispose();
    c.feats.splice(si, 1);
    c.thumbs.splice(si, 1);
    renderClasses(); refreshUI(); steps();
  }

  function startCap() {
    if (!mobilenet || selected < 0 || !frameReady() || capturing) return;
    capturing = true;
    shoot();
    capTimer = setInterval(shoot, 120);
  }
  function stopCap() {
    capturing = false;
    clearInterval(capTimer);
  }

  // ── 학습 ──
  async function train() {
    const usable = classes.filter(c => c.feats.length > 0);
    if (usable.length < 2) { toast(T('클래스 2개 이상에 샘플이 필요합니다')); return; }

    stopInfer();
    $('trainBtn').disabled = true;

    const xs = [], ys = [];
    usable.forEach((c, i) => c.feats.forEach(f => { xs.push(f); ys.push(i); }));
    tf.util.shuffleCombo(xs, ys);

    const X = tf.stack(xs);
    const Y = tf.oneHot(tf.tensor1d(ys, 'int32'), usable.length);

    if (model) model.dispose();
    model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [FEAT], units: 128, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: usable.length, activation: 'softmax' }));
    model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

    const epochs = Math.max(1, parseInt($('epochs').value, 10) || 15);
    try {
      await model.fit(X, Y, {
        shuffle: true,
        batchSize: Math.max(1, parseInt($('batch').value, 10) || 32),
        epochs: epochs,
        callbacks: {
          onEpochEnd: (ep, logs) => {
            const r = (ep + 1) / epochs;
            lastAcc = (logs.acc != null ? logs.acc : logs.accuracy) || 0;
            progress(T('학습 중') + ' ' + (ep + 1) + '/' + epochs,
              T('정확도') + ' ' + (lastAcc * 100).toFixed(0) + '%', r);
          },
        },
      });
      model.labels = usable.map(c => c.name);
      // 정확도는 끝난 뒤에도 남겨 둔다. 추론이 잘 안될 때 먼저 볼 값이다.
      progress(T('학습 완료'), T('정확도') + ' ' + (lastAcc * 100).toFixed(0) + '%', 1);
      toast(T('학습이 끝났어요. 추론을 시작해 보세요'));
    } catch (e) {
      progress(T('학습에 실패했습니다'), '', 0);
      console.error(e);
    }
    X.dispose(); Y.dispose();
    refreshUI(); steps();
  }

  // ── 추론 ──
  function predictOnce() {
    if (!model || !mobilenet) return;
    const src = frame();
    if (!src) return;
    const out = tf.tidy(() => model.predict(feature(src).expandDims()));
    out.data().then(p => {
      renderBars(model.labels || [], p);
      out.dispose();
    });
  }

  function renderBars(labels, probs) {
    const box = $('bars');
    let top = 0;
    for (let i = 1; i < probs.length; i++) if (probs[i] > probs[top]) top = i;

    if (box.children.length !== labels.length) {
      box.innerHTML = '';
      labels.forEach(n => {
        const d = document.createElement('div'); d.className = 'bar';
        d.innerHTML = '<div class="bl"><span></span><span></span></div><div class="bt"><div class="bf"></div></div>';
        d.querySelector('.bl span').textContent = n;
        box.appendChild(d);
      });
    }
    labels.forEach((n, i) => {
      const d = box.children[i];
      d.classList.toggle('top', i === top);
      d.querySelectorAll('.bl span')[1].textContent = (probs[i] * 100).toFixed(0) + '%';
      d.querySelector('.bf').style.width = (probs[i] * 100) + '%';
    });
  }

  function startInfer() {
    if (!model || !frameReady() || inferring) return;
    inferring = true;
    inferTimer = setInterval(predictOnce, 400);
    $('inferBtn').innerHTML = '<i class="fa-solid fa-stop"></i> ' + T('추론 정지');
    steps();
  }
  function stopInfer() {
    if (!inferring) return;
    inferring = false;
    clearInterval(inferTimer);
    $('inferBtn').innerHTML = '<i class="fa-solid fa-brain"></i> ' + T('추론 시작');
    steps();
  }

  // ── 모델 저장 / 내보내기 / 불러오기 ──
  // 저장·내보내기 모두 같은 내용을 담는다 (실물 zip 구성과 동일)
  async function artifacts() {
    return await model.save(tf.io.withSaveHandler(async a => a));
  }

  async function saveModel() {
    const name = $('mdlName').value.trim();
    if (!name) { toast(T('모델 이름을 적어 주세요')); return; }
    try {
      const a = await artifacts();
      await CfStore.save(name, {
        labels: model.labels || [],
        topology: a.modelTopology,
        specs: a.weightSpecs,
        weights: a.weightData,
      });
      toast(T('저장했어요') + ': ' + name);
      renderSaved();
    } catch (e) {
      toast(T('저장하지 못했습니다'));
      console.error(e);
    }
  }

  async function exportZip() {
    try {
      const a = await artifacts();
      const zip = new JSZip();
      zip.file('model.json', JSON.stringify(a.modelTopology));
      if (a.weightSpecs) zip.file('weightsSpecs.json', JSON.stringify(a.weightSpecs));
      if (a.weightData) zip.file('weights.bin', new Uint8Array(a.weightData));
      zip.file('labels.txt', (model.labels || []).join('\n'));
      const blob = await zip.generateAsync({ type: 'blob' });
      const el = document.createElement('a');
      el.href = URL.createObjectURL(blob);
      el.download = ($('mdlName').value.trim() || 'trained-model') + '.zip';
      el.click();
      URL.revokeObjectURL(el.href);
    } catch (e) {
      toast(T('내보내지 못했습니다'));
      console.error(e);
    }
  }

  async function importZip(file) {
    try {
      const zip = await JSZip.loadAsync(file);
      const topology = JSON.parse(await zip.file('model.json').async('string'));
      const specsF = zip.file('weightsSpecs.json');
      const dataF = zip.file('weights.bin');
      const specs = specsF ? JSON.parse(await specsF.async('string')) : undefined;
      const data = dataF ? (await dataF.async('arraybuffer')) : undefined;

      if (model) model.dispose();
      model = await tf.loadLayersModel(tf.io.fromMemory({
        modelTopology: topology, weightSpecs: specs, weightData: data,
      }));

      const lf = zip.file('labels.txt');
      model.labels = lf ? (await lf.async('string')).split('\n').map(s => s.trim()).filter(Boolean) : [];
      $('mdlName').value = file.name.replace(/\.zip$/i, '');
      progress(T('모델을 불러왔습니다'), '', 1);
      toast(T('모델을 불러왔습니다'));
      refreshUI(); steps();
    } catch (e) {
      toast(T('모델을 불러오지 못했습니다'));
      console.error(e);
    }
  }

  async function renderSaved() {
    const box = $('savedList');
    let list = [];
    try { list = await CfStore.list(); } catch (e) { /* 무시 */ }
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<div class="hint" style="margin:0">' + T('아직 저장한 모델이 없습니다') + '</div>';
      return;
    }
    list.forEach(r => {
      const d = document.createElement('div');
      d.className = 'saved';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name;
      const mt = document.createElement('span'); mt.className = 'mt';
      mt.textContent = (r.labels || []).length + T('개 클래스');
      const del = document.createElement('button');
      del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      del.title = T('삭제');
      del.addEventListener('click', async () => { await CfStore.remove(r.name); renderSaved(); });
      d.appendChild(nm); d.appendChild(mt); d.appendChild(del);
      box.appendChild(d);
    });
  }

  // ── 버튼 활성 상태 ──
  function refreshUI() {
    const canShoot = !!(frameReady() && mobilenet && selected >= 0);
    $('capBtn').disabled = !canShoot;
    $('selInfo').textContent = selected >= 0
      ? T('선택됨') + ': ' + classes[selected].name
      : T('클래스를 선택하세요');
    $('selInfo').classList.toggle('on', selected >= 0);

    const shot = classes.filter(c => c.feats.length > 0).length;
    $('trainBtn').disabled = !(mobilenet && shot >= 2);

    $('inferBtn').disabled = !(model && frameReady());
    $('mdlSave').disabled = !model;
    $('mdlExport').disabled = !model;
  }

  // ── 3D 지연 로드 ──
  // 파이보 뷰를 고르기 전에는 three.js·로봇 모델을 받지 않는다.
  // 웹캠만 쓰는 학생은 이 비용이 0 이 된다.
  const SIM_FILES = [
    'lib/three.min.js', 'js/config.js', 'js/dom.js', 'js/orbit.js', 'js/loaders.js',
    'js/viewer.js', 'js/physics.js', 'js/backdrop.js', 'js/backdrop_factory.js',
    'js/motion.js', 'js/pibo_api.js', 'js/custom_style.js', 'js/pibo_oled.js',
    'js/pibo_camera.js', 'js/motion_names.js',
  ];
  const SIM_V = '?v=16';
  let simReady = null;

  function loadOne(src) {
    return new Promise(function (res, rej) {
      const el = document.createElement('script');
      el.src = src;
      el.async = false;           // 순서를 지켜야 한다 (뒤 파일이 앞 파일의 함수를 쓴다)
      el.onload = res;
      el.onerror = function () { rej(new Error(src)); };
      document.head.appendChild(el);
    });
  }

  function loadSim() {
    if (simReady) return simReady;
    simReady = (async function () {
      for (let i = 0; i < SIM_FILES.length; i++) {
        progress(T('3D 준비 중'), (i + 1) + '/' + SIM_FILES.length, (i + 1) / SIM_FILES.length);
        await loadOne(SIM_FILES[i] + SIM_V);
      }
      // 각 파일이 DOMContentLoaded 에 맞춰 붙여 둔 초기화가 이미 지나갔으므로 직접 알린다
      document.dispatchEvent(new Event('DOMContentLoaded'));
      progress(T('3D 준비 완료'), '', 1);
      fillLines();
      fillItems();
      refreshVary();
    })().catch(function (e) {
      simReady = null;
      progress(T('3D 를 불러오지 못했습니다'), '', 0);
      console.error(e);
      throw e;
    });
    return simReady;
  }

  // ── 소스 전환 ──
  // 파이보가 보는 화면을 미리보기에 계속 그린다 (샘플로 찍히는 것과 같은 그림)
  let povTimer = null;
  let blackSince = 0, fixedOnce = false;

  function povNotice(msg) {
    const cv = $('povView');
    if (!cv) return;
    if (cv.width !== 640) { cv.width = 640; cv.height = 480; }
    const g = cv.getContext('2d');
    g.fillStyle = '#0C1114'; g.fillRect(0, 0, 640, 480);
    g.fillStyle = '#56646C'; g.font = 'bold 26px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(msg, 320, 240);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }

  // 화면이 온통 검게 나오는 일이 가끔 있다.
  // 3D 가 화면 크기·조명을 잡기 전에 첫 장을 찍으면 그렇게 되고, 그대로 굳는다.
  // 몇 점만 찍어 보고 계속 검으면 크기를 다시 잡아 스스로 복구한다.
  function looksBlack(g) {
    const pts = [[320, 240], [120, 120], [520, 360], [320, 80]];
    for (let i = 0; i < pts.length; i++) {
      const d = g.getImageData(pts[i][0], pts[i][1], 1, 1).data;
      if (d[0] > 12 || d[1] > 12 || d[2] > 12) return false;
    }
    return true;
  }

  function povLoop() {
    const cv = $('povView'), src = frame();
    if (!cv) return;
    if (!src) { povNotice(T('3D 준비 중')); return; }
    if (cv.width !== 640) { cv.width = 640; cv.height = 480; }
    const g = cv.getContext('2d');
    g.drawImage(src, 0, 0, 640, 480);

    if (!looksBlack(g)) { blackSince = 0; return; }
    if (!blackSince) { blackSince = Date.now(); return; }
    if (fixedOnce || Date.now() - blackSince < 1500) return;

    // 한 번만 되살려 본다 — 크기를 다시 잡고 무대를 다시 그린다
    fixedOnce = true;
    window.dispatchEvent(new Event('resize'));
    if (typeof PiboView !== 'undefined' && PiboView.calibrate) PiboView.calibrate();
    if (typeof setTheme === 'function' && typeof FactoryLine !== 'undefined') {
      setTheme('factory_' + FactoryLine.line());
      FactoryLine.stage($('itemSel').value);
      setTilt(tilt);
    }
    console.warn('[classify] 파이보 뷰가 검게 나와 다시 잡았습니다');
  }

  async function applySource() {
    const web = (source === 'webcam');
    if (!web) {
      stopInfer(); stopCam();                  // 화면 표시를 정하기 전에 웹캠을 먼저 끈다
      $('vp').style.display = 'block';
      $('povView').style.display = 'block';
      $('camVid').style.display = 'none';
      $('camOff').style.display = 'none';
      $('webRow').style.display = 'none';
      try { await loadSim(); } catch (e) { return; }
    }
    $('webRow').style.display = web ? '' : 'none';
    $('piboRow').style.display = web ? 'none' : '';
    $('camVid').style.display = web ? '' : 'none';
    $('vp').style.display = web ? 'none' : 'block';
    $('povView').style.display = web ? 'none' : 'block';
    $('varyRow').style.display = web ? 'none' : 'block';
    $('camOff').style.display = (web && !stream) ? '' : 'none';

    clearInterval(povTimer);
    if (!web) povTimer = setInterval(povLoop, 120);

    if (web) {
      if (typeof FactoryLine !== 'undefined') FactoryLine.flow();
    } else {
      // 공장 라인 무대로 바꾸고 벨트를 세운다. 학습은 물건이 서 있어야 한다.
      if (typeof FactoryLine !== 'undefined') {
        FactoryLine.line($('lineSel').value || 'box');
        fillItems();
        FactoryLine.stage($('itemSel').value);
      }
      setTilt(tilt);        // 무대를 다시 만들면 자세도 다시 잡아 준다
      // 3D 는 화면 크기가 바뀌면 다시 잡아야 한다.
      // 방금 화면에 나타난 참이라 배치가 끝난 뒤(두 프레임 후)에 알려야 크기가 제대로 잡힌다.
      blackSince = 0; fixedOnce = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
      });
    }
    try { localStorage.setItem('piboLab.camSource', source); } catch (e) { /* 무시 */ }
    refreshUI(); steps();

    // 파이보 뷰는 로봇·무대가 다 뜬 뒤에야 찍을 수 있다. 준비될 때까지 확인한다.
    clearInterval(waitTimer);
    if (!web) {
      waitTimer = setInterval(function () {
        if (frameReady()) { clearInterval(waitTimer); refreshUI(); steps(); }
      }, 400);
    }
  }

  // 고개 각도 — 실물에도 있는 '머리 모터' 와 같은 값이라, 개발툴에서 그대로 재현할 수 있다.
  // 학습할 때와 판정할 때 각도가 다르면 보이는 그림이 달라져 정확도가 떨어진다.
  let tilt = 0;
  function setTilt(v) {
    tilt = Math.max(-25, Math.min(25, Math.round(v)));
    if (typeof setJointValue === 'function') setJointValue('head_tilt_joint', tilt);
    $('vT').textContent = tilt + '°';
  }

  // 촬영 변화 — 자동 흔들기 + 기준 위치·크기
  function refreshVary() {
    if (typeof FactoryLine === 'undefined') return;
    $('vD').textContent = (FactoryLine.beltZ() * 100).toFixed(0) + 'cm';
    // 단위를 함께 보여 준다 (좌우·앞뒤 cm / 크기 배 / 각도 도)
    $('vX').textContent = (FactoryLine.pose('x') * 100).toFixed(0) + 'cm';
    $('vZ').textContent = (FactoryLine.pose('z') * 100).toFixed(0) + 'cm';
    $('vS').textContent = FactoryLine.pose('s').toFixed(1) + '배';
  }

  function bindVary() {
    // 벨트가 가까울수록 물건이 크게 보인다. 판정할 때와 같은 값이어야 하므로
    // 여기서 정한 값을 개발툴의 공장 라인 패널에서도 똑같이 맞춰야 한다.
    $('distDn').addEventListener('click', function () {
      if (typeof FactoryLine !== 'undefined') { FactoryLine.beltZ(FactoryLine.beltZ() - 0.01); refreshVary(); }
    });
    $('distUp').addEventListener('click', function () {
      if (typeof FactoryLine !== 'undefined') { FactoryLine.beltZ(FactoryLine.beltZ() + 0.01); refreshVary(); }
    });
    $('tiltDn').addEventListener('click', function () { setTilt(tilt - 1); });
    $('tiltUp').addEventListener('click', function () { setTilt(tilt + 1); });
    $('varyChk').addEventListener('change', function () {
      if (typeof FactoryLine !== 'undefined') FactoryLine.vary(this.checked);
    });
    document.querySelectorAll('.vb').forEach(function (b) {
      b.addEventListener('click', function () {
        if (typeof FactoryLine === 'undefined') return;
        const k = b.dataset.k, d = parseFloat(b.dataset.d);
        FactoryLine.pose(k, FactoryLine.pose(k) + d);
        refreshVary();
      });
    });
  }

  function fillLines() {
    const sel = $('lineSel');
    if (!sel || typeof FactoryLine === 'undefined') return;
    sel.innerHTML = '';
    FactoryLine.lines().forEach(function (L) {
      const o = document.createElement('option');
      o.value = L.key;
      o.textContent = T(L.label);
      sel.appendChild(o);
    });
    sel.value = FactoryLine.line();
  }

  function fillItems() {
    const sel = $('itemSel');
    if (!sel || typeof FactoryLine === 'undefined') return;
    const kinds = FactoryLine.kinds;
    sel.innerHTML = '';
    Object.keys(kinds).forEach(function (k) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = T('물건') + ': ' + T(kinds[k].label);
      sel.appendChild(o);
    });
  }

  // ── 연결 ──
  // 3D 파일들이 각자 DOMContentLoaded 에 초기화를 걸어 두는데, 늦게 불러오면 그 이벤트가 이미 지났다.
  // 그래서 로드 후 직접 한 번 쏘는데, 그러면 이 초기화도 다시 불린다. 한 번만 돌게 막는다.
  let inited = false;
  document.addEventListener('DOMContentLoaded', function () {
    if (inited) return;
    inited = true;
    $('clsAdd').addEventListener('click', addClass);
    $('clsName').addEventListener('keydown', e => { if (e.key === 'Enter') addClass(); });

    $('camBtn').addEventListener('click', () => (stream ? stopCam() : camOn()));
    $('camSel').addEventListener('change', () => { if (stream) { stopCam(); camOn(); } });

    const cap = $('capBtn');
    cap.addEventListener('mousedown', e => { e.preventDefault(); startCap(); });
    cap.addEventListener('touchstart', e => { e.preventDefault(); startCap(); }, { passive: false });
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(k =>
      cap.addEventListener(k, stopCap));
    window.addEventListener('blur', stopCap);

    $('trainBtn').addEventListener('click', train);
    $('inferBtn').addEventListener('click', () => (inferring ? stopInfer() : startInfer()));

    $('mdlSave').addEventListener('click', saveModel);
    $('mdlExport').addEventListener('click', exportZip);
    $('mdlImport').addEventListener('click', () => $('mdlFile').click());
    $('mdlFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) importZip(f);
      e.target.value = '';
    });

    fillLines();
    fillItems();
    bindVary();
    refreshVary();
    $('srcSel').addEventListener('change', function () { source = this.value; applySource(); });
    $('itemSel').addEventListener('change', function () {
      if (typeof FactoryLine !== 'undefined') FactoryLine.stage(this.value);
    });
    // 공장을 바꾸면 물건 목록도 그 공장 것으로 갈아 끼운다
    $('lineSel').addEventListener('change', function () {
      if (typeof FactoryLine === 'undefined') return;
      FactoryLine.line(this.value);
      fillItems();
      FactoryLine.stage($('itemSel').value);
      setTilt(tilt);
      refreshVary();
    });
    try { source = localStorage.getItem('piboLab.camSource') || 'webcam'; } catch (e) { /* 무시 */ }
    $('srcSel').value = source;
    applySource();

    listCams();
    renderSaved();
    refreshUI();
    steps();
    loadBase();
  });
})();
