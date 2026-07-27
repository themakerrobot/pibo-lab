// ═══════════════════════════════════════════════════════════
// Blockly 테마 — 실물 IDE(index.js)의 'modest' 테마를 그대로 옮김
// ═══════════════════════════════════════════════════════════
// renderer 'zelos' + startHats 조합이라 스크래치처럼 둥근 블록에
// '시작' 블록만 모자(hat) 모양이 된다.
const PIBO_THEME = Blockly.Theme.defineTheme('modest', {
  base: Blockly.Themes.Classic,
  startHats: true,
  fontStyle: {
    family: null,
    weight: 'bold',
    size: 16,
  },
  blockStyles: {
    logic_blocks:     { colourPrimary: '#B098CB', colourSecondary: '#EDE7F6', colorTertiary: '#B39DDB' },
    loop_blocks:      { colourPrimary: '#85B687', colourSecondary: '#E8F5E9', colorTertiary: '#66BB6A' },
    math_blocks:      { colourPrimary: '#2196F3', colourSecondary: '#1E88E5', colorTertiary: '#0D47A1' },
    text_blocks:      { colourPrimary: '#FFAA08', colourSecondary: '#555555', colorTertiary: '#FF8F00' },
    list_blocks:      { colourPrimary: '#4DB6AC', colourSecondary: '#B2DFDB', colorTertiary: '#009688' },
    colour_blocks:    { colourPrimary: '#DFADB2', colourSecondary: '#FFEBEE', colorTertiary: '#EF9A9A' },
    variable_blocks:  { colourPrimary: '#EF9A9A', colourSecondary: '#EF9A9A', colorTertiary: '#EF5350' },
    procedure_blocks: { colourPrimary: '#C7BCB8', colourSecondary: '#EFEBE9', colorTertiary: '#BCAAA4' },
  },
  categoryStyles: {},
  componentStyles: {
    flyoutOpacity: 0.5,
    insertionMarkerOpacity: 0.5,
    scrollbarOpacity: 0.5,
    selectedGlowColour: '#000000',
    selectedGlowSize: 0.5,
    replacementGlowColour: '#000000',
  },
});

// 실물 IDE 의 Blockly.inject 옵션 (시뮬에 없는 항목만 제외)
const PIBO_BLOCKLY_OPTIONS = {
  collapse: true,
  comments: true,
  disable: true,
  maxBlocks: Infinity,
  trashcan: true,
  horizontalLayout: false,
  toolboxPosition: 'start',
  css: true,
  rtl: false,
  scrollbars: true,
  sounds: false,
  oneBasedIndex: true,
  grid: { spacing: 20, length: 3, colour: '#FFFFFF', snap: true },
  zoom: { controls: true, wheel: false, startScale: 0.7, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2, pinch: true },
  move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
  renderer: 'zelos',
  theme: PIBO_THEME,
};
