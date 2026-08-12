// ═══════════════════════════════════════════════════════════
// 시뮬용 툴박스 — 웹 시뮬에서 실제로 실행되는 블록만 노출
// ═══════════════════════════════════════════════════════════
// 블록 정의(customblock.js)는 실물과 100% 동일한 파일을 쓴다.
// 여기서는 '무엇을 보여줄지'만 고른다. 숨긴 블록도 정의는 살아 있으므로
// 실물에서 만든 JSON 을 열어도 블록은 정상적으로 그려진다.
// 카테고리 이름과 예시 문자열은 실물 IDE 의 translations(ko2en.js)를 그대로 쓴다.
// lang 도 ko2en.js 가 정한 값을 따르므로 한/영이 실물과 동일하게 전환된다.
const TR = k => (typeof translations !== 'undefined' && translations[k])
  ? translations[k][typeof lang !== 'undefined' ? lang : 'ko'] : k;
const N = (n, num) => ({ shadow: { type: 'math_number', fields: { NUM: String(num) } } });
const T = (t) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
const V = () => ({ shadow: { type: 'variables_get' } });

const SIM_TOOLBOX = {
  kind: 'categoryToolbox',
  // 카테고리 순서는 실물 IDE(customblock_toolbox.js)와 동일:
  //   시작 -> 기본 블록 -> 변수/함수 -> 커스텀 블록
  contents: [
    { kind: 'category', name: TR('start'), colour: color_type['start'],
      cssConfig: { icon: 'customIcon fa-solid fa-circle-play' },
      contents: [{ kind: 'block', type: 'flag_event' }] },

    { kind: 'sep' },

    { kind: 'category', name: TR('logic'), colour: '#B098CB',
      cssConfig: { icon: 'customIcon fa fa-bars-staggered' },
      contents: ['controls_if', 'logic_compare', 'logic_operation', 'logic_negate',
                 'logic_boolean', 'logic_null', 'logic_ternary'].map(t => ({ kind: 'block', type: t })) },

    { kind: 'category', name: TR('loops'), colour: '#85B687',
      cssConfig: { icon: 'customIcon fa fa-arrows-spin' },
      contents: [
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: N('', 10) } },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for', inputs: { FROM: N('', 1), TO: N('', 10), BY: N('', 1) } },
        { kind: 'block', type: 'controls_forEach' },
        { kind: 'block', type: 'controls_flow_statements' },
      ] },

    { kind: 'category', name: TR('math'), colour: '#2196F3',
      cssConfig: { icon: 'customIcon fa fa-square-root-variable' },
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: '123' } },
        { kind: 'block', type: 'math_arithmetic', inputs: { A: N('', 1), B: N('', 1) } },
        { kind: 'block', type: 'math_single', inputs: { NUM: N('', 9) } },
        { kind: 'block', type: 'math_trig', inputs: { NUM: N('', 45) } },
        { kind: 'block', type: 'math_constant' },
        { kind: 'block', type: 'math_number_property', inputs: { NUMBER_TO_CHECK: N('', 0) } },
        { kind: 'block', type: 'math_round', inputs: { NUM: N('', 3.1) } },
        { kind: 'block', type: 'math_on_list' },
        { kind: 'block', type: 'math_modulo', inputs: { DIVIDEND: N('', 64), DIVISOR: N('', 10) } },
        { kind: 'block', type: 'math_constrain', inputs: { VALUE: N('', 50), LOW: N('', 1), HIGH: N('', 100) } },
        { kind: 'block', type: 'math_random_int', inputs: { FROM: N('', 1), TO: N('', 100) } },
        { kind: 'block', type: 'math_random_float' },
      ] },

    { kind: 'category', name: TR('text'), colour: '#FFAA08',
      cssConfig: { icon: 'customIcon fa fa-t' },
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_append', inputs: { TEXT: T('') } },
        { kind: 'block', type: 'text_length', inputs: { VALUE: T(TR('abc')) } },
        { kind: 'block', type: 'text_isEmpty', inputs: { VALUE: T('') } },
        { kind: 'block', type: 'text_indexOf', inputs: { FIND: T(TR('a')) } },
        { kind: 'block', type: 'text_charAt' },
        { kind: 'block', type: 'text_getSubstring' },
        { kind: 'block', type: 'text_changeCase', inputs: { TEXT: T('abc') } },
        { kind: 'block', type: 'text_trim', inputs: { TEXT: T('abc') } },
        { kind: 'block', type: 'text_count', inputs: { SUB: T(TR('a')), TEXT: T(TR('abc')) } },
        { kind: 'block', type: 'text_replace', inputs: { FROM: T(TR('b')), TO: T(TR('c')), TEXT: T(TR('abc')) } },
        { kind: 'block', type: 'text_reverse', inputs: { TEXT: T(TR('abc')) } },
        { kind: 'block', type: 'text_print', inputs: { TEXT: T(TR('abc')) } },
        { kind: 'block', type: 'text_prompt_ext', inputs: { TEXT: T(TR('abc')) } },
      ] },

    { kind: 'category', name: TR('lists'), colour: '#4DB6AC',
      cssConfig: { icon: 'customIcon fa fa-list' },
      contents: [
        { kind: 'block', type: 'lists_create_with', extraState: { itemCount: '0' } },
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_repeat', inputs: { NUM: N('', 5) } },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_isEmpty' },
        { kind: 'block', type: 'lists_indexOf' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_setIndex' },
        { kind: 'block', type: 'lists_getSublist' },
        { kind: 'block', type: 'lists_split', inputs: { DELIM: T(',') } },
        { kind: 'block', type: 'lists_sort' },
        { kind: 'block', type: 'lists_reverse' },
      ] },

    { kind: 'category', name: TR('colour'), colour: '#DFADB2',
      cssConfig: { icon: 'customIcon fa fa-palette' },
      contents: [
        { kind: 'block', type: 'colour_picker' },
        { kind: 'block', type: 'colour_random' },
        { kind: 'block', type: 'colour_rgb', inputs: { RED: N('', 100), GREEN: N('', 50), BLUE: N('', 0) } },
        { kind: 'block', type: 'colour_blend',
          inputs: { COLOUR1: { shadow: { type: 'colour_picker', fields: { COLOUR: '#ff0000' } } },
                    COLOUR2: { shadow: { type: 'colour_picker', fields: { COLOUR: '#3333ff' } } },
                    RATIO: N('', 0.5) } },
      ] },

    { kind: 'sep' },

    { kind: 'category', name: TR('variables'), colour: '#EF9A9A', custom: 'VARIABLE',
      cssConfig: { icon: 'customIcon fa fa-v' }, contents: [] },

    { kind: 'category', name: TR('functions'), colour: '#C7BCB8', custom: 'PROCEDURE',
      cssConfig: { icon: 'customIcon fa fa-florin-sign' }, contents: [] },

    { kind: 'sep' },

    { kind: 'category', name: TR('device'), colour: color_type['device'],
      cssConfig: { icon: 'customIcon fa-solid fa-walkie-talkie' },
      contents: [
        { kind: 'block', type: 'device_eye_colour_on', inputs: { left: V(), right: V() } },
        { kind: 'block', type: 'device_eye_on',
          inputs: { val0: N('', 0), val1: N('', 224), val2: N('', 255), val3: N('', 0), val4: N('', 224), val5: N('', 255) } },
      ] },

    { kind: 'category', name: TR('motion'), colour: color_type['motion'],
      cssConfig: { icon: 'customIcon fa-solid fa-person-walking' },
      contents: [
        { kind: 'block', type: 'motion_set_motion_dropdown', inputs: { cycle: N('cycle', 1) } },
        { kind: 'block', type: 'motion_set_motion', inputs: { name: T('wave1'), cycle: N('cycle', 1) } },
        { kind: 'block', type: 'motion_init_motion' },
        { kind: 'block', type: 'motion_set_motor', inputs: { pos: N('pos', 0) } },
        { kind: 'block', type: 'motion_set_motors', inputs: { val_list: T('0,0,0,0,0,0,0,0,0,0'), time: N('time', 1000) } },
        { kind: 'block', type: 'motion_set_speed', inputs: { val: N('val', 40) } },
        { kind: 'block', type: 'motion_set_acceleration', inputs: { val: N('val', 0) } },
        { kind: 'block', type: 'motion_get_motion' },
      ] },

    { kind: 'category', name: TR('oled'), colour: color_type['oled'],
      cssConfig: { icon: 'customIcon fa-solid fa-display' },
      contents: [
        { kind: 'block', type: 'oled_set_font', inputs: { size: N('size', 20) } },
        { kind: 'block', type: 'oled_draw_text', inputs: { x: N('x', 4), y: N('y', 20), text: T(TR('sample_text')) } },
        { kind: 'block', type: 'oled_draw_rectangle', inputs: { x1: N('', 0), y1: N('', 0), x2: N('', 40), y2: N('', 30) } },
        { kind: 'block', type: 'oled_draw_ellipse', inputs: { x1: N('', 0), y1: N('', 0), x2: N('', 40), y2: N('', 30) } },
        { kind: 'block', type: 'oled_draw_line', inputs: { x1: N('', 0), y1: N('', 0), x2: N('', 60), y2: N('', 40) } },
        { kind: 'block', type: 'oled_invert' },
        { kind: 'block', type: 'oled_show' },
        { kind: 'block', type: 'oled_clear' },
      ] },

    { kind: 'category', name: TR('speech'), colour: color_type['speech'],
      cssConfig: { icon: 'customIcon fa-solid fa-comment-dots' },
      contents: [
        // 온디바이스 TTS 하나만 노출 (나머지 음성 블록은 정의만 남기고 숨김)
        { kind: 'block', type: 'speech_otts_play', inputs: { text: T(TR('sample_text')), volume: N('volume', 80) } },
      ] },

    { kind: 'category', name: TR('utils'), colour: color_type['utils'],
      cssConfig: { icon: 'customIcon fa-solid fa-toolbox' },
      contents: [
        { kind: 'block', type: 'utils_sleep', inputs: { time: N('time', 1) } },
        { kind: 'block', type: 'utils_time' },
        { kind: 'block', type: 'utils_current_time' },
        { kind: 'block', type: 'utils_typecast_string', inputs: { value: N('value', 1) } },
        { kind: 'block', type: 'utils_typecast_number', inputs: { value: T('1') } },
        { kind: 'block', type: 'utils_include' },
        { kind: 'block', type: 'utils_dict_create' },
        { kind: 'block', type: 'utils_dict_get', inputs: { dictionary: V(), keyname: T(TR('keyname')) } },
        { kind: 'block', type: 'utils_dict_set', inputs: { dictionary: V(), keyname: T(TR('keyname')) } },
      ] },
  ]
};
