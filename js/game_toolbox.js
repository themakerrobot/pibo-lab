// ═══════════════════════════════════════════════════════════
// 게임 툴박스 — 게임 전용 블록 + 기본 블록
// ═══════════════════════════════════════════════════════════
// toolbox_sim.js(실물 호환용)와 분리. 여기에는 실물 블록을 넣지 않는다.
const gN = num => ({ shadow: { type: 'math_number', fields: { NUM: String(num) } } });
const gT = t => ({ shadow: { type: 'text', fields: { TEXT: t } } });

const GAME_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: '시작', colour: game_colour.event,
      cssConfig: { icon: 'customIcon fa-solid fa-circle-play' },
      contents: [
        { kind: 'block', type: 'game_start' },
        { kind: 'block', type: 'game_forever' },
        { kind: 'block', type: 'game_on_event' },
        { kind: 'block', type: 'game_on_key' },
      ] },

    { kind: 'sep' },

    { kind: 'category', name: '움직임', colour: game_colour.move,
      cssConfig: { icon: 'customIcon fa-solid fa-person-walking' },
      contents: [
        { kind: 'block', type: 'game_move', inputs: { N: gN(1) } },
        { kind: 'block', type: 'game_turn', inputs: { N: gN(1) } },
        { kind: 'block', type: 'game_goto', inputs: { X: gN(0), Z: gN(0) } },
        { kind: 'block', type: 'game_motion' },
      ] },

    { kind: 'category', name: '무대', colour: game_colour.world,
      cssConfig: { icon: 'customIcon fa-solid fa-toolbox' },
      contents: [
        { kind: 'block', type: 'game_add_item_random', inputs: { N: gN(5) } },
        { kind: 'block', type: 'game_add_item', inputs: { X: gN(0.2), Z: gN(0.2) } },
        { kind: 'block', type: 'game_add_goal', inputs: { X: gN(0), Z: gN(0.4) } },
        { kind: 'block', type: 'game_add_wall',
          inputs: { X: gN(0), Z: gN(0.2), W: gN(0.3), D: gN(0.04) } },
        { kind: 'block', type: 'game_clear_world' },
      ] },

    { kind: 'category', name: '점수', colour: game_colour.score,
      cssConfig: { icon: 'customIcon fa-solid fa-list' },
      contents: [
        { kind: 'block', type: 'game_add_score', inputs: { N: gN(1) } },
        { kind: 'block', type: 'game_add_life', inputs: { N: gN(-1) } },
        { kind: 'block', type: 'game_say', inputs: { MSG: gT('잘했어요!') } },
        { kind: 'block', type: 'game_speak', inputs: { MSG: gT('안녕! 나는 파이보야') } },
        { kind: 'block', type: 'game_over' },
      ] },

    { kind: 'category', name: '꾸미기', colour: game_colour.score,
      cssConfig: { icon: 'customIcon fa-solid fa-wand-magic-sparkles' },
      contents: [
        { kind: 'block', type: 'game_eye',
          inputs: { COLOR: { shadow: { type: 'colour_picker', fields: { COLOUR: '#00e1ff' } } } } },
        { kind: 'block', type: 'game_lcd', inputs: { MSG: gT('GO!') } },
        { kind: 'block', type: 'colour_picker', fields: { COLOUR: '#00e1ff' } },
        { kind: 'block', type: 'colour_random' },
      ] },

    { kind: 'category', name: '감지', colour: game_colour.sense,
      cssConfig: { icon: 'customIcon fa-solid fa-magnifying-glass' },
      contents: [
        { kind: 'block', type: 'game_get_score' },
        { kind: 'block', type: 'game_get_lives' },
        { kind: 'block', type: 'game_get_time' },
        { kind: 'block', type: 'game_get_pos' },
        { kind: 'block', type: 'game_is_fallen' },
        { kind: 'block', type: 'game_item_left' },
        { kind: 'block', type: 'game_wait', inputs: { SEC: gN(1) } },
      ] },

    { kind: 'sep' },

    { kind: 'category', name: '논리', colour: '#B098CB',
      cssConfig: { icon: 'customIcon fa fa-bars-staggered' },
      contents: ['controls_if', 'logic_compare', 'logic_operation', 'logic_negate', 'logic_boolean']
        .map(t => ({ kind: 'block', type: t })) },

    { kind: 'category', name: '반복', colour: '#85B687',
      cssConfig: { icon: 'customIcon fa fa-arrows-spin' },
      contents: [
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: gN(10) } },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for', inputs: { FROM: gN(1), TO: gN(10), BY: gN(1) } },
        { kind: 'block', type: 'controls_flow_statements' },
      ] },

    { kind: 'category', name: '수학', colour: '#2196F3',
      cssConfig: { icon: 'customIcon fa fa-square-root-variable' },
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: '0' } },
        { kind: 'block', type: 'math_arithmetic', inputs: { A: gN(1), B: gN(1) } },
        { kind: 'block', type: 'math_random_int', inputs: { FROM: gN(1), TO: gN(10) } },
        { kind: 'block', type: 'math_round', inputs: { NUM: gN(3.1) } },
        { kind: 'block', type: 'math_modulo', inputs: { DIVIDEND: gN(10), DIVISOR: gN(3) } },
      ] },

    { kind: 'category', name: '문자', colour: '#FFAA08',
      cssConfig: { icon: 'customIcon fa fa-t' },
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
      ] },

    { kind: 'sep' },

    { kind: 'category', name: '변수', colour: '#EF9A9A', custom: 'VARIABLE',
      cssConfig: { icon: 'customIcon fa fa-v' }, contents: [] },
    { kind: 'category', name: '함수', colour: '#C7BCB8', custom: 'PROCEDURE',
      cssConfig: { icon: 'customIcon fa fa-florin-sign' }, contents: [] },
  ],
};
