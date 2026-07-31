// ═══════════════════════════════════════════════════════════
// 커스텀 블록 → JavaScript (시뮬 실행용)
// ═══════════════════════════════════════════════════════════
// 실물은 customblock_callback.js 가 Python 을 만든다. 이 파일은 같은 블록에서
// 시뮬용 JS 를 만든다. 블록 정의는 건드리지 않으므로 JSON 호환은 유지된다.
//
// 생성되는 코드는 JS-Interpreter 위에서 돈다. 시간이 걸리는 동작은
// blockly_run.js 에서 createAsyncFunction 으로 연결되어 '끝날 때까지 대기' 한다.
(function () {
  const JS = Blockly.JavaScript;
  const ORD_ATOMIC = JS.ORDER_ATOMIC ?? 0;
  const ORD_NONE = JS.ORDER_NONE ?? 99;
  const val = (b, n, d) => JS.valueToCode(b, n, ORD_NONE) || d;
  const G = JS.forBlock;

  // ── 시작 ──
  G['flag_event'] = () => '';

  // ── 동작 ──
  G['motion_set_motion_dropdown'] = b =>
    `simPlayMotion(${JSON.stringify(b.getFieldValue('name'))}, ${val(b, 'cycle', '1')});\n`;
  G['motion_set_motion'] = b =>
    `simPlayMotion(${val(b, 'name', "''")}, ${val(b, 'cycle', '1')});\n`;
  G['motion_set_mymotion'] = G['motion_set_motion'];
  G['motion_init_motion'] = () => 'simInitMotion();\n';
  G['motion_set_motor'] = b =>
    `simSetMotor(${b.getFieldValue('no')}, ${val(b, 'pos', '0')});\n`;
  G['motion_set_motors'] = b =>
    `simSetMotors(${val(b, 'val_list', "''")}, ${val(b, 'time', '1000')});\n`;
  // 속도·가속도는 실물 서보 설정값. 시뮬에는 대응이 없어 기록만 남긴다.
  G['motion_set_speed'] = b =>
    `simNote('set_speed(' + ${b.getFieldValue('no')} + ', ' + ${val(b, 'val', '0')} + ') — ${PIBO_T('시뮬 미반영')}');\n`;
  G['motion_set_acceleration'] = b =>
    `simNote('set_acceleration(' + ${b.getFieldValue('no')} + ', ' + ${val(b, 'val', '0')} + ') — ${PIBO_T('시뮬 미반영')}');\n`;
  G['motion_get_motion'] = () => ['simGetMotionList()', ORD_ATOMIC];
  G['motion_get_mymotion'] = () => ['simGetMotionList()', ORD_ATOMIC];

  // ── 장치 (눈) ──
  G['device_eye_colour_on'] = b =>
    `simEye(${val(b, 'left', "'#00e1ff'")}, ${val(b, 'right', "'#00e1ff'")});\n`;
  G['device_eye_on'] = b =>
    `simEyeRGB(${val(b, 'val0', '0')}, ${val(b, 'val1', '0')}, ${val(b, 'val2', '0')},` +
    ` ${val(b, 'val3', '0')}, ${val(b, 'val4', '0')}, ${val(b, 'val5', '0')});\n`;

  // ── 화면 (OLED → 몸통 LCD) ──
  G['oled_set_font'] = b => `simOled('font', ${val(b, 'size', '20')});\n`;
  G['oled_draw_text'] = b =>
    `simOled('text', ${val(b, 'x', '0')}, ${val(b, 'y', '0')}, ${val(b, 'text', "''")});\n`;
  G['oled_draw_rectangle'] = b =>
    `simOled('rect', ${val(b, 'x1', '0')}, ${val(b, 'y1', '0')}, ${val(b, 'x2', '0')}, ${val(b, 'y2', '0')},` +
    ` ${b.getFieldValue('fill') === 'True'});\n`;
  G['oled_draw_ellipse'] = b =>
    `simOled('ellipse', ${val(b, 'x1', '0')}, ${val(b, 'y1', '0')}, ${val(b, 'x2', '0')}, ${val(b, 'y2', '0')},` +
    ` ${b.getFieldValue('fill') === 'True'});\n`;
  G['oled_draw_line'] = b =>
    `simOled('line', ${val(b, 'x1', '0')}, ${val(b, 'y1', '0')}, ${val(b, 'x2', '0')}, ${val(b, 'y2', '0')});\n`;
  G['oled_invert'] = () => "simOled('invert');\n";
  G['oled_show'] = () => "simOled('show');\n";
  G['oled_clear'] = () => "simOled('clear');\n";

  // ── 음성 (브라우저 TTS) ──
  // 실물은 voice / lang 으로 화자가 갈리지만 시뮬은 한 목소리로 통일한다.
  const say = b => `simSpeak(${val(b, 'text', "''")}, ${val(b, 'volume', '80')},` +
    ` ${JSON.stringify(b.getFieldValue('voice') || '')});\n`;
  G['speech_tts_play'] = say;
  G['speech_gtts_play'] = say;
  G['speech_otts_play'] = say;
  G['speech_etts_play'] = say;

  // ── 도구 ──
  G['utils_sleep'] = b => `simSleep(${val(b, 'time', '0')});\n`;
  G['utils_time'] = () => ['(Date.now() / 1000)', ORD_ATOMIC];
  G['utils_current_time'] = () => ['simNow()', ORD_ATOMIC];
  G['utils_typecast_string'] = b => [`String(${val(b, 'value', "''")})`, ORD_ATOMIC];
  G['utils_typecast_number'] = b => {
    const f = b.getFieldValue('type') === 'int' ? 'parseInt' : 'parseFloat';
    return [`${f}(${val(b, 'value', '0')})`, ORD_ATOMIC];
  };
  G['utils_include'] = b => [`(String(${val(b, 'a', "''")}).indexOf(String(${val(b, 'b', "''")})) >= 0)`, ORD_ATOMIC];
  G['utils_dict_create'] = () => '';
  G['utils_dict_get'] = b => [`(${val(b, 'dictionary', '{}')})[${val(b, 'keyname', "''")}]`, ORD_ATOMIC];
  G['utils_dict_set'] = b =>
    `(${val(b, 'dictionary', '{}')})[${val(b, 'keyname', "''")}] = ${val(b, 'value', 'null')};\n`;
  G['utils_calculate_angle'] = b =>
    [`simAngle(${val(b, 'p1', 'null')}, ${val(b, 'p2', 'null')}, ${val(b, 'p3', 'null')})`, ORD_ATOMIC];

  // 내장 text_print 는 window.alert 을 부른다 → 콘솔 출력으로 교체
  G['text_print'] = b => `simPrint(${val(b, 'TEXT', "''")});\n`;

  // ── 사용자 정의 함수 안에서도 대기가 되도록 ──
  // JS-Interpreter 를 쓰므로 async 전염 문제는 없다. 원본 제너레이터를 그대로 둔다.

  // ── 안전망: 제너레이터가 없는 블록은 주석 한 줄로 대체 ──
  // 실물에서 만든 JSON 을 열었을 때 코드 생성이 통째로 실패하는 것을 막는다.
  Blockly.Blocks && Object.keys(Blockly.Blocks).forEach(t => {
    if (G[t]) return;
    G[t] = function (block) {
      const unsupported = `// ${t}: ${PIBO_T('시뮬 미지원')}\n`;
      return block.outputConnection ? ['null', ORD_ATOMIC] : `simNote('${t} — ${PIBO_T('시뮬 미지원, 건너뜀')}');\n`;
    };
  });
})();
