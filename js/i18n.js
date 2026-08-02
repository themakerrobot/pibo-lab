// ═══════════════════════════════════════════════════════════
// 다국어 (한국어 / English)
// ═══════════════════════════════════════════════════════════
// 설계
//  · 한국어 원문을 그대로 '키' 로 쓴다 → 사전에 없으면 한국어가 그대로 나오므로
//    번역이 빠져도 화면이 깨지지 않는다.
//  · HTML 은 손대지 않는다. 페이지가 뜨면 DOM 을 훑어서 텍스트를 바꾼다.
//  · 언어 설정은 실물 IDE(blockly/ko2en.js)와 같은 localStorage 키 'language' 를
//    쓴다. 그래서 이 토글 하나로 Blockly 기본 블록 언어까지 같이 바뀐다.
//
// 반드시 다른 js 보다 먼저 로드할 것 (블록 정의가 PIBO_T() 를 쓴다).

const PIBO_LANG = (function () {
  try {
    const saved = localStorage.getItem('language');
    if (saved === 'ko' || saved === 'en') return saved;
  } catch (e) {}
  const nav = (navigator.language || navigator.userLanguage || 'ko');
  return nav.toLowerCase().indexOf('ko') === 0 ? 'ko' : 'en';
})();

const PIBO_I18N = {
  // ── 페이지 / 공통 UI ──
  '파이보 랩': 'Pibo Lab',
  'PIBO 체험툴': 'PIBO Playground',
  'PIBO 개발툴': 'PIBO Block IDE',
  'PIBO 게임 만들기': 'PIBO Game Maker',
  '체험툴': 'Playground',
  '개발툴': 'Block IDE',
  '게임툴': 'Game Maker',
  '준비': 'Ready',
  '뷰': 'View',
  '그리드': 'Grid',
  '스크린샷': 'Screenshot',
  '포즈': 'Pose',
  '리셋': 'Reset',
  '안경': 'Glasses',
  '왼쪽 눈': 'Left eye',
  '오른쪽 눈': 'Right eye',
  '글씨색': 'Text color',
  '파트 색상': 'Part colors',
  '색상 되돌리기': 'Reset colors',
  '관절': 'Joints',
  '검색': 'Search',
  'URDF 로드 후 관절 표시': 'Joints appear after the URDF loads',
  'data/ 에서 모델을 불러옵니다': 'Loading the model from data/',
  '실패 시 새로고침': 'Refresh if it fails',
  '로딩 중...': 'Loading...',
  '준비 중...': 'Preparing...',
  '불러오는 중': 'Loading',
  '모델 없음': 'No model',
  '좌:회전 &nbsp; 우:이동 &nbsp; 휠:줌': 'L: rotate &nbsp; R: pan &nbsp; Wheel: zoom',
  '궤적 지우기': 'Clear trail',
  '넘어졌습니다': 'Fallen over',
  '확대': 'Zoom in',
  '축소': 'Zoom out',
  '화면에 맞추기': 'Fit to view',
  '배경 테마': 'Backdrop theme',

  // ── 물리 ──
  '물리 시뮬': 'Physics',
  '물리 ON/OFF': 'Physics ON/OFF',
  '물리': 'Physics',
  '엔진': 'Engine',
  '로딩중': 'Loading',
  '상태': 'State',
  '기울기': 'Tilt',
  '이동거리': 'Distance',
  '이동': 'Distance',

  // ── 타임라인 (체험툴) ──
  '처음': 'Start',
  '재생/정지': 'Play / Pause',
  '정지': 'Stop',
  '실행': 'Run',
  '저장': 'Save',
  '불러오기': 'Load',
  '루프': 'Loop',
  '삭제': 'Delete',
  '로봇 초기화': 'Reset robot',
  '블록 지우기': 'Clear blocks',
  '준비 완료 — ▶ 실행을 누르세요': 'Ready — press ▶ Run',
  '준비 완료 — 블록을 조립하고 ▶ 실행을 누르세요': 'Ready — build blocks and press ▶ Run',
  '+ 키프레임': '+ Keyframe',
  '&#x2715; 삭제': '&#x2715; Delete',
  '길이': 'Length',
  's · 속도': 's · Speed',
  '&#x1F501; 루프': '&#x1F501; Loop',
  '&#x1F4BE; 저장': '&#x1F4BE; Save',
  '&#x1F4C2; 불러오기': '&#x1F4C2; Load',
  '모션 선택': 'Pick a motion',
  '내장 모션 불러오기': 'Load a built-in motion',
  '키프레임 0': 'Keyframes 0',

  // ── 개발툴 / 게임툴 상단 ──
  '▶ 실행': '▶ Run',
  '■ 정지': '■ Stop',
  '↺ 로봇 초기화': '↺ Reset robot',
  '🗑 블록 지우기': '🗑 Clear blocks',
  '💾 저장': '💾 Save',
  '📂 불러오기': '📂 Load',
  '관절·화면·물리를 처음 상태로': 'Reset joints, view and physics',
  '작업 중인 블록을 모두 지웁니다': 'Clear every block on the canvas',
  '드래그해서 폭 조절': 'Drag to resize width',
  '드래그해서 높이 조절': 'Drag to resize height',
  '점수': 'Score',
  '목숨': 'Lives',

  // ── 배경 테마 ──
  '책상': 'Desk',
  '식탁': 'Dining table',
  '작업대': 'Workbench',
  '주행 매트': 'Road mat',
  '스모 링': 'Sumo ring',
  '축구장': 'Soccer field',
  '우주 기지': 'Space base',
  '주방 조리대': 'Kitchen counter',
  '심플': 'Plain',
  '배경: 책상': 'Backdrop: Desk',
  '배경: 식탁': 'Backdrop: Dining table',
  '배경: 작업대': 'Backdrop: Workbench',
  '배경: 주행 매트': 'Backdrop: Road mat',
  '배경: 스모 링': 'Backdrop: Sumo ring',
  '배경: 축구장': 'Backdrop: Soccer field',
  '배경: 우주 기지': 'Backdrop: Space base',
  '배경: 주방 조리대': 'Backdrop: Kitchen counter',
  '배경: 심플': 'Backdrop: Plain',

  // ── 게임 블록: 카테고리 ──
  '시작': 'Start',
  '움직임': 'Move',
  '무대': 'Stage',
  '꾸미기': 'Decorate',
  '감지': 'Sensing',
  '반복': 'Loops',
  '논리': 'Logic',
  '수학': 'Math',
  '문자': 'Text',
  '변수': 'Variables',
  '함수': 'Functions',

  // ── 게임 블록: 메시지 ──
  '%1 게임 시작하면': '%1 when the game starts',
  '%1 %2 을(를) 만났을 때': '%1 when I touch %2',
  '%1 %2 키를 눌렀을 때': '%1 when %2 key is pressed',
  '%1 을(를) 만났을 때': '%1 when I touch it',
  '%1 키를 눌렀을 때': '%1 when the key is pressed',
  '%1 계속 반복하기': '%1 repeat forever',
  '%1 %2 %3 칸 이동하기': '%1 walk %2 %3 step(s)',
  '%1 %2 %3 회 돌기': '%1 turn %2 %3 time(s)',
  '%1 x %2 z %3 로 순간이동': '%1 teleport to x %2 z %3',
  '%1 %2 동작 하기': '%1 play motion %2',
  '%1 %2 초 기다리기': '%1 wait %2 second(s)',
  '%1 %2 을(를) x %3 z %4 에 놓기': '%1 put %2 at x %3 z %4',
  '%1 %2 을(를) 무작위로 %3 개 놓기': '%1 scatter %3 %2 randomly',
  '%1 골인 지점을 x %2 z %3 에 놓기': '%1 put the goal at x %2 z %3',
  '%1 벽을 x %2 z %3 가로 %4 세로 %5 로 놓기': '%1 put a wall at x %2 z %3, %4 wide, %5 deep',
  '%1 놓은 것 모두 치우기': '%1 clear the stage',
  '%1 점수 %2 만큼 바꾸기': '%1 change score by %2',
  '%1 목숨 %2 만큼 바꾸기': '%1 change lives by %2',
  '%1 %2 라고 알리기': '%1 show %2',
  '%1 %2 라고 말하기': '%1 say %2 out loud',
  '%1 게임 %2': '%1 game %2',
  '%1 %2 눈을 %3 색으로 켜기': '%1 light the %2 eye in %3',
  '%1 %2 을(를) %3 색으로': '%1 paint the %2 in %3',
  '%1 가슴 화면에 %2 쓰기': '%1 write %2 on the chest screen',
  '내 %1 위치': 'my %1 position',
  '남은 %1 개수': '%1 left',
  '넘어졌는가?': 'have I fallen over?',
  '경과 시간(초)': 'elapsed time (s)',

  // ── 게임 블록: 선택지 ──
  '앞으로': 'forward',
  '뒤로': 'backward',
  '오른쪽으로': 'right',
  '왼쪽으로': 'left',
  '양쪽': 'both',
  '왼쪽': 'left',
  '오른쪽': 'right',
  '전체': 'all',
  '↑ 위': '↑ Up',
  '↓ 아래': '↓ Down',
  '← 왼쪽': '← Left',
  '→ 오른쪽': '→ Right',
  '스페이스': 'Space',
  '골인 지점': 'the goal',
  '넘어졌을 때': 'I fall over',
  '상판 밖으로 나갔을 때': 'I fall off the table',
  '성공': 'success',
  '실패': 'failure',

  // ── 아이템 ──
  '동전': 'Coin',
  '보석': 'Gem',
  '하트': 'Heart',
  '상자': 'Box',
  '별': 'Star',
  '열쇠': 'Key',
  '휴지통': 'Trash can',
  '공': 'Ball',

  // ── 몸 부위 ──
  '몸통': 'Body',
  '머리': 'Head',
  '목': 'Neck',
  '왼팔': 'Left arm',
  '오른팔': 'Right arm',
  '왼쪽 어깨': 'Left shoulder',
  '오른쪽 어깨': 'Right shoulder',
  '왼쪽 다리': 'Left leg',
  '오른쪽 다리': 'Right leg',
  '왼발': 'Left foot',
  '오른발': 'Right foot',
  '머리 장식': 'Head accessory',

  // ── 모션 이름 ──
  '인사': 'Greeting',
  '만세': 'Cheer',
  '박수': 'Clap',
  '춤': 'Dance',
  '손 흔들기': 'Wave',
  '슬픔': 'Sad',
  '기본자세': 'Neutral pose',

  // ── 블록 설명 ──
  '게임을 시작할 때 한 번 실행됩니다.': 'Runs once when the game starts.',
  '해당 상황이 되면 실행됩니다.': 'Runs whenever this happens.',
  '키를 누르면 실행됩니다.': 'Runs when the key is pressed.',
  '게임이 끝날 때까지 계속 반복합니다.': 'Repeats until the game ends.',
  '한 칸은 5cm 입니다. 걷는 모습이 함께 재생됩니다.':
    'One step is about 5cm. The walking motion plays with it.',
  '도는 모션을 N번 재생합니다. 1회에 약 33도 돕니다.':
    'Plays the turning motion N times. Each turn is about 33 degrees.',
  '상판 좌표(m)로 바로 옮깁니다.': 'Jumps straight to a table coordinate (m).',
  '소리내어 읽습니다 (TTS). 말이 끝날 때까지 기다립니다.':
    'Reads it aloud (TTS) and waits until it finishes.',
  '눈(안경) LED 색을 바꿉니다. 색은 색상 블록을 끼워 정합니다.':
    'Changes the eye LED color. Plug a color block in to choose.',
  '몸통 LCD 에 글씨를 표시합니다.': 'Shows text on the chest LCD.',
  '체험툴의 파트 색상과 같습니다. 몸 각 부위의 색을 바꿉니다.':
    'Same as the Playground part colors. Paints each body part.',
  '게임 시작부터 지금까지 걸린 시간입니다. 초 단위 (소수점 1자리).':
    'Time since the game started, in seconds (one decimal).',

  // ── 게임 실행 메시지 ──
  '게임 시작 — 방향키로 조종하세요': 'Game started — steer with the arrow keys',
  '벽에 막혔어요': 'Blocked by a wall',
  '게임 오버': 'Game over',
  '게임 성공': 'You win',
  '게임 실패': 'You lose',
  '성공!': 'You win!',
  '실패…': 'You lose...',
  '실행 끝': 'Finished',
  '블록이 없습니다.': 'There are no blocks.',
  "'게임 시작하면' 블록에 연결해 주세요.": "Connect your blocks to the 'when the game starts' block.",
  '잘했어요!': 'Well done!',
  '안녕! 나는 파이보야': 'Hi! I am PIBO',

  // ── 모델 로딩 / 상태 (체험툴) ──
  '자동 로드 실패': 'Auto-load failed',
  'data/ 경로·네트워크 확인 후 새로고침하세요': 'Check the data/ path and your network, then refresh',
  'data/ 에서 불러오는 중...': 'Loading from data/...',
  'URDF 가져오는 중...': 'Fetching the URDF...',
  'URDF를 찾지 못했습니다': 'Could not find the URDF in data/',
  'URDF 파싱 오류': 'URDF parse error',
  'STL 받는 중': 'Fetching STL',
  'STL을 받지 못했습니다': 'Could not fetch the STL files from data/',
  '모델 구성 중...': 'Building the model...',
  '링크': 'Links',
  '가동': 'Movable',
  '메시': 'Meshes',
  '완료': 'Done',

  // ── 타임라인 / 모션 ──
  '키프레임을 먼저 추가하세요': 'Add a keyframe first',
  '모션 이름': 'Motion name',
  '모션을 불러오지 못했습니다': 'Could not load the motion',
  '모션 파일을 읽지 못했습니다': 'Could not read the motion file',
  '로봇을 먼저 로드하세요': 'Load the robot first',
  '키프레임': 'Keyframes',
  '모션 오류': 'Motion error',

  // ── 물리 ──
  '물리 엔진 로딩 중입니다': 'The physics engine is still loading',
  '넘어짐': 'Fallen',
  '상판 이탈': 'Off the table',
  '실패': 'Failed',
  'Rapier 로드 실패 — 콘솔(F12) 확인': 'Rapier failed to load — check the console (F12)',

  // ── 개발툴 실행 ──
  '실행 시작': 'Running',
  "'시작' 블록에 연결된 블록이 없습니다. 시작 아래에 붙여주세요.":
    "Nothing is connected to the 'start' block. Attach your blocks under it.",
  '시뮬 미반영': 'not simulated',
  '시뮬 미지원': 'not supported in the simulator',
  '시뮬 미지원, 건너뜀': 'not supported in the simulator, skipped',

  '걸린 시간': 'Time taken',
  '시간': 'Time',
  '코드 생성 실패': 'Code generation failed',
  '실행 준비 실패': 'Could not prepare the run',
  '실행 오류': 'Runtime error',
  '(브라우저가 TTS 를 지원하지 않음)': '(this browser has no speech synthesis)',
  '분': 'm ',
  '초': 's',
};

// HTML 실체참조(&#x1F4BE; 등)는 화면에서는 이미 문자로 바뀌어 있다.
// 사전 키는 HTML 원문 기준이므로, 문자로 푼 형태도 자동으로 함께 등록한다.
(function () {
  const dec = s => s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, '\u00a0');
  Object.keys(PIBO_I18N).forEach(function (k) {
    const dk = dec(k);
    if (dk !== k && PIBO_I18N[dk] === undefined) PIBO_I18N[dk] = dec(PIBO_I18N[k]);
  });
})();

// 한국어 원문 → 현재 언어. 사전에 없으면 원문 그대로.
function PIBO_T(ko) {
  if (PIBO_LANG === 'ko') return ko;
  const v = PIBO_I18N[ko];
  return (v === undefined) ? ko : v;
}

// ── 화면(HTML) 자동 번역 ──
// HTML 파일은 손대지 않는다. 텍스트 노드와 title/placeholder 만 바꿔치기한다.
function localizeDOM(root) {
  if (PIBO_LANG === 'ko') return;
  const scope = root || document.body;
  if (!scope) return;

  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
  const hits = [];
  let n;
  while ((n = walker.nextNode())) {
    const tag = n.parentNode && n.parentNode.nodeName;
    if (tag === 'SCRIPT' || tag === 'STYLE') continue;
    const raw = n.nodeValue.trim();
    if (!raw || PIBO_I18N[raw] === undefined) continue;
    hits.push([n, n.nodeValue.replace(raw, PIBO_I18N[raw])]);
  }
  hits.forEach(h => { h[0].nodeValue = h[1]; });

  ['title', 'placeholder'].forEach(attr => {
    scope.querySelectorAll('[' + attr + ']').forEach(el => {
      const v = PIBO_I18N[el.getAttribute(attr).trim()];
      if (v !== undefined) el.setAttribute(attr, v);
    });
  });

  if (document.title && PIBO_I18N[document.title.trim()] !== undefined)
    document.title = PIBO_I18N[document.title.trim()];
}

// ── 언어 토글 버튼 ──
function setLanguage(v) {
  try { localStorage.setItem('language', v); } catch (e) {}
  location.reload();          // 블록 정의·Blockly 언어가 로드 시점에 정해지므로 새로고침
}

function mountLangToggle() {
  const bar = document.getElementById('devTop') || document.getElementById('gTop')
           || document.querySelector('header');
  if (!bar || document.getElementById('langToggle')) return;

  const wrap = document.createElement('span');
  wrap.id = 'langToggle';
  wrap.style.cssText = 'display:inline-flex;gap:4px;align-items:center';

  [['ko', '한국어'], ['en', 'EN']].forEach(function (p) {
    const on = PIBO_LANG === p[0];
    const b = document.createElement('button');
    b.textContent = p[1];
    b.style.cssText =
      'border:1px solid ' + (on ? 'var(--acc,#00BEDC)' : 'var(--line,#DDE6EA)') + ';' +
      'background:' + (on ? 'var(--acc,#00BEDC)' : 'var(--panel,#fff)') + ';' +
      'color:' + (on ? 'var(--acc-deep,#04303A)' : 'var(--ink2,#5C6E79)') + ';' +
      'border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;' +
      'font-family:inherit;cursor:' + (on ? 'default' : 'pointer');
    if (!on) b.addEventListener('click', function () { setLanguage(p[0]); });
    wrap.appendChild(b);
  });

  // 3페이지 공통: 상단바 맨 오른쪽 끝에 고정
  bar.appendChild(wrap);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { localizeDOM(); mountLangToggle(); });
} else {
  localizeDOM(); mountLangToggle();
}
