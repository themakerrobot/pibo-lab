// ── 뷰포트 좌측 패널 공통 틀 (OLED · 카메라) ──
// 둘 다 3D 화면을 가리므로 접을 수 있어야 한다.
// 각자 absolute 로 띄우면 하나를 접어도 빈자리가 남으므로 세로로 쌓는 컨테이너에 넣는다.
const PiboPanels = (function () {
  let host = null;

  function getHost() {
    if (host && host.parentNode) return host;
    const vp = document.getElementById('vp');
    if (!vp) return null;
    host = document.createElement('div');
    host.id = 'vpPanels';
    host.style.cssText = 'position:absolute;left:12px;top:10px;z-index:20;' +
      'display:flex;flex-direction:column;gap:8px;align-items:flex-start';
    vp.appendChild(host);
    return host;
  }

  // 접힘 상태는 새로고침해도 유지한다
  function saved(key) {
    try { return localStorage.getItem('piboLab.panel.' + key) === 'off'; } catch (e) { return false; }
  }
  function store(key, off) {
    try { localStorage.setItem('piboLab.panel.' + key, off ? 'off' : 'on'); } catch (e) { /* 무시 */ }
  }

  // 반환: { box, body } — body 안에 내용을 넣으면 된다
  function make(key, title) {
    const h = getHost();
    if (!h) return null;

    const box = document.createElement('div');
    box.style.cssText = 'background:rgba(255,255,255,.94);border:1px solid var(--line,#DDE6EA);' +
      'border-radius:10px;box-shadow:0 1px 2px rgba(35,54,66,.05),0 4px 14px rgba(35,54,66,.06);' +
      'padding:5px 7px 6px;user-select:none';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;' +
      'font-size:10px;font-weight:700;color:var(--ink3,#96A5AE);padding:1px 0 4px';

    const cap = document.createElement('span');
    cap.textContent = title;
    cap.style.cssText = 'flex:1';

    const arw = document.createElement('span');
    arw.textContent = '▼';
    arw.style.cssText = 'font-size:9px;line-height:1;transition:transform .15s';

    head.appendChild(cap); head.appendChild(arw);
    const body = document.createElement('div');

    let off = saved(key);
    function apply() {
      body.style.display = off ? 'none' : '';
      arw.style.transform = off ? 'rotate(-90deg)' : '';
      head.style.paddingBottom = off ? '1px' : '4px';
    }
    head.addEventListener('click', () => { off = !off; store(key, off); apply(); });
    apply();

    box.appendChild(head); box.appendChild(body);
    h.appendChild(box);
    return { box: box, body: body, head: head, caption: cap };
  }

  return { make: make };
})();

// OLED 에뮬레이션 — 128×64 캔버스를 몸통 LCD 텍스처로 출력
// 실물 openpibo 와 동작을 맞춤: draw_* 는 버퍼에만 그리고, show() 해야 화면에 나온다.
// 미리보기 품질을 위해 같은 내용을 4배 해상도 버퍼(hi)에도 함께 그린다.
//   · buf(128×64)  → 몸통 텍스처 (실물과 동일한 픽셀 해상도)
//   · hi (512×256) → 좌측 상단 미리보기 (벡터로 그려 글씨가 선명)
const Oled = (function () {
  const W = 128, H = 64, SC = 4;
  const buf = document.createElement('canvas');
  buf.width = W; buf.height = H;
  const g = buf.getContext('2d');
  const hi = document.createElement('canvas');
  hi.width = W * SC; hi.height = H * SC;
  const hg = hi.getContext('2d');
  hg.setTransform(SC, 0, 0, SC, 0, 0);   // 0~127 / 0~63 좌표계 공유
  // 프레임에 가려지는 만큼 안으로 넣는 비율.
  //   글씨 크기 10 에서 한글 한 글자 = 10px, 그 절반인 5px 를 좌우/상하에서 확보
  //   → (128 - 5*2) / 128 = 0.9219.  더 넣고 싶으면 이 값만 낮추면 된다.
  const BEZEL_SCALE = 0.9219;

  // 글씨 크기 기본 10 — 실물 openpibo Oled 와 동일
  let fontSize = 10, inverted = false, tex = null, attached = false;
  // LCD 메시가 정사각형(28×27.5mm)에 가까운데 OLED 는 128×64(2:1) 이라
  // 그대로 입히면 세로로 2배 늘어난다. 화면 비율에 맞춘 캔버스에 레터박스로 얹는다.
  const disp = document.createElement('canvas');
  disp.width = 512; disp.height = 256;
  const dg = disp.getContext('2d');

  function clearBuf() {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    hg.fillStyle = '#000'; hg.fillRect(0, 0, W, H);
  }
  clearBuf();

  // 몸통 LCD 메시에 이 캔버스를 붙인다 (setupLCD 가 만든 텍스처를 대체)
  function attach() {
    if (attached || typeof lcdMesh === 'undefined' || !lcdMesh) return;
    // 실제 LCD 면의 가로:세로 비를 읽어 표시 캔버스 크기를 맞춘다
    const geo = lcdMesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const rx = (bb.max.x - bb.min.x) || 1, rz = (bb.max.z - bb.min.z) || 1;
    disp.width = 512;
    disp.height = Math.max(64, Math.round(512 * rz / rx));
    tex = new THREE.CanvasTexture(disp);
    tex.anisotropy = 4;
    tex.minFilter = THREE.LinearFilter;   // 128×64 를 또렷하게
    tex.magFilter = THREE.NearestFilter;  // 픽셀 느낌 유지
    lcdMesh.material.color.set(0x000000);
    lcdMesh.material.emissive = new THREE.Color(0xffffff);
    lcdMesh.material.emissiveMap = tex;
    lcdMesh.material.needsUpdate = true;
    attached = true;
  }

  // ── 좌측 상단 미러 미리보기 (로봇 몸통 OLED가 작아 잘 안 보이는 문제 보완) ──
  let pv = null, pvg = null;
  function mountPreview() {
    if (pv) return;
    const p = PiboPanels.make('oled', 'OLED');
    if (!p) return;
    p.box.id = 'oledPreview';
    pv = document.createElement('canvas');
    pv.width = W * SC; pv.height = H * SC;   // 고해상도 버퍼 그대로 담고 CSS 로 축소 표시
    pv.style.cssText = 'display:block;width:192px;height:96px;border-radius:5px;background:#000';
    p.body.appendChild(pv);
    pvg = pv.getContext('2d');
  }

  function push() {
    attach();
    mountPreview();
    if (pvg) pvg.drawImage(hi, 0, 0);
    if (!tex) return;
    // 128×64 버퍼를 비율 유지한 채 가운데 정렬 (좌표계는 항상 0~127 / 0~63)
    // 실물은 LCD 겉을 프레임이 덮어 가장자리가 조금 가려진다.
    // 글씨 크기 10 기준 한글 0.5글자(5px)만큼 사방을 안으로 넣어 잘리지 않게 한다.
    dg.fillStyle = '#000';
    dg.fillRect(0, 0, disp.width, disp.height);
    const sc = Math.min(disp.width / W, disp.height / H) * BEZEL_SCALE;
    const w = W * sc, h = H * sc;
    dg.imageSmoothingEnabled = false;
    dg.drawImage(buf, (disp.width - w) / 2, (disp.height - h) / 2, w, h);
    tex.needsUpdate = true;
  }

  const ink = () => (inverted ? '#000' : '#fff');
  const paper = () => (inverted ? '#fff' : '#000');

  // buf 와 hi 에 같은 그리기를 수행 (hi 는 4배 변환이 걸려 있어 좌표 코드는 동일)
  function both(fn) { fn(g); fn(hg); }

  return {
    setFont(size) { fontSize = Math.max(6, Math.min(H, Number(size) || 10)); },

    text(x, y, t) {
      both(c => {
        c.fillStyle = ink();
        c.font = 'bold ' + fontSize + 'px sans-serif';
        c.textBaseline = 'top';
        c.fillText(String(t), Number(x) || 0, Number(y) || 0);
      });
    },

    rect(x1, y1, x2, y2, fill) {
      const x = Math.min(x1, x2), y = Math.min(y1, y2);
      const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      both(c => {
        c.strokeStyle = c.fillStyle = ink(); c.lineWidth = 1;
        fill ? c.fillRect(x, y, w, h) : c.strokeRect(x + 0.5, y + 0.5, w, h);
      });
    },

    ellipse(x1, y1, x2, y2, fill) {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      both(c => {
        c.strokeStyle = c.fillStyle = ink(); c.lineWidth = 1;
        c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        fill ? c.fill() : c.stroke();
      });
    },

    line(x1, y1, x2, y2) {
      both(c => {
        c.strokeStyle = ink(); c.lineWidth = 1;
        c.beginPath(); c.moveTo(x1 + 0.5, y1 + 0.5); c.lineTo(x2 + 0.5, y2 + 0.5); c.stroke();
      });
    },

    invert() {
      inverted = !inverted;
      const img = g.getImageData(0, 0, W, H), d = img.data;
      for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
      g.putImageData(img, 0, 0);
      const img2 = hg.getImageData(0, 0, W * SC, H * SC), d2 = img2.data;
      for (let i = 0; i < d2.length; i += 4) { d2[i] = 255 - d2[i]; d2[i + 1] = 255 - d2[i + 1]; d2[i + 2] = 255 - d2[i + 2]; }
      hg.putImageData(img2, 0, 0);
    },

    clear() {
      both(c => { c.fillStyle = paper(); c.fillRect(0, 0, W, H); });
    },

    // 카메라 이미지를 128×64 흑백으로 변환해 버퍼에 넣는다 (실물 oled.imshow)
    // 실물 OLED 는 1비트라 중간 밝기가 없다. 밝기 임계값으로 흑/백만 남긴다.
    image(src) {
      if (!src) return;
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      const tg = tmp.getContext('2d');
      tg.fillStyle = '#000'; tg.fillRect(0, 0, W, H);
      const s = Math.min(W / src.width, H / src.height);
      const w = src.width * s, h = src.height * s;
      tg.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);

      const im = tg.getImageData(0, 0, W, H), d = im.data;
      for (let i = 0; i < d.length; i += 4) {
        const y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const v = y > 110 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = inverted ? 255 - v : v;
        d[i + 3] = 255;
      }
      tg.putImageData(im, 0, 0);

      g.drawImage(tmp, 0, 0);
      // hg 에는 이미 SC 배 변환이 걸려 있으므로 128×64 좌표 그대로 그린다
      hg.imageSmoothingEnabled = false;
      hg.drawImage(tmp, 0, 0, W, H);
      push();
    },

    show() { push(); },

    reset() { inverted = false; fontSize = 10; clearBuf(); push(); },
  };
})();

// 개발툴·게임툴에서는 로드 직후부터 미리보기 표시 (검은 화면 = 실물 초기 상태)
document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('devConsole') || document.getElementById('gConsole')) Oled.show();
});
