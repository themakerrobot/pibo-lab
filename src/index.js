export default {
  async fetch(request, env) {
    const USER = env.BASIC_USER ?? "";
    const PASS = env.BASIC_PASS ?? "";

    // Secret 미설정 시 잠금 해제 (정식 오픈 시 Secret만 지우면 그대로 공개)
    if (!PASS) return env.ASSETS.fetch(request);

    const auth = request.headers.get("Authorization") || "";
    if (auth.startsWith("Basic ")) {
      let decoded = "";
      try {
        decoded = atob(auth.slice(6));
      } catch (e) {
        decoded = "";
      }
      const idx = decoded.indexOf(":");
      const user = idx === -1 ? "" : decoded.slice(0, idx);
      const pass = idx === -1 ? "" : decoded.slice(idx + 1);

      if (user === USER && pass === PASS) {
        const res = await env.ASSETS.fetch(request);
        const out = new Response(res.body, res);
        out.headers.set("X-Robots-Tag", "noindex, nofollow");
        return out;
      }
    }

    return new Response(LOCK_PAGE, {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Pibo Lab", charset="UTF-8"',
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  },
};

const LOCK_PAGE = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>파이보 랩 — 시험버전</title>
<style>
  :root {
    --brand:#00BEDC; --brand-dim:#0097AF; --ink:#0F1B22;
    --muted:#5B7280; --line:#DCE7EC; --card:#FFFFFF;
  }
  *{box-sizing:border-box} html,body{height:100%}
  body{
    margin:0; padding:24px; display:flex; align-items:center; justify-content:center;
    font-family:"Pretendard",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
    color:var(--ink);
    background:
      radial-gradient(900px 500px at 15% -10%, rgba(0,190,220,.18), transparent 60%),
      radial-gradient(700px 500px at 95% 110%, rgba(0,190,220,.12), transparent 60%),
      #F4F8FA;
  }
  .card{
    width:100%; max-width:460px; background:var(--card);
    border:1px solid var(--line); border-radius:20px;
    padding:40px 32px 32px; text-align:center;
    box-shadow:0 20px 50px rgba(15,27,34,.10);
  }
  .bot{width:92px;height:92px;margin-bottom:20px}
  .bot .body{fill:var(--brand)} .bot .face{fill:#0F1B22} .bot .eye{fill:var(--brand)}
  .badge{
    display:inline-block; font-size:.72rem; font-weight:700; letter-spacing:.08em;
    color:var(--brand-dim); background:rgba(0,190,220,.12);
    border-radius:999px; padding:5px 12px; margin-bottom:14px;
  }
  h1{font-size:1.35rem;margin:0 0 10px;letter-spacing:-.02em}
  p{margin:6px 0;color:var(--muted);font-size:.92rem;line-height:1.6}
  .divider{height:1px;background:var(--line);margin:26px 0 18px}
  .foot{font-size:.78rem;color:#93A7B2}
  .dots{display:flex;gap:6px;justify-content:center;margin-top:18px}
  .dots i{width:7px;height:7px;border-radius:50%;background:var(--brand);opacity:.35;animation:blink 1.4s infinite}
  .dots i:nth-child(2){animation-delay:.2s} .dots i:nth-child(3){animation-delay:.4s}
  @keyframes blink{0%,100%{opacity:.25}50%{opacity:1}}
  @media (prefers-color-scheme:dark){
    :root{--ink:#EAF4F7;--muted:#9DB2BC;--line:#25353E;--card:#141F26}
    body{background:radial-gradient(900px 500px at 15% -10%, rgba(0,190,220,.16), transparent 60%),#0B1419}
    .bot .face{fill:#0B1419} .foot{color:#6E838E}
  }
</style>
</head>
<body>
  <main class="card">
    <svg class="bot" viewBox="0 0 100 100" aria-hidden="true">
      <rect class="body" x="18" y="14" width="64" height="52" rx="16"/>
      <rect class="face" x="28" y="26" width="44" height="26" rx="9"/>
      <circle class="eye" cx="41" cy="39" r="4.6"/>
      <circle class="eye" cx="59" cy="39" r="4.6"/>
      <rect class="body" x="30" y="72" width="40" height="14" rx="7"/>
      <rect class="body" x="47" y="4" width="6" height="12" rx="3"/>
      <circle class="body" cx="50" cy="4" r="4.5"/>
    </svg>
    <div class="badge">시험버전 · TEST BUILD</div>
    <h1>파이보 랩 준비 중입니다</h1>
    <p>현재 내부 확인을 위해 접근이 제한되어 있습니다.</p>
    <p>접속 계정은 별도로 안내드립니다.</p>
    <div class="dots"><i></i><i></i><i></i></div>
    <div class="divider"></div>
    <p class="foot">Pibo Lab · Circulus</p>
  </main>
</body>
</html>`;
