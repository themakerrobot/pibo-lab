// ═══════════════════════════════════════════════════════════
// // 설정 — 실물 모터 매핑 / 자동 로드 경로. 체험툴·개발툴 공용
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// PIBO 실물 모션 설정  ★★★ 여기만 보면 됨 ★★★
// ═══════════════════════════════════════════════════════════
// 슬라이더 0 = 실물 모터 0 (= 앞으로 나란히). 어깨는 모델 0이 "팔 내림"이라
// 슬라이더 0에서 -90° 오프셋을 줘서 "앞으로 나란히"가 0이 되게 함.
const ZERO_OFFSET = {            // 라디안. 슬라이더 0일 때 추가 적용할 각도
  shoulder_l_joint: -Math.PI/2,
  shoulder_r_joint:  Math.PI/2,
};
// 뷰어에서만 회전방향 뒤집기(실물과 시각 일치). 저장값(모터)은 슬라이더 그대로.
const VIEWER_SIGN = {};
// 슬라이더에 표시할 실물 모터 이름
const MOTOR_LABEL = {
  ankle_r_joint:'M0 (Right Foot)', hip_r_joint:'M1 (Right Leg)',
  shoulder_r_joint:'M2 (Right Arm)', elbow_r_joint:'M3 (Right Hand)',
  head_pan_joint:'M4 (Head Pan)', head_tilt_joint:'M5 (Head Tilt)',
  ankle_l_joint:'M6 (Left Foot)', hip_l_joint:'M7 (Left Leg)',
  shoulder_l_joint:'M8 (Left Arm)', elbow_l_joint:'M9 (Left Hand)',
};
// M0..M9 → URDF joint + 부호. (저장 시 슬라이더값[deg] = 모터값)
const PIBO_MAP = [
  {j:'ankle_r_joint',    s: 1},  // M0 Right Foot ±25
  {j:'hip_r_joint',      s: 1},  // M1 Right Leg  ±35
  {j:'shoulder_r_joint', s: 1},  // M2 Right Arm  ±80
  {j:'elbow_r_joint',    s: 1},  // M3 Right Hand ±30
  {j:'head_pan_joint',   s: 1},  // M4 Head Pan   ±50
  {j:'head_tilt_joint',  s: 1},  // M5 Head Tilt  ±25
  {j:'ankle_l_joint',    s: 1},  // M6 Left Foot  ±25
  {j:'hip_l_joint',      s: 1},  // M7 Left Leg   ±35
  {j:'shoulder_l_joint', s: 1},  // M8 Left Arm   ±80
  {j:'elbow_l_joint',    s: 1},  // M9 Left Hand  ±30
];
const PIBO_DEFAULT_INIT = [0,0,-70,-25,0,0,0,0,70,25]; // 저장 못 했을때 기본 init

// ── data/ 자동 로드 설정 ──
const AUTOLOAD   = true;          // 페이지 열면 data/에서 자동 로드
const DATA_DIR   = 'data/';
const URDF_NAMES = ['pibo.urdf'];
