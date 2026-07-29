// ═══════════════════════════════════════════════════════════
// 게임 전용 블록 정의 — 실물 PIBO 에는 없는 블록
// ═══════════════════════════════════════════════════════════
// customblock.js(실물과 공유하는 파일)는 절대 건드리지 않는다.
// 여기 블록들은 game_ 접두어를 붙여 실물 블록과 이름이 겹치지 않게 한다.
const game_colour = {
  event:  '#E5B900',
  move:   '#d38d62',
  world:  '#7d9b7d',
  score:  '#8da2c3',
  sense:  '#a39c7D',
};

Blockly.defineBlocksWithJsonArray([
  // ── 이벤트 ──
  {
    type: 'game_start',
    message0: '%1 게임 시작하면',
    args0: [{ type: 'field_image', src: 'svg/flag-solid.svg', width: 27, height: 27, alt: 'flag' }],
    nextStatement: null,
    colour: game_colour.event,
    tooltip: '게임을 시작할 때 한 번 실행됩니다.',
  },
  {
    type: 'game_forever',
    message0: '%1 계속 반복하기',
    args0: [{ type: 'field_image', src: 'svg/right-left-solid.svg', width: 22, height: 22, alt: 'loop' }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    colour: game_colour.event,
    tooltip: '게임이 끝날 때까지 계속 반복합니다.',
  },
  {
    type: 'game_on_event',
    message0: '%1 을(를) 만났을 때',
    args0: [{
      type: 'field_dropdown', name: 'EVT',
      options: [['동전', 'coin'], ['보석', 'gem'], ['하트', 'heart'], ['상자', 'box'],
                ['별', 'star'], ['열쇠', 'key'], ['휴지통', 'trash'], ['공', 'ball'],
                ['골인 지점', 'goal'], ['넘어졌을 때', 'fall'], ['상판 밖으로 나갔을 때', 'fallOff']],
    }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    colour: game_colour.event,
    tooltip: '해당 상황이 되면 실행됩니다.',
  },
  {
    type: 'game_on_key',
    message0: '%1 키를 눌렀을 때',
    args0: [{
      type: 'field_dropdown', name: 'KEY',
      options: [['↑ 위', 'ArrowUp'], ['↓ 아래', 'ArrowDown'], ['← 왼쪽', 'ArrowLeft'],
                ['→ 오른쪽', 'ArrowRight'], ['스페이스', 'Space']],
    }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    colour: game_colour.event,
    tooltip: '키를 누르면 실행됩니다.',
  },

  // ── 이동 ──
  {
    type: 'game_move',
    message0: '%1 %2 %3 칸 이동하기',
    args0: [
      { type: 'field_image', src: 'svg/person-walking-solid.svg', width: 24, height: 24 },
      { type: 'field_dropdown', name: 'DIR', options: [['앞으로', '1'], ['뒤로', '-1']] },
      { type: 'input_value', name: 'N', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.move,
    tooltip: '한 칸은 5cm 입니다. 걷는 모습이 함께 재생됩니다.',
  },
  {
    type: 'game_turn',
    message0: '%1 %2 %3 회 돌기',
    args0: [
      { type: 'field_image', src: 'svg/right-left-solid.svg', width: 22, height: 22 },
      { type: 'field_dropdown', name: 'DIR', options: [['오른쪽으로', '1'], ['왼쪽으로', '-1']] },
      { type: 'input_value', name: 'N', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.move,
    tooltip: '도는 모션을 N번 재생합니다. 1회에 약 33도 돕니다.',
  },
  {
    type: 'game_goto',
    message0: '%1 x %2 z %3 로 순간이동',
    args0: [
      { type: 'field_image', src: 'svg/person-walking-solid.svg', width: 24, height: 24 },
      { type: 'input_value', name: 'X', check: 'Number' },
      { type: 'input_value', name: 'Z', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.move,
    tooltip: '상판 좌표(m)로 바로 옮깁니다.',
  },
  {
    type: 'game_motion',
    message0: '%1 %2 동작 하기',
    args0: [
      { type: 'field_image', src: 'svg/person-walking-solid.svg', width: 24, height: 24 },
      { type: 'field_dropdown', name: 'NAME',
        options: [['인사', 'greeting'], ['만세', 'cheer3'], ['손 흔들기', 'wave1'],
                  ['박수', 'clapping1'], ['슬픔', 'sad2'], ['춤', 'dance1'], ['기본자세', 'stop']] },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.move,
  },

  // ── 월드 ──
  {
    type: 'game_add_item',
    message0: '%1 %2 을(를) x %3 z %4 에 놓기',
    args0: [
      { type: 'field_image', src: 'svg/database-solid.svg', width: 22, height: 22 },
      { type: 'field_dropdown', name: 'KIND',
        options: [['동전', 'coin'], ['보석', 'gem'], ['하트', 'heart'], ['상자', 'box'],
        ['별', 'star'], ['열쇠', 'key'], ['휴지통', 'trash'], ['공', 'ball']] },
      { type: 'input_value', name: 'X', check: 'Number' },
      { type: 'input_value', name: 'Z', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.world,
  },
  {
    type: 'game_add_item_random',
    message0: '%1 %2 을(를) 무작위로 %3 개 놓기',
    args0: [
      { type: 'field_image', src: 'svg/database-solid.svg', width: 22, height: 22 },
      { type: 'field_dropdown', name: 'KIND',
        options: [['동전', 'coin'], ['보석', 'gem'], ['하트', 'heart'], ['상자', 'box'],
        ['별', 'star'], ['열쇠', 'key'], ['휴지통', 'trash'], ['공', 'ball']] },
      { type: 'input_value', name: 'N', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.world,
  },
  {
    type: 'game_add_goal',
    message0: '%1 골인 지점을 x %2 z %3 에 놓기',
    args0: [
      { type: 'field_image', src: 'svg/flag-solid.svg', width: 22, height: 22 },
      { type: 'input_value', name: 'X', check: 'Number' },
      { type: 'input_value', name: 'Z', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.world,
  },
  {
    type: 'game_add_wall',
    message0: '%1 벽을 x %2 z %3 가로 %4 세로 %5 로 놓기',
    args0: [
      { type: 'field_image', src: 'svg/draw-polygon-solid.svg', width: 22, height: 22 },
      { type: 'input_value', name: 'X', check: 'Number' },
      { type: 'input_value', name: 'Z', check: 'Number' },
      { type: 'input_value', name: 'W', check: 'Number' },
      { type: 'input_value', name: 'D', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.world,
  },
  {
    type: 'game_clear_world',
    message0: '%1 놓은 것 모두 치우기',
    args0: [{ type: 'field_image', src: 'svg/eraser-solid.svg', width: 22, height: 22 }],
    previousStatement: null, nextStatement: null,
    colour: game_colour.world,
  },

  // ── 꾸미기 (시뮬 전용) ──
  {
    type: 'game_eye',
    message0: '%1 %2 눈을 %3 색으로 켜기',
    args0: [
      { type: 'field_image', src: 'svg/eye-solid.svg', width: 22, height: 22 },
      { type: 'field_dropdown', name: 'SIDE',
        options: [['양쪽', 'both'], ['왼쪽', 'left'], ['오른쪽', 'right']] },
      { type: 'input_value', name: 'COLOR', check: 'Colour' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.score,
    tooltip: '눈(안경) LED 색을 바꿉니다. 색은 색상 블록을 끼워 정합니다.',
  },
  {
    type: 'game_part',
    message0: '%1 %2 을(를) %3 색으로',
    args0: [
      { type: 'field_image', src: 'svg/person-solid.svg', width: 22, height: 22 },
      { type: 'field_dropdown', name: 'PART', options: [
        ['전체', 'all'],
        ['몸통', 'base_link'], ['머리', 'head_link'], ['목', 'head_pan_link'],
        ['왼팔', 'arm_l_link'], ['오른팔', 'arm_r_link'],
        ['왼쪽 어깨', 'shoulder_l_link'], ['오른쪽 어깨', 'shoulder_r_link'],
        ['왼쪽 다리', 'leg_l_link'], ['오른쪽 다리', 'leg_r_link'],
        ['왼발', 'foot_l_link'], ['오른발', 'foot_r_link'],
        ['머리 장식', 'acc:head_top'],
      ] },
      { type: 'input_value', name: 'COLOR', check: 'Colour' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.score,
    tooltip: '체험툴의 파트 색상과 같습니다. 몸 각 부위의 색을 바꿉니다.',
  },
  {
    type: 'game_lcd',
    message0: '%1 가슴 화면에 %2 쓰기',
    args0: [
      { type: 'field_image', src: 'svg/font-solid.svg', width: 22, height: 22 },
      { type: 'input_value', name: 'MSG', check: 'String' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.score,
    tooltip: '몸통 LCD 에 글씨를 표시합니다.',
  },

  // ── 점수 ──
  {
    type: 'game_add_score',
    message0: '%1 점수 %2 만큼 바꾸기',
    args0: [
      { type: 'field_image', src: 'svg/list-check-solid.svg', width: 22, height: 22 },
      { type: 'input_value', name: 'N', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.score,
  },
  {
    type: 'game_add_life',
    message0: '%1 목숨 %2 만큼 바꾸기',
    args0: [
      { type: 'field_image', src: 'svg/database-solid.svg', width: 22, height: 22 },
      { type: 'input_value', name: 'N', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.score,
  },
  {
    type: 'game_speak',
    message0: '%1 %2 라고 말하기',
    args0: [
      { type: 'field_image', src: 'svg/comment-dots-solid.svg', width: 22, height: 22 },
      { type: 'input_value', name: 'MSG', check: 'String' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.score,
    tooltip: '소리내어 읽습니다 (TTS). 말이 끝날 때까지 기다립니다.',
  },
  {
    type: 'game_say',
    message0: '%1 %2 라고 알리기',
    args0: [
      { type: 'field_image', src: 'svg/font-solid.svg', width: 22, height: 22 },
      { type: 'input_value', name: 'MSG', check: 'String' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.score,
  },
  {
    type: 'game_over',
    message0: '%1 게임 %2',
    args0: [
      { type: 'field_image', src: 'svg/stop-solid.svg', width: 22, height: 22 },
      { type: 'field_dropdown', name: 'RESULT', options: [['성공!', 'win'], ['실패…', 'lose']] },
    ],
    inputsInline: true,
    previousStatement: null,
    colour: game_colour.score,
  },

  // ── 감지 ──
  { type: 'game_get_score', message0: '점수', output: 'Number', colour: game_colour.sense },
  {
    type: 'game_get_time',
    message0: '경과 시간(초)',
    output: 'Number', colour: game_colour.sense,
    tooltip: '게임 시작부터 지금까지 걸린 시간입니다. 초 단위 (소수점 1자리).',
  },
  { type: 'game_get_lives', message0: '목숨', output: 'Number', colour: game_colour.sense },
  {
    type: 'game_get_pos',
    message0: '내 %1 위치',
    args0: [{ type: 'field_dropdown', name: 'AXIS', options: [['x', 'x'], ['z', 'z']] }],
    output: 'Number', colour: game_colour.sense,
  },
  { type: 'game_is_fallen', message0: '넘어졌는가?', output: 'Boolean', colour: game_colour.sense },
  {
    type: 'game_item_left',
    message0: '남은 %1 개수',
    args0: [{ type: 'field_dropdown', name: 'KIND',
      options: [['전체', 'any'], ['동전', 'coin'], ['보석', 'gem'], ['하트', 'heart'], ['상자', 'box'],
        ['별', 'star'], ['열쇠', 'key'], ['휴지통', 'trash'], ['공', 'ball']] }],
    output: 'Number', colour: game_colour.sense,
  },
  {
    type: 'game_wait',
    message0: '%1 %2 초 기다리기',
    args0: [
      { type: 'field_image', src: 'svg/bed-solid.svg', width: 22, height: 22 },
      { type: 'input_value', name: 'SEC', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null, nextStatement: null,
    colour: game_colour.sense,
  },
]);
