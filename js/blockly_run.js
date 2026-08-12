// ═══════════════════════════════════════════════════════════
// 실행 엔진 — Blockly → JS → JS-Interpreter 로 한 스텝씩
// ═══════════════════════════════════════════════════════════
// 한 스텝씩 돌리는 이유:
//  · 정지 버튼이 즉시 먹는다 (무한루프도 브라우저가 안 멈춤)
//  · 실행 중인 블록을 하이라이트할 수 있다
//  · 시간이 걸리는 동작(모션 재생·sleep·말하기)을 '끝날 때까지 대기' 시킬 수 있다

let simRunning = false;
let simInterp = null;
let simHighlighted = null;

function devLog(msg, cls) {
  const el = document.getElementById('devConsole');
  if (!el) return;
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = (typeof PIBO_T === 'function') ? PIBO_T(msg) : msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}
function devClear() { const el = document.getElementById('devConsole'); if (el) el.innerHTML = ''; }

// ── 브라우저 TTS ──
let ttsReady = false;
if (window.speechSynthesis) {
  const warm = () => { ttsReady = true; };
  speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = warm; warm();
}
// 실물은 k0~k9 (m1~m5 남성 / f1~f5 여성) 로 화자가 갈리지만 브라우저 음성은 대개 하나뿐이라
// 음높이만 살짝 다르게 줘서 구분되게 한다. 한 목소리로 통일하려면 pitch 를 1 로 고정하면 된다.
function voicePitch(v) {
  const m = String(v || '').match(/^([mf])(\d)$/);
  if (!m) return 1;
  return (m[1] === 'm' ? 0.72 : 1.28) + (Number(m[2]) - 3) * 0.05;
}
function speakAsync(text, volume, voice) {
  return new Promise(res => {
    if (!window.speechSynthesis) { devLog(PIBO_T('(브라우저가 TTS 를 지원하지 않음)'), 'warn'); return res(); }
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'ko-KR';
    u.pitch = Math.max(0.1, Math.min(2, voicePitch(voice)));
    u.volume = Math.max(0, Math.min(1, (Number(volume) || 80) / 100));
    const vs = speechSynthesis.getVoices();
    const ko = vs.find(v => /ko/i.test(v.lang));
    if (ko) u.voice = ko;
    u.onend = u.onerror = () => res();
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
}

// ── 콘솔 인라인 입력 (실물의 input() / 브라우저 prompt() 대체) ──
// window.prompt 은 브라우저를 통째로 멈춰서 3D 렌더링까지 정지시킨다.
// 콘솔 안에 입력줄을 그려서 비동기로 받으면 파이보는 계속 움직인다.
let pendingPrompt = null;

function promptAsync(msg, type) {
  const isNum = (type === 'NUMBER');
  return new Promise(res => {
    const box = document.getElementById('devConsole');
    if (!box) return res(isNum ? 0 : '');

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:5px 0;padding:7px 9px;' +
      'background:#22262A;border:1px solid #00BEDC;border-radius:6px';

    const label = document.createElement('span');
    label.textContent = String(msg == null ? '' : msg);
    label.style.cssText = 'color:#00BEDC;font-weight:600;white-space:pre-wrap;flex-shrink:0';

    const input = document.createElement('input');
    input.type = isNum ? 'number' : 'text';
    if (isNum) input.step = 'any';
    input.style.cssText = 'flex:1;min-width:60px;background:#15181A;border:1px solid #3A4046;' +
      'border-radius:4px;color:#E6EDF3;font-family:inherit;font-size:12px;padding:4px 7px;outline:none';

    const btn = document.createElement('button');
    btn.textContent = (typeof PIBO_T === 'function') ? PIBO_T('입력') : '입력';
    btn.style.cssText = 'flex-shrink:0;background:#00BEDC;border:0;border-radius:4px;color:#04303A;' +
      'font-family:inherit;font-size:12px;font-weight:700;padding:5px 12px;cursor:pointer';

    row.appendChild(label); row.appendChild(input); row.appendChild(btn);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    setTimeout(() => input.focus(), 0);

    // 정지 버튼이 먹도록 대기 중인 입력을 밖에서 취소할 수 있게 걸어둔다
    const finish = (raw) => {
      if (pendingPrompt !== finish) return;
      pendingPrompt = null;
      input.disabled = btn.disabled = true;
      row.style.borderColor = '#3A4046';
      input.style.color = '#8B949E';
      res(isNum ? (Number(raw) || 0) : String(raw));
    };
    pendingPrompt = finish;

    btn.addEventListener('click', () => finish(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(input.value); }
    });
  });
}

function cancelPrompt() {
  if (pendingPrompt) pendingPrompt('');
}

// ── 인터프리터에 노출할 함수들 ──
function buildInterpreterApi(interp, scope) {
  const set = (name, fn) => interp.setProperty(scope, name, interp.createNativeFunction(fn));
  const setAsync = (name, fn) => interp.setProperty(scope, name, interp.createAsyncFunction(fn));
  const native = v => (v && typeof v === 'object' && v.properties !== undefined) ? interp.pseudoToNative(v) : v;

  set('highlightBlock', id => {
    if (simHighlighted) devWorkspace.highlightBlock(null);
    simHighlighted = id;
    if (id) devWorkspace.highlightBlock(id);
  });

  set('simNote', msg => devLog(String(msg), 'warn'));
  set('simPrint', msg => devLog(String(msg)));
  set('simNow', () => new Date().toLocaleString('ko-KR'));
  set('simGetMotionList', () => MOTION_NAMES.join(','));

  set('simSetMotor', (no, deg) => { Pibo.setMotor(Number(no), Number(deg)); });
  // 실물 device.eye_on_s([left, right]) 와 같은 순서
  set('simEye', (l, r) => { Pibo.setEye(String(l || '#00e1ff'), String(r || l || '#00e1ff')); });
  // 실물 device.eye_on(r,g,b, r,g,b) — 앞 3개 왼쪽 / 뒤 3개 오른쪽
  set('simEyeRGB', (a, b, c, d, e, f) => { Pibo.setEyeRGB(a, b, c, d, e, f); });

  set('simOled', (cmd, a, b, c, d, e) => {
    switch (cmd) {
      case 'font': Oled.setFont(a); break;
      case 'text': Oled.text(a, b, native(c)); break;
      case 'rect': Oled.rect(a, b, c, d, !!e); break;
      case 'ellipse': Oled.ellipse(a, b, c, d, !!e); break;
      case 'line': Oled.line(a, b, c, d); break;
      case 'invert': Oled.invert(); break;
      case 'clear': Oled.clear(); break;
      case 'show': Oled.show(); break;
    }
  });

  set('simAngle', (p1, p2, p3) => {
    const A = native(p1), B = native(p2), C = native(p3);
    if (!A || !B || !C) return 0;
    const ang = Math.atan2(C[1] - B[1], C[0] - B[0]) - Math.atan2(A[1] - B[1], A[0] - B[0]);
    let d = Math.abs(ang * 180 / Math.PI);
    return d > 180 ? 360 - d : d;
  });

  // ── 시간이 걸리는 동작 ──
  setAsync('simSleep', (sec, cb) => { setTimeout(cb, Math.max(0, Number(sec) || 0) * 1000); });
  setAsync('simSpeak', (text, vol, voice, cb) => { speakAsync(native(text), vol, native(voice)).then(() => cb()); });
  setAsync('simInitMotion', cb => { Pibo.initMotion().then(() => cb()); });
  setAsync('simSetMotors', (list, ms, cb) => { Pibo.setMotors(native(list), Number(ms)).then(() => cb()); });
  setAsync('simPlayMotion', (name, cycle, cb) => {
    const n = String(native(name));
    devLog('▶ ' + n);
    Pibo.playMotion(n, Number(cycle) || 1).then(() => cb()).catch(err => { devLog(PIBO_T('모션 오류') + ': ' + err, 'err'); cb(); });
  });
  setAsync('simPrompt', (msg, type, cb) => {
    promptAsync(native(msg), String(native(type) || 'TEXT')).then(v => cb(v));
  });
}

// ── 실행 / 정지 ──
function devRun() {
  if (simRunning) return;
  devClear();

  Blockly.JavaScript.STATEMENT_PREFIX = 'highlightBlock(%1);\n';
  Blockly.JavaScript.addReservedWords('highlightBlock,simSleep,simSpeak,simPlayMotion,simSetMotor,' +
    'simSetMotors,simInitMotion,simEye,simEyeRGB,simOled,simNote,simPrint,simNow,simGetMotionList,simAngle,simPrompt');

  let code;
  try {
    code = Blockly.JavaScript.workspaceToCode(devWorkspace);
  } catch (e) {
    devLog(PIBO_T('코드 생성 실패') + ': ' + e.message, 'err'); return;
  }
  if (!code.trim()) {
    const has = devWorkspace.getAllBlocks(false).length > 0;
    devLog(has ? PIBO_T("'시작' 블록에 연결된 블록이 없습니다. 시작 아래에 붙여주세요.")
               : PIBO_T('블록이 없습니다.'), 'warn');
    return;
  }

  try {
    simInterp = new Interpreter(code, buildInterpreterApi);
  } catch (e) {
    devLog(PIBO_T('실행 준비 실패') + ': ' + e.message, 'err'); return;
  }

  simRunning = true;
  setRunUI(true);
  devLog(PIBO_T('실행 시작'));

  // 한 프레임에 여러 스텝을 돌리되, 대기 상태면 즉시 양보한다
  const STEPS_PER_FRAME = 800;
  (function loop() {
    if (!simRunning) return;
    let more = true;
    try {
      for (let i = 0; i < STEPS_PER_FRAME; i++) {
        more = simInterp.step();
        if (!more) break;
        if (simInterp.paused_) break;   // 비동기 대기 중
      }
    } catch (e) {
      devLog(PIBO_T('실행 오류') + ': ' + e.message, 'err');
      devStop(); return;
    }
    more ? requestAnimationFrame(loop) : devFinish();
  })();
}

function devFinish() {
  simRunning = false;
  setRunUI(false);
  if (devWorkspace) devWorkspace.highlightBlock(null);
  devLog(PIBO_T('실행 끝'));
}

function devStop() {
  if (!simRunning) return;
  simRunning = false;
  simInterp = null;
  setRunUI(false);
  cancelPrompt();
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (devWorkspace) devWorkspace.highlightBlock(null);
  devLog(PIBO_T('정지'), 'warn');
}

function setRunUI(on) {
  const r = document.getElementById('btnRun'), s = document.getElementById('btnStop');
  if (r) r.disabled = on;
  if (s) s.disabled = !on;
}
