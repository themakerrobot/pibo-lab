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

// ── 인터프리터에 노출할 함수 ──
function buildGameApi(interp, scope) {
  const set = (n, f) => interp.setProperty(scope, n, interp.createNativeFunction(f));
  const setAsync = (n, f) => interp.setProperty(scope, n, interp.createAsyncFunction(f));
  const nat = v => (v && typeof v === 'object' && v.properties !== undefined)
    ? interp.pseudoToNative(v) : v;
  const CELL = 0.05;   // 한 칸 = 5cm

  set('highlightBlock', id => {
    if (gameHighlighted) gameWorkspace.highlightBlock(null);
    gameHighlighted = id;
    if (id) gameWorkspace.highlightBlock(id);
  });

  set('gRunning', () => gameRunning);
  // 큐에서 이벤트 이름을 하나 꺼낸다 (없으면 빈 문자열)
  set('gPoll', () => (gameQueue.length ? gameQueue.shift() : ''));

  // ── 이동 (걷는 모습 + 위치 이동) ──
  setAsync('gMove', (n, cb) => {
    const cells = Number(nat(n)) || 0;
    const rad = Game.heading * Math.PI / 180;
    const p = Game.robotXZ();
    const tx = p.x + Math.sin(rad) * CELL * cells;
    const tz = p.z + Math.cos(rad) * CELL * cells;
    if (Game.hitWall({ x: tx, z: tz })) { Game.say('벽에 막혔어요'); return cb(); }
    Pibo.playMotion(cells >= 0 ? 'forward1' : 'backward1', 1).catch(() => {});
    const t0 = performance.now(), dur = Math.max(200, Math.abs(cells) * 420);
    const step = now => {
      const a = Math.min(1, (now - t0) / dur);
      Game.moveRobotTo(p.x + (tx - p.x) * a, p.z + (tz - p.z) * a);
      (a < 1 && gameRunning) ? requestAnimationFrame(step) : cb();
    };
    requestAnimationFrame(step);
  });

  setAsync('gTurn', (deg, cb) => {
    const d = Number(nat(deg)) || 0;
    const from = Game.heading, t0 = performance.now();
    const dur = Math.max(150, Math.abs(d) / Game.turnSpeed * 1000);
    Pibo.playMotion(d >= 0 ? 'right' : 'left', 1).catch(() => {});
    const step = now => {
      const a = Math.min(1, (now - t0) / dur);
      Game.setHeading(from + d * a);
      (a < 1 && gameRunning) ? requestAnimationFrame(step) : cb();
    };
    requestAnimationFrame(step);
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
  set('gOver', r => {
    const win = String(nat(r)) === 'win';
    Game.say(win ? '성공!' : '실패…');
    gLog(win ? '게임 성공' : '게임 실패', win ? '' : 'warn');
    gameStop();
  });

  // ── 감지 ──
  set('gGetScore', () => Game.score);
  set('gGetLives', () => Game.lives);
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
  Game.start();
  setGameUI(true);
  gLog('게임 시작 — 방향키로 조종하세요');

  (function loop() {
    if (!gameRunning) return;
    let more = true;
    try {
      for (let i = 0; i < 600; i++) {
        more = gameInterp.step();
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
