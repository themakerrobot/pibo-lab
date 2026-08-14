// ═══════════════════════════════════════════════════════════
// 공장 라인 배경 — 스마트팩토리 수업용 무대
// ═══════════════════════════════════════════════════════════
// backdrop.js 의 THEMES 에 'factory' 를 얹는다. 원본은 건드리지 않는다.
//
// 벨트는 텍스처 UV 를 밀어 흐르는 것처럼 보이게 하고,
// 물건은 상자 메시를 x 축으로 옮겨 끝에 닿으면 되돌린다.
// 물리(마찰로 밀리는 컨베이어)는 쓰지 않는다 — 수업에는 필요 없고 비용만 크다.
//
// 물건은 자동으로 흐른다. 컨베이어 제어 블록은 실물 파이보에 없어서
// 만들면 호환이 깨지기 때문이다. 학생 코드는 '보고 판단하고 반응하는' 쪽만 맡는다.

(function () {
  'use strict';
  if (typeof THEMES === 'undefined') return;   // backdrop.js 가 없는 페이지

  const BELT_W = 0.24;      // 벨트 폭
  const BELT_L = 1.10;      // 벨트 길이 (x 방향)
  const SPAN = BELT_L - 0.16;   // 물건이 도는 구간. 벨트보다 좁아야 끝에서 반쯤 걸치지 않는다
  // 로봇 중심 ~ 벨트 중심 거리. 음수면 로봇이 벨트 안쪽에 서서 검사하는 모양이 된다.
  // 파이보 시야에 상자가 크게, 한 개만 잡히는 위치. FactoryLine.beltZ() 로 조절 가능.
  let BELT_Z = -0.075;      // 월드 기준 -9cm
  const HAZ_GAP = 0.155;    // 벨트 중심 ~ 안전 빗금 (빗금은 스케일 대상이 아니라 월드값으로 놓는다)
  const BELT_TOP = 0.182;   // 벨트 윗면 높이 — 로봇 몸통 OLED 를 찾으면 그 높이 + RAISE 로 맞춘다
  const BELT_RAISE = 0.07;  // OLED 높이보다 조금 더 올려야 파이보 시야에 상자가 잘 들어온다
  const LEG_H0 = 0.10;      // 다리 기준 길이 (scale 로 늘린다)
  const ITEM_MARGIN = 0.06; // 물건이 벨트 끝에 걸치지 않도록 두는 여유 (상자 반폭보다 크게)
  // 인덱싱 컨베이어 — 실제 검사 라인처럼 한 칸씩 옮기고 멈춘다.
  // 멈출 때마다 물건이 판정 구역 정중앙에 오므로 사진이 항상 같은 구도로 찍힌다.
  let STOP_T = 3.0;         // 정지 시간 (s)
  let MOVE_T = 0.3;         // 한 칸 옮기는 시간 (s)

  let line = null, beltMat = null, items = [], legs = [], lamps = [];
  let hazards = [], ctlGrp = null, twrGrp = null;   // 벨트를 옮길 때 같이 따라가야 하는 것들
  // 조절 패널 (tick 이 즉시 실행되므로 선언은 위쪽에 둔다)
  let ui = null, uiCap = null, uiRows = {}, uiShown = false;
  let phase = 'stop', phaseT = 0, moveFrom = [], moveYaw = [];  // 인덱싱 상태
  let aligned = false;

  // 흐름 모드 — 개발툴: 여러 물건이 지나감 / 분류툴: 한 개를 세워 두고 촬영
  let flowing = true;
  let single = 'good';

  // 정지(분류툴) 모드에서 물건을 흔들어 학습 사진을 다양하게 만든다
  let vary = true;
  const poseBase = { x: 0, z: 0, s: 1 };

  let FLOW_COUNT = 3;       // 벨트 위에 동시에 올라오는 개수 (패널에서 조절)
  // 첫 종류(박스 공장이면 양품)가 더 자주 나오게 — 실제 라인도 불량은 소수다.
  // 품목 분류 공장(과일·음료 등)에서는 그냥 한쪽이 조금 흔한 정도가 된다.
  function pickKind() {
    const ks = Object.keys(KINDSOF());
    return (Math.random() < 0.4) ? ks[0] : ks[Math.floor(Math.random() * ks.length)];
  }

  // 한 칸의 길이. 인덱싱은 정확히 이만큼씩 옮기므로,
  // 물건이 서는 자리와 옮기는 거리가 같은 값에서 나와야 판정 구역에 딱 선다.
  function slotGap() { return SPAN / FLOW_COUNT; }
  // 0번 슬롯이 판정 구역(x=0)에 오고, 나머지는 한 칸씩 뒤로.
  // 벨트 뒤끝을 넘어가는 것은 앞쪽으로 돌려 담아 개수와 무관하게 고르게 퍼진다.
  // (0 을 중심으로 좌우 대칭 배치하면 짝수 개일 때 중앙이 비어 버린다)
  function slotX(i) {
    const gap = slotGap(), half = SPAN / 2;
    let x = -i * gap;
    while (x < -half - 1e-9) x += SPAN;
    return x;
  }

  // ── 벨트 표면 (고무 + 가로 리브) ──
  // 텍스처 그림은 캔버스에 점을 수천 개 찍어 만들기 때문에 매번 새로 그리면 눈에 띄게 느리다.
  // 공장마다 한 번만 그려 두고 다시 쓴다.
  // 캐시하는 것은 '캔버스'다 — 배경을 바꿀 때 backdrop.js 가 텍스처를 해제하므로
  // THREE.CanvasTexture 는 매번 새로 감싸야 한다 (그건 값이 싸다).
  const canvasCache = {};
  function cachedCanvas(key, draw) {
    if (!canvasCache[key]) canvasCache[key] = draw();
    return canvasCache[key];
  }

  // 벨트 색은 공장마다 다르다 (base=바탕, rib=가로 리브, dark=음영)
  function texBelt(base, rib, dark) {
    const c = cachedCanvas('belt:' + activeLine, function () {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 2500; i++) {
      g.globalAlpha = 0.20 + Math.random() * 0.20;
      g.fillStyle = (Math.random() < .5) ? dark : rib;
      g.fillRect(Math.random() * 64, Math.random() * 256, 2, 2);
      g.globalAlpha = 1;
    }
    for (let y = 0; y < 256; y += 32) {          // 진행 방향이 보이도록 가로 리브
      g.fillStyle = rib; g.fillRect(0, y, 64, 5);
      g.fillStyle = dark; g.fillRect(0, y + 5, 64, 2);
    }
    return c;
    });
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 8);
    t.anisotropy = 8;
    return t;
  }

  // ── 안전 빗금 (노랑/검정) ──
  function texHazard(a, b) {
    const c = cachedCanvas('haz:' + activeLine, function () {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = a; g.fillRect(0, 0, 128, 128);
    g.fillStyle = b;
    for (let i = -128; i < 256; i += 44) {
      g.beginPath();
      g.moveTo(i, 0); g.lineTo(i + 22, 0);
      g.lineTo(i + 22 + 128, 128); g.lineTo(i + 128, 128);
      g.closePath(); g.fill();
    }
    return c;
    });
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(14, 1);
    return t;
  }

  // ── 판정 구역 표시 ──
  function texZone() {
    const c = cachedCanvas('zone', function () {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      g.strokeStyle = '#00BEDC'; g.lineWidth = 7;
      g.setLineDash([16, 11]);
      g.strokeRect(6, 6, 116, 116);
      return c;
    });
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    return t;
  }

  // ═══ 공장 5종 ═══
  // 컨베이어·인덱싱·카메라는 전부 같고, 위에 올라오는 물건만 다르다.
  // 각 공장은 물건 4종을 가진다. 분류 수업에서 클래스 2~4개로 쓰기 알맞은 수다.
  const M = function (c, sh) { return new THREE.MeshPhongMaterial({ color: c, shininess: sh || 8 }); };
  const put = function (g, mesh, x, y, z) {
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };

  // ── 박스 공장 — 같은 상자인데 어딘가 잘못된 것 (검사 라인) ──
  function mkBoxItem(kind) {
    const g = new THREE.Group();
    const w = 0.075, h = 0.060, d = 0.075;
    const body = (kind === 'fade') ? 0xA8A395 : 0xB99A6B;

    const box = put(g, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(body, 6)), 0, h / 2);
    box.receiveShadow = true;
    if (kind === 'dent') {
      box.scale.set(1, 0.86, 1);
      box.rotation.z = 0.13;
      box.position.y = h * 0.43;
      const cr = put(g, new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, h * 0.30, d * 0.5), M(0x8E7550, 3)),
        w * 0.22, h * 0.70, d * 0.18);
      cr.rotation.set(0.4, 0.5, 0.3);
    }
    const skew = (kind === 'label');
    const lab = put(g, new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.0012, d * 0.34),
      M(kind === 'fade' ? 0xE4E0D4 : 0xF2EEE2, 10)),
      skew ? w * 0.16 : 0, h + 0.0008, skew ? d * 0.15 : 0);
    if (skew) lab.rotation.y = 0.46;
    if (kind === 'dent') { lab.position.y = h * 0.86 + 0.0008; lab.rotation.z = 0.13; }

    const bar = put(g, new THREE.Mesh(new THREE.BoxGeometry(w * 0.40, 0.0006, d * 0.06), M(0x33383D)));
    bar.position.copy(lab.position); bar.position.y += 0.0009;
    bar.rotation.copy(lab.rotation);
    return g;
  }

  // ── 과일 공장 ──
  function mkFruitItem(kind) {
    const g = new THREE.Group();
    if (kind === 'apple') {
      const a = put(g, new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 16), M(0xC4362F, 22)), 0, 0.030);
      a.scale.set(1, 0.92, 1);
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.020, 6), M(0x6B4A2A)), 0, 0.066);
      const leaf = put(g, new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 6), M(0x4E8B3A)), 0.011, 0.070);
      leaf.scale.set(1.5, 0.28, 0.7); leaf.rotation.z = 0.4;
    } else if (kind === 'orange') {
      const o = put(g, new THREE.Mesh(new THREE.SphereGeometry(0.031, 20, 16), M(0xE08A2B, 14)), 0, 0.030);
      o.scale.set(1, 0.94, 1);
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.004, 6), M(0x4E7A34)), 0, 0.060);
    } else if (kind === 'banana') {
      // 굽은 모양 — 짧은 원기둥을 호를 그리며 늘어놓는다
      const N = 7;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1), a = (t - 0.5) * 1.9;
        const seg = put(g, new THREE.Mesh(
          new THREE.CylinderGeometry(0.0135 - Math.abs(t - 0.5) * 0.012, 0.0135 - Math.abs(t - 0.5) * 0.012, 0.019, 10),
          M(i === 0 ? 0x8A6B2E : 0xE0C23C, 12)),
          Math.sin(a) * 0.042, 0.016 + Math.cos(a) * 0.010 - 0.008, 0);
        seg.rotation.z = -a;
      }
    } else {  // grape — 알갱이 뭉치
      [[0, 0.014, 0], [-0.016, 0.014, 0.010], [0.016, 0.015, -0.008], [-0.008, 0.014, -0.014],
       [0.009, 0.013, 0.015], [0, 0.036, 0.002], [-0.012, 0.034, -0.006], [0.012, 0.033, 0.007],
       [0, 0.052, 0]].forEach(function (p) {
        put(g, new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 10), M(0x6E3E8C, 26)), p[0], p[1], p[2]);
      });
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.016, 6), M(0x6B4A2A)), 0, 0.066);
    }
    return g;
  }

  // ── 음료 공장 ──
  function mkDrinkItem(kind) {
    const g = new THREE.Group();
    if (kind === 'can') {
      const c = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.070, 22), M(0xB8BEC4, 48)), 0, 0.035);
      c.receiveShadow = true;
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0235, 0.0235, 0.026, 22), M(0xC4362F, 20)), 0, 0.036);
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.023, 0.005, 22), M(0x9AA1A8, 60)), 0, 0.0715);
    } else if (kind === 'bottle') {
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.062, 20), M(0x3E7EA8, 40)), 0, 0.031);
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.020, 0.020, 20), M(0x3E7EA8, 40)), 0, 0.072);
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 18), M(0x2A5C7E, 40)), 0, 0.088);
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0215, 0.0215, 0.024, 20), M(0xF2EEE2, 12)), 0, 0.030);
    } else if (kind === 'carton') {   // 우유팩 — 위가 뾰족한 지붕형
      put(g, new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.062, 0.044), M(0xF2EEE2, 10)), 0, 0.031);
      const roof = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0001, 0.031, 0.026, 4), M(0xE6E1D2, 10)), 0, 0.075);
      roof.rotation.y = Math.PI / 4;
      put(g, new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.020, 0.0012), M(0x3E7EA8, 14)), 0, 0.040, 0.0225);
    } else {  // cup — 컵
      const cup = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.018, 0.058, 22), M(0xE8EEF2, 26)), 0, 0.029);
      cup.receiveShadow = true;
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.004, 22), M(0xC4362F, 18)), 0, 0.058);
      const straw = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.048, 8), M(0xE0C23C)), 0.008, 0.076);
      straw.rotation.z = 0.22;
    }
    return g;
  }

  // ── 과자 공장 ──
  function mkSnackItem(kind) {
    const g = new THREE.Group();
    if (kind === 'bag') {                       // 봉지 과자
      const b = put(g, new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.070, 0.026), M(0xE08A2B, 24)), 0, 0.035);
      b.receiveShadow = true;
      put(g, new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.008, 0.004), M(0xC47020, 10)), 0, 0.070);
      put(g, new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.022, 0.0012), M(0xF2EEE2, 10)), 0, 0.038, 0.0135);
    } else if (kind === 'stick') {              // 막대 과자
      put(g, new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.058, 0.020), M(0xC4362F, 20)), 0, 0.029);
      for (let i = 0; i < 3; i++) {
        put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.030, 8), M(0xE0C23C)),
          (i - 1) * 0.006, 0.070, 0);
      }
    } else if (kind === 'donut') {
      const d = put(g, new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.011, 12, 24), M(0xC98A4B, 14)), 0, 0.011);
      d.rotation.x = Math.PI / 2;
      const ic = put(g, new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0092, 12, 24), M(0xE86A8C, 22)), 0, 0.016);
      ic.rotation.x = Math.PI / 2;
    } else {                                    // cookie
      const c = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.011, 22), M(0xC98A4B, 10)), 0, 0.0055);
      c.receiveShadow = true;
      [[0.012, 0.006], [-0.010, -0.009], [0.002, 0.014], [-0.015, 0.008]].forEach(function (p) {
        put(g, new THREE.Mesh(new THREE.SphereGeometry(0.0042, 8, 6), M(0x4A2F1E)), p[0], 0.012, p[1]);
      });
    }
    return g;
  }

  // ── 부품 공장 ──
  function mkPartItem(kind) {
    const g = new THREE.Group();
    const steelM = M(0x9AA1A8, 55);
    if (kind === 'bolt') {
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.011, 6), steelM), 0, 0.0055);
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.048, 16), steelM), 0, 0.035);
    } else if (kind === 'nut') {
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 6), steelM), 0, 0.007);
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.016, 16), M(0x2E3338)), 0, 0.007);
    } else if (kind === 'gear') {
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.010, 24), steelM), 0, 0.005);
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.012, 14), M(0x2E3338)), 0, 0.005);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const t = put(g, new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.010, 0.007), steelM),
          Math.cos(a) * 0.029, 0.005, Math.sin(a) * 0.029);
        t.rotation.y = -a;
      }
    } else {                                    // spring
      for (let i = 0; i < 7; i++) {
        const r = put(g, new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0032, 8, 18), M(0xB8BEC4, 45)),
          0, 0.006 + i * 0.0085);
        r.rotation.x = Math.PI / 2;
        r.rotation.z = i * 0.35;
      }
    }
    return g;
  }

  // 공장별 무대 꾸밈 — 벨트 색, 상판, 프레임, 소품 성격까지 다르게 한다.
  //   top       상판 재질 (steel / wood / laminate)
  //   belt      [바탕, 리브, 음영]
  //   crateOpen 나무 상자에 물건을 담아 두는지 (아니면 골판지 더미)
  //   shelfItems 선반에 물건을 진열하는지 (아니면 부품 바구니)
  const LINES = {
    box: {
      label: '박스 공장', make: mkBoxItem,
      kinds: { good: { label: '양품' }, dent: { label: '찌그러짐' },
               label: { label: '라벨 삐뚤' }, fade: { label: '변색' } },
      deco: {
        top: 'steel', leg: 0x43484D, floor: 0x6E7276, wall: 0x8E9498,
        belt: ['#2E3338', '#43494F', '#22262A'], rail: 0x9AA1A8, fence: 0xB0B6BC,
        haz: ['#D9A61C', '#22262A'], deck: 0x9A7B51, crate: 0xB99A6B,
        rack: 0x5F666C, bins: [0xC4622E, 0x3E7EA8], crateOpen: false, shelfItems: false,
        light: { key: 0xF2F5F8, hemi: 0x7A8087, sky: ['#AEB6BC', '#848C93'], fog: ['#98A0A6', 1.3, 3.8] },
      },
    },
    fruit: {
      label: '과일 공장', make: mkFruitItem,
      kinds: { apple: { label: '사과' }, orange: { label: '오렌지' },
               banana: { label: '바나나' }, grape: { label: '포도' } },
      deco: {
        top: 'wood', leg: 0x6B4A2A, floor: 0xB8A98C, wall: 0xD8CDB4,
        belt: ['#3D6B44', '#4E8351', '#2C4E33'], rail: 0xCFC3A6, fence: 0xE2D8BE,
        haz: ['#E0C23C', '#4E7A34'], deck: 0xA8834F, crate: 0xC09A5E,
        rack: 0x8A6B3E, bins: [0x4E8B3A, 0xE08A2B], crateOpen: true, shelfItems: true,
        light: { key: 0xFFF6E2, hemi: 0x9A8F76, sky: ['#D9CFB4', '#B6A98A'], fog: ['#C6BA9E', 1.4, 4.0] },
      },
    },
    drink: {
      label: '음료 공장', make: mkDrinkItem,
      kinds: { can: { label: '캔' }, bottle: { label: '페트병' },
               carton: { label: '우유팩' }, cup: { label: '컵' } },
      deco: {
        top: 'laminate', leg: 0x33607E, floor: 0x8FA6B4, wall: 0xB6C8D2,
        belt: ['#24506B', '#33698A', '#1A3C50'], rail: 0xC8D4DC, fence: 0xD2DDE4,
        haz: ['#5FC8E0', '#1A3C50'], deck: 0x7E8A92, crate: 0xE2E8EC,
        rack: 0x4E6B7E, bins: [0x3E7EA8, 0xE8EEF2], crateOpen: false, shelfItems: true,
        light: { key: 0xF2FAFF, hemi: 0x7E8E99, sky: ['#BCCEDA', '#8FA3B2'], fog: ['#A6B8C4', 1.3, 3.8] },
      },
    },
    snack: {
      label: '과자 공장', make: mkSnackItem,
      kinds: { bag: { label: '봉지 과자' }, stick: { label: '막대 과자' },
               donut: { label: '도넛' }, cookie: { label: '쿠키' } },
      deco: {
        top: 'laminate', leg: 0x8E5A34, floor: 0xD6BE9E, wall: 0xE8D8C0,
        belt: ['#6B4326', '#8A5A34', '#4E2F1A'], rail: 0xE0C9A8, fence: 0xEEDCC2,
        haz: ['#E86A8C', '#6B4326'], deck: 0xB08A56, crate: 0xC98A4B,
        rack: 0xA8703E, bins: [0xE08A2B, 0xE86A8C], crateOpen: true, shelfItems: true,
        light: { key: 0xFFF2E0, hemi: 0xA08C74, sky: ['#E0CDB2', '#BFA98C'], fog: ['#CDB99C', 1.4, 4.0] },
      },
    },
    part: {
      label: '부품 공장', make: mkPartItem,
      kinds: { bolt: { label: '볼트' }, nut: { label: '너트' },
               gear: { label: '기어' }, spring: { label: '스프링' } },
      deco: {
        top: 'steel', leg: 0x2E3338, floor: 0x5A6066, wall: 0x74797E,
        belt: ['#1E2226', '#2E3338', '#141719'], rail: 0x7E868D, fence: 0x8A9298,
        haz: ['#E0801C', '#141719'], deck: 0x5A6066, crate: 0x8A9298,
        rack: 0x3E444A, bins: [0xC4622E, 0x9AA1A8], crateOpen: false, shelfItems: false,
        light: { key: 0xE8EEF2, hemi: 0x6A7076, sky: ['#98A0A6', '#70777D'], fog: ['#848C92', 1.2, 3.6] },
      },
    },
  };

  let activeLine = 'box';
  function KINDSOF() { return LINES[activeLine].kinds; }

  function mkItem(kind) {
    const L = LINES[activeLine];
    const g = L.make(LINES[activeLine].kinds[kind] ? kind : Object.keys(L.kinds)[0]);
    g.userData.kind = kind;
    // 실제 라인도 물건이 반듯하게만 올라오지는 않는다.
    // 시작 각도와 이동 중 돌아가는 양을 물건마다 다르게 줘서
    // 판정 구역에 설 때의 각도가 매번 조금씩 달라지게 한다.
    g.rotation.y = (Math.random() - 0.5) * 0.80;      // ±23°
    g.userData.spin = (Math.random() - 0.5) * 0.55;   // 한 칸 오는 동안 ±16°
    return g;
  }

  // 물건만 다시 깔기. 무대(테이블·벨트·소품)는 그대로 두므로 setTheme 이 필요 없다.
  //   개발툴 = 여러 개가 흐름 / 분류툴 = 한 개를 세워 둠
  function refillItems() {
    if (!line) return;
    items.forEach(function (it) { line.remove(it); });
    items = [];
    if (flowing) {
      // 사진 한 장에 물건 하나만 담겨야 판정이 성립하므로 간격을 넓게 띄운다
      for (let i = 0; i < FLOW_COUNT; i++) {
        const it = mkItem(pickKind());
        it.position.set(slotX(i), 0, 0);
        items.push(it);
        line.add(it);
      }
    } else {
      items.push(mkItem(single));
      line.add(items[0]);
    }
    phase = 'stop'; phaseT = 0;
  }

  // 다리 길이는 벨트 높이에 따라 달라지므로 정렬할 때 다시 계산한다
  function align(topY) {
    if (!line) return;
    line.position.y = topY;
    const h = Math.max(0.02, topY - 0.026);
    legs.forEach(function (l) {
      l.scale.y = h / LEG_H0;
      l.position.y = -0.026 - h / 2;
    });
  }

  function build() {
    const G = new THREE.Group();
    // 작업대와 같은 뼈대 (스틸 상판 · 짙은 프레임)
    const D = LINES[activeLine].deco;
    const T = buildTable(G, 1.60, 0.86, 0.78,
      D.top === 'wood' ? texWoodTop(146, 112, 74, 30)
        : D.top === 'laminate' ? texLaminate() : texSteel(),
      D.leg, D.floor, D.wall);

    // ── 작업대 하부 (공장 작업대처럼) ──
    const H = 0.78, W = 1.60 * STAGE_SCALE, TD = 0.86 * STAGE_SCALE;   // TD = 상판 깊이
    const barMat = new THREE.MeshPhongMaterial({ color: 0x3A4045, shininess: 18 });

    // 다리를 잇는 보강 바 (앞뒤 · 좌우)
    [-1, 1].forEach(function (sz) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(W - 0.20, 0.026, 0.026), barMat);
      b.position.set(0, -H + 0.16, sz * (TD / 2 - 0.07));
      T.add(b);
    });
    [-1, 1].forEach(function (sx) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, TD - 0.20), barMat);
      b.position.set(sx * (W / 2 - 0.07), -H + 0.16, 0);
      T.add(b);
    });

    // 하부 선반 + 자재 상자
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.20, 0.018, TD - 0.22),
      new THREE.MeshPhongMaterial({ color: 0x6E757B, shininess: 10 })
    );
    shelf.position.y = -H + 0.19;
    shelf.receiveShadow = true;
    T.add(shelf);

    [[-0.42, 0x3E7EA8], [-0.16, 0xC4622E], [0.38, 0x3E7EA8]].forEach(function (b) {
      const bin = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.13, 0.30),
        new THREE.MeshPhongMaterial({ color: b[1], shininess: 12 })
      );
      bin.position.set(b[0], -H + 0.265, -0.02);
      bin.castShadow = true;
      T.add(bin);
    });

    // 상판 안전 빗금 띠 (벨트 앞뒤로 한 줄씩)
    hazards = [];
    [-1, 1].forEach(function (s) {
      const hz = new THREE.Mesh(
        new THREE.PlaneGeometry(1.34, 0.032),
        new THREE.MeshPhongMaterial({
          map: texHazard(D.haz[0], D.haz[1]), shininess: 2 })
      );
      hz.rotation.x = -Math.PI / 2;
      hz.position.set(0, 0.0012, BELT_Z * STAGE_SCALE + s * HAZ_GAP);
      hz.userData.hazSide = s;
      hazards.push(hz);
      T.add(hz);
    });

    // ── 컨베이어 (벨트 윗면이 y=0 인 그룹) ──
    line = new THREE.Group();
    line.position.set(0, BELT_TOP, BELT_Z);
    legs = [];

    beltMat = new THREE.MeshPhongMaterial({
      map: texBelt(D.belt[0], D.belt[1], D.belt[2]), shininess: 12 });
    const belt = new THREE.Mesh(new THREE.BoxGeometry(BELT_L, 0.026, BELT_W), beltMat);
    belt.position.y = -0.013;
    belt.receiveShadow = true;
    line.add(belt);

    [-1, 1].forEach(function (s) {          // 가드레일
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(BELT_L, 0.024, 0.008),
        M(D.rail, 30)
      );
      rail.position.set(0, 0.005, s * (BELT_W / 2 + 0.004));
      rail.castShadow = true;
      line.add(rail);
    });

    [-1, 1].forEach(function (s) {          // 양끝 롤러
      const r = new THREE.Mesh(
        new THREE.CylinderGeometry(0.019, 0.019, BELT_W, 20),
        M(D.rail, 40)
      );
      r.rotation.x = Math.PI / 2;
      r.position.set(s * BELT_L / 2, -0.013, 0);
      line.add(r);
    });

    [-0.40, 0, 0.40].forEach(function (x) { // 다리
      const l = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.009, LEG_H0, 12),
        new THREE.MeshPhongMaterial({ color: 0x6E747A, shininess: 20 })
      );
      l.position.x = x;
      line.add(l);
      legs.push(l);
    });

    // 판정 구역 (파이보 정면)
    const zone = new THREE.Mesh(
      new THREE.PlaneGeometry(0.17, 0.17),
      new THREE.MeshBasicMaterial({
        map: texZone(), transparent: true, depthWrite: false })
    );
    zone.rotation.x = -Math.PI / 2;
    zone.position.y = 0.0016;
    line.add(zone);

    refillItems();

    line.userData.prop = true;
    T.add(line);

    // ── 제어반 (좌측) ──
    const ctl = new THREE.Group();
    ctl.position.set(-0.60, 0, BELT_Z - 0.13);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.11, 0.08),
      M(D.rack, 25)
    );
    cab.position.y = 0.055; cab.castShadow = true;
    ctl.add(cab);
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.055, 0.002),
      new THREE.MeshPhongMaterial({ color: 0x1E2226, shininess: 60 })
    );
    panel.position.set(0, 0.068, 0.041);
    ctl.add(panel);
    const estop = new THREE.Mesh(                  // 비상정지 버튼
      new THREE.CylinderGeometry(0.013, 0.013, 0.006, 16),
      new THREE.MeshPhongMaterial({ color: 0xD8323C, shininess: 60 })
    );
    estop.position.set(0.045, 0.024, 0.041);
    estop.rotation.x = Math.PI / 2;
    ctl.add(estop);
    ctl.userData.prop = true;
    ctlGrp = ctl;
    T.add(ctl);

    // ── 신호탑 (적·황·녹) ──
    const twr = new THREE.Group();
    twr.position.set(0.60, 0, BELT_Z - 0.13);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.020, 0.010, 14),
      new THREE.MeshPhongMaterial({ color: 0x5A6066 })
    );
    base.position.y = 0.005; twr.add(base);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.055, 10),
      new THREE.MeshPhongMaterial({ color: 0x6E747A })
    );
    pole.position.y = 0.0375; twr.add(pole);

    lamps = [];
    [[0xD8323C, 0.098], [0xE0B33C, 0.077], [0x4FBF6A, 0.056]].forEach(function (p) {
      const m = new THREE.MeshPhongMaterial({
        color: p[0], emissive: p[0], emissiveIntensity: 0.25, shininess: 50,
      });
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.019, 16), m);
      lamp.position.y = p[1];
      twr.add(lamp);
      lamps.push(m);
    });
    twr.userData.prop = true;
    twrGrp = twr;
    T.add(twr);

    // ── 배경 소품 (벨트 건너편) ──
    // 공장마다 다르게 꾸민다. 파이보 시야에 늘 함께 찍히지만
    // 한 공장 안에서는 어느 물건이든 배경이 같으므로 학습에는 방해가 되지 않는다.
    const far = BELT_Z + 0.26;

    // 안전 펜스 — 공장 색의 가로 바 2단
    const fence = new THREE.Group();
    fence.position.set(0, 0, far);
    const fm = M(D.fence, 40);
    [0.055, 0.105].forEach(function (y) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.30, 10), fm);
      bar.rotation.z = Math.PI / 2;
      bar.position.y = y;
      fence.add(bar);
    });
    [-0.62, -0.21, 0.21, 0.62].forEach(function (x) {
      put(fence, new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.125, 10), fm), x, 0.0625);
    });
    fence.userData.prop = true;
    T.add(fence);

    // 좌측 — 적재대. 상자 위에 그 공장 물건을 몇 개 얹어 둔다.
    const pal = new THREE.Group();
    pal.position.set(-0.44, 0, far - 0.11);
    put(pal, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.014, 0.17), M(D.deck, 4)), 0, 0.007);
    if (D.crateOpen) {
      // 나무 상자(과일·과자) — 옆판만 두르고 안에 물건을 담는다
      const cw = 0.19, cd = 0.15, ch = 0.05;
      [[0, 0, -cd / 2], [0, 0, cd / 2]].forEach(function (p) {
        put(pal, new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 0.006), M(D.crate, 5)), p[0], 0.014 + ch / 2, p[2]);
      });
      [[-cw / 2, 0, 0], [cw / 2, 0, 0]].forEach(function (p) {
        put(pal, new THREE.Mesh(new THREE.BoxGeometry(0.006, ch, cd), M(D.crate, 5)), p[0], 0.014 + ch / 2, p[2]);
      });
      const ks = Object.keys(LINES[activeLine].kinds);
      [[-0.05, -0.03], [0.02, 0.02], [0.055, -0.035], [-0.02, 0.035]].forEach(function (p, i) {
        const it = LINES[activeLine].make(ks[i % ks.length]);
        it.position.set(p[0], 0.020, p[1]);
        it.rotation.y = i * 1.3;
        it.scale.setScalar(0.8);
        pal.add(it);
      });
    } else {
      // 골판지 상자 더미(박스·음료·부품)
      [[-0.06, 0.05, 0.055], [0.05, 0.05, 0.10], [-0.01, 0.10, 0.045]].forEach(function (b) {
        const box = put(pal, new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.058, 0.075), M(D.crate, 6)),
          b[0], 0.014 + b[1] - 0.021, b[2] - 0.06);
        box.rotation.y = (b[0] + b[2]) * 2.4;
      });
    }
    pal.userData.prop = true;
    T.add(pal);

    // 우측 — 선반. 공장에 따라 진열대(음료·과자) 또는 부품 랙이 된다.
    const rack = new THREE.Group();
    rack.position.set(0.46, 0, far - 0.10);
    const frame = M(D.rack, 20);
    [-0.11, 0.11].forEach(function (x) {
      [-0.06, 0.06].forEach(function (z) {
        put(rack, new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.16, 0.009), frame), x, 0.08, z);
      });
    });
    [0.055, 0.13].forEach(function (y, k) {
      const sh = put(rack, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.007, 0.14), frame), 0, y);
      sh.receiveShadow = true;
      const ks = Object.keys(LINES[activeLine].kinds);
      [-0.07, 0.0, 0.07].forEach(function (x, j) {
        if (D.shelfItems) {
          // 진열대 — 선반 위에 물건을 세워 둔다
          if ((j + k) % 4 === 3) return;
          const it = LINES[activeLine].make(ks[(j + k * 2) % ks.length]);
          it.position.set(x, y + 0.004, 0);
          it.rotation.y = (j + k) * 0.9;
          it.scale.setScalar(0.72);
          rack.add(it);
        } else {
          const bin = put(rack, new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.036, 0.10),
            M(D.bins[(j + k) % D.bins.length], 12)), x, y + 0.021);
          if ((j + k) % 3 === 0) bin.visible = false;   // 빈 칸도 섞어 둔다
        }
      });
    });
    rack.userData.prop = true;
    T.add(rack);

    applyStageScale(T);
    aligned = false;

    G.userData.light = {
      key: D.light.key, keyI: 0.62, amb: 0.34, hemi: 0.22, hemiG: D.light.hemi,
      sky: D.light.sky, keyPos: [0.9, 1.6, 1.0], fog: D.light.fog,
    };
    G.userData.factory = true;
    return G;
  }

  // 공장 5종을 각각 배경으로 등록한다. 무대는 같고 물건만 다르다.
  Object.keys(LINES).forEach(function (k) {
    THEMES['factory_' + k] = {
      label: PIBO_T(LINES[k].label),
      build: function () { activeLine = k; return build(); },
    };
  });

  // ── 애니메이션 ──
  // 배경이 바뀌면 themeGroup 이 통째로 교체되므로 살아 있는지 매 프레임 확인한다.
  let last = performance.now();
  const v = new THREE.Vector3();
  (function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (typeof themeGroup === 'undefined') return;
    const on = !!(themeGroup && themeGroup.userData.factory);
    if (on !== uiShown) { uiShown = on; syncUI(); }
    // 로봇을 다시 불러오면 물리가 저절로 켜지므로 계속 확인한다
    if (on && typeof PHYS !== 'undefined' && PHYS.on) applyPhysics(true);
    if (!on || !line || !line.parent) return;

    // 로봇이 로드되면 몸통 OLED 높이에 벨트 윗면을 맞춘다 (기본값은 어림값)
    if (!aligned) {
      align(BELT_TOP);
      if (typeof lcdMesh !== 'undefined' && lcdMesh) {
        lcdMesh.getWorldPosition(v);
        if (v.y > 0.03 && v.y < 0.4) align(v.y + BELT_RAISE);
        aligned = true;
      }
    }

    if (!flowing && items.length) {
      // 분류툴 촬영 모드. 자동 변화 = 회전. 켜면 계속 돌아 여러 각도가 모이고, 끄면 정면으로 고정된다.
      // 위치는 흔들지 않는다 — 개발툴에서 판정할 때는 항상 판정 구역 정중앙에 서기 때문이다.
      const it = items[0];
      const t = now / 1000;
      it.rotation.y = vary ? t * 0.55 : 0;
      it.rotation.z = 0;
      it.position.x = poseBase.x;
      it.position.z = poseBase.z;
      it.scale.setScalar(poseBase.s);
    }

    if (flowing) {
      phaseT += dt;
      const gap = slotGap();                    // 물건 간격 = 한 칸

      if (phase === 'stop') {
        if (phaseT >= STOP_T) {
          phase = 'move'; phaseT = 0;
          // 각자의 출발 위치를 기록해 둔다.
          // 되돌아온 물건이 있어 배열 순서와 실제 순서가 어긋날 수 있으므로
          // 인덱스로 위치를 계산하면 안 되고, 저마다 한 칸씩 밀어야 한다.
          moveFrom = items.map(function (it) { return it.position.x; });
          moveYaw = items.map(function (it) { return it.rotation.y; });
        }
      } else {
        // 급출발·급정지 대신 부드럽게 (실제 인덱싱도 가감속을 준다)
        const t = Math.min(1, phaseT / MOVE_T);
        const e = t * t * (3 - 2 * t);
        items.forEach(function (it, i) {
          it.position.x = moveFrom[i] + gap * e;
          it.rotation.y = moveYaw[i] + it.userData.spin * e;
        });

        if (beltMat && beltMat.map) beltMat.map.offset.y -= (gap / MOVE_T * dt) / (BELT_W * 2);

        if (t >= 1) {
          phase = 'stop'; phaseT = 0;
          const half = SPAN / 2;
          items.forEach(function (it, i) {
            // 소수점 오차가 쌓이면 조금씩 어긋나므로 칸 위치에 딱 맞춰 준다
            let x = Math.round(it.position.x / gap) * gap;
            if (x <= half - ITEM_MARGIN) { it.position.x = x; return; }
            // 끝까지 간 물건은 뒤로 돌려보내고 종류를 새로 뽑는다
            const rep = mkItem(pickKind());
            rep.position.set(x - FLOW_COUNT * gap, 0, 0);
            line.remove(it);
            line.add(rep);
            items[i] = rep;
          });
        }
      }

      // 정지 중에는 노랑(검사 중), 이동 중에는 초록(가동)
      if (lamps.length) {
        lamps[1].emissiveIntensity = phase === 'stop' ? 0.85 : 0.15;
        lamps[2].emissiveIntensity = phase === 'stop' ? 0.15 : 0.85;
      }
    }

  })(last);

  // ── 값 바꾸기 (다시 그리지 않고 그 자리에서 반영) ──
  function setBeltZ(worldZ) {
    BELT_Z = worldZ / STAGE_SCALE;
    if (!line) return;
    line.position.z = BELT_Z * STAGE_SCALE;
    hazards.forEach(function (h) {
      h.position.z = BELT_Z * STAGE_SCALE + h.userData.hazSide * HAZ_GAP;
    });
    if (ctlGrp) ctlGrp.position.z = (BELT_Z - 0.13) * STAGE_SCALE;
    if (twrGrp) twrGrp.position.z = (BELT_Z - 0.13) * STAGE_SCALE;
  }

  // 개수는 있는 것을 지우거나 새로 넣어 맞춘다. 위치는 균등하게 다시 배치.
  function setCount(n) {
    FLOW_COUNT = Math.max(1, Math.min(8, Math.round(n)));
    if (!line || !flowing) return;
    while (items.length > FLOW_COUNT) line.remove(items.pop());
    while (items.length < FLOW_COUNT) {
      const it = mkItem(pickKind());
      items.push(it);
      line.add(it);
    }
    items.forEach(function (it, i) { it.position.x = slotX(i); });
    phase = 'stop'; phaseT = 0;
  }

  function setStopT(v) { STOP_T = Math.max(0.5, Math.min(10, Math.round(v * 10) / 10)); }
  // 이동 시간은 0.1초까지 줄일 수 있다 (거의 순간 이송)
  function setMoveT(v) { MOVE_T = Math.max(0.1, Math.min(5, Math.round(v * 10) / 10)); }

  // ── 조절 패널 (공장 라인일 때만 보인다) ──

  function row(body, label, get, set, step, fmt) {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:4px;width:192px';

    const cap = document.createElement('span');
    cap.textContent = label;
    cap.style.cssText = 'flex:1;font-size:10px;color:var(--ink2,#5C6E79);font-weight:600';

    const val = document.createElement('span');
    val.style.cssText = 'min-width:46px;text-align:right;font-size:10px;font-weight:700;' +
      'color:var(--ink,#12232B);font-variant-numeric:tabular-nums';

    function mkBtn(txt, d) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = 'width:18px;height:18px;flex-shrink:0;border:1px solid var(--line,#DDE6EA);' +
        'background:var(--panel2,#F2F7F9);border-radius:4px;font-family:inherit;font-size:11px;' +
        'font-weight:700;line-height:1;padding:0;cursor:pointer;color:var(--ink,#12232B)';
      b.type = 'button';
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        set(get() + d);
        refresh();
      });
      return b;
    }

    r.appendChild(cap); r.appendChild(mkBtn('−', -step));
    r.appendChild(val); r.appendChild(mkBtn('+', step));
    body.appendChild(r);
    uiRows[label] = function () { val.textContent = fmt(get()); };
  }

  function refresh() {
    Object.keys(uiRows).forEach(function (k) { uiRows[k](); });
  }

  function mountUI() {
    if (typeof PiboPanels === 'undefined') return;
    if (ui && ui.parentNode) return;
    // 패널이 두 번 만들어지면 버튼도 두 벌이 되어 한 번 눌러도 두 칸씩 움직인다.
    // 남아 있는 것이 있으면 지우고 새로 만든다.
    const old = document.getElementById('factoryPanel');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const p = PiboPanels.make('factory', PIBO_T(LINES[activeLine].label));
    if (!p) return;
    ui = p.box;
    ui.id = 'factoryPanel';
    uiCap = p.caption;
    uiRows = {};
    row(p.body, PIBO_T('물건 수'), function () { return FLOW_COUNT; }, setCount, 1,
      function (v) { return v + PIBO_T('개'); });
    row(p.body, PIBO_T('정지 시간'), function () { return STOP_T; }, setStopT, 0.5,
      function (v) { return v.toFixed(1) + 's'; });
    row(p.body, PIBO_T('이동 시간'), function () { return MOVE_T; }, setMoveT, 0.1,
      function (v) { return v.toFixed(1) + 's'; });
    row(p.body, PIBO_T('벨트 거리'), function () { return BELT_Z * STAGE_SCALE; }, setBeltZ, 0.01,
      function (v) { return (v * 100).toFixed(0) + ' cm'; });
    refresh();
  }

  function syncUI() {
    const on = !!(themeGroup && themeGroup.userData.factory);
    if (on) { mountUI(); if (uiCap) uiCap.textContent = PIBO_T(LINES[activeLine].label); }
    if (ui) { ui.style.display = on ? '' : 'none'; if (on) refresh(); }
    applyPhysics(on);
  }

  // 공장 라인은 서서 검사만 하는 장면이라 물리가 할 일이 없다.
  // 물리를 켜두면 머리를 돌릴 때 반작용으로 몸통이 조금씩 돌아가서,
  // 같은 물건을 찍어도 각도가 달라져 학습 데이터가 흔들린다.
  let physWas = null;
  function applyPhysics(on) {
    if (typeof PHYS === 'undefined' || !PHYS.ready) return;
    if (on) {
      if (physWas === null) physWas = PHYS.on;      // 들어오기 전 상태를 기억
      if (PHYS.on) { if (typeof PHYS_AUTO !== 'undefined') PHYS_AUTO = false; PHYS.disable(); }
    } else if (physWas !== null) {
      if (physWas && !PHYS.on) { if (typeof PHYS_AUTO !== 'undefined') PHYS_AUTO = true; PHYS.enable(); }
      physWas = null;
    }
  }

  // ── 외부 API ──
  // 분류툴: FactoryLine.stage('good')  → 벨트 정지, 그 물건 하나만 정면에
  // 개발툴: FactoryLine.flow()         → 여러 물건이 흘러감 (기본)
  window.FactoryLine = {
    // 공장 목록·전환
    lines: function () {
      return Object.keys(LINES).map(function (k) { return { key: k, label: LINES[k].label }; });
    },
    // 공장이 바뀔 때만 무대를 다시 만든다 (색·소품이 달라지므로 이때는 불가피하다).
    // 다만 지금 배경이 공장이 아니면(예: 분류툴 첫 진입) 같은 공장이어도 만들어야 한다.
    line: function (k) {
      if (k == null) return activeLine;
      if (!LINES[k]) return activeLine;
      const onFactory = !!(typeof themeGroup !== 'undefined' && themeGroup && themeGroup.userData.factory);
      if (k === activeLine && onFactory) return activeLine;
      if (k !== activeLine) single = Object.keys(LINES[k].kinds)[0];
      activeLine = k;
      if (typeof setTheme === 'function') setTheme('factory_' + k);
      return activeLine;
    },
    get kinds() { return KINDSOF(); },
    beltZ: function (v) {
      if (v == null) return +(BELT_Z * STAGE_SCALE).toFixed(3);
      setBeltZ(Number(v)); refresh();
      return +(BELT_Z * STAGE_SCALE).toFixed(3);
    },
    count: function (v) { if (v == null) return FLOW_COUNT; setCount(v); refresh(); return FLOW_COUNT; },
    stopTime: function (v) { if (v == null) return STOP_T; setStopT(Number(v)); refresh(); return STOP_T; },
    moveTime: function (v) { if (v == null) return MOVE_T; setMoveT(Number(v)); refresh(); return MOVE_T; },
    // 물건만 바뀌므로 무대는 그대로 두고 물건만 갈아 끼운다 (씬을 다시 만들면 눈에 띄게 느리다)
    stage: function (kind) {
      single = KINDSOF()[kind] ? kind : Object.keys(KINDSOF())[0];
      flowing = false;
      refillItems();
    },
    flow: function () { flowing = true; refillItems(); },
    // 촬영 변화 — 자동 흔들기 on/off 와 기준 위치·크기
    vary: function (on) { if (on == null) return vary; vary = !!on; return vary; },
    pose: function (k, v) {
      if (v == null) return poseBase[k];
      if (k === 's') poseBase.s = Math.max(0.5, Math.min(2, v));
      else poseBase[k] = Math.max(-0.18, Math.min(0.18, v));
      return poseBase[k];
    },
    isFlowing: function () { return flowing; },
  };

  // ── 배경 목록 재구성 ──
  // 무대가 늘어 목록이 길어졌다. '일반 / 공장' 으로 묶고, 안 쓰는 무대는 뺀다.
  const DROP = ['space', 'plain'];
  DROP.forEach(function (k) { delete THEMES[k]; });

  document.addEventListener('DOMContentLoaded', function () {
    ['themeSel', 'themePick'].forEach(function (id) {
      const sel = document.getElementById(id);
      if (!sel || sel.dataset.grouped) return;

      const cur = sel.value;
      // 체험툴은 '배경: 책상' 처럼 접두사를 쓰는데, 묶고 나면 필요 없다
      const keep = Array.prototype.slice.call(sel.options)
        .filter(function (o) { return DROP.indexOf(o.value) < 0; });

      sel.innerHTML = '';
      const g1 = document.createElement('optgroup');
      g1.label = PIBO_T('일반');
      keep.forEach(function (o) {
        o.textContent = o.textContent.replace(/^(배경|Scene):\s*/, '');
        g1.appendChild(o);
      });
      sel.appendChild(g1);

      const g2 = document.createElement('optgroup');
      g2.label = PIBO_T('공장');
      Object.keys(LINES).forEach(function (k) {
        const o = document.createElement('option');
        o.value = 'factory_' + k;
        o.textContent = PIBO_T(LINES[k].label);
        g2.appendChild(o);
      });
      sel.appendChild(g2);

      sel.dataset.grouped = '1';
      if (cur && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur;
    });
  });
})();
