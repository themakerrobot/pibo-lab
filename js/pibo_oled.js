// ═══════════════════════════════════════════════════════════
// OLED 에뮬레이션 — 128×64 캔버스를 몸통 LCD 텍스처로 출력
// ═══════════════════════════════════════════════════════════
// 실물 openpibo 와 동작을 맞춤: draw_* 는 버퍼에만 그리고, show() 해야 화면에 나온다.
const Oled = (function () {
  const W = 128, H = 64;
  const buf = document.createElement('canvas');
  buf.width = W; buf.height = H;
  const g = buf.getContext('2d');
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
    const vp = document.getElementById('vp');
    if (!vp) return;
    const top = document.getElementById('gHud') ? 48 : 10;
    const box = document.createElement('div');
    box.id = 'oledPreview';
    box.style.cssText = 'position:absolute;left:12px;top:' + top + 'px;z-index:20;' +
      'background:rgba(255,255,255,.94);border:1px solid var(--line,#DDE6EA);border-radius:10px;' +
      'box-shadow:0 1px 2px rgba(35,54,66,.05),0 4px 14px rgba(35,54,66,.06);padding:7px 7px 4px;user-select:none';
    pv = document.createElement('canvas');
    pv.width = W; pv.height = H;
    pv.style.cssText = 'display:block;width:192px;height:96px;image-rendering:pixelated;border-radius:5px;background:#000';
    const lbl = document.createElement('div');
    lbl.textContent = 'OLED';
    lbl.style.cssText = 'font-size:10px;color:var(--ink3,#96A5AE);margin-top:4px;font-weight:600';
    box.appendChild(pv); box.appendChild(lbl);
    vp.appendChild(box);
    pvg = pv.getContext('2d');
    pvg.imageSmoothingEnabled = false;
  }

  function push() {
    attach();
    mountPreview();
    if (pvg) pvg.drawImage(buf, 0, 0);
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

  return {
    setFont(size) { fontSize = Math.max(6, Math.min(H, Number(size) || 10)); },

    text(x, y, t) {
      g.fillStyle = ink();
      g.font = 'bold ' + fontSize + 'px sans-serif';
      g.textBaseline = 'top';
      g.fillText(String(t), Number(x) || 0, Number(y) || 0);
    },

    rect(x1, y1, x2, y2, fill) {
      const x = Math.min(x1, x2), y = Math.min(y1, y2);
      const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      g.strokeStyle = g.fillStyle = ink(); g.lineWidth = 1;
      fill ? g.fillRect(x, y, w, h) : g.strokeRect(x + 0.5, y + 0.5, w, h);
    },

    ellipse(x1, y1, x2, y2, fill) {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      g.strokeStyle = g.fillStyle = ink(); g.lineWidth = 1;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      fill ? g.fill() : g.stroke();
    },

    line(x1, y1, x2, y2) {
      g.strokeStyle = ink(); g.lineWidth = 1;
      g.beginPath(); g.moveTo(x1 + 0.5, y1 + 0.5); g.lineTo(x2 + 0.5, y2 + 0.5); g.stroke();
    },

    invert() {
      inverted = !inverted;
      const img = g.getImageData(0, 0, W, H), d = img.data;
      for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
      g.putImageData(img, 0, 0);
    },

    clear() { g.fillStyle = paper(); g.fillRect(0, 0, W, H); },

    show() { push(); },

    reset() { inverted = false; fontSize = 10; clearBuf(); push(); },
  };
})();
