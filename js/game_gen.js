// ═══════════════════════════════════════════════════════════
// 게임 블록 → JavaScript
// ═══════════════════════════════════════════════════════════
// generator_js.js(실물 호환용)와 완전히 분리. 여기서 만드는 코드는
// game_run.js 가 JS-Interpreter 위에서 실행한다.
(function () {
  const JS = Blockly.JavaScript;
  const A = JS.ORDER_ATOMIC ?? 0;
  const N = JS.ORDER_NONE ?? 99;
  const val = (b, n, d) => JS.valueToCode(b, n, N) || d;
  const stmt = (b, n) => JS.statementToCode(b, n) || '';
  const G = JS.forBlock;

  // ── 이벤트 ──
  // 이벤트 본문을 __H 객체에 넣어두고, 실행기가 붙이는 디스패치 루프가 꺼내 부른다.
  // (JS-Interpreter 에는 호스트에서 인터프리터 함수를 부르는 API 가 없어서
  //  이벤트 처리를 인터프리터 '안'에서 돌린다.)
  G['game_start'] = () => '';
  G['game_forever'] = b => `while (gRunning()) {\n${stmt(b, 'DO')}__pump();\n}\n`;
  G['game_on_event'] = b =>
    `__H['evt:${b.getFieldValue('EVT')}'] = function () {\n${stmt(b, 'DO')}};\n`;
  G['game_on_key'] = b =>
    `__H['key:${b.getFieldValue('KEY')}'] = function () {\n${stmt(b, 'DO')}};\n`;

  // ── 이동 ──
  G['game_move'] = b =>
    `gMove(${b.getFieldValue('DIR')} * (${val(b, 'N', '1')}));\n`;
  G['game_turn'] = b =>
    `gTurn(${b.getFieldValue('DIR')} * (${val(b, 'N', '1')}));\n`;
  G['game_goto'] = b =>
    `gGoto(${val(b, 'X', '0')}, ${val(b, 'Z', '0')});\n`;
  G['game_motion'] = b =>
    `gMotion(${JSON.stringify(b.getFieldValue('NAME'))});\n`;

  // ── 월드 ──
  G['game_add_item'] = b =>
    `gAddItem(${JSON.stringify(b.getFieldValue('KIND'))}, ${val(b, 'X', '0')}, ${val(b, 'Z', '0')});\n`;
  G['game_add_item_random'] = b =>
    `gAddItemRandom(${JSON.stringify(b.getFieldValue('KIND'))}, ${val(b, 'N', '3')});\n`;
  G['game_add_goal'] = b =>
    `gAddGoal(${val(b, 'X', '0')}, ${val(b, 'Z', '0.3')});\n`;
  G['game_add_wall'] = b =>
    `gAddWall(${val(b, 'X', '0')}, ${val(b, 'Z', '0')}, ${val(b, 'W', '0.2')}, ${val(b, 'D', '0.05')});\n`;
  G['game_clear_world'] = () => 'gClear();\n';

  // ── 점수 ──
  G['game_add_score'] = b => `gScore(${val(b, 'N', '1')});\n`;
  G['game_add_life'] = b => `gLife(${val(b, 'N', '-1')});\n`;
  G['game_say'] = b => `gSay(${val(b, 'MSG', "''")});\n`;
  G['game_over'] = b => `gOver(${JSON.stringify(b.getFieldValue('RESULT'))});\n`;

  // ── 감지 ──
  G['game_get_score'] = () => ['gGetScore()', A];
  G['game_get_lives'] = () => ['gGetLives()', A];
  G['game_get_pos'] = b => [`gGetPos(${JSON.stringify(b.getFieldValue('AXIS'))})`, A];
  G['game_is_fallen'] = () => ['gIsFallen()', A];
  G['game_item_left'] = b => [`gItemLeft(${JSON.stringify(b.getFieldValue('KIND'))})`, A];
  G['game_wait'] = b => `gWait(${val(b, 'SEC', '1')});\n`;

  // 내장 text_print 는 alert 을 부르므로 화면 알림으로 교체
  G['text_print'] = b => `gSay(${val(b, 'TEXT', "''")});\n`;

  // 제너레이터가 없는 블록은 주석으로 (실물 블록이 섞여 들어와도 죽지 않게)
  Blockly.Blocks && Object.keys(Blockly.Blocks).forEach(t => {
    if (G[t]) return;
    G[t] = block => block.outputConnection ? ['null', A] : `// ${t}: 게임에서 지원하지 않음\n`;
  });
})();
