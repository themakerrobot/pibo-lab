// ═══════════════════════════════════════════════════════════
// 게임 실행 — Blockly → JS → JS-Interpreter
// ═══════════════════════════════════════════════════════════
// blockly_run.js(개발툴)와 완전히 분리.
// JS-Interpreter 에는 호스트에서 인터프리터 함수를 부르는 API 가 없어서,
// 이벤트 처리를 인터프리터 '안'에서 돌린다:
//   __H     : 이벤트 이름 → 함수 (이벤트 블록이 채운다)
//   __pump  : 큐에서 하나 꺼내 실행
//   끝 루프 : 반복 블록이 없어도 이벤트만으로 게임이 돌아가게

let gameRunning = false;
let gameInterp = null;
let gameHighlighted = null;
const gameKeys = {};
const gameQueue = [];
let gameT0 = 0;                       // 게임 시작 시각 (performance.now)
const gElapsed = () => gameT0 ? (performance.now() - gameT0) / 1000 : 0;
const gFmtTime = sec => {
  const m = Math.floor(sec / 60), s2 = sec - m * 60;
  return m > 0 ? m + '분 ' + s2.toFixed(1) + '초' : s2.toFixed(1) + '초';
};

// ── HUD 시간 표시 (game.html 수정 없이 여기서 붙인다) ──
(function () {
  const hud = document.getElementById('gHud');
  if (!hud || document.getElementById('gTime')) return;
  const sp = document.createElement('span');
  sp.innerHTML = '<span class="lb">시간</span><b id="gTime">0:00</b>';
  hud.appendChild(sp);
  setInterval(() => {
    const el = document.getElementById('gTime');
    if (!el) return;
    if (!gameRunning) return;                 // 멈추면 마지막 기록 유지
    const t = gElapsed(), m = Math.floor(t / 60), s2 = Math.floor(t % 60);
    el.textContent = m + ':' + String(s2).padStart(2, '0');
  }, 250);
})();

// ── 브라우저 TTS (개발툴 blockly_run.js 와 같은 방식·같은 목소리) ──
if (window.speechSynthesis) speechSynthesis.getVoices();
function gSpeakAsync(text) {
  return new Promise(res => {
    if (!window.speechSynthesis) { gLog('(브라우저가 TTS 를 지원하지 않음)', 'warn'); return res(); }
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'ko-KR';
    const ko = speechSynthesis.getVoices().find(v => /ko/i.test(v.lang));
    if (ko) u.voice = ko;
    u.onend = u.onerror = () => res();
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
}

// ── 걷기 ──────────────────────────────────────────────────
// 개발툴과 동일: 모션만 재생하고 이동·방향은 전부 물리가 결정한다.
//   '앞으로 N' = forward1 을 N번 (한 걸음 실측 약 49mm)
//   '~도 돌기' = left/right 를 필요한 횟수 (1회 실측 약 33도)
// 실물처럼 걸음마다 방향이 조금 휜다. 물리 OFF 일 때만 근사 이동을 쓴다.
const STEP_M       = 0.049;  // 물리 OFF 근사 이동 · 벽 검사 거리
const TURN_PER_REP = 33;     // 도는 모션 1회 = 약 33도 (실측)
const GAIT_PUSH = [[0.25, 0.50], [0.62, 0.88]];   // 물리 OFF 전진 구간

function gLog(msg, cls) {
  const el = document.getElementById('gConsole');
  if (!el) return;
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}
function gClearLog() { const el = document.getElementById('gConsole'); if (el) el.innerHTML = ''; }

// ── 키 입력 ──
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
window.addEventListener('keydown', e => {
  const k = e.code === 'Space' ? 'Space' : e.key;
  if (!GAME_KEYS.includes(k)) return;
  if (gameRunning) e.preventDefault();
  if (!gameKeys[k] && gameRunning) gameQueue.push('key:' + k);
  gameKeys[k] = true;
});
window.addEventListener('keyup', e => {
  const k = e.code === 'Space' ? 'Space' : e.key;
  gameKeys[k] = false;
});

// ── 게임 엔진 이벤트 → 큐 ──
Game.on('item', kind => gameQueue.push('evt:' + kind));
['goal', 'fall', 'fallOff'].forEach(evt => Game.on(evt, () => gameQueue.push('evt:' + evt)));

// ═══════════════════════════════════════════════════════════
// 걷기 / 돌기
// ═══════════════════════════════════════════════════════════
const gSmooth = x => x * x * (3 - 2 * x);
const gClamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);

// 한 걸음 — 모션 재생이 전부다. 물리가 걷는다.
function gStepOnce(dir) {
  const name = dir >= 0 ? 'forward1' : 'backward1';
  if (Game.physOn()) return Pibo.playMotion(name, 1).catch(() => {});
  return gStepKinematic(name, dir);        // 물리 OFF 근사
}

// 물리 OFF: 모션을 재생하며 다리가 나가는 구간에만 몸을 전진
function gStepKinematic(name, dir) {
  const rad = Game.heading * Math.PI / 180;
  const p = Game.robotXZ();
  const tx = p.x + Math.sin(rad) * STEP_M * dir;
  const tz = p.z + Math.cos(rad) * STEP_M * dir;
  return Promise.resolve()
    .then(() => loadMotionByName(name)).catch(() => null)
    .then(kfs => new Promise(resolve => {
      const dur = (kfs && kfs.length ? kfs[kfs.length - 1].t : 1.0) * 1000;
      const t0 = performance.now();
      Pibo.playMotion(name, 1).catch(() => {});
      const share = 1 / GAIT_PUSH.length;
      const step = now => {
        if (!gameRunning) { Game.moveRobotTo(tx, tz); return resolve(); }
        const a = Math.min(1, (now - t0) / dur);
        let e = 0;
        for (let i = 0; i < GAIT_PUSH.length; i++)
          e += share * gSmooth(gClamp01((a - GAIT_PUSH[i][0]) / (GAIT_PUSH[i][1] - GAIT_PUSH[i][0])));
        Game.moveRobotTo(p.x + (tx - p.x) * e, p.z + (tz - p.z) * e);
        if (a < 1) requestAnimationFrame(step);
        else { Game.moveRobotTo(tx, tz); resolve(); }
      };
      requestAnimationFrame(step);
    }));
}

// 돌기 — N회면 도는 모션 N번. right = 화면 기준 오른쪽(방향각 감소).
function gTurnBy(n) {
  const dir = n >= 0 ? 1 : -1;             // +1 = 오른쪽
  const reps = Math.max(1, Math.round(Math.abs(n)));
  const name = dir >= 0 ? 'right' : 'left';
  if (Game.physOn()) return Pibo.playMotion(name, reps).catch(() => {});
  // 물리 OFF: 모션 시간에 맞춰 방향값을 1회당 TURN_PER_REP 도씩 돌린다
  return Promise.resolve()
    .then(() => loadMotionByName(name)).catch(() => null)
    .then(kfs => {
      const sec = kfs && kfs.length ? kfs[kfs.length - 1].t : 1.0;
      const total = sec * reps * 1000, t0 = performance.now();
      const from = Game.heading, hsign = -dir, abs = TURN_PER_REP * reps;
      const ramp = () => {
        if (!gameRunning) return;
        const a = Math.min(1, (performance.now() - t0) / total);
        Game.setHeading(from + hsign * abs * gSmooth(a));
        if (a < 1) requestAnimationFrame(ramp);
      };
      requestAnimationFrame(ramp);
      return Pibo.playMotion(name, reps).catch(() => {});
    });
}

// 다음 걸음 자리에 벽이 있는지 — 실제 바라보는 방향 기준
function gWallAhead(dir) {
  const rad = Game.facing() * Math.PI / 180;
  const p = Game.robotXZ();
  return Game.hitWall({ x: p.x + Math.sin(rad) * STEP_M * dir, z: p.z + Math.cos(rad) * STEP_M * dir });
}

// ── 인터프리터에 노출할 함수 ──
function buildGameApi(interp, scope) {
  const set = (n, f) => interp.setProperty(scope, n, interp.createNativeFunction(f));
  const setAsync = (n, f) => interp.setProperty(scope, n, interp.createAsyncFunction(f));
  const nat = v => (v && typeof v === 'object' && v.properties !== undefined)
    ? interp.pseudoToNative(v) : v;

  set('highlightBlock', id => {
    if (gameHighlighted) gameWorkspace.highlightBlock(null);
    gameHighlighted = id;
    if (id) gameWorkspace.highlightBlock(id);
  });

  set('gRunning', () => gameRunning);
  // 큐에서 이벤트 이름을 하나 꺼낸다 (없으면 빈 문자열)
  set('gPoll', () => (gameQueue.length ? gameQueue.shift() : ''));

  // ── 이동 : N 이면 N 걸음 ──
  setAsync('gMove', (n, cb) => {
    const cells = Math.round(Number(nat(n)) || 0);
    const dir = cells >= 0 ? 1 : -1;
    const steps = Math.abs(cells);
    let i = 0;
    const next = () => {
      if (i >= steps || !gameRunning) return cb();
      if (gWallAhead(dir)) { Game.say('벽에 막혔어요'); return cb(); }
      i++;
      gStepOnce(dir).then(next);
    };
    next();
  });

  // ── 회전 : N회면 도는 모션 N번 ──
  setAsync('gTurn', (n, cb) => {
    gTurnBy(Number(nat(n)) || 0).then(() => cb());
  });

  set('gGoto', (x, z) => Game.moveRobotTo(Number(nat(x)) || 0, Number(nat(z)) || 0));
  setAsync('gMotion', (name, cb) => {
    Pibo.playMotion(String(nat(name)), 1).then(() => cb()).catch(() => cb());
  });
  setAsync('gWait', (sec, cb) => setTimeout(cb, Math.max(0, Number(nat(sec)) || 0) * 1000));

  // ── 무대 ──
  set('gAddItem', (kind, x, z) =>
    Game.addItem(Number(nat(x)) || 0, Number(nat(z)) || 0, String(nat(kind))));
  set('gAddItemRandom', (kind, n) => {
    const s = Game.stage(), k = String(nat(kind));
    for (let i = 0; i < (Number(nat(n)) || 0); i++) {
      const x = (Math.random() - 0.5) * s.clearX * 2 * 0.9;
      const z = s.cz + (Math.random() - 0.5) * s.d * 0.75;
      Game.addItem(x, z, k);
    }
  });
  set('gAddGoal', (x, z) => Game.addGoal(Number(nat(x)) || 0, Number(nat(z)) || 0));
  set('gAddWall', (x, z, w, d) => Game.addWall(
    Number(nat(x)) || 0, Number(nat(z)) || 0, Number(nat(w)) || 0.2, Number(nat(d)) || 0.04));
  set('gClear', () => Game.clearObjects());

  // ── 점수 ──
  set('gScore', n => Game.addScore(nat(n)));
  set('gLife', n => {
    Game.addLife(nat(n));
    if (Game.lives <= 0) { Game.say('게임 오버'); gLog('게임 오버', 'warn'); gameStop(); }
  });
  set('gSay', m => { Game.say(String(nat(m))); gLog(String(nat(m))); });
  set('gEye', (side, col) => {
    const sd = String(nat(side)), c = String(nat(col));
    const gl = document.getElementById('glassColorL'), gr = document.getElementById('glassColorR');
    const L = (sd === 'right') ? (gl ? gl.value : '#00e1ff') : c;
    const R = (sd === 'left')  ? (gr ? gr.value : '#00e1ff') : c;
    if (gl) gl.value = L;  if (gr) gr.value = R;
    Pibo.setEye(L, R);
  });
  set('gLcd', m => Pibo.lcdText(String(nat(m))));
  setAsync('gSpeak', (m, cb) => {
    const t = String(nat(m));
    Game.say(t); gLog('🔊 ' + t);
    gSpeakAsync(t).then(() => cb());
  });
  set('gOver', r => {
    const win = String(nat(r)) === 'win';
    const t = gFmtTime(gElapsed());
    Game.say(win ? '성공! (' + t + ')' : '실패…');
    gLog((win ? '게임 성공' : '게임 실패') + ' — 걸린 시간 ' + t, win ? '' : 'warn');
    gameStop();
  });

  // ── 감지 ──
  set('gGetScore', () => Game.score);
  set('gGetLives', () => Game.lives);
  set('gGetTime', () => Math.round(gElapsed() * 10) / 10);
  set('gGetPos', axis => {
    const p = Game.robotXZ();
    return Math.round((nat(axis) === 'z' ? p.z : p.x) * 100) / 100;
  });
  set('gIsFallen', () => Game.fallen());
  set('gItemLeft', kind => {
    const k = String(nat(kind));
    return Game.items.filter(i => !i.taken && (k === 'any' || i.kind === k)).length;
  });
}

// ── 실행 / 정지 ──
function gameRun() {
  if (gameRunning) return;
  gClearLog();
  Game.reset();
  gameQueue.length = 0;

  Blockly.JavaScript.STATEMENT_PREFIX = 'highlightBlock(%1);\n';
  Blockly.JavaScript.addReservedWords(
    'highlightBlock,gRunning,gPoll,gMove,gTurn,gGoto,gMotion,gWait,' +
    'gAddItem,gAddItemRandom,gAddGoal,gAddWall,gClear,gScore,gLife,gSay,gOver,' +
    'gGetScore,gGetLives,gGetPos,gIsFallen,gItemLeft,__H,__pump');

  let code;
  try { code = Blockly.JavaScript.workspaceToCode(gameWorkspace); }
  catch (e) { gLog('코드 생성 실패: ' + e.message, 'err'); return; }
  if (!code.trim()) {
    const has = gameWorkspace.getAllBlocks(false).length > 0;
    gLog(has ? "'게임 시작하면' 블록에 연결해 주세요." : '블록이 없습니다.', 'warn');
    return;
  }

  const PRE = 'var __H = {};\n' +
              'function __pump() { var e = gPoll(); if (e && __H[e]) __H[e](); }\n';
  const POST = '\nwhile (gRunning()) { __pump(); gWait(0.03); }\n';
  code = PRE + code + POST;

  try { gameInterp = new Interpreter(code, buildGameApi); }
  catch (e) { gLog('실행 준비 실패: ' + e.message, 'err'); return; }

  gameRunning = true;
  gameT0 = performance.now();
  { const el = document.getElementById('gTime'); if (el) el.textContent = '0:00'; }
  Game.start();
  setGameUI(true);
  gLog('게임 시작 — 방향키로 조종하세요');

  (function loop() {
    if (!gameRunning || !gameInterp) return;
    let more = true;
    try {
      for (let i = 0; i < 600; i++) {
        more = gameInterp.step();
        // 스텝 도중 gOver/gLife 가 gameStop() 을 부르면 gameInterp 가 null 이 된다
        if (!gameRunning || !gameInterp) return;
        if (!more || gameInterp.paused_) break;
      }
    } catch (e) { gLog('실행 오류: ' + e.message, 'err'); gameStop(); return; }
    if (!more) { gLog('실행 끝'); gameStop(); return; }
    requestAnimationFrame(loop);
  })();
}

function gameStop() {
  if (!gameRunning) return;
  gameRunning = false;
  gameInterp = null;
  if (window.speechSynthesis) speechSynthesis.cancel();
  Game.stop();
  setGameUI(false);
  if (gameWorkspace) gameWorkspace.highlightBlock(null);
  gLog('정지', 'warn');
}

function setGameUI(on) {
  const r = document.getElementById('gBtnRun'), s = document.getElementById('gBtnStop');
  if (r) r.disabled = on;
  if (s) s.disabled = !on;
}
