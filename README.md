# pibo-lab

PIBO 휴머노이드 로봇용 웹 URDF 시뮬레이터. 브라우저에서 URDF와 STL을 불러와 관절을 조작하고, 타임라인으로 모션을 제작해 실물 PIBO 모션 툴 포맷(JSON)으로 내보내기

데모:

[Release]
https://pibo-lab.themaker.workers.dev/

## 계정 로그인

파이보 랩은 통합 계정으로 로그인해야 들어갈 수 있다. (Cloudflare Workers 배포와 PiboLab.exe 모두 동일)

- 로그인 화면 `/login`, 로그아웃 `/logout`, 세션 확인 `/me`(JSON), 상태 `/healthz`
- 세션 쿠키 `pibo_lab_session` — 24시간 유효(`SESSION_HOURS`), 10분마다 계정 재검증(`CHECK_MINUTES`)
- 로그인 화면의 언어 토글(EN/한)은 본편과 같은 `localStorage 'language'` 를 공유한다

### Cloudflare Workers

`src/index.js` 가 앞단 인증을 맡고, 정적 파일은 `[assets]` 로 서빙된다. 설정값은 `wrangler.toml` `[vars]` 참고.
세션 서명 비밀키는 Secret 으로 한 번 등록해야 한다:

```
npx wrangler secret put SESSION_SECRET
```

배포 흐름: `main` → (테스트) → `release` 머지 → Cloudflare 자동 배포.

### PiboLab.exe

`v*` 태그 push 시 `.github/workflows/build-exe.yml` 이 빌드해 Releases 에 첨부한다. 실행 옵션:

```
PiboLab.exe [-port 50030] [-secret ...] [-hours 24] [-check 10]
            [-api https://api-intgr.circul.us/v1] [-client-id pibolab] [-unique ""] [-debug] [-no-open]
```

`-secret` 을 주지 않으면 실행마다 랜덤 키를 쓰므로 exe 를 재시작하면 다시 로그인해야 한다.

## 기능

- URDF + STL 업로드 후 3D 렌더링 (three.js, 별도 설치 불필요)
- 관절별 슬라이더/숫자 입력 (1도 단위 정수), 모터 이름(M0~M9) 표시
- 타임라인 키프레임 기반 모션 제작 (재생/루프/속도 조절)
- 모션 저장 시 실물 PIBO 포맷으로 내보내기 → 로봇에 바로 업로드
- 실물 모션 JSON 불러오기 (999 = 이전값 유지 처리)
- 포즈 저장/불러오기, 와이어프레임, 관절 좌표축, 스크린샷

## 사용법

1. 데모 페이지 접속 또는 `index.html` 실행
2. URDF 파일 선택
3. 해당 STL 전체 다중 선택 (`data/` 폴더)
4. 로드 후 우측 슬라이더로 자세 조작
5. 타임라인에서 키프레임 추가해 모션 제작
6. 모션 저장 → 실물 PIBO 모션 툴에 import

## 모터 매핑

| 모터 | 관절 | 범위(°) |
|------|------|--------|
| M0 | Right Foot (발목 우) | ±25 |
| M1 | Right Leg (엉덩이 우) | ±35 |
| M2 | Right Arm (어깨 우) | ±80 |
| M3 | Right Hand (팔꿈치 우) | ±30 |
| M4 | Head Pan | ±50 |
| M5 | Head Tilt | ±25 |
| M6 | Left Foot (발목 좌) | ±25 |
| M7 | Left Leg (엉덩이 좌) | ±35 |
| M8 | Left Arm (어깨 좌) | ±80 |
| M9 | Left Hand (팔꿈치 좌) | ±30 |

어깨(M2/M8)는 슬라이더 0 = 앞으로 나란히 기준

## 모션 포맷

```json
{ "<이름>": {
    "init_def": 1,
    "init": [M0..M9],
    "pos": [ { "d": [M0..M9], "seq": <ms> }, ... ]
}}
```

값은 정수(도), `seq`는 ms, `d`의 `999`는 이전 프레임 값 유지

## 데이터

`data/` 에 PIBO URDF와 STL 메시 포함
